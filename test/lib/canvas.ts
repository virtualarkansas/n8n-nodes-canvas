import { execFileSync } from 'node:child_process';
import { loadState, workerPool } from './state';
import type { Json } from './n8n';

/**
 * Direct Canvas REST client used by the battery to set up data and to verify,
 * independently of the node, what the node did.
 */
export class CanvasClient {
	readonly url: string;
	private readonly token: string;

	constructor(persona = 'admin', token?: string) {
		const state = loadState();
		this.url = state.canvas.url.replace(/\/$/, '');
		// Each parallel worker has its own token per persona (own rate-limit quota), when the pool exists.
		const resolved = token ?? workerPool(state)?.tokens[persona] ?? state.canvas.tokens[persona];
		if (!resolved) throw new Error(`No Canvas token for persona "${persona}" in test state`);
		this.token = resolved;
	}

	/** A client for a token the test created itself (see `createUserWithToken`). */
	static withToken(token: string): CanvasClient {
		return new CanvasClient('custom', token);
	}

	async request(
		method: string,
		pathOrUrl: string,
		body?: unknown,
	): Promise<{ status: number; data: unknown; headers: Headers }> {
		const url = /^https?:/.test(pathOrUrl) ? pathOrUrl : `${this.url}${pathOrUrl}`;
		const res = await fetch(url, {
			method,
			headers: {
				authorization: `Bearer ${this.token}`,
				// Node's fetch sends "Accept-Language: *" by default. Canvas takes that as "any locale",
				// picks the first one alphabetically (Arabic) and stores it as the user's browser locale.
				'accept-language': 'en',
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const text = await res.text();
		let data: unknown = text;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			// keep text
		}
		return { status: res.status, data, headers: res.headers };
	}

	/**
	 * A read that Canvas answers with a server error is asked once more. The local Canvas runs
	 * in development mode, where a race inside Canvas (a record changed by another test file
	 * while it is being listed) surfaces as a 500 that a moment later is gone. Only reads, and
	 * only for the test's own set-up and read-back: what the node receives is never repeated here.
	 */
	private async read(path: string): Promise<{ status: number; data: unknown; headers: Headers }> {
		const res = await this.request('GET', path);
		if (res.status < 500) return res;
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return this.request('GET', path);
	}

	private async expectOk<T>(method: string, path: string, body?: unknown): Promise<T> {
		const res = method === 'GET' ? await this.read(path) : await this.request(method, path, body);
		if (res.status >= 400) {
			throw new Error(`Canvas ${method} ${path} -> ${res.status}: ${JSON.stringify(res.data).slice(0, 400)}`);
		}
		return res.data as T;
	}

	get<T = Json>(path: string): Promise<T> {
		return this.expectOk<T>('GET', path);
	}
	post<T = Json>(path: string, body?: unknown): Promise<T> {
		return this.expectOk<T>('POST', path, body ?? {});
	}
	put<T = Json>(path: string, body?: unknown): Promise<T> {
		return this.expectOk<T>('PUT', path, body ?? {});
	}
	delete<T = Json>(path: string): Promise<T> {
		return this.expectOk<T>('DELETE', path);
	}

	/** Follow Link rel="next" until exhausted (per_page=100). `dataKey` unwraps wrapped lists. */
	async getAll<T = Json>(path: string, dataKey?: string): Promise<T[]> {
		const out: T[] = [];
		let next: string | undefined = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
		while (next) {
			const res = await this.read(next);
			if (res.status >= 400) {
				throw new Error(`Canvas GET ${next} -> ${res.status}: ${JSON.stringify(res.data).slice(0, 400)}`);
			}
			const page = (dataKey ? (res.data as Record<string, unknown>)[dataKey] : res.data) as T[];
			out.push(...page);
			const link = res.headers.get('link') ?? '';
			const match = /<([^>]+)>\s*;\s*rel="next"/.exec(link);
			next = match ? match[1] : undefined;
		}
		return out;
	}
}

let admin: CanvasClient | undefined;
/** Canvas client authenticated as the seeded account admin. */
export function canvas(): CanvasClient {
	admin ??= new CanvasClient('admin');
	return admin;
}

/** ID of a seeded fixture (see test/env/canvas/seed/README.md), as a string. */
export function fx(name: string): string {
	const value = loadState().canvas.fixtures[name];
	if (value === undefined || value === null || value === '') {
		throw new Error(`Fixture "${name}" is not in the test state. Run the seed (test/env/canvas/seed/run.sh).`);
	}
	return String(value);
}

export function hasFixture(name: string): boolean {
	const value = loadState().canvas.fixtures[name];
	return value !== undefined && value !== null && value !== '';
}

let counter = 0;
/** A name that is unique across runs, so reruns never collide with earlier data. */
export function unique(prefix: string): string {
	counter++;
	return `${prefix} ${Date.now().toString(36)}-${process.pid.toString(36)}-${counter}`;
}

export interface TestUser {
	id: string;
	name: string;
	login: string;
	token: string;
	client: CanvasClient;
}

/**
 * Create a Canvas user of the test's own, with an API token, so tests can act as
 * that user without touching the seeded personas.
 */
/** Run a Ruby one-liner inside the Canvas web container (for data the API cannot create). */
export function railsRunner(script: string): string {
	return execFileSync('docker', ['exec', 'canvas-web', 'bundle', 'exec', 'rails', 'runner', script], { encoding: 'utf8' });
}

export async function createUserWithToken(label: string, accountId = fx('accountId')): Promise<TestUser> {
	const name = unique(label);
	const login = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.edu`;
	const user = await canvas().post<Json>(`/api/v1/accounts/${accountId}/users`, {
		user: { name, skip_registration: true },
		pseudonym: { unique_id: login, send_confirmation: false },
	});
	// A token an admin creates for someone else through the API stays "pending" until that user
	// activates it, so the token is minted inside Canvas instead.
	const out = execFileSync(
		'docker',
		[
			'exec',
			'canvas-web',
			'bundle',
			'exec',
			'rails',
			'runner',
			`puts "TOKEN=" + User.find(${Number(user.id)}).access_tokens.create!(purpose: "n8n battery (test-created user)").full_token`,
		],
		{ encoding: 'utf8' },
	);
	const token = out
		.split('\n')
		.find((line) => line.startsWith('TOKEN='))
		?.slice(6);
	if (!token) throw new Error(`Could not create a token for user ${String(user.id)}: ${out.slice(0, 300)}`);
	return { id: String(user.id), name, login, token, client: CanvasClient.withToken(token) };
}
