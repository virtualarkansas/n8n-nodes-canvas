import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: login. All writes happen on logins of a user created by this file;
 * seeded logins are only read. Writes are verified by reading the user's logins
 * back from Canvas directly.
 */
describe('login', () => {
	const account = fx('accountId');
	let userId = '';
	let witnessId = '';
	let firstLoginId = '';
	let firstLogin = '';
	let loginId = '';

	const slug = (prefix: string): string => `${unique(prefix).replace(/\s/g, '.')}@example.edu`;
	const logins = (id = userId): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${id}/logins`);
	const login = async (id: string): Promise<Json> => {
		const found = (await logins()).find((l) => String(l.id) === id);
		if (!found) throw new Error(`login ${id} not found`);
		return found;
	};

	beforeAll(async () => {
		firstLogin = slug('login-user');
		const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name: unique('Login Battery User'), skip_registration: true },
			pseudonym: { unique_id: firstLogin, send_confirmation: false, password: fx('defaultPassword') },
		});
		userId = String(user.id);
		firstLoginId = String((await logins())[0].id);
		// A second user of this file, used only to let Canvas verify a login's password.
		const witness = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name: unique('Login Battery Witness'), skip_registration: true },
			pseudonym: { unique_id: slug('login-witness'), send_confirmation: false },
		});
		witnessId = String(witness.id);
	});

	afterAll(async () => {
		for (const id of [userId, witnessId]) {
			if (id) await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
	});

	/**
	 * Whether Canvas accepts a password for a login. Uses the observee API, which checks
	 * credentials without opening a session; the link it creates on success is removed again.
	 */
	const passwordWorks = async (uniqueId: string, password: string): Promise<boolean> => {
		const res = await canvas().request('POST', `/api/v1/users/${witnessId}/observees`, { observee: { unique_id: uniqueId, password } });
		if (res.status === 200) {
			await canvas().delete(`/api/v1/users/${witnessId}/observees/${userId}`);
			return true;
		}
		if (res.status === 401) return false;
		throw new Error(`Unexpected answer while checking a password: ${res.status} ${JSON.stringify(res.data)}`);
	};

	it('create: every optional field reaches Canvas', async () => {
		const uniqueId = unique('second-login').replace(/\s/g, '_');
		const sis = unique('SIS-L').replace(/\s/g, '_');
		const integration = unique('INT-L').replace(/\s/g, '_');
		const [created] = await runOk({
			resource: 'login',
			operation: 'create',
			params: {
				accountId: account,
				userId,
				uniqueId,
				additionalFields: {
					authenticationProviderId: 'canvas',
					declaredUserType: 'administrative',
					integrationId: integration,
					password: fx('defaultPassword'),
					sisUserId: sis,
				},
			},
		});
		loginId = String(created.id);
		expect(await login(loginId)).toMatchObject({
			user_id: Number(userId),
			account_id: Number(account),
			unique_id: uniqueId,
			sis_user_id: sis,
			integration_id: integration,
			authentication_provider_id: Number(fx('canvasAuthenticationProviderId')),
			declared_user_type: 'administrative',
			workflow_state: 'active',
		});
		expect(await passwordWorks(uniqueId, fx('defaultPassword'))).toBe(true);
		expect(await passwordWorks(uniqueId, 'not-the-password')).toBe(false);
	});

	it('create: every declared user type is accepted, including the value older workflows saved as "admin"', async () => {
		for (const [sent, stored] of [
			['admin', 'administrative'],
			['observer', 'observer'],
			['staff', 'staff'],
			['student', 'student'],
			['student_other', 'student_other'],
			['teacher', 'teacher'],
		]) {
			const [created] = await runOk({
				resource: 'login',
				operation: 'create',
				params: {
					accountId: account,
					userId: Number(userId),
					uniqueId: unique(`type-${sent}`).replace(/\s/g, '_'),
					additionalFields: { declaredUserType: sent },
				},
			});
			expect((await login(String(created.id))).declared_user_type, sent).toBe(stored);
			await canvas().delete(`/api/v1/users/${userId}/logins/${String(created.id)}`);
		}
	});

	it('create: a taken login ID and a sub-account are refused with Canvas\' message', async () => {
		const taken = await runNode({
			resource: 'login',
			operation: 'create',
			params: { accountId: account, userId, uniqueId: firstLogin, errorHandling: { onError: 'continueWithError' } },
		});
		expect(taken.success).toEqual([]);
		expect(taken.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'login', operation: 'create' });
		expect(JSON.stringify(taken.error[0].canvasErrors)).toContain('unique_id');

		const subAccount = await runNode({
			resource: 'login',
			operation: 'create',
			params: { accountId: fx('subAccountId'), userId, uniqueId: unique('sub').replace(/\s/g, '_'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(subAccount.success).toEqual([]);
		expect(subAccount.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(subAccount.error[0].errorMessage)).toContain('root account');
	});

	it('getAll: by user and by account return the logins of the user', async () => {
		const expected = (await logins()).map((l) => l.id);
		expect(expected).toEqual([Number(firstLoginId), Number(loginId)]);

		const byUser = await runOk({ resource: 'login', operation: 'getAll', params: { listBy: 'user', userId } });
		expect(byUser.map((l) => l.id)).toEqual(expected);

		const byAccount = await runOk({ resource: 'login', operation: 'getAll', params: { listBy: 'account', accountId: account, userId: Number(userId) } });
		expect(byAccount.map((l) => l.id).sort()).toEqual([...expected].sort());
		expect(byAccount.every((l) => l.user_id === Number(userId))).toBe(true);

		const [self] = await runOk({ resource: 'login', operation: 'getAll', persona: 'student', params: { listBy: 'user', userId: 'self' } });
		expect(self.unique_id).toBe(fx('studentLoginId'));
	});

	it('getAll: a user with several logins (one on another provider, one deleted), read-only on the seeded user', async () => {
		const seeded = fx('multiLoginUserId');
		const expected = await logins(seeded);
		expect(expected.length).toBeGreaterThanOrEqual(3);

		const listed = await runOk({ resource: 'login', operation: 'getAll', params: { listBy: 'user', userId: seeded, pagination: { perPage: 2, returnAll: true } } });
		expect(listed.map((l) => l.id)).toEqual(expected.map((l) => l.id));
		expect(listed.map((l) => l.id)).toContain(Number(fx('samlLoginId')));
		expect(listed.map((l) => l.id)).not.toContain(Number(fx('deletedLoginId')));

		const firstPage = await runOk({ resource: 'login', operation: 'getAll', params: { listBy: 'user', userId: seeded, pagination: { perPage: 2, maxPages: 1 } } });
		expect(firstPage.map((l) => l.id)).toEqual(expected.slice(0, 2).map((l) => l.id));
	});

	it('getAll: errors for a sub-account, an unknown user and a student looking at someone else', async () => {
		const cases: Array<[Json, string | undefined, number[]]> = [
			[{ listBy: 'account', accountId: fx('subAccountId'), userId }, undefined, [400]],
			[{ listBy: 'user', userId: '99999999' }, undefined, [404]],
			[{ listBy: 'user', userId }, 'student', [401, 403]],
		];
		for (const [params, persona, codes] of cases) {
			const result = await runNode({
				resource: 'login',
				operation: 'getAll',
				persona,
				params: { ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, JSON.stringify(params)).toEqual([]);
			expect(result.error).toHaveLength(1);
			expect(codes, JSON.stringify(params)).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'login', operation: 'getAll' });
		}
	});

	it('update: every changeable field reaches Canvas', async () => {
		const renamed = unique('renamed-login').replace(/\s/g, '_');
		const sis = unique('SIS-L2').replace(/\s/g, '_');
		const integration = unique('INT-L2').replace(/\s/g, '_');
		const [updated] = await runOk({
			resource: 'login',
			operation: 'update',
			params: {
				accountId: account,
				loginId,
				updateFields: {
					authenticationProviderId: 'canvas',
					declaredUserType: 'teacher',
					integrationId: integration,
					overrideSisStickiness: true,
					sisUserId: sis,
					uniqueId: renamed,
					workflowState: 'suspended',
				},
			},
		});
		expect(updated.id).toBe(Number(loginId));
		expect(await login(loginId)).toMatchObject({
			unique_id: renamed,
			sis_user_id: sis,
			integration_id: integration,
			declared_user_type: 'teacher',
			workflow_state: 'suspended',
			authentication_provider_id: Number(fx('canvasAuthenticationProviderId')),
		});

		await runOk({ resource: 'login', operation: 'update', params: { accountId: account, loginId, updateFields: { workflowState: 'active' } } });
		expect((await login(loginId)).workflow_state).toBe('active');
	});

	it('update: with "Override SIS Stickiness" off, a login ID changed in Canvas is left alone', async () => {
		const before = await login(loginId);
		const result = await runNode({
			resource: 'login',
			operation: 'update',
			params: {
				accountId: account,
				loginId,
				updateFields: { uniqueId: 'must_not_apply', declaredUserType: 'staff', overrideSisStickiness: false },
			},
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect((await login(loginId)).unique_id).toBe(before.unique_id);
	});

	it('update: empty values clear the SIS ID, the integration ID and the provider; other empty fields are not sent', async () => {
		const before = await login(loginId);
		await runOk({
			resource: 'login',
			operation: 'update',
			params: {
				accountId: account,
				loginId,
				updateFields: { sisUserId: '', integrationId: '', authenticationProviderId: '', uniqueId: '' },
			},
		});
		expect(await login(loginId)).toMatchObject({
			sis_user_id: null,
			integration_id: null,
			authentication_provider_id: null,
			unique_id: before.unique_id,
		});
	});

	it('update: Canvas refuses an admin setting another user\'s password here, an empty update and an unknown login', async () => {
		// "Password setting by admins" is off on this account; the node reports Canvas' refusal.
		const password = await runNode({
			resource: 'login',
			operation: 'update',
			params: { accountId: account, loginId, updateFields: { password: 'AnotherPass456!' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(password.success).toEqual([]);
		expect(password.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'login', operation: 'update' });
		expect([401, 403]).toContain(password.error[0].errorCode);

		const empty = await runNode({
			resource: 'login',
			operation: 'update',
			params: { accountId: account, loginId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(empty.error[0].errorMessage)).toContain('missing required parameter');

		const missing = await runNode({
			resource: 'login',
			operation: 'update',
			params: { accountId: account, loginId: '99999999', updateFields: { workflowState: 'active' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('resetPassword: starts the recovery for a known login and reports an unknown address', async () => {
		// Mail is not delivered anywhere in the test environment (delivery_method: test).
		const [requested] = await runOk({ resource: 'login', operation: 'resetPassword', params: { email: firstLogin } });
		expect(requested).toEqual({ requested: true });

		const unknown = await runNode({
			resource: 'login',
			operation: 'resetPassword',
			params: { email: 'nobody.at.all@example.edu', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'login', operation: 'resetPassword' });

		const forbidden = await runNode({
			resource: 'login',
			operation: 'resetPassword',
			persona: 'student',
			params: { email: firstLogin, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403]).toContain(forbidden.error[0].errorCode);
	});

	it('delete: removes a login; the last login of a user cannot be deleted', async () => {
		const result = await runNode({
			resource: 'login',
			operation: 'delete',
			items: [{ login: Number(loginId) }, { login: 99999999 }],
			params: { userId: Number(userId), loginId: '={{ $json.login }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((l) => l.id)).toEqual([Number(loginId)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'login', operation: 'delete' });
		expect((await logins()).map((l) => l.id)).toEqual([Number(firstLoginId)]);

		const last = await runNode({
			resource: 'login',
			operation: 'delete',
			params: { userId, loginId: firstLoginId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(last.success).toEqual([]);
		expect(last.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'login', operation: 'delete' });
		expect((await logins()).map((l) => l.id)).toEqual([Number(firstLoginId)]);
	});
});
