import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox } from './support/commsSandbox';
import { commsSandbox, sandboxSubAccount, waitFor } from './support/commsSandbox';

/**
 * Resource: groupCategory (group sets). Categories with students are created
 * in the private sandbox course; listing categories is tested in a course of
 * this file's own, because other test files add and remove categories in the
 * sandbox course while this one runs.
 */
describe('groupCategory', () => {
	let sbx: Sandbox;
	let subAccountId = '';
	let ownCourseId = '';
	let categoryId = '';
	let sisCategoryId = '';
	const cleanup: Array<() => Promise<unknown>> = [];

	const read = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/group_categories/${id}`);
	const groupsOf = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/group_categories/${id}/groups`);
	const unassignedOf = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/group_categories/${id}/users?unassigned=true`);
	const dropLater = (id: string | number): void => {
		cleanup.push(() => canvas().request('DELETE', `/api/v1/group_categories/${id}`));
	};

	beforeAll(async () => {
		sbx = await commsSandbox();
		subAccountId = await sandboxSubAccount();
		const course = await canvas().post<Json>(`/api/v1/accounts/${subAccountId}/courses`, {
			course: { name: unique('Battery group categories') },
			offer: true,
		});
		ownCourseId = String(course.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/courses/${ownCourseId}?event=delete`));
		for (let i = 1; i <= 12; i++) {
			await canvas().post(`/api/v1/courses/${ownCourseId}/group_categories`, { name: `Listed category ${String(i).padStart(2, '0')}` });
		}
	}, 900_000);

	afterAll(async () => {
		for (const undo of cleanup.reverse()) await undo();
	}, 300_000);

	// ---------------------------------------------------------------- create

	it('create (course): every optional field', async () => {
		const name = unique('Project teams "A&B" <i>ünï</i> 組');
		sisCategoryId = unique('SBX-GC').replace(/\s/g, '-');
		const [created] = await runOk({
			resource: 'groupCategory',
			operation: 'create',
			params: {
				context: 'course',
				courseId: sbx.courseId,
				name,
				additionalFields: {
					auto_leader: 'random',
					create_group_count: 3,
					group_limit: 4,
					non_collaborative: false,
					self_signup: 'enabled',
					sis_group_category_id: sisCategoryId,
				},
			},
		});
		categoryId = String(created.id);
		dropLater(categoryId);

		expect(await read(categoryId)).toMatchObject({
			name,
			auto_leader: 'random',
			group_limit: 4,
			self_signup: 'enabled',
			sis_group_category_id: sisCategoryId,
			context_type: 'Course',
			course_id: Number(sbx.courseId),
		});
		const groups = await groupsOf(categoryId);
		expect(groups).toHaveLength(3);
		// The limit of the category applies to each of its groups.
		expect(groups.every((g) => g.max_membership === 4)).toBe(true);
		// With self sign-up nobody is assigned by Canvas.
		expect(groups.every((g) => g.members_count === 0)).toBe(true);
	});

	it('create (course): the other values of Self Signup and Auto Leader', async () => {
		const [restricted] = await runOk({
			resource: 'groupCategory',
			operation: 'create',
			params: { context: 'course', courseId: sbx.courseId, name: unique('Section teams'), additionalFields: { self_signup: 'restricted', auto_leader: 'first' } },
		});
		dropLater(String(restricted.id));
		expect(await read(String(restricted.id))).toMatchObject({ self_signup: 'restricted', auto_leader: 'first' });

		const [disabled] = await runOk({
			resource: 'groupCategory',
			operation: 'create',
			params: { context: 'course', courseId: sbx.courseId, name: unique('Teacher-made teams'), additionalFields: { self_signup: '' } },
		});
		dropLater(String(disabled.id));
		expect(await read(String(disabled.id))).toMatchObject({ self_signup: null, auto_leader: null, group_limit: null });
	});

	it('create (course): "Create Group Count" without self sign-up also distributes the students', async () => {
		const [created] = await runOk({
			resource: 'groupCategory',
			operation: 'create',
			params: { context: 'course', courseId: sbx.courseId, name: unique('Random teams'), additionalFields: { create_group_count: 5 } },
		});
		const id = String(created.id);
		dropLater(id);
		const groups = await groupsOf(id);
		expect(groups).toHaveLength(5);
		expect(groups.reduce((sum, g) => sum + Number(g.members_count), 0)).toBe(sbx.students.length);
		expect(await unassignedOf(id)).toEqual([]);
	});

	it('create (account): a category in the battery\'s sub-account; self sign-up is for courses only', async () => {
		const name = unique('Committees');
		const [created] = await runOk({
			resource: 'groupCategory',
			operation: 'create',
			params: { context: 'account', accountId: subAccountId, name },
		});
		dropLater(String(created.id));
		expect(await read(String(created.id))).toMatchObject({ name, context_type: 'Account', account_id: Number(subAccountId), self_signup: null });

		const refused = await runNode({
			resource: 'groupCategory',
			operation: 'create',
			params: {
				context: 'account',
				accountId: subAccountId,
				name: unique('Self-organised committees'),
				additionalFields: { self_signup: 'enabled' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'groupCategory', operation: 'create' });
	});

	// ---------------------------------------------------------------- get / getAll

	it('get: by ID and by SIS ID', async () => {
		const [byId] = await runOk({
			resource: 'groupCategory',
			operation: 'get',
			items: [{ id: Number(categoryId) }],
			params: { groupCategoryId: '={{ $json.id }}' },
		});
		expect(byId).toMatchObject({ id: Number(categoryId), sis_group_category_id: sisCategoryId, self_signup: 'enabled', group_limit: 4 });

		const [bySis] = await runOk({
			resource: 'groupCategory',
			operation: 'get',
			params: { groupCategoryId: `sis_group_category_id:${sisCategoryId}` },
		});
		expect(bySis.id).toBe(Number(categoryId));
	});

	it('getAll (course): pages are followed and capped as configured', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${ownCourseId}/group_categories`);
		expect(expected).toHaveLength(12);

		// The default page size is 10: two requests.
		const byDefault = await runOk({ resource: 'groupCategory', operation: 'getAll', params: { context: 'course', courseId: ownCourseId } });
		expect(byDefault.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(new Set(byDefault.map((c) => c.id)).size).toBe(12);

		const all = await runOk({
			resource: 'groupCategory',
			operation: 'getAll',
			params: { context: 'course', courseId: ownCourseId, pagination: { returnAll: true } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));

		const twoPages = await runOk({
			resource: 'groupCategory',
			operation: 'getAll',
			params: { context: 'course', courseId: ownCourseId, pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(twoPages.map((c) => c.id)).toEqual(expected.slice(0, 6).map((c) => c.id));

		const smallPages = await runOk({
			resource: 'groupCategory',
			operation: 'getAll',
			params: { context: 'course', courseId: ownCourseId, pagination: { perPage: 5, maxPages: 0 } },
		});
		expect(smallPages.map((c) => c.id)).toEqual(expected.map((c) => c.id));
	});

	it('getAll: Collaboration State, and the account context', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${ownCourseId}/group_categories`);
		for (const state of ['collaborative', 'all']) {
			const listed = await runOk({
				resource: 'groupCategory',
				operation: 'getAll',
				params: { context: 'course', courseId: ownCourseId, options: { collaboration_state: state }, pagination: { returnAll: true } },
			});
			expect(listed.map((c) => c.id), state).toEqual(expected.map((c) => c.id));
		}
		// No sets of differentiation tags exist in this course.
		const tags = await runOk({
			resource: 'groupCategory',
			operation: 'getAll',
			params: { context: 'course', courseId: ownCourseId, options: { collaboration_state: 'non_collaborative' }, pagination: { returnAll: true } },
		});
		expect(tags).toEqual([]);

		const inAccount = await runOk({
			resource: 'groupCategory',
			operation: 'getAll',
			params: { context: 'account', accountId: subAccountId, pagination: { returnAll: true } },
		});
		const expectedInAccount = await canvas().getAll<Json>(`/api/v1/accounts/${subAccountId}/group_categories`);
		// Other test files keep their own categories in this sub-account; all listed ones must be real.
		const known = new Set(expectedInAccount.map((c) => c.id));
		expect(inAccount.length).toBeGreaterThan(0);
		expect(inAccount.every((c) => c.context_type === 'Account' && c.account_id === Number(subAccountId))).toBe(true);
		expect(inAccount.filter((c) => String(c.name).startsWith('Committees')).every((c) => known.has(c.id))).toBe(true);
	});

	// ---------------------------------------------------------------- update

	it('update: Canvas clears the settings that are not sent again', async () => {
		expect(await read(categoryId)).toMatchObject({ self_signup: 'enabled', auto_leader: 'random', group_limit: 4 });

		// Sending everything keeps everything.
		const renamed = unique('Project teams (renamed)');
		const newSisId = `${sisCategoryId}-B`;
		const [updated] = await runOk({
			resource: 'groupCategory',
			operation: 'update',
			params: {
				groupCategoryId: categoryId,
				updateFields: { name: renamed, self_signup: 'restricted', auto_leader: 'first', group_limit: 6, sis_group_category_id: newSisId },
			},
		});
		expect(updated).toMatchObject({ id: Number(categoryId), name: renamed });
		expect(await read(categoryId)).toMatchObject({
			name: renamed,
			self_signup: 'restricted',
			auto_leader: 'first',
			group_limit: 6,
			sis_group_category_id: newSisId,
		});
		expect((await groupsOf(categoryId)).every((g) => g.max_membership === 6)).toBe(true);
		sisCategoryId = newSisId;

		// Renaming alone switches self sign-up, the automatic leader and the limit off.
		await runOk({
			resource: 'groupCategory',
			operation: 'update',
			params: { groupCategoryId: categoryId, updateFields: { name: `${renamed} again` } },
		});
		expect(await read(categoryId)).toMatchObject({
			name: `${renamed} again`,
			self_signup: null,
			auto_leader: null,
			group_limit: null,
			// The SIS ID is not affected.
			sis_group_category_id: newSisId,
		});
	});

	it('update: "Create Group Count" adds groups', async () => {
		const before = (await groupsOf(categoryId)).length;
		await runOk({
			resource: 'groupCategory',
			operation: 'update',
			params: { groupCategoryId: categoryId, updateFields: { self_signup: 'enabled', create_group_count: 2 } },
		});
		expect((await groupsOf(categoryId)).length).toBe(before + 2);
		expect((await read(categoryId)).self_signup).toBe('enabled');
	});

	// ---------------------------------------------------------------- listGroups

	it('listGroups: a category with more groups than a default run returns', async () => {
		const big = await canvas().post<Json>(`/api/v1/courses/${ownCourseId}/group_categories`, {
			name: unique('Fifty-five teams'),
			self_signup: 'enabled',
			create_group_count: 55,
		});
		const id = String(big.id);
		const expected = await groupsOf(id);
		expect(expected).toHaveLength(55);

		const all = await runOk({ resource: 'groupCategory', operation: 'listGroups', params: { groupCategoryId: id, pagination: { returnAll: true } } });
		expect(all.map((g) => g.id)).toEqual(expected.map((g) => g.id));
		expect(new Set(all.map((g) => g.id)).size).toBe(55);

		const byDefault = await runOk({ resource: 'groupCategory', operation: 'listGroups', params: { groupCategoryId: id } });
		expect(byDefault.map((g) => g.id)).toEqual(expected.slice(0, 50).map((g) => g.id));

		const twoPages = await runOk({
			resource: 'groupCategory',
			operation: 'listGroups',
			params: { groupCategoryId: id, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((g) => g.id)).toEqual(expected.slice(0, 8).map((g) => g.id));

		const none = await runOk({ resource: 'groupCategory', operation: 'listGroups', params: { groupCategoryId: String((await canvas().getAll<Json>(`/api/v1/courses/${ownCourseId}/group_categories`))[0].id) } });
		expect(none).toEqual([]);
	});

	// ---------------------------------------------------------------- listUsers / assignUnassignedMembers

	it('listUsers + assignUnassignedMembers (sync): unassigned students are spread over the groups', async () => {
		const category = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, { name: unique('To be filled') });
		const id = String(category.id);
		dropLater(id);
		for (const name of ['Team 1', 'Team 2', 'Team 3']) await canvas().post(`/api/v1/group_categories/${id}/groups`, { name });

		// Everybody is unassigned at first: more users than a default run returns.
		const expectedUnassigned = await unassignedOf(id);
		expect(expectedUnassigned).toHaveLength(sbx.students.length);
		const unassigned = await runOk({
			resource: 'groupCategory',
			operation: 'listUsers',
			params: { groupCategoryId: id, options: { unassigned: true }, pagination: { returnAll: true } },
		});
		expect(unassigned.map((u) => u.id)).toEqual(expectedUnassigned.map((u) => u.id));
		expect(new Set(unassigned.map((u) => u.id)).size).toBe(unassigned.length);
		const byDefault = await runOk({
			resource: 'groupCategory',
			operation: 'listUsers',
			params: { groupCategoryId: id, options: { unassigned: true } },
		});
		expect(byDefault.map((u) => u.id)).toEqual(expectedUnassigned.slice(0, 50).map((u) => u.id));
		const twoPages = await runOk({
			resource: 'groupCategory',
			operation: 'listUsers',
			params: { groupCategoryId: id, options: { unassigned: true }, pagination: { perPage: 9, maxPages: 2 } },
		});
		expect(twoPages.map((u) => u.id)).toEqual(expectedUnassigned.slice(0, 18).map((u) => u.id));
		// Without "Unassigned" Canvas lists every student of the course, in a group or not.
		const everyStudent = await canvas().getAll<Json>(`/api/v1/group_categories/${id}/users`);
		const withoutFilter = await runOk({
			resource: 'groupCategory',
			operation: 'listUsers',
			params: { groupCategoryId: id, options: { unassigned: false }, pagination: { returnAll: true } },
		});
		expect(withoutFilter.map((u) => u.id)).toEqual(everyStudent.map((u) => u.id));
		expect(withoutFilter).toHaveLength(sbx.students.length);

		const searched = await runOk({
			resource: 'groupCategory',
			operation: 'listUsers',
			params: { groupCategoryId: id, options: { unassigned: true, search_term: 'Ñandú' }, pagination: { returnAll: true } },
		});
		const expectedSearch = expectedUnassigned.filter((u) => String(u.name).includes('Ñandú'));
		expect(expectedSearch.length).toBeGreaterThan(5);
		expect(searched.map((u) => u.id).sort()).toEqual(expectedSearch.map((u) => u.id).sort());

		// Synchronous: one item per group with the members it received.
		const assigned = await runOk({
			resource: 'groupCategory',
			operation: 'assignUnassignedMembers',
			params: { groupCategoryId: id, options: { sync: true } },
		});
		expect(assigned).toHaveLength(3);
		const received = assigned.flatMap((g) => (g.new_members as Json[]).map((m) => m.user_id));
		expect(received.sort()).toEqual(sbx.students.map((s) => Number(s.id)).sort());
		const groups = await groupsOf(id);
		expect(groups.map((g) => g.members_count).sort()).toEqual([20, 20, 20]);
		expect(assigned.map((g) => g.id).sort()).toEqual(groups.map((g) => g.id).sort());

		expect(await unassignedOf(id)).toEqual([]);
		const nobodyLeft = await runOk({
			resource: 'groupCategory',
			operation: 'listUsers',
			params: { groupCategoryId: id, options: { unassigned: true }, pagination: { returnAll: true } },
		});
		expect(nobodyLeft).toEqual([]);
	});

	it('assignUnassignedMembers (default): Canvas works in the background and reports progress', async () => {
		const category = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, { name: unique('Filled in the background') });
		const id = String(category.id);
		dropLater(id);
		for (const name of ['Team 1', 'Team 2']) await canvas().post(`/api/v1/group_categories/${id}/groups`, { name });

		const [progress] = await runOk({ resource: 'groupCategory', operation: 'assignUnassignedMembers', params: { groupCategoryId: id } });
		expect(progress).toMatchObject({ context_type: 'GroupCategory', context_id: Number(id), tag: 'assign_unassigned_members' });
		await waitFor(
			async () => (await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`)).workflow_state === 'completed',
			240_000,
			'the background assignment to complete',
		);
		expect(await unassignedOf(id)).toEqual([]);
		expect((await groupsOf(id)).map((g) => g.members_count).sort()).toEqual([30, 30]);
	});

	// ---------------------------------------------------------------- delete

	it('delete: removes the category and its groups', async () => {
		const groupIds = (await groupsOf(categoryId)).map((g) => String(g.id));
		expect(groupIds.length).toBeGreaterThan(0);
		const deleted = await runOk({ resource: 'groupCategory', operation: 'delete', params: { groupCategoryId: categoryId } });
		expect(deleted).toHaveLength(1);
		expect((await canvas().request('GET', `/api/v1/group_categories/${categoryId}`)).status).toBe(404);
		for (const groupId of groupIds) {
			expect((await canvas().request('GET', `/api/v1/groups/${groupId}`)).status).toBe(404);
		}
	});

	// ---------------------------------------------------------------- errors

	it('errors: validation, missing rights, unknown IDs', async () => {
		// A limit of one member is not a group.
		const tooSmall = await runNode({
			resource: 'groupCategory',
			operation: 'create',
			items: [{ limit: 1 }],
			params: {
				context: 'course',
				courseId: ownCourseId,
				name: unique('Solo'),
				additionalFields: { self_signup: 'enabled', group_limit: '={{ $json.limit }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(tooSmall.success).toEqual([]);
		expect(tooSmall.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(tooSmall.error[0].canvasErrors).toHaveProperty('group_limit');

		// Names are unique within a course.
		const duplicate = await runNode({
			resource: 'groupCategory',
			operation: 'create',
			params: { context: 'course', courseId: ownCourseId, name: 'Listed category 01', errorHandling: { onError: 'continueWithError' } },
		});
		expect(duplicate.success).toEqual([]);
		expect(duplicate.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(duplicate.error[0].canvasErrors).toHaveProperty('name');

		const student = await runNode({
			resource: 'groupCategory',
			operation: 'create',
			persona: 'sbxStudent1',
			params: { context: 'course', courseId: sbx.courseId, name: unique('Not allowed'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(student.success).toEqual([]);
		expect([401, 403]).toContain(student.error[0].errorCode);

		const missing = await runNode({
			resource: 'groupCategory',
			operation: 'get',
			items: [{ id: 99999999 }, { id: Number((await canvas().getAll<Json>(`/api/v1/courses/${ownCourseId}/group_categories`))[0].id) }],
			params: { groupCategoryId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toHaveLength(1);
		expect(missing.rawSuccess[0].pairedItem).toEqual({ item: 1 });
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: 99999999 } });
	});
});
