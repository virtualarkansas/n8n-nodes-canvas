import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ownPersona, removePersonas } from './support/ownPersonas';
import type { OwnPersona } from './support/ownPersonas';

/**
 * Resource: userCustomData. Data is only stored for users created by this file,
 * in namespaces of its own. Every write is verified by reading the namespace back
 * from Canvas directly.
 */
describe('userCustomData', () => {
	const account = fx('accountId');
	const ns = `n8n.battery.${unique('ns').replace(/[^a-z0-9]+/gi, '-')}`;
	const sisId = unique('SIS-CD').replace(/\s/g, '_');
	const users: string[] = [];
	let owner: OwnPersona;
	let userId = '';

	const refuse = { errorHandling: { onError: 'continueWithError' } };
	/** Everything Canvas holds for a user in a namespace (undefined when there is nothing). */
	const stored = async (id: string, namespace = ns): Promise<unknown> => {
		const res = await canvas().request('GET', `/api/v1/users/${id}/custom_data?ns=${encodeURIComponent(namespace)}`);
		return res.status === 200 ? (res.data as Json).data : undefined;
	};

	beforeAll(async () => {
		owner = await ownPersona('Custom Data Owner');
		for (let i = 1; i <= 3; i++) {
			const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
				user: { name: `${unique('Custom Data User')} ${i}`, skip_registration: true },
				pseudonym: {
					unique_id: `${unique('cdata').replace(/\s/g, '.')}@example.edu`,
					send_confirmation: false,
					...(i === 1 ? { sis_user_id: sisId } : {}),
				},
			});
			users.push(String(user.id));
		}
		userId = users[0];
	}, 360_000);

	afterAll(async () => {
		for (const id of users) {
			await canvas().request('DELETE', `/api/v1/users/${id}/custom_data?ns=${encodeURIComponent(ns)}`);
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
		await removePersonas([owner]);
	});

	const everything = {
		text: 'Ünïcødé 测试 "quoted" & <b>tags</b> 🎓',
		number: 6.02e23,
		integer: -42,
		yes: true,
		no: false,
		nothing: null,
		list: [1, 'two', false, { deep: ['x', 'y'] }],
		'key with spaces': { 'ключ': 'значение', empty: '' },
		favorites: { dessert: 'pistachio ice cream', meat: 'pork belly' },
	};

	it('set: stores any JSON at the root of a namespace, and reports it as Canvas stored it', async () => {
		expect(await stored(userId)).toBeUndefined();
		const [result] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			params: { userId, namespace: ns, data: JSON.stringify(everything) },
		});
		expect(result).toEqual({ data: everything });
		expect(await stored(userId)).toEqual(everything);
	});

	it('set: with a scope only that part changes; nested objects become scopes of their own', async () => {
		const [nested] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			params: {
				userId: Number(userId),
				namespace: ns,
				data: '{ "waist": "32in", "inseam": { "left": 34, "right": 34.5 } }',
				options: { scope: 'body/measurements' },
			},
		});
		expect(nested).toEqual({ data: { waist: '32in', inseam: { left: 34, right: 34.5 } } });

		// Leading, trailing and doubled slashes are tolerated; an existing value is replaced.
		const [leaf] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			params: { userId, namespace: ns, data: '"cherry pie"', options: { scope: '/favorites//dessert/' } },
		});
		expect(leaf).toEqual({ data: 'cherry pie' });

		expect(await stored(userId)).toEqual({
			...everything,
			favorites: { dessert: 'cherry pie', meat: 'pork belly' },
			body: { measurements: { waist: '32in', inseam: { left: 34, right: 34.5 } } },
		});
		const direct = await canvas().get<Json>(`/api/v1/users/${userId}/custom_data/body/measurements/inseam/right?ns=${ns}`);
		expect(direct.data).toBe(34.5);
	});

	it('set: scope parts with spaces, percent signs, umlauts and reserved characters are separate path segments', async () => {
		const scope = 'key with spaces/100% äöü & more?/x#y';
		const [result] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			params: { userId, namespace: ns, data: '{"ok": true}', options: { scope } },
		});
		expect(result).toEqual({ data: { ok: true } });
		const all = (await stored(userId)) as Json;
		expect((all['key with spaces'] as Json)['100% äöü & more?']).toEqual({ 'x#y': { ok: true } });
		// What was there before under the first part is still there.
		expect((all['key with spaces'] as Json)['ключ']).toBe('значение');

		const [read] = await runOk({ resource: 'userCustomData', operation: 'get', params: { userId, namespace: ns, options: { scope } } });
		expect(read).toEqual({ data: { ok: true } });

		// The request really is sent with one path segment per part (slashes are not escaped).
		for (const [given, path] of [
			[scope, 'key%20with%20spaces/100%25%20%C3%A4%C3%B6%C3%BC%20%26%20more%3F/x%23y'],
			['body/measurements/inseam', 'body/measurements/inseam'],
		]) {
			const debug = await runNode({
				resource: 'userCustomData',
				operation: 'get',
				params: { userId, namespace: ns, options: { scope: given }, debugMode: true },
			});
			expect(String(debug.debug[0].url).split('?')[0]).toBe(`${canvas().url}/api/v1/users/${userId}/custom_data/${path}`);
		}
	});

	it('get: the whole namespace, objects, lists, texts, numbers and values that are not there', async () => {
		const all = (await stored(userId)) as Json;
		const [whole] = await runOk({ resource: 'userCustomData', operation: 'get', params: { userId, namespace: ns } });
		expect(whole).toEqual({ data: all });

		const expectations: Array<[string, unknown]> = [
			['favorites', { dessert: 'cherry pie', meat: 'pork belly' }],
			['favorites/meat', 'pork belly'],
			['list', everything.list],
			['number', 6.02e23],
			['no', false],
			['nothing', null],
			['text', everything.text],
			['body/measurements/inseam/left', 34],
			// A key that does not exist reads as null, like Canvas answers it.
			['favorites/soup', null],
		];
		const result = await runNode({
			resource: 'userCustomData',
			operation: 'get',
			items: expectations.map(([scope]) => ({ scope })),
			params: { userId: `sis_user_id:${sisId}`, namespace: ns, options: { scope: '={{ $json.scope }}' } },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		// One item per input item, whatever the type of the data (a list is not split into items).
		expect(result.success).toEqual(expectations.map(([, data]) => ({ data })));
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual(expectations.map((_, index) => index));
	});

	it('get: a scope that leads through a value that is no object, and a namespace without data, are refused', async () => {
		const result = await runNode({
			resource: 'userCustomData',
			operation: 'get',
			items: [{ ns, scope: 'favorites/meat/cut' }, { ns: `${ns}.unused`, scope: '' }, { ns, scope: 'favorites/meat' }],
			params: { userId, namespace: '={{ $json.ns }}', options: { scope: '={{ $json.scope }}' }, ...refuse },
		});
		expect(result.success).toEqual([{ data: 'pork belly' }]);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([2]);
		expect(result.error.map((e) => [e.errorCode, e.errorType, e.errorMessage])).toEqual([
			[400, 'VALIDATION_ERROR', 'invalid scope for hash'],
			[400, 'VALIDATION_ERROR', 'no data for scope'],
		]);
		expect(result.error[0]).toMatchObject({ resource: 'userCustomData', operation: 'get' });
	});

	it('set: values from expressions (object, number, false, JSON text) and several users per run', async () => {
		const result = await runNode({
			resource: 'userCustomData',
			operation: 'set',
			items: [
				{ user: Number(users[1]), scope: 'profile', value: { tags: ['a', 'b'], level: 3, mentor: null } },
				{ user: Number(users[1]), scope: 'score', value: 97.5 },
				{ user: Number(users[2]), scope: 'active', value: false },
				{ user: Number(users[2]), scope: 'phone', value: JSON.stringify('555-1234') },
				{ user: Number(users[2]), scope: 'tags', value: JSON.stringify(['x', 'y']) },
			],
			params: {
				userId: '={{ $json.user }}',
				namespace: ns,
				data: '={{ $json.value }}',
				options: { scope: '={{ $json.scope }}' },
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([
			{ data: { tags: ['a', 'b'], level: 3, mentor: null } },
			{ data: 97.5 },
			{ data: false },
			{ data: '555-1234' },
			{ data: ['x', 'y'] },
		]);
		expect(await stored(users[1])).toEqual({ profile: { tags: ['a', 'b'], level: 3, mentor: null }, score: 97.5 });
		expect(await stored(users[2])).toEqual({ active: false, phone: '555-1234', tags: ['x', 'y'] });
	});

	it('set: Canvas drops null entries from lists (and keeps null values of objects)', async () => {
		const [result] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			params: { userId: users[1], namespace: ns, data: '{"list": [1, null, "two", null], "gap": null}', options: { scope: 'nulls' } },
		});
		expect(result).toEqual({ data: { list: [1, 'two'], gap: null } });
		expect(((await stored(users[1])) as Json).nulls).toEqual({ list: [1, 'two'], gap: null });
	});

	it('set: text that is not JSON, missing data and null are rejected; a scope below a text is a conflict', async () => {
		const before = await stored(users[1]);
		const attempt = (data: string, scope = 'attempt') =>
			runNode({
				resource: 'userCustomData',
				operation: 'set',
				params: { userId: users[1], namespace: ns, data, options: { scope }, ...refuse },
			});

		const plainText = await attempt('555-1234');
		expect(plainText.success).toEqual([]);
		expect(plainText.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'userCustomData', operation: 'set' });
		expect(String(plainText.error[0].errorMessage)).toContain('not valid JSON');

		const blank = await attempt('   ');
		expect(blank.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(blank.error[0].errorMessage)).toContain('Enter the data to store');

		const nothing = await attempt('null');
		expect(nothing.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(nothing.error[0].errorMessage)).toContain('no data specified');

		// "score" holds a number; storing below it would destroy that number.
		const conflict = await attempt('"deeper"', 'score/detail');
		expect(conflict.success).toEqual([]);
		expect(conflict.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT', resource: 'userCustomData', operation: 'set' });
		expect(String(conflict.error[0].errorMessage)).toContain('write conflict for custom_data hash');

		expect(await stored(users[1])).toEqual(before);
	});

	// Canvas names what is in the way: { message, conflict_scope, type_at_conflict, value_at_conflict }.
	// The node's error output keeps only the message of an error body that has one; the rest of the
	// record is dropped (toErrorOutput in GenericFunctions.ts hands a body on as `responseBody` only
	// when it has no errors / error / message key at all).
	it('set [needs shared change]: a write conflict reports the scope and value that are in the way', async () => {
		const conflict = await runNode({
			resource: 'userCustomData',
			operation: 'set',
			params: { userId: users[1], namespace: ns, data: '"deeper"', options: { scope: 'score/detail/more' }, ...refuse },
		});
		expect(conflict.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT' });
		expect(conflict.error[0].responseBody).toMatchObject({
			conflict_scope: 'score',
			type_at_conflict: 'Float',
			value_at_conflict: 97.5,
		});
	});

	it('namespaces keep data apart', async () => {
		const other = `${ns}.other`;
		const [result] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			params: { userId: users[1], namespace: other, data: '{"score": "from another app"}' },
		});
		expect(result).toEqual({ data: { score: 'from another app' } });
		expect(await stored(users[1], other)).toEqual({ score: 'from another app' });
		expect(((await stored(users[1])) as Json).score).toBe(97.5);

		const [deleted] = await runOk({ resource: 'userCustomData', operation: 'delete', params: { userId: users[1], namespace: other } });
		expect(deleted).toEqual({ data: { score: 'from another app' } });
		expect(await stored(users[1], other)).toBeUndefined();
		expect(((await stored(users[1])) as Json).score).toBe(97.5);
	});

	it('delete: returns what was deleted; parents left empty disappear; a scope that is not there is refused', async () => {
		const result = await runNode({
			resource: 'userCustomData',
			operation: 'delete',
			items: [{ scope: 'body/measurements/waist' }, { scope: 'not/there' }, { scope: 'body/measurements/inseam' }, { scope: 'list' }],
			params: { userId, namespace: ns, options: { scope: '={{ $json.scope }}' }, batchProcessing: { mode: 'individual' }, ...refuse },
		});
		expect(result.success).toEqual([{ data: '32in' }, { data: { left: 34, right: 34.5 } }, { data: everything.list }]);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2, 3]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'invalid scope for hash', resource: 'userCustomData', operation: 'delete' });

		const left = (await stored(userId)) as Json;
		// "body" only held "measurements", which only held the two deleted values.
		expect(left).not.toHaveProperty('body');
		expect(left).not.toHaveProperty('list');
		expect(left.favorites).toEqual({ dessert: 'cherry pie', meat: 'pork belly' });
	});

	it('delete: without a scope everything in the namespace goes; deleting again is refused', async () => {
		const all = await stored(userId);
		const [deleted] = await runOk({ resource: 'userCustomData', operation: 'delete', params: { userId, namespace: ns } });
		expect(deleted).toEqual({ data: all });
		expect(await stored(userId)).toBeUndefined();

		const again = await runNode({ resource: 'userCustomData', operation: 'delete', params: { userId, namespace: ns, ...refuse } });
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'no data for scope' });
	});

	it('users manage their own data with "self"; the data of other users is out of reach for them', async () => {
		const asOwner = { credential: owner.credential };
		const [created] = await runOk({
			resource: 'userCustomData',
			operation: 'set',
			...asOwner,
			params: { userId: 'self', namespace: ns, data: '{"theme": "dark", "pins": [3, 1, 2]}' },
		});
		expect(created).toEqual({ data: { theme: 'dark', pins: [3, 1, 2] } });
		expect(await stored(owner.id)).toEqual({ theme: 'dark', pins: [3, 1, 2] });

		const [read] = await runOk({ resource: 'userCustomData', operation: 'get', ...asOwner, params: { userId: 'self', namespace: ns, options: { scope: 'pins' } } });
		expect(read).toEqual({ data: [3, 1, 2] });
		const [removed] = await runOk({ resource: 'userCustomData', operation: 'delete', ...asOwner, params: { userId: owner.id, namespace: ns, options: { scope: 'theme' } } });
		expect(removed).toEqual({ data: 'dark' });
		expect(await stored(owner.id)).toEqual({ pins: [3, 1, 2] });

		const before = await stored(users[1]);
		for (const [operation, extra] of [
			['get', {}],
			['set', { data: '"hacked"' }],
			['delete', {}],
		] as const) {
			const forbidden = await runNode({
				resource: 'userCustomData',
				operation,
				...asOwner,
				params: { userId: users[1], namespace: ns, options: { scope: 'score' }, ...extra, ...refuse },
			});
			expect(forbidden.success, operation).toEqual([]);
			expect(forbidden.error[0], operation).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'userCustomData', operation });
		}
		expect(await stored(users[1])).toEqual(before);

		const missing = await runNode({ resource: 'userCustomData', operation: 'get', params: { userId: '99999999', namespace: ns, ...refuse } });
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'userCustomData', operation: 'get' });

		await canvas().request('DELETE', `/api/v1/users/${owner.id}/custom_data?ns=${encodeURIComponent(ns)}`);
	});
});
