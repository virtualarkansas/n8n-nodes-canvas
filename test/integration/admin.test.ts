import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { ids, pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: admin (account memberships). The seeded admins are only read.
 * Everything that is created or removed happens in a private sub-account, with
 * users created for this file.
 */
describe('admin', () => {
	const root = fx('accountId');
	const tag = unique('AdminBat').replace(/\s/g, '-');
	let account = '';
	const users: Array<{ id: string; name: string; sis: string; login: string }> = [];
	const USERS = 14;

	const admins = (query = ''): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/accounts/${account}/admins${query}`);
	const userOf = (admin: Json): number => Number((admin.user as Json).id);

	beforeAll(async () => {
		const created = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: `${tag} account` },
		});
		account = String(created.id);
		for (let i = 0; i < USERS; i++) {
			const sis = `n8nbat_${tag}_${i}`;
			const login = `${sis.toLowerCase()}@example.edu`;
			const name = i === 0 ? `${tag} Zoë Ünïcødé 管理员 O'Neil` : `${tag} User ${String(i).padStart(2, '0')}`;
			const user = await canvas().post<Json>(`/api/v1/accounts/${root}/users`, {
				user: { name, skip_registration: true },
				pseudonym: { unique_id: login, sis_user_id: sis, send_confirmation: false },
				communication_channel: { type: 'email', address: login, skip_confirmation: true },
			});
			users.push({ id: String(user.id), name, sis, login });
		}
	});

	afterAll(async () => {
		for (const user of users) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/users/${user.id}`);
		}
		if (account) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${account}`);
		}
	});

	// ------------------------------------------------------------------ create

	it('create: every optional field reaches Canvas (custom role, no confirmation mail)', async () => {
		const [admin] = await runOk({
			resource: 'admin',
			operation: 'create',
			params: {
				accountId: account,
				userId: users[0].id,
				additionalFields: { role_id: fx('accountRoleId'), send_confirmation: false },
			},
		});
		expect(admin).toMatchObject({ role_id: Number(fx('accountRoleId')), workflow_state: 'active' });
		expect(userOf(admin)).toBe(Number(users[0].id));

		const actual = (await admins()).find((a) => userOf(a) === Number(users[0].id))!;
		expect(actual).toMatchObject({ id: admin.id, role_id: Number(fx('accountRoleId')), workflow_state: 'active' });
		expect((actual.user as Json).name).toBe(users[0].name);

		// No notification was sent.
		await new Promise((resolve) => setTimeout(resolve, 3000));
		const messages = await canvas().getAll<Json>(`/api/v1/comm_messages?user_id=${users[0].id}`);
		expect(messages).toEqual([]);
	});

	it('create: defaults to the Account Admin role and notifies the user; SIS user IDs work', async () => {
		const [admin] = await runOk({
			resource: 'admin',
			operation: 'create',
			params: { accountId: account, userId: `sis_user_id:${users[1].sis}` },
		});
		expect(admin).toMatchObject({ role: 'AccountAdmin', role_id: Number(fx('accountAdminRoleId')) });
		expect(userOf(admin)).toBe(Number(users[1].id));

		// Without "Send Confirmation: off" Canvas mails the new admin.
		let messages: Json[] = [];
		for (let attempt = 0; attempt < 30 && messages.length === 0; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			messages = await canvas().getAll<Json>(`/api/v1/comm_messages?user_id=${users[1].id}`);
		}
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0].to).toBe(users[1].login);
	});

	it('create: "Send Confirmation" on sends the mail explicitly; several items; a second role for the same user', async () => {
		const result = await runOk({
			resource: 'admin',
			operation: 'create',
			items: [
				{ user: Number(users[2].id), role: Number(fx('accountRoleId')) },
				{ user: users[1].id, role: fx('accountRoleId') },
			],
			params: {
				accountId: account,
				userId: '={{ $json.user }}',
				additionalFields: { role_id: '={{ $json.role }}', send_confirmation: true },
			},
		});
		expect(result.map(userOf)).toEqual([Number(users[2].id), Number(users[1].id)]);

		const rolesOfSecond = (await admins(`?user_id[]=${users[1].id}`)).map((a) => a.role_id).sort();
		expect(rolesOfSecond).toEqual([Number(fx('accountAdminRoleId')), Number(fx('accountRoleId'))].sort());

		let messages: Json[] = [];
		for (let attempt = 0; attempt < 30 && messages.length === 0; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			messages = await canvas().getAll<Json>(`/api/v1/comm_messages?user_id=${users[2].id}`);
		}
		expect(messages.length).toBeGreaterThan(0);
	});

	it('create: making an existing admin an admin again is not an error and creates no duplicate', async () => {
		const [again] = await runOk({
			resource: 'admin',
			operation: 'create',
			params: {
				accountId: account,
				userId: users[0].id,
				additionalFields: { role_id: fx('accountRoleId'), send_confirmation: false },
			},
		});
		expect(userOf(again)).toBe(Number(users[0].id));
		expect((await admins(`?user_id[]=${users[0].id}`)).length).toBe(1);
	});

	it('create: an unknown user and a lesser persona are refused', async () => {
		const result = await runNode({
			resource: 'admin',
			operation: 'create',
			items: [{ user: '99999999' }, { user: 'sis_user_id:n8nbat_no_such_user' }],
			params: {
				accountId: account,
				userId: '={{ $json.user }}',
				additionalFields: { role_id: fx('accountRoleId'), send_confirmation: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'admin', operation: 'create' });
		}

		const asTeacher = await runNode({
			resource: 'admin',
			operation: 'create',
			persona: 'teacher',
			params: {
				accountId: account,
				userId: users[3].id,
				additionalFields: { send_confirmation: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect((await admins(`?user_id[]=${users[3].id}`)).length).toBe(0);
	});

	it('create: Canvas does not validate the role: an unknown Role ID silently becomes Account Admin', async () => {
		// Worth knowing before wiring a role ID from data: a typo grants full admin rights.
		const [admin] = await runOk({
			resource: 'admin',
			operation: 'create',
			params: {
				accountId: account,
				userId: users[3].id,
				additionalFields: { role_id: '99999999', send_confirmation: false },
			},
		});
		expect(admin).toMatchObject({ role: 'AccountAdmin', role_id: Number(fx('accountAdminRoleId')) });
		const actual = await admins(`?user_id[]=${users[3].id}`);
		expect(actual.map((a) => a.role_id)).toEqual([Number(fx('accountAdminRoleId'))]);
		await canvas().delete(`/api/v1/accounts/${account}/admins/${users[3].id}`);
		expect(await admins(`?user_id[]=${users[3].id}`)).toEqual([]);
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: lists the admins of an account across pages, without duplicates', async () => {
		// More admins than one default page.
		for (const user of users.slice(3)) {
			await canvas().post(`/api/v1/accounts/${account}/admins`, {
				user_id: user.id,
				role_id: fx('accountRoleId'),
				send_confirmation: false,
			});
		}
		const expected = await admins();
		expect(expected.length).toBe(USERS + 1);

		const all = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: { accountId: account, pagination: { returnAll: true } },
		});
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(all.length);
		expect(all.every((a) => a.workflow_state === 'active')).toBe(true);

		const defaults = await runOk({ resource: 'admin', operation: 'getAll', params: { accountId: account } });
		expect(defaults).toHaveLength(USERS + 1);

		const paged = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: { accountId: account, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(paged).toHaveLength(8);
		expect(new Set(ids(paged)).size).toBe(8);
	});

	it('getAll: filters by user IDs (several, with spaces, SIS IDs) and by search term', async () => {
		const byUsers = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: {
				accountId: account,
				options: { user_id: `${users[0].id}, ${users[5].id} ,sis_user_id:${users[6].sis}` },
				pagination: { returnAll: true },
			},
		});
		expect(byUsers.map(userOf).sort()).toEqual([users[0].id, users[5].id, users[6].id].map(Number).sort());

		const fromArray = await runOk({
			resource: 'admin',
			operation: 'getAll',
			items: [{ users: [Number(users[7].id), Number(users[8].id)] }],
			params: { accountId: account, options: { user_id: '={{ $json.users }}' } },
		});
		expect(fromArray.map(userOf).sort()).toEqual([users[7].id, users[8].id].map(Number).sort());

		const bySearch = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: { accountId: account, options: { search_term: 'Zoë Ünïcødé' } },
		});
		expect(bySearch.map(userOf)).toEqual([Number(users[0].id)]);

		const none = await runNode({
			resource: 'admin',
			operation: 'getAll',
			params: { accountId: account, options: { search_term: 'zzz-nobody-zzz' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('getAll: the seeded root account admins, read only', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${root}/admins`);
		const listed = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: { accountId: 'self', pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(ids(expected));
		expect(listed.map(userOf)).toContain(Number(fx('adminUserId')));
		expect(listed.map(userOf)).toContain(Number(fx('registrarUserId')));
	});

	it('getAll: a sub-account admin may list their own account but not the root account', async () => {
		const own = await runOk({
			resource: 'admin',
			operation: 'getAll',
			persona: 'subaccountAdmin',
			params: { accountId: fx('subAccountId') },
		});
		expect(own.map(userOf)).toContain(Number(fx('subaccountAdminUserId')));

		const rootList = await runNode({
			resource: 'admin',
			operation: 'getAll',
			persona: 'subaccountAdmin',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(rootList.success).toEqual([]);
		expect(rootList.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------ getSelfRoles

	it('getSelfRoles: lists the roles of the token\'s user in an account', async () => {
		const [role] = await runOk({ resource: 'admin', operation: 'getSelfRoles', params: { accountId: root } });
		expect(role).toMatchObject({ role: 'AccountAdmin', role_id: Number(fx('accountAdminRoleId')) });
		expect(userOf(role)).toBe(Number(fx('adminUserId')));

		const asSubAdmin = await runOk({
			resource: 'admin',
			operation: 'getSelfRoles',
			persona: 'subaccountAdmin',
			params: { accountId: `sis_account_id:${fx('subAccountSisId')}` },
		});
		expect(asSubAdmin.map((a) => a.id)).toEqual([Number(fx('subaccountAdminAccountUserId'))]);

		// No admin role: an empty list, and no permission needed to ask.
		const asTeacher = await runNode({
			resource: 'admin',
			operation: 'getSelfRoles',
			persona: 'teacher',
			params: { accountId: root },
		});
		expect(asTeacher.ok).toBe(true);
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error).toEqual([]);
	});

	// ------------------------------------------------------------------ delete

	it('delete: removes one role and leaves the user\'s other role in place', async () => {
		const [removed] = await runOk({
			resource: 'admin',
			operation: 'delete',
			params: { accountId: account, userId: users[1].id, roleId: fx('accountRoleId') },
		});
		expect(removed).toMatchObject({ role_id: Number(fx('accountRoleId')), workflow_state: 'deleted' });
		const remaining = await admins(`?user_id[]=${users[1].id}`);
		expect(remaining.map((a) => a.role_id)).toEqual([Number(fx('accountAdminRoleId'))]);
	});

	it('delete: without a role ID the Account Admin role is removed; deleted admins show up on request', async () => {
		const [removed] = await runOk({
			resource: 'admin',
			operation: 'delete',
			params: { accountId: account, userId: `sis_user_id:${users[1].sis}` },
		});
		expect(removed).toMatchObject({ role: 'AccountAdmin', workflow_state: 'deleted' });
		expect(await admins(`?user_id[]=${users[1].id}`)).toEqual([]);

		const withDeleted = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: {
				accountId: account,
				options: { include_deleted: true, user_id: users[1].id },
				pagination: { returnAll: true },
			},
		});
		expect(withDeleted).toHaveLength(2);
		expect(withDeleted.every((a) => a.workflow_state === 'deleted')).toBe(true);

		const withoutDeleted = await runOk({
			resource: 'admin',
			operation: 'getAll',
			params: { accountId: account, options: { include_deleted: false, user_id: users[1].id } },
		});
		expect(withoutDeleted).toEqual([]);
	});

	it('delete: several items; a role the user never had, an unknown user and a lesser persona are errors', async () => {
		const result = await runNode({
			resource: 'admin',
			operation: 'delete',
			items: [
				{ user: Number(users[4].id), role: Number(fx('accountRoleId')) },
				// Already removed above: Canvas answers with the removed membership again, not with an error.
				{ user: users[1].id, role: fx('accountRoleId') },
				{ user: users[5].id, role: fx('accountAdminRoleId') },
				{ user: users[5].id, role: fx('accountRoleId') },
				{ user: '99999999', role: fx('accountRoleId') },
			],
			params: {
				accountId: account,
				userId: '={{ $json.user }}',
				roleId: '={{ $json.role }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map(userOf)).toEqual([users[4].id, users[1].id, users[5].id].map(Number));
		expect(pairedItems(result)).toEqual([0, 1, 3]);
		expect(result.success.every((a) => a.workflow_state === 'deleted')).toBe(true);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'admin', operation: 'delete' });
		}
		expect(result.error.map((e) => (e.originalItem as Json).user).sort()).toEqual(['99999999', users[5].id].sort());
		expect(await admins(`?user_id[]=${users[4].id}&user_id[]=${users[5].id}`)).toEqual([]);

		const asTeacher = await runNode({
			resource: 'admin',
			operation: 'delete',
			persona: 'teacher',
			params: {
				accountId: account,
				userId: users[6].id,
				roleId: fx('accountRoleId'),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect((await admins(`?user_id[]=${users[6].id}`)).length).toBe(1);
	});
});
