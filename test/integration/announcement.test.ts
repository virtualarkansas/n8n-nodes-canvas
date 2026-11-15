import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import { ANNOUNCEMENT_LIST_SIZE, deleteTopic, discussionCourse, discussionListCourse } from './support/discussions';
import type { DiscussionCourse, DiscussionListCourse } from './support/discussions';
import { FIXTURE_TIMEOUT } from './support/quizzes';

/**
 * Resource: announcement (announcements of courses and groups; in Canvas they are
 * discussion topics of a special kind). Every operation runs through a real n8n
 * instance against Canvas; writes are verified by reading back from Canvas directly.
 */
describe('announcement', () => {
	let ctx: DiscussionCourse;
	let list: DiscussionListCourse;
	let coursePath = '';
	let groupPath = '';
	let announcementId = '';
	const title = unique('Battery announcement Ünïcødé 公告 "quoted" & <b>tags</b> 📣');

	const course = (): Json => ({ contextType: 'course', courseId: ctx.courseId });
	const group = (): Json => ({ contextType: 'group', groupId: ctx.groupId });
	const readTopic = (id: string | number, query = '', base = coursePath): Promise<Json> =>
		canvas().get<Json>(`${base}/discussion_topics/${String(id)}${query}`);
	const announcementIds = async (base = coursePath): Promise<unknown[]> =>
		(await canvas().getAll<Json>(`${base}/discussion_topics?only_announcements=true`)).map((a) => a.id);

	beforeAll(async () => {
		[ctx, list] = await Promise.all([discussionCourse(), discussionListCourse()]);
		coursePath = `/api/v1/courses/${ctx.courseId}`;
		groupPath = `/api/v1/groups/${ctx.groupId}`;
	}, FIXTURE_TIMEOUT);

	it('create: every optional field of a course announcement reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'announcement',
			operation: 'create',
			params: {
				...course(),
				title,
				message: '<p>The lab moves to <strong>room 12</strong> — ¡no lo olvides! 日本語 🧪</p>',
				additionalFields: {
					allow_rating: true,
					delayed_post_at: '2031-01-01T00:00:00Z',
					lock_at: '2031-02-01T00:00:00Z',
					lock_comment: false,
					only_graders_can_rate: true,
					podcast_enabled: true,
					podcast_has_student_posts: true,
					published: true,
					require_initial_post: true,
					sort_by_rating: true,
					specific_sections: ` ${ctx.sectionIds[0]} , ${ctx.sectionIds[1]} `,
				},
			},
		});
		announcementId = String(created.id);
		expect(created.title).toBe(title);

		const actual = await readTopic(announcementId, '?include[]=sections');
		expect(actual).toMatchObject({
			title,
			allow_rating: true,
			delayed_post_at: '2031-01-01T00:00:00Z',
			lock_at: '2031-02-01T00:00:00Z',
			locked: false,
			only_graders_can_rate: true,
			podcast_has_student_posts: true,
			published: true,
			require_initial_post: true,
			sort_by_rating: true,
			is_section_specific: true,
			is_announcement: true,
		});
		expect(String(actual.message)).toContain('<strong>room 12</strong> — ¡no lo olvides! 日本語 🧪');
		expect(String(actual.podcast_url)).toContain('/feeds/topics/');
		expect((actual.sections as Json[]).map((s) => String(s.id)).sort()).toEqual([...ctx.sectionIds].sort());
		expect(await announcementIds()).toContain(Number(announcementId));
		// It is an announcement, not a discussion.
		expect((await canvas().getAll<Json>(`${coursePath}/discussion_topics`)).map((t) => t.id)).not.toContain(
			Number(announcementId),
		);
	});

	it('create: title and message only; comments can be disabled from the start', async () => {
		const [plain] = await runOk({
			resource: 'announcement',
			operation: 'create',
			persona: 'teacher',
			params: { ...course(), title: unique('Plain announcement'), message: 'No class on Friday.' },
		});
		expect(await readTopic(plain.id as number)).toMatchObject({
			message: 'No class on Friday.',
			published: true,
			locked: false,
			is_announcement: true,
			is_section_specific: false,
			delayed_post_at: null,
		});

		const [closed] = await runOk({
			resource: 'announcement',
			operation: 'create',
			params: {
				...course(),
				title: unique('No comments'),
				message: 'Read only.',
				additionalFields: { lock_comment: true },
			},
		});
		expect(await readTopic(closed.id as number)).toMatchObject({ locked: true, is_announcement: true });
		await deleteTopic(coursePath, plain.id as number);
		await deleteTopic(coursePath, closed.id as number);
	});

	it('create: one announcement per input item, with values from expressions', async () => {
		const result = await runNode({
			resource: 'announcement',
			operation: 'create',
			items: [
				{ course: Number(ctx.courseId), subject: unique('Batch A'), text: '<p>First</p>' },
				{ course: 'sis_course_id:BATTERY-DISCUSSIONS', subject: unique('Batch B'), text: 'Second' },
			],
			params: {
				contextType: 'course',
				courseId: '={{ $json.course }}',
				title: '={{ $json.subject }}',
				message: '={{ $json.text }}',
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 1]);
		const ids = await announcementIds();
		for (const created of result.success) {
			expect(ids).toContain(created.id);
			await deleteTopic(coursePath, created.id as number);
		}
	});

	it('get: returns the announcement; includes add the sections', async () => {
		const result = await runNode({
			resource: 'announcement',
			operation: 'get',
			items: [{ id: Number(announcementId) }],
			params: {
				...course(),
				announcementId: '={{ $json.id }}',
				options: { include: ['all_dates', 'overrides', 'sections', 'sections_user_count'] },
			},
		});
		expect(result.error).toEqual([]);
		const [announcement] = result.success;
		expect(announcement).toMatchObject({ id: Number(announcementId), title, is_announcement: true });
		expect((announcement.sections as Json[]).map((s) => String(s.id)).sort()).toEqual([...ctx.sectionIds].sort());
		expect((announcement.sections as Json[])[0]).toHaveProperty('user_count');

		const [plain] = await runOk({
			resource: 'announcement',
			operation: 'get',
			params: { ...course(), announcementId: ` ${announcementId} ` },
		});
		expect(plain).not.toHaveProperty('sections');
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'announcement',
			operation: 'update',
			params: {
				...course(),
				announcementId,
				updateFields: {
					allow_rating: false,
					delayed_post_at: '2032-01-01T00:00:00Z',
					lock_at: '2032-02-01T00:00:00Z',
					lock_comment: false,
					message: '<p>Second version</p>',
					only_graders_can_rate: false,
					podcast_enabled: false,
					podcast_has_student_posts: false,
					published: true,
					require_initial_post: false,
					sort_by_rating: false,
					specific_sections: 'all',
					title: renamed,
				},
			},
		});
		expect(updated.title).toBe(renamed);
		const actual = await readTopic(announcementId);
		expect(actual).toMatchObject({
			title: renamed,
			allow_rating: false,
			delayed_post_at: '2032-01-01T00:00:00Z',
			lock_at: '2032-02-01T00:00:00Z',
			locked: false,
			message: '<p>Second version</p>',
			only_graders_can_rate: false,
			podcast_has_student_posts: false,
			published: true,
			sort_by_rating: false,
			is_section_specific: false,
			is_announcement: true,
		});
		expect(actual.require_initial_post ?? false).toBe(false);
		expect(actual.podcast_url ?? null).toBeNull();

		// Clearing the dates posts the announcement right away and removes the lock date.
		await runOk({
			resource: 'announcement',
			operation: 'update',
			params: { ...course(), announcementId, updateFields: { delayed_post_at: '', lock_at: '' } },
		});
		expect(await readTopic(announcementId)).toMatchObject({ delayed_post_at: null, lock_at: null, locked: false });
	});

	it('update: Canvas reopens comments on every update that does not send "Lock Comment"', async () => {
		await runOk({
			resource: 'announcement',
			operation: 'update',
			params: { ...course(), announcementId, updateFields: { lock_comment: true } },
		});
		expect(await readTopic(announcementId)).toMatchObject({ locked: true, lock_at: null });

		// Real-world trap, stated in the field description: an unrelated update unlocks the comments again.
		await runOk({
			resource: 'announcement',
			operation: 'update',
			params: { ...course(), announcementId, updateFields: { title: `${title} (again)` } },
		});
		expect(await readTopic(announcementId)).toMatchObject({ title: `${title} (again)`, locked: false });

		await runOk({
			resource: 'announcement',
			operation: 'update',
			params: { ...course(), announcementId, updateFields: { title: `${title} (final)`, lock_comment: true } },
		});
		expect(await readTopic(announcementId)).toMatchObject({ title: `${title} (final)`, locked: true });
	});

	it('getAll: pages through more announcements than one page holds', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/announcements?context_codes[]=course_${list.courseId}`);
		expect(expected.length).toBeGreaterThanOrEqual(ANNOUNCEMENT_LIST_SIZE);

		// A bare course ID is accepted in place of the context code.
		const all = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: list.courseId, pagination: { returnAll: true } },
		});
		expect(all.map((a) => a.id)).toEqual(expected.map((a) => a.id));
		expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
		for (const announcement of all) expect(announcement.context_code).toBe(`course_${list.courseId}`);

		const defaults = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: `course_${list.courseId}` },
		});
		expect(defaults.map((a) => a.id)).toEqual(expected.map((a) => a.id));

		const pages = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: ` course_${list.courseId} `, pagination: { perPage: 4, maxPages: 3 } },
		});
		expect(pages.map((a) => a.id)).toEqual(expected.slice(0, 12).map((a) => a.id));
	});

	it('getAll: several courses, date window, latest only, active only and includes', async () => {
		const fresh = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
			title: unique('Posted today'),
			message: 'Today',
			is_announcement: true,
			specific_sections: ctx.sectionIds[0],
		});
		// Scheduled for 2031: only course staff see it, and only when the date window reaches that far.
		await canvas().put(`${coursePath}/discussion_topics/${announcementId}`, {
			delayed_post_at: '2031-01-01T00:00:00Z',
			lock_comment: true,
		});
		const codes = `course_${list.courseId}, ${ctx.courseId}`;
		const query = `context_codes[]=course_${list.courseId}&context_codes[]=course_${ctx.courseId}`;
		const ids = (items: Json[]): unknown[] => items.map((a) => a.id);

		const both = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: codes, pagination: { returnAll: true } },
		});
		expect(ids(both)).toEqual(ids(await canvas().getAll<Json>(`/api/v1/announcements?${query}`)));
		expect(new Set(both.map((a) => a.context_code))).toEqual(
			new Set([`course_${list.courseId}`, `course_${ctx.courseId}`]),
		);
		expect(ids(both)).toContain(fresh.id);
		// The announcement scheduled for 2031 is outside the default window (the last 14 days).
		expect(ids(both)).not.toContain(Number(announcementId));

		const latest = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: codes, options: { latest_only: true } },
		});
		expect(latest).toHaveLength(2);
		expect(ids(latest)).toContain(fresh.id);

		// A window in the past holds nothing; a wide window also holds the delayed announcement.
		const past = await runNode({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: codes, options: { start_date: '2001-01-01', end_date: '2001-12-31' } },
		});
		expect(past.ok).toBe(true);
		expect(past.success).toEqual([]);

		const wide = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: {
				contextCodes: ctx.courseId,
				options: { start_date: '2020-01-01T00:00:00Z', end_date: '2040-01-01T00:00:00Z', include: ['sections', 'sections_user_count'] },
				pagination: { returnAll: true },
			},
		});
		expect(ids(wide)).toEqual(
			ids(
				await canvas().getAll<Json>(
					`/api/v1/announcements?context_codes[]=course_${ctx.courseId}&start_date=2020-01-01T00:00:00Z&end_date=2040-01-01T00:00:00Z`,
				),
			),
		);
		expect(ids(wide)).toEqual(expect.arrayContaining([fresh.id, Number(announcementId)]));
		const withSections = wide.find((a) => a.id === fresh.id) as Json;
		expect((withSections.sections as Json[]).map((s) => String(s.id))).toEqual([ctx.sectionIds[0]]);
		expect((withSections.sections as Json[])[0]).toHaveProperty('user_count');

		// "Active only" hides what students cannot see yet; a student is limited to that anyway.
		const options = { start_date: '2020-01-01T00:00:00Z', end_date: '2040-01-01T00:00:00Z', active_only: true };
		const active = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: ctx.courseId, options, pagination: { returnAll: true } },
		});
		expect(ids(active)).not.toContain(Number(announcementId));
		const asStudent = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			persona: 'student2',
			params: {
				contextCodes: ctx.courseId,
				options: { start_date: options.start_date, end_date: options.end_date, available_after: '2020-01-01T00:00:00Z' },
				pagination: { returnAll: true },
			},
		});
		expect(ids(asStudent)).toEqual(
			ids(
				await new CanvasClient('student2').getAll<Json>(
					`/api/v1/announcements?context_codes[]=course_${ctx.courseId}&start_date=${options.start_date}&end_date=${options.end_date}&available_after=2020-01-01T00:00:00Z`,
				),
			),
		);
		expect(ids(asStudent)).not.toContain(Number(announcementId));
		// student2 is not in the section the fresh announcement was limited to.
		expect(ids(asStudent)).not.toContain(fresh.id);
		await deleteTopic(coursePath, fresh.id as number);
	});

	it('getAll: a course that does not exist, a group code, a course the user is not in', async () => {
		// Canvas skips context codes of courses it cannot find: no announcements, no error.
		const missing = await runNode({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: 'course_99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.ok).toBe(true);
		expect(missing.success).toEqual([]);
		expect(missing.error).toEqual([]);

		// Canvas only supports courses here.
		const groupCode = await runNode({
			resource: 'announcement',
			operation: 'getAll',
			params: { contextCodes: `group_${ctx.groupId}`, errorHandling: { onError: 'continueWithError' } },
		});
		expect(groupCode.success).toEqual([]);
		expect(groupCode.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'getAll' });
		expect(String(groupCode.error[0].errorMessage)).toContain('only `course` codes are supported');

		// Somebody who is not in the course gets nothing, without an error.
		const posted = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
			title: unique('For members only'),
			message: 'x',
			is_announcement: true,
		});
		// (For students Canvas caches which topics they may see, so a new announcement can take
		// a few minutes to show up for them here; course staff see it at once.)
		const member = await runOk({
			resource: 'announcement',
			operation: 'getAll',
			persona: 'teacher',
			params: { contextCodes: ctx.courseId, pagination: { returnAll: true } },
		});
		expect(member.map((a) => a.id)).toContain(posted.id);
		const outsider = await runNode({
			resource: 'announcement',
			operation: 'getAll',
			persona: 'ta',
			params: { contextCodes: ctx.courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(outsider.ok).toBe(true);
		expect(outsider.success).toEqual([]);
		expect(outsider.error).toEqual([]);
		await deleteTopic(coursePath, posted.id as number);
	});

	describe('in a group', () => {
		let groupAnnouncementId = '';
		const groupTitle = unique('Group announcement');

		it('create: a group member announces to the group', async () => {
			const [created] = await runOk({
				resource: 'announcement',
				operation: 'create',
				persona: 'student',
				params: {
					...group(),
					title: groupTitle,
					message: '<p>We meet at <em>four</em>.</p>',
					additionalFields: { allow_rating: true, lock_comment: true, podcast_enabled: true, sort_by_rating: true },
				},
			});
			groupAnnouncementId = String(created.id);
			expect(await announcementIds(groupPath)).toContain(Number(groupAnnouncementId));
			expect(await readTopic(groupAnnouncementId, '', groupPath)).toMatchObject({
				title: groupTitle,
				message: '<p>We meet at <em>four</em>.</p>',
				allow_rating: true,
				sort_by_rating: true,
				locked: true,
				is_announcement: true,
				user_name: 'Sam Student',
			});
		});

		it('get, update and delete work on the group', async () => {
			const [announcement] = await runOk({
				resource: 'announcement',
				operation: 'get',
				persona: 'student2',
				params: { ...group(), announcementId: groupAnnouncementId, options: { include: ['sections_user_count'] } },
			});
			expect(announcement).toMatchObject({ id: Number(groupAnnouncementId), title: groupTitle });

			await runOk({
				resource: 'announcement',
				operation: 'update',
				persona: 'student',
				params: {
					...group(),
					announcementId: groupAnnouncementId,
					updateFields: { title: `${groupTitle} (edited)`, message: 'We meet at five.', allow_rating: false, lock_comment: false },
				},
			});
			expect(await readTopic(groupAnnouncementId, '', groupPath)).toMatchObject({
				title: `${groupTitle} (edited)`,
				message: 'We meet at five.',
				allow_rating: false,
				locked: false,
			});

			const [deleted] = await runOk({
				resource: 'announcement',
				operation: 'delete',
				persona: 'student',
				params: { ...group(), announcementId: groupAnnouncementId },
			});
			expect(JSON.stringify(deleted)).toContain(`"id":${groupAnnouncementId}`);
			expect(await announcementIds(groupPath)).not.toContain(Number(groupAnnouncementId));
		});
	});

	it('create: a student "announcement" in a course silently becomes an ordinary discussion', async () => {
		// Canvas does not refuse: without the right to post announcements it creates a discussion topic.
		const [created] = await runOk({
			resource: 'announcement',
			operation: 'create',
			persona: 'student',
			params: { ...course(), title: unique('Student news'), message: 'Party at my place!' },
		});
		expect(await announcementIds()).not.toContain(created.id);
		expect((await canvas().getAll<Json>(`${coursePath}/discussion_topics`)).map((t) => t.id)).toContain(created.id);
		expect(await readTopic(created.id as number)).toMatchObject({ is_announcement: false, user_name: 'Sam Student' });
		await deleteTopic(coursePath, created.id as number);
	});

	it('delete: students may not delete an announcement; a teacher can; missing ones are reported', async () => {
		const refused = await runNode({
			resource: 'announcement',
			operation: 'delete',
			persona: 'student',
			params: { ...course(), announcementId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'announcement', operation: 'delete' });

		const result = await runNode({
			resource: 'announcement',
			operation: 'delete',
			persona: 'teacher',
			items: [{ id: announcementId }, { id: 99999999 }],
			params: { ...course(), announcementId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toHaveLength(1);
		expect(JSON.stringify(result.success[0])).toContain('"workflow_state":"deleted"');
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		expect(await announcementIds()).not.toContain(Number(announcementId));

		const gone = await runNode({
			resource: 'announcement',
			operation: 'get',
			params: { ...course(), announcementId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(gone.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });
	});
});
