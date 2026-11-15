import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, createUserWithToken, fx, unique } from '../lib/canvas';
import type { TestUser } from '../lib/canvas';
import { createCredential, runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resources: quizSubmissionEvent, quizAssignmentOverride, quizIpFilter, quizSubmissionQuestion.
 * A course with a classic quiz is created; one test student takes it through the node.
 */
let accountId = '';
let courseId = '';
let quizId = '';
let secondQuizId = '';
let sectionId = '';
const questionIds: string[] = [];
let taker: TestUser;
let takerCredential: { id: string; name: string; type: string };
const otherStudents: string[] = [];

beforeAll(async () => {
	const c = canvas();
	// A sub-account of our own so IP filters can be defined without touching the root account.
	const account = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, { account: { name: unique('Quiz extras') } });
	accountId = String(account.id);
	// Account IP filters can only be defined in Canvas' web UI, not through the REST API.
	execFileSync(
		'docker',
		[
			'exec',
			'canvas-web',
			'bundle',
			'exec',
			'rails',
			'runner',
			`a = Account.find(${Number(accountId)}); a.ip_filters = { "Testing Center" => "192.168.217.1/24", "Library — \\"west\\" wing" => "10.0.0.0/8" }; a.save!`,
		],
		{ encoding: 'utf8' },
	);

	const course = await c.post<Json>(`/api/v1/accounts/${accountId}/courses`, { course: { name: unique('Quiz extras course') }, offer: true });
	courseId = String(course.id);
	await c.put(`/api/v1/courses/${courseId}/features/flags/quiz_log_auditing`, { state: 'on' });
	sectionId = String((await c.post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name: 'Evening section' } })).id);

	taker = await createUserWithToken('Quiz Taker');
	takerCredential = await createCredential(taker.token, 'quiz taker');
	await c.post(`/api/v1/courses/${courseId}/enrollments`, { enrollment: { user_id: taker.id, type: 'StudentEnrollment', enrollment_state: 'active' } });
	for (let i = 0; i < 13; i++) {
		const user = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name: unique(`Quiz bystander ${i}`) },
			pseudonym: { unique_id: `${unique('quizx').replace(/\s/g, '.')}@example.edu` },
		});
		otherStudents.push(String(user.id));
		await c.post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active', ...(i < 4 ? { course_section_id: sectionId } : {}) },
		});
	}

	const quiz = await c.post<Json>(`/api/v1/courses/${courseId}/quizzes`, {
		quiz: { title: unique('Extras quiz'), quiz_type: 'assignment', allowed_attempts: 1, time_limit: 30, due_at: '2031-03-01T23:59:00Z' },
	});
	quizId = String(quiz.id);
	const questions = [
		{ question_name: 'Essay', question_type: 'essay_question', question_text: 'Say hello', points_possible: 5 },
		{ question_name: 'Number', question_type: 'numerical_question', question_text: '6 x 7', points_possible: 5, answers: [{ numerical_answer_type: 'exact_answer', answer_exact: 42, answer_weight: 100 }] },
		{
			question_name: 'Choice',
			question_type: 'multiple_choice_question',
			question_text: 'Pick B',
			points_possible: 5,
			answers: [
				{ answer_text: 'A', answer_weight: 0 },
				{ answer_text: 'B', answer_weight: 100 },
			],
		},
	];
	for (const question of questions) {
		questionIds.push(String((await c.post<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions`, { question })).id));
	}
	await c.put(`/api/v1/courses/${courseId}/quizzes/${quizId}`, { quiz: { published: true } });

	const second = await c.post<Json>(`/api/v1/courses/${courseId}/quizzes`, {
		quiz: { title: unique('Second quiz'), quiz_type: 'assignment', published: true, due_at: '2031-04-01T23:59:00Z' },
	});
	secondQuizId = String(second.id);
	await c.post(`/api/v1/courses/${courseId}/quizzes/${secondQuizId}/assignment_overrides`.replace(`/quizzes/${secondQuizId}/assignment_overrides`, `/assignments/${String(second.assignment_id)}/overrides`), {
		assignment_override: { course_section_id: Number(sectionId), due_at: '2031-04-20T23:59:00Z' },
	});
});

describe('quizIpFilter', () => {
	it('getAll: lists the filters defined on the account, one item each', async () => {
		const filters = await runOk({ resource: 'quizIpFilter', operation: 'getAll', params: { courseId, quizId } });
		const expected = (await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/ip_filters`)).quiz_ip_filters as Json[];
		expect(filters).toEqual(expected);
		expect(filters.map((f) => f.name).sort()).toEqual(['Library — "west" wing', 'Testing Center']);
		expect(filters.find((f) => f.name === 'Testing Center')).toMatchObject({ filter: '192.168.217.1/24' });
	});

	it('errors: students may not read them', async () => {
		const result = await runNode({
			resource: 'quizIpFilter',
			operation: 'getAll',
			credential: takerCredential,
			params: { courseId, quizId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403]).toContain(result.error[0].errorCode);
	});
});

