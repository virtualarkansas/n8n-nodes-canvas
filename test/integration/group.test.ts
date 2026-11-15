import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox, SandboxUser } from './support/commsSandbox';
import { clientFor, commsSandbox, sandboxSubAccount } from './support/commsSandbox';

/**
 * Resource: group, including group memberships. Course groups live in group
 * categories this file creates in the private sandbox course; account groups
 * in the battery's own sub-account.
 */

/** A 1x1 PNG, uploaded to a group to serve as its avatar. */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

async function uploadGroupImage(client: CanvasClient, groupId: string): Promise<string> {
	const slot = await client.post<Json>(`/api/v1/groups/${groupId}/files`, {
		name: 'avatar.png',
		size: PNG.length,
		content_type: 'image/png',
		on_duplicate: 'rename',
	});
	const form = new FormData();
	for (const [key, value] of Object.entries(slot.upload_params as Json)) form.append(key, String(value));
	form.append('file', new Blob([PNG], { type: 'image/png' }), 'avatar.png');
	const uploaded = await fetch(String(slot.upload_url), { method: 'POST', body: form, redirect: 'manual' });
	const confirmed = await client.request('GET', String(uploaded.headers.get('location')));
	return String((confirmed.data as Json).id);
}

describe('group', () => {
	let sbx: Sandbox;
	let students: SandboxUser[];
	let categoryId = '';
	/** A course no other test file touches, holding 55 groups: listing its groups is free of races. */
	let pagingCourseId = '';
	let groupId = '';
	/** A group holding every sandbox student, in a category of its own (created by the listUsers test). */
	let wholeClassId = '';
	let wholeClassCategoryId = '';
	let sisGroupId = '';
	const asTeacher = 'sbxTeacher';
	const cleanup: Array<() => Promise<unknown>> = [];

	const read = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/groups/${id}`);
	const memberIds = async (id: string): Promise<string[]> =>
		(await canvas().getAll<Json>(`/api/v1/groups/${id}/users`)).map((u) => String(u.id)).sort();
	const memberships = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/groups/${id}/memberships`);

	beforeAll(async () => {
		sbx = await commsSandbox();
		students = sbx.students;
		const category = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, { name: unique('Battery groups') });
		categoryId = String(category.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/group_categories/${categoryId}`));

		const course = await canvas().post<Json>(`/api/v1/accounts/${await sandboxSubAccount()}/courses`, {
			course: { name: unique('Battery many groups') },
			offer: true,
		});
		pagingCourseId = String(course.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/courses/${pagingCourseId}?event=delete`));
		// 55 groups in one go (self sign-up keeps Canvas from trying to distribute students).
		await canvas().post(`/api/v1/courses/${pagingCourseId}/group_categories`, {
			name: 'Fifty-five teams',
			self_signup: 'enabled',
			create_group_count: 55,
		});
	}, 900_000);

	afterAll(async () => {
		for (const undo of cleanup.reverse()) await undo();
	}, 300_000);

	// ---------------------------------------------------------------- create

	it('create: a course group with every optional field', async () => {
		const name = unique('Lab team "A" & <b>co</b> ünï 班');
		sisGroupId = unique('SBX-GROUP').replace(/\s/g, '-');
		const [created] = await runOk({
			resource: 'group',
			operation: 'create',
			params: {
				name,
				groupCategoryId: ` ${categoryId} `,
				additionalFields: {
					description: 'Meets on Wednesdays — "bring goggles" 🥽',
					is_public: true,
					join_level: 'parent_context_auto_join',
					max_membership: 7,
					sis_group_id: sisGroupId,
					storage_quota_mb: 77,
				},
			},
		});
		groupId = String(created.id);
		expect(created).toMatchObject({ name, group_category_id: Number(categoryId) });

		expect(await read(groupId)).toMatchObject({
			name,
			description: 'Meets on Wednesdays — "bring goggles" 🥽',
			join_level: 'parent_context_auto_join',
			max_membership: 7,
			sis_group_id: sisGroupId,
			storage_quota_mb: 77,
			context_type: 'Course',
			course_id: Number(sbx.courseId),
			group_category_id: Number(categoryId),
			// Canvas applies "Is Public" to community groups only.
			is_public: false,
		});
	});

	it('create: each join level; a teacher may create groups, too', async () => {
		for (const joinLevel of ['invitation_only', 'parent_context_request']) {
			const [created] = await runOk({
				resource: 'group',
				operation: 'create',
				persona: asTeacher,
				params: { name: unique(`Team ${joinLevel}`), groupCategoryId: categoryId, additionalFields: { join_level: joinLevel } },
			});
			expect((await read(String(created.id))).join_level).toBe(joinLevel);
		}
		// Without options Canvas' defaults apply.
		const [plain] = await runOk({
			resource: 'group',
			operation: 'create',
			persona: asTeacher,
			params: { name: unique('Team plain'), groupCategoryId: categoryId },
		});
		expect(await read(String(plain.id))).toMatchObject({ join_level: 'invitation_only', max_membership: null, description: null });
	});

	it('create: without a category Canvas makes a community group, where "Is Public" does apply', async () => {
		const name = unique('Battery community');
		const [created] = await runOk({
			resource: 'group',
			operation: 'create',
			params: { name, additionalFields: { is_public: true, join_level: 'parent_context_request', description: 'Open to all' } },
		});
		const id = String(created.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/groups/${id}`));
		expect(await read(id)).toMatchObject({
			name,
			is_public: true,
			join_level: 'parent_context_request',
			context_type: 'Account',
			description: 'Open to all',
		});
	});

	// ---------------------------------------------------------------- get

	it('get: by ID, by SIS ID, with includes', async () => {
		const [plain] = await runOk({ resource: 'group', operation: 'get', items: [{ id: Number(groupId) }], params: { groupId: '={{ $json.id }}' } });
		expect(plain).toMatchObject({ id: Number(groupId), sis_group_id: sisGroupId });
		expect(plain).not.toHaveProperty('permissions');
		expect(plain).not.toHaveProperty('tabs');

		const [bySis] = await runOk({ resource: 'group', operation: 'get', params: { groupId: `sis_group_id:${sisGroupId}` } });
		expect(bySis.id).toBe(Number(groupId));

		const [rich] = await runOk({
			resource: 'group',
			operation: 'get',
			params: { groupId, options: { include: ['permissions', 'tabs'] } },
		});
		expect(rich.permissions).toBeTypeOf('object');
		expect((rich.tabs as Json[]).length).toBeGreaterThan(0);
	});

	// ---------------------------------------------------------------- memberships

	it('addMember: adds users one input item each; adding twice returns the same membership', async () => {
		const result = await runOk({
			resource: 'group',
			operation: 'addMember',
			items: students.slice(0, 4).map((s) => ({ user: Number(s.id) })),
			params: { groupId, userId: '={{ $json.user }}' },
		});
		expect(result.map((m) => String(m.user_id))).toEqual(students.slice(0, 4).map((s) => s.id));
		expect(result.every((m) => m.workflow_state === 'accepted' && m.group_id === Number(groupId))).toBe(true);
		expect(await memberIds(groupId)).toEqual(students.slice(0, 4).map((s) => s.id).sort());

		const [again] = await runOk({ resource: 'group', operation: 'addMember', params: { groupId, userId: students[0].id } });
		expect(again.id).toBe(result[0].id);
		expect(await memberIds(groupId)).toHaveLength(4);
	});

	it('addMember: within one category a user is moved, not added a second time', async () => {
		const student = students[30];
		const [first, second] = await Promise.all(
			['Moving team 1', 'Moving team 2'].map((name) =>
				canvas().post<Json>(`/api/v1/group_categories/${categoryId}/groups`, { name: unique(name) }),
			),
		);
		await runOk({ resource: 'group', operation: 'addMember', params: { groupId: String(first.id), userId: student.id } });
		expect(await memberIds(String(first.id))).toEqual([student.id]);

		await runOk({ resource: 'group', operation: 'addMember', params: { groupId: String(second.id), userId: student.id } });
		expect(await memberIds(String(second.id))).toEqual([student.id]);
		// Canvas took the student out of the first group without saying so.
		expect(await memberIds(String(first.id))).toEqual([]);
	});

	it('getMembership: by user ID and by membership ID', async () => {
		const all = await memberships(groupId);
		const mine = all.find((m) => String(m.user_id) === students[1].id) as Json;

		const [byUser] = await runOk({
			resource: 'group',
			operation: 'getMembership',
			params: { groupId, membershipBy: 'user', userId: students[1].id },
		});
		expect(byUser).toMatchObject({ id: mine.id, user_id: Number(students[1].id), workflow_state: 'accepted', moderator: false });

		const [byMembership] = await runOk({
			resource: 'group',
			operation: 'getMembership',
			params: { groupId, membershipBy: 'membership', membershipId: String(mine.id) },
		});
		expect(byMembership).toEqual(byUser);

		// "self": the membership of the caller.
		const [own] = await runOk({
			resource: 'group',
			operation: 'getMembership',
			persona: 'sbxStudent1',
			params: { groupId, userId: 'self' },
		});
		expect(own.user_id).toBe(Number(students[0].id));
	});

	it('updateMembership: moderator rights on and off, by user and by membership ID', async () => {
		const mine = (await memberships(groupId)).find((m) => String(m.user_id) === students[1].id) as Json;
		const [on] = await runOk({
			resource: 'group',
			operation: 'updateMembership',
			params: { groupId, userId: students[1].id, updateFields: { moderator: true } },
		});
		expect(on).toMatchObject({ id: mine.id, moderator: true });
		expect((await memberships(groupId)).find((m) => m.id === mine.id)?.moderator).toBe(true);

		const [off] = await runOk({
			resource: 'group',
			operation: 'updateMembership',
			params: { groupId, membershipBy: 'membership', membershipId: String(mine.id), updateFields: { moderator: false } },
		});
		expect(off.moderator).toBe(false);
		expect((await memberships(groupId)).find((m) => m.id === mine.id)?.moderator).toBe(false);
	});

	it('listMemberships: all memberships, and the state filter', async () => {
		const expected = await memberships(groupId);
		const all = await runOk({ resource: 'group', operation: 'listMemberships', params: { groupId } });
		expect(all).toEqual(expected);
		expect(all).toHaveLength(4);

		const accepted = await runOk({
			resource: 'group',
			operation: 'listMemberships',
			params: { groupId, options: { filter_states: ['accepted'] } },
		});
		expect(accepted.map((m) => m.id)).toEqual(expected.map((m) => m.id));

		// In course groups Canvas accepts every membership at once, so nothing is ever pending.
		const pending = await runOk({
			resource: 'group',
			operation: 'listMemberships',
			params: { groupId, options: { filter_states: ['invited', 'requested'] } },
		});
		expect(pending).toEqual([]);
	});

	it('updateMembership "Accept" + listMemberships states: a join request to a community group', async () => {
		// Only community groups keep requests pending; this one exists for the duration of the test.
		const community = await canvas().post<Json>('/api/v1/groups', {
			name: unique('Battery community (requests)'),
			join_level: 'parent_context_request',
			is_public: true,
		});
		const id = String(community.id);
		try {
			const request = await clientFor(students[0]).post<Json>(`/api/v1/groups/${id}/memberships`, { user_id: 'self' });
			expect(request.workflow_state).toBe('requested');

			const requested = await runOk({
				resource: 'group',
				operation: 'listMemberships',
				params: { groupId: id, options: { filter_states: ['requested'] } },
			});
			expect(requested.map((m) => m.id)).toEqual([request.id]);
			const acceptedBefore = await runOk({
				resource: 'group',
				operation: 'listMemberships',
				params: { groupId: id, options: { filter_states: ['accepted'] } },
			});
			expect(acceptedBefore.map((m) => m.id)).not.toContain(request.id);

			// Leaving "Accept" off must not accept anything.
			await runOk({
				resource: 'group',
				operation: 'updateMembership',
				params: { groupId: id, userId: students[0].id, updateFields: { accept: false, moderator: false } },
			});
			expect((await memberships(id)).find((m) => m.id === request.id)?.workflow_state).toBe('requested');

			const [accepted] = await runOk({
				resource: 'group',
				operation: 'updateMembership',
				params: { groupId: id, userId: students[0].id, updateFields: { accept: true } },
			});
			expect(accepted).toMatchObject({ id: request.id, workflow_state: 'accepted' });
			expect((await memberships(id)).find((m) => m.id === request.id)?.workflow_state).toBe('accepted');
		} finally {
			await canvas().request('DELETE', `/api/v1/groups/${id}`);
		}
	});

	it('removeMember: by user ID and by membership ID', async () => {
		const before = await memberships(groupId);
		const third = before.find((m) => String(m.user_id) === students[2].id) as Json;

		const [byUser] = await runOk({ resource: 'group', operation: 'removeMember', params: { groupId, userId: students[3].id } });
		expect(byUser).toEqual({ ok: true });
		const [byMembership] = await runOk({
			resource: 'group',
			operation: 'removeMember',
			params: { groupId, membershipBy: 'membership', membershipId: String(third.id) },
		});
		expect(byMembership).toEqual({ ok: true });
		expect(await memberIds(groupId)).toEqual([students[0].id, students[1].id].sort());
	});

	it('removeMembers: several users in one request; unknown IDs are simply not removed', async () => {
		await canvas().put(`/api/v1/groups/${groupId}`, { members: students.slice(0, 5).map((s) => s.id) });
		expect(await memberIds(groupId)).toHaveLength(5);

		const [result] = await runOk({
			resource: 'group',
			operation: 'removeMembers',
			params: { groupId, userIds: ` ${students[2].id}, ${students[3].id} ,99999999,` },
		});
		expect((result.deleted_user_ids as number[]).map(String).sort()).toEqual([students[2].id, students[3].id].sort());
		expect(result.unauthorized_user_ids).toEqual([]);
		expect(await memberIds(groupId)).toEqual([students[0].id, students[1].id, students[4].id].sort());
	});

	// ---------------------------------------------------------------- update

	it('update: every optional field', async () => {
		const before = await read(groupId);
		const avatarId = await uploadGroupImage(canvas(), groupId);
		const name = unique('Lab team A (renamed) 🧪');
		const newSisId = `${sisGroupId}-B`;
		const [updated] = await runOk({
			resource: 'group',
			operation: 'update',
			params: {
				groupId,
				updateFields: {
					avatar_id: avatarId,
					description: 'Now meets on Fridays',
					is_public: true,
					join_level: 'invitation_only',
					max_membership: 9,
					name,
					override_sis_stickiness: true,
					sis_group_id: newSisId,
					storage_quota_mb: 123,
				},
			},
		});
		expect(updated).toMatchObject({ id: Number(groupId), name });

		const actual = await read(groupId);
		expect(actual).toMatchObject({
			name,
			description: 'Now meets on Fridays',
			join_level: 'invitation_only',
			max_membership: 9,
			sis_group_id: newSisId,
			storage_quota_mb: 123,
			// still not applied to a course group
			is_public: false,
		});
		expect(before.avatar_url).toBeNull();
		expect(String(actual.avatar_url)).toMatch(/^https?:\/\//);
		// Fields that were not part of the update keep their members.
		expect(await memberIds(groupId)).toHaveLength(3);
		sisGroupId = newSisId;
	});

	it('update: with "Override SIS Stickiness" off, a name that was set in Canvas is left alone', async () => {
		// The name of a group is "sticky" once it was set in Canvas instead of by a SIS import.
		const sisId = unique('SBX-STICKY').replace(/\s/g, '-');
		const sticky = await canvas().post<Json>(`/api/v1/group_categories/${categoryId}/groups`, {
			name: 'Sticky name',
			description: 'Before',
			sis_group_id: sisId,
		});
		const id = String(sticky.id);

		// Off: the name stays, the fields that are not sticky are updated.
		const [kept] = await runOk({
			resource: 'group',
			operation: 'update',
			params: { groupId: id, updateFields: { name: 'Must not be applied', description: 'After', override_sis_stickiness: false } },
		});
		expect(kept).toMatchObject({ id: Number(id), name: 'Sticky name' });
		expect(await read(id)).toMatchObject({ name: 'Sticky name', description: 'After', sis_group_id: sisId });

		// On, and when the option is not set at all: the name is overwritten.
		await runOk({
			resource: 'group',
			operation: 'update',
			params: { groupId: id, updateFields: { name: 'Applied with the override', override_sis_stickiness: true } },
		});
		expect((await read(id)).name).toBe('Applied with the override');
		await runOk({ resource: 'group', operation: 'update', params: { groupId: id, updateFields: { name: 'Applied by default' } } });
		expect((await read(id)).name).toBe('Applied by default');

		// The option is an argument of the request, sent in the query string: in a JSON body
		// Canvas reads `false` as "not given" and overwrites the name anyway.
		const debug = await runNode({
			resource: 'group',
			operation: 'update',
			params: { debugMode: true, groupId: id, updateFields: { name: 'Shown only', override_sis_stickiness: false } },
		});
		expect(debug.debug[0]).toMatchObject({ method: 'PUT', queryString: { override_sis_stickiness: false }, body: { name: 'Shown only' } });
		expect(String(debug.debug[0].url)).toContain(`/api/v1/groups/${id}?override_sis_stickiness=false`);
		expect((await read(id)).name).toBe('Applied by default');
	});

	it('update: "Members" replaces the membership of the group', async () => {
		// Student 3 has a credential and is not put into groups by any other test file.
		const wanted = [students[2], students[5], students[6]];
		const [updated] = await runOk({
			resource: 'group',
			operation: 'update',
			params: { groupId, updateFields: { members: ` ${wanted.map((s) => s.id).join(' , ')} ,` } },
		});
		expect(updated.members_count).toBe(3);
		expect(await memberIds(groupId)).toEqual(wanted.map((s) => s.id).sort());

		// An empty field does not empty the group.
		await runOk({ resource: 'group', operation: 'update', params: { groupId, updateFields: { members: ' ', description: 'Unchanged members' } } });
		expect(await memberIds(groupId)).toEqual(wanted.map((s) => s.id).sort());
		expect((await read(groupId)).description).toBe('Unchanged members');
	});

	// ---------------------------------------------------------------- invite

	it('invite: known users are added by their e-mail address', async () => {
		const invitees = [students[10], students[11]];
		const result = await runOk({
			resource: 'group',
			operation: 'invite',
			persona: asTeacher,
			params: { groupId, invitees: ` ${invitees[0].login} , ${invitees[1].login},` },
		});
		expect(result.map((m) => String(m.user_id)).sort()).toEqual(invitees.map((s) => s.id).sort());
		expect(result.every((m) => m.group_id === Number(groupId))).toBe(true);
		for (const invitee of invitees) expect(await memberIds(groupId)).toContain(invitee.id);
	});

	// ---------------------------------------------------------------- listUsers

	it('listUsers: a group with more members than a page', async () => {
		// Its own category: within one category a user can only be in one group, and the lab team keeps its members.
		const ownCategory = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, { name: unique('Battery whole class') });
		wholeClassCategoryId = String(ownCategory.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/group_categories/${wholeClassCategoryId}`));
		const big = await canvas().post<Json>(`/api/v1/group_categories/${wholeClassCategoryId}/groups`, { name: unique('Whole class') });
		const id = String(big.id);
		wholeClassId = id;
		await canvas().put(`/api/v1/groups/${id}`, { members: students.map((s) => s.id) });
		const expected = await canvas().getAll<Json>(`/api/v1/groups/${id}/users`);
		expect(expected).toHaveLength(students.length);

		const all = await runOk({ resource: 'group', operation: 'listUsers', params: { groupId: id, pagination: { returnAll: true } } });
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(new Set(all.map((u) => u.id)).size).toBe(all.length);

		const byDefault = await runOk({ resource: 'group', operation: 'listUsers', params: { groupId: id } });
		expect(byDefault.map((u) => u.id)).toEqual(expected.slice(0, 50).map((u) => u.id));

		const threePages = await runOk({ resource: 'group', operation: 'listUsers', params: { groupId: id, pagination: { perPage: 7, maxPages: 3 } } });
		expect(threePages.map((u) => u.id)).toEqual(expected.slice(0, 21).map((u) => u.id));

		// Search: a quarter of the sandbox students are called "... O'Brien".
		const term = "O'Brien";
		const found = await runOk({
			resource: 'group',
			operation: 'listUsers',
			params: { groupId: id, options: { search_term: term, include: ['avatar_url'] }, pagination: { returnAll: true } },
		});
		const expectedFound = expected.filter((u) => String(u.name).includes(term));
		expect(expectedFound.length).toBeGreaterThan(5);
		expect(found.map((u) => u.id).sort()).toEqual(expectedFound.map((u) => u.id).sort());
		for (const user of found) expect(user).toHaveProperty('avatar_url');
		for (const user of byDefault) expect(user).not.toHaveProperty('avatar_url');

		const nobody = await runOk({ resource: 'group', operation: 'listUsers', params: { groupId: id, options: { search_term: 'zzzznobody' } } });
		expect(nobody).toEqual([]);
	});

	it('listUsers: "Exclude Inactive" leaves out members whose enrollment was deactivated', async () => {
		// A course of its own: other tests count on every sandbox student being active.
		const subAccount = await sandboxSubAccount();
		const course = await canvas().post<Json>(`/api/v1/accounts/${subAccount}/courses`, {
			course: { name: unique('Battery inactive member') },
			offer: true,
		});
		const courseId = String(course.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`));
		const users: Json[] = [];
		const enrollments: Json[] = [];
		for (const label of ['active', 'inactive']) {
			const login = `${unique(`sbx.${label}`).replace(/\s/g, '.')}@example.edu`;
			const user = await canvas().post<Json>(`/api/v1/accounts/${subAccount}/users`, {
				user: { name: `Battery ${label} member`, skip_registration: true },
				pseudonym: { unique_id: login, send_confirmation: false },
			});
			users.push(user);
			cleanup.push(() => canvas().request('DELETE', `/api/v1/accounts/${subAccount}/users/${String(user.id)}`));
			enrollments.push(
				await canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
					enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
				}),
			);
		}
		const category = await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: 'Teams' });
		const small = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: 'With an inactive member' });
		const id = String(small.id);
		await canvas().put(`/api/v1/groups/${id}`, { members: users.map((u) => u.id) });
		await canvas().delete(`/api/v1/courses/${courseId}/enrollments/${String(enrollments[1].id)}?task=deactivate`);

		const everyone = await runOk({ resource: 'group', operation: 'listUsers', params: { groupId: id, options: { exclude_inactive: false } } });
		expect(everyone.map((u) => u.id).sort()).toEqual(users.map((u) => u.id).sort());
		const active = await runOk({ resource: 'group', operation: 'listUsers', params: { groupId: id, options: { exclude_inactive: true } } });
		expect(active.map((u) => u.id)).toEqual([users[0].id]);
	});

	// ---------------------------------------------------------------- getAll

	it('getAll (course): more groups than a page', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${pagingCourseId}/groups`);
		expect(expected).toHaveLength(55);

		const all = await runOk({
			resource: 'group',
			operation: 'getAll',
			params: { context: 'course', courseId: pagingCourseId, pagination: { returnAll: true } },
		});
		expect(all.map((g) => g.id)).toEqual(expected.map((g) => g.id));
		expect(new Set(all.map((g) => g.id)).size).toBe(all.length);

		const byDefault = await runOk({ resource: 'group', operation: 'getAll', params: { context: 'course', courseId: pagingCourseId } });
		expect(byDefault.map((g) => g.id)).toEqual(expected.slice(0, 50).map((g) => g.id));

		const twoPages = await runOk({
			resource: 'group',
			operation: 'getAll',
			params: { context: 'course', courseId: pagingCourseId, pagination: { perPage: 6, maxPages: 2 } },
		});
		expect(twoPages.map((g) => g.id)).toEqual(expected.slice(0, 12).map((g) => g.id));
	});

	it('getAll (course): Include and Collaboration State', async () => {
		const [withTabs] = await runOk({
			resource: 'group',
			operation: 'getAll',
			params: { context: 'course', courseId: pagingCourseId, options: { include: ['tabs'] }, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect((withTabs.tabs as Json[]).length).toBeGreaterThan(0);
		const [withoutTabs] = await runOk({
			resource: 'group',
			operation: 'getAll',
			params: { context: 'course', courseId: pagingCourseId, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect(withoutTabs).not.toHaveProperty('tabs');

		// The course has no differentiation tags: "collaborative" and "all" agree, "non_collaborative" is empty.
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${pagingCourseId}/groups`);
		for (const state of ['collaborative', 'all']) {
			const listed = await runOk({
				resource: 'group',
				operation: 'getAll',
				params: { context: 'course', courseId: pagingCourseId, options: { collaboration_state: state }, pagination: { returnAll: true } },
			});
			expect(listed.map((g) => g.id), state).toEqual(expected.map((g) => g.id));
		}
		const tags = await runOk({
			resource: 'group',
			operation: 'getAll',
			params: { context: 'course', courseId: pagingCourseId, options: { collaboration_state: 'non_collaborative' }, pagination: { returnAll: true } },
		});
		expect(tags).toEqual([]);
	});

	it('getAll (course): "Only Own Groups" limits the list to the caller\'s groups', async () => {
		// Other test files create and delete groups in the sandbox course, so only this file's category is compared.
		const inMyCategory = (groups: Json[]): unknown[] =>
			groups.filter((g) => [categoryId, wholeClassCategoryId].includes(String(g.group_category_id))).map((g) => g.id);
		const own = await runOk({
			resource: 'group',
			operation: 'getAll',
			persona: 'sbxStudent3',
			params: { context: 'course', courseId: sbx.courseId, options: { only_own_groups: true }, pagination: { returnAll: true } },
		});
		// Student 3 is in the lab team and in the group that holds the whole class.
		expect([...inMyCategory(own)].sort()).toEqual([Number(groupId), Number(wholeClassId)].sort());
		const everything = await runOk({
			resource: 'group',
			operation: 'getAll',
			persona: 'sbxStudent3',
			params: { context: 'course', courseId: sbx.courseId, options: { only_own_groups: false }, pagination: { returnAll: true } },
		});
		expect(inMyCategory(everything).length).toBeGreaterThan(2);
		expect(inMyCategory(everything)).toContain(Number(groupId));
	});

	it('getAll (account): the groups of an account', async () => {
		const subAccount = await sandboxSubAccount();
		const category = await canvas().post<Json>(`/api/v1/accounts/${subAccount}/group_categories`, { name: unique('Battery committees') });
		cleanup.push(() => canvas().request('DELETE', `/api/v1/group_categories/${String(category.id)}`));
		const made: Json[] = [];
		for (const name of ['Committee one', 'Committee two']) {
			made.push(await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: unique(name) }));
		}
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${subAccount}/groups`);
		const listed = await runOk({
			resource: 'group',
			operation: 'getAll',
			params: { context: 'account', accountId: subAccount, pagination: { returnAll: true } },
		});
		expect(listed.map((g) => g.id)).toEqual(expected.map((g) => g.id));
		for (const group of made) expect(listed.map((g) => g.id)).toContain(group.id);
		expect(listed.every((g) => g.context_type === 'Account')).toBe(true);
	});

	it('getAll (self): the groups of the caller, optionally of one kind of context', async () => {
		// Other test files put this student into groups of their own categories while this runs,
		// so the comparison is limited to the categories of this file.
		const ofThisFile = (groups: Json[]): unknown[] =>
			groups.filter((g) => [categoryId, wholeClassCategoryId].includes(String(g.group_category_id))).map((g) => g.id);
		const expected = await clientFor(students[2]).getAll<Json>('/api/v1/users/self/groups');
		const mine = await runOk({
			resource: 'group',
			operation: 'getAll',
			persona: 'sbxStudent3',
			params: { context: 'self', pagination: { returnAll: true } },
		});
		expect(ofThisFile(mine)).toEqual(ofThisFile(expected));
		expect([...ofThisFile(mine)].sort()).toEqual([Number(groupId), Number(wholeClassId)].sort());

		const inCourses = await runOk({
			resource: 'group',
			operation: 'getAll',
			persona: 'sbxStudent3',
			params: { context: 'self', options: { context_type: 'Course', include: ['tabs'] }, pagination: { returnAll: true } },
		});
		expect(inCourses.map((g) => String(g.id))).toContain(groupId);
		expect(inCourses.every((g) => g.context_type === 'Course')).toBe(true);
		expect(inCourses[0]).toHaveProperty('tabs');

		const inAccounts = await runOk({
			resource: 'group',
			operation: 'getAll',
			persona: 'sbxStudent3',
			params: { context: 'self', options: { context_type: 'Account' }, pagination: { returnAll: true } },
		});
		expect(inAccounts.every((g) => g.context_type === 'Account')).toBe(true);
		expect(inAccounts.map((g) => String(g.id))).not.toContain(groupId);
	});

	// ---------------------------------------------------------------- delete

	it('delete: removes the group and its memberships', async () => {
		const [deleted] = await runOk({ resource: 'group', operation: 'delete', params: { groupId } });
		expect(deleted).toMatchObject({ id: Number(groupId) });
		expect((await canvas().request('GET', `/api/v1/groups/${groupId}`)).status).toBe(404);
		const left = await canvas().getAll<Json>(`/api/v1/group_categories/${categoryId}/groups`);
		expect(left.map((g) => String(g.id))).not.toContain(groupId);
	});

	// ---------------------------------------------------------------- errors

	it('errors: unknown groups and users, missing rights, empty lists', async () => {
		const missing = await runNode({
			resource: 'group',
			operation: 'get',
			items: [{ id: 99999999 }],
			params: { groupId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'group', operation: 'get' });

		const [other] = await canvas().getAll<Json>(`/api/v1/group_categories/${categoryId}/groups`);
		const otherId = String(other.id);

		const noSuchUser = await runNode({
			resource: 'group',
			operation: 'addMember',
			params: { groupId: otherId, userId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noSuchUser.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'addMember' });

		const notAMember = await runNode({
			resource: 'group',
			operation: 'removeMember',
			params: { groupId: otherId, userId: students[40].id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(notAMember.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'removeMember' });

		// A student may neither create groups in a teacher's category nor put others into them.
		const forbiddenCreate = await runNode({
			resource: 'group',
			operation: 'create',
			persona: 'sbxStudent1',
			params: { name: unique('Not allowed'), groupCategoryId: categoryId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbiddenCreate.success).toEqual([]);
		expect([401, 403]).toContain(forbiddenCreate.error[0].errorCode);
		const forbiddenAdd = await runNode({
			resource: 'group',
			operation: 'addMember',
			persona: 'sbxStudent1',
			params: { groupId: otherId, userId: students[41].id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbiddenAdd.success).toEqual([]);
		expect([401, 403]).toContain(forbiddenAdd.error[0].errorCode);
		expect(await memberIds(otherId)).not.toContain(students[41].id);

		const emptyList = await runNode({
			resource: 'group',
			operation: 'removeMembers',
			params: { groupId: otherId, userIds: ' , ', errorHandling: { onError: 'continueWithError' } },
		});
		expect(emptyList.success).toEqual([]);
		expect(emptyList.error[0]).toMatchObject({ errorCode: 0, operation: 'removeMembers' });
		expect(String(emptyList.error[0].errorMessage)).toContain('at least one user ID');
	});
});
