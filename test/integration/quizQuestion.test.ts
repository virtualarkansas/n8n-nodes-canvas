import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, unique } from '../lib/canvas';
import { runNode, runOk } from './support/run';
import type { Json } from '../lib/n8n';
import { createQuiz, deleteQuiz, ESSAY, MULTIPLE_CHOICE, quizCourse, quizListCourse, takeQuiz } from './support/quizzes';

const MARATHON_TITLE = 'Question marathon (list fixture)';
const MARATHON_SIZE = 63;

/**
 * Resource: quizQuestion (questions of a classic quiz). Every operation runs
 * through a real n8n instance; writes are verified by reading the question back
 * from Canvas directly.
 */
describe('quizQuestion', () => {
	let courseId = '';
	let quizId = '';
	let groupId = '';
	let questionId = '';
	let marathonCourseId = '';
	let marathonQuizId = '';

	const questionsPath = (): string => `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`;
	const readQuestion = (id: string | number): Promise<Json> => canvas().get<Json>(`${questionsPath()}/${String(id)}`);

	beforeAll(async () => {
		[courseId, marathonCourseId] = await Promise.all([quizCourse(), quizListCourse()]);
		quizId = (await createQuiz(courseId, { title: unique('Question playground') }, [], false)).id;
		const group = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/groups`, {
			quiz_groups: [{ name: 'Pool', pick_count: 1, question_points: 2 }],
		});
		groupId = String((group.quiz_groups as Json[])[0].id);

		// A quiz with more questions than one page holds, created once and reused.
		// It stays unpublished so it never shows up in the student view of the quiz list.
		const quizzes = await canvas().getAll<Json>(
			`/api/v1/courses/${marathonCourseId}/quizzes?search_term=${encodeURIComponent(MARATHON_TITLE)}`,
		);
		const existing = quizzes.find((q) => q.title === MARATHON_TITLE);
		marathonQuizId = existing
			? String(existing.id)
			: String(
					(await canvas().post<Json>(`/api/v1/courses/${marathonCourseId}/quizzes`, {
						quiz: { title: MARATHON_TITLE, quiz_type: 'practice_quiz', published: false },
					})).id,
				);
		const have = await canvas().getAll<Json>(`/api/v1/courses/${marathonCourseId}/quizzes/${marathonQuizId}/questions`);
		for (let i = have.length; i < MARATHON_SIZE; i++) {
			await canvas().post(`/api/v1/courses/${marathonCourseId}/quizzes/${marathonQuizId}/questions`, {
				question: {
					question_name: `Marathon ${i + 1}`,
					question_text: `Is ${i + 1} an even number?`,
					question_type: 'true_false_question',
					points_possible: 1,
					answers: [
						{ answer_text: 'True', answer_weight: (i + 1) % 2 === 0 ? 100 : 0 },
						{ answer_text: 'False', answer_weight: (i + 1) % 2 === 0 ? 0 : 100 },
					],
				},
			});
		}
	});

	it('create: every optional field reaches Canvas (answers typed as JSON text)', async () => {
		const name = unique('Prime numbers "quoted" & <b>bold</b> ñ 素数');
		const [created] = await runOk({
			resource: 'quizQuestion',
			operation: 'create',
			params: {
				courseId,
				quizId,
				questionName: name,
				questionText: '<p>Which of these is <em>not</em> prime? ¿Cuál? 🤔</p>',
				questionType: 'multiple_choice_question',
				additionalFields: {
					answers: JSON.stringify([
						{ answer_text: '7', answer_weight: 0 },
						{ answer_text: '9', answer_weight: 100, answer_comment: 'Nine is 3 × 3' },
						{ answer_text: '11', answer_weight: 0, answer_comment_html: '<em>prime</em>' },
					]),
					correct_comments: 'Right!',
					correct_comments_html: '<p><strong>Right!</strong></p>',
					incorrect_comments: 'Not quite.',
					incorrect_comments_html: '<p><em>Not quite.</em></p>',
					neutral_comments: 'See chapter 2.',
					neutral_comments_html: '<p>See <a href="https://example.com/ch2">chapter 2</a>.</p>',
					points_possible: 2.5,
					quiz_group_id: groupId,
				},
			},
		});
		questionId = String(created.id);

		const actual = await readQuestion(questionId);
		expect(actual).toMatchObject({
			quiz_id: Number(quizId),
			quiz_group_id: Number(groupId),
			question_name: name,
			question_type: 'multiple_choice_question',
			points_possible: 2.5,
			correct_comments: 'Right!',
			correct_comments_html: '<p><strong>Right!</strong></p>',
			incorrect_comments: 'Not quite.',
			incorrect_comments_html: '<p><em>Not quite.</em></p>',
			neutral_comments: 'See chapter 2.',
		});
		expect(String(actual.neutral_comments_html)).toContain('href="https://example.com/ch2"');
		expect(String(actual.question_text)).toContain('<em>not</em> prime? ¿Cuál? 🤔');
		expect((actual.answers as Json[]).map((a) => [a.text, a.weight, a.comments, a.comments_html])).toEqual([
			['7', 0, '', ''],
			['9', 100, 'Nine is 3 × 3', ''],
			['11', 0, '', '<em>prime</em>'],
		]);
	});

	it('create: answers may also arrive as an array from an expression; one question per input item', async () => {
		const result = await runNode({
			resource: 'quizQuestion',
			operation: 'create',
			items: [
				{ name: 'Sky', text: 'The sky is blue.', answers: [{ answer_text: 'True', answer_weight: 100 }, { answer_text: 'False', answer_weight: 0 }] },
				{ name: 'Grass', text: 'Grass is red.', answers: [{ answer_text: 'True', answer_weight: 0 }, { answer_text: 'False', answer_weight: 100 }] },
			],
			params: {
				courseId,
				quizId: Number(quizId),
				questionName: '={{ $json.name }}',
				questionText: '={{ $json.text }}',
				questionType: 'true_false_question',
				additionalFields: { answers: '={{ $json.answers }}', points_possible: 1 },
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((q) => q.question_name)).toEqual(['Sky', 'Grass']);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 1]);
		const grass = await readQuestion(result.success[1].id as number);
		expect((grass.answers as Json[]).map((a) => [a.text, a.weight])).toEqual([
			['True', 0],
			['False', 100],
		]);
		for (const question of result.success) {
			await canvas().request('DELETE', `${questionsPath()}/${String(question.id)}`);
		}
	});

	it('create: each question type keeps its answers', async () => {
		const cases: Array<{ type: string; text: string; fields: Json; check: (q: Json) => void }> = [
			{
				type: 'multiple_answers_question',
				text: 'Pick the even numbers',
				fields: {
					answers: JSON.stringify([
						{ answer_text: '2', answer_weight: 100 },
						{ answer_text: '3', answer_weight: 0 },
						{ answer_text: '4', answer_weight: 100 },
					]),
				},
				check: (q) => expect((q.answers as Json[]).map((a) => a.weight)).toEqual([100, 0, 100]),
			},
			{
				type: 'short_answer_question',
				text: 'Capital of France?',
				fields: { answers: JSON.stringify([{ answer_text: 'Paris', answer_weight: 100 }, { answer_text: 'paris', answer_weight: 100 }]) },
				check: (q) => expect((q.answers as Json[]).map((a) => a.text)).toEqual(['Paris', 'paris']),
			},
			{
				type: 'fill_in_multiple_blanks_question',
				text: 'Roses are [color1], violets are [color2].',
				fields: {
					answers: JSON.stringify([
						{ answer_text: 'red', answer_weight: 100, blank_id: 'color1' },
						{ answer_text: 'blue', answer_weight: 100, blank_id: 'color2' },
					]),
				},
				check: (q) => expect((q.answers as Json[]).map((a) => [a.blank_id, a.text])).toEqual([['color1', 'red'], ['color2', 'blue']]),
			},
			{
				type: 'multiple_dropdowns_question',
				text: 'Water is [state] at 20 °C.',
				fields: {
					answers: JSON.stringify([
						{ answer_text: 'liquid', answer_weight: 100, blank_id: 'state' },
						{ answer_text: 'solid', answer_weight: 0, blank_id: 'state' },
					]),
				},
				check: (q) => expect((q.answers as Json[]).map((a) => [a.blank_id, a.text, a.weight])).toEqual([['state', 'liquid', 100], ['state', 'solid', 0]]),
			},
			{
				type: 'matching_question',
				text: 'Match the city to its state',
				fields: {
					answers: JSON.stringify([
						{ answer_match_left: 'Salt Lake City', answer_match_right: 'Utah' },
						{ answer_match_left: 'Austin', answer_match_right: 'Texas' },
					]),
					matching_answer_incorrect_matches: 'Nevada\nCalifornia',
				},
				check: (q) => {
					expect((q.answers as Json[]).map((a) => [a.left, a.right])).toEqual([['Salt Lake City', 'Utah'], ['Austin', 'Texas']]);
					expect(q.matching_answer_incorrect_matches).toBe('Nevada\nCalifornia');
					expect((q.matches as Json[]).map((m) => m.text).sort()).toEqual(['California', 'Nevada', 'Texas', 'Utah']);
				},
			},
			{
				type: 'numerical_question',
				text: 'Give π to two decimals',
				fields: {
					answers: JSON.stringify([
						{ numerical_answer_type: 'exact_answer', answer_exact: 3.14, answer_error_margin: 0.01 },
						{ numerical_answer_type: 'range_answer', answer_range_start: 3, answer_range_end: 4 },
					]),
				},
				check: (q) =>
					expect(q.answers).toMatchObject([
						{ numerical_answer_type: 'exact_answer', exact: 3.14, margin: 0.01 },
						{ numerical_answer_type: 'range_answer', start: 3, end: 4 },
					]),
			},
			{ type: 'essay_question', text: 'Explain osmosis.', fields: { points_possible: 10 }, check: (q) => expect(q.points_possible).toBe(10) },
			{ type: 'file_upload_question', text: 'Upload your lab report.', fields: {}, check: (q) => expect(q.answers).toEqual([]) },
			{
				type: 'text_only_question',
				text: '<p>Read the following passage carefully.</p>',
				fields: {},
				check: (q) => expect(q.points_possible).toBe(0),
			},
			{
				type: 'calculated_question',
				text: 'What is 5 plus [x]?',
				fields: { answers: JSON.stringify([{ variables: [{ name: 'x', value: 2 }], answer_text: 7 }]) },
				check: (q) => expect(q.question_type).toBe('calculated_question'),
			},
		];

		for (const testCase of cases) {
			const [created] = await runOk({
				resource: 'quizQuestion',
				operation: 'create',
				params: {
					courseId,
					quizId,
					questionName: `Type ${testCase.type}`,
					questionText: testCase.text,
					questionType: testCase.type,
					additionalFields: testCase.fields,
				},
			});
			const actual = await readQuestion(created.id as number);
			expect(actual, testCase.type).toMatchObject({ question_type: testCase.type, question_name: `Type ${testCase.type}` });
			expect(String(actual.question_text)).toContain(testCase.text.replace(/<[^>]+>/g, '').slice(0, 20));
			testCase.check(actual);
		}
	});

	it('create: malformed answers are refused before anything is sent', async () => {
		const before = (await canvas().getAll<Json>(questionsPath())).length;
		for (const answers of ['[{"answer_text": "4", ', '{"answer_text": "4"}']) {
			const result = await runNode({
				resource: 'quizQuestion',
				operation: 'create',
				params: {
					courseId,
					quizId,
					questionName: 'Broken',
					questionText: 'Broken',
					questionType: 'multiple_choice_question',
					additionalFields: { answers },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 0, resource: 'quizQuestion', operation: 'create' });
			expect(String(result.error[0].errorMessage)).toMatch(/answers/i);
		}
		expect((await canvas().getAll<Json>(questionsPath())).length).toBe(before);
	});

	it('get: returns the question with its answers; a number as ID works', async () => {
		const result = await runNode({
			resource: 'quizQuestion',
			operation: 'get',
			items: [{ question: Number(questionId) }],
			params: { courseId, quizId, questionId: '={{ $json.question }}' },
		});
		expect(result.success).toHaveLength(1);
		expect(result.success[0]).toMatchObject({ id: Number(questionId), quiz_id: Number(quizId), points_possible: 2.5 });
		expect((result.success[0].answers as Json[]).map((a) => a.weight)).toEqual([0, 100, 0]);
	});

	it('update: every field reaches Canvas', async () => {
		const [updated] = await runOk({
			resource: 'quizQuestion',
			operation: 'update',
			params: {
				courseId,
				quizId,
				questionId,
				updateFields: {
					answers: JSON.stringify([
						{ answer_text: 'Mercury', answer_weight: 100, answer_comment: 'Closest to the sun' },
						{ answer_text: 'Venus', answer_weight: 100 },
						{ answer_text: 'Sirius', answer_weight: 0 },
					]),
					correct_comments: 'Yes',
					correct_comments_html: '<p>Yes</p>',
					incorrect_comments: 'No',
					incorrect_comments_html: '<p>No</p>',
					neutral_comments: 'Planets orbit stars.',
					neutral_comments_html: '<p>Planets orbit stars.</p>',
					points_possible: 4,
					question_name: 'Planets — updated',
					question_text: '<p>Select the planets.</p>',
					question_type: 'multiple_answers_question',
					quiz_group_id: groupId,
				},
			},
		});
		expect(updated.question_name).toBe('Planets — updated');
		const actual = await readQuestion(questionId);
		expect(actual).toMatchObject({
			question_name: 'Planets — updated',
			question_text: '<p>Select the planets.</p>',
			question_type: 'multiple_answers_question',
			quiz_group_id: Number(groupId),
			points_possible: 4,
			correct_comments: 'Yes',
			correct_comments_html: '<p>Yes</p>',
			incorrect_comments: 'No',
			incorrect_comments_html: '<p>No</p>',
			neutral_comments: 'Planets orbit stars.',
			neutral_comments_html: '<p>Planets orbit stars.</p>',
		});
		expect((actual.answers as Json[]).map((a) => [a.text, a.weight, a.comments])).toEqual([
			['Mercury', 100, 'Closest to the sun'],
			['Venus', 100, ''],
			['Sirius', 0, ''],
		]);
	});

	it('update: Canvas merges onto the question as first created, not onto earlier updates', async () => {
		// Real-world trap documented in the node: change one field and the fields changed by an
		// earlier update snap back to what the question was created with.
		const question = await canvas().post<Json>(questionsPath(), {
			question: { ...MULTIPLE_CHOICE, question_name: 'Original name', points_possible: 3 },
		});
		const id = String(question.id);
		await runOk({
			resource: 'quizQuestion',
			operation: 'update',
			params: { courseId, quizId, questionId: id, updateFields: { points_possible: 9 } },
		});
		expect(await readQuestion(id)).toMatchObject({ points_possible: 9, question_name: 'Original name' });

		await runOk({
			resource: 'quizQuestion',
			operation: 'update',
			params: { courseId, quizId, questionId: id, updateFields: { question_name: 'Renamed' } },
		});
		expect(await readQuestion(id)).toMatchObject({ question_name: 'Renamed', points_possible: 3 });

		// Sending everything that matters in one update keeps it all.
		await runOk({
			resource: 'quizQuestion',
			operation: 'update',
			params: { courseId, quizId, questionId: id, updateFields: { question_name: 'Renamed', points_possible: 9 } },
		});
		const final = await readQuestion(id);
		expect(final).toMatchObject({ question_name: 'Renamed', points_possible: 9, question_text: MULTIPLE_CHOICE.question_text });
		expect((final.answers as Json[]).map((a) => a.text)).toEqual(['4', '5']);
	});

	it('getAll: pages through a quiz with more questions than one page holds', async () => {
		const path = `/api/v1/courses/${marathonCourseId}/quizzes/${marathonQuizId}/questions`;
		const expected = await canvas().getAll<Json>(path);
		expect(expected.length).toBeGreaterThanOrEqual(MARATHON_SIZE);

		const defaults = await runOk({
			resource: 'quizQuestion',
			operation: 'getAll',
			params: { courseId: marathonCourseId, quizId: marathonQuizId },
		});
		expect(defaults).toHaveLength(50);

		const all = await runOk({
			resource: 'quizQuestion',
			operation: 'getAll',
			params: { courseId: marathonCourseId, quizId: marathonQuizId, pagination: { returnAll: true } },
		});
		expect(all.map((q) => q.id)).toEqual(expected.map((q) => q.id));
		expect(new Set(all.map((q) => q.id)).size).toBe(all.length);

		const pages = await runOk({
			resource: 'quizQuestion',
			operation: 'getAll',
			params: { courseId: marathonCourseId, quizId: marathonQuizId, pagination: { perPage: 4, maxPages: 3 } },
		});
		expect(pages.map((q) => q.id)).toEqual(expected.slice(0, 12).map((q) => q.id));
	});

	it('getAll: a quiz without questions gives no items', async () => {
		const empty = await createQuiz(courseId, { title: unique('Empty quiz') }, [], false);
		const result = await runNode({ resource: 'quizQuestion', operation: 'getAll', params: { courseId, quizId: empty.id } });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		await deleteQuiz(courseId, empty.id);
	});

	it('getAll: with a quiz submission, returns the questions as that attempt saw them', async () => {
		const { id, questions } = await createQuiz(courseId, { title: unique('Changed after the fact') }, [MULTIPLE_CHOICE, ESSAY]);
		const attempt = await takeQuiz(courseId, id, 'student');
		// The teacher adds a third question and republishes after the student has submitted.
		const late = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes/${id}/questions`, {
			question: { ...ESSAY, question_name: 'Added later' },
		});
		await canvas().put(`/api/v1/courses/${courseId}/quizzes/${id}`, { quiz: { published: true } });

		const current = await runOk({ resource: 'quizQuestion', operation: 'getAll', params: { courseId, quizId: id } });
		expect(current.map((q) => q.id)).toEqual([...questions.map((q) => q.id), late.id]);

		const asSeen = await runOk({
			resource: 'quizQuestion',
			operation: 'getAll',
			params: {
				courseId,
				quizId: id,
				options: { quiz_submission_id: String(attempt.id), quiz_submission_attempt: 1 },
			},
		});
		expect(asSeen.map((q) => q.id).sort()).toEqual(questions.map((q) => q.id).sort());

		// The attempt defaults to 1 when only the submission is given.
		const defaultAttempt = await runOk({
			resource: 'quizQuestion',
			operation: 'getAll',
			params: { courseId, quizId: id, options: { quiz_submission_id: attempt.id } },
		});
		expect(defaultAttempt.map((q) => q.id).sort()).toEqual(questions.map((q) => q.id).sort());

		const wrongAttempt = await runNode({
			resource: 'quizQuestion',
			operation: 'getAll',
			params: {
				courseId,
				quizId: id,
				options: { quiz_submission_id: String(attempt.id), quiz_submission_attempt: 7 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongAttempt.success).toEqual([]);
		expect(wrongAttempt.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAll' });
		await deleteQuiz(courseId, id);
	});

	it('delete: removes the question', async () => {
		const [result] = await runOk({ resource: 'quizQuestion', operation: 'delete', params: { courseId, quizId, questionId } });
		expect(result).toEqual({ success: true });
		expect((await canvas().request('GET', `${questionsPath()}/${questionId}`)).status).toBe(404);
		expect((await canvas().getAll<Json>(questionsPath())).map((q) => q.id)).not.toContain(Number(questionId));
	});

	it('errors: a deleted question is not found; a mix of items reports each on its own output', async () => {
		const survivors = await canvas().getAll<Json>(questionsPath());
		const result = await runNode({
			resource: 'quizQuestion',
			operation: 'get',
			items: [{ id: questionId }, { id: survivors[0].id }],
			params: { courseId, quizId, questionId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((q) => q.id)).toEqual([survivors[0].id]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'quizQuestion',
			operation: 'get',
		});
	});

	it('errors: students can neither read the answer key nor add questions', async () => {
		const survivors = await canvas().getAll<Json>(questionsPath());
		expect((await new CanvasClient('student').request('GET', questionsPath())).status).toBeGreaterThanOrEqual(401);
		for (const [operation, params] of [
			['getAll', {}],
			['get', { questionId: String(survivors[0].id) }],
			['create', { questionName: 'Sneaky', questionText: 'Sneaky', questionType: 'essay_question' }],
			['delete', { questionId: String(survivors[0].id) }],
		] as Array<[string, Json]>) {
			const result = await runNode({
				resource: 'quizQuestion',
				operation,
				persona: 'student',
				params: { courseId, quizId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', operation });
		}
		expect((await canvas().getAll<Json>(questionsPath())).length).toBe(survivors.length);
		await deleteQuiz(courseId, quizId);
	});
});
