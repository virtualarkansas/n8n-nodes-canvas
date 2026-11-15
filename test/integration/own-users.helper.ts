import { randomUUID } from 'node:crypto';
import { canvas, fx, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';

/**
 * Helpers that give a test file users of its own (not a test file).
 *
 * Tests that write into a user's personal data (inbox, received content
 * shares, ...) must not do that to the seeded personas other files rely on.
 * `createUser` makes a throw-away user; `createUserWithToken` also gives it an
 * API token, obtained the way a person would: by logging in to the web
 * interface and creating a token in the profile settings.
 */

export interface OwnUser {
	id: string;
	name: string;
	login: string;
	password: string;
	/** API token of the user (only from `createUserWithToken`). */
	token?: string;
}

export async function createUser(label: string): Promise<OwnUser> {
	const name = unique(label);
	const login = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID().slice(0, 8)}@battery.example.edu`;
	const password = `Battery-${randomUUID()}`;
	const user = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
		user: { name, skip_registration: true, terms_of_use: true },
		pseudonym: { unique_id: login, password, send_confirmation: false },
		communication_channel: { type: 'email', address: login, skip_confirmation: true },
	});
	return { id: String(user.id), name, login, password };
}

/** A minimal cookie jar for a Canvas web session. */
export class WebSession {
	private readonly jar = new Map<string, string>();

	private remember(res: Response): void {
		for (const cookie of res.headers.getSetCookie()) {
			const pair = cookie.split(';')[0];
			const index = pair.indexOf('=');
			this.jar.set(pair.slice(0, index), pair.slice(index + 1));
		}
	}

	private cookies(): string {
		return [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ');
	}

	private csrf(): string {
		return decodeURIComponent(this.jar.get('_csrf_token') ?? '');
	}

	async login(login: string, password: string): Promise<void> {
		// Any request hands out the CSRF cookie the login form needs.
		this.remember(
			await fetch(`${canvas().url}/courses/${fx('courseId')}`, {
				redirect: 'manual',
				headers: { accept: 'application/json' },
			}),
		);
		const res = await fetch(`${canvas().url}/login/canvas`, {
			method: 'POST',
			redirect: 'manual',
			headers: {
				cookie: this.cookies(),
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'application/json',
			},
			body: new URLSearchParams({
				authenticity_token: this.csrf(),
				'pseudonym_session[unique_id]': login,
				'pseudonym_session[password]': password,
			}),
		});
		this.remember(res);
		if (res.status !== 200) {
			throw new Error(`Canvas web login as ${login} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
		}
	}

	/** A request of the logged-in browser session (form-encoded body, JSON answer). */
	async request(
		method: string,
		path: string,
		form?: Record<string, string>,
	): Promise<{ status: number; data: unknown }> {
		const res = await fetch(`${canvas().url}${path}`, {
			method,
			redirect: 'manual',
			headers: {
				cookie: this.cookies(),
				accept: 'application/json',
				'x-csrf-token': this.csrf(),
				...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
			},
			body: form ? new URLSearchParams(form) : undefined,
		});
		this.remember(res);
		const text = await res.text();
		let data: unknown = text;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			// keep text
		}
		return { status: res.status, data };
	}
}

export async function createUserWithToken(label: string): Promise<OwnUser> {
	const user = await createUser(label);
	const session = new WebSession();
	await session.login(user.login, user.password);
	const created = await session.request('POST', '/api/v1/users/self/tokens', {
		'token[purpose]': 'Test battery',
	});
	const token = (created.data as Json | null)?.visible_token;
	if (created.status !== 200 || typeof token !== 'string') {
		throw new Error(`Could not create an API token for ${user.login}: ${created.status} ${JSON.stringify(created.data)}`);
	}
	return { ...user, token };
}

export async function deleteUser(user: OwnUser | undefined): Promise<void> {
	if (!user) return;
	await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${user.id}`);
}

/** Call Canvas as one of the file's own users. */
export async function asUser<T = Json>(user: OwnUser, method: string, path: string, body?: unknown): Promise<T> {
	// `path` may also be an absolute Canvas URL (e.g. from a Location header).
	const res = await fetch(/^https?:/.test(path) ? path : `${canvas().url}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${user.token ?? ''}`,
			...(body === undefined ? {} : { 'content-type': 'application/json' }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	if (res.status >= 400) {
		throw new Error(`Canvas ${method} ${path} as ${user.login} -> ${res.status}: ${text.slice(0, 300)}`);
	}
	return (text ? JSON.parse(text) : null) as T;
}