describe('quizAssignmentOverride', () => {
	it('getAll: returns the dates of every classic quiz, one item per quiz', async () => {
		// Canvas caches these date lists, the title of the base entry ("Everyone") in the language of
		// whoever asked first: a student with a Spanish locale leaves "Todos" behind for everybody.
		// That label is Canvas' business; everything else has to be equal.
		const withoutLabel = (sets: Json[]): Json[] =>
			sets.map((set) => ({
				...set,
				...Object.fromEntries(
					['all_dates', 'due_dates'].map((key) => [
						key,
						((set[key] as Json[] | undefined) ?? []).map((date) => (date.base ? { ...date, title: '(everyone)' } : date)),
					]),
				),
			}));
		const expected = (await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/assignment_overrides?per_page=100`)).quiz_assignment_overrides as Json[];
		const sets = await runOk({ resource: 'quizAssignmentOverride', operation: 'getAll', params: { courseId, pagination: { returnAll: true } } });
		expect(sets.map((s) => String(s.quiz_id)).sort()).toEqual([quizId, secondQuizId].sort());
		expect(withoutLabel(sets)).toEqual(withoutLabel(expected));
		const second = sets.find((s) => String(s.quiz_id) === secondQuizId)!;
		const dues = (second.all_dates as Json[]).map((d) => d.due_at).sort();
		expect(dues).toEqual(['2031-04-01T23:59:00Z', '2031-04-20T23:59:00Z']);
	});

	it('getAll: narrows to the quizzes asked for', async () => {
		const one = await runOk({ resource: 'quizAssignmentOverride', operation: 'getAll', params: { courseId, options: { quiz_ids: ` ${secondQuizId} ` } } });
		expect(one.map((s) => String(s.quiz_id))).toEqual([secondQuizId]);
		const both = await runOk({ resource: 'quizAssignmentOverride', operation: 'getAll', params: { courseId, options: { quiz_ids: `${quizId}, ${secondQuizId}` } } });
		expect(both).toHaveLength(2);
	});

	it('getAllNewQuizzes: a course without New Quizzes returns no items', async () => {
		const sets = await runOk({ resource: 'quizAssignmentOverride', operation: 'getAllNewQuizzes', params: { courseId } });
		expect(sets).toEqual([]);
	});

	it('as a student: the dates are the ones that apply to that student', async () => {
		const sets = await runOk({ resource: 'quizAssignmentOverride', operation: 'getAll', credential: takerCredential, params: { courseId } });
		const second = sets.find((s) => String(s.quiz_id) === secondQuizId)!;
		// The taker is not in the evening section, so only the default date applies.
		expect((second.due_dates as Json[]).map((d) => d.due_at)).toEqual(['2031-04-01T23:59:00Z']);
	});
});

describe('quizSubmissionQuestion with an access code', () => {
	const code = 'Röom 42 & "B"';
	let protectedQuizId = '';
	let questionId = '';
	let quizSubmissionId = '';
	let validationToken = '';
	let attempt = 0;
	const eh = { errorHandling: { onError: 'continueWithError' } };
	const stored = async (): Promise<Json> =>
		((await taker.client.get<Json>(`/api/v1/quiz_submissions/${quizSubmissionId}/questions`)).quiz_submission_questions as Json[]).find(
			(q) => String(q.id) === questionId,
		) as Json;

	beforeAll(async () => {
		const quiz = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes`, {
			quiz: { title: unique('Protected quiz'), quiz_type: 'assignment', allowed_attempts: 1, access_code: code },
		});
		protectedQuizId = String(quiz.id);
		const question = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes/${protectedQuizId}/questions`, {
			question: { question_name: 'Essay', question_type: 'essay_question', question_text: 'Why?', points_possible: 1 },
		});
		questionId = String(question.id);
		await canvas().put(`/api/v1/courses/${courseId}/quizzes/${protectedQuizId}`, { quiz: { published: true } });
		const started = await taker.client.post<Json>(`/api/v1/courses/${courseId}/quizzes/${protectedQuizId}/submissions`, { access_code: code });
		const submission = (started.quiz_submissions as Json[])[0];
		quizSubmissionId = String(submission.id);
		validationToken = String(submission.validation_token);
		attempt = Number(submission.attempt);
	});

	it('answer, flag, unflag: need the access code of the quiz', async () => {
		const common = { quizSubmissionId, attempt, validationToken };
		const answers = JSON.stringify([{ question_id: Number(questionId), answer: 'Because.' }]);

		for (const [operation, params] of [
			['answer', { ...common, answers }],
			['flag', { ...common, questionId }],
			['unflag', { ...common, questionId }],
		] as const) {
			const without = await runNode({ resource: 'quizSubmissionQuestion', operation, credential: takerCredential, params: { ...params, ...eh } });
			expect(without.success, `${operation} without the code`).toEqual([]);
			expect(without.error[0].errorCode, operation).toBe(403);
			const wrong = await runNode({
				resource: 'quizSubmissionQuestion',
				operation,
				credential: takerCredential,
				params: { ...params, additionalFields: { access_code: 'wrong' }, ...eh },
			});
			expect(wrong.error[0]?.errorCode, `${operation} with a wrong code`).toBe(403);
		}
		expect((await stored()).answer ?? null).toBeNull();

		const [answered] = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'answer',
			credential: takerCredential,
			params: { ...common, answers, additionalFields: { access_code: code } },
		});
		expect(String(answered.answer)).toContain('Because.');
		expect(String((await stored()).answer)).toContain('Because.');

		await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'flag',
			credential: takerCredential,
			params: { ...common, questionId, additionalFields: { access_code: code } },
		});
		expect((await stored()).flagged).toBe(true);
		await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'unflag',
			credential: takerCredential,
			params: { ...common, questionId, additionalFields: { access_code: code } },
		});
		expect((await stored()).flagged).toBe(false);
	});
});

describe('quiz attempt: quizSubmissionQuestion, quizSubmissionEvent', () => {
	let quizSubmissionId = '';
	let validationToken = '';
	let attempt = 0;

	it('the student starts an attempt (through Canvas) and reads its questions through the node', async () => {
		const started = await taker.client.post<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`);
		const submission = (started.quiz_submissions as Json[])[0];
		quizSubmissionId = String(submission.id);
		validationToken = String(submission.validation_token);
		attempt = Number(submission.attempt);

		const questions = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'getAll',
			credential: takerCredential,
			params: { quizSubmissionId, options: { include: ['quiz_question'] } },
		});
		expect(questions.map((q) => String(q.id)).sort()).toEqual([...questionIds].sort());
		expect(questions.every((q) => q.flagged === false)).toBe(true);
	});

	it('quizSubmissionQuestion.answer: answers several question types at once', async () => {
		const choice = await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionIds[2]}`);
		const correct = (choice.answers as Json[]).find((a) => a.text === 'B')!;
		const answered = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'answer',
			credential: takerCredential,
			params: {
				quizSubmissionId,
				attempt,
				validationToken,
				answers: JSON.stringify([
					{ question_id: Number(questionIds[0]), answer: 'Hello — with ünïcode & "quotes"' },
					{ id: Number(questionIds[1]), answer: 42 },
					{ question_id: questionIds[2], answer: correct.id },
				]),
			},
		});
		expect(answered).toHaveLength(3);
		expect(String(answered.find((q) => String(q.id) === questionIds[0])!.answer)).toContain('ünïcode');
		expect(Number(answered.find((q) => String(q.id) === questionIds[1])!.answer)).toBe(42);
	});

	it('quizSubmissionQuestion.flag and unflag: mark a question for review', async () => {
		const [flagged] = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'flag',
			credential: takerCredential,
			params: { quizSubmissionId, questionId: questionIds[1], attempt, validationToken },
		});
		expect(flagged).toMatchObject({ flagged: true });
		const [unflagged] = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'unflag',
			credential: takerCredential,
			params: { quizSubmissionId, questionId: questionIds[1], attempt, validationToken },
		});
		expect(unflagged).toMatchObject({ flagged: false });
	});

	it('quizSubmissionQuestion.getFormattedAnswer: a numerical answer the way the quiz page shows it', async () => {
		const numerical = questionIds[1];
		const path = `/api/v1/quiz_submissions/${quizSubmissionId}/questions/${numerical}/formatted_answer`;

		// Rounded to four decimal places, trailing zeros removed; one request per input item.
		const answers = ['12.123456789', '42.0000', '0.5', '-3.14159265', '1234567.891'];
		const formatted = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'getFormattedAnswer',
			credential: takerCredential,
			items: answers.map((answer) => ({ answer })),
			params: { quizSubmissionId, questionId: numerical, answer: '={{ $json.answer }}' },
		});
		expect(formatted).toEqual([
			{ formatted_answer: '12.1235' },
			{ formatted_answer: '42' },
			{ formatted_answer: '0.5' },
			{ formatted_answer: '-3.1416' },
			{ formatted_answer: '1234567.891' },
		]);
		for (const [index, answer] of answers.entries()) {
			expect(formatted[index]).toEqual(await taker.client.get<Json>(`${path}?answer=${encodeURIComponent(answer)}`));
		}

		// A number arriving as a number from an expression.
		const [fromNumber] = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'getFormattedAnswer',
			credential: takerCredential,
			items: [{ submission: Number(quizSubmissionId), question: Number(numerical), answer: 7.123456 }],
			params: { quizSubmissionId: '={{ $json.submission }}', questionId: '={{ $json.question }}', answer: '={{ $json.answer }}' },
		});
		expect(fromNumber).toEqual({ formatted_answer: '7.1235' });

		// Answers to other kinds of questions come back unchanged.
		const text = 'Hello "world" & ünï — 1.50000';
		const [essay] = await runOk({
			resource: 'quizSubmissionQuestion',
			operation: 'getFormattedAnswer',
			credential: takerCredential,
			params: { quizSubmissionId, questionId: questionIds[0], answer: text },
		});
		expect(essay).toEqual({ formatted_answer: text });

		const eh = { errorHandling: { onError: 'continueWithError' } };
		// An answer of blanks is no answer.
		const blank = await runNode({
			resource: 'quizSubmissionQuestion',
			operation: 'getFormattedAnswer',
			credential: takerCredential,
			params: { quizSubmissionId, questionId: numerical, answer: '  ', ...eh },
		});
		expect(blank.success).toEqual([]);
		expect(blank.error[0]).toMatchObject({ errorCode: 422, resource: 'quizSubmissionQuestion', operation: 'getFormattedAnswer' });
		expect(String(blank.error[0].errorMessage)).toContain('answer param is required');

		// A question that is not part of the quiz, and a submission that does not exist.
		const noQuestion = await runNode({
			resource: 'quizSubmissionQuestion',
			operation: 'getFormattedAnswer',
			credential: takerCredential,
			params: { quizSubmissionId, questionId: '99999999', answer: '1', ...eh },
		});
		expect(noQuestion.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		const noSubmission = await runNode({
			resource: 'quizSubmissionQuestion',
			operation: 'getFormattedAnswer',
			credential: takerCredential,
			params: { quizSubmissionId: '99999999', questionId: numerical, answer: '1', ...eh },
		});
		expect(noSubmission.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('quizSubmissionQuestion: a wrong validation token and malformed answers are refused', async () => {
		const eh = { errorHandling: { onError: 'continueWithError' } };
		const wrongToken = await runNode({
			resource: 'quizSubmissionQuestion',
			operation: 'answer',
			credential: takerCredential,
			params: { quizSubmissionId, attempt, validationToken: 'not-the-token', answers: `[{"question_id": ${questionIds[0]}, "answer": "x"}]`, ...eh },
		});
		expect(wrongToken.success).toEqual([]);
		expect([400, 403]).toContain(wrongToken.error[0].errorCode);

		for (const answers of ['{oops', '[]', '[{"answer": "no question"}]']) {
			const bad = await runNode({
				resource: 'quizSubmissionQuestion',
				operation: 'answer',
				credential: takerCredential,
				params: { quizSubmissionId, attempt, validationToken, answers, ...eh },
			});
			expect(bad.error[0], answers).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		}
	});

	it('the student completes the attempt (through Canvas)', async () => {
		await taker.client.post(`/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${quizSubmissionId}/complete`, { attempt, validation_token: validationToken });
	});

	it('quizSubmissionEvent.getAll: the teacher reads what was captured during the attempt', async () => {
		const expected = (await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${quizSubmissionId}/events?per_page=100`)).quiz_submission_events as Json[];
		const events = await runOk({
			resource: 'quizSubmissionEvent',
			operation: 'getAll',
			params: { courseId, quizId, quizSubmissionId, options: { attempt }, pagination: { returnAll: true } },
		});
		expect(events.map((e) => e.id)).toEqual(expected.map((e) => e.id));
		expect(events.length).toBeGreaterThan(0);
		expect(events.map((e) => e.event_type)).toContain('question_answered');
		expect(events.some((e) => 'quiz_submission_events' in e)).toBe(false);
	});

	it('quizSubmissionEvent.getAll: a student may not read the log', async () => {
		const result = await runNode({
			resource: 'quizSubmissionEvent',
			operation: 'getAll',
			credential: takerCredential,
			params: { courseId, quizId, quizSubmissionId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403]).toContain(result.error[0].errorCode);
	});
});
