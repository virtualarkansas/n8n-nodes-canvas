import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { expectSameIds, failureText, ids, pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: role. Roles are created in a private sub-account so the root
 * account's role list (which every other worker reads) is not touched; the
 * seeded roles are only read.
 */
describe('role', () => {
	const root = fx('accountId');
	const tag = unique('RoleBat').replace(/\s/g, '-');
	let account = '';
	let accountRoleId = '';
	const courseRoleIds: Record<string, string> = {};
	const label = `${tag} Ünïcødé 角色 "quoted" & <b>tags</b> 🎭`;

	const role = (id: string, inAccount = account): Promise<Json> =>
		canvas().get<Json>(`/api/v1/accounts/${inAccount}/roles/${id}`);
	const permission = (r: Json, name: string): Json => (r.permissions as Json)[name] as Json;

	beforeAll(async () => {
		const created = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: `${tag} account` },
		});
		account = String(created.id);
	});

	afterAll(async () => {
		// Roles cannot be deleted through the API; deactivate them and remove the account.
		for (const id of [accountRoleId, ...Object.values(courseRoleIds)].filter(Boolean)) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/roles/${id}`);
		}
		if (account) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${account}`);
		}
	});

	// ------------------------------------------------------------------ create

	it('create: an account role with every optional field; permissions reach Canvas', async () => {
		const [created] = await runOk({
			resource: 'role',
			operation: 'create',
			params: {
				accountId: account,
				label,
				additionalFields: {
					base_role_type: 'AccountMembership',
					permissions: JSON.stringify({
						read_reports: { explicit: true, enabled: true, locked: true },
						manage_account_settings: {
							explicit: true,
							enabled: true,
							applies_to_self: false,
							applies_to_descendants: true,
						},
						// Only assignable in a root account: Canvas ignores it here without complaint.
						manage_sis: { explicit: true, enabled: true },
						view_statistics: { explicit: true, enabled: false },
					}),
				},
			},
		});
		accountRoleId = String(created.id);
		expect(created).toMatchObject({ label, role: label, base_role_type: 'AccountMembership', workflow_state: 'active' });

		const actual = await role(accountRoleId);
		expect(actual).toMatchObject({ label, base_role_type: 'AccountMembership', is_account_role: true });
		expect(permission(actual, 'read_reports')).toMatchObject({ enabled: true, locked: true, explicit: true });
		expect(permission(actual, 'manage_sis')).toBeUndefined();
		expect(permission(actual, 'manage_account_settings')).toMatchObject({
			enabled: true,
			explicit: true,
			applies_to_self: false,
			applies_to_descendants: true,
		});
		expect(permission(actual, 'view_statistics')).toMatchObject({ enabled: false, explicit: true });
		// A permission that was not mentioned keeps its default.
		expect(permission(actual, 'read_course_list')).toMatchObject({ explicit: false });
	});

	it('create: one role per base type, from several items, with permissions arriving as objects', async () => {
		const types = ['DesignerEnrollment', 'ObserverEnrollment', 'StudentEnrollment', 'TaEnrollment', 'TeacherEnrollment'];
		const result = await runOk({
			resource: 'role',
			operation: 'create',
			items: types.map((type) => ({
				label: `${tag} ${type}`,
				type,
				permissions: { read_forum: { explicit: true, enabled: false } },
			})),
			params: {
				accountId: account,
				label: '={{ $json.label }}',
				additionalFields: { base_role_type: '={{ $json.type }}', permissions: '={{ $json.permissions }}' },
			},
		});
		expect(result.map((r) => r.base_role_type)).toEqual(types);
		for (const created of result) {
			courseRoleIds[String(created.base_role_type)] = String(created.id);
			const actual = await role(String(created.id));
			expect(actual).toMatchObject({
				label: `${tag} ${String(created.base_role_type)}`,
				base_role_type: created.base_role_type,
				is_account_role: false,
				workflow_state: 'active',
			});
			expect(permission(actual, 'read_forum')).toMatchObject({ enabled: false, explicit: true });
		}
	});

	it('create: without optional fields Canvas makes an account role', async () => {
		const [created] = await runOk({
			resource: 'role',
			operation: 'create',
			params: { accountId: account, label: `${tag} minimal` },
		});
		courseRoleIds.minimal = String(created.id);
		expect(await role(String(created.id))).toMatchObject({ base_role_type: 'AccountMembership', is_account_role: true });
	});

	it('create: a label that is already in use, malformed permissions and a lesser persona are refused', async () => {
		const duplicate = await runNode({
			resource: 'role',
			operation: 'create',
			params: { accountId: account, label, errorHandling: { onError: 'continueWithError' } },
		});
		expect(duplicate.success).toEqual([]);
		expect(duplicate.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(String(duplicate.error[0].errorMessage)).toContain('already in use');

		const malformed = await runNode({
			resource: 'role',
			operation: 'create',
			params: {
				accountId: account,
				label: `${tag} malformed`,
				additionalFields: { permissions: '{"read_reports": {"enabled": tr' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(malformed.success).toEqual([]);
		expect(failureText(malformed)).toMatch(/Invalid JSON in Permissions/);

		const asTeacher = await runNode({
			resource: 'role',
			operation: 'create',
			persona: 'teacher',
			params: { accountId: account, label: `${tag} forbidden`, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');

		const labels = (await canvas().getAll<Json>(`/api/v1/accounts/${account}/roles`)).map((r) => r.label);
		expect(labels).not.toContain(`${tag} malformed`);
		expect(labels).not.toContain(`${tag} forbidden`);
	});

	// --------------------------------------------------------------------- get

	it('get: returns a role with its permissions; inherited and built-in roles are found too', async () => {
		const [own] = await runOk({ resource: 'role', operation: 'get', params: { accountId: account, roleId: accountRoleId } });
		expect(own).toMatchObject({ id: Number(accountRoleId), label, base_role_type: 'AccountMembership' });
		expect(permission(own, 'read_reports')).toMatchObject({ enabled: true, locked: true });

		const others = await runOk({
			resource: 'role',
			operation: 'get',
			items: [{ id: Number(fx('customRoleId')) }, { id: fx('teacherRoleId') }, { id: Number(fx('inactiveRoleId')) }],
			params: { accountId: root, roleId: '={{ $json.id }}' },
		});
		expect(others.map((r) => r.id)).toEqual([fx('customRoleId'), fx('teacherRoleId'), fx('inactiveRoleId')].map(Number));
		expect(others[1]).toMatchObject({ role: 'TeacherEnrollment', workflow_state: 'built_in' });
		expect(others[2].workflow_state).toBe('inactive');
	});

	it('get: unknown roles are a 404; a mix of items keeps its pairing', async () => {
		const result = await runNode({
			resource: 'role',
			operation: 'get',
			items: [{ id: accountRoleId }, { id: '99999999' }, { id: courseRoleIds.TaEnrollment }],
			params: { accountId: account, roleId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((r) => r.id)).toEqual([Number(accountRoleId), Number(courseRoleIds.TaEnrollment)]);
		expect(pairedItems(result)).toEqual([0, 2]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'role', operation: 'get' });
		expect(String(result.error[0].errorMessage)).toContain('role not found');
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: active roles of the account by default (built-in roles included)', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${account}/roles`);
		const listed = await runOk({
			resource: 'role',
			operation: 'getAll',
			params: { accountId: account, pagination: { returnAll: true } },
		});
		expect(listed.map((r) => r.id)).toEqual(expected.map((r) => r.id));
		expect(ids(listed)).toEqual(expect.arrayContaining([Number(accountRoleId), Number(fx('teacherRoleId'))]));
		// Roles of the parent account are not listed unless asked for.
		expect(ids(listed)).not.toContain(Number(fx('customRoleId')));
		expect(listed.every((r) => r.workflow_state !== 'inactive')).toBe(true);
	});

	it('getAll: inherited roles and inactive roles on request, across pages', async () => {
		const query = 'show_inherited=true&state[]=active&state[]=inactive';
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${account}/roles?${query}`);
		expect(expected.length).toBeGreaterThan(10);

		const all = await runOk({
			resource: 'role',
			operation: 'getAll',
			params: {
				accountId: account,
				options: { show_inherited: true, state: ['active', 'inactive'] },
				pagination: { returnAll: true },
			},
		});
		expect(all.map((r) => r.id)).toEqual(expected.map((r) => r.id));
		expect(ids(all)).toEqual(
			expect.arrayContaining([Number(accountRoleId), Number(fx('customRoleId')), Number(fx('inactiveRoleId'))]),
		);
		expect(new Set(ids(all)).size).toBe(all.length);

		const onlyInactive = await runOk({
			resource: 'role',
			operation: 'getAll',
			params: { accountId: account, options: { show_inherited: true, state: ['inactive'] }, pagination: { returnAll: true } },
		});
		expect(onlyInactive.length).toBeGreaterThan(0);
		expect(onlyInactive.every((r) => r.workflow_state === 'inactive')).toBe(true);
		expect(ids(onlyInactive)).toContain(Number(fx('inactiveRoleId')));

		const paged = await runOk({
			resource: 'role',
			operation: 'getAll',
			params: {
				accountId: account,
				options: { show_inherited: true, state: ['active', 'inactive'] },
				pagination: { perPage: 4, maxPages: 2 },
			},
		});
		expect(paged).toHaveLength(8);
		expect(new Set(ids(paged)).size).toBe(8);

		const defaults = await runOk({
			resource: 'role',
			operation: 'getAll',
			params: { accountId: account, options: { show_inherited: true, state: ['active', 'inactive'] } },
		});
		expect(defaults).toHaveLength(Math.min(expected.length, 50));
	});

	it('getAll: the seeded root account roles, and a teacher is refused', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${root}/roles`);
		const listed = await runOk({
			resource: 'role',
			operation: 'getAll',
			params: { accountId: 'self', options: { show_inherited: false }, pagination: { returnAll: true } },
		});
		expectSameIds(listed, expected, await canvas().getAll<Json>(`/api/v1/accounts/${root}/roles`));
		expect(ids(listed)).toContain(Number(fx('accountRoleId')));

		const asTeacher = await runNode({
			resource: 'role',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// ---------------------------------------------------------- getPermissions

	it('getPermissions: lists the assignable permissions, one item per permission', async () => {
		const expected = await canvas().get<Json[]>(`/api/v1/accounts/${account}/roles/permissions`);
		expect(expected.length).toBeGreaterThan(50);
		const listed = await runOk({
			resource: 'role',
			operation: 'getPermissions',
			params: { accountId: account, pagination: { returnAll: true } },
		});
		expect(listed.map((p) => p.key).sort()).toEqual(expected.map((p) => p.key).sort());
		const readReports = listed.find((p) => p.key === 'read_reports')!;
		expect(readReports.label).toBeTypeOf('string');
		expect(readReports.available_to).toBeInstanceOf(Array);

		// The node-level limit applies: Canvas returns this list in one piece.
		const defaults = await runOk({ resource: 'role', operation: 'getPermissions', params: { accountId: account } });
		expect(defaults.length).toBeGreaterThan(0);
		expect(defaults.length).toBeLessThanOrEqual(expected.length);
	});

	it('getPermissions: the search term narrows the list', async () => {
		const expected = await canvas().get<Json[]>(`/api/v1/accounts/${account}/roles/permissions?search_term=_sis`);
		const listed = await runOk({
			resource: 'role',
			operation: 'getPermissions',
			params: { accountId: account, options: { search_term: '_sis' } },
		});
		expect(listed.map((p) => p.key).sort()).toEqual(expected.map((p) => p.key).sort());
		expect(listed.map((p) => p.key)).toContain('read_sis');
		expect(listed.length).toBeLessThan(10);

		const none = await runNode({
			resource: 'role',
			operation: 'getPermissions',
			params: { accountId: account, options: { search_term: 'zzz-no-such-permission' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	// ------------------------------------------------------------------ update

	it('update: label and permissions reach Canvas', async () => {
		const renamed = `${label} (renamed)`;
		const [updated] = await runOk({
			resource: 'role',
			operation: 'update',
			params: {
				accountId: account,
				roleId: accountRoleId,
				updateFields: {
					label: renamed,
					permissions: JSON.stringify({
						read_reports: { explicit: true, enabled: false, locked: false },
						manage_account_settings: { explicit: false },
						read_course_list: {
							explicit: true,
							enabled: true,
							applies_to_self: true,
							applies_to_descendants: false,
						},
					}),
				},
			},
		});
		expect(updated.label).toBe(renamed);
		const actual = await role(accountRoleId);
		expect(actual.label).toBe(renamed);
		expect(permission(actual, 'read_reports')).toMatchObject({ enabled: false, locked: false, explicit: true });
		// "explicit": false removed the override: back to the default for a custom account role.
		expect(permission(actual, 'manage_account_settings')).toMatchObject({ explicit: false, enabled: false });
		expect(permission(actual, 'read_course_list')).toMatchObject({
			enabled: true,
			explicit: true,
			applies_to_self: true,
			applies_to_descendants: false,
		});
		// Untouched.
		expect(permission(actual, 'view_statistics')).toMatchObject({ enabled: false, explicit: true });
	});

	it('update: permissions only (from an expression) leave the label alone', async () => {
		await runOk({
			resource: 'role',
			operation: 'update',
			items: [{ permissions: { read_forum: { explicit: true, enabled: true } } }],
			params: {
				accountId: account,
				roleId: courseRoleIds.StudentEnrollment,
				updateFields: { permissions: '={{ $json.permissions }}' },
			},
		});
		const actual = await role(courseRoleIds.StudentEnrollment);
		expect(actual.label).toBe(`${tag} StudentEnrollment`);
		expect(permission(actual, 'read_forum')).toMatchObject({ enabled: true, explicit: true });
	});

	it('update: an override for an inherited role is stored in this account only', async () => {
		const before = await role(fx('customRoleId'), root);
		const wasEnabled = permission(before, 'read_forum').enabled;
		try {
			await runOk({
				resource: 'role',
				operation: 'update',
				params: {
					accountId: account,
					roleId: fx('customRoleId'),
					updateFields: { permissions: JSON.stringify({ read_forum: { explicit: true, enabled: !wasEnabled } }) },
				},
			});
			expect(permission(await role(fx('customRoleId')), 'read_forum').enabled).toBe(!wasEnabled);
			// The seeded role as seen from the root account is unchanged.
			expect(permission(await role(fx('customRoleId'), root), 'read_forum').enabled).toBe(wasEnabled);
		} finally {
			await canvas().put(`/api/v1/accounts/${account}/roles/${fx('customRoleId')}`, {
				permissions: { read_forum: { explicit: false } },
			});
		}
	});

	it('update: built-in and inherited labels, impossible permission settings and unknown roles are refused', async () => {
		const builtIn = await runNode({
			resource: 'role',
			operation: 'update',
			params: {
				accountId: account,
				roleId: fx('teacherRoleId'),
				updateFields: { label: 'Renamed teacher' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(builtIn.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect(String(builtIn.error[0].errorMessage)).toContain("cannot update the 'label' for a built-in role");

		const inherited = await runNode({
			resource: 'role',
			operation: 'update',
			params: {
				accountId: account,
				roleId: fx('customRoleId'),
				updateFields: { label: 'Renamed inherited' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(inherited.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(inherited.error[0].errorMessage)).toContain("cannot update the 'label' for an inherited role");
		expect((await role(fx('customRoleId'), root)).label).not.toBe('Renamed inherited');

		const impossible = await runNode({
			resource: 'role',
			operation: 'update',
			params: {
				accountId: account,
				roleId: accountRoleId,
				updateFields: {
					permissions: '{"view_statistics": {"explicit": true, "enabled": true, "applies_to_self": false, "applies_to_descendants": false}}',
				},
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(impossible.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(permission(await role(accountRoleId), 'view_statistics')).toMatchObject({ enabled: false });

		const unknown = await runNode({
			resource: 'role',
			operation: 'update',
			params: {
				accountId: account,
				roleId: '99999999',
				updateFields: { label: 'Nope' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// -------------------------------------------------- deactivate / activate

	it('deactivate: hides a custom role; built-in, inactive and unknown roles are refused', async () => {
		const [deactivated] = await runOk({
			resource: 'role',
			operation: 'deactivate',
			params: { accountId: account, roleId: accountRoleId },
		});
		expect(deactivated).toMatchObject({ id: Number(accountRoleId), workflow_state: 'inactive' });
		expect((await role(accountRoleId)).workflow_state).toBe('inactive');
		const active = await canvas().getAll<Json>(`/api/v1/accounts/${account}/roles`);
		expect(ids(active)).not.toContain(Number(accountRoleId));

		const result = await runNode({
			resource: 'role',
			operation: 'deactivate',
			items: [{ id: accountRoleId }, { id: fx('studentRoleId') }, { id: '99999999' }, { id: Number(courseRoleIds.ObserverEnrollment) }],
			params: { accountId: account, roleId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((r) => r.id)).toEqual([Number(courseRoleIds.ObserverEnrollment)]);
		expect(pairedItems(result)).toEqual([3]);
		expect(result.error).toHaveLength(3);
		const byItem = (id: unknown): Json => result.error.find((e) => (e.originalItem as Json).id === id)!;
		expect(byItem(accountRoleId)).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'deactivate' });
		expect(byItem(fx('studentRoleId'))).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(byItem('99999999')).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((await role(fx('studentRoleId'), root)).workflow_state).toBe('built_in');
	});

	it('deactivate: a role inherited from the parent account cannot be deactivated from the sub-account', async () => {
		const result = await runNode({
			resource: 'role',
			operation: 'deactivate',
			params: { accountId: account, roleId: fx('customRoleId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((await role(fx('customRoleId'), root)).workflow_state).toBe('active');
	});

	it('activate: brings an inactive role back; an active role is refused', async () => {
		const [activated] = await runOk({
			resource: 'role',
			operation: 'activate',
			params: { accountId: account, roleId: accountRoleId },
		});
		expect(activated).toMatchObject({ id: Number(accountRoleId), workflow_state: 'active' });
		expect((await role(accountRoleId)).workflow_state).toBe('active');
		// Permissions survived the round trip.
		expect(permission(await role(accountRoleId), 'read_course_list')).toMatchObject({ enabled: true, explicit: true });

		const again = await runNode({
			resource: 'role',
			operation: 'activate',
			params: { accountId: account, roleId: accountRoleId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'activate' });

		const asTeacher = await runNode({
			resource: 'role',
			operation: 'activate',
			persona: 'teacher',
			params: {
				accountId: account,
				roleId: courseRoleIds.ObserverEnrollment,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect((await role(courseRoleIds.ObserverEnrollment)).workflow_state).toBe('inactive');
	});
});
