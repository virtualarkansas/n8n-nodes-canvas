import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resources: cspSetting, developerKeyAccountBinding.
 * Everything that changes settings happens in a sub-account created for this file.
 */
let accountId = '';
let childAccountId = '';
let courseId = '';

beforeAll(async () => {
	const c = canvas();
	const account = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, { account: { name: unique('Security battery') } });
	accountId = String(account.id);
	const child = await c.post<Json>(`/api/v1/accounts/${accountId}/sub_accounts`, { account: { name: unique('Security battery child') } });
	childAccountId = String(child.id);
	const course = await c.post<Json>(`/api/v1/accounts/${childAccountId}/courses`, { course: { name: unique('CSP course') } });
	courseId = String(course.id);
});

describe('cspSetting', () => {
	const read = (id: string) => canvas().get<Json>(`/api/v1/accounts/${id}/csp_settings`);

	it('get: an untouched account inherits its policy', async () => {
		const [settings] = await runOk({ resource: 'cspSetting', operation: 'get', params: { contextType: 'account', accountId } });
		expect(settings).toMatchObject({ enabled: false, inherited: true, settings_locked: false });
		expect(settings).toEqual(await read(accountId));
	});

	it('setStatus: enables the policy explicitly on an account', async () => {
		const [settings] = await runOk({ resource: 'cspSetting', operation: 'setStatus', params: { contextType: 'account', accountId, status: 'enabled' } });
		expect(settings).toMatchObject({ enabled: true, inherited: false });
		expect(await read(accountId)).toMatchObject({ enabled: true, inherited: false });
		// The child account and its course now inherit "enabled".
		expect(await read(childAccountId)).toMatchObject({ enabled: true, inherited: true });
	});

	it('addDomain and addDomains: extend the allowed domains, trimming and splitting input', async () => {
		const [one] = await runOk({ resource: 'cspSetting', operation: 'addDomain', params: { accountId, domain: '  cdn.example.com ' } });
		expect(one.current_account_whitelist).toEqual(['cdn.example.com']);

		const [many] = await runOk({
			resource: 'cspSetting',
			operation: 'addDomains',
			params: { accountId, domains: '*.example.org,  media.example.net\nfonts.example.io' },
		});
		expect(many.current_account_whitelist).toEqual(['*.example.org', 'cdn.example.com', 'fonts.example.io', 'media.example.net']);
		expect((await read(accountId)).current_account_whitelist).toEqual(many.current_account_whitelist);
	});

	it('get: a course reports the policy it inherits, including the allowed domains', async () => {
		const [settings] = await runOk({ resource: 'cspSetting', operation: 'get', params: { contextType: 'course', courseId } });
		expect(settings).toMatchObject({ enabled: true, inherited: true });
		expect(settings.effective_whitelist).toEqual(expect.arrayContaining(['cdn.example.com', '*.example.org']));
	});

	it('setStatus: a course can opt out, and go back to inheriting', async () => {
		const [off] = await runOk({ resource: 'cspSetting', operation: 'setStatus', params: { contextType: 'course', courseId, status: 'disabled' } });
		expect(off).toMatchObject({ enabled: false, inherited: false });
		const [back] = await runOk({ resource: 'cspSetting', operation: 'setStatus', params: { contextType: 'course', courseId, status: 'inherited' } });
		expect(back).toMatchObject({ enabled: true, inherited: true });
	});

	it('lock and unlock: change whether sub-accounts and courses may override the policy', async () => {
		// Canvas' own response to the lock call still shows the old state; the node reads the settings again.
		const [locked] = await runOk({ resource: 'cspSetting', operation: 'lock', params: { accountId, settingsLocked: true } });
		expect(locked).toMatchObject({ settings_locked: true, enabled: true });
		expect(await read(accountId)).toMatchObject({ settings_locked: true });

		// (Whether a course below is refused right away depends on Canvas' cache of inherited
		// account settings, so the effect of the lock is asserted on the account itself.)

		const [unlocked] = await runOk({ resource: 'cspSetting', operation: 'lock', params: { accountId, settingsLocked: false } });
		expect(unlocked).toMatchObject({ settings_locked: false });
		expect(await read(accountId)).toMatchObject({ settings_locked: false });
	});

	it('lock: is refused on an account that only inherits its policy', async () => {
		const result = await runNode({
			resource: 'cspSetting',
			operation: 'lock',
			params: { accountId: childAccountId, settingsLocked: true, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(result.error[0].errorMessage)).toMatch(/explicitly set/i);
	});

	it('removeDomain: removes one domain and leaves the rest', async () => {
		const [after] = await runOk({ resource: 'cspSetting', operation: 'removeDomain', params: { accountId, domain: '*.example.org' } });
		expect(after.current_account_whitelist).toEqual(['cdn.example.com', 'fonts.example.io', 'media.example.net']);
	});

	it('errors: invalid domains and missing rights are reported', async () => {
		const invalid = await runNode({
			resource: 'cspSetting',
			operation: 'addDomain',
			params: { accountId, domain: 'not a domain!!', errorHandling: { onError: 'continueWithError' } },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 400 });

		const teacher = await runNode({
			resource: 'cspSetting',
			operation: 'setStatus',
			persona: 'teacher',
			params: { contextType: 'account', accountId, status: 'disabled', errorHandling: { onError: 'continueWithError' } },
		});
		expect(teacher.success).toEqual([]);
		expect([401, 403]).toContain(teacher.error[0].errorCode);
	});

	it('several accounts in one run: each input item is handled and linked', async () => {
		const result = await runNode({
			resource: 'cspSetting',
			operation: 'get',
			items: [{ id: accountId }, { id: 99999999 }, { id: childAccountId }],
			params: { contextType: 'account', accountId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, originalItem: { id: 99999999 } });
	});
});

describe('developerKeyAccountBinding', () => {
	let keyId = '';

	beforeAll(async () => {
		const key = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/developer_keys`, {
			developer_key: { name: unique('Binding battery key'), redirect_uris: 'https://example.com/callback' },
		});
		keyId = String(key.id);
	});

	const binding = async (): Promise<Json> => {
		const keys = await canvas().getAll<Json>(`/api/v1/accounts/${fx('accountId')}/developer_keys`);
		return keys.find((k) => String(k.id) === keyId)!.developer_key_account_binding as Json;
	};

	it('set: switches the key on, off and back to "allow" for an account', async () => {
		for (const state of ['on', 'off', 'allow']) {
			const [result] = await runOk({
				resource: 'developerKeyAccountBinding',
				operation: 'set',
				params: { accountId: fx('accountId'), developerKeyId: keyId, workflowState: state },
			});
			expect(result).toMatchObject({ workflow_state: state, developer_key_id: Number(keyId) });
			expect((await binding()).workflow_state).toBe(state);
		}
	});

	it('errors: an unknown key and an invalid caller are reported', async () => {
		const missing = await runNode({
			resource: 'developerKeyAccountBinding',
			operation: 'set',
			params: { accountId: fx('accountId'), developerKeyId: '99999999', workflowState: 'on', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect([401, 404]).toContain(missing.error[0].errorCode);

		const teacher = await runNode({
			resource: 'developerKeyAccountBinding',
			operation: 'set',
			persona: 'teacher',
			params: { accountId: fx('accountId'), developerKeyId: keyId, workflowState: 'off', errorHandling: { onError: 'continueWithError' } },
		});
		expect(teacher.success).toEqual([]);
		expect([401, 403]).toContain(teacher.error[0].errorCode);
		expect((await binding()).workflow_state).toBe('allow');
	});
});
