import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from './support/run';
import type { Json } from '../lib/n8n';
import {
	createQuiz,
	deleteQuiz,
	FIXTURE_TIMEOUT,
	MULTIPLE_CHOICE,
	QUIZ_LIST_SIZE,
	quizCourse,
	quizListCourse,
	takeQuiz,
	waitFor,
} from './support/quizzes';

/**
 * Resource: quiz (classic quizzes). Every operation runs through a real n8n
 * instance against Canvas; writes are verified by reading the quiz back from
 * Canvas directly.
 */
describe('quiz', () => {
	let courseId = '';
	let listCourseId = '';
	let assignmentGroupId = '';
	let quizId = '';
	let surveyId = '';
	const title = unique('Battery quiz Ünïcødé 测验 "quoted" & <b>tags</b> 🧪');

	const readQuiz = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${id}`);

	beforeAll(async () => {
		[courseId, listCourseId] = await Promise.all([quizCourse(), quizListCourse()]);
		const group = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignment_groups`, {
			name: unique('Quiz group'),
		});
		assignmentGroupId = String(group.id);
	}, FIXTURE_TIMEOUT);

	afterAll(async () => {
		if (assignmentGroupId) {
			await canvas().request('DELETE', `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`);
		}
	});

	it('create: every optional field of a graded quiz reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'quiz',
			operation: 'create',
			params: {
				courseId,
				title,
				additionalFields: {
					access_code: 'open sesame & "more"',
					allowed_attempts: 3,
					assignment_group_id: assignmentGroupId,
					cant_go_back: true,
					description: '<p>Read <strong>chapter 3</strong> first — ¿listo? 日本語</p>',
					due_at: '2031-01-15T12:00:00Z',
					hide_results: 'until_after_last_attempt',
					ip_filter: '192.168.0.0/16,10.1.2.3',
					lock_at: '2031-02-15T12:00:00Z',
					lockdown_browser_monitor_data: 'monitor-settings',
					one_question_at_a_time: true,
					only_visible_to_overrides: false,
					published: true,
					quiz_type: 'assignment',
					require_lockdown_browser: true,
					require_lockdown_browser_monitor: true,
					scoring_policy: 'keep_average',
					shuffle_answers: true,
					time_limit: 45,
					unlock_at: '2031-01-01T12:00:00Z',
				},
			},
		});
		quizId = String(created.id);
		expect(created.title).toBe(title);

		const actual = await readQuiz(quizId);
		expect(actual).toMatchObject({
			title,
			access_code: 'open sesame & "more"',
			has_access_code: true,
			allowed_attempts: 3,
			assignment_group_id: Number(assignmentGroupId),
			cant_go_back: true,
			due_at: '2031-01-15T12:00:00Z',
			hide_results: 'until_after_last_attempt',
			ip_filter: '192.168.0.0/16,10.1.2.3',
			lock_at: '2031-02-15T12:00:00Z',
			lockdown_browser_monitor_data: 'monitor-settings',
			one_question_at_a_time: true,
			only_visible_to_overrides: false,
			published: true,
			quiz_type: 'assignment',
			scoring_policy: 'keep_average',
			shuffle_answers: true,
			time_limit: 45,
			unlock_at: '2031-01-01T12:00:00Z',
			// The Respondus LockDown Browser plugin is not installed here: Canvas stores the
			// request but keeps reporting the requirement as off.
			require_lockdown_browser: false,
			require_lockdown_browser_monitor: false,
		});
		expect(String(actual.description)).toContain('<strong>chapter 3</strong>');
		expect(String(actual.description)).toContain('¿listo? 日本語');
		expect(actual.assignment_id, 'a graded quiz gets a gradebook assignment').toBeTypeOf('number');
	});

	it('create: answer-visibility options and survey-only options reach Canvas', async () => {
		const [created] = await runOk({
			resource: 'quiz',
			operation: 'create',
			params: {
				courseId,
				title: unique('Battery survey'),
				additionalFields: {
					allowed_attempts: 2,
					anonymous_submissions: true,
					hide_correct_answers_at: '2031-03-15T12:00:00Z',
					hide_results: '',
					one_time_results: true,
					points_possible: 7,
					quiz_type: 'graded_survey',
					scoring_policy: 'keep_latest',
					show_correct_answers: true,
					show_correct_answers_at: '2031-02-20T12:00:00Z',
					show_correct_answers_last_attempt: true,
				},
			},
		});
		surveyId = String(created.id);
		expect(await readQuiz(surveyId)).toMatchObject({
			allowed_attempts: 2,
			anonymous_submissions: true,
			hide_correct_answers_at: '2031-03-15T12:00:00Z',
			hide_results: null,
			one_time_results: true,
			points_possible: 7,
			quiz_type: 'graded_survey',
			scoring_policy: 'keep_latest',
			show_correct_answers: true,
			show_correct_answers_at: '2031-02-20T12:00:00Z',
			show_correct_answers_last_attempt: true,
			published: false,
		});
	});

	it('create: a time limit of 0 means "no time limit" (Canvas itself rejects 0)', async () => {
		const [created] = await runOk({
			resource: 'quiz',
			operation: 'create',
			params: {
				courseId,
				title: unique('No limit'),
				additionalFields: { time_limit: 0, quiz_type: 'practice_quiz', allowed_attempts: -1, scoring_policy: 'keep_latest' },
			},
		});
		const id = String(created.id);
		expect(await readQuiz(id)).toMatchObject({
			time_limit: null,
			quiz_type: 'practice_quiz',
			assignment_id: null,
			allowed_attempts: -1,
			// Canvas quirk: a scoring policy is only accepted with 2 or more attempts, and "unlimited" is -1.
			scoring_policy: 'keep_highest',
		});
		await deleteQuiz(courseId, id);
	});

	it('create: Canvas silently drops options that need more than one attempt', async () => {
		// Real-world trap: with a single attempt Canvas ignores these three settings without an error.
		const [created] = await runOk({
			resource: 'quiz',
			operation: 'create',
			params: {
				courseId,
				title: unique('Single attempt'),
				additionalFields: {
					allowed_attempts: 1,
					hide_results: 'until_after_last_attempt',
					scoring_policy: 'keep_latest',
					show_correct_answers_last_attempt: true,
				},
			},
		});
		const id = String(created.id);
		expect(await readQuiz(id)).toMatchObject({
			allowed_attempts: 1,
			hide_results: null,
			scoring_policy: 'keep_highest',
			show_correct_answers_last_attempt: false,
		});
		await deleteQuiz(courseId, id);
	});

	it('get: returns the quiz; numeric IDs from expressions and SIS course IDs work', async () => {
		const result = await runNode({
			resource: 'quiz',
			operation: 'get',
			items: [{ course: Number(courseId), quiz: Number(quizId) }],
			params: { courseId: '={{ $json.course }}', quizId: '={{ $json.quiz }}' },
		});
		expect(result.success).toHaveLength(1);
		expect(result.success[0]).toMatchObject({ id: Number(quizId), title, allowed_attempts: 3 });

		const [bySis] = await runOk({
			resource: 'quiz',
			operation: 'get',
			params: { courseId: 'sis_course_id:BATTERY-QUIZZES', quizId: ` ${quizId} ` },
		});
		expect(bySis.id).toBe(Number(quizId));
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'quiz',
			operation: 'update',
			params: {
				courseId,
				quizId,
				updateFields: {
					access_code: 'changed',
					allowed_attempts: 5,
					cant_go_back: false,
					description: '<p>Second version</p>',
					due_at: '2032-01-15T12:00:00Z',
					hide_results: 'always',
					ip_filter: '10.0.0.0/8',
					lock_at: '2032-02-15T12:00:00Z',
					lockdown_browser_monitor_data: 'changed',
					notify_of_update: false,
					one_question_at_a_time: false,
					published: false,
					quiz_type: 'practice_quiz',
					scoring_policy: 'keep_highest',
					shuffle_answers: false,
					time_limit: 90,
					title: renamed,
					unlock_at: '2032-01-01T12:00:00Z',
				},
			},
		});
		expect(updated.title).toBe(renamed);
		expect(await readQuiz(quizId)).toMatchObject({
			title: renamed,
			access_code: 'changed',
			allowed_attempts: 5,
			// Canvas would throw the "one question at a time: off" change away if cant_go_back went
			// along in the same request, so the node leaves cant_go_back out; both end up off.
			cant_go_back: false,
			due_at: '2032-01-15T12:00:00Z',
			hide_results: 'always',
			ip_filter: '10.0.0.0/8',
			lock_at: '2032-02-15T12:00:00Z',
			lockdown_browser_monitor_data: 'changed',
			one_question_at_a_time: false,
			published: false,
			quiz_type: 'practice_quiz',
			scoring_policy: 'keep_highest',
			shuffle_answers: false,
			time_limit: 90,
			unlock_at: '2032-01-01T12:00:00Z',
			description: '<p>Second version</p>',
		});
	});

	it('update: the remaining fields, clearing values, and "0 = no time limit"', async () => {
		await runOk({
			resource: 'quiz',
			operation: 'update',
			params: {
				courseId,
				quizId,
				updateFields: {
					access_code: '',
					allowed_attempts: 2,
					anonymous_submissions: true,
					assignment_group_id: assignmentGroupId,
					due_at: '',
					hide_correct_answers_at: '2032-06-01T00:00:00Z',
					hide_results: '',
					ip_filter: '',
					lock_at: '',
					one_time_results: true,
					only_visible_to_overrides: true,
					points_possible: 12,
					quiz_type: 'graded_survey',
					require_lockdown_browser: false,
					require_lockdown_browser_monitor: false,
					show_correct_answers: true,
					show_correct_answers_at: '2032-05-01T00:00:00Z',
					show_correct_answers_last_attempt: true,
					time_limit: 0,
					unlock_at: '',
				},
			},
		});
		const actual = await readQuiz(quizId);
		expect(actual).toMatchObject({
			has_access_code: false,
			allowed_attempts: 2,
			anonymous_submissions: true,
			assignment_group_id: Number(assignmentGroupId),
			due_at: null,
			hide_correct_answers_at: '2032-06-01T00:00:00Z',
			hide_results: null,
			ip_filter: null,
			lock_at: null,
			one_time_results: true,
			only_visible_to_overrides: true,
			points_possible: 12,
			quiz_type: 'graded_survey',
			show_correct_answers: true,
			show_correct_answers_at: '2032-05-01T00:00:00Z',
			show_correct_answers_last_attempt: true,
			time_limit: null,
			unlock_at: null,
		});
	});

	it('update: an invalid setting is reported with Canvas\' validation message', async () => {
		const result = await runNode({
			resource: 'quiz',
			operation: 'update',
			params: {
				courseId,
				quizId,
				updateFields: { show_correct_answers_at: '2033-01-01T00:00:00Z', hide_correct_answers_at: '2032-01-01T00:00:00Z' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'quiz', operation: 'update' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('bad_range');
		expect(String(result.error[0].errorMessage)).toContain('bad_range');
	});

	it('getAll: pages through a course with more quizzes than one page holds', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${listCourseId}/quizzes`);
		expect(expected.length).toBeGreaterThanOrEqual(QUIZ_LIST_SIZE);

		const defaults = await runOk({ resource: 'quiz', operation: 'getAll', params: { courseId: listCourseId } });
		expect(defaults).toHaveLength(50);
		expect(new Set(defaults.map((q) => q.id)).size).toBe(50);

		const all = await runOk({
			resource: 'quiz',
			operation: 'getAll',
			params: { courseId: listCourseId, pagination: { returnAll: true } },
		});
		expect(all.map((q) => q.id).sort()).toEqual(expected.map((q) => q.id).sort());
		expect(new Set(all.map((q) => q.id)).size).toBe(all.length);

		const threePages = await runOk({
			resource: 'quiz',
			operation: 'getAll',
			params: { courseId: listCourseId, pagination: { perPage: 7, maxPages: 3 } },
		});
		expect(threePages).toHaveLength(21);
		expect(new Set(threePages.map((q) => q.id)).size).toBe(21);
	});

	it('getAll: search term filters by title; students only get published quizzes; empty course gives no items', async () => {
		const expected = await canvas().getAll<Json>(
			`/api/v1/courses/${listCourseId}/quizzes?search_term=${encodeURIComponent('Zellbiologie')}`,
		);
		expect(expected.length).toBeGreaterThan(10);
		const found = await runOk({
			resource: 'quiz',
			operation: 'getAll',
			params: { courseId: listCourseId, options: { search_term: 'Zellbiologie' }, pagination: { returnAll: true } },
		});
		expect(found.map((q) => q.id).sort()).toEqual(expected.map((q) => q.id).sort());
		for (const quiz of found) expect(String(quiz.title)).toContain('Zellbiologie');

		const asStudent = await new CanvasClient('student').getAll<Json>(`/api/v1/courses/${listCourseId}/quizzes`);
		const all = await canvas().getAll<Json>(`/api/v1/courses/${listCourseId}/quizzes`);
		expect(asStudent.length).toBeLessThan(all.length);
		const seen = await runOk({
			resource: 'quiz',
			operation: 'getAll',
			persona: 'student',
			params: { courseId: listCourseId, pagination: { returnAll: true } },
		});
		expect(seen.map((q) => q.id).sort()).toEqual(asStudent.map((q) => q.id).sort());
		for (const quiz of seen) expect(quiz.published).toBe(true);

		const none = await runNode({
			resource: 'quiz',
			operation: 'getAll',
			params: { courseId: listCourseId, options: { search_term: 'no quiz has this title zzzz' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('getAllWithNewQuizzes: the combined list of classic and New Quizzes, across pages', async () => {
		const path = `/api/v1/courses/${listCourseId}/all_quizzes`;
		const expected = await canvas().getAll<Json>(path);
		// This Canvas has no New Quizzes service, so the combined list holds the classic quizzes.
		const classic = await canvas().getAll<Json>(`/api/v1/courses/${listCourseId}/quizzes`);
		expect(expected.map((q) => q.id).sort()).toEqual(classic.map((q) => q.id).sort());
		expect(expected.length).toBeGreaterThanOrEqual(QUIZ_LIST_SIZE);

		const all = await runOk({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			params: { courseId: listCourseId, pagination: { returnAll: true } },
		});
		expect(all.map((q) => q.id)).toEqual(expected.map((q) => q.id));
		expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
		expect(all.every((q) => q.quiz_type !== 'quizzes.next')).toBe(true);
		expect(all[0]).toHaveProperty('title');
		expect(all[0]).toHaveProperty('question_count');

		const defaults = await runOk({ resource: 'quiz', operation: 'getAllWithNewQuizzes', params: { courseId: listCourseId } });
		expect(defaults.map((q) => q.id)).toEqual(expected.slice(0, 50).map((q) => q.id));
		const threePages = await runOk({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			items: [{ course: Number(listCourseId) }],
			params: { courseId: '={{ $json.course }}', pagination: { perPage: 7, maxPages: 3 } },
		});
		expect(threePages.map((q) => q.id)).toEqual(expected.slice(0, 21).map((q) => q.id));

		const expectedFound = await canvas().getAll<Json>(`${path}?search_term=${encodeURIComponent('Zellbiologie')}`);
		expect(expectedFound.length).toBeGreaterThan(10);
		const found = await runOk({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			params: { courseId: listCourseId, options: { search_term: 'Zellbiologie' }, pagination: { returnAll: true } },
		});
		expect(found.map((q) => q.id)).toEqual(expectedFound.map((q) => q.id));
		for (const quiz of found) expect(String(quiz.title)).toContain('Zellbiologie');

		// Students only get the published quizzes.
		const asStudent = await new CanvasClient('student').getAll<Json>(path);
		expect(asStudent.length).toBeLessThan(expected.length);
		const seen = await runOk({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			persona: 'student',
			params: { courseId: listCourseId, pagination: { returnAll: true } },
		});
		expect(seen.map((q) => q.id)).toEqual(asStudent.map((q) => q.id));
		for (const quiz of seen) expect(quiz.published).toBe(true);

		const none = await runNode({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			params: { courseId: listCourseId, options: { search_term: 'no quiz has this title zzzz' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);

		// Somebody who is not in the course (the designer persona), and a course that does not exist.
		const outsider = await runNode({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			persona: 'designer',
			items: [{ course: Number(listCourseId) }],
			params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(outsider.success).toEqual([]);
		expect([401, 403]).toContain(outsider.error[0].errorCode);
		expect(outsider.error[0]).toMatchObject({ resource: 'quiz', operation: 'getAllWithNewQuizzes' });
		const missing = await runNode({
			resource: 'quiz',
			operation: 'getAllWithNewQuizzes',
			params: { courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/courses/99999999/all_quizzes' });
	});

	it('reorder: questions and groups take the given order', async () => {
		const { id, questions } = await createQuiz(
			courseId,
			{ title: unique('Reorder me') },
			[
				{ ...MULTIPLE_CHOICE, question_name: 'First' },
				{ ...MULTIPLE_CHOICE, question_name: 'Second' },
				{ ...MULTIPLE_CHOICE, question_name: 'Third' },
			],
			false,
		);
		const group = (
			(await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes/${id}/groups`, {
				quiz_groups: [{ name: 'Pool', pick_count: 1, question_points: 1 }],
			})).quiz_groups as Json[]
		)[0];
		const [first, second, third] = questions.map((q) => q.id as number);

		const [result] = await runOk({
			resource: 'quiz',
			operation: 'reorder',
			params: {
				courseId,
				quizId: id,
				orderItems: {
					items: [
						{ id: third, type: 'question' },
						{ id: String(group.id), type: 'group' },
						{ id: ` ${first} `, type: 'question' },
						{ id: second, type: 'question' },
					],
				},
			},
		});
		expect(result).toEqual({ success: true });

		// The questions endpoint always reports "position: null"; the order shows in an attempt.
		const preview = (
			(await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes/${id}/submissions`, { preview: true }))
				.quiz_submissions as Json[]
		)[0];
		const shown = (await canvas().get<Json>(`/api/v1/quiz_submissions/${String(preview.id)}/questions`))
			.quiz_submission_questions as Json[];
		const position = (questionId: number): number => shown.find((q) => q.id === questionId)?.position as number;
		// (The group is empty, so it takes no place among the questions of the attempt.)
		expect([position(third), position(first), position(second)]).toEqual([1, 2, 3]);
		const groupAfter = await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${id}/groups/${String(group.id)}`);
		expect(groupAfter.position).toBe(2);

		const empty = await runNode({
			resource: 'quiz',
			operation: 'reorder',
			params: { courseId, quizId: id, orderItems: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, resource: 'quiz', operation: 'reorder' });
		expect(String(empty.error[0].errorMessage)).toContain('At least one item');
		await deleteQuiz(courseId, id);
	});

	it('validateAccessCode: tells a right code from a wrong one', async () => {
		const { id } = await createQuiz(courseId, { title: unique('Coded'), access_code: 'p@ss "word" & more' });
		const [right] = await runOk({
			resource: 'quiz',
			operation: 'validateAccessCode',
			params: { courseId, quizId: id, accessCode: 'p@ss "word" & more' },
		});
		expect(right).toEqual({ value: true });
		const [wrong] = await runOk({
			resource: 'quiz',
			operation: 'validateAccessCode',
			params: { courseId, quizId: id, accessCode: 'P@SS "WORD" & MORE' },
		});
		expect(wrong).toEqual({ value: false });

		// A quiz without an access code never validates, whatever is sent.
		const [noCode] = await runOk({
			resource: 'quiz',
			operation: 'validateAccessCode',
			params: { courseId, quizId: surveyId, accessCode: 'anything' },
		});
		expect(noCode).toEqual({ value: false });
		await deleteQuiz(courseId, id);
	});

	describe('students of a quiz', () => {
		let takenQuizId = '';

		beforeAll(async () => {
			takenQuizId = (await createQuiz(courseId, { title: unique('Taken by one') }, [MULTIPLE_CHOICE])).id;
			await takeQuiz(courseId, takenQuizId, 'student');
		});

		it('getSubmissionUsers: all students, those who submitted and those who did not', async () => {
			const path = `/api/v1/courses/${courseId}/quizzes/${takenQuizId}/submission_users`;
			const ids = (items: Json[]): string[] => items.map((u) => String(u.id)).sort();

			const everyone = await runOk({
				resource: 'quiz',
				operation: 'getSubmissionUsers',
				params: { courseId, quizId: takenQuizId, pagination: { returnAll: true } },
			});
			expect(ids(everyone)).toEqual(ids(await canvas().getAll<Json>(path, 'users')));
			expect(ids(everyone)).toEqual(expect.arrayContaining([fx('studentUserId'), fx('student2UserId')]));
			expect(everyone[0]).toHaveProperty('name');

			const submitted = await runOk({
				resource: 'quiz',
				operation: 'getSubmissionUsers',
				params: { courseId, quizId: takenQuizId, submitted: 'true' },
			});
			expect(ids(submitted)).toEqual([fx('studentUserId')]);

			const missing = await runOk({
				resource: 'quiz',
				operation: 'getSubmissionUsers',
				params: { courseId, quizId: takenQuizId, submitted: 'false' },
			});
			expect(ids(missing)).toEqual(ids(await canvas().getAll<Json>(`${path}?submitted=false`, 'users')));
			expect(ids(missing)).toContain(fx('student2UserId'));
			expect(ids(missing)).not.toContain(fx('studentUserId'));
		});

		it('getSubmissionUsers: one user per item even when paged one by one', async () => {
			const paged = await runOk({
				resource: 'quiz',
				operation: 'getSubmissionUsers',
				params: { courseId, quizId: takenQuizId, pagination: { perPage: 1, maxPages: 2 } },
			});
			expect(paged).toHaveLength(2);
			expect(new Set(paged.map((u) => u.id)).size).toBe(2);
		});

		it('getSubmissionUsers: students may not list their classmates', async () => {
			const result = await runNode({
				resource: 'quiz',
				operation: 'getSubmissionUsers',
				persona: 'student',
				params: { courseId, quizId: takenQuizId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'getSubmissionUsers' });
		});

		// Canvas delivers these conversations from a background job, which can take a while on a
		// busy instance. A teacher and a student share one private conversation, so a new message
		// shows up as the latest message of that conversation.
		const latestMessages = async (persona: string): Promise<string[]> =>
			(await new CanvasClient(persona).getAll<Json>('/api/v1/conversations')).map((c) => String(c.last_message));

		it(
			'messageStudents: only the students who have not submitted get the message',
			async () => {
				// A student who never talked to the teacher, so the conversation (and its subject) is new.
				const login = unique('quiz.reminder').replace(/\s/g, '.') + '@example.edu';
				const newcomer = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
					user: { name: 'Nadia Newcomer', skip_registration: true },
					pseudonym: { unique_id: login, send_confirmation: false },
				});
				const newcomerId = String(newcomer.id);
				const enrollment = await canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
					enrollment: { user_id: newcomerId, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
				});

				const subject = unique('Reminder: "quiz" & more ✉️');
				const body = `${unique('Please take the quiz')} — ¡ánimo! <b>not html</b>`;
				const [result] = await runOk({
					resource: 'quiz',
					operation: 'messageStudents',
					persona: 'teacher',
					params: { courseId, quizId: takenQuizId, recipients: 'unsubmitted', subject, body },
				});
				expect(result).toHaveProperty('status');

				const received = await waitFor(
					async () =>
						(await canvas().getAll<Json>(`/api/v1/conversations?as_user_id=${newcomerId}`)).find(
							(c) => c.last_message === body,
						),
					'the reminder to reach the student who has not submitted',
					200_000,
				);
				expect(received).toMatchObject({ subject, private: true, message_count: 1 });
				expect(await latestMessages('student2')).toContain(body);
				expect(await latestMessages('student'), 'the student who submitted must not get it').not.toContain(body);

				await canvas().request(
					'DELETE',
					`/api/v1/courses/${courseId}/enrollments/${String(enrollment.id)}?task=delete`,
				);
				await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${newcomerId}`);
			},
			240_000,
		);

		it(
			'messageStudents: "submitted" reaches the student who turned the quiz in; "all" reaches both',
			async () => {
				const body = unique('Thanks for submitting');
				await runOk({
					resource: 'quiz',
					operation: 'messageStudents',
					persona: 'teacher',
					params: { courseId, quizId: takenQuizId, recipients: 'submitted', body },
				});
				const toAll = unique('Results are out');
				await runOk({
					resource: 'quiz',
					operation: 'messageStudents',
					persona: 'teacher',
					params: { courseId, quizId: takenQuizId, recipients: 'all', subject: 'For everyone', body: toAll },
				});
				await waitFor(
					async () => (await latestMessages('student2')).includes(toAll),
					'the message for all students to arrive',
					200_000,
				);
				const student = await new CanvasClient('student').getAll<Json>('/api/v1/conversations');
				const texts: string[] = [];
				for (const conversation of student.slice(0, 5)) {
					const full = await new CanvasClient('student').get<Json>(`/api/v1/conversations/${String(conversation.id)}`);
					texts.push(...(full.messages as Json[]).map((m) => String(m.body)));
				}
				expect(texts).toContain(body);
				expect(texts).toContain(toAll);
				expect(await latestMessages('student2')).not.toContain(body);
			},
			240_000,
		);

		it('messageStudents: students may not message the class', async () => {
			const result = await runNode({
				resource: 'quiz',
				operation: 'messageStudents',
				persona: 'student',
				params: {
					courseId,
					quizId: takenQuizId,
					recipients: 'all',
					body: 'hello',
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'messageStudents' });
		});
	});

	it('several input items: each quiz is fetched, a missing one goes to the Error output', async () => {
		const result = await runNode({
			resource: 'quiz',
			operation: 'get',
			items: [{ id: quizId }, { id: '99999999' }, { id: surveyId }],
			params: { courseId, quizId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((q) => q.id)).toEqual([Number(quizId), Number(surveyId)]);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'quiz',
			operation: 'get',
			originalItem: { id: '99999999' },
		});
	});

	it('delete: removes the quiz and returns it', async () => {
		const [deleted] = await runOk({ resource: 'quiz', operation: 'delete', params: { courseId, quizId } });
		expect(deleted.id).toBe(Number(quizId));
		// Canvas keeps answering GET for a deleted quiz to teachers; it is gone from the course's list.
		const remaining = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/quizzes`);
		expect(remaining.map((q) => q.id)).not.toContain(Number(quizId));
		expect(remaining.map((q) => q.id)).toContain(Number(surveyId));

		const missing = await runNode({
			resource: 'quiz',
			operation: 'delete',
			params: { courseId, quizId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		await deleteQuiz(courseId, surveyId);
	});

	it('errors: students may not create quizzes', async () => {
		const result = await runNode({
			resource: 'quiz',
			operation: 'create',
			persona: 'student',
			params: { courseId, title: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'quiz', operation: 'create' });
		expect([401, 403]).toContain(result.error[0].errorCode);
	});

	it('errors: a course ID expression that resolves to nothing is rejected before any request is sent', async () => {
		const result = await runNode({
			resource: 'quiz',
			operation: 'getAll',
			items: [{ other: 1 }],
			params: { courseId: '={{ $json.course }}' },
		});
		expect(result.ok).toBe(false);
		expect(result.failure?.message).toContain('required parameter is empty');
	});
});
