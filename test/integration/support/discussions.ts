import { canvas, fx } from '../../lib/canvas';
import type { Json } from '../../lib/n8n';
import { ensureCourse } from './quizzes';

/**
 * Shared setup for the discussion test files (discussionTopic, announcement,
 * announcementExternalFeed).
 *
 * The seed does not create discussions, so these files work in courses of their
 * own, looked up by SIS ID and reused across runs. Every test creates (and
 * removes) its own topics; the list fixtures below are never modified.
 */

export const DISCUSSION_COURSE_SIS_ID = 'BATTERY-DISCUSSIONS';
export const DISCUSSION_LIST_COURSE_SIS_ID = 'BATTERY-DISCUSSION-LIST';

/** Topics kept in the list course (not counting the entry marathon topic). */
export const TOPIC_LIST_SIZE = 56;
/** Announcements kept in the list course. */
export const ANNOUNCEMENT_LIST_SIZE = 23;
/** Top-level entries of the marathon topic, and replies to its first entry. */
export const ENTRY_MARATHON_SIZE = 57;
export const REPLY_MARATHON_SIZE = 23;
export const MARATHON_TOPIC_TITLE = 'Entry marathon (list fixture)';
export const SEARCH_WORD = 'Zellatmung';

export interface DiscussionCourse {
	courseId: string;
	/** Two sections of the course besides the default one (for section-specific topics). */
	sectionIds: [string, string];
	/** A group set with one group whose members are the two student personas. */
	groupCategoryId: string;
	groupId: string;
}

/** The course the discussion files create their own topics in. */
export async function discussionCourse(): Promise<DiscussionCourse> {
	const courseId = await ensureCourse(DISCUSSION_COURSE_SIS_ID, 'Battery: discussions');

	const sections = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
	const sectionIds: string[] = [];
	for (const name of ['Discussion section A', 'Discussion section B']) {
		const section =
			sections.find((s) => s.name === name) ??
			(await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name } }));
		sectionIds.push(String(section.id));
	}

	const categories = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/group_categories`);
	const category =
		categories.find((c) => c.name === 'Battery groups') ??
		(await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: 'Battery groups' }));
	const groupCategoryId = String(category.id);
	const groups = await canvas().getAll<Json>(`/api/v1/group_categories/${groupCategoryId}/groups`);
	const group =
		groups.find((g) => g.name === 'Battery group A') ??
		(await canvas().post<Json>(`/api/v1/group_categories/${groupCategoryId}/groups`, { name: 'Battery group A' }));
	const groupId = String(group.id);
	const members = new Set(
		(await canvas().getAll<Json>(`/api/v1/groups/${groupId}/memberships`)).map((m) => String(m.user_id)),
	);
	for (const userId of [fx('studentUserId'), fx('student2UserId')]) {
		if (!members.has(userId)) {
			await canvas().post(`/api/v1/groups/${groupId}/memberships`, { user_id: userId });
		}
	}
	return { courseId, sectionIds: [sectionIds[0], sectionIds[1]], groupCategoryId, groupId };
}

export interface DiscussionListCourse {
	courseId: string;
	/** A topic with more entries than one page holds. */
	marathonTopicId: string;
	/** The entry of the marathon topic that has many replies. */
	marathonEntryId: string;
}

/**
 * A course holding a fixed, large set of topics, announcements and entries that
 * no test modifies (for list/pagination tests).
 */
export async function discussionListCourse(): Promise<DiscussionListCourse> {
	const courseId = await ensureCourse(DISCUSSION_LIST_COURSE_SIS_ID, 'Battery: discussion list');
	const topicsPath = `/api/v1/courses/${courseId}/discussion_topics`;

	const topics = await canvas().getAll<Json>(topicsPath);
	const plain = topics.filter((t) => t.title !== MARATHON_TOPIC_TITLE);
	for (let i = plain.length; i < TOPIC_LIST_SIZE; i++) {
		const n = String(i + 1).padStart(2, '0');
		await canvas().post(topicsPath, {
			// A third of the titles share a word so search_term has something to filter on.
			title: i % 3 === 0 ? `Woche ${n}: ${SEARCH_WORD} — débat` : `Week ${n} discussion`,
			message: `<p>Prompt number ${i + 1}</p>`,
			discussion_type: i % 2 === 0 ? 'threaded' : 'side_comment',
			// Every fifth topic is an unpublished draft: students must not see those.
			published: i % 5 !== 0,
			// Every seventh topic is pinned, every eleventh is closed for comments.
			pinned: i % 7 === 0,
			locked: i % 11 === 0,
		});
	}

	const announcements = await canvas().getAll<Json>(`${topicsPath}?only_announcements=true`);
	for (let i = announcements.length; i < ANNOUNCEMENT_LIST_SIZE; i++) {
		await canvas().post(topicsPath, {
			title: `Announcement ${String(i + 1).padStart(2, '0')}`,
			message: `<p>News item ${i + 1}</p>`,
			is_announcement: true,
			published: true,
		});
	}

	let marathon = topics.find((t) => t.title === MARATHON_TOPIC_TITLE);
	marathon ??= await canvas().post<Json>(topicsPath, {
		title: MARATHON_TOPIC_TITLE,
		message: '<p>Everybody posts here.</p>',
		discussion_type: 'threaded',
		published: true,
		allow_rating: true,
	});
	const marathonTopicId = String(marathon.id);
	const entriesPath = `${topicsPath}/${marathonTopicId}/entries`;
	const entries = await canvas().getAll<Json>(entriesPath);
	for (let i = entries.length; i < ENTRY_MARATHON_SIZE; i++) {
		entries.push(await canvas().post<Json>(entriesPath, { message: `<p>Entry ${i + 1}</p>` }));
	}
	// The oldest entry carries the replies (entries are listed newest first).
	const oldest = entries.reduce((a, b) => (Number(a.id) < Number(b.id) ? a : b));
	const marathonEntryId = String(oldest.id);
	const replies = await canvas().getAll<Json>(`${entriesPath}/${marathonEntryId}/replies`);
	for (let i = replies.length; i < REPLY_MARATHON_SIZE; i++) {
		await canvas().post(`${entriesPath}/${marathonEntryId}/replies`, { message: `<p>Reply ${i + 1}</p>` });
	}
	return { courseId, marathonTopicId, marathonEntryId };
}

export async function deleteTopic(basePath: string, topicId: string | number): Promise<void> {
	await canvas().request('DELETE', `${basePath}/discussion_topics/${String(topicId)}`);
}
