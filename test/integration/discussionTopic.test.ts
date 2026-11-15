import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import {
	deleteTopic,
	discussionCourse,
	discussionListCourse,
	ENTRY_MARATHON_SIZE,
	REPLY_MARATHON_SIZE,
	SEARCH_WORD,
	TOPIC_LIST_SIZE,
} from './support/discussions';
import type { DiscussionCourse, DiscussionListCourse } from './support/discussions';
import { FIXTURE_TIMEOUT } from './support/quizzes';

/**
 * Resource: discussionTopic (topics, their entries and replies, read state,
 * rating and subscription; in courses and in groups). Every operation runs
 * through a real n8n instance against Canvas; writes are verified by reading
 * back from Canvas directly.
 */
describe('discussionTopic', () => {
	let ctx: DiscussionCourse;
	let list: DiscussionListCourse;
	let coursePath = '';
	let groupPath = '';
	let topicId = '';
	const title = unique('Battery topic Ünïcødé 讨论 "quoted" & <b>tags</b> 💬');

	const course = (): Json => ({ contextType: 'course', courseId: ctx.courseId });
	const group = (): Json => ({ contextType: 'group', groupId: ctx.groupId });
	const readTopic = (id: string | number, query = '', base = coursePath): Promise<Json> =>
		canvas().get<Json>(`${base}/discussion_topics/${String(id)}${query}`);

	beforeAll(async () => {
		[ctx, list] = await Promise.all([discussionCourse(), discussionListCourse()]);
		coursePath = `/api/v1/courses/${ctx.courseId}`;
		groupPath = `/api/v1/groups/${ctx.groupId}`;
	}, FIXTURE_TIMEOUT);

	// ------------------------------------------------------------------
	// Topics in a course
	// ------------------------------------------------------------------

	it('create: every optional field of an ungraded course topic reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			params: {
				...course(),
				title,
				additionalFields: {
					allow_rating: true,
					delayed_post_at: '2031-01-01T00:00:00Z',
					discussion_type: 'threaded',
					expanded: true,
					expanded_locked: true,
					lock_at: '2031-02-01T00:00:00Z',
					message: '<p>Discuss <strong>chapter 3</strong> — ¿qué opinas? 日本語 🙂</p>',
					only_graders_can_rate: true,
					pinned: true,
					podcast_enabled: true,
					podcast_has_student_posts: true,
					published: true,
					require_initial_post: true,
					sort_by_rating: true,
					sort_order: 'asc',
					sort_order_locked: true,
					specific_sections: `${ctx.sectionIds[0]}, ${ctx.sectionIds[1]}`,
					todo_date: '2031-01-15T00:00:00Z',
				},
			},
		});
		topicId = String(created.id);
		expect(created.title).toBe(title);

		const actual = await readTopic(topicId, '?include[]=sections');
		expect(actual).toMatchObject({
			title,
			allow_rating: true,
			delayed_post_at: '2031-01-01T00:00:00Z',
			discussion_type: 'threaded',
			expanded: true,
			expanded_locked: true,
			lock_at: '2031-02-01T00:00:00Z',
			only_graders_can_rate: true,
			pinned: true,
			podcast_has_student_posts: true,
			published: true,
			require_initial_post: true,
			sort_by_rating: true,
			sort_order: 'asc',
			sort_order_locked: true,
			is_section_specific: true,
			todo_date: '2031-01-15T00:00:00Z',
		});
		expect(String(actual.message)).toContain('<strong>chapter 3</strong> — ¿qué opinas? 日本語 🙂');
		expect(String(actual.podcast_url)).toContain('/feeds/topics/');
		expect((actual.sections as Json[]).map((s) => String(s.id)).sort()).toEqual([...ctx.sectionIds].sort());
	});

	it('create: a graded discussion gets an assignment', async () => {
		const [created] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			params: {
				...course(),
				title: unique('Graded discussion'),
				additionalFields: {
					assignment: JSON.stringify({ points_possible: 15, due_at: '2031-03-01T00:00:00Z', grading_type: 'points' }),
					discussion_type: 'not_threaded',
					published: true,
				},
			},
		});
		const actual = await readTopic(created.id as number);
		expect(actual).toMatchObject({ discussion_type: 'not_threaded', published: true });
		expect(actual.assignment_id).toBeTypeOf('number');
		const assignment = await canvas().get<Json>(`${coursePath}/assignments/${String(actual.assignment_id)}`);
		expect(assignment).toMatchObject({
			points_possible: 15,
			due_at: '2031-03-01T00:00:00Z',
			submission_types: ['discussion_topic'],
			name: created.title,
		});

		// The assignment may also arrive as an object from an expression; set_assignment: false removes it.
		const result = await runNode({
			resource: 'discussionTopic',
			operation: 'update',
			items: [{ settings: { set_assignment: false } }],
			params: { ...course(), topicId: created.id, updateFields: { assignment: '={{ $json.settings }}' } },
		});
		expect(result.error).toEqual([]);
		expect((await readTopic(created.id as number)).assignment_id).toBeNull();
		await deleteTopic(coursePath, created.id as number);
	});

	it('create: a group discussion gets a child topic per group of the group set', async () => {
		const [created] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			params: {
				...course(),
				title: unique('Per-group discussion'),
				additionalFields: { group_category_id: ctx.groupCategoryId, message: 'Talk within your group.' },
			},
		});
		const actual = await readTopic(created.id as number);
		expect(actual.group_category_id).toBe(Number(ctx.groupCategoryId));
		expect((actual.group_topic_children as Json[]).map((c) => String(c.group_id))).toEqual([ctx.groupId]);
		await deleteTopic(coursePath, created.id as number);
	});

	it('create: an announcement with comments disabled; a discussion closed for comments, placed after another', async () => {
		const [announcement] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			params: {
				...course(),
				title: unique('Announcement through the topic resource'),
				additionalFields: { is_announcement: true, lock_comment: true, message: 'No comments please.' },
			},
		});
		const announcements = await canvas().getAll<Json>(`${coursePath}/discussion_topics?only_announcements=true`);
		expect(announcements.find((a) => a.id === announcement.id)).toMatchObject({ locked: true, published: true });
		const discussions = await canvas().getAll<Json>(`${coursePath}/discussion_topics`);
		expect(discussions.map((d) => d.id)).not.toContain(announcement.id);
		await deleteTopic(coursePath, announcement.id as number);

		const [closed] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			params: {
				...course(),
				title: unique('Closed and pinned second'),
				additionalFields: { locked: true, pinned: true, position_after: topicId, published: true },
			},
		});
		expect(await readTopic(closed.id as number)).toMatchObject({ locked: true, pinned: true });
		// Canvas lists pinned topics last-position-first; "after" means right below the other topic there.
		const pinned = (await canvas().getAll<Json>(`${coursePath}/discussion_topics?scope=pinned`)).map((t) => t.id);
		expect(pinned.indexOf(closed.id)).toBe(pinned.indexOf(Number(topicId)) + 1);
		await deleteTopic(coursePath, closed.id as number);
	});

	it('create: without "Published", a teacher\'s topic is a draft and a student\'s topic is published', async () => {
		const [draft] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			persona: 'teacher',
			params: { ...course(), title: unique('Teacher draft') },
		});
		expect(await readTopic(draft.id as number)).toMatchObject({ published: false, discussion_type: 'threaded' });

		const [byStudent] = await runOk({
			resource: 'discussionTopic',
			operation: 'create',
			persona: 'student',
			params: { ...course(), title: unique('Student question'), additionalFields: { message: 'Can someone explain osmosis?' } },
		});
		expect(await readTopic(byStudent.id as number)).toMatchObject({
			published: true,
			user_name: 'Sam Student',
		});

		// Students cannot create drafts.
		const refused = await runNode({
			resource: 'discussionTopic',
			operation: 'create',
			persona: 'student',
			params: {
				...course(),
				title: unique('Student draft'),
				additionalFields: { published: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(JSON.stringify(refused.error[0].canvasErrors)).toContain('published');
		await deleteTopic(coursePath, draft.id as number);
		await deleteTopic(coursePath, byStudent.id as number);
	});

	it('get: returns the topic; includes add sections and dates; numeric IDs and SIS course IDs work', async () => {
		const result = await runNode({
			resource: 'discussionTopic',
			operation: 'get',
			items: [{ topic: Number(topicId) }],
			params: {
				contextType: 'course',
				courseId: 'sis_course_id:BATTERY-DISCUSSIONS',
				topicId: '={{ $json.topic }}',
				options: { include: ['all_dates', 'overrides', 'sections', 'sections_user_count'] },
			},
		});
		expect(result.error).toEqual([]);
		const [topic] = result.success;
		expect(topic).toMatchObject({ id: Number(topicId), title, pinned: true });
		expect((topic.sections as Json[]).map((s) => String(s.id)).sort()).toEqual([...ctx.sectionIds].sort());
		expect((topic.sections as Json[])[0]).toHaveProperty('user_count');

		const [plain] = await runOk({ resource: 'discussionTopic', operation: 'get', params: { ...course(), topicId: ` ${topicId} ` } });
		expect(plain.id).toBe(Number(topicId));
		expect(plain).not.toHaveProperty('sections');
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'discussionTopic',
			operation: 'update',
			params: {
				...course(),
				topicId,
				updateFields: {
					allow_rating: false,
					delayed_post_at: '',
					discussion_type: 'side_comment',
					expanded: false,
					expanded_locked: false,
					lock_at: '2032-02-01T00:00:00Z',
					message: '<p>Second version</p>',
					only_graders_can_rate: false,
					pinned: false,
					podcast_enabled: false,
					podcast_has_student_posts: false,
					published: true,
					require_initial_post: false,
					sort_by_rating: false,
					sort_order: 'desc',
					sort_order_locked: false,
					specific_sections: 'all',
					title: renamed,
					todo_date: '2032-01-15T00:00:00Z',
				},
			},
		});
		expect(updated.title).toBe(renamed);
		const actual = await readTopic(topicId);
		expect(actual).toMatchObject({
			title: renamed,
			allow_rating: false,
			delayed_post_at: null,
			discussion_type: 'side_comment',
			expanded: false,
			expanded_locked: false,
			lock_at: '2032-02-01T00:00:00Z',
			message: '<p>Second version</p>',
			only_graders_can_rate: false,
			pinned: false,
			podcast_has_student_posts: false,
			published: true,
			sort_by_rating: false,
			sort_order: 'desc',
			sort_order_locked: false,
			is_section_specific: false,
			todo_date: '2032-01-15T00:00:00Z',
		});
		expect(actual.require_initial_post ?? false).toBe(false);
		expect(actual.podcast_url ?? null).toBeNull();
	});

	it('update: closing and reopening for comments; turning into a group discussion; unpublishing', async () => {
		await runOk({
			resource: 'discussionTopic',
			operation: 'update',
			params: {
				...course(),
				topicId,
				updateFields: { locked: true, group_category_id: ctx.groupCategoryId, published: false },
			},
		});
		let actual = await readTopic(topicId);
		expect(actual).toMatchObject({ locked: true, published: false, group_category_id: Number(ctx.groupCategoryId) });

		// Clearing the lock date reopens the topic; Canvas ignores "Locked" in a request that changes the lock date.
		await runOk({
			resource: 'discussionTopic',
			operation: 'update',
			params: { ...course(), topicId, updateFields: { lock_at: '', locked: true, group_category_id: '' } },
		});
		actual = await readTopic(topicId);
		expect(actual).toMatchObject({ lock_at: null, locked: false, group_category_id: null });

		await runOk({
			resource: 'discussionTopic',
			operation: 'update',
			params: { ...course(), topicId, updateFields: { locked: false, published: true, pinned: true } },
		});
		actual = await readTopic(topicId);
		expect(actual).toMatchObject({ locked: false, published: true, pinned: true });
	});

	it('update: an invalid value is reported with Canvas\' validation message', async () => {
		const result = await runNode({
			resource: 'discussionTopic',
			operation: 'update',
			items: [{ order: 'sideways' }],
			params: {
				...course(),
				topicId,
				updateFields: { sort_order: '={{ $json.order }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'discussionTopic',
			operation: 'update',
		});
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('sort_order');
	});

	it('duplicate: copies the topic as an unpublished draft', async () => {
		const [copy] = await runOk({ resource: 'discussionTopic', operation: 'duplicate', params: { ...course(), topicId } });
		expect(copy.id).not.toBe(Number(topicId));
		const actual = await readTopic(copy.id as number);
		expect(String(actual.title)).toContain(title);
		expect(actual).toMatchObject({ message: '<p>Second version</p>', published: false });
		await deleteTopic(coursePath, copy.id as number);
	});

	it('reorderPinned: pinned topics take the given order', async () => {
		const extra: number[] = [];
		for (const name of ['Pinned B', 'Pinned C']) {
			const topic = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
				title: unique(name),
				pinned: true,
				published: true,
			});
			extra.push(topic.id as number);
		}
		// Pinned topics by their position (the list endpoint itself returns them last-position-first).
		const pinnedIds = async (): Promise<number[]> =>
			(await canvas().getAll<Json>(`${coursePath}/discussion_topics?scope=pinned`))
				.sort((a, b) => Number(a.position) - Number(b.position))
				.map((t) => t.id as number);
		const before = await pinnedIds();
		expect(before).toEqual(expect.arrayContaining([Number(topicId), ...extra]));
		const wanted = [...before].reverse();

		const [result] = await runOk({
			resource: 'discussionTopic',
			operation: 'reorderPinned',
			params: { ...course(), order: wanted.join(' , ') },
		});
		expect(result).toMatchObject({ reorder: true, order: wanted.map(String) });
		expect(await pinnedIds()).toEqual(wanted);

		// From an expression the list may arrive as an array of numbers.
		const back = await runNode({
			resource: 'discussionTopic',
			operation: 'reorderPinned',
			items: [{ ids: before }],
			params: { ...course(), order: '={{ $json.ids }}' },
		});
		expect(back.error).toEqual([]);
		expect(await pinnedIds()).toEqual(before);

		// A topic that is not pinned (or not in this course) is refused.
		const wrong = await runNode({
			resource: 'discussionTopic',
			operation: 'reorderPinned',
			params: { ...course(), order: `${before[0]},99999999`, errorHandling: { onError: 'continueWithError' } },
		});
		expect(wrong.success).toEqual([]);
		expect(wrong.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'reorderPinned' });
		for (const id of extra) await deleteTopic(coursePath, id);
	});

	// ------------------------------------------------------------------
	// Lists
	// ------------------------------------------------------------------

	it('getAll: pages through a course with more topics than one page holds', async () => {
		const path = `/api/v1/courses/${list.courseId}/discussion_topics`;
		const expected = await canvas().getAll<Json>(path);
		expect(expected.length).toBeGreaterThanOrEqual(TOPIC_LIST_SIZE);
		const params = { contextType: 'course', courseId: list.courseId };

		const defaults = await runOk({ resource: 'discussionTopic', operation: 'getAll', params });
		expect(defaults).toHaveLength(50);
		expect(new Set(defaults.map((t) => t.id)).size).toBe(50);

		const all = await runOk({ resource: 'discussionTopic', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(all.map((t) => t.id).sort()).toEqual(expected.map((t) => t.id).sort());
		expect(new Set(all.map((t) => t.id)).size).toBe(all.length);

		const pages = await runOk({
			resource: 'discussionTopic',
			operation: 'getAll',
			params: { ...params, pagination: { perPage: 6, maxPages: 3 } },
		});
		expect(pages).toHaveLength(18);
		expect(new Set(pages.map((t) => t.id)).size).toBe(18);
	});

	it('getAll: search, order, state filters, includes and announcements really filter', async () => {
		const path = `/api/v1/courses/${list.courseId}/discussion_topics`;
		const params = { contextType: 'course', courseId: list.courseId, pagination: { returnAll: true } };
		const ids = (items: Json[]): unknown[] => items.map((t) => t.id);

		const found = await runOk({
			resource: 'discussionTopic',
			operation: 'getAll',
			params: { ...params, options: { search_term: SEARCH_WORD, order_by: 'title' } },
		});
		const expectedFound = await canvas().getAll<Json>(`${path}?search_term=${SEARCH_WORD}&order_by=title`);
		expect(found.length).toBeGreaterThan(10);
		expect(ids(found)).toEqual(ids(expectedFound));
		for (const topic of found) expect(String(topic.title)).toContain(SEARCH_WORD);
		const titles = found.map((t) => String(t.title));
		expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));

		// One state, and two states at once (Canvas wants them comma-separated).
		const pinned = await runOk({ resource: 'discussionTopic', operation: 'getAll', params: { ...params, options: { scope: ['pinned'] } } });
		expect(ids(pinned).sort()).toEqual(ids(await canvas().getAll<Json>(`${path}?scope=pinned`)).sort());
		expect(pinned.length).toBeGreaterThan(3);
		for (const topic of pinned) expect(topic.pinned).toBe(true);

		const lockedUnpinned = await runOk({
			resource: 'discussionTopic',
			operation: 'getAll',
			params: { ...params, options: { scope: ['locked', 'unpinned'] } },
		});
		expect(ids(lockedUnpinned).sort()).toEqual(ids(await canvas().getAll<Json>(`${path}?scope=locked,unpinned`)).sort());
		expect(lockedUnpinned.length).toBeGreaterThan(0);
		for (const topic of lockedUnpinned) expect(topic).toMatchObject({ locked: true, pinned: false });

		const announcements = await runOk({
			resource: 'discussionTopic',
			operation: 'getAll',
			params: { ...params, options: { only_announcements: true, include: ['sections_user_count'] } },
		});
		expect(ids(announcements).sort()).toEqual(ids(await canvas().getAll<Json>(`${path}?only_announcements=true`)).sort());
		expect(announcements.length).toBeGreaterThan(20);
		expect(announcements[0]).toHaveProperty('user_count');

		const recent = await runOk({
			resource: 'discussionTopic',
			operation: 'getAll',
			params: { ...params, options: { order_by: 'recent_activity', exclude_context_module_locked_topics: true, filter_by: 'all' } },
		});
		expect(ids(recent)).toEqual(
			ids(await canvas().getAll<Json>(`${path}?order_by=recent_activity&exclude_context_module_locked_topics=true&filter_by=all`)),
		);
	});

	it('getAll: students do not get drafts; "unread" depends on the user of the credential', async () => {
		const path = `/api/v1/courses/${list.courseId}/discussion_topics`;
		const params = { contextType: 'course', courseId: list.courseId, pagination: { returnAll: true } };
		const asStudent = await new CanvasClient('student').getAll<Json>(path);
		const everything = await canvas().getAll<Json>(path);
		expect(asStudent.length).toBeLessThan(everything.length);

		const seen = await runOk({ resource: 'discussionTopic', operation: 'getAll', persona: 'student', params });
		expect(seen.map((t) => t.id).sort()).toEqual(asStudent.map((t) => t.id).sort());
		for (const topic of seen) expect(topic.published).toBe(true);

		const unread = await runOk({
			resource: 'discussionTopic',
			operation: 'getAll',
			persona: 'student2',
			params: { ...params, options: { filter_by: 'unread' } },
		});
		const expectedUnread = await new CanvasClient('student2').getAll<Json>(`${path}?filter_by=unread`);
		expect(unread.map((t) => t.id).sort()).toEqual(expectedUnread.map((t) => t.id).sort());
		for (const topic of unread) {
			expect(topic.read_state === 'unread' || Number(topic.unread_count) > 0).toBe(true);
		}

		const none = await runNode({
			resource: 'discussionTopic',
			operation: 'getAll',
			params: { ...params, options: { search_term: 'no topic has this title zzzz' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	// ------------------------------------------------------------------
	// Entries and replies
	// ------------------------------------------------------------------

	describe('entries', () => {
		let entryTopicId = '';
		let entryId = '';
		let replyId = '';
		const entriesPath = (): string => `${coursePath}/discussion_topics/${entryTopicId}/entries`;
		const entryList = async (ids: Array<string | number>, client = canvas()): Promise<Json[]> =>
			client.get<Json[]>(
				`${coursePath}/discussion_topics/${entryTopicId}/entry_list?${ids.map((id) => `ids[]=${String(id)}`).join('&')}`,
			);

		beforeAll(async () => {
			const topic = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
				title: unique('Entry playground'),
				message: '<p>Post here.</p>',
				discussion_type: 'threaded',
				published: true,
				allow_rating: true,
			});
			entryTopicId = String(topic.id);
		});

		it('createEntry: a student posts a top-level entry', async () => {
			// (Canvas stores entries as sanitized HTML: a bare "&" would come back as "&amp;".)
			const message = '<p>Osmosis moves <em>water</em> — "really" &amp; truly? ¡Sí! 日本語 💧</p>';
			const [entry] = await runOk({
				resource: 'discussionTopic',
				operation: 'createEntry',
				persona: 'student',
				params: { ...course(), topicId: entryTopicId, message },
			});
			entryId = String(entry.id);
			expect(entry).toMatchObject({ user_id: Number(fx('studentUserId')), parent_id: null });

			const [actual] = await entryList([entryId]);
			expect(actual).toMatchObject({ id: Number(entryId), user_id: Number(fx('studentUserId')), parent_id: null, message });
		});

		it('createReply: replies to an entry, one per input item, also to a reply', async () => {
			const result = await runNode({
				resource: 'discussionTopic',
				operation: 'createReply',
				persona: 'student2',
				items: [{ entry: Number(entryId), text: 'I agree.' }, { entry: entryId, text: '<p>But what about salt?</p>' }],
				params: { ...course(), topicId: Number(entryTopicId), entryId: '={{ $json.entry }}', message: '={{ $json.text }}' },
			});
			expect(result.error).toEqual([]);
			expect(result.success.map((r) => [r.parent_id, r.user_id])).toEqual([
				[Number(entryId), Number(fx('student2UserId'))],
				[Number(entryId), Number(fx('student2UserId'))],
			]);
			replyId = String(result.success[0].id);

			const [nested] = await runOk({
				resource: 'discussionTopic',
				operation: 'createReply',
				persona: 'teacher',
				params: { ...course(), topicId: entryTopicId, entryId: replyId, message: 'Good point, Stella.' },
			});
			const actual = await entryList([replyId, nested.id as number]);
			expect(actual.map((e) => [e.id, e.parent_id, e.message])).toEqual([
				[Number(replyId), Number(entryId), 'I agree.'],
				[nested.id, Number(replyId), 'Good point, Stella.'],
			]);
		});

		it('getAllEntries / getAllReplies: top-level entries with their recent replies; replies of one entry', async () => {
			const entries = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllEntries',
				persona: 'teacher',
				params: { ...course(), topicId: entryTopicId },
			});
			expect(entries.map((e) => e.id)).toEqual([Number(entryId)]);
			// The two replies and the reply to a reply.
			expect((entries[0].recent_replies as Json[]).length).toBe(3);
			expect(entries[0].has_more_replies).toBe(false);

			const replies = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllReplies',
				params: { ...course(), topicId: entryTopicId, entryId },
			});
			const expected = await canvas().getAll<Json>(`${entriesPath()}/${entryId}/replies`);
			expect(replies.map((r) => r.id)).toEqual(expected.map((r) => r.id));
			// Everything below the entry, newest first: the reply to a reply, then the two direct replies.
			expect(replies.map((r) => r.parent_id)).toEqual([Number(replyId), Number(entryId), Number(entryId)]);
		});

		it('getEntriesById: returns the listed entries and replies in ID order', async () => {
			const entries = await runOk({
				resource: 'discussionTopic',
				operation: 'getEntriesById',
				params: { ...course(), topicId: entryTopicId, entryIds: ` ${replyId}, ${entryId} ` },
			});
			expect(entries.map((e) => e.id)).toEqual([Number(entryId), Number(replyId)].sort((a, b) => a - b));

			const fromArray = await runNode({
				resource: 'discussionTopic',
				operation: 'getEntriesById',
				items: [{ ids: [Number(entryId)] }],
				params: { ...course(), topicId: entryTopicId, entryIds: '={{ $json.ids }}' },
			});
			expect(fromArray.success.map((e) => e.id)).toEqual([Number(entryId)]);

			const missing = await runNode({
				resource: 'discussionTopic',
				operation: 'getEntriesById',
				params: { ...course(), topicId: entryTopicId, entryIds: '99999999', errorHandling: { onError: 'continueWithError' } },
			});
			expect(missing.success).toEqual([]);
			expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getEntriesById' });
		});

		it('updateEntry: the author edits their entry; another student may not', async () => {
			const [updated] = await runOk({
				resource: 'discussionTopic',
				operation: 'updateEntry',
				persona: 'student',
				params: { ...course(), topicId: entryTopicId, entryId, message: '<p>Edited: water follows the solute.</p>' },
			});
			expect(updated).toMatchObject({ id: Number(entryId), editor_id: Number(fx('studentUserId')) });
			expect((await entryList([entryId]))[0].message).toBe('<p>Edited: water follows the solute.</p>');

			const refused = await runNode({
				resource: 'discussionTopic',
				operation: 'updateEntry',
				persona: 'student2',
				params: { ...course(), topicId: entryTopicId, entryId, message: 'Hijacked', errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'updateEntry' });
			expect((await entryList([entryId]))[0].message).toBe('<p>Edited: water follows the solute.</p>');
		});

		it('rateEntry: like and take the like back', async () => {
			const [liked] = await runOk({
				resource: 'discussionTopic',
				operation: 'rateEntry',
				persona: 'student2',
				params: { ...course(), topicId: entryTopicId, entryId, rating: 1 },
			});
			expect(liked).toEqual({ success: true });
			expect((await entryList([entryId]))[0]).toMatchObject({ rating_count: 1, rating_sum: 1 });

			await runOk({
				resource: 'discussionTopic',
				operation: 'rateEntry',
				persona: 'teacher',
				params: { ...course(), topicId: entryTopicId, entryId },
			});
			expect((await entryList([entryId]))[0]).toMatchObject({ rating_count: 2, rating_sum: 2 });

			await runOk({
				resource: 'discussionTopic',
				operation: 'rateEntry',
				persona: 'student2',
				params: { ...course(), topicId: entryTopicId, entryId, rating: 0 },
			});
			expect((await entryList([entryId]))[0]).toMatchObject({ rating_sum: 1 });
		});

		it('markRead / markUnread: one entry, the topic, and the topic with all entries', async () => {
			const teacher = new CanvasClient('teacher');
			const state = async (): Promise<Json> => {
				const topic = await teacher.get<Json>(`${coursePath}/discussion_topics/${entryTopicId}`);
				const [entry] = await entryList([entryId], teacher);
				return {
					topic: topic.read_state,
					unread: topic.unread_count,
					entry: entry.read_state,
					forced: entry.forced_read_state,
				};
			};
			const run = (operation: string, params: Json): Promise<Json[]> =>
				runOk({ resource: 'discussionTopic', operation, persona: 'teacher', params: { ...course(), topicId: entryTopicId, ...params } });

			// Start from "everything unread".
			expect(await run('markUnread', { target: 'topicAndEntries', readOptions: { forced_read_state: false } })).toEqual([{ success: true }]);
			expect(await state()).toEqual({ topic: 'unread', unread: 4, entry: 'unread', forced: false });

			await run('markRead', { target: 'entry', entryId });
			expect(await state()).toEqual({ topic: 'unread', unread: 3, entry: 'read', forced: false });

			await run('markUnread', { target: 'entry', entryId, readOptions: { forced_read_state: true } });
			expect(await state()).toEqual({ topic: 'unread', unread: 4, entry: 'unread', forced: true });

			await run('markRead', { target: 'topic' });
			expect(await state()).toEqual({ topic: 'read', unread: 4, entry: 'unread', forced: true });

			await run('markUnread', { target: 'topic' });
			expect((await state()).topic).toBe('unread');

			await run('markRead', { target: 'topicAndEntries', readOptions: { forced_read_state: false } });
			expect(await state()).toEqual({ topic: 'read', unread: 0, entry: 'read', forced: false });
		});

		it('markAllTopicsRead: every discussion of the course, or every announcement', async () => {
			const student2 = new CanvasClient('student2');
			const news = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
				title: unique('Unread news'),
				message: 'Read me',
				is_announcement: true,
				published: true,
			});
			const fresh = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
				title: unique('Unread topic'),
				message: 'Read me too',
				published: true,
			});
			const readState = async (id: unknown): Promise<unknown> =>
				(await student2.get<Json>(`${coursePath}/discussion_topics/${String(id)}`)).read_state;
			expect([await readState(news.id), await readState(fresh.id)]).toEqual(['unread', 'unread']);

			const [result] = await runOk({
				resource: 'discussionTopic',
				operation: 'markAllTopicsRead',
				persona: 'student2',
				params: { ...course() },
			});
			expect(result).toEqual({ success: true });
			expect([await readState(news.id), await readState(fresh.id)]).toEqual(['unread', 'read']);

			await runOk({
				resource: 'discussionTopic',
				operation: 'markAllTopicsRead',
				persona: 'student2',
				params: { ...course(), options: { only_announcements: true } },
			});
			expect(await readState(news.id)).toBe('read');
			await deleteTopic(coursePath, news.id as number);
			await deleteTopic(coursePath, fresh.id as number);
		});

		it('subscribe / unsubscribe: changes the subscription of the user of the credential', async () => {
			const subscribed = async (): Promise<unknown> =>
				(await new CanvasClient('teacher').get<Json>(`${coursePath}/discussion_topics/${entryTopicId}`)).subscribed;
			const [on] = await runOk({
				resource: 'discussionTopic',
				operation: 'subscribe',
				persona: 'teacher',
				params: { ...course(), topicId: entryTopicId },
			});
			expect(on).toEqual({ success: true });
			expect(await subscribed()).toBe(true);

			const [off] = await runOk({
				resource: 'discussionTopic',
				operation: 'unsubscribe',
				persona: 'teacher',
				params: { ...course(), topicId: entryTopicId },
			});
			expect(off).toEqual({ success: true });
			expect(await subscribed()).toBe(false);
		});

		it('getFullTopic: the whole thread in one item', async () => {
			const result = await runNode({
				resource: 'discussionTopic',
				operation: 'getFullTopic',
				persona: 'teacher',
				params: { ...course(), topicId: entryTopicId, options: { include_new_entries: true } },
			});
			expect(result.error).toEqual([]);
			expect(result.success).toHaveLength(1);
			const [full] = result.success;
			expect((full.participants as Json[]).map((p) => p.id).sort()).toEqual(
				[Number(fx('studentUserId')), Number(fx('student2UserId')), Number(fx('teacherUserId'))].sort(),
			);
			expect(full.unread_entries).toEqual([]);
			expect(full).toHaveProperty('entry_ratings');
			// Canvas builds the threaded view in the background; entries it has not caught up
			// with yet are listed under new_entries.
			const inView = (nodes: Json[]): number[] =>
				nodes.flatMap((n) => [n.id as number, ...inView((n.replies as Json[] | undefined) ?? [])]);
			const all = [...inView(full.view as Json[]), ...(full.new_entries as Json[]).map((e) => e.id as number)];
			expect(all).toEqual(expect.arrayContaining([Number(entryId), Number(replyId)]));

			const [plain] = await runOk({
				resource: 'discussionTopic',
				operation: 'getFullTopic',
				params: { ...course(), topicId: entryTopicId },
			});
			expect(plain).toHaveProperty('view');
			expect(plain.new_entries ?? []).toEqual([]);
		});

		it('deleteEntry: a reply and an entry; deleted entries stay as placeholders', async () => {
			const result = await runNode({
				resource: 'discussionTopic',
				operation: 'deleteEntry',
				items: [{ id: replyId }, { id: Number(entryId) }, { id: 99999999 }],
				params: { ...course(), topicId: entryTopicId, entryId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([{ success: true }, { success: true }]);
			expect(result.error).toHaveLength(1);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'deleteEntry' });
			const actual = await entryList([entryId, replyId]);
			expect(actual.map((e) => e.deleted)).toEqual([true, true]);
			expect(actual[0]).not.toHaveProperty('message');
		});

		it('createEntry: a topic closed for comments refuses students; "require initial post" hides entries', async () => {
			await canvas().put(`${coursePath}/discussion_topics/${entryTopicId}`, { locked: true });
			const refused = await runNode({
				resource: 'discussionTopic',
				operation: 'createEntry',
				persona: 'student',
				params: { ...course(), topicId: entryTopicId, message: 'Too late?', errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'createEntry' });
			await deleteTopic(coursePath, entryTopicId);

			const gated = await canvas().post<Json>(`${coursePath}/discussion_topics`, {
				title: unique('Post first'),
				message: 'Answer before you read.',
				published: true,
				require_initial_post: true,
			});
			await new CanvasClient('student').post(`${coursePath}/discussion_topics/${String(gated.id)}/entries`, { message: 'My answer' });
			const hidden = await runNode({
				resource: 'discussionTopic',
				operation: 'getAllEntries',
				persona: 'student2',
				params: { ...course(), topicId: gated.id, errorHandling: { onError: 'continueWithError' } },
			});
			expect(hidden.success).toEqual([]);
			// Canvas answers 403 with the bare text "require_initial_post".
			expect(hidden.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getAllEntries' });

			await runOk({
				resource: 'discussionTopic',
				operation: 'createEntry',
				persona: 'student2',
				params: { ...course(), topicId: gated.id, message: 'My own answer' },
			});
			const visible = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllEntries',
				persona: 'student2',
				params: { ...course(), topicId: gated.id },
			});
			expect(visible.map((e) => e.message)).toEqual(['My own answer', 'My answer']);
			await deleteTopic(coursePath, gated.id as number);
		});

		it('getAllEntries / getAllReplies: page through more entries and replies than one page holds', async () => {
			const base = `/api/v1/courses/${list.courseId}/discussion_topics/${list.marathonTopicId}/entries`;
			const params = { contextType: 'course', courseId: list.courseId, topicId: list.marathonTopicId };

			const expectedEntries = await canvas().getAll<Json>(base);
			expect(expectedEntries.length).toBeGreaterThanOrEqual(ENTRY_MARATHON_SIZE);
			const defaults = await runOk({ resource: 'discussionTopic', operation: 'getAllEntries', params });
			expect(defaults.map((e) => e.id)).toEqual(expectedEntries.slice(0, 50).map((e) => e.id));
			const all = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllEntries',
				params: { ...params, pagination: { returnAll: true } },
			});
			expect(all.map((e) => e.id)).toEqual(expectedEntries.map((e) => e.id));
			expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
			const pages = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllEntries',
				params: { ...params, pagination: { perPage: 5, maxPages: 3 } },
			});
			expect(pages.map((e) => e.id)).toEqual(expectedEntries.slice(0, 15).map((e) => e.id));

			const expectedReplies = await canvas().getAll<Json>(`${base}/${list.marathonEntryId}/replies`);
			expect(expectedReplies.length).toBeGreaterThanOrEqual(REPLY_MARATHON_SIZE);
			const replies = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllReplies',
				params: { ...params, entryId: list.marathonEntryId, pagination: { returnAll: true } },
			});
			expect(replies.map((r) => r.id)).toEqual(expectedReplies.map((r) => r.id));
			const firstPages = await runOk({
				resource: 'discussionTopic',
				operation: 'getAllReplies',
				params: { ...params, entryId: list.marathonEntryId, pagination: { perPage: 4, maxPages: 2 } },
			});
			expect(firstPages.map((r) => r.id)).toEqual(expectedReplies.slice(0, 8).map((r) => r.id));

			const many = await runOk({
				resource: 'discussionTopic',
				operation: 'getEntriesById',
				params: { ...params, entryIds: expectedEntries.slice(0, 30).map((e) => e.id).join(','), pagination: { returnAll: true } },
			});
			expect(many.map((e) => e.id).sort()).toEqual(expectedEntries.slice(0, 30).map((e) => e.id).sort());
		});
	});

	// ------------------------------------------------------------------
	// Group context
	// ------------------------------------------------------------------

	describe('in a group', () => {
		let groupTopicId = '';
		const groupTitle = unique('Group topic');

		it('create: the fields Canvas supports for group topics reach Canvas; course-only fields are ignored', async () => {
			const [created] = await runOk({
				resource: 'discussionTopic',
				operation: 'create',
				persona: 'student',
				params: {
					...group(),
					title: groupTitle,
					additionalFields: {
						allow_rating: true,
						discussion_type: 'threaded',
						message: '<p>Group work — plan for <em>Friday</em></p>',
						only_graders_can_rate: false,
						pinned: true,
						sort_by_rating: true,
						todo_date: '2031-05-01T00:00:00Z',
						// Course-only settings: Canvas drops them for topics in a group.
						delayed_post_at: '2031-01-01T00:00:00Z',
						lock_at: '2031-02-01T00:00:00Z',
						require_initial_post: true,
					},
				},
			});
			groupTopicId = String(created.id);
			const actual = await readTopic(groupTopicId, '', groupPath);
			expect(actual).toMatchObject({
				title: groupTitle,
				allow_rating: true,
				discussion_type: 'threaded',
				message: '<p>Group work — plan for <em>Friday</em></p>',
				pinned: true,
				sort_by_rating: true,
				published: true,
				user_name: 'Sam Student',
				delayed_post_at: null,
				lock_at: null,
			});
			expect(actual.require_initial_post).not.toBe(true);
		});

		it('get, getAll, update, duplicate, reorderPinned work on the group', async () => {
			const [topic] = await runOk({
				resource: 'discussionTopic',
				operation: 'get',
				persona: 'student2',
				params: { ...group(), topicId: groupTopicId, options: { include: ['sections_user_count'] } },
			});
			expect(topic).toMatchObject({ id: Number(groupTopicId), title: groupTitle });

			const listed = await runOk({
				resource: 'discussionTopic',
				operation: 'getAll',
				persona: 'student2',
				params: { ...group(), options: { scope: ['pinned'] }, pagination: { returnAll: true } },
			});
			expect(listed.map((t) => t.id).sort()).toEqual(
				(await new CanvasClient('student2').getAll<Json>(`${groupPath}/discussion_topics?scope=pinned`))
					.map((t) => t.id)
					.sort(),
			);
			expect(listed.map((t) => t.id)).toContain(Number(groupTopicId));

			const [updated] = await runOk({
				resource: 'discussionTopic',
				operation: 'update',
				persona: 'student',
				params: {
					...group(),
					topicId: groupTopicId,
					updateFields: { title: `${groupTitle} (edited)`, message: 'New plan', allow_rating: false, discussion_type: 'side_comment' },
				},
			});
			expect(updated.title).toBe(`${groupTitle} (edited)`);
			expect(await readTopic(groupTopicId, '', groupPath)).toMatchObject({
				title: `${groupTitle} (edited)`,
				message: 'New plan',
				allow_rating: false,
				discussion_type: 'side_comment',
			});

			const [copy] = await runOk({
				resource: 'discussionTopic',
				operation: 'duplicate',
				params: { ...group(), topicId: groupTopicId },
			});
			expect(String((await readTopic(copy.id as number, '', groupPath)).title)).toContain(groupTitle);

			const second = await canvas().post<Json>(`${groupPath}/discussion_topics`, { title: unique('Group pinned 2'), pinned: true });
			const pinnedIds = async (): Promise<number[]> =>
				(await canvas().getAll<Json>(`${groupPath}/discussion_topics?scope=pinned`))
					.sort((a, b) => Number(a.position) - Number(b.position))
					.map((t) => t.id as number);
			const wanted = [...(await pinnedIds())].reverse();
			await runOk({ resource: 'discussionTopic', operation: 'reorderPinned', params: { ...group(), order: wanted.join(',') } });
			expect(await pinnedIds()).toEqual(wanted);
			await deleteTopic(groupPath, copy.id as number);
			await deleteTopic(groupPath, second.id as number);
		});

		it('entries, replies, read state, rating and subscription work on a group topic', async () => {
			const run = (operation: string, persona: string, params: Json = {}): Promise<Json[]> =>
				runOk({ resource: 'discussionTopic', operation, persona, params: { ...group(), topicId: groupTopicId, ...params } });
			await canvas().put(`${groupPath}/discussion_topics/${groupTopicId}`, { allow_rating: true, discussion_type: 'threaded' });

			const [entry] = await run('createEntry', 'student', { message: 'I can do Friday.' });
			const [reply] = await run('createReply', 'student2', { entryId: entry.id, message: 'Me too.' });
			expect(reply.parent_id).toBe(entry.id);

			const entries = await run('getAllEntries', 'student2');
			expect(entries.map((e) => e.id)).toEqual([entry.id]);
			const replies = await run('getAllReplies', 'student', { entryId: entry.id });
			expect(replies.map((r) => r.id)).toEqual([reply.id]);
			const byId = await run('getEntriesById', 'student', { entryIds: `${String(entry.id)},${String(reply.id)}` });
			expect(byId.map((e) => e.id)).toEqual([entry.id, reply.id]);

			await run('updateEntry', 'student', { entryId: entry.id, message: 'I can do Friday at 3.' });
			await run('rateEntry', 'student2', { entryId: entry.id, rating: 1 });
			const student2 = new CanvasClient('student2');
			const entryNow = async (): Promise<Json> =>
				(await student2.get<Json[]>(`${groupPath}/discussion_topics/${groupTopicId}/entry_list?ids[]=${String(entry.id)}`))[0];
			expect(await entryNow()).toMatchObject({ message: 'I can do Friday at 3.', rating_sum: 1 });

			await run('markUnread', 'student2', { target: 'entry', entryId: entry.id });
			expect((await entryNow()).read_state).toBe('unread');
			await run('markRead', 'student2', { target: 'topicAndEntries' });
			expect((await entryNow()).read_state).toBe('read');
			await run('markUnread', 'student2', { target: 'topic' });
			const topicNow = async (): Promise<Json> => student2.get<Json>(`${groupPath}/discussion_topics/${groupTopicId}`);
			expect((await topicNow()).read_state).toBe('unread');
			await run('markRead', 'student2', { target: 'topic' });
			expect((await topicNow()).read_state).toBe('read');

			await run('unsubscribe', 'student2');
			expect((await topicNow()).subscribed).toBe(false);
			await run('subscribe', 'student2');
			expect((await topicNow()).subscribed).toBe(true);

			const [full] = await run('getFullTopic', 'student', { options: { include_new_entries: true } });
			expect((full.participants as Json[]).map((p) => p.id).sort()).toEqual(
				[Number(fx('studentUserId')), Number(fx('student2UserId'))].sort(),
			);

			const fresh = await canvas().post<Json>(`${groupPath}/discussion_topics`, {
				title: unique('Group unread'),
				message: 'x',
				published: true,
			});
			expect((await student2.get<Json>(`${groupPath}/discussion_topics/${String(fresh.id)}`)).read_state).toBe('unread');
			await runOk({ resource: 'discussionTopic', operation: 'markAllTopicsRead', persona: 'student2', params: { ...group() } });
			expect((await student2.get<Json>(`${groupPath}/discussion_topics/${String(fresh.id)}`)).read_state).toBe('read');
			await deleteTopic(groupPath, fresh.id as number);

			expect(await run('deleteEntry', 'student2', { entryId: reply.id })).toEqual([{ success: true }]);
			expect((await student2.get<Json[]>(`${groupPath}/discussion_topics/${groupTopicId}/entry_list?ids[]=${String(reply.id)}`))[0].deleted).toBe(true);
		});

		it('delete: removes the group topic; people outside the group get nothing', async () => {
			const outsider = await runNode({
				resource: 'discussionTopic',
				operation: 'get',
				persona: 'observer',
				params: { ...group(), topicId: groupTopicId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(outsider.success).toEqual([]);
			expect(outsider.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'get' });

			// The author is a student: once classmates have replied, they can no longer delete it.
			const byAuthor = await runNode({
				resource: 'discussionTopic',
				operation: 'delete',
				persona: 'student',
				params: { ...group(), topicId: groupTopicId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(byAuthor.success).toEqual([]);
			expect(byAuthor.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'delete' });

			const [deleted] = await runOk({
				resource: 'discussionTopic',
				operation: 'delete',
				persona: 'teacher',
				params: { ...group(), topicId: groupTopicId },
			});
			expect(JSON.stringify(deleted)).toContain(`"id":${groupTopicId}`);
			expect((await canvas().request('GET', `${groupPath}/discussion_topics/${groupTopicId}`)).status).toBe(404);
		});
	});

	// ------------------------------------------------------------------
	// Delete and errors
	// ------------------------------------------------------------------

	it('delete: students may not delete a teacher\'s topic; the owner can', async () => {
		const refused = await runNode({
			resource: 'discussionTopic',
			operation: 'delete',
			persona: 'student',
			params: { ...course(), topicId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'discussionTopic', operation: 'delete' });

		const [deleted] = await runOk({ resource: 'discussionTopic', operation: 'delete', params: { ...course(), topicId } });
		expect(JSON.stringify(deleted)).toContain('"workflow_state":"deleted"');
		expect((await canvas().request('GET', `${coursePath}/discussion_topics/${topicId}`)).status).toBe(404);
		expect((await canvas().getAll<Json>(`${coursePath}/discussion_topics`)).map((t) => t.id)).not.toContain(Number(topicId));
	});

	it('errors: a mix of existing and missing topics; an empty group ID', async () => {
		const survivor = await canvas().post<Json>(`${coursePath}/discussion_topics`, { title: unique('Survivor'), published: true });
		const result = await runNode({
			resource: 'discussionTopic',
			operation: 'get',
			items: [{ id: topicId }, { id: survivor.id }, { id: 99999999 }],
			params: { ...course(), topicId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((t) => t.id)).toEqual([survivor.id]);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([1]);
		expect(result.error.map((e) => [e.errorCode, e.errorType, (e.originalItem as Json).id])).toEqual([
			[404, 'NOT_FOUND', topicId],
			[404, 'NOT_FOUND', 99999999],
		]);
		await deleteTopic(coursePath, survivor.id as number);

		const empty = await runNode({
			resource: 'discussionTopic',
			operation: 'getAll',
			items: [{ other: 1 }],
			params: { contextType: 'group', groupId: '={{ $json.group }}' },
		});
		expect(empty.ok).toBe(false);
		expect(empty.failure?.message).toContain('required parameter is empty');
	});
});
