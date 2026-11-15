import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';
import { AUTHENTICATION_LINKS, expectedLinked } from './support/auditLinked';
import { createUser, deleteUser, WebSession } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * Resource: authenticationsLog (the audit log of logins and logouts). Read-only.
 * The log is fed by the logins that happen on the shared Canvas while the
 * battery runs, so it keeps growing: listings are compared as sets around the
 * moment the node ran.
 */

const eventIds = (events: Json[]): string[] => events.map((event) => String(event.id));
const links = (event: Json): Json => event.links as Json;

/** Everything that existed before and after must be listed; nothing unknown; no duplicates. */
function expectSameEvents(listed: Json[], before: Json[], after: Json[]): void {
	const listedIds = new Set(eventIds(listed));
	const beforeIds = new Set(eventIds(before));
	const afterIds = new Set(eventIds(after));
	expect(
		[...beforeIds].filter((id) => afterIds.has(id) && !listedIds.has(id)),
		'events missing from the node output',
	).toEqual([]);
	expect(
		[...listedIds].filter((id) => !beforeIds.has(id) && !afterIds.has(id)),
		'events the node returned that Canvas does not list',
	).toEqual([]);
	expect(listedIds.size, 'duplicates in the node output').toBe(listed.length);
}

describe('authenticationsLog', () => {
	const root = fx('accountId');
	const adminUser = fx('adminUserId');
	let adminLogin = '';
	const accountEvents = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/audit/authentication/accounts/${root}${query}`, 'events');
	const userEvents = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/audit/authentication/users/${adminUser}${query}`, 'events');

	beforeAll(async () => {
		const logins = await canvas().getAll<Json>(`/api/v1/users/${adminUser}/logins`);
		adminLogin = String(logins[0].id);
	});

	// --------------------------------------------------------- getAllByAccount

	it('getAllByAccount: Return All lists every event, one item per event, newest first', async () => {
		const before = await accountEvents();
		expect(before.length, 'the shared Canvas should have seen more logins than one page holds').toBeGreaterThan(10);

		const all = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: root, returnAll: true },
		});
		const after = await accountEvents();
		expectSameEvents(all, before, after);

		// One item per event: the { links, events, linked } wrapper is unwrapped.
		expect(all[0].events).toBeUndefined();
		for (const event of all) {
			expect(event.id).toBeTypeOf('string');
			expect(['login', 'logout']).toContain(event.event_type);
			expect(links(event).account).toBe(Number(root));
			expect(links(event).login).toBeTypeOf('number');
			expect(links(event).user).toBeTypeOf('number');
		}
		const times = all.map((event) => Date.parse(String(event.created_at)));
		expect(times).toEqual([...times].sort((a, b) => b - a));
	});

	it('getAllByAccount: Limit is honoured across page boundaries (default 50)', async () => {
		const total = (await accountEvents()).length;

		const defaults = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: 'self' },
		});
		expect(defaults.length).toBe(Math.min(total, 50));
		expect(new Set(eventIds(defaults)).size).toBe(defaults.length);

		const seven = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: root, returnAll: false, limit: 7 },
		});
		expect(seven).toHaveLength(7);

		// 9 events fetched in pages of 4: three requests, cut to the limit.
		const nine = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: root, returnAll: false, limit: 9, pagination: { perPage: 4 } },
		});
		expect(nine).toHaveLength(9);
		expect(new Set(eventIds(nine)).size).toBe(9);
		// Still newest first across the pages.
		const times = nine.map((event) => Date.parse(String(event.created_at)));
		expect(times).toEqual([...times].sort((a, b) => b - a));
	});

	it('getAllByAccount: Start Time and End Time bound the events', async () => {
		const everything = await accountEvents();
		// A window in the middle of the log: from the 9th newest back to the oldest but two.
		const endTime = String(everything[8].created_at);
		const startTime = String(everything[everything.length - 3].created_at);
		const query = `?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
		const expected = await accountEvents(query);

		const listed = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: root, returnAll: true, options: { start_time: startTime, end_time: endTime } },
		});
		expect(eventIds(listed).sort()).toEqual(eventIds(expected).sort());
		expect(listed.length).toBeGreaterThan(0);
		expect(listed.length).toBeLessThan(everything.length);
		for (const event of listed) {
			const at = Date.parse(String(event.created_at));
			expect(at).toBeGreaterThanOrEqual(Date.parse(startTime));
			expect(at).toBeLessThanOrEqual(Date.parse(endTime));
		}

		// Only a start: everything from then on, including the newest events.
		const sinceStart = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: root, returnAll: true, options: { start_time: endTime } },
		});
		expect(sinceStart.length).toBeGreaterThanOrEqual(9);
		expect(sinceStart.every((event) => Date.parse(String(event.created_at)) >= Date.parse(endTime))).toBe(true);

		// A window before anything happened: no items, no error.
		const none = await runNode({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: {
				accountId: root,
				returnAll: true,
				options: { start_time: '2020-01-01T00:00:00Z', end_time: '2020-01-02T00:00:00Z' },
			},
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('getAllByAccount: only root accounts have a log; a teacher is refused', async () => {
		const subAccount = await runNode({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: fx('subAccountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(subAccount.success).toEqual([]);
		expect(subAccount.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
		});

		const asTeacher = await runNode({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------ getAllByUser

	it('getAllByUser: lists the events of one user, by ID or as "self"', async () => {
		const before = await userEvents();
		expect(before.length, 'the admin persona has logged in at least once').toBeGreaterThan(0);

		const all = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			params: { userId: adminUser, returnAll: true },
		});
		expectSameEvents(all, before, await userEvents());
		expect(all.every((event) => links(event).user === Number(adminUser))).toBe(true);

		const asSelf = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			params: { userId: 'self', returnAll: false, limit: 1 },
		});
		expect(asSelf).toHaveLength(1);
		expect(links(asSelf[0]).user).toBe(Number(adminUser));
	});

	it('getAllByUser: time range, a user without logins, and several items with an unknown user', async () => {
		const everything = await userEvents();
		const newest = String(everything[0].created_at);
		const sinceNewest = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			params: { userId: adminUser, returnAll: true, options: { start_time: newest } },
		});
		expect(sinceNewest.length).toBeGreaterThanOrEqual(1);
		expect(sinceNewest.every((event) => Date.parse(String(event.created_at)) >= Date.parse(newest))).toBe(true);

		const beforeAll = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			params: { userId: adminUser, returnAll: true, options: { end_time: '2020-01-01T00:00:00Z' } },
		});
		expect(beforeAll).toEqual([]);

		const result = await runNode({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			items: [{ user: Number(fx('deletedUserId')) }, { user: Number(adminUser) }, { user: 99999999 }, { user: Number(fx('noEmailUserId')) }],
			params: {
				userId: '={{ $json.user }}',
				returnAll: false,
				limit: 2,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		// The seeded user without e-mail never logged in: no items, no error. The deleted and the unknown user are 404s.
		expect(result.success.length).toBeGreaterThanOrEqual(1);
		expect(result.success.length).toBeLessThanOrEqual(2);
		expect(new Set(pairedItems(result))).toEqual(new Set([1]));
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAllByUser' });
		}
	});

	it('getAllByUser: a teacher may not read someone else\'s log', async () => {
		const result = await runNode({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			persona: 'teacher',
			params: { userId: adminUser, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0].errorType).toBe('FORBIDDEN');
	});

	// ----------------------------------------------------------- getAllByLogin

	it('getAllByLogin: lists the events of one login', async () => {
		const path = `/api/v1/audit/authentication/logins/${adminLogin}`;
		const before = await canvas().getAll<Json>(path, 'events');
		const all = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByLogin',
			params: { loginId: adminLogin, returnAll: true },
		});
		expectSameEvents(all, before, await canvas().getAll<Json>(path, 'events'));
		expect(all.length).toBeGreaterThan(0);
		expect(all.every((event) => links(event).login === Number(adminLogin))).toBe(true);
		expect(all.every((event) => links(event).user === Number(adminUser))).toBe(true);

		const limited = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByLogin',
			items: [{ login: Number(adminLogin) }],
			params: {
				loginId: '={{ $json.login }}',
				returnAll: false,
				limit: 1,
				options: { start_time: '2020-01-01T00:00:00Z', end_time: '2040-01-01T00:00:00Z' },
			},
		});
		expect(limited).toHaveLength(1);
		expect(eventIds(limited)[0]).toBe(eventIds(all)[0]);
	});

	it('getAllByLogin: a login that was never used yields no items; deleted and unknown logins are 404s', async () => {
		const result = await runNode({
			resource: 'authenticationsLog',
			operation: 'getAllByLogin',
			items: [{ login: fx('samlLoginId') }, { login: fx('deletedLoginId') }, { login: '99999999' }],
			params: { loginId: '={{ $json.login }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAllByLogin' });
		}
		expect(result.error.map((e) => (e.originalItem as Json).login).sort()).toEqual(
			[fx('deletedLoginId'), '99999999'].sort(),
		);
	});

	// ---------------------------------------------------------- linked records

	it('every event carries the login, account, user and page view it refers to, from its own page', async () => {
		// The node reads pages of 4, Canvas is read directly in pages of 7: every event must
		// still get the records of the page it came on.
		const listed = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByAccount',
			params: { accountId: root, returnAll: false, limit: 25, pagination: { perPage: 4 } },
		});
		const expected = await expectedLinked(`/api/v1/audit/authentication/accounts/${root}`, AUTHENTICATION_LINKS);
		expect(listed).toHaveLength(25);
		let compared = 0;
		for (const item of listed) {
			const direct = expected.get(String(item.id));
			if (!direct) continue; // newer than the direct read (logins on the shared Canvas)
			compared++;
			const { linked, ...event } = item;
			expect(event).toEqual(direct.event);
			expect(linked).toEqual(direct.linked);
			expect(Object.keys(linked as Json).sort()).toEqual(['account', 'login', 'page_view', 'user']);
			expect(String(((linked as Json).user as Json).id)).toBe(String(links(item).user));
			expect(((linked as Json).user as Json).name).toBeTypeOf('string');
			expect(String(((linked as Json).login as Json).id)).toBe(String(links(item).login));
			expect(((linked as Json).login as Json).unique_id).toBeTypeOf('string');
			expect(String(((linked as Json).account as Json).id)).toBe(String(root));
		}
		expect(compared).toBeGreaterThan(20);
	});

	it('Include Linked Records off: the events exactly as Canvas lists them', async () => {
		const listed = await runOk({
			resource: 'authenticationsLog',
			operation: 'getAllByUser',
			params: { userId: adminUser, returnAll: false, limit: 5, includeLinked: false },
		});
		const direct = new Map((await userEvents()).map((event) => [String(event.id), event]));
		expect(listed.length).toBeGreaterThan(0);
		for (const item of listed) {
			expect(item).not.toHaveProperty('linked');
			const event = direct.get(String(item.id));
			if (event) expect(item).toEqual(event);
		}
	});

	describe('a login that has been deleted', () => {
		let user: OwnUser | undefined;
		afterAll(async () => deleteUser(user));

		it('keeps its name in the events: linked.login holds the deleted login', async () => {
			user = await createUser('Audit login');
			await new WebSession().login(user.login, user.password);
			const [firstLogin] = await canvas().get<Json[]>(`/api/v1/users/${user.id}/logins`);
			// Canvas keeps at least one login per user: add another before deleting the first.
			await canvas().post(`/api/v1/accounts/${root}/logins`, {
				user: { id: user.id },
				login: { unique_id: `second-${user.login}` },
			});
			await canvas().delete(`/api/v1/users/${user.id}/logins/${firstLogin.id}`);

			const events = await runOk({
				resource: 'authenticationsLog',
				operation: 'getAllByUser',
				params: { userId: user.id, returnAll: true },
			});
			const login = events.find((event) => event.event_type === 'login');
			expect(login, 'the web login must be in the log').toBeDefined();
			const linked = login!.linked as Json;
			expect(linked.login).toMatchObject({ id: firstLogin.id, unique_id: user.login, workflow_state: 'deleted' });
			expect(linked.user).toMatchObject({ id: Number(user.id), name: user.name });
			// The same as Canvas' own answer for that page.
			const expected = await expectedLinked(`/api/v1/audit/authentication/users/${user.id}`, AUTHENTICATION_LINKS);
			expect(linked).toEqual(expected.get(String(login!.id))!.linked);
		});
	});
});
