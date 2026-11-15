/**
 * Prepare a fresh n8n instance for the battery:
 *   1. create (or log in as) the owner,
 *   2. create a public-API key,
 *   3. create one `canvasApi` credential per Canvas persona token found in the test state,
 *   4. give every parallel test worker its own token and credential per seeded persona
 *      (Canvas throttles per token; see `pool` in test/lib/state.ts).
 *
 * Usage: npx tsx test/env/n8n/bootstrap.ts
 * Env:   N8N_URL (default http://localhost:5678), CANVAS_URL (default http://localhost:3000),
 *        BATTERY_POOL (number of worker sets, default 6; 0 to skip),
 *        CANVAS_CONTAINER (default canvas-web)
 */
import { execFileSync } from 'node:child_process';
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
	const send = (): Promise<Response> =>
		fetch(`${N8N_URL}/api/v1${path}`, {
			method,
			headers: {
				'X-N8N-API-KEY': apiKey,
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	// A kept-alive connection n8n has closed in the meantime fails once; the request never arrived.
	const res = await send().catch(() => send());
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
			for (const entry of Object.values(s.pool ?? {})) entry.credentials = {};
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
	await ensurePool(apiKey);
	console.log(`n8n ready at ${N8N_URL}; state written.`);
}

/** The personas the seed creates; test files that add their own are left alone. */
const POOLED_PERSONAS = ['admin', 'teacher', 'ta', 'student', 'student2', 'observer', 'designer', 'subaccountAdmin'];

/**
 * One extra token (and n8n credential) per seeded persona for each parallel worker.
 * Tokens are minted inside Canvas: one created through the API for another user would stay pending.
 */
async function ensurePool(apiKey: string): Promise<void> {
	const size = Number(process.env.BATTERY_POOL ?? 6);
	if (!(size > 0)) return;
	const state = updateState(() => undefined);
	const personas = POOLED_PERSONAS.filter((persona) => state.canvas.tokens[persona]);

	const wanted: Array<{ worker: string; persona: string }> = [];
	for (let worker = 1; worker <= size; worker++) {
		for (const persona of personas) {
			if (!state.pool?.[String(worker)]?.tokens[persona]) wanted.push({ worker: String(worker), persona });
		}
	}
	if (wanted.length > 0) {
		const request = wanted.map((entry) => ({ ...entry, token: state.canvas.tokens[entry.persona] }));
		const script =
			'require "json"; out = JSON.parse(ENV.fetch("POOL_REQUEST")).map { |r| ' +
			'user = AccessToken.authenticate(r["token"])&.user; ' +
			'user && r.slice("worker", "persona").merge("token" => user.access_tokens.create!(purpose: "n8n battery worker #{r["worker"]}").full_token) ' +
			'}.compact; puts "POOL=" + out.to_json';
		let minted: Array<{ worker: string; persona: string; token: string }> = [];
		try {
			const out = execFileSync(
				'docker',
				['exec', '-e', `POOL_REQUEST=${JSON.stringify(request)}`, process.env.CANVAS_CONTAINER ?? 'canvas-web', 'bundle', 'exec', 'rails', 'runner', script],
				{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
			);
			const line = out.split('\n').find((l) => l.startsWith('POOL='));
			minted = line ? (JSON.parse(line.slice(5)) as typeof minted) : [];
		} catch (error) {
			console.warn(`worker token pool skipped (could not mint tokens in Canvas): ${(error as Error).message.split('\n')[0]}`);
			return;
		}
		updateState((s) => {
			s.pool ??= {};
			for (const { worker, persona, token } of minted) {
				s.pool[worker] ??= { tokens: {}, credentials: {} };
				s.pool[worker].tokens[persona] = token;
			}
		});
		console.log(`worker token pool: ${minted.length} tokens minted`);
	}

	const current = updateState(() => undefined);
	let created = 0;
	for (const [worker, entry] of Object.entries(current.pool ?? {})) {
		for (const [persona, token] of Object.entries(entry.tokens)) {
			if (entry.credentials[persona]) continue;
			const name = `Canvas battery (${persona}, worker ${worker})`;
			const result = await api(apiKey, 'POST', '/credentials', {
				name,
				type: 'canvasApi',
				data: { canvasUrl: CANVAS_URL, accessToken: token, allowedHttpRequestDomains: 'all' },
			});
			if (result.status >= 300) {
				throw new Error(`Could not create credential ${name}: ${JSON.stringify(result.json).slice(0, 300)}`);
			}
			updateState((s) => {
				if (s.pool?.[worker]) s.pool[worker].credentials[persona] = { id: String(result.json.id), name, type: 'canvasApi' };
			});
			created++;
		}
	}
	if (created > 0) console.log(`worker token pool: ${created} credentials created`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
