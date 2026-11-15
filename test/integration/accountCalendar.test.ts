import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { ids, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: accountCalendar. Calendar visibility of the seeded accounts is left
 * alone: the tests build their own branch of sub-accounts (one parent with more
 * children than a default page holds). For the duration of the file the observer
 * persona is made an admin of that branch, so its calendars show up in that
 * user's "available calendars" (the admin persona is left alone: an extra admin
 * role changes which cached lists Canvas serves it elsewhere).
 */

describe('accountCalendar', () => {
	const root = fx('accountId');
	const tag = unique('CalBat').replace(/\s/g, '-');
	let parentId = '';
	let outsiderId = '';
	const childIds: string[] = [];
	const CHILDREN = 12;

	const calendar = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/account_calendars/${id}`);

	beforeAll(async () => {
		const parent = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: `${tag} Parent Ünïcødé 日历` },
		});
		parentId = String(parent.id);
		for (let i = 0; i < CHILDREN; i++) {
			const child = await canvas().post<Json>(`/api/v1/accounts/${parentId}/sub_accounts`, {
				account: { name: `${tag} Child ${String(i).padStart(2, '0')}${i === 3 ? ' & "quotes" 🎒' : ''}` },
			});
			childIds.push(String(child.id));
		}
		// An account next to the branch, to prove that Update Many cannot reach outside of it.
		const outsider = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: `${tag} Outsider` },
		});
		outsiderId = String(outsider.id);
		// "Available calendars" lists the visible calendars below accounts the user is an admin of.
		await canvas().post(`/api/v1/accounts/${parentId}/admins`, {
			user_id: fx('observerUserId'),
			send_confirmation: false,
		});
	});

	afterAll(async () => {
		if (parentId) {
			await canvas().request('DELETE', `/api/v1/accounts/${parentId}/admins/${fx('observerUserId')}`);
		}
		for (const id of childIds) {
			await canvas().request('DELETE', `/api/v1/accounts/${parentId}/sub_accounts/${id}`);
		}
		for (const id of [parentId, outsiderId].filter(Boolean)) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${id}`);
		}
	});

	// --------------------------------------------------------------------- get

	it('get: returns the calendar settings of an account', async () => {
		const [result] = await runOk({ resource: 'accountCalendar', operation: 'get', params: { accountId: parentId } });
		expect(result).toEqual(await calendar(parentId));
		expect(result).toMatchObject({
			id: Number(parentId),
			parent_account_id: Number(root),
			visible: false,
			auto_subscribe: false,
			asset_string: `account_${parentId}`,
			type: 'account',
		});
	});

	it('get: several accounts, IDs as numbers, with an unknown one in between', async () => {
		const result = await runNode({
			resource: 'accountCalendar',
			operation: 'get',
			items: [{ id: Number(childIds[0]) }, { id: 99999999 }, { id: Number(childIds[1]) }],
			params: { accountId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((c) => c.id)).toEqual([Number(childIds[0]), Number(childIds[1])]);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'accountCalendar',
			operation: 'get',
		});
	});

	it('get: a teacher may not read the calendar settings of an account', async () => {
		const result = await runNode({
			resource: 'accountCalendar',
			operation: 'get',
			persona: 'teacher',
			params: { accountId: parentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------------ update

	it('update: both settings reach Canvas', async () => {
		const [updated] = await runOk({
			resource: 'accountCalendar',
			operation: 'update',
			params: { accountId: parentId, updateFields: { visible: true, auto_subscribe: true } },
		});
		expect(updated).toMatchObject({ id: Number(parentId), visible: true, auto_subscribe: true });
		expect(await calendar(parentId)).toMatchObject({ visible: true, auto_subscribe: true });
	});

	it('update: a single setting leaves the other untouched, and false is sent as false', async () => {
		await runOk({
			resource: 'accountCalendar',
			operation: 'update',
			params: { accountId: parentId, updateFields: { auto_subscribe: false } },
		});
		expect(await calendar(parentId)).toMatchObject({ visible: true, auto_subscribe: false });

		await runOk({
			resource: 'accountCalendar',
			operation: 'update',
			params: { accountId: childIds[0], updateFields: { visible: true } },
		});
		await runOk({
			resource: 'accountCalendar',
			operation: 'update',
			params: { accountId: childIds[0], updateFields: { visible: false } },
		});
		expect(await calendar(childIds[0])).toMatchObject({ visible: false, auto_subscribe: false });
	});

	it('update: a teacher is refused and nothing changes', async () => {
		const result = await runNode({
			resource: 'accountCalendar',
			operation: 'update',
			persona: 'teacher',
			params: {
				accountId: parentId,
				updateFields: { visible: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0].errorType).toBe('FORBIDDEN');
		expect((await calendar(parentId)).visible).toBe(true);
	});

	// -------------------------------------------------------------- updateMany

	it('updateMany: updates several calendars from JSON text', async () => {
		const calendars = childIds.map((id, index) => ({
			id: Number(id),
			visible: index !== 11,
			auto_subscribe: index % 2 === 0,
		}));
		const [result] = await runOk({
			resource: 'accountCalendar',
			operation: 'updateMany',
			params: { accountId: parentId, calendars: JSON.stringify(calendars, null, 2) },
		});
		expect(result.message).toBeTypeOf('string');
		expect(String(result.message)).toContain(String(CHILDREN));
		for (const [index, id] of childIds.entries()) {
			expect(await calendar(id), `child ${index}`).toMatchObject({
				visible: index !== 11,
				auto_subscribe: index % 2 === 0,
			});
		}
	});

	it('updateMany: only the given keys change, and string IDs are accepted', async () => {
		await runOk({
			resource: 'accountCalendar',
			operation: 'updateMany',
			params: {
				accountId: parentId,
				calendars: JSON.stringify([
					{ id: childIds[0], auto_subscribe: false },
					{ id: childIds[1], visible: true },
				]),
			},
		});
		expect(await calendar(childIds[0])).toMatchObject({ visible: true, auto_subscribe: false });
		expect(await calendar(childIds[1])).toMatchObject({ visible: true, auto_subscribe: false });
	});

	it('updateMany: calendars built by a previous node are passed with JSON.stringify() in the expression', async () => {
		const [result] = await runOk({
			resource: 'accountCalendar',
			operation: 'updateMany',
			items: [{ calendars: [{ id: Number(childIds[0]), auto_subscribe: true }] }],
			params: { accountId: parentId, calendars: '={{ JSON.stringify($json.calendars) }}' },
		});
		expect(result.message).toBeTypeOf('string');
		expect(await calendar(childIds[0])).toMatchObject({ visible: true, auto_subscribe: true });
	});

	it('updateMany: a list of objects straight from an expression works as well', async () => {
		const result = await runNode({
			resource: 'accountCalendar',
			operation: 'updateMany',
			items: [{ calendars: [{ id: Number(childIds[0]), auto_subscribe: false }] }],
			params: {
				accountId: parentId,
				calendars: '={{ $json.calendars }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(1);
		expect(await calendar(childIds[0])).toMatchObject({ visible: true, auto_subscribe: false });
	});

	it('updateMany: calendars outside the account, duplicates and malformed JSON are refused', async () => {
		const outside = await runNode({
			resource: 'accountCalendar',
			operation: 'updateMany',
			params: {
				accountId: parentId,
				calendars: JSON.stringify([{ id: Number(outsiderId), visible: true }]),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(outside.success).toEqual([]);
		expect(outside.error[0].errorType).toBe('FORBIDDEN');
		expect((await calendar(outsiderId)).visible).toBe(false);

		const duplicates = await runNode({
			resource: 'accountCalendar',
			operation: 'updateMany',
			params: {
				accountId: parentId,
				calendars: JSON.stringify([
					{ id: Number(childIds[2]), visible: false },
					{ id: Number(childIds[2]), visible: true },
				]),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(duplicates.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect((await calendar(childIds[2])).visible).toBe(true);

		for (const calendars of ['[{"id": 1, "visible": tr', '{"id": 1}', '[]', '[{"visible": true}]']) {
			const malformed = await runNode({
				resource: 'accountCalendar',
				operation: 'updateMany',
				params: { accountId: parentId, calendars, errorHandling: { onError: 'continueWithError' } },
			});
			expect(malformed.success, calendars).toEqual([]);
			const message = String(malformed.error[0]?.errorMessage ?? malformed.failure?.message);
			expect(message, calendars).toMatch(/Calendars/);
		}
	});

	// ------------------------------------------------------------ countVisible

	it('countVisible: counts the visible calendars of an account and everything below it', async () => {
		const [result] = await runOk({
			resource: 'accountCalendar',
			operation: 'countVisible',
			params: { accountId: parentId },
		});
		// The parent and every child but the last one.
		expect(result).toEqual({ count: CHILDREN });
		expect(result).toEqual(await canvas().get<Json>(`/api/v1/accounts/${parentId}/visible_calendars_count`));
	});

	// -------------------------------------------------------- getAllForAccount

	it('getAllForAccount: the account and its direct sub-accounts, hidden ones included, across pages', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${parentId}/account_calendars`);
		expect(expected).toHaveLength(CHILDREN + 1);

		const all = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId, pagination: { returnAll: true } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(all[0]).toMatchObject({ id: Number(parentId), visible: true, sub_account_count: CHILDREN });
		expect(all.find((c) => String(c.id) === childIds[11])).toMatchObject({ visible: false });

		const defaults = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId },
		});
		expect(defaults).toHaveLength(CHILDREN + 1);

		const paged = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(paged).toHaveLength(8);
		expect(new Set(ids(paged)).size).toBe(8);
	});

	it('getAllForAccount: filters by visibility and by name (searching all descendants)', async () => {
		const hidden = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId, options: { filter: 'hidden' }, pagination: { returnAll: true } },
		});
		expect(ids(hidden)).toEqual([Number(childIds[11])]);

		const visible = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId, options: { filter: 'visible' }, pagination: { returnAll: true } },
		});
		expect(ids(visible)).toEqual(ids([{ id: parentId }, ...childIds.slice(0, 11).map((id) => ({ id }))]));

		const searched = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: {
				accountId: root,
				options: { search_term: `${tag} Child 0`, filter: 'visible' },
				pagination: { returnAll: true },
			},
		});
		expect(ids(searched)).toEqual(ids(childIds.slice(0, 10).map((id) => ({ id }))));

		const quoted = await runOk({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId, options: { search_term: '& "quotes" 🎒' } },
		});
		expect(ids(quoted)).toEqual([Number(childIds[3])]);

		const none = await runNode({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			params: { accountId: parentId, options: { search_term: 'zzz-no-such-calendar' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('getAllForAccount: a teacher is refused', async () => {
		const result = await runNode({
			resource: 'accountCalendar',
			operation: 'getAllForAccount',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: lists the visible calendars available to the user, one item per calendar, across pages', async () => {
		const expected = await new CanvasClient('observer').getAll<Json>('/api/v1/account_calendars', 'account_calendars');
		const own = expected.filter((c) => String(c.name).startsWith(tag));
		expect(own).toHaveLength(CHILDREN);

		const all = await runOk({
			resource: 'accountCalendar',
			operation: 'getAll',
			persona: 'observer',
			params: { pagination: { returnAll: true } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		// One item per calendar: the { account_calendars, total_results } wrapper is unwrapped.
		expect(all[0].account_calendars).toBeUndefined();
		expect(all[0]).toMatchObject({ type: 'account', visible: true });
		expect(ids(all)).not.toContain(Number(childIds[11]));

		const defaults = await runOk({ resource: 'accountCalendar', operation: 'getAll', persona: 'observer' });
		expect(defaults).toHaveLength(Math.min(expected.length, 50));

		const paged = await runOk({
			resource: 'accountCalendar',
			operation: 'getAll',
			persona: 'observer',
			params: { pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(paged).toHaveLength(10);
		expect(new Set(ids(paged)).size).toBe(10);
	});

	it('getAll: the search term filters by name', async () => {
		const searched = await runOk({
			resource: 'accountCalendar',
			operation: 'getAll',
			persona: 'observer',
			params: { options: { search_term: `${tag} Child 1` }, pagination: { returnAll: true } },
		});
		// Children 10 and 11 match; 11 is hidden.
		expect(ids(searched)).toEqual([Number(childIds[10])]);

		const none = await runNode({
			resource: 'accountCalendar',
			operation: 'getAll',
			persona: 'observer',
			params: { options: { search_term: 'zzz-no-such-calendar' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('getAll: a user without visible calendars gets an empty list', async () => {
		const result = await runNode({ resource: 'accountCalendar', operation: 'getAll', persona: 'student' });
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success.filter((c) => String(c.name).startsWith(tag))).toEqual([]);
	});
});
