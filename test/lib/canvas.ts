import { loadState } from './state';
import type { Json } from './n8n';

/**
 * Direct Canvas REST client used by the battery to set up data and to verify,
 * independently of the node, what the node did.
 */
export class CanvasClient {
	readonly url: string;
	private readonly token: string;

	constructor(persona = 'admin') {
		const state = loadState();
		this.url = state.canvas.url.replace(/\/$/, '');
		const token = state.canvas.tokens[persona];
		if (!token) throw new Error(`No Canvas token for persona "${persona}" in test state`);
		this.token = token;
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

	private async expectOk<T>(method: string, path: string, body?: unknown): Promise<T> {
		const res = await this.request(method, path, body);
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
			const res = await this.request('GET', next);
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
