import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { expectSameIds, ids, runNode, runOk, settled } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: account. Every operation is executed through a real n8n instance
 * against Canvas; writes are verified by reading the record back from Canvas
 * directly. Destructive tests only touch sub-accounts created here.
 */


describe('account', () => {
	const root = fx('accountId');
	const sub = fx('subAccountId');
	const created: string[] = [];
	let parentId = '';
	let childId = '';
	let courseInChild = '';
	const parentName = unique('Battery Sub-Account Ünïcødé 学校 "quoted" & <b>tags</b>');
	const parentSis = unique('n8nbat_acct').replace(/\s/g, '_');

	let notPublicCourseId = '';

	beforeAll(async () => {
		// Canvas' "public = false" filter only matches courses whose flag was explicitly switched off.
		const course = await canvas().post<Json>(`/api/v1/accounts/${root}/courses`, {
			course: { name: unique('Explicitly not public'), is_public: false },
		});
		notPublicCourseId = String(course.id);
	});

	afterAll(async () => {
		if (notPublicCourseId) {
			await canvas().request('DELETE', `/api/v1/courses/${notPublicCourseId}?event=delete`);
		}
		if (courseInChild) {
			await canvas().request('DELETE', `/api/v1/courses/${courseInChild}?event=delete`);
		}
		// Children first: Canvas refuses to delete an account that still has sub-accounts.
		for (const id of [...created].reverse()) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${id}`);
		}
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: an admin sees their accounts, with every include', async () => {
		const expected = await canvas().getAll<Json>('/api/v1/accounts');
		const listed = await runOk({
			resource: 'account',
			operation: 'getAll',
			params: {
				accountScope: 'all',
				options: {
					include: ['course_count', 'lti_guid', 'registration_settings', 'services', 'sub_account_count'],
				},
			},
		});
		expect(ids(listed)).toEqual(ids(expected));
		const rootAccount = listed.find((a) => String(a.id) === root)!;
		expect(rootAccount.course_count).toBeTypeOf('number');
		expect(rootAccount.sub_account_count).toBeGreaterThanOrEqual(5);
		expect(rootAccount.lti_guid).toBeTypeOf('string');
		expect(rootAccount.registration_settings).toBeTypeOf('object');
		expect(rootAccount.services).toBeTypeOf('object');
	});

	it('getAll: works without the new "Accounts to List" parameter (workflows saved before it existed)', async () => {
		const listed = await runOk({ resource: 'account', operation: 'getAll' });
		expect(ids(listed)).toContain(Number(root));
		expect(listed[0].course_count).toBeUndefined();
	});

	it('getAll: a student gets an empty list, not an error', async () => {
		const result = await runNode({ resource: 'account', operation: 'getAll', persona: 'student' });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('getAll (manageable): returns the whole tree an admin manages and pages through it', async () => {
		const before = await canvas().getAll<Json>('/api/v1/manageable_accounts');
		expect(before.length, 'seed should provide more accounts than one default page').toBeGreaterThan(10);

		const all = await runOk({
			resource: 'account',
			operation: 'getAll',
			params: { accountScope: 'manageable', pagination: { returnAll: true } },
		});
		const after = await canvas().getAll<Json>('/api/v1/manageable_accounts');
		expectSameIds(all, before, after);

		// Default paging: up to 50 (other workers add and remove sub-accounts meanwhile).
		const defaults = await runOk({ resource: 'account', operation: 'getAll', params: { accountScope: 'manageable' } });
		const later = await canvas().getAll<Json>('/api/v1/manageable_accounts');
		expect(defaults.length).toBeGreaterThanOrEqual(Math.min(after.length, later.length, 50));
		expect(defaults.length).toBeLessThanOrEqual(Math.min(Math.max(after.length, later.length), 50));

		const twoPages = await runOk({
			resource: 'account',
			operation: 'getAll',
			params: { accountScope: 'manageable', pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(6);
		expect(new Set(ids(twoPages)).size).toBe(6);
	});

	it('getAll (manageable): a sub-account admin only gets their own branch', async () => {
		const expected = await new CanvasClient('subaccountAdmin').getAll<Json>('/api/v1/manageable_accounts');
		const listed = await runOk({
			resource: 'account',
			operation: 'getAll',
			persona: 'subaccountAdmin',
			params: { accountScope: 'manageable', pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(ids(expected));
		expect(ids(listed)).not.toContain(Number(root));
	});

	it('getAll (courseAdmin): a teacher sees the accounts of the courses they teach', async () => {
		const expected = await new CanvasClient('teacher').getAll<Json>('/api/v1/course_accounts');
		expect(expected.length).toBeGreaterThan(0);
		const listed = await runOk({
			resource: 'account',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountScope: 'courseAdmin', pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(ids(expected));
		// The plain list is empty for the same teacher: that is why this scope exists.
		expect(await runOk({ resource: 'account', operation: 'getAll', persona: 'teacher' })).toEqual([]);
	});

	it('getAll (courseCreation): lists where the user may create courses', async () => {
		const expected = await canvas().getAll<Json>('/api/v1/course_creation_accounts');
		const listed = await runOk({
			resource: 'account',
			operation: 'getAll',
			params: { accountScope: 'courseCreation', pagination: { returnAll: true } },
		});
		const after = await canvas().getAll<Json>('/api/v1/course_creation_accounts');
		expectSameIds(listed, expected, after);
		expect(ids(listed)).toContain(Number(sub));
	});

	// --------------------------------------------------------------------- get

	it('get: returns the account, with includes', async () => {
		const [account] = await runOk({
			resource: 'account',
			operation: 'get',
			params: {
				accountId: sub,
				options: {
					includes: ['course_count', 'lti_guid', 'registration_settings', 'services', 'sub_account_count'],
				},
			},
		});
		const actual = await canvas().get<Json>(
			`/api/v1/accounts/${sub}?includes[]=course_count&includes[]=sub_account_count&includes[]=lti_guid`,
		);
		expect(account).toMatchObject({
			id: Number(sub),
			name: actual.name,
			sis_account_id: fx('subAccountSisId'),
			parent_account_id: Number(root),
			course_count: actual.course_count,
			sub_account_count: actual.sub_account_count,
			lti_guid: actual.lti_guid,
		});
		expect(account.sub_account_count).toBeGreaterThan(0);
		expect(account.registration_settings).toBeTypeOf('object');
		expect(account.services).toBeTypeOf('object');
	});

	it('get: accepts "self", SIS IDs, and numeric IDs arriving as numbers from an expression', async () => {
		const [self] = await runOk({ resource: 'account', operation: 'get', params: { accountId: 'self' } });
		expect(self.id).toBe(Number(root));

		const [bySis] = await runOk({
			resource: 'account',
			operation: 'get',
			params: { accountId: `sis_account_id:${fx('subAccountSisId')}` },
		});
		expect(bySis.id).toBe(Number(sub));

		const fromExpression = await runOk({
			resource: 'account',
			operation: 'get',
			items: [{ id: Number(sub) }, { id: Number(fx('midSubAccountId')) }],
			params: { accountId: '={{ $json.id }}' },
		});
		expect(fromExpression.map((a) => a.id)).toEqual([Number(sub), Number(fx('midSubAccountId'))]);
	});

	it('get: several items with a mix of success and failure keep their pairing', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'get',
			items: [{ id: sub }, { id: '99999999' }, { id: fx('deepSubAccountId') }],
			params: { accountId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((a) => a.id)).toEqual([Number(sub), Number(fx('deepSubAccountId'))]);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'account',
			operation: 'get',
			originalItem: { id: '99999999' },
		});
	});

	it('get: a deleted sub-account is reported as not found', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'get',
			params: { accountId: fx('deletedSubAccountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('get: a student may not read an account', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'get',
			persona: 'student',
			params: { accountId: sub, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
		expect([401, 403]).toContain(result.error[0].errorCode);
	});

	// ---------------------------------------------------------- getSubAccounts

	it('getSubAccounts: direct children by default, sorted by name on request, with counts', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${sub}/sub_accounts?order=name`);
		expect(expected.length).toBeGreaterThan(1);
		const listed = await runOk({
			resource: 'account',
			operation: 'getSubAccounts',
			params: {
				accountId: sub,
				options: { order: 'name', recursive: false, include: ['course_count', 'sub_account_count'] },
			},
		});
		expect(listed.map((a) => a.id)).toEqual(expected.map((a) => a.id));
		for (const account of listed) {
			expect(account.parent_account_id).toBe(Number(sub));
			expect(account.course_count).toBeTypeOf('number');
			expect(account.sub_account_count).toBeTypeOf('number');
		}
		// The science department has departments below it.
		expect(listed.find((a) => String(a.id) === fx('midSubAccountId'))!.sub_account_count).toBeGreaterThan(0);
	});

	it('getSubAccounts: recursive returns the whole tree, across pages, without duplicates', async () => {
		const before = await canvas().getAll<Json>(`/api/v1/accounts/${root}/sub_accounts?recursive=true`);
		expect(before.length).toBeGreaterThan(10);
		const all = await runOk({
			resource: 'account',
			operation: 'getSubAccounts',
			params: { accountId: root, options: { recursive: true }, pagination: { returnAll: true } },
		});
		const after = await canvas().getAll<Json>(`/api/v1/accounts/${root}/sub_accounts?recursive=true`);
		expectSameIds(all, before, after);
		expect(ids(all)).toContain(Number(fx('deepSubAccountId')));
		expect(ids(all)).not.toContain(Number(fx('deletedSubAccountId')));

		const direct = await runOk({
			resource: 'account',
			operation: 'getSubAccounts',
			params: { accountId: root, pagination: { returnAll: true } },
		});
		expect(direct.length).toBeLessThan(all.length);
		expect(direct.every((a) => a.parent_account_id === Number(root))).toBe(true);

		const paged = await runOk({
			resource: 'account',
			operation: 'getSubAccounts',
			params: { accountId: root, options: { recursive: true }, pagination: { perPage: 2, maxPages: 3 } },
		});
		expect(paged).toHaveLength(6);
		expect(new Set(ids(paged)).size).toBe(6);
	});

	it('getSubAccounts: an account without children yields no items', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'getSubAccounts',
			params: { accountId: fx('deepSubAccountId'), options: { recursive: true } },
		});
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
	});

	// -------------------------------------------------------- createSubAccount

	it('createSubAccount: every optional field reaches Canvas', async () => {
		const [account] = await runOk({
			resource: 'account',
			operation: 'createSubAccount',
			params: {
				accountId: root,
				name: parentName,
				additionalFields: {
					default_group_storage_quota_mb: 61,
					default_storage_quota_mb: 777,
					default_user_storage_quota_mb: 62,
					sis_account_id: parentSis,
				},
			},
		});
		parentId = String(account.id);
		created.push(parentId);
		const actual = await canvas().get<Json>(`/api/v1/accounts/${parentId}`);
		expect(actual).toMatchObject({
			name: parentName,
			parent_account_id: Number(root),
			root_account_id: Number(root),
			workflow_state: 'active',
			sis_account_id: parentSis,
			default_group_storage_quota_mb: 61,
			default_storage_quota_mb: 777,
			default_user_storage_quota_mb: 62,
		});
	});

	it('createSubAccount: nests under a sub-account given by SIS ID and inherits quotas when none are set', async () => {
		const name = unique('Battery Child قسم 🎒');
		const [account] = await runOk({
			resource: 'account',
			operation: 'createSubAccount',
			params: { accountId: `sis_account_id:${parentSis}`, name },
		});
		childId = String(account.id);
		created.push(childId);
		const actual = await canvas().get<Json>(`/api/v1/accounts/${childId}`);
		expect(actual).toMatchObject({ name, parent_account_id: Number(parentId), sis_account_id: null });
		expect(actual.default_storage_quota_mb).toBe(777);
	});

	it('createSubAccount: a SIS ID that is already taken is refused with Canvas\' message', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'createSubAccount',
			params: {
				accountId: root,
				name: unique('Duplicate SIS'),
				additionalFields: { sis_account_id: parentSis },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		// Canvas localizes the text (it follows the locale of the request); the field and value are stable.
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('sis_source_id');
		expect(String(result.error[0].errorMessage)).toContain(parentSis);
	});

	it('createSubAccount: a teacher is refused', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'createSubAccount',
			persona: 'teacher',
			params: { accountId: root, name: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------------ update

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${parentName} (renamed)`;
		const newSis = `${parentSis}_v2`;
		const [updated] = await runOk({
			resource: 'account',
			operation: 'update',
			params: {
				accountId: childId,
				updateFields: {
					name: renamed,
					default_time_zone: 'Europe/Berlin',
					default_group_storage_quota_mb: 71,
					default_storage_quota_mb: 888,
					default_user_storage_quota_mb: 72,
					sis_account_id: newSis,
					services: '{"avatars": true}',
					settings: JSON.stringify({
						restrict_student_past_view: { value: true, locked: true },
						restrict_student_future_view: { value: true, locked: false },
						lock_all_announcements: { value: true, locked: true },
					}),
				},
			},
		});
		expect(updated.name).toBe(renamed);
		const actual = await canvas().get<Json>(`/api/v1/accounts/${childId}?includes[]=services`);
		expect(actual).toMatchObject({
			name: renamed,
			default_time_zone: 'Europe/Berlin',
			default_group_storage_quota_mb: 71,
			default_storage_quota_mb: 888,
			default_user_storage_quota_mb: 72,
			sis_account_id: newSis,
		});
		expect((actual.services as Json).avatars).toBe(true);

		// Account settings are not readable through the API; a course in the account inherits them.
		const course = await canvas().post<Json>(`/api/v1/accounts/${childId}/courses`, {
			course: { name: unique('Settings probe') },
		});
		courseInChild = String(course.id);
		const settings = await canvas().get<Json>(`/api/v1/courses/${courseInChild}/settings`);
		expect(settings).toMatchObject({
			restrict_student_past_view: true,
			restrict_student_future_view: true,
			lock_all_announcements: true,
		});
	});

	it('update: settings arriving as an object from an expression work like JSON text', async () => {
		await runOk({
			resource: 'account',
			operation: 'update',
			items: [{ settings: { lock_all_announcements: { value: false, locked: false } }, services: { avatars: false } }],
			params: {
				accountId: childId,
				updateFields: { settings: '={{ $json.settings }}', services: '={{ $json.services }}' },
			},
		});
		const settings = await canvas().get<Json>(`/api/v1/courses/${courseInChild}/settings`);
		expect(settings.lock_all_announcements).toBe(false);
		const actual = await canvas().get<Json>(`/api/v1/accounts/${childId}?includes[]=services`);
		expect((actual.services as Json).avatars).toBe(false);
	});

	it('update: moves a sub-account to another parent and can clear its SIS ID', async () => {
		await runOk({
			resource: 'account',
			operation: 'update',
			params: { accountId: childId, updateFields: { parent_account_id: sub, sis_account_id: '' } },
		});
		let actual = await canvas().get<Json>(`/api/v1/accounts/${childId}`);
		expect(actual.parent_account_id).toBe(Number(sub));
		expect(actual.sis_account_id).toBeNull();

		await runOk({
			resource: 'account',
			operation: 'update',
			params: { accountId: childId, updateFields: { parent_account_id: `sis_account_id:${parentSis}` } },
		});
		actual = await canvas().get<Json>(`/api/v1/accounts/${childId}`);
		expect(actual.parent_account_id).toBe(Number(parentId));
	});

	it('update: sets, replaces with "no template" and clears the course template', async () => {
		const template = await canvas().post<Json>(`/api/v1/accounts/${parentId}/courses`, {
			course: { name: unique('Template course') },
		});
		const templateId = String(template.id);
		await canvas().put(`/api/v1/courses/${templateId}`, { course: { template: true } });
		try {
			await runOk({
				resource: 'account',
				operation: 'update',
				params: { accountId: parentId, updateFields: { course_template_id: templateId } },
			});
			expect((await canvas().get<Json>(`/api/v1/accounts/${parentId}`)).course_template_id).toBe(Number(templateId));

			await runOk({
				resource: 'account',
				operation: 'update',
				params: { accountId: parentId, updateFields: { course_template_id: '0' } },
			});
			expect((await canvas().get<Json>(`/api/v1/accounts/${parentId}`)).course_template_id).toBe(0);

			await runOk({
				resource: 'account',
				operation: 'update',
				params: { accountId: parentId, updateFields: { course_template_id: '' } },
			});
			expect((await canvas().get<Json>(`/api/v1/accounts/${parentId}`)).course_template_id).toBeNull();
		} finally {
			await canvas().request('PUT', `/api/v1/accounts/${parentId}`, { account: { course_template_id: '' } });
			await canvas().request('PUT', `/api/v1/courses/${templateId}`, { course: { template: false } });
			await canvas().request('DELETE', `/api/v1/courses/${templateId}?event=delete`);
		}
	});

	it('update: validation errors carry Canvas\' explanation', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'update',
			params: {
				accountId: childId,
				updateFields: { default_time_zone: 'Mars/Olympus_Mons', default_storage_quota_mb: -5 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		// Both problems are reported at once (the wording is localized by Canvas).
		expect(String(result.error[0].errorMessage)).toContain('default_time_zone');
		expect(String(result.error[0].errorMessage)).toContain("'Mars/Olympus_Mons'");
		expect(String(result.error[0].errorMessage)).toContain('default_storage_quota_mb');
		expect(Object.keys(result.error[0].canvasErrors as Json).sort()).toEqual(['default_storage_quota_mb', 'default_time_zone']);
		// Nothing was applied.
		expect((await canvas().get<Json>(`/api/v1/accounts/${childId}`)).default_time_zone).toBe('Europe/Berlin');
	});

	it('update: malformed JSON in Settings is rejected before any request is sent', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'update',
			params: {
				accountId: childId,
				updateFields: { settings: '{"lock_all_announcements": ' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		const message = String(result.error[0]?.errorMessage ?? result.failure?.message);
		expect(message).toMatch(/Invalid JSON in Settings/);
	});

	it('update: a sub-account admin cannot change an account outside their branch', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'update',
			persona: 'subaccountAdmin',
			params: {
				accountId: childId,
				updateFields: { name: 'Hijacked' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
		expect((await canvas().get<Json>(`/api/v1/accounts/${childId}`)).name).not.toBe('Hijacked');
	});

	// ------------------------------------------------------------- getSettings

	it('getSettings: returns the settings Canvas exposes (K5 mode set through update)', async () => {
		const [before] = await runOk({ resource: 'account', operation: 'getSettings', params: { accountId: childId } });
		expect(before.enable_as_k5_account).toBeUndefined();

		await runOk({
			resource: 'account',
			operation: 'update',
			params: { accountId: childId, updateFields: { settings: '{"enable_as_k5_account": {"value": true}}' } },
		});
		const [after] = await runOk({ resource: 'account', operation: 'getSettings', params: { accountId: childId } });
		const actual = await canvas().get<Json>(`/api/v1/accounts/${childId}/settings`);
		expect(after).toEqual(actual);
		expect((after.enable_as_k5_account as Json).value).toBe(true);

		await canvas().put(`/api/v1/accounts/${childId}`, { account: { settings: { enable_as_k5_account: { value: false } } } });
	});

	it('getSettings: is refused for a teacher', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'getSettings',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
	});

	// ---------------------------------------------------------- getPermissions

	it('getPermissions: reports each requested permission for the token\'s user', async () => {
		const [asAdmin] = await runOk({
			resource: 'account',
			operation: 'getPermissions',
			params: { accountId: root, permissions: 'manage_sis, become_user ,read_reports' },
		});
		expect(asAdmin).toEqual({ manage_sis: true, become_user: true, read_reports: true });

		const [asTeacher] = await runOk({
			resource: 'account',
			operation: 'getPermissions',
			persona: 'teacher',
			params: { accountId: 'self', permissions: 'manage_sis,become_user' },
		});
		expect(asTeacher).toEqual({ manage_sis: false, become_user: false });

		// A sub-account admin has rights in their own branch and may not even ask about the root account.
		const asSubAdmin = await runNode({
			resource: 'account',
			operation: 'getPermissions',
			persona: 'subaccountAdmin',
			items: [{ account: sub }, { account: root }],
			params: {
				accountId: '={{ $json.account }}',
				permissions: 'manage_account_settings',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asSubAdmin.success).toEqual([{ manage_account_settings: true }]);
		expect(asSubAdmin.error).toHaveLength(1);
		expect(asSubAdmin.error[0]).toMatchObject({ errorType: 'FORBIDDEN', originalItem: { account: root } });
	});

	// ------------------------------------------------- help links and terms

	it('getHelpLinks: returns the help menu of the root account', async () => {
		const [links] = await runOk({ resource: 'account', operation: 'getHelpLinks', params: { accountId: root } });
		const actual = await canvas().get<Json>(`/api/v1/accounts/${root}/help_links`);
		expect(Object.keys(links).sort()).toEqual(Object.keys(actual).sort());
		expect(links.default_help_links).toBeInstanceOf(Array);
		expect((links.default_help_links as Json[]).length).toBeGreaterThan(0);
	});

	it('getTermsOfService: returns the terms of the root account', async () => {
		const [terms] = await runOk({ resource: 'account', operation: 'getTermsOfService', params: { accountId: 'self' } });
		const actual = await canvas().get<Json>(`/api/v1/accounts/${root}/terms_of_service`);
		expect(terms).toEqual(actual);
		expect(terms.account_id).toBe(Number(root));
		expect(terms).toHaveProperty('terms_type');
	});

	// -------------------------------------------------------------- getCourses

	it('getCourses: default paging, everything, and a small page size on a big account', async () => {
		const before = await canvas().getAll<Json>(`/api/v1/accounts/${root}/courses`);
		expect(before.length, 'seed should provide more courses than the default 50').toBeGreaterThan(50);

		const defaults = await runOk({ resource: 'account', operation: 'getCourses', params: { accountId: root } });
		expect(defaults).toHaveLength(50);
		expect(new Set(ids(defaults)).size).toBe(50);

		const all = await settled(async () => {
			const snapshot = await canvas().getAll<Json>(`/api/v1/accounts/${root}/courses`);
			const everything = await runOk({
				resource: 'account',
				operation: 'getCourses',
				params: { accountId: root, pagination: { returnAll: true } },
			});
			expectSameIds(everything, snapshot, await canvas().getAll<Json>(`/api/v1/accounts/${root}/courses`));
			return everything;
		});
		expect(all.some((c) => c.workflow_state === 'deleted')).toBe(false);

		const paged = await runOk({
			resource: 'account',
			operation: 'getCourses',
			params: { accountId: root, pagination: { perPage: 7, maxPages: 3 } },
		});
		expect(paged).toHaveLength(21);
		expect(new Set(ids(paged)).size).toBe(21);
	});

	it('getCourses: a sub-account includes the courses of its departments; SIS account IDs work', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${sub}/courses`);
		const listed = await runOk({
			resource: 'account',
			operation: 'getCourses',
			params: { accountId: `sis_account_id:${fx('subAccountSisId')}`, pagination: { returnAll: true } },
		});
		const after = await canvas().getAll<Json>(`/api/v1/accounts/${sub}/courses`);
		expectSameIds(listed, expected, after);
		expect(new Set(listed.map((c) => c.account_id)).size, 'courses from several departments').toBeGreaterThan(1);
	});

	const courseFilterCases: Array<{ name: string; filters: Json; query: string; check?: (c: Json) => boolean }> = [
		{ name: 'published', filters: { published: true }, query: 'published=true', check: (c) => c.workflow_state === 'available' },
		{ name: 'unpublished', filters: { published: false }, query: 'published=false', check: (c) => c.workflow_state !== 'available' },
		{ name: 'completed', filters: { completed: true }, query: 'completed=true' },
		{ name: 'not completed', filters: { completed: false }, query: 'completed=false', check: (c) => c.workflow_state !== 'completed' },
		{ name: 'blueprint', filters: { blueprint: true }, query: 'blueprint=true', check: (c) => c.blueprint === true },
		{ name: 'not blueprint', filters: { blueprint: false }, query: 'blueprint=false', check: (c) => c.blueprint !== true },
		{ name: 'blueprint associated', filters: { blueprint_associated: true }, query: 'blueprint_associated=true' },
		{ name: 'public', filters: { public: true }, query: 'public=true', check: (c) => c.is_public === true },
		{ name: 'not public', filters: { public: false }, query: 'public=false', check: (c) => c.is_public === false },
		{ name: 'with enrollments', filters: { with_enrollments: true }, query: 'with_enrollments=true' },
		{ name: 'without enrollments', filters: { with_enrollments: false }, query: 'with_enrollments=false' },
		{
			name: 'states incl. deleted',
			filters: { state: ['deleted', 'completed'] },
			query: 'state[]=deleted&state[]=completed',
			check: (c) => ['deleted', 'completed'].includes(String(c.workflow_state)),
		},
		{ name: 'state all', filters: { state: ['all'] }, query: 'state[]=all' },
		{
			name: 'term by ID',
			filters: { enrollment_term_id: fx('pastTermId') },
			query: `enrollment_term_id=${fx('pastTermId')}`,
			check: (c) => c.enrollment_term_id === Number(fx('pastTermId')),
		},
		{
			name: 'term by SIS ID',
			filters: { enrollment_term_id: `sis_term_id:${fx('termSisId')}` },
			query: `enrollment_term_id=${fx('termId')}`,
			check: (c) => c.enrollment_term_id === Number(fx('termId')),
		},
		{
			name: 'teachers',
			filters: { by_teachers: `${fx('teacherUserId')}, ${fx('teacher2UserId')}` },
			query: `by_teachers[]=${fx('teacherUserId')}&by_teachers[]=${fx('teacher2UserId')}`,
		},
		{
			name: 'sub-accounts',
			filters: { by_subaccounts: `${fx('midSubAccountId')},${fx('secondSubAccountId')}` },
			query: `by_subaccounts[]=${fx('midSubAccountId')}&by_subaccounts[]=${fx('secondSubAccountId')}`,
		},
		{ name: 'enrollment type', filters: { enrollment_type: ['designer', 'observer'] }, query: 'enrollment_type[]=designer&enrollment_type[]=observer' },
		{
			name: 'enrollment state',
			filters: { enrollment_workflow_state: ['invited', 'completed'] },
			query: 'enrollment_workflow_state[]=invited&enrollment_workflow_state[]=completed',
		},
		{ name: 'search term (course)', filters: { search_term: 'bio', search_by: 'course' }, query: 'search_term=bio&search_by=course' },
		{ name: 'search term (teacher)', filters: { search_term: 'Marlowe', search_by: 'teacher' }, query: 'search_term=Marlowe&search_by=teacher' },
		{ name: 'starts before', filters: { starts_before: '2021-01-01T00:00:00Z' }, query: 'starts_before=2021-01-01T00:00:00Z' },
		{ name: 'ends after', filters: { ends_after: '2030-01-01T00:00:00Z' }, query: 'ends_after=2030-01-01T00:00:00Z' },
		{
			name: 'combined',
			filters: { published: true, with_enrollments: true, enrollment_term_id: fx('termId'), by_subaccounts: sub, enrollment_type: ['teacher'] },
			query: `published=true&with_enrollments=true&enrollment_term_id=${fx('termId')}&by_subaccounts[]=${sub}&enrollment_type[]=teacher`,
			check: (c) => c.workflow_state === 'available',
		},
	];

	for (const filterCase of courseFilterCases) {
		it(`getCourses: filter "${filterCase.name}" returns exactly what Canvas returns for it`, async () => {
			// The courses of the root account change all the time on the shared Canvas.
			const { before, listed } = await settled(async () => {
				const before = await canvas().getAll<Json>(`/api/v1/accounts/${root}/courses?${filterCase.query}`);
				const listed = await runOk({
					resource: 'account',
					operation: 'getCourses',
					params: { accountId: root, filters: filterCase.filters, pagination: { returnAll: true } },
				});
				const after = await canvas().getAll<Json>(`/api/v1/accounts/${root}/courses?${filterCase.query}`);
				expectSameIds(listed, before, after);
				return { before, listed };
			});
			if (filterCase.check) {
				expect(listed.filter((c) => !filterCase.check!(c)).map((c) => c.id)).toEqual([]);
			}
			// A filter that Canvas ignored would return the unfiltered list.
			const unfiltered = await canvas().getAll<Json>(`/api/v1/accounts/${root}/courses?state[]=all`);
			if (filterCase.name !== 'state all') {
				expect(listed.length, 'the filter must narrow the list').toBeLessThan(unfiltered.length);
			}
			expect(before.length, 'the seed should have matching courses').toBeGreaterThan(0);
		});
	}

	it('getCourses: includes and sorting reach Canvas', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${sub}/courses?sort=course_name&order=desc`);
		const listed = await runOk({
			resource: 'account',
			operation: 'getCourses',
			params: {
				accountId: sub,
				options: {
					include: ['account_name', 'concluded', 'storage_quota_used_mb', 'syllabus_body', 'teachers', 'term', 'total_students'],
					sort: 'course_name',
					order: 'desc',
				},
				pagination: { returnAll: true },
			},
		});
		const stable = new Set(ids(expected));
		expect(listed.filter((c) => stable.has(Number(c.id))).map((c) => c.id)).toEqual(
			expected.filter((c) => ids(listed).includes(Number(c.id))).map((c) => c.id),
		);
		for (const course of listed) {
			expect(course.account_name).toBeTypeOf('string');
			expect(course.concluded).toBeTypeOf('boolean');
			expect(course.storage_quota_used_mb).toBeTypeOf('number');
			expect(course).toHaveProperty('syllabus_body');
			expect(course.teachers).toBeInstanceOf(Array);
			expect(course.term).toBeTypeOf('object');
			expect(course.total_students).toBeTypeOf('number');
		}

		// Sort without an explicit order sorts ascending.
		const ascending = await runOk({
			resource: 'account',
			operation: 'getCourses',
			params: { accountId: sub, options: { sort: 'sis_course_id' }, pagination: { returnAll: true } },
		});
		const expectedAscending = await canvas().getAll<Json>(`/api/v1/accounts/${sub}/courses?sort=sis_course_id&order=asc`);
		expect(ascending.filter((c) => stable.has(Number(c.id))).map((c) => c.id)).toEqual(
			expectedAscending.filter((c) => ids(ascending).includes(Number(c.id))).map((c) => c.id),
		);
		expect(ascending.map((c) => c.id)).not.toEqual(listed.map((c) => c.id));
	});

	it('getCourses: an empty result is an empty output, and a too-short search term is a clear error', async () => {
		const none = await runNode({
			resource: 'account',
			operation: 'getCourses',
			params: { accountId: root, filters: { search_term: 'zzz-no-such-course-zzz' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);

		const tooShort = await runNode({
			resource: 'account',
			operation: 'getCourses',
			params: { accountId: root, filters: { search_term: 'b' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(tooShort.success).toEqual([]);
		expect(tooShort.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(tooShort.error[0].errorMessage)).toMatch(/2 or more characters|at least/i);
	});

	it('getCourses: a teacher may not list the courses of an account', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'getCourses',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------- restoreUser

	it('restoreUser: brings a deleted user and their login back', async () => {
		const login = `${unique('n8nbat.restore').replace(/\s/g, '.')}@example.edu`;
		const user = await canvas().post<Json>(`/api/v1/accounts/${root}/users`, {
			user: { name: unique('Restore Me'), skip_registration: true },
			pseudonym: { unique_id: login, send_confirmation: false },
		});
		const userId = String(user.id);
		await canvas().delete(`/api/v1/accounts/${root}/users/${userId}`);
		expect(await canvas().getAll<Json>(`/api/v1/users/${userId}/logins`)).toEqual([]);

		const [restored] = await runOk({
			resource: 'account',
			operation: 'restoreUser',
			params: { accountId: root, userId },
		});
		expect(restored).toMatchObject({ id: Number(userId), login_id: login });
		const logins = await canvas().getAll<Json>(`/api/v1/users/${userId}/logins`);
		expect(logins.map((l) => l.unique_id)).toEqual([login]);

		// Restoring a user who is not deleted is refused.
		const again = await runNode({
			resource: 'account',
			operation: 'restoreUser',
			params: { accountId: root, userId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(again.error[0].errorMessage)).toMatch(/not deleted/i);

		await canvas().delete(`/api/v1/accounts/${root}/users/${userId}`);
	});

	it('restoreUser: only works on a root account', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'restoreUser',
			params: { accountId: sub, userId: fx('deletedUserId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// -------------------------------------------------------- deleteSubAccount

	it('deleteSubAccount: Canvas refuses accounts that still hold courses or sub-accounts', async () => {
		const withCourses = await runNode({
			resource: 'account',
			operation: 'deleteSubAccount',
			params: { accountId: parentId, subAccountId: childId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(withCourses.success).toEqual([]);
		expect(withCourses.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT', operation: 'deleteSubAccount' });
		expect(String(withCourses.error[0].errorMessage).length).toBeGreaterThan(10);
		expect((await canvas().get<Json>(`/api/v1/accounts/${childId}`)).workflow_state).toBe('active');

		await canvas().delete(`/api/v1/courses/${courseInChild}?event=delete`);
		courseInChild = '';

		const withChildren = await runNode({
			resource: 'account',
			operation: 'deleteSubAccount',
			params: { accountId: root, subAccountId: parentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(withChildren.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT' });
		// A different refusal than the one about courses.
		expect(withChildren.error[0].errorMessage).not.toBe(withCourses.error[0].errorMessage);
		expect((await canvas().get<Json>(`/api/v1/accounts/${parentId}`)).workflow_state).toBe('active');
	});

	it('deleteSubAccount: removes empty sub-accounts, child before parent', async () => {

		const [deletedChild] = await runOk({
			resource: 'account',
			operation: 'deleteSubAccount',
			params: { accountId: parentId, subAccountId: childId },
		});
		expect(deletedChild).toMatchObject({ id: Number(childId), workflow_state: 'deleted' });

		const [deletedParent] = await runOk({
			resource: 'account',
			operation: 'deleteSubAccount',
			items: [{ parent: Number(root), account: Number(parentId) }],
			params: { accountId: '={{ $json.parent }}', subAccountId: '={{ $json.account }}' },
		});
		expect(deletedParent.workflow_state).toBe('deleted');

		const remaining = await canvas().getAll<Json>(`/api/v1/accounts/${root}/sub_accounts?recursive=true`);
		expect(ids(remaining)).not.toContain(Number(parentId));
		expect(ids(remaining)).not.toContain(Number(childId));
		const gone = await canvas().request('GET', `/api/v1/accounts/${parentId}`);
		expect(gone.status).toBe(404);
	});

	it('deleteSubAccount: an unknown sub-account is a 404', async () => {
		const result = await runNode({
			resource: 'account',
			operation: 'deleteSubAccount',
			params: { accountId: root, subAccountId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'deleteSubAccount' });
	});
});
