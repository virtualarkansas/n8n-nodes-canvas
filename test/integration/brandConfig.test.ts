import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { canvasSql, createSandboxAccount, deleteSandboxAccount } from './support/gradingSandbox';

/**
 * Resource: brandConfig (shared themes). Themes are shared in a sub-account that
 * belongs to this file alone; nothing is applied to any account, and the themes
 * Canvas ships with (shared with every account) are only used as the brand
 * configs to point at.
 *
 * Canvas has no API to read shared themes, so they are read back from its database.
 */
describe('brandConfig', () => {
	let accountId = '';
	let md5s: string[] = [];
	let sharedId = '';
	const created: string[] = [];
	const eh = { errorHandling: { onError: 'continueWithError' } };

	/** name | brand_config_md5 | account_id of a shared theme, or '' when it does not exist. */
	const row = (id: string | number): string =>
		canvasSql(`select name || '|' || brand_config_md5 || '|' || account_id from shared_brand_configs where id = ${Number(id)}`);
	const countInAccount = (): number => Number(canvasSql(`select count(*) from shared_brand_configs where account_id = ${Number(accountId)}`));

	beforeAll(async () => {
		accountId = await createSandboxAccount('shared themes');
		md5s = canvasSql('select md5 from brand_configs order by md5 limit 2').split('\n').filter(Boolean);
		expect(md5s, 'Canvas ships with brand configs to share').toHaveLength(2);
	}, 300_000);

	afterAll(async () => {
		for (const id of created) await canvas().request('DELETE', `/api/v1/shared_brand_configs/${id}`);
		await deleteSandboxAccount(accountId);
	}, 300_000);

	it('share: a brand config gets a name in an account', async () => {
		const name = unique('Crimson & "Gold" — ünï 主題');
		const [shared] = await runOk({
			resource: 'brandConfig',
			operation: 'share',
			params: { accountId, name, brandConfigMd5: ` ${md5s[0]} ` },
		});
		sharedId = String(shared.id);
		created.push(sharedId);
		expect(shared).toMatchObject({ name, account_id: Number(accountId), brand_config_md5: md5s[0] });
		expect(row(sharedId)).toBe(`${name}|${md5s[0]}|${accountId}`);

		// One theme per input item; the account ID as a number from an expression.
		const more = await runOk({
			resource: 'brandConfig',
			operation: 'share',
			items: [{ account: Number(accountId), label: unique('Second theme'), md5: md5s[1] }, { account: Number(accountId), label: unique('Third theme'), md5: md5s[0] }],
			params: { accountId: '={{ $json.account }}', name: '={{ $json.label }}', brandConfigMd5: '={{ $json.md5 }}' },
		});
		expect(more.map((theme) => theme.brand_config_md5)).toEqual([md5s[1], md5s[0]]);
		for (const theme of more) created.push(String(theme.id));
		expect(countInAccount()).toBe(3);
	});

	it('updateShared: the name, the brand config, or both', async () => {
		const before = row(sharedId).split('|');

		const renamed = unique('Renamed theme');
		const [afterRename] = await runOk({
			resource: 'brandConfig',
			operation: 'updateShared',
			params: { accountId, sharedBrandConfigId: sharedId, updateFields: { name: renamed } },
		});
		expect(afterRename).toMatchObject({ id: Number(sharedId), name: renamed, brand_config_md5: before[1] });
		expect(row(sharedId)).toBe(`${renamed}|${md5s[0]}|${accountId}`);

		await runOk({
			resource: 'brandConfig',
			operation: 'updateShared',
			params: { accountId, sharedBrandConfigId: sharedId, updateFields: { brand_config_md5: md5s[1] } },
		});
		expect(row(sharedId)).toBe(`${renamed}|${md5s[1]}|${accountId}`);

		const both = unique('Both changed');
		const [afterBoth] = await runOk({
			resource: 'brandConfig',
			operation: 'updateShared',
			items: [{ id: Number(sharedId) }],
			params: { accountId, sharedBrandConfigId: '={{ $json.id }}', updateFields: { name: both, brand_config_md5: md5s[0] } },
		});
		expect(afterBoth).toMatchObject({ name: both, brand_config_md5: md5s[0], account_id: Number(accountId) });
		expect(row(sharedId)).toBe(`${both}|${md5s[0]}|${accountId}`);
	});

	it('unshare: removes the shared theme, not the brand config', async () => {
		const [removed] = await runOk({ resource: 'brandConfig', operation: 'unshare', params: { sharedBrandConfigId: sharedId } });
		expect(removed).toMatchObject({ id: Number(sharedId), account_id: Number(accountId), brand_config_md5: md5s[0] });
		expect(row(sharedId)).toBe('');
		expect(countInAccount()).toBe(2);
		expect(Number(canvasSql(`select count(*) from brand_configs where md5 = '${md5s[0]}'`))).toBe(1);

		const again = await runNode({ resource: 'brandConfig', operation: 'unshare', params: { sharedBrandConfigId: sharedId, ...eh } });
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'brandConfig', operation: 'unshare' });
	});

	it('errors: an MD5 Canvas does not know, nothing to update, missing rights', async () => {
		const before = countInAccount();
		const target = created[1];
		const targetRow = row(target);

		const unknownMd5 = await runNode({
			resource: 'brandConfig',
			operation: 'share',
			params: { accountId, name: unique('No such brand config'), brandConfigMd5: '0123456789abcdef0123456789abcdef', ...eh },
		});
		expect(unknownMd5.success).toEqual([]);
		expect(unknownMd5.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'brandConfig', operation: 'share' });
		expect(unknownMd5.error[0].canvasErrors).toHaveProperty('brand_config');

		const nothing = await runNode({
			resource: 'brandConfig',
			operation: 'updateShared',
			params: { accountId, sharedBrandConfigId: target, updateFields: { name: '', brand_config_md5: ' ' }, ...eh },
		});
		expect(nothing.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(nothing.error[0].errorMessage)).toContain('at least one field');

		const badUpdate = await runNode({
			resource: 'brandConfig',
			operation: 'updateShared',
			params: { accountId, sharedBrandConfigId: target, updateFields: { brand_config_md5: 'not-an-md5' }, ...eh },
		});
		expect(badUpdate.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR' });

		// The teacher persona manages no account.
		const cases: Array<[string, Json]> = [
			['share', { accountId, name: unique('Not allowed'), brandConfigMd5: md5s[0] }],
			['updateShared', { accountId, sharedBrandConfigId: target, updateFields: { name: 'Not allowed' } }],
			['unshare', { sharedBrandConfigId: target }],
		];
		for (const [operation, params] of cases) {
			const forbidden = await runNode({ resource: 'brandConfig', operation, persona: 'teacher', params: { ...params, ...eh } });
			expect(forbidden.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(forbidden.error[0].errorCode);
			expect(forbidden.error[0], operation).toMatchObject({ resource: 'brandConfig', operation });
		}

		const noAccount = await runNode({
			resource: 'brandConfig',
			operation: 'share',
			params: { accountId: '99999999', name: 'Nowhere', brandConfigMd5: md5s[0], ...eh },
		});
		expect(noAccount.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		const noTheme = await runNode({
			resource: 'brandConfig',
			operation: 'updateShared',
			params: { accountId, sharedBrandConfigId: '99999999', updateFields: { name: 'Nothing' }, ...eh },
		});
		expect(noTheme.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// Nothing changed.
		expect(countInAccount()).toBe(before);
		expect(row(target)).toBe(targetRow);
	});
});
