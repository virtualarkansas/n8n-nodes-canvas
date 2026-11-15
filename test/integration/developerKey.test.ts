import { afterAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { expectSameIds, failureText, ids, pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: developerKey. The seeded keys (and the "User-Generated" key every
 * personal access token hangs on) are only read; everything that is changed or
 * deleted is a key created by this file.
 */
describe('developerKey', () => {
	const root = fx('accountId');
	const tag = unique('n8nbat key').replace(/\s/g, '-');
	const createdKeys: string[] = [];
	let keyId = '';
	const name = `${tag} Ünïcødé 密钥 "quoted" & <b>tags</b>`;
	const scopes = ['url:GET|/api/v1/courses', 'url:GET|/api/v1/courses/:id'];

	const key = async (id: string, account = root): Promise<Json | undefined> =>
		(await canvas().get<Json[]>(`/api/v1/accounts/${account}/developer_keys?id=${id}`))[0];
	const keys = (query = ''): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/accounts/${root}/developer_keys${query}`);
	const binding = (k: Json | undefined): Json => (k?.developer_key_account_binding ?? {}) as Json;

	afterAll(async () => {
		for (const id of createdKeys) {
			await canvas().request('DELETE', `/api/v1/developer_keys/${id}`);
		}
	});

	// ------------------------------------------------------------------ create

	it('create: every optional field reaches Canvas; the secret is returned', async () => {
		const [created] = await runOk({
			resource: 'developerKey',
			operation: 'create',
			params: {
				accountId: root,
				additionalFields: {
					name,
					email: 'keys@n8nbat.example.edu',
					notes: 'Line one\nLine two with "quotes" & <tags>',
					icon_url: 'https://n8nbat.example.edu/icon.png?a=1&b=2',
					redirect_uris: 'https://a.n8nbat.example.edu/callback, https://b.n8nbat.example.edu/callback',
					vendor_code: 'N8NBAT',
					scopes: scopes.join(', '),
					require_scopes: true,
					allow_includes: true,
					client_credentials_audience: 'external',
					// Accepted by Canvas but not part of what the API returns for a key.
					auto_expire_tokens: true,
					test_cluster_only: false,
				},
			},
		});
		keyId = String(created.id);
		createdKeys.push(keyId);
		expect(created.name).toBe(name);
		expect(String(created.api_key).length).toBeGreaterThan(20);
		// IDs of developer keys are returned in their long ("global") form.
		expect(Number(keyId)).toBeGreaterThan(10_000_000_000_000);

		expect(await key(keyId)).toMatchObject({
			id: Number(keyId),
			name,
			email: 'keys@n8nbat.example.edu',
			notes: 'Line one\nLine two with "quotes" & <tags>',
			icon_url: 'https://n8nbat.example.edu/icon.png?a=1&b=2',
			redirect_uris: 'https://a.n8nbat.example.edu/callback\nhttps://b.n8nbat.example.edu/callback',
			vendor_code: 'N8NBAT',
			scopes,
			require_scopes: true,
			allow_includes: true,
			client_credentials_audience: 'external',
			workflow_state: 'active',
			is_lti_key: false,
		});
	});

	it('create: only a name; redirect URIs and scopes one per line; several items', async () => {
		const result = await runOk({
			resource: 'developerKey',
			operation: 'create',
			items: Array.from({ length: 11 }, (_, i) => ({
				name: `${tag} bulk ${String(i).padStart(2, '0')}`,
				uris: i === 0 ? 'https://one.n8nbat.example.edu/cb\nhttps://two.n8nbat.example.edu/cb\n' : '',
				scopes: i === 0 ? `${scopes[0]}\n${scopes[1]}` : '',
			})),
			params: {
				accountId: root,
				additionalFields: {
					name: '={{ $json.name }}',
					redirect_uris: '={{ $json.uris }}',
					scopes: '={{ $json.scopes }}',
				},
			},
		});
		expect(result).toHaveLength(11);
		for (const created of result) createdKeys.push(String(created.id));

		const first = (await key(String(result[0].id)))!;
		expect(first).toMatchObject({
			name: `${tag} bulk 00`,
			redirect_uris: 'https://one.n8nbat.example.edu/cb\nhttps://two.n8nbat.example.edu/cb',
			scopes,
			require_scopes: false,
		});
		const second = (await key(String(result[1].id)))!;
		expect(second).toMatchObject({ name: `${tag} bulk 01`, redirect_uris: '', scopes: [], email: null });
		// A new key is switched off in the account until someone turns it on.
		expect(binding(second).workflow_state).toBe('off');
	});

	it('create: "Visible" only applies to Site Admin keys', async () => {
		const [accountKey] = await runOk({
			resource: 'developerKey',
			operation: 'create',
			params: { accountId: root, additionalFields: { name: `${tag} visibility`, visible: false } },
		});
		createdKeys.push(String(accountKey.id));
		// Keys of an account are always visible, whatever was asked for.
		expect((await key(String(accountKey.id)))!.visible).toBe(true);

		const siteAdmin = fx('siteAdminAccountId');
		const [hidden] = await runOk({
			resource: 'developerKey',
			operation: 'create',
			params: { accountId: siteAdmin, additionalFields: { name: `${tag} site admin`, visible: false } },
		});
		createdKeys.push(String(hidden.id));
		try {
			expect((await key(String(hidden.id), siteAdmin))!.visible).toBe(false);
			await runOk({
				resource: 'developerKey',
				operation: 'update',
				params: { developerKeyId: String(hidden.id), updateFields: { visible: true } },
			});
			expect((await key(String(hidden.id), siteAdmin))!.visible).toBe(true);
			// A visible Site Admin key is what other accounts see as "inherited".
			const inherited = await runOk({
				resource: 'developerKey',
				operation: 'getAll',
				params: { accountId: root, returnAll: true, options: { inherited: true } },
			});
			const mine = inherited.find((k) => String(k.id) === String(hidden.id))!;
			expect(mine).toMatchObject({ name: `${tag} site admin`, inherited_from: 'global' });
			expect(mine.api_key).toBeUndefined();
		} finally {
			await canvas().request('DELETE', `/api/v1/developer_keys/${String(hidden.id)}`);
		}
	});

	it('create: no fields, an unknown scope and a teacher are refused', async () => {
		const nothing = await runNode({
			resource: 'developerKey',
			operation: 'create',
			params: { accountId: root, additionalFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.success).toEqual([]);
		expect(failureText(nothing)).toMatch(/at least one field/i);

		const unknownScope = await runNode({
			resource: 'developerKey',
			operation: 'create',
			params: {
				accountId: root,
				additionalFields: { name: `${tag} bad scope`, scopes: `${scopes[0]},url:GET|/api/v1/no/such/endpoint` },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknownScope.success).toEqual([]);
		expect(unknownScope.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'developerKey',
			operation: 'create',
		});
		expect(String(unknownScope.error[0].errorMessage)).toContain('url:GET|/api/v1/no/such/endpoint');

		const asTeacher = await runNode({
			resource: 'developerKey',
			operation: 'create',
			persona: 'teacher',
			params: {
				accountId: root,
				additionalFields: { name: `${tag} forbidden` },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');

		const names = (await keys()).map((k) => k.name);
		expect(names).not.toContain(`${tag} bad scope`);
		expect(names).not.toContain(`${tag} forbidden`);
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: lists the keys of the account; Return All and Limit are honoured', async () => {
		const before = await keys();
		expect(before.length).toBeGreaterThan(12);

		const all = await runOk({
			resource: 'developerKey',
			operation: 'getAll',
			params: { accountId: root, returnAll: true },
		});
		expectSameIds(all, before, await keys());
		expect(ids(all)).toEqual(expect.arrayContaining(createdKeys.slice(0, 12).map(Number)));
		// The seeded keys are listed with their long IDs.
		expect(ids(all).map((id) => id % 10_000_000_000_000)).toEqual(
			expect.arrayContaining([fx('developerKeyId'), fx('scopedDeveloperKeyId'), fx('inactiveDeveloperKeyId')].map(Number)),
		);

		const limited = await runOk({
			resource: 'developerKey',
			operation: 'getAll',
			params: { accountId: 'self', returnAll: false, limit: 12, pagination: { perPage: 5 } },
		});
		expect(limited).toHaveLength(12);
		expect(new Set(ids(limited)).size).toBe(12);

		// Default: up to 50 (other workers add and remove keys meanwhile).
		const countBefore = (await keys()).length;
		const defaults = await runOk({ resource: 'developerKey', operation: 'getAll', params: { accountId: root } });
		const countAfter = (await keys()).length;
		expect(defaults.length).toBeGreaterThanOrEqual(Math.min(countBefore, countAfter, 50));
		expect(defaults.length).toBeLessThanOrEqual(Math.min(Math.max(countBefore, countAfter), 50));
	});

	it('getAll: "Inherited" off lists the account\'s own keys, on lists the Site Admin keys', async () => {
		const own = await runOk({
			resource: 'developerKey',
			operation: 'getAll',
			params: { accountId: root, returnAll: true, options: { inherited: false } },
		});
		expect(ids(own)).toContain(Number(keyId));
		expect(own.every((k) => k.inherited_from === undefined)).toBe(true);

		const expectedInherited = await keys('?inherited=true');
		const inherited = await runOk({
			resource: 'developerKey',
			operation: 'getAll',
			params: { accountId: root, returnAll: true, options: { inherited: true } },
		});
		expectSameIds(inherited, expectedInherited, await keys('?inherited=true'));
		expect(ids(inherited)).not.toContain(Number(keyId));
		expect(inherited.every((k) => k.inherited_from !== undefined)).toBe(true);
	});

	it('getAll: a single key by ID; an unknown ID yields nothing; a teacher is refused', async () => {
		const single = await runOk({
			resource: 'developerKey',
			operation: 'getAll',
			items: [{ id: Number(keyId) }],
			params: { accountId: root, options: { id: '={{ $json.id }}' } },
		});
		expect(single).toHaveLength(1);
		expect(single[0]).toMatchObject({ id: Number(keyId), name });

		const none = await runNode({
			resource: 'developerKey',
			operation: 'getAll',
			params: { accountId: root, options: { id: '99999999' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);

		const asTeacher = await runNode({
			resource: 'developerKey',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------- setAccountBinding

	it('setAccountBinding: switches a key on and off in the account', async () => {
		const [on] = await runOk({
			resource: 'developerKey',
			operation: 'setAccountBinding',
			params: { accountId: root, developerKeyId: keyId, bindingState: 'on' },
		});
		expect(on).toMatchObject({ developer_key_id: Number(keyId), workflow_state: 'on', account_owns_binding: true });
		expect(binding(await key(keyId)).workflow_state).toBe('on');

		const states = await runOk({
			resource: 'developerKey',
			operation: 'setAccountBinding',
			items: [{ state: 'off' }, { state: 'allow' }],
			params: {
				accountId: 'self',
				developerKeyId: keyId,
				bindingState: '={{ $json.state }}',
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(states.map((s) => s.workflow_state)).toEqual(['off', 'allow']);
		expect(binding(await key(keyId)).workflow_state).toBe('allow');

		// Default state when the parameter is left alone: on.
		await runOk({
			resource: 'developerKey',
			operation: 'setAccountBinding',
			params: { accountId: root, developerKeyId: keyId },
		});
		expect(binding(await key(keyId)).workflow_state).toBe('on');
	});

	it('setAccountBinding: needs the long key ID; unknown keys and a teacher are refused', async () => {
		const shortId = String(Number(keyId) % 10_000_000_000_000);
		const result = await runNode({
			resource: 'developerKey',
			operation: 'setAccountBinding',
			items: [{ id: shortId }, { id: '10000000099999999' }],
			params: {
				accountId: root,
				developerKeyId: '={{ $json.id }}',
				bindingState: 'off',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'setAccountBinding' });
		}

		const asTeacher = await runNode({
			resource: 'developerKey',
			operation: 'setAccountBinding',
			persona: 'teacher',
			params: {
				accountId: root,
				developerKeyId: keyId,
				bindingState: 'off',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect(binding(await key(keyId)).workflow_state).toBe('on');
	});

	// ------------------------------------------------------------------ update

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const [updated] = await runOk({
			resource: 'developerKey',
			operation: 'update',
			params: {
				developerKeyId: keyId,
				updateFields: {
					name: renamed,
					email: 'keys2@n8nbat.example.edu',
					notes: 'Changed',
					icon_url: 'https://n8nbat.example.edu/icon2.png',
					redirect_uris: 'https://c.n8nbat.example.edu/callback',
					vendor_code: 'N8NBAT2',
					// Unknown scopes are dropped by Canvas on update (on create they are an error).
					scopes: `${scopes[1]}, url:GET|/api/v1/no/such/endpoint`,
					require_scopes: false,
					allow_includes: false,
					client_credentials_audience: 'internal',
					auto_expire_tokens: false,
					test_cluster_only: false,
				},
			},
		});
		expect(updated.name).toBe(renamed);
		expect(await key(keyId)).toMatchObject({
			name: renamed,
			email: 'keys2@n8nbat.example.edu',
			notes: 'Changed',
			icon_url: 'https://n8nbat.example.edu/icon2.png',
			redirect_uris: 'https://c.n8nbat.example.edu/callback',
			vendor_code: 'N8NBAT2',
			scopes: [scopes[1]],
			require_scopes: false,
			allow_includes: false,
			client_credentials_audience: 'internal',
			workflow_state: 'active',
		});
	});

	it('update: deactivates and activates a key; the short ID works here', async () => {
		const shortId = String(Number(keyId) % 10_000_000_000_000);
		const [inactive] = await runOk({
			resource: 'developerKey',
			operation: 'update',
			params: { developerKeyId: shortId, updateFields: { event: 'deactivate' } },
		});
		expect(inactive.workflow_state).toBe('inactive');
		expect((await key(keyId))!.workflow_state).toBe('inactive');

		const [active] = await runOk({
			resource: 'developerKey',
			operation: 'update',
			items: [{ id: Number(keyId) }],
			params: { developerKeyId: '={{ $json.id }}', updateFields: { event: 'activate', notes: 'Active again' } },
		});
		expect(active.workflow_state).toBe('active');
		expect(await key(keyId)).toMatchObject({ workflow_state: 'active', notes: 'Active again' });
	});

	it('update: nothing to update, an unknown key and a teacher are errors', async () => {
		const nothing = await runNode({
			resource: 'developerKey',
			operation: 'update',
			params: { developerKeyId: keyId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.success).toEqual([]);
		expect(failureText(nothing)).toMatch(/at least one field/i);

		const unknown = await runNode({
			resource: 'developerKey',
			operation: 'update',
			params: {
				developerKeyId: '99999999',
				updateFields: { name: 'Nope' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'update' });

		const asTeacher = await runNode({
			resource: 'developerKey',
			operation: 'update',
			persona: 'teacher',
			params: {
				developerKeyId: keyId,
				updateFields: { name: 'Hijacked' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect((await key(keyId))!.name).not.toBe('Hijacked');
	});

	// ------------------------------------------------------------------ delete

	it('delete: removes keys; several items with an unknown key in between', async () => {
		const [first, second] = createdKeys.slice(1, 3);
		const result = await runNode({
			resource: 'developerKey',
			operation: 'delete',
			items: [{ id: Number(first) }, { id: 99999999 }, { id: second }],
			params: { developerKeyId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((k) => String(k.id))).toEqual([first, second]);
		expect(pairedItems(result)).toEqual([0, 2]);
		expect(result.success.every((k) => k.workflow_state === 'deleted')).toBe(true);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'developerKey',
			operation: 'delete',
		});
		expect(await key(first)).toBeUndefined();
		expect(await key(second)).toBeUndefined();
		expect(ids(await keys())).not.toContain(Number(first));
	});

	it('delete: a deleted key cannot be deleted again, and a teacher is refused', async () => {
		const [deleted] = await runOk({ resource: 'developerKey', operation: 'delete', params: { developerKeyId: keyId } });
		expect(deleted).toMatchObject({ id: Number(keyId), workflow_state: 'deleted' });

		const again = await runNode({
			resource: 'developerKey',
			operation: 'delete',
			params: { developerKeyId: keyId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const survivor = createdKeys[4];
		const asTeacher = await runNode({
			resource: 'developerKey',
			operation: 'delete',
			persona: 'teacher',
			params: { developerKeyId: survivor, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect((await key(survivor))!.workflow_state).toBe('active');
	});
});
