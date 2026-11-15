import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createDedicatedAdmin, createDedicatedUser, removeDedicatedAdmin, removeDedicatedUser } from './misc-support/dedicated';
import type { DedicatedUser } from './misc-support/dedicated';
import { createCourse, deleteCourses, uniqueSisId } from './misc-support/world';
import type { OwnCourse } from './misc-support/world';

vi.mock('../lib/state', async (original) =>
	(await import('./misc-support/state-overlay')).overlayState(await original()),
);

/**
 * Resource: ePortfolio. The Canvas API can list, show, delete, moderate and
 * restore ePortfolios but not create them, so the author (a user of the battery's
 * own) creates them the way a person does: signed in to the web interface.
 */
describe('ePortfolio', () => {
	let course: OwnCourse;
	let admin: DedicatedUser;
	let api: CanvasClient;
	let author: DedicatedUser;
	let peer: DedicatedUser;

	// Node runs default to the battery's own admin (own token, own rate-limit quota).
	const run = (opts: RunNodeOptions): Promise<RunNodeResult> => runNode({ persona: admin.persona, ...opts });
	const ok = (opts: RunNodeOptions): Promise<Json[]> => runOk({ persona: admin.persona, ...opts });
	const sisUserId = uniqueSisId('EP 1/2#?%&+');

	const TOTAL = 13;
	const PAGES = 14; // "Welcome" + the default page of the extra section + 12 added pages
	let portfolios: Json[] = [];
	let showcase = ''; // public, many pages
	let privateOne = '';
	let doomed = ''; // deleted and restored by the tests

	const listFor = async (include = false): Promise<Json[]> =>
		api.getAll<Json>(`/api/v1/users/${author.id}/eportfolios${include ? '?include[]=deleted' : ''}`);
	/** Current record, read from the list: Canvas refuses "get" on a deleted ePortfolio even to admins. */
	const state = async (id: string): Promise<Json> => {
		const found = (await listFor(true)).find((p) => String(p.id) === id);
		if (!found) throw new Error(`ePortfolio ${id} is not in the author's list`);
		return found;
	};

	beforeAll(async () => {
		admin = await createDedicatedAdmin('eportfolio');
		api = new CanvasClient(admin.persona);
		course = await createCourse('EPortfolio Home');
		[author, peer] = await Promise.all([
			createDedicatedUser('eportfolio-author', [{ courseId: course.id, type: 'StudentEnrollment' }], { sisUserId }),
			createDedicatedUser('eportfolio-peer', [{ courseId: course.id, type: 'StudentEnrollment' }]),
		]);

		const make = async (name: string, isPublic: boolean): Promise<string> => {
			const res = await author.session.request('POST', '/eportfolios', { eportfolio: { name, public: isPublic } });
			const id = ((res.data as Json | null)?.eportfolio as Json | undefined)?.id;
			if (res.status !== 200 || id === undefined) {
				throw new Error(`Could not create ePortfolio "${name}": HTTP ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
			}
			return String(id);
		};
		showcase = await make('Showcase — Ünïcødé 作品集 "quoted" & <b>tags</b> 🎨', true);
		privateOne = await make('Private drafts', false);
		doomed = await make('To be deleted', true);
		for (let i = 4; i <= TOTAL; i++) {
			await make(`Portfolio ${String(i).padStart(2, '0')}`, i % 2 === 0);
		}

		const section = await author.session.request('POST', `/eportfolios/${showcase}/categories`, {
			eportfolio_category: { name: 'Projects' },
		});
		const sectionId = ((section.data as Json | null)?.eportfolio_category as Json | undefined)?.id;
		for (let i = 1; i <= 12; i++) {
			const page = await author.session.request('POST', `/eportfolios/${showcase}/entries`, {
				eportfolio_entry: { name: `Project page ${String(i).padStart(2, '0')}`, eportfolio_category_id: sectionId },
			});
			if (page.status !== 200) throw new Error(`Could not create ePortfolio page: HTTP ${page.status}`);
		}
		portfolios = await listFor();
		expect(portfolios).toHaveLength(TOTAL);
	});

	afterAll(async () => {
		for (const portfolio of portfolios) {
			await api.request('DELETE', `/api/v1/eportfolios/${String(portfolio.id)}`).catch(() => undefined);
		}
		await Promise.all([removeDedicatedUser(author), removeDedicatedUser(peer)]);
		await deleteCourses([course]);
		await removeDedicatedAdmin(admin);
	});

	it('getAll: an admin lists a user\'s ePortfolios across pages', async () => {
		const expected = await listFor();
		const defaults = await ok({ resource: 'ePortfolio', operation: 'getAll', params: { userId: author.id } });
		expect(defaults.map((p) => p.id)).toEqual(expected.map((p) => p.id));
		expect(defaults.find((p) => String(p.id) === showcase)).toMatchObject({
			user_id: Number(author.id),
			name: 'Showcase — Ünïcødé 作品集 "quoted" & <b>tags</b> 🎨',
			public: true,
			workflow_state: 'active',
			spam_status: null,
		});
		expect(defaults.find((p) => String(p.id) === privateOne)).toMatchObject({ public: false });

		const twoPages = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			params: { userId: Number(author.id), pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((p) => p.id)).toEqual(expected.slice(0, 8).map((p) => p.id));

		const all = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			params: { userId: author.id, pagination: { returnAll: true, perPage: 5 } },
		});
		expect(all.map((p) => p.id)).toEqual(expected.map((p) => p.id));
		expect(new Set(all.map((p) => p.id)).size).toBe(TOTAL);
	});

	it('getAll: the user is found by "self" and by an SIS ID that needs URL encoding', async () => {
		const asSelf = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			persona: author.persona,
			params: { userId: 'self', pagination: { returnAll: true } },
		});
		expect(asSelf).toHaveLength(TOTAL);

		const bySis = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			params: { userId: `sis_user_id:${sisUserId}`, pagination: { returnAll: true } },
		});
		expect(bySis.map((p) => p.id)).toEqual(asSelf.map((p) => p.id));

		// The seeded user whose SIS ID has a slash, a colon and a semicolon is found too (and has none).
		const seededOdd = await run({
			resource: 'ePortfolio',
			operation: 'getAll',
			params: { userId: `sis_user_id:${fx('oddSisUserSisId')}` },
		});
		expect(seededOdd.ok).toBe(true);
		expect(seededOdd.error).toEqual([]);
		expect(seededOdd.success).toEqual(await api.getAll<Json>(`/api/v1/users/${fx('oddSisUserId')}/eportfolios`));
	});

	it('getAll: a user without ePortfolios yields no items; another student may not list someone else\'s', async () => {
		const none = await run({ resource: 'ePortfolio', operation: 'getAll', params: { userId: peer.id } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);

		const forbidden = await run({
			resource: 'ePortfolio',
			operation: 'getAll',
			persona: peer.persona,
			params: { userId: author.id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({
			errorType: 'FORBIDDEN',
			resource: 'ePortfolio',
			operation: 'getAll',
			endpoint: `/api/v1/users/${author.id}/eportfolios`,
		});
		expect([401, 403]).toContain(forbidden.error[0].errorCode);
	});

	it('get: admin and author see a private ePortfolio, another student only public ones', async () => {
		const [asAdmin] = await ok({ resource: 'ePortfolio', operation: 'get', params: { ePortfolioId: privateOne } });
		expect(asAdmin).toMatchObject({ id: Number(privateOne), name: 'Private drafts', public: false, user_id: Number(author.id) });
		const [asAuthor] = await ok({
			resource: 'ePortfolio',
			operation: 'get',
			persona: author.persona,
			params: { ePortfolioId: ` ${privateOne} ` },
		});
		expect(asAuthor).toEqual(asAdmin);

		const asPeer = await run({
			resource: 'ePortfolio',
			operation: 'get',
			persona: peer.persona,
			items: [{ id: Number(showcase) }, { id: Number(privateOne) }, { id: 999999999 }],
			params: { ePortfolioId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(asPeer.success.map((p) => p.id)).toEqual([Number(showcase)]);
		expect(asPeer.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }]);
		expect(asPeer.error).toHaveLength(2);
		expect(asPeer.error[0]).toMatchObject({ errorType: 'FORBIDDEN', originalItem: { id: Number(privateOne) } });
		expect(asPeer.error[1]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			originalItem: { id: 999999999 },
			errorMessage: expect.stringMatching(/\S/),
		});
	});

	it('getAllPages: every page of an ePortfolio in position order, across pages', async () => {
		const expected = await api.getAll<Json>(`/api/v1/eportfolios/${showcase}/pages`);
		expect(expected).toHaveLength(PAGES);

		// Canvas orders pages by their position inside their section, and pages of different sections
		// share positions, so the order among those is not stable between requests: compare as sets.
		const sorted = (items: Json[]): number[] => items.map((p) => Number(p.id)).sort((a, b) => a - b);
		const defaults = await ok({ resource: 'ePortfolio', operation: 'getAllPages', params: { ePortfolioId: showcase } });
		expect(sorted(defaults)).toEqual(sorted(expected));
		expect(defaults.map((p) => p.position)).toEqual(defaults.map((p) => p.position).slice().sort((a, b) => Number(a) - Number(b)));
		expect(defaults.filter((p) => /^Project page \d\d$/.test(String(p.name)))).toHaveLength(12);
		for (const page of defaults) {
			expect(page.eportfolio_id).toBe(Number(showcase));
			expect(Object.keys(page).sort()).toEqual(['content', 'created_at', 'eportfolio_id', 'id', 'name', 'position', 'updated_at']);
		}

		const firstPages = await ok({
			resource: 'ePortfolio',
			operation: 'getAllPages',
			persona: author.persona,
			params: { ePortfolioId: showcase, pagination: { perPage: 3, maxPages: 3 } },
		});
		expect(firstPages).toHaveLength(9);
		expect(new Set(firstPages.map((p) => p.id)).size).toBe(9);
		expect(sorted(expected)).toEqual(expect.arrayContaining(sorted(firstPages)));

		// A fresh ePortfolio has exactly its welcome page.
		const single = await ok({ resource: 'ePortfolio', operation: 'getAllPages', params: { ePortfolioId: privateOne } });
		expect(single).toHaveLength(1);
	});

	it('moderate: an admin marks an ePortfolio as spam and as safe again', async () => {
		const [spam] = await ok({
			resource: 'ePortfolio',
			operation: 'moderate',
			params: { ePortfolioId: showcase, spamStatus: 'marked_as_spam' },
		});
		expect(spam).toMatchObject({ id: Number(showcase), spam_status: 'marked_as_spam', workflow_state: 'active' });
		expect((await state(showcase)).spam_status).toBe('marked_as_spam');
		// Only that ePortfolio changed.
		expect((await state(privateOne)).spam_status).toBeNull();

		// While one of the author's ePortfolios is marked as spam, Canvas lets the author create no more.
		const blocked = await author.session.request('POST', '/eportfolios', { eportfolio: { name: 'Blocked', public: false } });
		expect([401, 403]).toContain(blocked.status);

		const [safe] = await ok({
			resource: 'ePortfolio',
			operation: 'moderate',
			params: { ePortfolioId: Number(showcase), spamStatus: 'marked_as_safe' },
		});
		expect(safe).toMatchObject({ id: Number(showcase), spam_status: 'marked_as_safe' });
		expect((await state(showcase)).spam_status).toBe('marked_as_safe');
	});

	it('moderate: several items with a mix of states, an invalid status and a missing ePortfolio', async () => {
		const result = await run({
			resource: 'ePortfolio',
			operation: 'moderate',
			items: [
				{ id: privateOne, status: 'marked_as_spam' },
				{ id: showcase, status: 'definitely_spam' },
				{ id: 999999999, status: 'marked_as_spam' },
				{ id: doomed, status: 'marked_as_safe' },
			],
			params: {
				ePortfolioId: '={{ $json.id }}',
				spamStatus: '={{ $json.status }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((p) => [p.id, p.spam_status])).toEqual([
			[Number(privateOne), 'marked_as_spam'],
			[Number(doomed), 'marked_as_safe'],
		]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 3 }]);
		expect(result.error).toHaveLength(2);
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			operation: 'moderate',
			endpoint: `/api/v1/eportfolios/${showcase}/moderate`,
		});
		expect(String(result.error[0].errorMessage)).toContain('spam_status must be one of');
		expect(result.error[1]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((await state(showcase)).spam_status).toBe('marked_as_safe');
		expect((await state(privateOne)).spam_status).toBe('marked_as_spam');
	});

	it('moderate: the author cannot moderate their own ePortfolio', async () => {
		const result = await run({
			resource: 'ePortfolio',
			operation: 'moderate',
			persona: author.persona,
			params: { ePortfolioId: privateOne, spamStatus: 'marked_as_safe', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'ePortfolio', operation: 'moderate' });
		expect((await state(privateOne)).spam_status).toBe('marked_as_spam');
	});

	it('delete: marks the ePortfolio as deleted (admin, and the author for their own)', async () => {
		const [deleted] = await ok({ resource: 'ePortfolio', operation: 'delete', params: { ePortfolioId: doomed } });
		expect(deleted).toMatchObject({ id: Number(doomed), workflow_state: 'deleted' });
		expect(deleted.deleted_at).toBeTypeOf('string');
		expect(await state(doomed)).toMatchObject({ workflow_state: 'deleted' });

		// Once deleted, Canvas refuses to show it, even to the admin who may restore it.
		const hidden = await run({
			resource: 'ePortfolio',
			operation: 'get',
			params: { ePortfolioId: doomed, errorHandling: { onError: 'continueWithError' } },
		});
		expect(hidden.success).toEqual([]);
		expect(hidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'get' });

		const ownId = String(portfolios.find((p) => p.name === 'Portfolio 13')?.id);
		const [own] = await ok({
			resource: 'ePortfolio',
			operation: 'delete',
			persona: author.persona,
			params: { ePortfolioId: ownId },
		});
		expect(own).toMatchObject({ id: Number(ownId), workflow_state: 'deleted' });
		expect((await listFor()).map((p) => p.id)).not.toContain(Number(ownId));
	});

	it('getAll: "Include Deleted" shows deleted ePortfolios to an admin only, and only when switched on', async () => {
		const active = await listFor();
		const withDeleted = await listFor(true);
		expect(active).toHaveLength(TOTAL - 2);
		expect(withDeleted).toHaveLength(TOTAL);

		const on = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			params: { userId: author.id, options: { include: true }, pagination: { returnAll: true } },
		});
		expect(on.map((p) => p.id).sort()).toEqual(withDeleted.map((p) => p.id).sort());
		expect(on.filter((p) => p.workflow_state === 'deleted')).toHaveLength(2);

		// Switched off (present but false) must not ask for deleted ones.
		const off = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			params: { userId: author.id, options: { include: false }, pagination: { returnAll: true } },
		});
		expect(off.map((p) => p.id).sort()).toEqual(active.map((p) => p.id).sort());

		// Users never see their own deleted ePortfolios, whatever they ask for.
		const own = await ok({
			resource: 'ePortfolio',
			operation: 'getAll',
			persona: author.persona,
			params: { userId: 'self', options: { include: true }, pagination: { returnAll: true } },
		});
		expect(own.map((p) => p.id).sort()).toEqual(active.map((p) => p.id).sort());
	});

	it('moderateAll: changes every active ePortfolio of the user and leaves deleted ones alone', async () => {
		const before = Object.fromEntries((await listFor(true)).map((p) => [String(p.id), p]));
		const [result] = await ok({
			resource: 'ePortfolio',
			operation: 'moderateAll',
			params: { userId: author.id, spamStatus: 'marked_as_spam' },
		});
		// Canvas answers with the bare JSON string "success".
		expect(result).toEqual({ value: 'success' });

		const after = await listFor(true);
		for (const portfolio of after) {
			if (portfolio.workflow_state === 'deleted') {
				expect(portfolio.spam_status, `deleted ${String(portfolio.id)}`).toBe(before[String(portfolio.id)].spam_status);
			} else {
				expect(portfolio.spam_status, `active ${String(portfolio.id)}`).toBe('marked_as_spam');
			}
		}

		// Back to safe, addressing the user by SIS ID.
		await ok({
			resource: 'ePortfolio',
			operation: 'moderateAll',
			params: { userId: `sis_user_id:${sisUserId}`, spamStatus: 'marked_as_safe' },
		});
		expect((await listFor()).every((p) => p.spam_status === 'marked_as_safe')).toBe(true);
	});

	it('moderateAll: needs an admin, and reports an unknown user', async () => {
		const asAuthor = await run({
			resource: 'ePortfolio',
			operation: 'moderateAll',
			persona: author.persona,
			params: { userId: 'self', spamStatus: 'marked_as_spam', errorHandling: { onError: 'continueWithError' } },
		});
		expect(asAuthor.success).toEqual([]);
		expect(asAuthor.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'moderateAll' });
		expect((await listFor()).every((p) => p.spam_status === 'marked_as_safe')).toBe(true);

		const missing = await run({
			resource: 'ePortfolio',
			operation: 'moderateAll',
			params: { userId: '999999999', spamStatus: 'marked_as_spam', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			endpoint: '/api/v1/users/999999999/eportfolios',
		});
	});

	it('restore: an admin brings a deleted ePortfolio back; its author cannot', async () => {
		const asAuthor = await run({
			resource: 'ePortfolio',
			operation: 'restore',
			persona: author.persona,
			params: { ePortfolioId: doomed, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asAuthor.success).toEqual([]);
		expect(asAuthor.error[0]).toMatchObject({
			errorType: 'FORBIDDEN',
			operation: 'restore',
			endpoint: `/api/v1/eportfolios/${doomed}/restore`,
		});
		expect((await state(doomed)).workflow_state).toBe('deleted');

		const [restored] = await ok({ resource: 'ePortfolio', operation: 'restore', params: { ePortfolioId: doomed } });
		expect(restored).toMatchObject({ id: Number(doomed), workflow_state: 'active', deleted_at: null, name: 'To be deleted' });
		expect(await state(doomed)).toMatchObject({ workflow_state: 'active', deleted_at: null });
		expect((await listFor()).map((p) => p.id)).toContain(Number(doomed));
	});

	it('restore / delete: an unknown ePortfolio is a 404 on the Error output', async () => {
		for (const operation of ['restore', 'delete', 'getAllPages']) {
			const result = await run({
				resource: 'ePortfolio',
				operation,
				params: { ePortfolioId: '999999999', errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'ePortfolio', operation });
		}
	});

	it('get / getAllPages: an unrelated user (shared student persona) reads a public ePortfolio, but not one marked as spam', async () => {
		const asStudent = new CanvasClient('student');
		expect((await asStudent.request('GET', `/api/v1/eportfolios/${showcase}`)).status).toBe(200);
		const [seen] = await ok({ resource: 'ePortfolio', operation: 'get', persona: 'student', params: { ePortfolioId: showcase } });
		expect(seen).toMatchObject({ id: Number(showcase), public: true, spam_status: 'marked_as_safe' });
		const pages = await ok({
			resource: 'ePortfolio',
			operation: 'getAllPages',
			persona: 'student',
			params: { ePortfolioId: showcase, pagination: { returnAll: true } },
		});
		expect(pages).toHaveLength(PAGES);

		await api.put(`/api/v1/eportfolios/${showcase}/moderate`, { spam_status: 'marked_as_spam' });
		const hidden = await run({
			resource: 'ePortfolio',
			operation: 'get',
			persona: 'student',
			params: { ePortfolioId: showcase, errorHandling: { onError: 'continueWithError' } },
		});
		expect(hidden.success).toEqual([]);
		expect(hidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'ePortfolio', operation: 'get' });
		await api.put(`/api/v1/eportfolios/${showcase}/moderate`, { spam_status: 'marked_as_safe' });
	});
});
