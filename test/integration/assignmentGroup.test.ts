import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ensureAssignmentsBattery } from './contentBattery';
import type { AssignmentsBattery } from './contentBattery';

/**
 * Resource: assignmentGroup. Runs in the assignments battery course (a dozen
 * groups, more than 100 assignments) and, for grading periods, in a small
 * course of the seeded term that has them.
 */
describe('assignmentGroup', () => {
	let battery: AssignmentsBattery;
	let courseId = '';
	let groupId = '';
	let targetGroupId = '';
	let assignmentIds: Record<string, string> = {};
	const name = unique('Gruppe ünï 组 "quoted" & <b>tags</b>');

	const groupFromCanvas = (id: string, query = ''): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/assignment_groups/${id}${query}`);
	const ids = (list: Json[]): unknown[] => list.map((entry) => entry.id);

	beforeAll(async () => {
		battery = await ensureAssignmentsBattery();
		courseId = battery.courseId;
	}, 900_000);

	it('create: every optional field reaches Canvas', async () => {
		const sisId = unique('SIS-AG').replace(/\s/g, '-');
		const [group] = await runOk({
			resource: 'assignmentGroup',
			operation: 'create',
			params: {
				courseId,
				name,
				additionalFields: {
					group_weight: 12.5,
					integration_data: '{"gradebook": {"column": 7}, "tag": "x"}',
					position: 2,
					sis_source_id: sisId,
				},
			},
		});
		groupId = String(group.id);
		expect(group.name).toBe(name);

		expect(await groupFromCanvas(groupId)).toMatchObject({
			name,
			group_weight: 12.5,
			integration_data: { gradebook: { column: 7 }, tag: 'x' },
			position: 2,
			rules: {},
			sis_source_id: sisId,
		});
	});

	it('create: minimal group; JSON fields may arrive as objects from an expression', async () => {
		const result = await runNode({
			resource: 'assignmentGroup',
			operation: 'create',
			items: [{ title: unique('Target group'), data: { from: 'expression' } }],
			params: {
				courseId,
				name: '={{ $json.title }}',
				additionalFields: { integration_data: '={{ $json.data }}' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		targetGroupId = String(result.success[0].id);
		expect(await groupFromCanvas(targetGroupId)).toMatchObject({
			group_weight: 0,
			integration_data: { from: 'expression' },
		});
	});

	it('create: invalid JSON is reported before anything is sent', async () => {
		const result = await runNode({
			resource: 'assignmentGroup',
			operation: 'create',
			params: {
				courseId,
				name: unique('Bad JSON'),
				additionalFields: { integration_data: '{tag: 1' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 0, errorMessage: 'Integration Data must be valid JSON' });
		const groups = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignment_groups`);
		expect(groups.some((g) => String(g.name).startsWith('Bad JSON'))).toBe(false);
	});

	it('get: includes the assignments and their details', async () => {
		const make = async (assignment: Json): Promise<string> =>
			String(
				(
					await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
						assignment: { assignment_group_id: groupId, points_possible: 10, published: true, ...assignment },
					})
				).id,
			);
		const discussion = await canvas().post<Json>(`/api/v1/courses/${courseId}/discussion_topics`, {
			title: unique('Graded discussion'),
			message: 'talk',
			published: true,
			assignment: { points_possible: 5, assignment_group_id: groupId },
		});
		const quiz = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes`, {
			quiz: { title: unique('Graded quiz'), quiz_type: 'assignment', assignment_group_id: groupId, published: true },
		});
		assignmentIds = {
			text: await make({ name: unique('AG text'), submission_types: ['online_text_entry'] }),
			upload: await make({ name: unique('AG upload'), submission_types: ['online_upload'] }),
			tool: await make({
				name: unique('AG tool'),
				submission_types: ['external_tool'],
				external_tool_tag_attributes: { url: fx('externalToolUrl') },
			}),
			discussion: String(discussion.assignment_id),
			quiz: String(quiz.assignment_id),
		};

		const [group] = await runOk({
			resource: 'assignmentGroup',
			operation: 'get',
			params: {
				courseId,
				assignmentGroupId: groupId,
				options: {
					include: ['assignment_visibility', 'assignments', 'discussion_topic', 'score_statistics', 'submission'],
					override_assignment_dates: false,
				},
			},
		});
		expect(group).toMatchObject({ id: Number(groupId), name });
		const assignments = group.assignments as Json[];
		expect(ids(assignments).map(String).sort()).toEqual(Object.values(assignmentIds).sort());
		const graded = assignments.find((a) => String(a.id) === assignmentIds.discussion)!;
		expect(graded.discussion_topic).toMatchObject({ id: discussion.id });
		expect(assignments[0].assignment_visibility).toBeInstanceOf(Array);

		const [plain] = await runOk({
			resource: 'assignmentGroup',
			operation: 'get',
			items: [{ id: Number(groupId) }],
			params: { courseId, assignmentGroupId: '={{ $json.id }}' },
		});
		expect(plain).not.toHaveProperty('assignments');
	});

	it('get: "grading period ID" narrows the assignments to that period', async () => {
		const periods = battery.periods;
		const run = async (gradingPeriodId?: string): Promise<string[]> => {
			const [group] = await runOk({
				resource: 'assignmentGroup',
				operation: 'get',
				params: {
					courseId: periods.courseId,
					assignmentGroupId: periods.assignmentGroupId,
					options: { include: ['assignments'], ...(gradingPeriodId ? { grading_period_id: gradingPeriodId } : {}) },
				},
			});
			return ids(group.assignments as Json[]).map(String);
		};
		expect((await run()).sort()).toEqual([periods.firstAssignmentId, periods.secondAssignmentId].sort());
		expect(await run(periods.firstPeriodId)).toEqual([periods.firstAssignmentId]);
		expect(await run(periods.secondPeriodId)).toEqual([periods.secondAssignmentId]);
	});

	it('getAll: lists every group and paginates', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignment_groups`);
		expect(expected.length).toBeGreaterThan(12);

		const all = await runOk({
			resource: 'assignmentGroup',
			operation: 'getAll',
			params: { courseId, pagination: { returnAll: true } },
		});
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(all.length);

		const defaults = await runOk({ resource: 'assignmentGroup', operation: 'getAll', params: { courseId } });
		expect(ids(defaults)).toEqual(ids(expected.slice(0, 50)));

		const some = await runOk({
			resource: 'assignmentGroup',
			operation: 'getAll',
			params: { courseId, pagination: { perPage: 4, maxPages: 3 } },
		});
		expect(ids(some)).toEqual(ids(expected.slice(0, 12)));
		expect(some[0]).not.toHaveProperty('assignments');
	});

	it('getAll: include, assignment IDs and excluded submission types shape the assignment lists', async () => {
		const run = async (options: Json): Promise<Json[]> => {
			const groups = await runOk({
				resource: 'assignmentGroup',
				operation: 'getAll',
				params: { courseId, options, pagination: { returnAll: true } },
			});
			return (groups.find((g) => String(g.id) === groupId)!.assignments ?? []) as Json[];
		};

		const everything = await run({
			include: [
				'all_dates',
				'assignment_visibility',
				'assignments',
				'can_edit',
				'discussion_topic',
				'observed_users',
				'overrides',
				'peer_review',
				'score_statistics',
				'submission',
			],
			override_assignment_dates: false,
		});
		expect(ids(everything).map(String).sort()).toEqual(Object.values(assignmentIds).sort());
		const text = everything.find((a) => String(a.id) === assignmentIds.text)!;
		expect(text.all_dates).toBeInstanceOf(Array);
		expect(text.overrides).toEqual([]);
		expect(text.assignment_visibility).toBeInstanceOf(Array);
		expect(text.can_edit).toBe(true);

		const picked = await run({ include: ['assignments'], assignment_ids: `${assignmentIds.text}, ${assignmentIds.quiz}` });
		expect(ids(picked).map(String).sort()).toEqual([assignmentIds.text, assignmentIds.quiz].sort());

		const withoutSpecial = await run({
			include: ['assignments'],
			exclude_assignment_submission_types: ['discussion_topic', 'external_tool', 'online_quiz', 'wiki_page'],
		});
		expect(ids(withoutSpecial).map(String).sort()).toEqual([assignmentIds.text, assignmentIds.upload].sort());

		const withoutQuiz = await run({ include: ['assignments'], exclude_assignment_submission_types: ['online_quiz'] });
		expect(ids(withoutQuiz).map(String)).not.toContain(assignmentIds.quiz);
		expect(ids(withoutQuiz).map(String)).toContain(assignmentIds.discussion);
	});

	it('getAll: grading period and student scope', async () => {
		const periods = battery.periods;
		const groups = await runOk({
			resource: 'assignmentGroup',
			operation: 'getAll',
			params: {
				courseId: periods.courseId,
				options: { include: ['assignments'], grading_period_id: periods.secondPeriodId },
				pagination: { returnAll: true },
			},
		});
		const group = groups.find((g) => String(g.id) === periods.assignmentGroupId)!;
		expect(ids(group.assignments as Json[]).map(String)).toEqual([periods.secondAssignmentId]);

		// As a student, only assignments visible to that student are listed (unpublished ones are not).
		const asStudent = await runOk({
			resource: 'assignmentGroup',
			operation: 'getAll',
			persona: 'student',
			params: {
				courseId,
				options: { include: ['assignments', 'submission'], scope_assignments_to_student: true },
				pagination: { returnAll: true },
			},
		});
		const bulk = asStudent.find((g) => String(g.id) === battery.bulkGroupId)!;
		const assignments = bulk.assignments as Json[];
		expect(assignments.length).toBeGreaterThan(40);
		expect(assignments.length).toBeLessThan(60);
		expect(assignments.every((a) => a.published === true)).toBe(true);
		expect(assignments[0].submission).toMatchObject({ user_id: Number(fx('studentUserId')) });
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const sisId = unique('SIS-AG2').replace(/\s/g, '-');
		const [updated] = await runOk({
			resource: 'assignmentGroup',
			operation: 'update',
			params: {
				courseId,
				assignmentGroupId: groupId,
				updateFields: {
					group_weight: 40,
					integration_data: '{"tag": "y", "extra": true}',
					name: renamed,
					position: 1,
					rules: `{"drop_lowest": 2, "drop_highest": 1, "never_drop": [${assignmentIds.text}]}`,
					sis_source_id: sisId,
				},
			},
		});
		expect(updated.name).toBe(renamed);
		const actual = await groupFromCanvas(groupId);
		expect(actual).toMatchObject({
			name: renamed,
			group_weight: 40,
			position: 1,
			sis_source_id: sisId,
			// Canvas merges integration data into what is stored.
			integration_data: { gradebook: { column: 7 }, tag: 'y', extra: true },
		});
		expect(actual.rules).toMatchObject({ drop_lowest: 2, drop_highest: 1 });
		expect(((actual.rules as Json).never_drop as unknown[]).map(String)).toEqual([assignmentIds.text]);
	});

	it('update: rules that drop more scores than there are assignments are refused; rules may come from an expression', async () => {
		const tooMany = await runNode({
			resource: 'assignmentGroup',
			operation: 'update',
			params: {
				courseId,
				assignmentGroupId: groupId,
				updateFields: { rules: '{"drop_lowest": 50}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(tooMany.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(tooMany.error[0].canvasErrors).toHaveProperty('rules');

		const fromExpression = await runNode({
			resource: 'assignmentGroup',
			operation: 'update',
			items: [{ rules: { drop_lowest: 3 } }],
			params: { courseId, assignmentGroupId: groupId, updateFields: { rules: '={{ $json.rules }}' } },
		});
		expect(fromExpression.failure, JSON.stringify(fromExpression.failure)).toBeUndefined();
		expect((await groupFromCanvas(groupId)).rules).toEqual({ drop_lowest: 3 });
	});

	it('update: an empty rules object removes the rules', async () => {
		await runOk({
			resource: 'assignmentGroup',
			operation: 'update',
			params: { courseId, assignmentGroupId: groupId, updateFields: { rules: '{}' } },
		});
		expect((await groupFromCanvas(groupId)).rules).toEqual({});
	});

	it('errors: a student may not create groups; a missing group is not found; several items', async () => {
		const forbidden = await runNode({
			resource: 'assignmentGroup',
			operation: 'create',
			persona: 'student',
			params: { courseId, name: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const mixed = await runNode({
			resource: 'assignmentGroup',
			operation: 'get',
			items: [{ id: groupId }, { id: 999999999 }, { id: targetGroupId }],
			params: { courseId, assignmentGroupId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(ids(mixed.success).map(String)).toEqual([groupId, targetGroupId]);
		expect(mixed.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(mixed.error).toHaveLength(1);
		expect(mixed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'assignmentGroup' });
	});

	it('delete: "move assignments to" keeps the assignments in another group', async () => {
		const [deleted] = await runOk({
			resource: 'assignmentGroup',
			operation: 'delete',
			params: { courseId, assignmentGroupId: groupId, options: { move_assignments_to: targetGroupId } },
		});
		expect(deleted.id).toBe(Number(groupId));
		expect((await canvas().request('GET', `/api/v1/courses/${courseId}/assignment_groups/${groupId}`)).status).toBe(404);
		const target = await groupFromCanvas(targetGroupId, '?include[]=assignments');
		expect(ids(target.assignments as Json[]).map(String).sort()).toEqual(Object.values(assignmentIds).sort());
	});

	it('delete: without a target the assignments of the group are deleted too', async () => {
		const [deleted] = await runOk({
			resource: 'assignmentGroup',
			operation: 'delete',
			params: { courseId, assignmentGroupId: targetGroupId },
		});
		expect(deleted.id).toBe(Number(targetGroupId));
		for (const id of Object.values(assignmentIds)) {
			const res = await canvas().request('GET', `/api/v1/courses/${courseId}/assignments/${id}`);
			expect((res.data as Json).workflow_state ?? res.status).toSatisfy((v: unknown) => v === 'deleted' || v === 404);
		}

		const again = await runNode({
			resource: 'assignmentGroup',
			operation: 'delete',
			params: { courseId, assignmentGroupId: targetGroupId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
