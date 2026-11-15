import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox } from './support/commsSandbox';
import { clientFor, commsSandbox, sandboxSubAccount } from './support/commsSandbox';

/**
 * Resource: conference.
 *
 * The shared test Canvas has the BigBlueButton plugin configured with a
 * made-up server (set up by the seed). Canvas only talks to that server when
 * somebody joins a conference, so conferences can be created and listed for
 * real; none can ever be "live" here.
 *
 * Conferences cannot be deleted through the API, so this file works in a course
 * of its own that is removed afterwards.
 */
describe('conference', () => {
	let sbx: Sandbox;
	let teacher: CanvasClient;
	let courseId = '';
	let groupId = '';
	const asTeacher = 'sbxTeacher';
	const cleanup: Array<() => Promise<unknown>> = [];

	const inCourse = async (client: CanvasClient = teacher): Promise<Json[]> => client.getAll<Json>(`/api/v1/courses/${courseId}/conferences`, 'conferences');

	beforeAll(async () => {
		sbx = await commsSandbox();
		teacher = clientFor(sbx.teacher);
		const course = await canvas().post<Json>(`/api/v1/accounts/${await sandboxSubAccount()}/courses`, {
			course: { name: unique('Battery conferences') },
			offer: true,
		});
		courseId = String(course.id);
		cleanup.push(() => canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`));
		const enroll = (userId: string, type: string): Promise<Json> =>
			canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false },
			});
		await enroll(sbx.teacher.id, 'TeacherEnrollment');
		await enroll(sbx.students[0].id, 'StudentEnrollment');
		await enroll(sbx.students[1].id, 'StudentEnrollment');
		const category = await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: 'Conference teams' });
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: 'Conference team' });
		groupId = String(group.id);
		await canvas().put(`/api/v1/groups/${groupId}`, { members: [sbx.students[0].id] });
	}, 900_000);

	afterAll(async () => {
		for (const undo of cleanup.reverse()) await undo();
	}, 300_000);

	it('create (course): title, type, description and duration are stored; every member is invited', async () => {
		const title = unique('Weekly Q&A "live" <b>ünï</b> 会議');
		const [created] = await runOk({
			resource: 'conference',
			operation: 'create',
			persona: asTeacher,
			params: {
				context: 'course',
				courseId,
				title,
				conferenceType: 'BigBlueButton',
				additionalFields: { description: 'Bring your questions — "all" of them & more 🎤', duration: 45 },
			},
		});
		expect(created).toMatchObject({ title, conference_type: 'BigBlueButton' });

		const [actual] = (await inCourse()).filter((c) => c.id === created.id);
		expect(actual).toMatchObject({
			title,
			conference_type: 'BigBlueButton',
			description: 'Bring your questions — "all" of them & more 🎤',
			duration: 45,
			context_type: 'Course',
			context_id: Number(courseId),
			started_at: null,
			ended_at: null,
		});
		// Everyone in the course is invited: the node's output says so, and each student finds it among their conferences.
		expect((created.user_ids as number[]).map(String).sort()).toEqual([sbx.teacher.id, sbx.students[0].id, sbx.students[1].id].sort());
		for (const student of sbx.students.slice(0, 2)) {
			const theirs = await clientFor(student).getAll<Json>('/api/v1/conferences', 'conferences');
			expect(theirs.map((c) => c.id)).toContain(created.id);
		}
	});

	it('create (group): a conference of a group', async () => {
		const title = unique('Team call');
		const [created] = await runOk({
			resource: 'conference',
			operation: 'create',
			persona: asTeacher,
			params: { context: 'group', groupId, title, conferenceType: 'BigBlueButton' },
		});
		const listed = await teacher.getAll<Json>(`/api/v1/groups/${groupId}/conferences`, 'conferences');
		expect(listed.find((c) => c.id === created.id)).toMatchObject({ title, context_type: 'Group', context_id: Number(groupId) });
	});

	it('getAll (course): one item per conference, following pages', async () => {
		for (let i = 1; i <= 12; i++) {
			await teacher.post(`/api/v1/courses/${courseId}/conferences`, {
				web_conference: { title: `Session ${String(i).padStart(2, '0')}`, conference_type: 'BigBlueButton' },
			});
		}
		const expected = await inCourse();
		expect(expected).toHaveLength(13);

		// Default page size 10: the second page is fetched, and the "conferences" envelope is removed.
		const byDefault = await runOk({ resource: 'conference', operation: 'getAll', persona: asTeacher, params: { context: 'course', courseId } });
		expect(byDefault.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(new Set(byDefault.map((c) => c.id)).size).toBe(13);
		expect(byDefault[0]).not.toHaveProperty('conferences');
		expect(byDefault[0]).toHaveProperty('title');

		const all = await runOk({
			resource: 'conference',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId, pagination: { returnAll: true } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));

		const twoPages = await runOk({
			resource: 'conference',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((c) => c.id)).toEqual(expected.slice(0, 8).map((c) => c.id));
	});

	it('getAll (group): the conferences of a group; none yields no items', async () => {
		const expected = await teacher.getAll<Json>(`/api/v1/groups/${groupId}/conferences`, 'conferences');
		expect(expected).toHaveLength(1);
		const listed = await runOk({ resource: 'conference', operation: 'getAll', persona: asTeacher, params: { context: 'group', groupId } });
		expect(listed.map((c) => c.id)).toEqual(expected.map((c) => c.id));

		const category = await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: 'Quiet teams' });
		const quiet = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: 'Quiet team' });
		const none = await runOk({ resource: 'conference', operation: 'getAll', persona: asTeacher, params: { context: 'group', groupId: String(quiet.id) } });
		expect(none).toEqual([]);
	});

	it('getAllForUser: the conferences the caller is invited to, across courses and groups', async () => {
		const student = clientFor(sbx.students[0]);
		const expected = await student.getAll<Json>('/api/v1/conferences', 'conferences');
		// The student is in this course (13 conferences) and in its group (1).
		expect(expected.length).toBeGreaterThanOrEqual(14);

		const all = await runOk({
			resource: 'conference',
			operation: 'getAllForUser',
			persona: 'sbxStudent1',
			params: { pagination: { returnAll: true } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
		expect(all.some((c) => c.context_type === 'Group' && c.context_id === Number(groupId))).toBe(true);
		expect(all.filter((c) => c.context_type === 'Course' && c.context_id === Number(courseId))).toHaveLength(13);

		const twoPages = await runOk({
			resource: 'conference',
			operation: 'getAllForUser',
			persona: 'sbxStudent1',
			params: { pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(twoPages.map((c) => c.id)).toEqual(expected.slice(0, 10).map((c) => c.id));

		// "All" is the same as leaving the option out.
		const explicitAll = await runOk({
			resource: 'conference',
			operation: 'getAllForUser',
			persona: 'sbxStudent1',
			params: { options: { state: '' }, pagination: { returnAll: true } },
		});
		expect(explicitAll.map((c) => c.id)).toEqual(expected.map((c) => c.id));

		// Nothing can be started without a real conference server, so nothing is live.
		const live = await runOk({
			resource: 'conference',
			operation: 'getAllForUser',
			persona: 'sbxStudent1',
			params: { options: { state: 'live' }, pagination: { returnAll: true } },
		});
		expect(live).toEqual(await student.getAll<Json>('/api/v1/conferences?state=live', 'conferences'));
		expect(live).toEqual([]);
	});

	it('errors: outsiders may not create conferences; unknown types and courses are refused', async () => {
		const before = (await inCourse()).length;
		// (Students of the course may: "Web conferences - create" is a default student permission in Canvas.)
		// Sandbox student 3 is not enrolled in this course.
		const outsider = await runNode({
			resource: 'conference',
			operation: 'create',
			persona: 'sbxStudent3',
			params: { context: 'course', courseId, title: 'Not allowed', conferenceType: 'BigBlueButton', errorHandling: { onError: 'continueWithError' } },
		});
		expect(outsider.success).toEqual([]);
		expect([401, 403]).toContain(outsider.error[0].errorCode);

		const unknownType = await runNode({
			resource: 'conference',
			operation: 'create',
			persona: asTeacher,
			params: { context: 'course', courseId, title: 'No such tool', conferenceType: 'NoSuchConferenceTool', errorHandling: { onError: 'continueWithError' } },
		});
		// A type that is not configured on the instance counts as no type at all.
		expect(unknownType.success).toEqual([]);
		expect(unknownType.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(unknownType.error[0].canvasErrors).toMatchObject({ conference_type: [{ attribute: 'conference_type', type: 'blank' }] });
		expect((await inCourse()).length).toBe(before);

		const noCourse = await runNode({
			resource: 'conference',
			operation: 'getAll',
			persona: asTeacher,
			params: { context: 'course', courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noCourse.success).toEqual([]);
		expect(noCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'conference', operation: 'getAll' });
	});
});
