import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import { createQuiz, deleteQuiz, MULTIPLE_CHOICE, quizCourse, unwrap } from './support/quizzes';

/**
 * Canvas' API reports `position: null` for every quiz question, and questions of a
 * group are drawn in random order in an attempt, so the stored order of the
 * questions inside a group can only be read from the database.
 */
function storedOrder(quizId: string): Array<{ id: number; position: number; groupId: number | null }> {
	const out = execFileSync(
		'docker',
		[
			'exec',
			'canvas-pg',
			'psql',
			'-U',
			'postgres',
			'-d',
			'canvas_development',
			'-At',
			'-c',
			`select id, position, coalesce(quiz_group_id::text, '') from quiz_questions where quiz_id = ${Number(quizId)} and workflow_state <> 'deleted' order by position, id`,
		],
		{ encoding: 'utf8' },
	);
	return out
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [id, position, groupId] = line.split('|');
			return { id: Number(id), position: Number(position), groupId: groupId ? Number(groupId) : null };
		});
}

/**
 * Resource: quizQuestionGroup (question groups of a classic quiz). Every
 * operation runs through a real n8n instance; writes are verified by reading
 * the group back from Canvas directly.
 */
describe('quizQuestionGroup', () => {
	let courseId = '';
	let quizId = '';
	let bankId = '';
	let groupId = '';
	let looseQuestionIds: number[] = [];
	const name = unique('Pool "A" & <b>B</b> — ünï 题库');

	const groupsPath = (): string => `/api/v1/courses/${courseId}/quizzes/${quizId}/groups`;
	const readGroup = (id: string | number): Promise<Json> => canvas().get<Json>(`${groupsPath()}/${String(id)}`);

	beforeAll(async () => {
		courseId = await quizCourse();
		const quiz = await createQuiz(
			courseId,
			{ title: unique('Group playground') },
			[
				{ ...MULTIPLE_CHOICE, question_name: 'Loose 1' },
				{ ...MULTIPLE_CHOICE, question_name: 'Loose 2' },
				{ ...MULTIPLE_CHOICE, question_name: 'Loose 3' },
			],
			false,
		);
		quizId = quiz.id;
		looseQuestionIds = quiz.questions.map((q) => q.id as number);
		// Canvas files every new quiz question in a question bank of the course; that bank can feed a group.
		bankId = String((quiz.questions[0].assessment_question as Json).assessment_question_bank_id);
	});

	it('create: every optional field reaches Canvas', async () => {
		const [item] = await runOk({
			resource: 'quizQuestionGroup',
			operation: 'create',
			params: {
				courseId,
				quizId,
				name,
				additionalFields: { assessment_question_bank_id: bankId, pick_count: 2, question_points: 2.5 },
			},
		});
		const created = unwrap(item, 'quiz_groups');
		groupId = String(created.id);
		expect(created).toMatchObject({ name, pick_count: 2, question_points: 2.5 });

		expect(await readGroup(groupId)).toMatchObject({
			id: Number(groupId),
			quiz_id: Number(quizId),
			name,
			pick_count: 2,
			question_points: 2.5,
			assessment_question_bank_id: Number(bankId),
		});
	});

	it('create: a group with only a name; a question bank of another course is ignored by Canvas', async () => {
		const [item] = await runOk({
			resource: 'quizQuestionGroup',
			operation: 'create',
			params: { courseId, quizId, name: 'Bare group', additionalFields: { assessment_question_bank_id: '99999999' } },
		});
		const created = unwrap(item, 'quiz_groups');
		expect(await readGroup(created.id as number)).toMatchObject({
			name: 'Bare group',
			assessment_question_bank_id: null,
		});
		await canvas().request('DELETE', `${groupsPath()}/${String(created.id)}`);
	});

	it('get: returns the group; numeric IDs from expressions work', async () => {
		const result = await runNode({
			resource: 'quizQuestionGroup',
			operation: 'get',
			items: [{ group: Number(groupId) }],
			params: { courseId, quizId: Number(quizId), groupId: '={{ $json.group }}' },
		});
		expect(result.success).toEqual([await readGroup(groupId)]);
	});

	it('getAll: one item per group of the quiz', async () => {
		const extra: number[] = [];
		for (let i = 1; i <= 12; i++) {
			const res = await canvas().post<Json>(groupsPath(), { quiz_groups: [{ name: `Extra ${i}`, pick_count: 1 }] });
			extra.push((res.quiz_groups as Json[])[0].id as number);
		}
		const expected = await canvas().getAll<Json>(groupsPath(), 'quiz_groups');
		expect(expected).toHaveLength(13);

		const listed = await runOk({ resource: 'quizQuestionGroup', operation: 'getAll', params: { courseId, quizId } });
		expect(listed.map((g) => g.id).sort()).toEqual(expected.map((g) => g.id).sort());
		expect(listed.find((g) => g.id === Number(groupId))).toMatchObject({ name, pick_count: 2 });

		const all = await runOk({
			resource: 'quizQuestionGroup',
			operation: 'getAll',
			params: { courseId, quizId, pagination: { returnAll: true } },
		});
		expect(all.map((g) => g.id).sort()).toEqual(expected.map((g) => g.id).sort());
		expect(new Set(all.map((g) => g.id)).size).toBe(all.length);

		for (const id of extra) await canvas().request('DELETE', `${groupsPath()}/${id}`);
	});

	it('getAll: a quiz without groups gives no items', async () => {
		const empty = await createQuiz(courseId, { title: unique('No groups') }, [], false);
		const result = await runNode({ resource: 'quizQuestionGroup', operation: 'getAll', params: { courseId, quizId: empty.id } });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		await deleteQuiz(courseId, empty.id);
	});

	it('update: every field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const [item] = await runOk({
			resource: 'quizQuestionGroup',
			operation: 'update',
			params: { courseId, quizId, groupId, updateFields: { name: renamed, pick_count: 3, question_points: 4 } },
		});
		expect(unwrap(item, 'quiz_groups')).toMatchObject({ id: Number(groupId), name: renamed });
		expect(await readGroup(groupId)).toMatchObject({
			name: renamed,
			pick_count: 3,
			question_points: 4,
			assessment_question_bank_id: Number(bankId),
		});
	});

	it('update: a name Canvas cannot store is reported with its validation message', async () => {
		const result = await runNode({
			resource: 'quizQuestionGroup',
			operation: 'update',
			params: {
				courseId,
				quizId,
				groupId,
				updateFields: { name: 'x'.repeat(300) },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('name');
		expect((await readGroup(groupId)).name).toBe(`${name} (renamed)`);
	});

	it('reorder: listed questions move into the group in the given order', async () => {
		const [first, second, third] = looseQuestionIds;
		const [result] = await runOk({
			resource: 'quizQuestionGroup',
			operation: 'reorder',
			params: {
				courseId,
				quizId,
				groupId,
				questionOrder: { questions: [{ id: third }, { id: ` ${first} ` }, { id: String(second) }] },
			},
		});
		expect(result).toEqual({ success: true });

		for (const id of looseQuestionIds) {
			const question = await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${id}`);
			expect(question.quiz_group_id, `question ${id} is now in the group`).toBe(Number(groupId));
		}
		expect(storedOrder(quizId)).toEqual([
			{ id: third, position: 1, groupId: Number(groupId) },
			{ id: first, position: 2, groupId: Number(groupId) },
			{ id: second, position: 3, groupId: Number(groupId) },
		]);

		// And the other way round.
		await runOk({
			resource: 'quizQuestionGroup',
			operation: 'reorder',
			params: { courseId, quizId, groupId, questionOrder: { questions: [{ id: second }, { id: first }, { id: third }] } },
		});
		expect(storedOrder(quizId).map((q) => q.id)).toEqual([second, first, third]);

		const empty = await runNode({
			resource: 'quizQuestionGroup',
			operation: 'reorder',
			params: { courseId, quizId, groupId, questionOrder: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, operation: 'reorder' });
		expect(String(empty.error[0].errorMessage)).toContain('At least one question');
	});

	it('errors: students may not manage groups', async () => {
		for (const [operation, params] of [
			['create', { name: 'Sneaky' }],
			['update', { groupId, updateFields: { name: 'Sneaky' } }],
			['delete', { groupId }],
		] as Array<[string, Json]>) {
			const result = await runNode({
				resource: 'quizQuestionGroup',
				operation,
				persona: 'student',
				params: { courseId, quizId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', resource: 'quizQuestionGroup', operation });
		}
		expect((await readGroup(groupId)).name).toBe(`${name} (renamed)`);
	});

	it('delete: removes the group; a second delete and a get report "not found"', async () => {
		const result = await runNode({
			resource: 'quizQuestionGroup',
			operation: 'delete',
			items: [{ id: groupId }, { id: '99999999' }],
			params: { courseId, quizId, groupId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([{ success: true }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		expect((await canvas().request('GET', `${groupsPath()}/${groupId}`)).status).toBe(404);

		const gone = await runNode({
			resource: 'quizQuestionGroup',
			operation: 'get',
			params: { courseId, quizId, groupId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(gone.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'quizQuestionGroup', operation: 'get' });
		await deleteQuiz(courseId, quizId);
	});
});
