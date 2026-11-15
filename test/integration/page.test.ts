import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, ensureModulesBattery } from './contentBattery';
import type { ModulesBattery } from './contentBattery';

/**
 * Resource: page. Course pages live in the modules battery course (more than
 * 100 pages); group pages in a group of that course.
 */
describe('page', () => {
	let battery: ModulesBattery;
	let courseId = '';
	let groupId = '';
	let pageUrl = '';
	let pageId = '';
	const title = unique('Página ünï 页面 🚀 "quoted" & <b>tags</b> / slash?');

	const pageFromCanvas = (url: string, base = `/api/v1/courses/${courseId}`): Promise<Json> =>
		canvas().get<Json>(`${base}/pages/${encodeURIComponent(url)}`);

	beforeAll(async () => {
		battery = await ensureModulesBattery();
		courseId = battery.courseId;
		groupId = battery.groupId;
	}, 900_000);

	it('create: every optional field reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'page',
			operation: 'create',
			params: {
				courseId,
				title,
				additionalFields: {
					body: '<h2>Überschrift</h2><p>Text with <strong>markup</strong>, “quotes” &amp; emoji 🎓</p>',
					editing_roles: ['students', 'teachers'],
					notify_of_update: true,
					publish_at: '2031-01-02T03:04:00Z',
					published: false,
					student_todo_at: '2031-05-06T07:08:00Z',
				},
			},
		});
		pageUrl = String(created.url);
		pageId = String(created.page_id);
		expect(created.title).toBe(title);

		const actual = await pageFromCanvas(pageUrl);
		expect(actual).toMatchObject({
			title,
			editing_roles: 'students,teachers',
			published: false,
			front_page: false,
			publish_at: '2031-01-02T03:04:00Z',
			todo_date: '2031-05-06T07:08:00Z',
		});
		expect(String(actual.body)).toContain('<strong>markup</strong>');
		expect(String(actual.body)).toContain('emoji 🎓');
	});

	it('create: minimal page is unpublished and editable by teachers only', async () => {
		const [created] = await runOk({ resource: 'page', operation: 'create', params: { courseId, title: unique('Minimal page') } });
		expect(created).toMatchObject({ published: false, editing_roles: 'teachers', front_page: false, body: null });
		await canvas().delete(`/api/v1/courses/${courseId}/pages/${String(created.url)}`);
	});

	it('create: a title already in use gets a numbered URL', async () => {
		const name = unique('Twin page');
		const result = await runNode({
			resource: 'page',
			operation: 'create',
			items: [{ n: 1 }, { n: 2 }],
			params: { courseId, title: name, additionalFields: { published: true }, batchProcessing: { mode: 'individual' } },
		});
		expect(result.success).toHaveLength(2);
		const [first, second] = result.success.map((p) => String(p.url));
		expect(second).toBe(`${first}-2`);
		for (const url of [first, second]) await canvas().delete(`/api/v1/courses/${courseId}/pages/${url}`);
	});

	it('create: an empty set of editing roles is refused by Canvas', async () => {
		const result = await runNode({
			resource: 'page',
			operation: 'create',
			params: {
				courseId,
				title: unique('No roles'),
				additionalFields: { editing_roles: [] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});

	it('get: by URL, by numeric ID and by "page_id:" reference', async () => {
		const [byUrl] = await runOk({ resource: 'page', operation: 'get', params: { courseId, pageUrl } });
		expect(byUrl).toMatchObject({ page_id: Number(pageId), title });
		expect(String(byUrl.body)).toContain('Überschrift');

		const [byId] = await runOk({
			resource: 'page',
			operation: 'get',
			items: [{ id: Number(pageId) }],
			params: { courseId, pageUrl: '={{ $json.id }}' },
		});
		expect(byId.url).toBe(pageUrl);

		const [byRef] = await runOk({ resource: 'page', operation: 'get', params: { courseId, pageUrl: `page_id:${pageId}` } });
		expect(byRef.url).toBe(pageUrl);
	});

	it('get: page URLs with characters that need encoding', async () => {
		// Canvas transliterates this Arabic title to a slug containing a backtick.
		const arabic = await canvas().post<Json>(`/api/v1/courses/${courseId}/pages`, {
			wiki_page: { title: `صفحة عربية ${unique('')}`, body: '<p>rtl</p>' },
		});
		const [page] = await runOk({ resource: 'page', operation: 'get', params: { courseId, pageUrl: String(arabic.url) } });
		expect(page.page_id).toBe(arabic.page_id);
		const [deleted] = await runOk({ resource: 'page', operation: 'delete', params: { courseId, pageUrl: String(arabic.url) } });
		expect(deleted.page_id).toBe(arabic.page_id);
	});

	it('getAll: pages through more than 100 pages without duplicates', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pages?sort=title&order=asc`);
		expect(expected.length).toBeGreaterThan(BULK);

		const defaults = await runOk({ resource: 'page', operation: 'getAll', params: { courseId, options: { sort: 'title', order: 'asc' } } });
		expect(defaults.map((p) => p.page_id)).toEqual(expected.slice(0, 50).map((p) => p.page_id));

		const all = await runOk({
			resource: 'page',
			operation: 'getAll',
			params: { courseId, options: { sort: 'title', order: 'asc' }, pagination: { returnAll: true } },
		});
		expect(all.map((p) => p.page_id)).toEqual(expected.map((p) => p.page_id));
		expect(new Set(all.map((p) => p.page_id)).size).toBe(all.length);

		const some = await runOk({
			resource: 'page',
			operation: 'getAll',
			params: { courseId, options: { sort: 'title', order: 'asc' }, pagination: { perPage: 9, maxPages: 3 } },
		});
		expect(some.map((p) => p.page_id)).toEqual(expected.slice(0, 27).map((p) => p.page_id));
	});

	it('getAll: sort, order, search term, published filter and body include', async () => {
		const run = (options: Json): Promise<Json[]> =>
			runOk({ resource: 'page', operation: 'getAll', params: { courseId, options, pagination: { returnAll: true } } });

		const bulk = await run({ search_term: 'Bulk page', sort: 'title', order: 'desc' });
		expect(bulk).toHaveLength(BULK);
		expect(bulk[0].title).toBe(`Bulk page ${BULK}`);
		expect(bulk[BULK - 1].title).toBe('Bulk page 001');
		expect(bulk[0]).not.toHaveProperty('body');

		const published = await run({ search_term: 'Bulk page', published: true });
		const unpublished = await run({ search_term: 'Bulk page', published: false });
		expect(published.length + unpublished.length).toBe(BULK);
		expect(unpublished).toHaveLength(21);
		expect(published.every((p) => p.published === true)).toBe(true);
		expect(unpublished.every((p) => p.published === false)).toBe(true);

		const withBody = await run({ search_term: 'Bulk page 01', include: ['body'], sort: 'created_at' });
		expect(withBody).toHaveLength(10);
		for (const page of withBody) expect(String(page.body)).toContain(String(page.title));

		const newest = await run({ sort: 'updated_at', order: 'desc' });
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pages?sort=updated_at&order=desc`);
		expect(newest.map((p) => p.page_id)).toEqual(expected.map((p) => p.page_id));

		expect(await run({ search_term: 'there is no page with this title zzz' })).toEqual([]);
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'page',
			operation: 'update',
			params: {
				courseId,
				pageUrl,
				updateFields: {
					body: '<p>Second version</p>',
					editing_roles: ['teachers', 'students', 'public'],
					notify_of_update: true,
					publish_at: '2032-02-03T04:05:00Z',
					student_todo_at: '2032-06-07T08:09:00Z',
					title: renamed,
				},
			},
		});
		expect(updated.title).toBe(renamed);
		expect(updated.url).not.toBe(pageUrl);
		pageUrl = String(updated.url);

		expect(await pageFromCanvas(pageUrl)).toMatchObject({
			page_id: Number(pageId),
			title: renamed,
			body: '<p>Second version</p>',
			editing_roles: 'teachers,students,public',
			published: false,
			publish_at: '2032-02-03T04:05:00Z',
			todo_date: '2032-06-07T08:09:00Z',
		});
	});

	it('getFrontPage: a wiki without a front page reports not found', async () => {
		// A front page left behind by an interrupted run is demoted first.
		const leftover = await canvas().request('GET', `/api/v1/courses/${courseId}/front_page`);
		if (leftover.status === 200) {
			await canvas().put(`/api/v1/courses/${courseId}/pages/${String((leftover.data as Json).url)}`, {
				wiki_page: { front_page: false },
			});
		}
		const result = await runNode({
			resource: 'page',
			operation: 'getFrontPage',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			errorMessage: 'No front page has been set',
		});
	});

	it('update: publish, make it the front page, remove the to-do date', async () => {
		await runOk({
			resource: 'page',
			operation: 'update',
			params: {
				courseId,
				pageUrl,
				updateFields: { published: true, front_page: true, student_planner_checkbox: false, body: '<p>Third version</p>' },
			},
		});
		expect(await pageFromCanvas(pageUrl)).toMatchObject({ published: true, front_page: true, todo_date: null });
		const course = await canvas().get<Json>(`/api/v1/courses/${courseId}/front_page`);
		expect(course.page_id).toBe(Number(pageId));
	});

	it('update: the front page cannot be unpublished or deleted', async () => {
		const unpublish = await runNode({
			resource: 'page',
			operation: 'update',
			params: { courseId, pageUrl, updateFields: { published: false }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(unpublish.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		const remove = await runNode({
			resource: 'page',
			operation: 'delete',
			params: { courseId, pageUrl, errorHandling: { onError: 'continueWithError' } },
		});
		expect(remove.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'delete' });
		expect((await pageFromCanvas(pageUrl)).front_page).toBe(true);
	});

	it('getFrontPage: returns the front page of the course', async () => {
		const [front] = await runOk({ resource: 'page', operation: 'getFrontPage', params: { courseId } });
		expect(front).toMatchObject({ page_id: Number(pageId), front_page: true });
		expect(String(front.body)).toContain('Third version');
	});

	it('updateFrontPage: changes the front page without knowing its URL', async () => {
		const [updated] = await runOk({
			resource: 'page',
			operation: 'updateFrontPage',
			params: {
				courseId,
				updateFields: {
					body: '<p>Front page body</p>',
					editing_roles: ['teachers'],
					notify_of_update: false,
					published: true,
					title: `${title} (front)`,
				},
			},
		});
		expect(updated.page_id).toBe(Number(pageId));
		pageUrl = String(updated.url);
		expect(await pageFromCanvas(pageUrl)).toMatchObject({
			title: `${title} (front)`,
			body: '<p>Front page body</p>',
			editing_roles: 'teachers',
			front_page: true,
			published: true,
		});
	});

	it('update: an unknown page URL creates that page (Canvas "update or create")', async () => {
		const slug = unique('upsert').replace(/\s/g, '-').toLowerCase();
		const [created] = await runOk({
			resource: 'page',
			operation: 'update',
			params: { courseId, pageUrl: slug, updateFields: { body: '<p>made by update</p>' } },
		});
		expect(created).toMatchObject({ url: slug, body: '<p>made by update</p>' });
		expect((await pageFromCanvas(slug)).page_id).toBe(created.page_id);
		await canvas().delete(`/api/v1/courses/${courseId}/pages/${slug}`);
	});

	it('duplicate: copies the page', async () => {
		const [copy] = await runOk({ resource: 'page', operation: 'duplicate', params: { courseId, pageUrl } });
		expect(copy.page_id).not.toBe(Number(pageId));
		expect(String(copy.title)).toMatch(new RegExp('\\(front\\) .+'));
		const actual = await pageFromCanvas(String(copy.url));
		expect(actual).toMatchObject({ body: '<p>Front page body</p>', front_page: false, published: false });
		await canvas().delete(`/api/v1/courses/${courseId}/pages/${String(copy.url)}`);
	});

	it('listRevisions: returns every revision, newest first, and paginates', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pages/${pageUrl}/revisions`);
		expect(expected.length).toBeGreaterThanOrEqual(4);
		const revisions = await runOk({ resource: 'page', operation: 'listRevisions', params: { courseId, pageUrl } });
		expect(revisions.map((r) => r.revision_id)).toEqual(expected.map((r) => r.revision_id));
		expect(revisions[0].latest).toBe(true);
		expect(Number(revisions[0].revision_id)).toBeGreaterThan(Number(revisions[1].revision_id));

		const paged = await runOk({
			resource: 'page',
			operation: 'listRevisions',
			params: { courseId, pageUrl: `page_id:${pageId}`, pagination: { perPage: 1, maxPages: 2 } },
		});
		expect(paged.map((r) => r.revision_id)).toEqual(expected.slice(0, 2).map((r) => r.revision_id));
	});

	it('getRevision: latest by default, a specific revision, with or without content', async () => {
		const [latest] = await runOk({ resource: 'page', operation: 'getRevision', params: { courseId, pageUrl } });
		expect(latest).toMatchObject({ latest: true, body: '<p>Front page body</p>' });

		const [first] = await runOk({
			resource: 'page',
			operation: 'getRevision',
			items: [{ revision: 1 }],
			params: { courseId, pageUrl, revisionId: '={{ $json.revision }}' },
		});
		expect(first).toMatchObject({ revision_id: 1, latest: false, title });
		expect(String(first.body)).toContain('Überschrift');

		const [summary] = await runOk({
			resource: 'page',
			operation: 'getRevision',
			params: { courseId, pageUrl, revisionId: '2', options: { summary: true } },
		});
		expect(summary.revision_id).toBe(2);
		expect(summary).not.toHaveProperty('body');
		expect(summary).not.toHaveProperty('title');

		const missing = await runNode({
			resource: 'page',
			operation: 'getRevision',
			params: { courseId, pageUrl, revisionId: '9999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('revert: restores an earlier revision as a new revision', async () => {
		const before = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pages/${pageUrl}/revisions`);
		const [reverted] = await runOk({ resource: 'page', operation: 'revert', params: { courseId, pageUrl, revisionId: '2' } });
		expect(reverted).toMatchObject({ latest: true, body: '<p>Second version</p>' });
		expect(Number(reverted.revision_id)).toBe(Number(before[0].revision_id) + 1);
		// Reverting restores title and URL of that revision too.
		pageUrl = String(reverted.url);
		const actual = await pageFromCanvas(pageUrl);
		expect(actual).toMatchObject({ page_id: Number(pageId), body: '<p>Second version</p>', title: `${title} (renamed)` });
	});

	it('group context: create, get, list, update, revisions, front page and delete', async () => {
		const group = { contextType: 'group', groupId };
		const groupBase = `/api/v1/groups/${groupId}`;
		const groupTitle = unique('Group page ünï');

		const [created] = await runOk({
			resource: 'page',
			operation: 'create',
			params: { ...group, title: groupTitle, additionalFields: { body: '<p>group v1</p>', editing_roles: ['members'], published: true } },
		});
		let url = String(created.url);
		expect(await pageFromCanvas(url, groupBase)).toMatchObject({ title: groupTitle, editing_roles: 'members', published: true });

		const [fetched] = await runOk({ resource: 'page', operation: 'get', params: { ...group, pageUrl: url } });
		expect(fetched.page_id).toBe(created.page_id);

		const listed = await runOk({
			resource: 'page',
			operation: 'getAll',
			params: { ...group, options: { search_term: groupTitle, include: ['body'] }, pagination: { returnAll: true } },
		});
		expect(listed.map((p) => p.page_id)).toEqual([created.page_id]);
		expect(listed[0].body).toBe('<p>group v1</p>');

		const [updated] = await runOk({
			resource: 'page',
			operation: 'update',
			params: { ...group, pageUrl: url, updateFields: { body: '<p>group v2</p>', title: `${groupTitle} 2`, front_page: true } },
		});
		url = String(updated.url);
		expect(await pageFromCanvas(url, groupBase)).toMatchObject({ body: '<p>group v2</p>', title: `${groupTitle} 2`, front_page: true });

		const [front] = await runOk({ resource: 'page', operation: 'getFrontPage', params: group });
		expect(front.page_id).toBe(created.page_id);
		const [frontUpdated] = await runOk({
			resource: 'page',
			operation: 'updateFrontPage',
			params: { ...group, updateFields: { body: '<p>group v3</p>' } },
		});
		expect(frontUpdated.page_id).toBe(created.page_id);

		const revisions = await runOk({ resource: 'page', operation: 'listRevisions', params: { ...group, pageUrl: url } });
		expect(revisions.map((r) => r.revision_id)).toEqual([3, 2, 1]);
		const [revision] = await runOk({
			resource: 'page',
			operation: 'getRevision',
			params: { ...group, pageUrl: url, revisionId: '1', options: { summary: false } },
		});
		expect(revision.body).toBe('<p>group v1</p>');
		const [reverted] = await runOk({ resource: 'page', operation: 'revert', params: { ...group, pageUrl: url, revisionId: '1' } });
		expect(reverted).toMatchObject({ revision_id: 4, body: '<p>group v1</p>' });
		url = String(reverted.url);

		// A front page has to be replaced before it can be deleted: a new page created as the front page.
		const [other] = await runOk({
			resource: 'page',
			operation: 'create',
			params: { ...group, title: unique('Group front'), additionalFields: { published: true, front_page: true } },
		});
		expect(await pageFromCanvas(String(other.url), groupBase)).toMatchObject({ front_page: true });
		expect((await pageFromCanvas(url, groupBase)).front_page).toBe(false);
		const [deleted] = await runOk({ resource: 'page', operation: 'delete', params: { ...group, pageUrl: url } });
		expect(deleted.page_id).toBe(created.page_id);
		expect((await canvas().request('GET', `${groupBase}/pages/${url}`)).status).toBe(404);
		expect((await canvas().get<Json>(`${groupBase}/front_page`)).page_id).toBe(other.page_id);
	});

	it('errors: a student may not create pages; a missing page is not found; several items', async () => {
		const forbidden = await runNode({
			resource: 'page',
			operation: 'create',
			persona: 'student',
			params: { courseId, title: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const mixed = await runNode({
			resource: 'page',
			operation: 'get',
			items: [{ url: 'bulk-page-001' }, { url: 'this-page-does-not-exist' }, { url: 'bulk-page-105' }],
			params: { courseId, pageUrl: '={{ $json.url }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(mixed.success.map((p) => p.title)).toEqual(['Bulk page 001', 'Bulk page 105']);
		expect(mixed.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(mixed.error).toHaveLength(1);
		expect(mixed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'page', operation: 'get' });
	});

	it('delete: removes the page', async () => {
		const [deleted] = await runOk({ resource: 'page', operation: 'delete', params: { courseId, pageUrl } });
		expect(deleted.page_id).toBe(Number(pageId));
		expect((await canvas().request('GET', `/api/v1/courses/${courseId}/pages/${pageUrl}`)).status).toBe(404);

		const again = await runNode({
			resource: 'page',
			operation: 'delete',
			params: { courseId, pageUrl, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
