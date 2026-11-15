import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { loadState } from '../lib/state';

/**
 * Canvas OAuth2 credential, end to end on a real n8n and Canvas:
 * n8n builds the authorization URL from the credential, exchanges the code at
 * Canvas' token endpoint, the node calls the API with the resulting token, and
 * n8n refreshes the token when Canvas says it has expired.
 *
 * The local Canvas is built without web assets, so its HTML login and consent
 * pages cannot be clicked through; the authorization code is issued by Canvas
 * itself through its own code generator, which is what those pages call.
 */
const state = loadState();
const N8N = state.n8n.url;
const CANVAS = state.canvas.url;
let cookie = '';

async function rest(method: string, path: string, body?: unknown): Promise<{ status: number; json: Json; text: string }> {
	const res = await fetch(`${N8N}/rest${path}`, {
		method,
		redirect: 'manual',
		headers: { cookie, 'browser-id': 'battery-oauth', ...(body ? { 'content-type': 'application/json' } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	const auth = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('n8n-auth='));
	if (auth) cookie = auth.split(';')[0];
	const text = await res.text();
	let json: Json = {};
	try {
		json = JSON.parse(text) as Json;
	} catch {
		// HTML
	}
	return { status: res.status, json, text };
}

function rails(script: string): string {
	return execFileSync('docker', ['exec', 'canvas-web', 'bundle', 'exec', 'rails', 'runner', script], { encoding: 'utf8' });
}

interface OAuthCredential {
	id: string;
	name: string;
	type: string;
	authUrl: URL;
}

async function createCredential(data: Json): Promise<OAuthCredential> {
	const name = `Canvas OAuth2 battery ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	const created = await rest('POST', '/credentials', { name, type: 'canvasOAuth2Api', data });
	expect(created.status, created.text).toBe(200);
	const id = String((created.json.data as Json).id);
	const auth = await rest('GET', `/oauth2-credential/auth?id=${id}`);
	expect(auth.status, auth.text).toBe(200);
	return { id, name, type: 'canvasOAuth2Api', authUrl: new URL(String(auth.json.data)) };
}

async function authorize(credential: OAuthCredential, userId: string, developerKeyId: string, scopes?: string[]): Promise<number> {
	const scopeArg = scopes ? `[${scopes.map((s) => JSON.stringify(s)).join(', ')}]` : 'nil';
	const out = rails(
		`puts "CODE=" + Canvas::OAuth::Token.generate_code_for(${userId}, ${userId}, ${developerKeyId}, { scopes: ${scopeArg}, purpose: "n8n battery" })`,
	);
	const code = out.split('\n').find((line) => line.startsWith('CODE='))!.slice(5);
	const callback = await fetch(
		`${N8N}/rest/oauth2-credential/callback?code=${code}&state=${encodeURIComponent(credential.authUrl.searchParams.get('state') ?? '')}`,
		{ headers: { cookie, 'browser-id': 'battery-oauth' }, redirect: 'manual' },
	);
	return callback.status;
}

describe('Canvas OAuth2 credential', () => {
	let credential: OAuthCredential;

	beforeAll(async () => {
		const login = await rest('POST', '/login', {
			emailOrLdapLoginId: process.env.N8N_OWNER_EMAIL ?? 'owner@example.com',
			password: process.env.N8N_OWNER_PASSWORD ?? 'N8nTestPass123',
		});
		expect(login.status, login.text).toBe(200);
	});

	it('builds Canvas\' authorization URL, tolerating a trailing slash and spaces in the Canvas URL', async () => {
		credential = await createCredential({
			canvasUrl: `  ${CANVAS}/ `,
			clientId: fx('oauthDeveloperKeyClientId'),
			clientSecret: fx('oauthDeveloperKeySecret'),
		});
		const { authUrl } = credential;
		expect(`${authUrl.origin}${authUrl.pathname}`).toBe(`${CANVAS}/login/oauth2/auth`);
		expect(authUrl.searchParams.get('client_id')).toBe(fx('oauthDeveloperKeyClientId'));
		expect(authUrl.searchParams.get('response_type')).toBe('code');
		expect(authUrl.searchParams.get('redirect_uri')).toBe(`${N8N}/rest/oauth2-credential/callback`);
		expect(authUrl.searchParams.get('state')).toBeTruthy();

		// Canvas accepts the request (redirects to its login page) rather than rejecting client or redirect URI.
		const probe = await fetch(authUrl, { redirect: 'manual' });
		expect(probe.status).toBe(302);
		expect(probe.headers.get('location')).toContain('/login');
	});

	it('exchanges the authorization code for tokens at Canvas\' token endpoint', async () => {
		expect(await authorize(credential, fx('teacherUserId'), fx('oauthDeveloperKeyId'))).toBe(200);
	});

	it('the node works with the OAuth2 credential and acts as the authorizing user', async () => {
		const [self] = await runOk({ resource: 'user', operation: 'getSelf', authentication: 'oAuth2', credential });
		expect(self.id).toBe(Number(fx('teacherUserId')));

		const expected = await new CanvasClient('teacher').getAll<Json>('/api/v1/courses');
		const courses = await runOk({
			resource: 'course',
			operation: 'getAll',
			authentication: 'oAuth2',
			credential,
			params: { pagination: { returnAll: true } },
		});
		expect(courses.map((c) => c.id).sort()).toEqual(expected.map((c) => c.id).sort());
	});

	it('n8n refreshes the token when Canvas reports it expired', async () => {
		// Canvas tokens issued through OAuth live for one hour; expire this one now.
		const out = rails(
			`t = AccessToken.where(developer_key_id: ${fx('oauthDeveloperKeyId')}, user_id: ${fx('teacherUserId')}).order(:id).last; ` +
				`t.update_columns(expires_at: 5.minutes.ago); puts "EXPIRED=#{t.id} needs_refresh=#{t.reload.needs_refresh?}"`,
		);
		expect(out).toContain('needs_refresh=true');

		// Canvas now answers 401 for this token until it is refreshed.
		const before = rails(
			`t = AccessToken.where(developer_key_id: ${fx('oauthDeveloperKeyId')}, user_id: ${fx('teacherUserId')}).order(:id).last; puts "UPDATED=#{t.updated_at.to_f}"`,
		);

		const [self] = await runOk({ resource: 'user', operation: 'getSelf', authentication: 'oAuth2', credential });
		expect(self.id).toBe(Number(fx('teacherUserId')));

		const after = rails(
			`t = AccessToken.where(developer_key_id: ${fx('oauthDeveloperKeyId')}, user_id: ${fx('teacherUserId')}).order(:id).last; puts "UPDATED=#{t.updated_at.to_f} needs_refresh=#{t.needs_refresh?}"`,
		);
		expect(after).toContain('needs_refresh=false');
		expect(after).not.toBe(before);
	});

	it('reports a clear authorization error when the grant has been revoked', async () => {
		rails(
			`AccessToken.where(developer_key_id: ${fx('oauthDeveloperKeyId')}, user_id: ${fx('teacherUserId')}).find_each(&:destroy); puts "REVOKED"`,
		);
		const result = await runNode({
			resource: 'user',
			operation: 'getSelf',
			authentication: 'oAuth2',
			credential,
			params: { errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		const error = result.error[0] ?? (result.failure as unknown as Json);
		expect(JSON.stringify(error)).toMatch(/401|UNAUTHORIZED|invalid|refresh|token/i);
	});

	it('a developer key that enforces scopes works when the credential lists its scopes', async () => {
		const scopes = JSON.parse(JSON.stringify(loadState().canvas.fixtures.scopedDeveloperKeyScopes)) as string[];
		const keyInfo = rails(
			`k = DeveloperKey.find(${fx('scopedDeveloperKeyId')}); puts "KEY=#{k.global_id}|#{k.api_key}|#{k.redirect_uris.inspect}|#{k.redirect_uri}"`,
		)
			.split('\n')
			.find((line) => line.startsWith('KEY='))!
			.slice(4)
			.split('|');
		const scoped = await createCredential({
			canvasUrl: CANVAS,
			clientId: keyInfo[0],
			clientSecret: keyInfo[1],
			// As a person would paste them: one per line, with a stray comma.
			scopes: `${scopes.slice(0, 2).join('\n')},\n${scopes.slice(2).join('  ')}\n`,
		});
		expect(scoped.authUrl.searchParams.get('scope')).toBe(scopes.join(' '));
		expect(await authorize(scoped, fx('teacherUserId'), fx('scopedDeveloperKeyId'), scopes)).toBe(200);

		// Inside the granted scopes:
		const courses = await runOk({ resource: 'course', operation: 'getAll', authentication: 'oAuth2', credential: scoped });
		expect(courses.length).toBeGreaterThan(0);

		// Outside them Canvas refuses, and the node says why.
		const denied = await runNode({
			resource: 'user',
			operation: 'getSelf',
			authentication: 'oAuth2',
			credential: scoped,
			params: { errorHandling: { onError: 'continueWithError' }, rateLimiting: { enabled: false } },
		});
		expect(denied.success).toEqual([]);
		expect(denied.error[0]).toMatchObject({ errorCode: 401, errorType: 'UNAUTHORIZED' });
		expect(String(denied.error[0].errorMessage)).toMatch(/scope/i);
	});
});
