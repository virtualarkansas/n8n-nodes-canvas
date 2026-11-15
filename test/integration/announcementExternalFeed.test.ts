import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import { discussionCourse, discussionListCourse } from './support/discussions';
import type { DiscussionCourse } from './support/discussions';
import { FIXTURE_TIMEOUT } from './support/quizzes';

const FEED_LIST_SIZE = 13;

/**
 * Resource: announcementExternalFeed (RSS/Atom feeds whose entries Canvas posts as
 * announcements of a course or group). Every operation runs through a real n8n
 * instance against Canvas; writes are verified by reading the feeds back from
 * Canvas directly.
 */
describe('announcementExternalFeed', () => {
	let ctx: DiscussionCourse;
	let listCourseId = '';
	let coursePath = '';
	let groupPath = '';
	let feedId = '';

	const course = (): Json => ({ contextType: 'course', courseId: ctx.courseId });
	const group = (): Json => ({ contextType: 'group', groupId: ctx.groupId });
	const feeds = (base = coursePath): Promise<Json[]> => canvas().getAll<Json>(`${base}/external_feeds`);
	const feedUrl = (name: string): string => `https://example.com/feeds/${unique(name).replace(/\s/g, '-')}.xml`;

	beforeAll(async () => {
		const [own, list] = await Promise.all([discussionCourse(), discussionListCourse()]);
		ctx = own;
		listCourseId = list.courseId;
		coursePath = `/api/v1/courses/${ctx.courseId}`;
		groupPath = `/api/v1/groups/${ctx.groupId}`;
		// A fixed set of feeds for the pagination test (created once, never modified).
		const existing = await canvas().getAll<Json>(`/api/v1/courses/${listCourseId}/external_feeds`);
		for (let i = existing.length; i < FEED_LIST_SIZE; i++) {
			await canvas().post(`/api/v1/courses/${listCourseId}/external_feeds`, {
				url: `https://example.com/feeds/list-${String(i + 1).padStart(2, '0')}.xml`,
				verbosity: ['full', 'truncate', 'link_only'][i % 3],
			});
		}
	}, FIXTURE_TIMEOUT);

	it('create: every optional field reaches Canvas', async () => {
		const url = `${feedUrl('news')}?lang=de&q=a%20b`;
		const [created] = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'create',
			persona: 'teacher',
			params: {
				...course(),
				url,
				additionalFields: { header_match: 'Eilmeldung: "Schule" & mehr — ünï', verbosity: 'truncate' },
			},
		});
		feedId = String(created.id);
		expect(created).toMatchObject({ url, header_match: 'Eilmeldung: "Schule" & mehr — ünï', verbosity: 'truncate' });

		const actual = (await feeds()).find((f) => String(f.id) === feedId);
		expect(actual).toMatchObject({
			url,
			header_match: 'Eilmeldung: "Schule" & mehr — ünï',
			verbosity: 'truncate',
			external_feed_entries_count: 0,
		});
	});

	it('create: only a URL; each verbosity, one feed per input item; a URL without scheme', async () => {
		const [plain] = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'create',
			params: { ...course(), url: feedUrl('plain') },
		});
		expect((await feeds()).find((f) => f.id === plain.id)).toMatchObject({ verbosity: 'full', header_match: null });

		const inputs = ['full', 'truncate', 'link_only'].map((verbosity) => ({ verbosity, url: feedUrl(verbosity) }));
		const result = await runNode({
			resource: 'announcementExternalFeed',
			operation: 'create',
			items: inputs,
			params: { ...course(), url: '={{ $json.url }}', additionalFields: { verbosity: '={{ $json.verbosity }}' } },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((f) => [f.url, f.verbosity])).toEqual(inputs.map((i) => [i.url, i.verbosity]));
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 1, 2]);
		const stored = await feeds();
		for (const feed of result.success) {
			expect(stored.find((f) => f.id === feed.id)).toMatchObject({ url: feed.url, verbosity: feed.verbosity });
		}

		// Canvas completes a URL that has no scheme.
		const bare = `example.org/${unique('rss').replace(/\s/g, '-')}`;
		const [noScheme] = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'create',
			params: { ...course(), url: bare },
		});
		expect((await feeds()).find((f) => f.id === noScheme.id)?.url).toBe(`http://${bare}`);

		for (const feed of [plain, noScheme, ...result.success]) {
			await canvas().request('DELETE', `${coursePath}/external_feeds/${String(feed.id)}`);
		}
	});

	it('create: Canvas falls back to "full" for an unknown verbosity; a URL that resolves to nothing is refused', async () => {
		const fallback = await runNode({
			resource: 'announcementExternalFeed',
			operation: 'create',
			items: [{ verbosity: 'everything' }],
			params: { ...course(), url: feedUrl('fallback'), additionalFields: { verbosity: '={{ $json.verbosity }}' } },
		});
		expect(fallback.error).toEqual([]);
		const created = fallback.success[0];
		expect((await feeds()).find((f) => f.id === created.id)).toMatchObject({ verbosity: 'full' });
		await canvas().request('DELETE', `${coursePath}/external_feeds/${String(created.id)}`);

		const before = (await feeds()).length;
		const result = await runNode({
			resource: 'announcementExternalFeed',
			operation: 'create',
			items: [{ other: 1 }],
			params: { ...course(), url: '={{ $json.feed }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'announcementExternalFeed',
			operation: 'create',
		});
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('url');
		expect((await feeds()).length).toBe(before);
	});

	it('getAll: lists the feeds of the course', async () => {
		const expected = await feeds();
		const listed = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'getAll',
			persona: 'teacher',
			params: { ...course(), pagination: { returnAll: true } },
		});
		expect(listed.map((f) => f.id)).toEqual(expected.map((f) => f.id));
		expect(listed.map((f) => String(f.id))).toContain(feedId);
	});

	it('getAll: pages through more feeds than one page holds', async () => {
		const expected = await feeds(`/api/v1/courses/${listCourseId}`);
		expect(expected.length).toBeGreaterThanOrEqual(FEED_LIST_SIZE);
		const params = { contextType: 'course', courseId: listCourseId };

		const defaults = await runOk({ resource: 'announcementExternalFeed', operation: 'getAll', params });
		expect(defaults.map((f) => f.id)).toEqual(expected.map((f) => f.id));
		expect(new Set(defaults.map((f) => f.id)).size).toBe(defaults.length);

		const all = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'getAll',
			params: { ...params, pagination: { returnAll: true } },
		});
		expect(all.map((f) => f.id)).toEqual(expected.map((f) => f.id));

		const pages = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'getAll',
			params: { ...params, pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(pages.map((f) => f.id)).toEqual(expected.slice(0, 6).map((f) => f.id));
	});

	it('group context: create, list and delete as a member of the group', async () => {
		const url = feedUrl('group');
		const [created] = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'create',
			persona: 'student',
			params: { ...group(), url, additionalFields: { verbosity: 'link_only', header_match: 'club' } },
		});
		expect((await feeds(groupPath)).find((f) => f.id === created.id)).toMatchObject({
			url,
			verbosity: 'link_only',
			header_match: 'club',
		});

		const listed = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'getAll',
			persona: 'student2',
			params: { ...group() },
		});
		expect(listed.map((f) => f.id)).toEqual((await feeds(groupPath)).map((f) => f.id));

		const [deleted] = await runOk({
			resource: 'announcementExternalFeed',
			operation: 'delete',
			persona: 'student2',
			params: { ...group(), externalFeedId: created.id },
		});
		expect(deleted).toMatchObject({ id: created.id, url });
		expect((await feeds(groupPath)).map((f) => f.id)).not.toContain(created.id);

		const empty = await runNode({ resource: 'announcementExternalFeed', operation: 'getAll', params: { ...group() } });
		expect(empty.ok).toBe(true);
		expect(empty.success).toEqual((await feeds(groupPath)).map((f) => expect.objectContaining({ id: f.id })));
	});

	it('errors: students may not manage the feeds of a course', async () => {
		for (const [operation, params] of [
			['getAll', {}],
			['create', { url: feedUrl('sneaky') }],
			['delete', { externalFeedId: feedId }],
		] as Array<[string, Json]>) {
			const result = await runNode({
				resource: 'announcementExternalFeed',
				operation,
				persona: 'student',
				params: { ...course(), ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({
				errorType: 'FORBIDDEN',
				resource: 'announcementExternalFeed',
				operation,
			});
		}
		expect((await feeds()).map((f) => String(f.id))).toContain(feedId);
	});

	it('delete: removes the feed and returns it; an unknown feed is reported', async () => {
		const result = await runNode({
			resource: 'announcementExternalFeed',
			operation: 'delete',
			persona: 'teacher',
			items: [{ id: Number(feedId) }, { id: 99999999 }],
			params: { ...course(), externalFeedId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toHaveLength(1);
		expect(result.success[0]).toMatchObject({ id: Number(feedId), verbosity: 'truncate' });
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		expect((await feeds()).map((f) => String(f.id))).not.toContain(feedId);
	});
});
