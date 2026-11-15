import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { toolConfiguration } from './lti-advantage.helper';

/**
 * Resource: ltiRegistration. Registrations can only be written in a root
 * account, so the battery creates a handful of its own there (turned off
 * unless a test needs them on) and deletes them again.
 *
 * The local Canvas runs with LTI registration templates: an overlay is folded
 * into the stored configuration when it is written (the overlay record itself
 * stays empty), so overlays are verified through the configuration.
 */
describe('ltiRegistration', () => {
	const accountId = fx('accountId');
	const base = `/api/v1/accounts/${accountId}/lti_registrations`;
	const marker = `ltireg${randomUUID().slice(0, 8)}`;
	const created: string[] = [];
	/** Site Admin template and its local copy, for the bind tests. */
	let templateId = '';
	let localCopyId = '';
	let registrationId = '';
	let clientId = '';
	const host = `${marker}.lti.example.com`;
	const name = unique(`Battery Registration ${marker} Ünïcødé 登録 "quoted" & <b>tags</b>`);
	const unifiedToolId = `utid-${marker}`;

	const read = (id: string, include: string[] = []): Promise<Json> =>
		canvas().get<Json>(`${base}/${id}${include.length ? `?${include.map((i) => `include[]=${i}`).join('&')}` : ''}`);

	afterAll(async () => {
		for (const id of [...created, localCopyId].filter(Boolean)) {
			await canvas().request('DELETE', `${base}/${id}`);
		}
		if (templateId) {
			await canvas().request(
				'DELETE',
				`/api/v1/accounts/${fx('siteAdminAccountId')}/lti_registrations/${templateId}`,
			);
		}
	});

	it('create: every optional field reaches Canvas', async () => {
		const [registration] = await runOk({
			resource: 'ltiRegistration',
			operation: 'create',
			params: {
				accountId,
				configuration: JSON.stringify(
					toolConfiguration(host, {
						public_jwk_url: `https://${host}/jwks`,
						placements: [
							{ placement: 'course_navigation', enabled: true, text: 'Nav from configuration' },
							{ placement: 'link_selection', enabled: true, message_type: 'LtiDeepLinkingRequest' },
						],
					}),
				),
				additionalFields: {
					name,
					admin_nickname: 'Nickname with emoji 🧩',
					vendor: 'Battery & Sons',
					description: 'Registration <i>description</i>',
					unified_tool_id: unifiedToolId,
					workflow_state: 'on',
					overlay: '{"title": "Overlaid title", "disabled_placements": ["course_navigation"]}',
				},
			},
		});
		registrationId = String(registration.id);
		created.push(registrationId);
		clientId = String(registration.developer_key_id);
		expect(registration.name).toBe(name);

		const actual = await read(registrationId, ['overlay', 'overlaid_configuration']);
		expect(actual).toMatchObject({
			name,
			admin_nickname: 'Nickname with emoji 🧩',
			vendor: 'Battery & Sons',
			description: 'Registration <i>description</i>',
			lti_version: '1.3',
			account_binding: { workflow_state: 'on' },
		});
		expect(actual.configuration).toMatchObject({
			target_link_uri: `https://${host}/launch`,
			oidc_initiation_url: `https://${host}/oidc`,
			redirect_uris: [`https://${host}/redirect`],
			public_jwk_url: `https://${host}/jwks`,
		});
		// The overlay: its title wins, and the placement it disables is switched off.
		expect(actual.overlaid_configuration).toMatchObject({ title: 'Overlaid title' });
		const placements = (actual.overlaid_configuration as Json).placements as Json[];
		expect(placements.find((p) => p.placement === 'course_navigation')).toMatchObject({ enabled: false });
		expect(placements.find((p) => p.placement === 'link_selection')).toMatchObject({ enabled: true });
		const byUtid = await canvas().get<Json>(`${base}/by_utid/${unifiedToolId}`);
		expect(byUtid.id).toBe(Number(registrationId));
	});

	it('create: with only a configuration the name comes from its title and the registration is off', async () => {
		const minimalHost = `min-${marker}.lti.example.com`;
		const [registration] = await runOk({
			resource: 'ltiRegistration',
			operation: 'create',
			// A JSON field filled from an expression hands over an object, not text.
			items: [{ config: toolConfiguration(minimalHost, { public_jwk_url: `https://${minimalHost}/jwks` }) }],
			params: { accountId, configuration: '={{ $json.config }}' },
		});
		created.push(String(registration.id));
		const actual = await read(String(registration.id));
		expect(actual).toMatchObject({
			name: `Battery tool ${minimalHost}`,
			admin_nickname: null,
			account_binding: { workflow_state: 'off' },
		});
	});

	it('create: an incomplete configuration is refused with Canvas\' explanation', async () => {
		const result = await runNode({
			resource: 'ltiRegistration',
			operation: 'create',
			params: {
				accountId,
				configuration: '{"title": "No launch URL"}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'VALIDATION_ERROR', resource: 'ltiRegistration', operation: 'create' });
		expect([400, 422]).toContain(result.error[0].errorCode);
		expect(String(result.error[0].errorMessage)).toMatch(/target_link_uri|oidc_initiation_url|redirect_uris/);
	});

	it('create: invalid JSON never reaches Canvas', async () => {
		const result = await runNode({
			resource: 'ltiRegistration',
			operation: 'create',
			params: { accountId, configuration: '{"title": ', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/Invalid JSON in Configuration/);
	});

	it('get: returns the registration with every include', async () => {
		const [registration] = await runOk({
			resource: 'ltiRegistration',
			operation: 'get',
			params: {
				accountId,
				registrationId,
				options: {
					include: [
						'account_binding',
						'configuration',
						'overlaid_configuration',
						'overlaid_legacy_configuration',
						'overlay',
						'overlay_versions',
					],
				},
			},
		});
		expect(registration).toMatchObject({ id: Number(registrationId), name });
		expect(registration.account_binding).toMatchObject({ workflow_state: 'on' });
		expect(registration.configuration).toMatchObject({ target_link_uri: `https://${host}/launch` });
		expect(registration.overlaid_configuration).toMatchObject({ title: 'Overlaid title' });
		expect(registration.overlaid_legacy_configuration).toMatchObject({
			target_link_uri: `https://${host}/launch`,
			extensions: expect.any(Array),
		});

		const [plain] = await runOk({ resource: 'ltiRegistration', operation: 'get', params: { accountId, registrationId } });
		expect(plain.overlaid_configuration).toBeUndefined();
		expect(plain.overlaid_legacy_configuration).toBeUndefined();
		expect(plain.configuration).toBeTypeOf('object');
		expect(plain.account_binding).toBeTypeOf('object');
	});

	it('getByClientId and getByUnifiedToolId find the same registration', async () => {
		const [byClient] = await runOk({
			resource: 'ltiRegistration',
			operation: 'getByClientId',
			params: { accountId, clientId },
		});
		expect(byClient).toMatchObject({ id: Number(registrationId), name });

		const [byUtid] = await runOk({
			resource: 'ltiRegistration',
			operation: 'getByUnifiedToolId',
			params: { accountId, unifiedToolId },
		});
		expect(byUtid).toMatchObject({ id: Number(registrationId), name });

		// A client ID that is a plain API developer key has no registration.
		const result = await runNode({
			resource: 'ltiRegistration',
			operation: 'getByClientId',
			items: [{ client: clientId }, { client: fx('developerKeyId') }, { client: '99999999' }],
			params: { accountId, clientId: '={{ $json.client }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((r) => r.id)).toEqual([Number(registrationId)]);
		expect(result.error).toHaveLength(2);
		expect(result.error.every((e) => e.errorCode === 404 && e.errorType === 'NOT_FOUND')).toBe(true);
	});

	it('getAll: unwraps the list, pages, searches, sorts and includes', async () => {
		for (const suffix of ['alpha', 'bravo', 'charlie']) {
			const extraHost = `${suffix}-${marker}.lti.example.com`;
			const extra = await canvas().post<Json>(base, {
				name: `${marker} ${suffix}`,
				vendor: `Vendor ${suffix}`,
				configuration: toolConfiguration(extraHost, { public_jwk_url: `https://${extraHost}/jwks` }),
			});
			created.push(String(extra.id));
		}
		// Other test files register tools in the root account at the same time, so the complete
		// list is compared through this file's own registrations (found by their marker).
		const own = (list: Json[]): unknown[] =>
			list.filter((r) => JSON.stringify(r).includes(marker)).map((r) => r.id).sort();
		const expected = await canvas().getAll<Json>(base, 'data');
		expect(own(expected)).toHaveLength(5);

		const all = await runOk({
			resource: 'ltiRegistration',
			operation: 'getAll',
			params: { accountId, options: { include: ['configuration'] }, pagination: { returnAll: true } },
		});
		// Every registration is its own item (not one item holding { total, data }).
		expect(own(all)).toEqual(own(expected));
		expect(all.every((r) => r.account_binding !== undefined)).toBe(true);
		expect(all[0].total).toBeUndefined();
		expect(new Set(all.map((r) => r.id)).size).toBe(all.length);

		const twoPages = await runOk({
			resource: 'ltiRegistration',
			operation: 'getAll',
			params: { accountId, pagination: { perPage: 2, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(4);
		expect(new Set(twoPages.map((r) => r.id)).size).toBe(4);

		const searched = await runOk({
			resource: 'ltiRegistration',
			operation: 'getAll',
			params: {
				accountId,
				options: { query: marker, sort: 'name', dir: 'asc', include: ['configuration', 'overlay', 'overlaid_configuration'] },
				pagination: { returnAll: true },
			},
		});
		// The marker is in the name of four registrations and in the host of the fifth.
		const names = searched.map((r) => String(r.name));
		expect(names).toHaveLength(5);
		expect(names.filter((n) => n.startsWith(marker))).toEqual([`${marker} alpha`, `${marker} bravo`, `${marker} charlie`]);
		expect(searched.every((r) => typeof r.configuration === 'object' && r.configuration !== null)).toBe(true);
		expect(searched.every((r) => 'overlaid_configuration' in r)).toBe(true);

		const descending = await runOk({
			resource: 'ltiRegistration',
			operation: 'getAll',
			params: { accountId, options: { query: `${marker} vendor`, sort: 'name', dir: 'desc' } },
		});
		expect(descending.map((r) => r.name)).toEqual([`${marker} charlie`, `${marker} bravo`, `${marker} alpha`]);

		const nothing = await runOk({
			resource: 'ltiRegistration',
			operation: 'getAll',
			params: { accountId, options: { query: `no-such-registration-${marker}` } },
		});
		expect(nothing).toEqual([]);
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const newConfiguration = toolConfiguration(host, {
			title: 'Second title',
			public_jwk_url: `https://${host}/jwks2`,
			placements: [{ placement: 'course_navigation', enabled: true, text: 'Second nav' }],
		});
		const [updated] = await runOk({
			resource: 'ltiRegistration',
			operation: 'update',
			params: {
				accountId,
				registrationId,
				updateFields: {
					name: renamed,
					admin_nickname: 'Second nickname',
					vendor: 'Second vendor',
					description: 'Second description',
					comment: `Changed by the battery ${marker}`,
					configuration: JSON.stringify(newConfiguration),
					overlay: '{"title": "Second overlaid title", "disabled_scopes": ["https://purl.imsglobal.org/spec/lti-ags/scope/score"]}',
					workflow_state: 'off',
					lock_deploying: true,
				},
			},
		});
		expect(updated.name).toBe(renamed);

		const actual = await read(registrationId, ['overlaid_configuration']);
		expect(actual).toMatchObject({
			name: renamed,
			admin_nickname: 'Second nickname',
			vendor: 'Second vendor',
			description: 'Second description',
			lock_deploying: true,
			account_binding: { workflow_state: 'off' },
		});
		expect(actual.configuration).toMatchObject({ public_jwk_url: `https://${host}/jwks2` });
		// The overlay: its title wins, and the scope it disables is gone.
		const overlaid = actual.overlaid_configuration as Json;
		expect(overlaid).toMatchObject({ title: 'Second overlaid title' });
		expect(overlaid.scopes).not.toContain('https://purl.imsglobal.org/spec/lti-ags/scope/score');
		expect(overlaid.scopes).toContain('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem');
		expect((overlaid.placements as Json[]).map((p) => p.placement)).toEqual(['course_navigation']);
	});

	it('update: an untouched JSON field ("{}") does not wipe the configuration or the overlay', async () => {
		await runOk({
			resource: 'ltiRegistration',
			operation: 'update',
			params: {
				accountId,
				registrationId,
				updateFields: { admin_nickname: 'Third nickname', configuration: '{}', overlay: '{}', lock_deploying: false },
			},
		});
		const actual = await read(registrationId, ['overlaid_configuration']);
		expect(actual).toMatchObject({ admin_nickname: 'Third nickname', lock_deploying: false });
		expect(actual.configuration).toMatchObject({ public_jwk_url: `https://${host}/jwks2` });
		expect(actual.overlaid_configuration).toMatchObject({ title: 'Second overlaid title' });
	});

	it('bind: installs a Site Admin registration in the root account and turns it on and off', async () => {
		// Only registrations inherited from Site Admin can be bound; the battery supplies its own.
		const templateHost = `tpl-${marker}.lti.example.com`;
		const template = await canvas().post<Json>(`/api/v1/accounts/${fx('siteAdminAccountId')}/lti_registrations`, {
			name: `${marker} site admin template`,
			workflow_state: 'allow',
			configuration: toolConfiguration(templateHost, { public_jwk_url: `https://${templateHost}/jwks` }),
		});
		templateId = String(template.id);

		const [binding] = await runOk({
			resource: 'ltiRegistration',
			operation: 'bind',
			params: { accountId, registrationId: templateId, workflowState: 'on' },
		});
		expect(binding).toMatchObject({
			account_id: Number(accountId),
			registration_id: Number(templateId),
			workflow_state: 'on',
		});
		// Canvas installs a local copy of the template in the account.
		const findCopy = async (): Promise<Json | undefined> =>
			(await canvas().getAll<Json>(base, 'data')).find((r) => r.template_registration_id === Number(templateId));
		const copy = await findCopy();
		expect(copy).toMatchObject({ name: `${marker} site admin template`, inherited: true, workflow_state: 'active' });
		localCopyId = String(copy!.id);

		const [off] = await runOk({
			resource: 'ltiRegistration',
			operation: 'bind',
			params: { accountId, registrationId: templateId, workflowState: 'off' },
		});
		expect(off).toMatchObject({ registration_id: Number(templateId), workflow_state: 'off' });
		expect(await findCopy()).toMatchObject({ id: Number(localCopyId), workflow_state: 'inactive' });
	});

	it('bind: a registration of the account itself cannot be bound (use Update > Workflow State)', async () => {
		const result = await runNode({
			resource: 'ltiRegistration',
			operation: 'bind',
			params: { accountId, registrationId, workflowState: 'on', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', operation: 'bind' });

		await runOk({
			resource: 'ltiRegistration',
			operation: 'update',
			params: { accountId, registrationId, updateFields: { workflow_state: 'on' } },
		});
		expect((await read(registrationId)).account_binding).toMatchObject({ workflow_state: 'on' });
	});

	it('getHistory and getOverlayHistory: show the changes made above', async () => {
		const expectedHistory = await canvas().getAll<Json>(`${base}/${registrationId}/history`);
		const history = await runOk({
			resource: 'ltiRegistration',
			operation: 'getHistory',
			params: { accountId, registrationId, pagination: { returnAll: true } },
		});
		expect(history.map((h) => h.id)).toEqual(expectedHistory.map((h) => h.id));
		expect(history.map((h) => h.comment)).toContain(`Changed by the battery ${marker}`);

		expect(history.map((h) => h.update_type)).toContain('manual_edit');

		// (Empty on the local Canvas: with registration templates overlays keep no versions.)
		const expectedOverlay = await canvas().get<Json[]>(`${base}/${registrationId}/overlay_history?limit=100`);
		const overlayHistory = await runOk({
			resource: 'ltiRegistration',
			operation: 'getOverlayHistory',
			params: { accountId, registrationId, options: { limit: 100 } },
		});
		expect(overlayHistory.map((h) => h.id)).toEqual(expectedOverlay.map((h) => h.id));

		const limited = await runOk({
			resource: 'ltiRegistration',
			operation: 'getOverlayHistory',
			params: { accountId, registrationId, options: { limit: 1 } },
		});
		expect(limited.map((h) => h.id)).toEqual(expectedOverlay.slice(0, 1).map((h) => h.id));
	});

	it('reset: removes every customization of the overlay', async () => {
		const [reset] = await runOk({
			resource: 'ltiRegistration',
			operation: 'reset',
			params: { accountId, registrationId },
		});
		expect(reset).toMatchObject({ id: Number(registrationId) });
		expect(reset.overlaid_configuration).toBeTypeOf('object');

		// The local copy of the Site Admin template has an overlay record: reset leaves it empty.
		const [copyReset] = await runOk({
			resource: 'ltiRegistration',
			operation: 'reset',
			params: { accountId, registrationId: localCopyId },
		});
		expect(copyReset).toMatchObject({ id: Number(localCopyId) });
		expect((copyReset.overlay as Json).data).toEqual({});
		expect(((await read(localCopyId, ['overlay'])).overlay as Json).data).toEqual({});
	});

	it('errors: sub-accounts are read-only, students have no access, missing IDs are 404', async () => {
		const listedInSubAccount = await runOk({
			resource: 'ltiRegistration',
			operation: 'getAll',
			params: { accountId: fx('subAccountId'), options: { query: marker } },
		});
		expect(listedInSubAccount.length).toBeGreaterThanOrEqual(0);

		const subAccountHost = `sub-${marker}.lti.example.com`;
		const inSubAccount = await runNode({
			resource: 'ltiRegistration',
			operation: 'create',
			params: {
				accountId: fx('subAccountId'),
				configuration: JSON.stringify(
					toolConfiguration(subAccountHost, { public_jwk_url: `https://${subAccountHost}/jwks` }),
				),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(inSubAccount.success).toEqual([]);
		expect([401, 403, 404]).toContain(inSubAccount.error[0].errorCode);

		const asStudent = await runNode({
			resource: 'ltiRegistration',
			operation: 'getAll',
			persona: 'student',
			params: { accountId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });

		const missing = await runNode({
			resource: 'ltiRegistration',
			operation: 'get',
			params: { accountId, registrationId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });
	});

	it('delete: removes the registration', async () => {
		const [deleted] = await runOk({
			resource: 'ltiRegistration',
			operation: 'delete',
			params: { accountId, registrationId },
		});
		expect(deleted).toMatchObject({ id: Number(registrationId), workflow_state: 'deleted' });
		expect((await canvas().request('GET', `${base}/${registrationId}`)).status).toBe(404);
		const remaining = await canvas().getAll<Json>(base, 'data');
		expect(remaining.map((r) => r.id)).not.toContain(Number(registrationId));
	});
});
