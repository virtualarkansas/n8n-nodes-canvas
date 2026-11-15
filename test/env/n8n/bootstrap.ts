/**
 * Prepare a fresh n8n instance for the battery:
 *   1. create (or log in as) the owner,
 *   2. create a public-API key,
 *   3. create one `canvasApi` credential per Canvas persona token found in the test state.
 *
 * Usage: npx tsx test/env/n8n/bootstrap.ts
 * Env:   N8N_URL (default http://localhost:5678), CANVAS_URL (default http://localhost:3000)
 */
import { updateState } from '../../lib/state';

const N8N_URL = (process.env.N8N_URL ?? 'http://localhost:5678').replace(/\/$/, '');
const CANVAS_URL = (process.env.CANVAS_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OWNER = {
	email: process.env.N8N_OWNER_EMAIL ?? 'owner@example.com',
	firstName: 'Battery',
	lastName: 'Owner',
	password: process.env.N8N_OWNER_PASSWORD ?? 'N8nTestPass123',
};

let cookie = '';

interface ApiResult {
	status: number;
	json: { data?: Record<string, unknown> & unknown[]; id?: string; [key: string]: unknown };
}

async function rest(method: string, path: string, body?: unknown): Promise<ApiResult> {
	const res = await fetch(`${N8N_URL}/rest${path}`, {
		method,
		headers: {
			...(cookie ? { cookie } : {}),
			...(body === undefined ? {} : { 'content-type': 'application/json' }),
			'browser-id': 'battery-bootstrap',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const setCookie = res.headers.getSetCookie?.() ?? [];
	const auth = setCookie.find((c) => c.startsWith('n8n-auth='));
	if (auth) cookie = auth.split(';')[0];
	const text = await res.text();
	let json: ApiResult['json'] = {};
	try {
		json = JSON.parse(text) as ApiResult['json'];
	} catch {
		json = { raw: text };
	}
	return { status: res.status, json };
}

async function api(apiKey: string, method: string, path: string, body?: unknown): Promise<ApiResult> {
	const res = await fetch(`${N8N_URL}/api/v1${path}`, {
		method,
		headers: {
			'X-N8N-API-KEY': apiKey,
			...(body === undefined ? {} : { 'content-type': 'application/json' }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	return { status: res.status, json: (text ? JSON.parse(text) : {}) as ApiResult['json'] };
}

async function main(): Promise<void> {
	const setup = await rest('POST', '/owner/setup', OWNER);
	if (setup.status !== 200) {
		const login = await rest('POST', '/login', {
			emailOrLdapLoginId: OWNER.email,
			email: OWNER.email,
			password: OWNER.password,
		});
		if (login.status !== 200) {
			throw new Error(`n8n owner setup and login both failed: ${JSON.stringify(login.json).slice(0, 300)}`);
		}
	}

	const state = updateState((s) => {
		s.n8n.url = N8N_URL;
		s.canvas.url = CANVAS_URL;
	});

	// Reuse the stored key when it still works.
	let apiKey = state.n8n.apiKey;
	if (apiKey) {
		const check = await api(apiKey, 'GET', '/workflows?limit=1');
		if (check.status !== 200) apiKey = '';
	}
	if (!apiKey) {
		const scopes = await rest('GET', '/api-keys/scopes');
		const created = await rest('POST', '/api-keys', {
			label: `battery-${Date.now()}`,
			expiresAt: null,
			scopes: scopes.json.data,
		});
		apiKey = String(created.json?.data?.rawApiKey ?? '');
		if (!apiKey) {
			throw new Error(`Could not create n8n API key: ${JSON.stringify(created.json).slice(0, 300)}`);
		}
		// Credentials created under an old key are still valid, but a new database has none.
		updateState((s) => {
			s.n8n.apiKey = apiKey;
			s.n8n.credentials = {};
		});
	}

	const current = updateState(() => undefined);
	for (const [persona, token] of Object.entries(current.canvas.tokens)) {
		if (current.n8n.credentials[persona]) continue;
		const name = `Canvas battery (${persona})`;
		const created = await api(apiKey, 'POST', '/credentials', {
			name,
			type: 'canvasApi',
			// `allowedHttpRequestDomains` must be explicit or the public API schema rejects the body.
			data: { canvasUrl: CANVAS_URL, accessToken: token, allowedHttpRequestDomains: 'all' },
		});
		if (created.status >= 300) {
			throw new Error(`Could not create credential for ${persona}: ${JSON.stringify(created.json).slice(0, 300)}`);
		}
		updateState((s) => {
			s.n8n.credentials[persona] = { id: String(created.json.id), name, type: 'canvasApi' };
		});
		console.log(`credential created: ${persona} -> ${created.json.id}`);
	}
	console.log(`n8n ready at ${N8N_URL}; state written.`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
