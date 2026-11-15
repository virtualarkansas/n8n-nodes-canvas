import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createDedicatedUser, removeDedicatedUser } from './misc-support/dedicated';
import type { DedicatedUser } from './misc-support/dedicated';

vi.mock('../lib/state', async (original) =>
	(await import('./misc-support/state-overlay')).overlayState(await original()),
);

/**
 * Resource: bookmark. Bookmarks belong to the user of the credential
 * (/api/v1/users/self/bookmarks), so the battery uses a user of its own rather
 * than a shared persona. Writes are verified by reading back from Canvas directly.
 */
describe('bookmark', () => {
	let owner: DedicatedUser;
	let other: DedicatedUser;
	let asOwner: CanvasClient;
	let bookmarkId = '';

	const name = 'Biology 101 — Ünïcødé 课程 "quoted" & <b>tags</b> 🔖';
	const url = '/courses/6/modules?filter=a&b=c#module_12';

	beforeAll(async () => {
		[owner, other] = await Promise.all([createDedicatedUser('bookmarks'), createDedicatedUser('bookmarks-other')]);
		asOwner = new CanvasClient(owner.persona);
	});

	afterAll(async () => {
		await Promise.all([removeDedicatedUser(owner), removeDedicatedUser(other)]);
	});

	const ids = async (): Promise<number[]> =>
		(await asOwner.getAll<Json>('/api/v1/users/self/bookmarks')).map((b) => Number(b.id));

	it('getAll: a user without bookmarks gets an empty list (no items, no error)', async () => {
		const result = await runNode({ resource: 'bookmark', operation: 'getAll', persona: owner.persona });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('create: name, URL, data and position reach Canvas', async () => {
		const data = { active_tab: 1, labels: ['a', 'b'], nested: { ünï: 'cødé', n: 1.5, ok: true, none: null } };
		const [created] = await runOk({
			resource: 'bookmark',
			operation: 'create',
			persona: owner.persona,
			params: { name, url, additionalFields: { data: JSON.stringify(data), position: 1 } },
		});
		bookmarkId = String(created.id);
		expect(created).toMatchObject({ name, url, position: 1, data });

		const actual = await asOwner.get<Json>(`/api/v1/users/self/bookmarks/${bookmarkId}`);
		expect(actual).toMatchObject({ id: Number(bookmarkId), name, url, position: 1 });
		// The JSON text of the field is stored as a structure, not as one long string.
		expect(actual.data).toEqual(data);
	});

	it('create: without optional fields the bookmark goes to the bottom and has no data', async () => {
		const [created] = await runOk({
			resource: 'bookmark',
			operation: 'create',
			persona: owner.persona,
			params: { name: 'Second', url: 'https://example.com/second?x=1&y=2' },
		});
		const actual = await asOwner.get<Json>(`/api/v1/users/self/bookmarks/${String(created.id)}`);
		expect(actual).toMatchObject({ name: 'Second', url: 'https://example.com/second?x=1&y=2', position: 2, data: null });
	});

	it('create: data given as an object by an expression, and as a JSON array', async () => {
		const result = await runNode({
			resource: 'bookmark',
			operation: 'create',
			persona: owner.persona,
			items: [{ title: 'From object', data: { tab: 2, tags: ['x'] } }, { title: 'From array text', data: '[1, "two", {"three": 3}]' }],
			params: { name: '={{ $json.title }}', url: '/x', additionalFields: { data: '={{ $json.data }}' } },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((b) => b.data)).toEqual([{ tab: 2, tags: ['x'] }, [1, 'two', { three: 3 }]]);
		for (const item of result.success) {
			const actual = await asOwner.get<Json>(`/api/v1/users/self/bookmarks/${String(item.id)}`);
			expect(actual.data).toEqual(item.data);
		}
	});

	it('create: a position in the middle shifts the bookmarks after it', async () => {
		const before = await ids();
		const [created] = await runOk({
			resource: 'bookmark',
			operation: 'create',
			persona: owner.persona,
			params: { name: 'Inserted at 2', url: '/inserted', additionalFields: { position: 2 } },
		});
		const after = await asOwner.getAll<Json>('/api/v1/users/self/bookmarks');
		expect(after.map((b) => b.id)).toEqual([before[0], created.id, ...before.slice(1)]);
		expect(after.map((b) => b.position)).toEqual(after.map((_, i) => i + 1));
	});

	it('create: invalid JSON in Data is rejected by the node before anything is sent', async () => {
		const before = await ids();
		const result = await runNode({
			resource: 'bookmark',
			operation: 'create',
			persona: owner.persona,
			params: { name: 'Broken', url: '/broken', additionalFields: { data: '{not json' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 0, resource: 'bookmark', operation: 'create' });
		expect(String(result.error[0].errorMessage)).toContain('must be valid JSON');
		// SHARED-BUG: should be INVALID_PARAMETERS. GenericFunctions.createErrorOutput recognises handler
		// errors by `error.name === 'ApplicationError'`, but n8n's ApplicationError keeps the name "Error",
		// so every validation error thrown by a handler is reported as UNKNOWN (see crosscutting.test.ts).
		expect(result.error[0].errorType).toBe('UNKNOWN');
		expect(await ids()).toEqual(before);
	});

	it('get: returns the bookmark; the ID may arrive as a number or with stray whitespace', async () => {
		const result = await runNode({
			resource: 'bookmark',
			operation: 'get',
			persona: owner.persona,
			items: [{ id: Number(bookmarkId) }, { id: `  ${bookmarkId}\n` }],
			params: { bookmarkId: '={{ $json.id }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(2);
		for (const item of result.success) {
			expect(item).toMatchObject({ id: Number(bookmarkId), name, url });
		}
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('getAll: lists every bookmark in position order, across pages', async () => {
		// Enough bookmarks for more than one default page (10 per page).
		const extra = await runNode({
			resource: 'bookmark',
			operation: 'create',
			persona: owner.persona,
			items: Array.from({ length: 21 }, (_, i) => ({ n: i })),
			params: { name: '=Bulk {{ $json.n }}', url: '=/bulk/{{ $json.n }}', batchProcessing: { mode: 'individual' } },
		});
		expect(extra.error).toEqual([]);
		expect(extra.success).toHaveLength(21);

		const expected = await asOwner.getAll<Json>('/api/v1/users/self/bookmarks');
		expect(expected.length).toBe(26);

		const defaults = await runOk({ resource: 'bookmark', operation: 'getAll', persona: owner.persona });
		expect(defaults.map((b) => b.id)).toEqual(expected.map((b) => b.id));
		expect(defaults.map((b) => b.position)).toEqual(expected.map((_, i) => i + 1));

		const twoPages = await runOk({
			resource: 'bookmark',
			operation: 'getAll',
			persona: owner.persona,
			params: { pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((b) => b.id)).toEqual(expected.slice(0, 8).map((b) => b.id));

		const all = await runOk({
			resource: 'bookmark',
			operation: 'getAll',
			persona: owner.persona,
			params: { pagination: { returnAll: true, perPage: 7 } },
		});
		expect(all.map((b) => b.id)).toEqual(expected.map((b) => b.id));
		expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
	});

	it('update: every field reaches Canvas, and moving a bookmark renumbers the others', async () => {
		const before = await ids();
		expect(before[0]).toBe(Number(bookmarkId));
		const [updated] = await runOk({
			resource: 'bookmark',
			operation: 'update',
			persona: owner.persona,
			params: {
				bookmarkId,
				updateFields: {
					name: 'Renamed مرحبا שלום',
					url: 'https://example.com/renamed?q=a%20b&r="x"',
					data: '{"active_tab": 3, "note": "updated"}',
					position: 3,
				},
			},
		});
		expect(updated).toMatchObject({ id: Number(bookmarkId), name: 'Renamed مرحبا שלום', position: 3 });

		const actual = await asOwner.get<Json>(`/api/v1/users/self/bookmarks/${bookmarkId}`);
		expect(actual).toMatchObject({
			name: 'Renamed مرحبا שלום',
			url: 'https://example.com/renamed?q=a%20b&r="x"',
			position: 3,
			data: { active_tab: 3, note: 'updated' },
		});
		const after = await ids();
		expect(after.slice(0, 4)).toEqual([before[1], before[2], Number(bookmarkId), before[3]]);
		expect(after.slice().sort()).toEqual(before.slice().sort());
	});

	it('update: only the given field changes', async () => {
		const [updated] = await runOk({
			resource: 'bookmark',
			operation: 'update',
			persona: owner.persona,
			params: { bookmarkId, updateFields: { name: 'Only the name' } },
		});
		expect(updated.name).toBe('Only the name');
		const actual = await asOwner.get<Json>(`/api/v1/users/self/bookmarks/${bookmarkId}`);
		expect(actual).toMatchObject({
			name: 'Only the name',
			url: 'https://example.com/renamed?q=a%20b&r="x"',
			position: 3,
			data: { active_tab: 3, note: 'updated' },
		});
	});

	it('errors: another user\'s bookmark is invisible (404 on get, update and delete)', async () => {
		for (const operation of ['get', 'update', 'delete']) {
			const result = await runNode({
				resource: 'bookmark',
				operation,
				persona: other.persona,
				params: {
					bookmarkId,
					...(operation === 'update' ? { updateFields: { name: 'Hijacked' } } : {}),
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({
				errorCode: 404,
				errorType: 'NOT_FOUND',
				resource: 'bookmark',
				operation,
				endpoint: `/api/v1/users/self/bookmarks/${bookmarkId}`,
			});
		}
		expect((await asOwner.get<Json>(`/api/v1/users/self/bookmarks/${bookmarkId}`)).name).toBe('Only the name');
	});

	it('errors: several items with one missing bookmark; only that item fails', async () => {
		const [first, second] = await ids();
		const result = await runNode({
			resource: 'bookmark',
			operation: 'get',
			persona: owner.persona,
			items: [{ id: first }, { id: 999999999 }, { id: second }],
			params: { bookmarkId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((b) => b.id)).toEqual([first, second]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: 999999999 } });
	});

	it('errors: an empty bookmark ID is refused by the node with a clear message', async () => {
		const result = await runNode({
			resource: 'bookmark',
			operation: 'get',
			persona: owner.persona,
			items: [{ id: '' }],
			params: { bookmarkId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS', errorCode: 0 });
		expect(String(result.error[0].errorMessage)).toContain('A required parameter is empty for bookmark/get');
	});

	it('delete: removes the bookmark and returns it; the rest keep their order', async () => {
		const before = await ids();
		const [deleted] = await runOk({ resource: 'bookmark', operation: 'delete', persona: owner.persona, params: { bookmarkId } });
		expect(deleted).toMatchObject({ id: Number(bookmarkId), name: 'Only the name' });

		const gone = await asOwner.request('GET', `/api/v1/users/self/bookmarks/${bookmarkId}`);
		expect(gone.status).toBe(404);
		expect(await ids()).toEqual(before.filter((id) => id !== Number(bookmarkId)));
	});

	it('delete: several bookmarks in one run, including one that is already gone', async () => {
		const remaining = await ids();
		const targets = remaining.slice(0, 3);
		const result = await runNode({
			resource: 'bookmark',
			operation: 'delete',
			persona: owner.persona,
			items: [{ id: targets[0] }, { id: Number(bookmarkId) }, { id: targets[1] }, { id: targets[2] }],
			params: { bookmarkId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((b) => b.id)).toEqual(targets);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: Number(bookmarkId) } });
		expect(await ids()).toEqual(remaining.slice(3));
	});
});
