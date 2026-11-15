import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { expectSameIds, failureText, ids, pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: authenticationProvider.
 *
 * The providers of the root account every worker logs in to are only read.
 * Everything that is created, changed or deleted lives on the Site Admin
 * account, whose login page nobody uses on this instance; its Canvas provider
 * is never touched and its SSO settings are put back.
 */
describe('authenticationProvider', () => {
	const root = fx('accountId');
	const playground = fx('siteAdminAccountId');
	const created: string[] = [];
	let samlId = '';
	let oidcId = '';
	let ldapId = '';
	let originalSso: Json = {};

	const provider = (id: string, account = playground): Promise<Json> =>
		canvas().get<Json>(`/api/v1/accounts/${account}/authentication_providers/${id}`);
	const providers = (account = playground): Promise<Json[]> =>
		canvas().get<Json[]>(`/api/v1/accounts/${account}/authentication_providers`);
	const ssoSettings = async (account = playground): Promise<Json> =>
		(await canvas().get<Json>(`/api/v1/accounts/${account}/sso_settings`)).sso_settings as Json;

	const create = async (authType: string, additionalFields: Json): Promise<Json> => {
		const [result] = await runOk({
			resource: 'authenticationProvider',
			operation: 'create',
			params: { accountId: playground, authType, additionalFields },
		});
		created.push(String(result.id));
		return result;
	};

	beforeAll(async () => {
		originalSso = await ssoSettings();
	});

	afterAll(async () => {
		for (const id of created) {
			await canvas().request('DELETE', `/api/v1/accounts/${playground}/authentication_providers/${id}`);
		}
		await canvas().request('PUT', `/api/v1/accounts/${playground}/sso_settings`, { sso_settings: originalSso });
	});

	// ------------------------------------------------------- get / getAll (read-only)

	it('getAll: lists the active providers of the account; Limit and Return All are honoured', async () => {
		const expected = await providers(root);
		expect(expected.length).toBeGreaterThanOrEqual(3);

		const all = await runOk({
			resource: 'authenticationProvider',
			operation: 'getAll',
			params: { accountId: root, returnAll: true },
		});
		expectSameIds(all, expected, await providers(root));
		expect(ids(all)).toEqual(
			expect.arrayContaining(
				[fx('canvasAuthenticationProviderId'), fx('authenticationProviderId'), fx('casAuthenticationProviderId')].map(Number),
			),
		);
		expect(ids(all)).not.toContain(Number(fx('deletedAuthenticationProviderId')));
		// Secrets are never part of the output.
		expect(JSON.stringify(all)).not.toMatch(/client_secret|auth_password/);

		const limited = await runOk({
			resource: 'authenticationProvider',
			operation: 'getAll',
			params: { accountId: 'self', returnAll: false, limit: 2 },
		});
		expect(limited).toHaveLength(2);
		expect(limited[0].id).toBe(expected[0].id);

		const defaults = await runOk({ resource: 'authenticationProvider', operation: 'getAll', params: { accountId: root } });
		expect(defaults.length).toBeGreaterThanOrEqual(3);
		expect(defaults.length).toBeLessThanOrEqual(50);
	});

	it('getAll: sub-accounts have no providers of their own, and a teacher is refused', async () => {
		const subAccount = await runNode({
			resource: 'authenticationProvider',
			operation: 'getAll',
			params: { accountId: fx('subAccountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(subAccount.success).toEqual([]);
		expect(subAccount.error.length + (subAccount.failure ? 1 : 0)).toBeGreaterThan(0);

		const asTeacher = await runNode({
			resource: 'authenticationProvider',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	it('get: by ID and by provider type; a deleted provider is not found', async () => {
		const [saml] = await runOk({
			resource: 'authenticationProvider',
			operation: 'get',
			params: { accountId: root, providerId: fx('authenticationProviderId') },
		});
		expect(saml).toEqual(await provider(fx('authenticationProviderId'), root));
		expect(saml).toMatchObject({ id: Number(fx('authenticationProviderId')), auth_type: 'saml' });
		expect(String(saml.log_in_url)).toContain('https://');

		const result = await runNode({
			resource: 'authenticationProvider',
			operation: 'get',
			items: [
				{ id: 'cas' },
				{ id: Number(fx('deletedAuthenticationProviderId')) },
				{ id: Number(fx('canvasAuthenticationProviderId')) },
				{ id: 99999999 },
			],
			params: { accountId: root, providerId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((p) => p.id)).toEqual(
			[fx('casAuthenticationProviderId'), fx('canvasAuthenticationProviderId')].map(Number),
		);
		expect(pairedItems(result)).toEqual([0, 2]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({
				errorCode: 404,
				errorType: 'NOT_FOUND',
				resource: 'authenticationProvider',
				operation: 'get',
			});
		}
	});

	it('getSsoSettings: returns the account-level login settings', async () => {
		const [settings] = await runOk({
			resource: 'authenticationProvider',
			operation: 'getSsoSettings',
			params: { accountId: root },
		});
		expect(settings).toEqual(await canvas().get<Json>(`/api/v1/accounts/${root}/sso_settings`));
		expect(Object.keys(settings.sso_settings as Json)).toEqual(
			expect.arrayContaining([
				'login_handle_name',
				'change_password_url',
				'auth_discovery_url',
				'unknown_user_url',
				'login_help_url',
			]),
		);
	});

	// ------------------------------------------------------------------ create

	it('create (SAML): every setting reaches Canvas', async () => {
		const result = await create('saml', {
			idp_entity_id: 'https://idp.n8nbat.example.edu/saml',
			log_in_url: 'https://idp.n8nbat.example.edu/sso?a=1&b=2',
			log_out_url: 'https://idp.n8nbat.example.edu/slo',
			certificate_fingerprint: 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01',
			identifier_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
			requested_authn_context: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
			sig_alg: 'RSA-SHA1',
			login_attribute: 'eduPersonPrincipalName',
			strip_domain_from_login_attribute: true,
			parent_registration: false,
			jit_provisioning: true,
			mfa_required: true,
			otp_via_sms: false,
			skip_internal_mfa: false,
			federated_attributes: JSON.stringify({
				email: 'mail',
				display_name: { attribute: 'displayName', provisioning_only: true },
			}),
		});
		samlId = String(result.id);
		const actual = await provider(samlId);
		expect(actual).toMatchObject({
			auth_type: 'saml',
			idp_entity_id: 'https://idp.n8nbat.example.edu/saml',
			log_in_url: 'https://idp.n8nbat.example.edu/sso?a=1&b=2',
			log_out_url: 'https://idp.n8nbat.example.edu/slo',
			certificate_fingerprint: 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01',
			identifier_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
			requested_authn_context: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
			login_attribute: 'eduPersonPrincipalName',
			strip_domain_from_login_attribute: true,
			parent_registration: false,
			jit_provisioning: true,
			// Canvas only stores "MFA Required" when multi-factor authentication is switched
			// on for the account; on this account it is disabled, so the flag stays off.
			mfa_required: false,
			otp_via_sms: false,
			skip_internal_mfa: false,
			federated_attributes: {
				email: { attribute: 'mail', provisioning_only: false },
				display_name: { attribute: 'displayName', provisioning_only: true },
			},
		});
		expect(String(actual.sig_alg)).toMatch(/rsa-sha1$/);
	});

	it('create (OpenID Connect): every setting reaches Canvas; the secret is stored but never returned', async () => {
		const result = await create('openid_connect', {
			client_id: 'n8nbat-oidc',
			client_secret: 's3cret-value',
			issuer: 'https://oidc.n8nbat.example.edu',
			authorize_url: 'https://oidc.n8nbat.example.edu/authorize',
			token_url: 'https://oidc.n8nbat.example.edu/token',
			scope: 'email profile',
			login_attribute: 'email',
			end_session_endpoint: 'https://oidc.n8nbat.example.edu/logout',
			userinfo_endpoint: 'https://oidc.n8nbat.example.edu/userinfo',
			token_endpoint_auth_method: 'client_secret_basic',
			jit_provisioning: true,
			federated_attributes: '={{ ({ email: "email" }) }}',
		});
		oidcId = String(result.id);
		expect(JSON.stringify(result)).not.toContain('s3cret-value');
		const actual = await provider(oidcId);
		expect(actual).toMatchObject({
			auth_type: 'openid_connect',
			client_id: 'n8nbat-oidc',
			issuer: 'https://oidc.n8nbat.example.edu',
			authorize_url: 'https://oidc.n8nbat.example.edu/authorize',
			token_url: 'https://oidc.n8nbat.example.edu/token',
			scope: 'email profile',
			login_attribute: 'email',
			end_session_endpoint: 'https://oidc.n8nbat.example.edu/logout',
			userinfo_endpoint: 'https://oidc.n8nbat.example.edu/userinfo',
			token_endpoint_auth_method: 'client_secret_basic',
			jit_provisioning: true,
			federated_attributes: { email: { attribute: 'email', provisioning_only: false } },
		});
	});

	it('create (LDAP): every setting reaches Canvas', async () => {
		// A closed local port: a login attempt against it fails at once instead of timing out.
		const result = await create('ldap', {
			auth_host: '127.0.0.1',
			auth_port: 9,
			auth_over_tls: 'simple_tls',
			auth_base: 'ou=people,dc=n8nbat,dc=example,dc=edu',
			auth_filter: '(uid={{login}})',
			auth_username: 'cn=reader,dc=n8nbat,dc=example,dc=edu',
			auth_password: 's3cret-value',
			identifier_format: 'uid',
			jit_provisioning: false,
		});
		ldapId = String(result.id);
		expect(JSON.stringify(result)).not.toContain('s3cret-value');
		expect(await provider(ldapId)).toMatchObject({
			auth_type: 'ldap',
			auth_host: '127.0.0.1',
			auth_port: 9,
			auth_over_tls: 'simple_tls',
			auth_base: 'ou=people,dc=n8nbat,dc=example,dc=edu',
			auth_filter: '(uid={{login}})',
			auth_username: 'cn=reader,dc=n8nbat,dc=example,dc=edu',
			identifier_format: 'uid',
			jit_provisioning: false,
		});
	});

	const otherTypes: Array<{ type: string; fields: Json; expected?: Json }> = [
		{ type: 'apple', fields: { client_id: 'com.example.n8nbat', client_secret: 's3cret', login_attribute: 'sub', jit_provisioning: true } },
		{
			type: 'cas',
			fields: { auth_base: 'https://cas.n8nbat.example.edu/cas', log_in_url: 'https://cas.n8nbat.example.edu/cas/login', jit_provisioning: true },
		},
		{ type: 'clever', fields: { client_id: 'n8nbat-clever', client_secret: 's3cret', district_id: 'D-1', login_attribute: 'sis_id' } },
		{ type: 'facebook', fields: { app_id: '1234567890', app_secret: 's3cret', login_attribute: 'email' } },
		{
			type: 'github',
			fields: { domain: 'github.n8nbat.example.edu', client_id: 'n8nbat-gh', client_secret: 's3cret', login_attribute: 'login' },
		},
		{ type: 'google', fields: { client_id: 'n8nbat-google', client_secret: 's3cret', hosted_domain: 'example.edu', login_attribute: 'email' } },
		{ type: 'linkedin', fields: { client_id: 'n8nbat-li', client_secret: 's3cret', login_attribute: 'emailAddress' } },
		{
			type: 'microsoft',
			fields: {
				application_id: '11111111-2222-3333-4444-555555555555',
				application_secret: 's3cret',
				tenant: 'common',
				login_attribute: 'tid+oid',
			},
		},
		{ type: 'saml_idp_discovery', fields: { discovery_service_url: 'https://discovery.n8nbat.example.edu/ds' } },
	];

	for (const { type, fields } of otherTypes) {
		it(`create (${type}): its settings reach Canvas`, async () => {
			const result = await create(type, fields);
			const actual = await provider(String(result.id));
			const visible = Object.fromEntries(Object.entries(fields).filter(([key]) => !/secret/.test(key)));
			expect(actual).toMatchObject({ auth_type: type, ...visible });
			expect(JSON.stringify(result)).not.toContain('s3cret');
			await runOk({
				resource: 'authenticationProvider',
				operation: 'delete',
				params: { accountId: playground, providerId: String(result.id) },
			});
		});
	}

	it('create: Position inserts the provider into the list', async () => {
		const before = await providers();
		const result = await create('cas', {
			auth_base: 'https://cas2.n8nbat.example.edu/cas',
			position: Number(before.find((p) => String(p.id) === samlId)!.position),
		});
		const after = await providers();
		const position = (id: string): number => Number(after.find((p) => String(p.id) === id)!.position);
		expect(position(String(result.id))).toBeLessThan(position(samlId));
		expect(position(samlId)).toBeLessThan(position(oidcId));
		// The Canvas provider stays first.
		expect(after[0].auth_type).toBe('canvas');
	});

	it('create: a second Canvas provider, an unknown type and a teacher are refused', async () => {
		const duplicate = await runNode({
			resource: 'authenticationProvider',
			operation: 'create',
			params: { accountId: playground, authType: 'canvas', errorHandling: { onError: 'continueWithError' } },
		});
		expect(duplicate.success).toEqual([]);
		expect(duplicate.error[0]).toMatchObject({
			errorCode: 422,
			errorType: 'VALIDATION_ERROR',
			resource: 'authenticationProvider',
			operation: 'create',
		});
		expect(String(duplicate.error[0].errorMessage)).toContain('duplicate provider canvas');

		// "twitter" was offered by earlier versions of this node; Canvas no longer has it.
		const unknownType = await runNode({
			resource: 'authenticationProvider',
			operation: 'create',
			params: { accountId: playground, authType: '={{ "twitter" }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknownType.success).toEqual([]);
		expect(unknownType.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(unknownType.error[0].errorMessage)).toContain("invalid or missing auth_type 'twitter'");

		const invalid = await runNode({
			resource: 'authenticationProvider',
			operation: 'create',
			params: {
				accountId: playground,
				authType: 'google',
				additionalFields: { client_id: 'x', client_secret: 'y', login_attribute: 'not-a-google-attribute' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(invalid.success).toEqual([]);
		expect([400, 422]).toContain(invalid.error[0].errorCode);
		expect(JSON.stringify(invalid.error[0])).toContain('login_attribute');

		const asTeacher = await runNode({
			resource: 'authenticationProvider',
			operation: 'create',
			persona: 'teacher',
			params: {
				accountId: root,
				authType: 'cas',
				additionalFields: { auth_base: 'https://nope.example.edu/cas' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect((await providers(root)).map((p) => p.auth_base)).not.toContain('https://nope.example.edu/cas');
	});

	it('create: malformed Federated Attributes are rejected before anything is sent', async () => {
		const before = (await providers()).length;
		const result = await runNode({
			resource: 'authenticationProvider',
			operation: 'create',
			params: {
				accountId: playground,
				authType: 'saml',
				additionalFields: { federated_attributes: '{"email": ' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(failureText(result)).toMatch(/Invalid JSON in Federated Attributes/);
		expect((await providers()).length).toBe(before);
	});

	// ------------------------------------------------------------------ update

	it('update (SAML): changed settings reach Canvas, the rest stays', async () => {
		const [updated] = await runOk({
			resource: 'authenticationProvider',
			operation: 'update',
			params: {
				accountId: playground,
				providerId: samlId,
				updateFields: {
					idp_entity_id: 'https://idp2.n8nbat.example.edu/saml',
					log_in_url: 'https://idp2.n8nbat.example.edu/sso',
					sig_alg: 'RSA-SHA256',
					jit_provisioning: false,
					mfa_required: false,
					otp_via_sms: true,
					skip_internal_mfa: true,
					login_attribute: 'NameID',
					strip_domain_from_login_attribute: false,
					federated_attributes: '{"email": "emailAddress", "locale": {"attribute": "lang", "provisioning_only": true}}',
				},
			},
		});
		expect(updated.id).toBe(Number(samlId));
		const actual = await provider(samlId);
		expect(actual).toMatchObject({
			idp_entity_id: 'https://idp2.n8nbat.example.edu/saml',
			log_in_url: 'https://idp2.n8nbat.example.edu/sso',
			jit_provisioning: false,
			mfa_required: false,
			otp_via_sms: true,
			skip_internal_mfa: true,
			login_attribute: 'NameID',
			strip_domain_from_login_attribute: false,
			// With JIT provisioning off Canvas reports the plain mapping and leaves out the
			// attributes that are only used for provisioning.
			federated_attributes: { email: 'emailAddress' },
			// untouched
			log_out_url: 'https://idp.n8nbat.example.edu/slo',
			certificate_fingerprint: 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01',
		});
		expect(String(actual.sig_alg)).toMatch(/rsa-sha256$/);
	});

	it('update (OpenID Connect and LDAP): settings reach Canvas; providers can be addressed by type', async () => {
		await runOk({
			resource: 'authenticationProvider',
			operation: 'update',
			params: {
				accountId: playground,
				providerId: 'openid_connect',
				updateFields: {
					scope: 'email',
					userinfo_endpoint: 'https://oidc.n8nbat.example.edu/userinfo2',
					token_endpoint_auth_method: 'client_secret_post',
					client_secret: 'another-s3cret',
				},
			},
		});
		expect(await provider(oidcId)).toMatchObject({
			scope: 'email',
			userinfo_endpoint: 'https://oidc.n8nbat.example.edu/userinfo2',
			token_endpoint_auth_method: 'client_secret_post',
			client_id: 'n8nbat-oidc',
		});

		await runOk({
			resource: 'authenticationProvider',
			operation: 'update',
			items: [{ id: Number(ldapId) }],
			params: {
				accountId: playground,
				providerId: '={{ $json.id }}',
				updateFields: { auth_port: 10, auth_over_tls: 'start_tls', auth_filter: '(mail={{login}})', auth_password: 'new' },
			},
		});
		expect(await provider(ldapId)).toMatchObject({
			auth_port: 10,
			auth_over_tls: 'start_tls',
			auth_filter: '(mail={{login}})',
			auth_host: '127.0.0.1',
		});
	});

	it('update: Position moves the provider', async () => {
		const before = await providers();
		const last = before[before.length - 1];
		const samlPosition = Number(before.find((p) => String(p.id) === samlId)!.position);
		await runOk({
			resource: 'authenticationProvider',
			operation: 'update',
			params: { accountId: playground, providerId: String(last.id), updateFields: { position: samlPosition } },
		});
		const after = await providers();
		const position = (id: string): number => Number(after.find((p) => String(p.id) === id)!.position);
		expect(position(String(last.id))).toBeLessThan(position(samlId));
		expect(after[0].auth_type).toBe('canvas');
	});

	it('update: nothing to update, invalid values and unknown providers are errors', async () => {
		const nothing = await runNode({
			resource: 'authenticationProvider',
			operation: 'update',
			params: { accountId: playground, providerId: samlId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.success).toEqual([]);
		expect(failureText(nothing)).toMatch(/at least one field/i);

		const invalid = await runNode({
			resource: 'authenticationProvider',
			operation: 'update',
			params: {
				accountId: playground,
				providerId: oidcId,
				updateFields: { token_endpoint_auth_method: '={{ "carrier_pigeon" }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(invalid.success).toEqual([]);
		expect([400, 422]).toContain(invalid.error[0].errorCode);
		expect((await provider(oidcId)).token_endpoint_auth_method).toBe('client_secret_post');

		const unknown = await runNode({
			resource: 'authenticationProvider',
			operation: 'update',
			params: {
				accountId: playground,
				providerId: '99999999',
				updateFields: { jit_provisioning: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'update' });
	});

	// --------------------------------------------------------- delete / restore

	it('delete: removes the provider from the list', async () => {
		const [deleted] = await runOk({
			resource: 'authenticationProvider',
			operation: 'delete',
			params: { accountId: playground, providerId: ldapId },
		});
		expect(deleted).toMatchObject({ id: Number(ldapId), auth_type: 'ldap' });
		expect(ids(await providers())).not.toContain(Number(ldapId));
		const gone = await canvas().request('GET', `/api/v1/accounts/${playground}/authentication_providers/${ldapId}`);
		expect(gone.status).toBe(404);

		const again = await runNode({
			resource: 'authenticationProvider',
			operation: 'delete',
			items: [{ id: ldapId }, { id: '99999999' }],
			params: { accountId: playground, providerId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error).toHaveLength(2);
		for (const error of again.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		}
	});

	it('restore: brings a deleted provider back with its settings; an active one is refused', async () => {
		await runOk({
			resource: 'authenticationProvider',
			operation: 'delete',
			params: { accountId: playground, providerId: samlId },
		});
		expect(ids(await providers())).not.toContain(Number(samlId));

		const [restored] = await runOk({
			resource: 'authenticationProvider',
			operation: 'restore',
			params: { accountId: playground, providerId: samlId },
		});
		expect(restored).toMatchObject({
			id: Number(samlId),
			auth_type: 'saml',
			idp_entity_id: 'https://idp2.n8nbat.example.edu/saml',
		});
		expect(ids(await providers())).toContain(Number(samlId));
		expect((await provider(samlId)).log_out_url).toBe('https://idp.n8nbat.example.edu/slo');

		const result = await runNode({
			resource: 'authenticationProvider',
			operation: 'restore',
			items: [{ id: Number(samlId) }, { id: 99999999 }],
			params: { accountId: playground, providerId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		const active = result.error.find((e) => (e.originalItem as Json).id === Number(samlId))!;
		expect(active).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'restore' });
		const unknown = result.error.find((e) => (e.originalItem as Json).id === 99999999)!;
		expect(unknown).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ------------------------------------------------------------ SSO settings

	it('updateSsoSettings: every setting reaches Canvas', async () => {
		const [result] = await runOk({
			resource: 'authenticationProvider',
			operation: 'updateSsoSettings',
			params: {
				accountId: playground,
				ssoSettings: {
					auth_discovery_url: 'https://discovery.n8nbat.example.edu/choose?x=1&y=2',
					change_password_url: 'https://idp.n8nbat.example.edu/password',
					login_handle_name: 'Schüler-ID 学号',
					login_help_url: 'https://help.n8nbat.example.edu/login',
					unknown_user_url: 'https://idp.n8nbat.example.edu/unknown',
				},
			},
		});
		const expected = {
			auth_discovery_url: 'https://discovery.n8nbat.example.edu/choose?x=1&y=2',
			change_password_url: 'https://idp.n8nbat.example.edu/password',
			login_handle_name: 'Schüler-ID 学号',
			login_help_url: 'https://help.n8nbat.example.edu/login',
			unknown_user_url: 'https://idp.n8nbat.example.edu/unknown',
		};
		expect(result.sso_settings).toMatchObject(expected);
		expect(await ssoSettings()).toMatchObject(expected);
	});

	it('updateSsoSettings: settings left out stay, settings sent empty are cleared', async () => {
		await runOk({
			resource: 'authenticationProvider',
			operation: 'updateSsoSettings',
			params: { accountId: playground, ssoSettings: { auth_discovery_url: '', login_handle_name: 'Login' } },
		});
		expect(await ssoSettings()).toMatchObject({
			auth_discovery_url: null,
			login_handle_name: 'Login',
			change_password_url: 'https://idp.n8nbat.example.edu/password',
			login_help_url: 'https://help.n8nbat.example.edu/login',
			unknown_user_url: 'https://idp.n8nbat.example.edu/unknown',
		});

		await runOk({
			resource: 'authenticationProvider',
			operation: 'updateSsoSettings',
			params: {
				accountId: playground,
				ssoSettings: { change_password_url: '', login_handle_name: '', login_help_url: '', unknown_user_url: '' },
			},
		});
		expect(await ssoSettings()).toMatchObject({
			auth_discovery_url: null,
			login_handle_name: null,
			change_password_url: null,
			login_help_url: null,
			unknown_user_url: null,
		});
	});

	it('updateSsoSettings: nothing to update and a teacher are errors; the root account is untouched', async () => {
		const nothing = await runNode({
			resource: 'authenticationProvider',
			operation: 'updateSsoSettings',
			params: { accountId: playground, ssoSettings: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.success).toEqual([]);
		expect(failureText(nothing)).toMatch(/at least one SSO setting/i);

		const before = await ssoSettings(root);
		const asTeacher = await runNode({
			resource: 'authenticationProvider',
			operation: 'updateSsoSettings',
			persona: 'teacher',
			params: {
				accountId: root,
				ssoSettings: { login_handle_name: 'Hijacked' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
		expect(await ssoSettings(root)).toEqual(before);
	});
});
