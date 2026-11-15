import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox, WebSession } from './support/commsSandbox';
import { clientFor, commsSandbox, sandboxWebSession } from './support/commsSandbox';

/**
 * Resource: collaboration.
 *
 * The Canvas API only lists collaborations made with an external (LTI) tool and
 * has no endpoint to create one. The battery creates them the way the Canvas
 * web page does after a tool returns a document: as the signed-in sandbox
 * teacher, with a content item that points to a made-up URL. No external
 * service is contacted, and everything stays inside the private sandbox course.
 */
describe('collaboration', () => {
	let sbx: Sandbox;
	let teacher: CanvasClient;
	let session: WebSession;
	let groupId = '';
	const asTeacher = 'sbxTeacher';
	const cleanup: Array<() => Promise<unknown>> = [];

	/**
	 * Create an external-tool collaboration through the web routes and share it with the given users and groups.
	 * (A content item names collaborators by their LTI IDs, which only exist after an LTI launch; the update
	 * route of the collaborations page takes Canvas IDs.)
	 */
	async function createCollaboration(context: string, title: string, users: string[] = [], groups: string[] = []): Promise<string> {
		const res = await session.post(`/${context}/collaborations`, {
			form: {
				contentItems: JSON.stringify([
					{ title, text: `${title} (description)`, url: `https://collab.example.invalid/doc/${encodeURIComponent(title)}` },
				]),
			},
		});
		const collaboration = (res.data as Json | null)?.collaboration as Json | undefined;
		if (res.status >= 300 || !collaboration?.id) {
			throw new Error(`Could not create a collaboration in ${context}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
		}
		const id = String(collaboration.id);
		if (users.length > 0 || groups.length > 0) {
			const shared = await session.put(`/${context}/collaborations/${id}`, {
				form: [
					['collaboration[title]', title],
					...users.map((user): [string, string] => ['user[]', user]),
					...groups.map((group): [string, string] => ['group[]', group]),
				],
			});
			if (shared.status >= 300) {
				throw new Error(`Could not share collaboration ${id}: ${shared.status} ${JSON.stringify(shared.data).slice(0, 300)}`);
			}
		}
		return id;
	}

	beforeAll(async () => {
		sbx = await commsSandbox();
		teacher = clientFor(sbx.teacher);
		session = await sandboxWebSession(sbx, sbx.teacher);
		const category = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, { name: unique('Battery collaboration teams') });
		cleanup.push(() => canvas().request('DELETE', `/api/v1/group_categories/${String(category.id)}`));
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: 'Collaboration team' });
		groupId = String(group.id);
		await canvas().put(`/api/v1/groups/${groupId}`, { members: [sbx.students[50].id, sbx.students[51].id] });
	}, 900_000);

	afterAll(async () => {
		for (const undo of cleanup.reverse()) await undo();
	}, 300_000);

	it('getAll (course): lists the collaborations of the course, following pages', async () => {
		const titles = Array.from({ length: 12 }, (_, i) => unique(`Shared notes ${i + 1} "ünï" & <b>co</b>`));
		const made: string[] = [];
		for (const title of titles) made.push(await createCollaboration(`courses/${sbx.courseId}`, title));
		for (const id of made) cleanup.push(() => teacher.request('DELETE', `/api/v1/courses/${sbx.courseId}/collaborations/${id}`));

		const expected = await teacher.getAll<Json>(`/api/v1/courses/${sbx.courseId}/collaborations`);
		expect(expected.length).toBeGreaterThanOrEqual(12);

		const all = await runOk({
			resource: 'collaboration',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId, pagination: { returnAll: true } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
		for (const id of made) expect(all.map((c) => String(c.id))).toContain(id);
		const first = all.find((c) => String(c.id) === made[0]) as Json;
		expect(first).toMatchObject({
			title: titles[0],
			description: `${titles[0]} (description)`,
			type: 'ExternalToolCollaboration',
			context_type: 'Course',
			context_id: Number(sbx.courseId),
			user_id: Number(sbx.teacher.id),
		});

		// Default page size 10: the second page is fetched as well.
		const byDefault = await runOk({
			resource: 'collaboration',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId },
		});
		expect(byDefault.map((c) => c.id)).toEqual(expected.slice(0, 50).map((c) => c.id));

		const twoPages = await runOk({
			resource: 'collaboration',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((c) => c.id)).toEqual(expected.slice(0, 8).map((c) => c.id));
	});

	it('getAll: a student only sees the collaborations shared with them', async () => {
		const student = sbx.students[0];
		const shared = await createCollaboration(`courses/${sbx.courseId}`, unique('Shared with student 1'), [student.id]);
		cleanup.push(() => teacher.request('DELETE', `/api/v1/courses/${sbx.courseId}/collaborations/${shared}`));

		const expected = await clientFor(student).getAll<Json>(`/api/v1/courses/${sbx.courseId}/collaborations`);
		const seen = await runOk({
			resource: 'collaboration',
			operation: 'getAll',
			persona: 'sbxStudent1',
			params: { context: 'course', courseId: sbx.courseId, pagination: { returnAll: true } },
		});
		expect(seen.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(seen.map((c) => String(c.id))).toContain(shared);
		const forTeacher = await teacher.getAll<Json>(`/api/v1/courses/${sbx.courseId}/collaborations`);
		expect(seen.length).toBeLessThan(forTeacher.length);
	});

	it('getAll (group) + listMembers + delete: a collaboration of a group, shared with its members', async () => {
		const [userA, userB] = [sbx.students[50], sbx.students[51]];
		const id = await createCollaboration(`groups/${groupId}`, unique('Team document'), [userA.id, userB.id]);

		const inGroup = await runOk({
			resource: 'collaboration',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'group', groupId },
		});
		expect(inGroup.map((c) => String(c.id))).toEqual([id]);
		expect(inGroup[0]).toMatchObject({ context_type: 'Group', context_id: Number(groupId), type: 'ExternalToolCollaboration' });

		const expectedMembers = await teacher.getAll<Json>(`/api/v1/collaborations/${id}/members`);
		const members = await runOk({ resource: 'collaboration', operation: 'listMembers', persona: asTeacher, params: { collaborationId: id } });
		expect(members).toEqual(expectedMembers);
		const who = members.map((m) => `${String(m.type)}:${String(m.collaborator_id)}`).sort();
		expect(who).toEqual([`user:${sbx.teacher.id}`, `user:${userA.id}`, `user:${userB.id}`].sort());
		for (const member of members) {
			expect(member).not.toHaveProperty('collaborator_lti_id');
			expect(member).not.toHaveProperty('avatar_image_url');
		}

		// delete (group context)
		const deleted = await runOk({
			resource: 'collaboration',
			operation: 'delete',
			persona: asTeacher,
			params: { context: 'group', groupId, collaborationId: id },
		});
		expect(deleted).toHaveLength(1);
		expect(await teacher.getAll<Json>(`/api/v1/groups/${groupId}/collaborations`)).toEqual([]);
	});

	it('listMembers: a course collaboration shared with a user and a whole group; includes', async () => {
		// Only collaborations of a course can have groups (of that course) as members.
		const user = sbx.students[52];
		const id = await createCollaboration(`courses/${sbx.courseId}`, unique('Shared with a team'), [user.id], [groupId]);
		cleanup.push(() => teacher.request('DELETE', `/api/v1/courses/${sbx.courseId}/collaborations/${id}`));

		const members = await runOk({ resource: 'collaboration', operation: 'listMembers', persona: asTeacher, params: { collaborationId: id } });
		expect(members).toEqual(await teacher.getAll<Json>(`/api/v1/collaborations/${id}/members`));
		const who = members.map((m) => `${String(m.type)}:${String(m.collaborator_id)}`).sort();
		expect(who).toEqual([`group:${groupId}`, `user:${sbx.teacher.id}`, `user:${user.id}`].sort());
		expect(members.find((m) => m.type === 'group')).toMatchObject({ name: 'Collaboration team' });

		const rich = await runOk({
			resource: 'collaboration',
			operation: 'listMembers',
			persona: asTeacher,
			items: [{ id: Number(id) }],
			params: { collaborationId: '={{ $json.id }}', options: { include: ['avatar_image_url', 'collaborator_lti_id'] } },
		});
		expect(rich).toHaveLength(3);
		for (const member of rich) {
			expect(member.collaborator_lti_id).toBeTypeOf('string');
			expect(member).toHaveProperty('avatar_image_url');
		}
		for (const member of members) {
			expect(member).not.toHaveProperty('collaborator_lti_id');
			expect(member).not.toHaveProperty('avatar_image_url');
		}
	});

	it('listMembers: more members than a page', async () => {
		const everyone = sbx.students.map((s) => s.id);
		const id = await createCollaboration(`courses/${sbx.courseId}`, unique('Whole class document'), everyone);
		cleanup.push(() => teacher.request('DELETE', `/api/v1/courses/${sbx.courseId}/collaborations/${id}`));
		const expected = await teacher.getAll<Json>(`/api/v1/collaborations/${id}/members`);
		expect(expected).toHaveLength(everyone.length + 1);

		const all = await runOk({
			resource: 'collaboration',
			operation: 'listMembers',
			persona: asTeacher,
			params: { collaborationId: id, pagination: { returnAll: true } },
		});
		expect(all.map((m) => m.id)).toEqual(expected.map((m) => m.id));
		expect(new Set(all.map((m) => m.id)).size).toBe(all.length);

		const byDefault = await runOk({ resource: 'collaboration', operation: 'listMembers', persona: asTeacher, params: { collaborationId: id } });
		expect(byDefault.map((m) => m.id)).toEqual(expected.slice(0, 50).map((m) => m.id));

		const twoPages = await runOk({
			resource: 'collaboration',
			operation: 'listMembers',
			persona: asTeacher,
			params: { collaborationId: id, pagination: { perPage: 7, maxPages: 2 } },
		});
		expect(twoPages.map((m) => m.id)).toEqual(expected.slice(0, 14).map((m) => m.id));
	});

	it('listPotentialMembers: everyone in the course; the members of a group plus its course staff', async () => {
		const expected = await teacher.getAll<Json>(`/api/v1/courses/${sbx.courseId}/potential_collaborators`);
		expect(expected.length).toBeGreaterThanOrEqual(sbx.students.length);

		const all = await runOk({
			resource: 'collaboration',
			operation: 'listPotentialMembers',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(new Set(all.map((u) => u.id)).size).toBe(all.length);

		const byDefault = await runOk({
			resource: 'collaboration',
			operation: 'listPotentialMembers',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId },
		});
		expect(byDefault.map((u) => u.id)).toEqual(expected.slice(0, 50).map((u) => u.id));

		const expectedInGroup = await teacher.getAll<Json>(`/api/v1/groups/${groupId}/potential_collaborators`);
		const inGroup = await runOk({
			resource: 'collaboration',
			operation: 'listPotentialMembers',
			persona: asTeacher,
			params: { context: 'group', groupId, pagination: { returnAll: true } },
		});
		expect(inGroup.map((u) => u.id)).toEqual(expectedInGroup.map((u) => u.id));
		expect(inGroup.map((u) => String(u.id))).toContain(sbx.students[50].id);
		expect(inGroup.map((u) => String(u.id))).toContain(sbx.teacher.id);
		expect(inGroup.length).toBeLessThan(all.length);
	});

	it('delete (course): removes the collaboration; a student may not delete someone else\'s', async () => {
		const id = await createCollaboration(`courses/${sbx.courseId}`, unique('To be removed'), [sbx.students[0].id]);

		const refused = await runNode({
			resource: 'collaboration',
			operation: 'delete',
			persona: 'sbxStudent1',
			params: { context: 'course', courseId: sbx.courseId, collaborationId: id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect([401, 403]).toContain(refused.error[0].errorCode);
		expect((await teacher.getAll<Json>(`/api/v1/courses/${sbx.courseId}/collaborations`)).map((c) => String(c.id))).toContain(id);

		const deleted = await runOk({
			resource: 'collaboration',
			operation: 'delete',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId, collaborationId: id },
		});
		expect(deleted).toHaveLength(1);
		expect((await teacher.getAll<Json>(`/api/v1/courses/${sbx.courseId}/collaborations`)).map((c) => String(c.id))).not.toContain(id);
	});

	it('errors: unknown collaborations and courses', async () => {
		const noMembers = await runNode({
			resource: 'collaboration',
			operation: 'listMembers',
			persona: asTeacher,
			params: { collaborationId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noMembers.success).toEqual([]);
		expect(noMembers.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'collaboration', operation: 'listMembers' });

		const noDelete = await runNode({
			resource: 'collaboration',
			operation: 'delete',
			persona: asTeacher,
			params: { context: 'course', courseId: sbx.courseId, collaborationId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noDelete.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });

		const noCourse = await runNode({
			resource: 'collaboration',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAll' });
	});
});
