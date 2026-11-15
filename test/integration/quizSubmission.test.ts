import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { patternBuffer } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { startFileServer } from './support/fileServer';
import { runNode, runOk } from './support/run';
import {
	answerQuestions,
	completeAttempt,
	createQuiz,
	deleteQuiz,
	ESSAY,
	FIXTURE_TIMEOUT,
	MULTIPLE_CHOICE,
	quizCourse,
	startAttempt,
	submissionMarathon,
	takeQuiz,
	unwrap,
} from './support/quizzes';

const ACCESS_CODE = 'sésame "1" & 2';

/**
 * Resource: quizSubmission (attempts at a classic quiz). The student personas
 * take quizzes through the node, the teacher grades through the node, and every
 * step is verified by reading the quiz submission back from Canvas directly.
 */
describe('quizSubmission', () => {
	let courseId = '';
	let quizId = '';
	let assignmentId = '';
	let choiceQuestion: Json = {};
	let essayQuestion: Json = {};
	let attempt: Json = {};
	let submissionId = '';
	let marathon = { courseId: '', quizId: '', takers: [] as string[] };

	const base = (): string => `/api/v1/courses/${courseId}/quizzes/${quizId}`;
	const readSubmission = async (id: string): Promise<Json> =>
		((await canvas().get<Json>(`${base()}/submissions/${id}`)).quiz_submissions as Json[])[0];

	beforeAll(async () => {
		courseId = await quizCourse();
		const quiz = await createQuiz(
			courseId,
			{
				title: unique('Graded attempt'),
				access_code: ACCESS_CODE,
				allowed_attempts: 2,
				time_limit: 30,
				scoring_policy: 'keep_latest',
			},
			[MULTIPLE_CHOICE, ESSAY],
		);
		quizId = quiz.id;
		assignmentId = String(quiz.quiz.assignment_id);
		[choiceQuestion, essayQuestion] = quiz.questions;
		// The quiz many students have taken (list fixture, see support/quizzes.ts).
		marathon = await submissionMarathon();
	}, FIXTURE_TIMEOUT);

	it('start: a wrong or missing access code is refused', async () => {
		for (const options of [{ access_code: 'not the code' }, {}]) {
			const result = await runNode({
				resource: 'quizSubmission',
				operation: 'start',
				persona: 'student',
				params: { courseId, quizId, options, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({
				errorCode: 403,
				errorType: 'FORBIDDEN',
				resource: 'quizSubmission',
				operation: 'start',
			});
			expect(String(result.error[0].errorMessage)).toContain('invalid access code');
		}
	});

	it('start: begins an attempt for the user of the credential', async () => {
		const [item] = await runOk({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student',
			params: { courseId, quizId, options: { access_code: ACCESS_CODE } },
		});
		attempt = unwrap(item, 'quiz_submissions');
		submissionId = String(attempt.id);
		expect(attempt).toMatchObject({
			quiz_id: Number(quizId),
			user_id: Number(fx('studentUserId')),
			attempt: 1,
			workflow_state: 'untaken',
			attempts_left: 1,
		});
		expect(String(attempt.validation_token)).toMatch(/^[0-9a-f]{64}$/);

		expect(await readSubmission(submissionId)).toMatchObject({
			id: attempt.id,
			workflow_state: 'untaken',
			started_at: attempt.started_at,
			finished_at: null,
		});
	});

	it('start: a second start while the attempt is running is a conflict', async () => {
		const result = await runNode({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student',
			params: {
				courseId,
				quizId,
				options: { access_code: ACCESS_CODE },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT', operation: 'start' });
	});

	it('getTime: reports when the running attempt ends', async () => {
		const [time] = await runOk({
			resource: 'quizSubmission',
			operation: 'getTime',
			persona: 'student',
			params: { courseId, quizId, submissionId },
		});
		const expected = await new CanvasClient('student').get<Json>(`${base()}/submissions/${submissionId}/time`);
		expect(time.end_at).toBe(expected.end_at);
		// 30 minutes after the start.
		const length = new Date(String(time.end_at)).getTime() - new Date(String(attempt.started_at)).getTime();
		expect(Math.abs(length - 30 * 60 * 1000)).toBeLessThan(2000);
		expect(time.time_left).toBeGreaterThan(29 * 60 - 120);
		expect(time.time_left).toBeLessThanOrEqual(30 * 60);
	});

	it('getOwn: returns the attempt of the user of the credential, nothing for someone without one', async () => {
		const [own] = await runOk({
			resource: 'quizSubmission',
			operation: 'getOwn',
			persona: 'student',
			params: { courseId, quizId },
		});
		expect(own).toMatchObject({
			id: Number(submissionId),
			user_id: Number(fx('studentUserId')),
			workflow_state: 'untaken',
		});

		const none = await runNode({
			resource: 'quizSubmission',
			operation: 'getOwn',
			persona: 'student2',
			params: { courseId, quizId },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('complete: a wrong validation token, a wrong attempt and a missing access code are refused', async () => {
		const attempts: Array<[Json, number, string]> = [
			[{ attempt: 1, validationToken: 'f'.repeat(64), options: { access_code: ACCESS_CODE } }, 403, 'FORBIDDEN'],
			[
				{ attempt: 2, validationToken: attempt.validation_token, options: { access_code: ACCESS_CODE } },
				400,
				'VALIDATION_ERROR',
			],
			[{ attempt: 1, validationToken: attempt.validation_token }, 403, 'FORBIDDEN'],
		];
		for (const [params, errorCode, errorType] of attempts) {
			const result = await runNode({
				resource: 'quizSubmission',
				operation: 'complete',
				persona: 'student',
				params: { courseId, quizId, submissionId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, JSON.stringify(params)).toEqual([]);
			expect(result.error[0], JSON.stringify(params)).toMatchObject({ errorCode, errorType, operation: 'complete' });
		}
		expect((await readSubmission(submissionId)).workflow_state).toBe('untaken');
	});

	it('complete: turns the attempt in and Canvas grades what it can', async () => {
		const correct = (choiceQuestion.answers as Json[]).filter((a) => a.weight === 100);
		await answerQuestions(
			'student',
			attempt,
			{
				[String(choiceQuestion.id)]: correct[0].id,
				[String(essayQuestion.id)]: '<p>Light, water and CO₂ become sugar.</p>',
			},
			ACCESS_CODE,
		);
		const result = await runNode({
			resource: 'quizSubmission',
			operation: 'complete',
			persona: 'student',
			items: [{ submission: Number(submissionId), attempt: 1, token: attempt.validation_token }],
			params: {
				courseId,
				quizId,
				submissionId: '={{ $json.submission }}',
				attempt: '={{ $json.attempt }}',
				validationToken: '={{ $json.token }}',
				options: { access_code: ACCESS_CODE },
			},
		});
		expect(result.error).toEqual([]);
		const completed = unwrap(result.success[0], 'quiz_submissions');
		expect(completed).toMatchObject({ id: Number(submissionId), workflow_state: 'pending_review', score: 3 });

		const actual = await readSubmission(submissionId);
		expect(actual).toMatchObject({
			workflow_state: 'pending_review',
			attempt: 1,
			score: 3,
			kept_score: 3,
			quiz_points_possible: 8,
		});
		expect(actual.finished_at).not.toBeNull();
	});

	it('complete: an attempt that is already turned in cannot be completed again', async () => {
		const result = await runNode({
			resource: 'quizSubmission',
			operation: 'complete',
			persona: 'student',
			params: {
				courseId,
				quizId,
				submissionId,
				attempt: 1,
				validationToken: attempt.validation_token,
				options: { access_code: ACCESS_CODE },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'complete' });
	});

	it('get: returns the quiz submission itself; the attempt option selects an earlier attempt', async () => {
		const [latest] = await runOk({
			resource: 'quizSubmission',
			operation: 'get',
			persona: 'teacher',
			params: { courseId, quizId, submissionId },
		});
		expect(latest).toMatchObject({
			id: Number(submissionId),
			user_id: Number(fx('studentUserId')),
			attempt: 1,
			score: 3,
		});
		expect(latest).not.toHaveProperty('quiz_submissions');

		const [first] = await runOk({
			resource: 'quizSubmission',
			operation: 'get',
			params: { courseId, quizId: Number(quizId), submissionId: Number(submissionId), options: { attempt: 1 } },
		});
		expect(first).toMatchObject({ id: Number(submissionId), attempt: 1 });

		const missing = await runNode({
			resource: 'quizSubmission',
			operation: 'get',
			params: {
				courseId,
				quizId,
				submissionId,
				options: { attempt: 5 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });
	});

	it('get: with includes, hands on the compound document with the associated records', async () => {
		const [doc] = await runOk({
			resource: 'quizSubmission',
			operation: 'get',
			params: { courseId, quizId, submissionId, options: { include: ['quiz', 'submission', 'user'] } },
		});
		expect((doc.quiz_submissions as Json[])[0]).toMatchObject({ id: Number(submissionId) });
		expect((doc.users as Json[]).map((u) => Number(u.id))).toEqual([Number(fx('studentUserId'))]);
		expect((doc.quizzes as Json[]).map((q) => Number(q.id))).toEqual([Number(quizId)]);
		expect((doc.submissions as Json[])[0]).toMatchObject({
			user_id: Number(fx('studentUserId')),
			assignment_id: Number(assignmentId),
		});

		const [onlyUser] = await runOk({
			resource: 'quizSubmission',
			operation: 'get',
			params: { courseId, quizId, submissionId, options: { include: ['user'] } },
		});
		expect(onlyUser).toHaveProperty('users');
		expect(onlyUser).not.toHaveProperty('quizzes');
		expect(onlyUser).not.toHaveProperty('submissions');
	});

	it('updateScore: fudge points, per-question scores and comments reach Canvas', async () => {
		const comment = 'Good — but mention "chlorophyll" & light. 🌱';
		const [item] = await runOk({
			resource: 'quizSubmission',
			operation: 'updateScore',
			persona: 'teacher',
			params: {
				courseId,
				quizId,
				submissionId,
				attempt: 1,
				updateFields: {
					fudge_points: -0.5,
					questions: JSON.stringify({ [String(essayQuestion.id)]: { score: 4.5, comment } }),
				},
			},
		});
		expect(unwrap(item, 'quiz_submissions')).toMatchObject({ id: Number(submissionId), fudge_points: -0.5, score: 7 });

		expect(await readSubmission(submissionId)).toMatchObject({
			workflow_state: 'complete',
			fudge_points: -0.5,
			score: 7,
			kept_score: 7,
		});
		const graded = await canvas().get<Json>(
			`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${fx('studentUserId')}?include[]=submission_history`,
		);
		expect(graded.score).toBe(7);
		const answers = ((graded.submission_history as Json[])[0].submission_data as Json[]) ?? [];
		expect(answers.find((a) => a.question_id === essayQuestion.id)).toMatchObject({ points: 4.5, more_comments: comment });
	});

	it('updateScore: questions as an object from an expression; fudge points alone; back to zero', async () => {
		const result = await runNode({
			resource: 'quizSubmission',
			operation: 'updateScore',
			items: [
				{
					attempt: 1,
					scores: { [String(essayQuestion.id)]: { score: 0 }, [String(choiceQuestion.id)]: { score: 1.25 } },
				},
			],
			params: {
				courseId,
				quizId,
				submissionId,
				attempt: '={{ $json.attempt }}',
				updateFields: { questions: '={{ $json.scores }}' },
			},
		});
		expect(result.error).toEqual([]);
		// 1.25 + 0, and the -0.5 fudge points from before are kept.
		expect(await readSubmission(submissionId)).toMatchObject({ score: 0.75, fudge_points: -0.5 });

		await runOk({
			resource: 'quizSubmission',
			operation: 'updateScore',
			params: { courseId, quizId, submissionId, attempt: 1, updateFields: { fudge_points: 2 } },
		});
		expect(await readSubmission(submissionId)).toMatchObject({ score: 3.25, fudge_points: 2 });

		await runOk({
			resource: 'quizSubmission',
			operation: 'updateScore',
			params: { courseId, quizId, submissionId, attempt: 1, updateFields: { fudge_points: 0 } },
		});
		expect(await readSubmission(submissionId)).toMatchObject({ score: 1.25, fudge_points: 0 });
	});

	it('updateScore: bad input and missing rights are reported', async () => {
		const cases: Array<[string, Json, Json]> = [
			['student', { attempt: 1, updateFields: { fudge_points: 5 } }, { errorType: 'FORBIDDEN' }],
			['teacher', { attempt: 2, updateFields: { fudge_points: 5 } }, { errorCode: 400, errorType: 'VALIDATION_ERROR' }],
			['teacher', { attempt: 1, updateFields: { questions: '{"1": ' } }, { errorCode: 0 }],
			['teacher', { attempt: 1, updateFields: { questions: '[1, 2]' } }, { errorCode: 0 }],
		];
		for (const [persona, params, expected] of cases) {
			const result = await runNode({
				resource: 'quizSubmission',
				operation: 'updateScore',
				persona,
				params: { courseId, quizId, submissionId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, JSON.stringify(params)).toEqual([]);
			expect(result.error[0], JSON.stringify(params)).toMatchObject({ ...expected, operation: 'updateScore' });
		}
		expect(await readSubmission(submissionId)).toMatchObject({ score: 1.25, fudge_points: 0 });
	});

	it('start + complete: a second attempt; "get" then returns either attempt', async () => {
		const [item] = await runOk({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student',
			params: { courseId, quizId, options: { access_code: ACCESS_CODE, preview: false } },
		});
		const second = unwrap(item, 'quiz_submissions');
		expect(second).toMatchObject({ id: Number(submissionId), attempt: 2, workflow_state: 'untaken', attempts_left: 0 });
		const [done] = await runOk({
			resource: 'quizSubmission',
			operation: 'complete',
			persona: 'student',
			params: {
				courseId,
				quizId,
				submissionId,
				attempt: 2,
				validationToken: second.validation_token,
				options: { access_code: ACCESS_CODE },
			},
		});
		expect(unwrap(done, 'quiz_submissions')).toMatchObject({ attempt: 2, score: 0 });

		const [first] = await runOk({
			resource: 'quizSubmission',
			operation: 'get',
			params: { courseId, quizId, submissionId, options: { attempt: 1 } },
		});
		expect(first).toMatchObject({ attempt: 1, score: 1.25 });
		const [latest] = await runOk({
			resource: 'quizSubmission',
			operation: 'get',
			params: { courseId, quizId, submissionId },
		});
		expect(latest).toMatchObject({ attempt: 2, score: 0 });

		// No attempts left.
		const third = await runNode({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student',
			params: {
				courseId,
				quizId,
				options: { access_code: ACCESS_CODE },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(third.success).toEqual([]);
		expect(third.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT' });
	});

	it('start: a teacher can open a preview attempt that does not count; a student cannot', async () => {
		const [item] = await runOk({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'teacher',
			params: { courseId, quizId, options: { access_code: ACCESS_CODE, preview: true } },
		});
		const preview = unwrap(item, 'quiz_submissions');
		expect(preview).toMatchObject({ quiz_id: Number(quizId), workflow_state: 'preview' });
		const all = await canvas().getAll<Json>(`${base()}/submissions`, 'quiz_submissions');
		expect(all.map((s) => s.user_id)).toEqual([Number(fx('studentUserId'))]);

		const refused = await runNode({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student2',
			params: {
				courseId,
				quizId,
				options: { access_code: ACCESS_CODE, preview: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'start' });
	});

	it('getAll: graders get the attempts of every student, students only their own', async () => {
		const started = await startAttempt(courseId, quizId, 'student2', ACCESS_CODE);
		await completeAttempt(courseId, quizId, 'student2', started, ACCESS_CODE);
		const expected = await canvas().getAll<Json>(`${base()}/submissions`, 'quiz_submissions');
		expect(expected.map((s) => s.user_id).sort()).toEqual(
			[Number(fx('studentUserId')), Number(fx('student2UserId'))].sort(),
		);

		const asTeacher = await runOk({
			resource: 'quizSubmission',
			operation: 'getAll',
			persona: 'teacher',
			params: { courseId, quizId },
		});
		expect(asTeacher.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
		expect(asTeacher[0]).toHaveProperty('workflow_state');
		expect(asTeacher[0]).not.toHaveProperty('quiz_submissions');

		// A student gets one entry per attempt they turned in.
		const asStudent = await runOk({
			resource: 'quizSubmission',
			operation: 'getAll',
			persona: 'student',
			params: { courseId, quizId },
		});
		expect(asStudent.map((s) => [s.user_id, s.attempt]).sort()).toEqual([
			[Number(fx('studentUserId')), 1],
			[Number(fx('studentUserId')), 2],
		]);

		const empty = await createQuiz(courseId, { title: unique('Nobody took this') }, [MULTIPLE_CHOICE]);
		const none = await runNode({
			resource: 'quizSubmission',
			operation: 'getAll',
			params: { courseId, quizId: empty.id },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		await deleteQuiz(courseId, empty.id);
	});

	it('getAll: pages through more quiz submissions than one page holds', async () => {
		const path = `/api/v1/courses/${marathon.courseId}/quizzes/${marathon.quizId}/submissions`;
		const expected = await canvas().getAll<Json>(path, 'quiz_submissions');
		expect(expected.length).toBeGreaterThanOrEqual(23);
		const params = { courseId: marathon.courseId, quizId: marathon.quizId };

		const defaults = await runOk({ resource: 'quizSubmission', operation: 'getAll', params });
		expect(defaults.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
		expect(new Set(defaults.map((s) => s.id)).size).toBe(defaults.length);

		const all = await runOk({
			resource: 'quizSubmission',
			operation: 'getAll',
			params: { ...params, pagination: { returnAll: true } },
		});
		expect(all.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());

		const pages = await runOk({
			resource: 'quizSubmission',
			operation: 'getAll',
			params: { ...params, pagination: { perPage: 4, maxPages: 3 } },
		});
		expect(pages).toHaveLength(12);
		expect(new Set(pages.map((s) => s.id)).size).toBe(12);
		for (const submission of pages) expect(submission.quiz_id).toBe(Number(marathon.quizId));
	});

	it('getAllOutstanding + gradeOutstanding: an attempt left open past the lock date gets turned in', async () => {
		// The quiz locks shortly after the student starts; the student never submits.
		// (The lock date is set once the quiz is ready, so a slow instance does not eat the margin.)
		const quiz = await createQuiz(courseId, { title: unique('Locks soon') }, [MULTIPLE_CHOICE]);
		const lockAt = new Date(Date.now() + 45_000).toISOString();
		await canvas().put(`/api/v1/courses/${courseId}/quizzes/${quiz.id}`, { quiz: { lock_at: lockAt } });
		const params = { courseId, quizId: quiz.id };
		const path = `/api/v1/courses/${courseId}/quizzes/${quiz.id}/outstanding_quiz_submissions`;

		const open = await startAttempt(courseId, quiz.id, 'student2');
		await answerQuestions('student2', open, {
			[String(quiz.questions[0].id)]: (quiz.questions[0].answers as Json[]).find((a) => a.weight === 100)?.id,
		});
		const before = await runNode({ resource: 'quizSubmission', operation: 'getAllOutstanding', params });
		expect(before.ok).toBe(true);
		expect(before.success).toEqual([]);

		await new Promise((r) => setTimeout(r, Math.max(0, new Date(lockAt).getTime() - Date.now()) + 2000));

		const outstanding = await runOk({
			resource: 'quizSubmission',
			operation: 'getAllOutstanding',
			persona: 'teacher',
			params,
		});
		expect(outstanding.map((s) => s.id)).toEqual(
			(await canvas().getAll<Json>(path, 'quiz_submissions')).map((s) => s.id),
		);
		expect(outstanding).toHaveLength(1);
		expect(outstanding[0]).toMatchObject({
			id: open.id,
			user_id: Number(fx('student2UserId')),
			workflow_state: 'untaken',
		});

		// IDs that are not outstanding (or do not exist) are skipped without an error.
		const [graded] = await runOk({
			resource: 'quizSubmission',
			operation: 'gradeOutstanding',
			persona: 'teacher',
			params: { ...params, quizSubmissionIds: ` ${String(open.id)}, 99999999 ` },
		});
		expect(graded).toEqual({ success: true });

		const after = (
			(await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${quiz.id}/submissions/${String(open.id)}`))
				.quiz_submissions as Json[]
		)[0];
		expect(after).toMatchObject({ workflow_state: 'complete', score: 3 });
		expect(after.finished_at).not.toBeNull();
		expect(await canvas().getAll<Json>(path, 'quiz_submissions')).toEqual([]);

		// The quiz is locked now: nobody can start it any more.
		const late = await runNode({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student',
			params: { ...params, errorHandling: { onError: 'continueWithError' } },
		});
		expect(late.success).toEqual([]);
		expect(late.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'start' });

		for (const operation of ['getAllOutstanding', 'gradeOutstanding']) {
			const forbidden = await runNode({
				resource: 'quizSubmission',
				operation,
				persona: 'student',
				params: { ...params, quizSubmissionIds: String(open.id), errorHandling: { onError: 'continueWithError' } },
			});
			expect(forbidden.success).toEqual([]);
			expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation });
		}
		await deleteQuiz(courseId, quiz.id);
	}, 360_000);

	it('take a whole quiz through the node as a student (start → complete)', async () => {
		const quiz = await createQuiz(courseId, { title: unique('One go') }, [MULTIPLE_CHOICE]);
		const [started] = await runOk({
			resource: 'quizSubmission',
			operation: 'start',
			persona: 'student2',
			params: { courseId, quizId: quiz.id },
		});
		const running = unwrap(started, 'quiz_submissions');
		const [finished] = await runOk({
			resource: 'quizSubmission',
			operation: 'complete',
			persona: 'student2',
			params: {
				courseId,
				quizId: quiz.id,
				submissionId: String(running.id),
				attempt: 1,
				validationToken: running.validation_token,
			},
		});
		expect(unwrap(finished, 'quiz_submissions')).toMatchObject({ workflow_state: 'complete', score: 0, attempt: 1 });
		// For comparison: the same quiz taken directly, picking the right answer.
		expect(await takeQuiz(courseId, quiz.id, 'student')).toMatchObject({ workflow_state: 'complete', score: 3 });
		await deleteQuiz(courseId, quiz.id);
	});

	// ------------------------------------------------------------- uploadFile

	const FILE_UPLOAD = {
		question_name: 'Hand-in',
		question_text: '<p>Upload your worked solution.</p>',
		question_type: 'file_upload_question',
		points_possible: 5,
	};
	const sha = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');
	/** What the student handed in for the quiz, as stored with the submission of its assignment. */
	const handedIn = async (quiz: { quiz: Json }, userId: string): Promise<string> => {
		const submission = await canvas().get<Json>(
			`/api/v1/courses/${courseId}/assignments/${String(quiz.quiz.assignment_id)}/submissions/${userId}?include[]=submission_history`,
		);
		return JSON.stringify(((submission.submission_history as Json[]) ?? []).map((version) => version.submission_data));
	};

	it('uploadFile [needs shared change]: a student uploads files for the running attempt and answers a file upload question with one', async () => {
		const quiz = await createQuiz(courseId, { title: unique('File upload quiz') }, [FILE_UPLOAD]);
		try {
			const running = await startAttempt(courseId, quiz.id, 'student2');
			const size = 80_011;
			const pdf = Buffer.from(`%PDF-1.4 Lösung ${unique('q')}\n`);
			const uploaded = await runNode({
				resource: 'quizSubmission',
				operation: 'uploadFile',
				persona: 'student2',
				binary: [
					// Name and type of the binary data ...
					{ fileName: 'answer ünï.bin', mimeType: 'application/octet-stream', size },
					// ... or the ones given in the options.
					{
						fileName: 'raw.bin',
						mimeType: 'application/octet-stream',
						b64: pdf.toString('base64'),
						json: { name: 'Lösung "final".pdf', type: 'application/pdf' },
					},
				],
				params: { courseId, quizId: quiz.id, options: { content_type: '={{ $json.type }}', name: '={{ $json.name }}' } },
			});
			expect(uploaded.failure, JSON.stringify(uploaded.failure)).toBeUndefined();
			expect(uploaded.error).toEqual([]);
			expect(uploaded.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
			const [first, second] = uploaded.success;
			expect(first).toMatchObject({ display_name: 'answer ünï.bin', size, 'content-type': 'application/octet-stream', upload_status: 'success' });
			expect(second).toMatchObject({ display_name: 'Lösung "final".pdf', size: pdf.length, 'content-type': 'application/pdf' });

			// The files arrived byte for byte (read as the student who owns them).
			const student2 = new CanvasClient('student2');
			const download = async (file: Json): Promise<Buffer> => {
				const res = await student2.request('GET', `/api/v1/files/${String(file.id)}/public_url`);
				expect(res.status, JSON.stringify(res.data)).toBe(200);
				return Buffer.from(await (await fetch(String((res.data as Json).public_url))).arrayBuffer());
			};
			expect(sha(await download(first))).toBe(sha(patternBuffer(size)));
			expect((await download(second)).equals(pdf)).toBe(true);

			// The ID of an uploaded file is the answer to the question.
			await answerQuestions('student2', running, { [String(quiz.questions[0].id)]: String(second.id) });
			const done = await completeAttempt(courseId, quiz.id, 'student2', running);
			expect(['complete', 'pending_review']).toContain(done.workflow_state);
			expect(await handedIn(quiz, fx('student2UserId'))).toContain(String(second.id));
		} finally {
			await deleteQuiz(courseId, quiz.id);
		}
	});

	it('uploadFile [needs shared change]: from a URL, for the running attempt', async () => {
		const server = await startFileServer();
		const quiz = await createQuiz(courseId, { title: unique('File upload quiz by URL') }, [FILE_UPLOAD]);
		try {
			expect(server.url, 'this machine has no address Canvas is willing to fetch from').not.toBe('');
			const content = Buffer.concat([Buffer.from(unique('quiz url')), patternBuffer(50_000)]);
			server.serve('/worked solution.bin', content, 'application/octet-stream');
			server.serve('/later.txt', 'fetched in the background\n');
			await startAttempt(courseId, quiz.id, 'student2');
			const params = { courseId, quizId: quiz.id, uploadSource: 'url' };

			const [file] = await runOk({
				resource: 'quizSubmission',
				operation: 'uploadFile',
				persona: 'student2',
				params: {
					...params,
					fileUrl: `${server.url}/${encodeURIComponent('worked solution.bin')}`,
					options: { content_type: 'application/zip', name: 'Lösung ünï.zip' },
				},
			});
			expect(file).toMatchObject({ display_name: 'Lösung ünï.zip', 'content-type': 'application/zip', size: content.length });
			const student2 = new CanvasClient('student2');
			const link = await student2.get<Json>(`/api/v1/files/${String(file.id)}/public_url`);
			expect(sha(Buffer.from(await (await fetch(String(link.public_url))).arrayBuffer()))).toBe(sha(content));

			const [started] = await runOk({
				resource: 'quizSubmission',
				operation: 'uploadFile',
				persona: 'student2',
				params: { ...params, fileUrl: `${server.url}/later.txt`, waitForCompletion: false },
			});
			const progress = started.progress as Json;
			expect(progress).toMatchObject({ tag: 'upload_via_url' });
			let state: Json = {};
			for (let i = 0; i < 60 && state.workflow_state !== 'completed' && state.workflow_state !== 'failed'; i++) {
				await new Promise((r) => setTimeout(r, 1000));
				state = await student2.get<Json>(`/api/v1/progress/${String(progress.id)}`);
			}
			expect(state.workflow_state).toBe('completed');
			expect((await student2.get<Json>(`/api/v1/files/${String((state.results as Json).id)}`)).display_name).toBe('later.txt');
		} finally {
			server.close();
			await deleteQuiz(courseId, quiz.id);
		}
	});

	it('uploadFile: only for an attempt of the user of the credential', async () => {
		const quiz = await createQuiz(courseId, { title: unique('File upload quiz, no attempt') }, [FILE_UPLOAD]);
		try {
			const upload = (persona: string, quiz_: string): ReturnType<typeof runNode> =>
				runNode({
					resource: 'quizSubmission',
					operation: 'uploadFile',
					persona,
					binary: [{ fileName: 'x.txt', mimeType: 'text/plain', b64: 'eA==' }],
					params: { courseId, quizId: quiz_, errorHandling: { onError: 'continueWithError' } },
				});
			// The student has not started this quiz; the administrator never takes it.
			for (const persona of ['student', 'admin']) {
				const result = await upload(persona, quiz.id);
				expect(result.success, persona).toEqual([]);
				expect(result.error[0], persona).toMatchObject({
					errorCode: 404,
					errorType: 'NOT_FOUND',
					resource: 'quizSubmission',
					operation: 'uploadFile',
				});
				expect(String(result.error[0].endpoint)).toBe(`/api/v1/courses/${courseId}/quizzes/${quiz.id}/submissions/self/files`);
			}
			const unknown = await upload('student', '999999999');
			expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

			const noBinary = await runNode({
				resource: 'quizSubmission',
				operation: 'uploadFile',
				persona: 'student',
				items: [{ note: 'no file here' }],
				params: { courseId, quizId: quiz.id, errorHandling: { onError: 'continueWithError' } },
			});
			expect(noBinary.success).toEqual([]);
			expect(noBinary.error[0]).toMatchObject({ errorCode: 0, operation: 'uploadFile' });
		} finally {
			await deleteQuiz(courseId, quiz.id);
		}
	});

	it('errors: an unknown quiz submission, and a student reading someone else\'s', async () => {
		const result = await runNode({
			resource: 'quizSubmission',
			operation: 'get',
			items: [{ id: submissionId }, { id: 99999999 }],
			params: { courseId, quizId, submissionId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((s) => s.id)).toEqual([Number(submissionId)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'quizSubmission',
			operation: 'get',
		});

		const other = await runNode({
			resource: 'quizSubmission',
			operation: 'get',
			persona: 'student2',
			params: { courseId, quizId, submissionId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(other.success).toEqual([]);
		expect(other.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'get' });
		await deleteQuiz(courseId, quizId);
	});
});
