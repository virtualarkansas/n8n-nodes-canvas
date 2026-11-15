import { randomBytes } from 'node:crypto';
import { canvas, fx, unique } from '../../lib/canvas';
import { n8n } from '../../lib/harness';
import type { Json } from '../../lib/n8n';
import { loadState } from '../../lib/state';
import { addOverlay, removeOverlay } from './state-overlay';

/**
 * Helpers for tests that need their own Canvas user instead of a shared persona:
 * favorites, bookmarks, planner notes/overrides and ePortfolios are per-user state,
 * and the persona tokens are shared with every other test file.
 *
 * A dedicated user is created through the API, signs in through the normal Canvas
 * login form (so the session is a password session) and generates an access token
 * for itself, exactly as a person would under Account > Settings.
 *
 * The test file must layer the state overlay over `test/lib/state` (see state-overlay.ts).
 */

const canvasUrl = (): string => loadState().canvas.url.replace(/\/$/, '');

/** A logged-in browser-like session against Canvas (cookies + CSRF token). */
export class CanvasWebSession {
	private cookies = new Map<string, string>();

	private remember(res: Response): void {
		for (const line of res.headers.getSetCookie?.() ?? []) {
			const pair = line.split(';')[0];
			const eq = pair.indexOf('=');
			if (eq > 0) this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
	}

	private cookieHeader(): string {
		return Array.from(this.cookies.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	private csrf(): string {
		return decodeURIComponent(this.cookies.get('_csrf_token') ?? '');
	}

	async login(loginId: string, password: string): Promise<void> {
		// Canvas' CSRF protection is a double-submit cookie: the `_csrf_token` cookie and the
		// submitted token must unmask to the same secret. The login page itself cannot be
		// rendered on a development instance without compiled assets, so mint the pair here
		// (32-byte one-time pad followed by pad XOR secret, base64) the way Canvas does.
		const secret = randomBytes(32);
		const pad = randomBytes(32);
		const masked = Buffer.concat([pad, Buffer.from(secret.map((byte, i) => byte ^ pad[i]))]).toString('base64');
		this.cookies.set('_csrf_token', encodeURIComponent(masked));
		const body = new URLSearchParams({
			authenticity_token: this.csrf(),
			'pseudonym_session[unique_id]': loginId,
			'pseudonym_session[password]': password,
		});
		const res = await fetch(`${canvasUrl()}/login/canvas`, {
			method: 'POST',
			redirect: 'manual',
			headers: { cookie: this.cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' },
			body,
		});
		this.remember(res);
		await res.text();
		if (res.status !== 302 || /\/login/.test(res.headers.get('location') ?? '')) {
			throw new Error(`Canvas login as ${loginId} failed: HTTP ${res.status} -> ${res.headers.get('location')}`);
		}
	}

	/** JSON request with the session cookie (web routes and API routes both accept it). */
	async request(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
		const res = await fetch(`${canvasUrl()}${path}`, {
			method,
			redirect: 'manual',
			headers: {
				cookie: this.cookieHeader(),
				accept: 'application/json',
				'x-csrf-token': this.csrf(),
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		this.remember(res);
		const text = (await res.text()).replace(/^while\(1\);/, '');
		let data: unknown = text;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			// keep text
		}
		return { status: res.status, data };
	}
}

export interface DedicatedUser {
	id: string;
	name: string;
	loginId: string;
	password: string;
	token: string;
	/** Use as `persona` in runNode / `new CanvasClient(persona)`. */
	persona: string;
	session: CanvasWebSession;
}

/** Delete a user this helper created (used when its setup could not be completed). */
async function discardUser(id: string, wasAdmin = false): Promise<void> {
	if (wasAdmin) {
		await canvas()
			.request('DELETE', `/api/v1/accounts/${fx('accountId')}/admins/${id}`)
			.catch(() => undefined);
	}
	await canvas()
		.request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${id}`)
		.catch(() => undefined);
}

/** Sign in as the user and let the user generate an access token for itself. */
async function signInAndCreateToken(
	loginId: string,
	password: string,
	purpose: string,
): Promise<{ session: CanvasWebSession; token: string }> {
	const session = new CanvasWebSession();
	await session.login(loginId, password);
	const created = await session.request('POST', '/api/v1/users/self/tokens', {
		// Canvas requires an expiry (at most 120 days) on tokens of users who are only students.
		token: { purpose, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() },
	});
	const data = (created.data ?? {}) as Json;
	const token = String(data.visible_token ?? data.token ?? '');
	if (created.status >= 300 || !token) {
		throw new Error(
			`Could not create an access token for ${loginId}: HTTP ${created.status} ${JSON.stringify(created.data).slice(0, 300)}`,
		);
	}
	return { session, token };
}

export interface EnrollSpec {
	courseId: string;
	type: 'StudentEnrollment' | 'TeacherEnrollment' | 'ObserverEnrollment' | 'TaEnrollment';
	associatedUserId?: string;
}

/** Create an n8n `canvasApi` credential and make it usable as a persona in this test file. */
export async function registerCredential(
	persona: string,
	data: { canvasUrl: string; accessToken: string },
	exposeToken = true,
): Promise<string> {
	const name = `Canvas battery (${persona})`;
	const created = await n8n().api<{ id: string }>('POST', '/credentials', {
		name,
		type: 'canvasApi',
		// `allowedHttpRequestDomains` must be explicit or the public API schema rejects the body.
		data: { ...data, allowedHttpRequestDomains: 'all' },
	});
	addOverlay(persona, exposeToken ? data.accessToken : undefined, {
		id: String(created.id),
		name,
		type: 'canvasApi',
	});
	return String(created.id);
}

export async function removeCredential(persona: string): Promise<void> {
	const credential = removeOverlay(persona);
	if (credential) {
		await n8n()
			.api('DELETE', `/credentials/${credential.id}`)
			.catch(() => undefined);
	}
}

/** Create a Canvas user with its own access token and n8n credential. */
export async function createDedicatedUser(
	label: string,
	enroll: EnrollSpec[] = [],
	opts: { sisUserId?: string; timeZone?: string } = {},
): Promise<DedicatedUser> {
	const suffix = randomBytes(4).toString('hex');
	const name = unique(`Battery ${label}`);
	const loginId = `battery.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${suffix}@example.edu`;
	const password = `Pw-${randomBytes(9).toString('base64url')}-9a`;

	const user = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
		user: { name, skip_registration: true, terms_of_use: true, ...(opts.timeZone ? { time_zone: opts.timeZone } : {}) },
		pseudonym: {
			unique_id: loginId,
			password,
			send_confirmation: false,
			...(opts.sisUserId ? { sis_user_id: opts.sisUserId } : {}),
		},
		communication_channel: { type: 'email', address: loginId, skip_confirmation: true },
	});
	const id = String(user.id);

	try {
		for (const e of enroll) {
			await canvas().post(`/api/v1/courses/${e.courseId}/enrollments`, {
				enrollment: {
					user_id: id,
					type: e.type,
					enrollment_state: 'active',
					notify: false,
					...(e.associatedUserId ? { associated_user_id: e.associatedUserId } : {}),
				},
			});
		}
	} catch (error) {
		await discardUser(id);
		throw error;
	}

	try {
		const { session, token } = await signInAndCreateToken(loginId, password, `battery ${label}`);
		const persona = `dedicated-${label}-${suffix}`;
		await registerCredential(persona, { canvasUrl: canvasUrl(), accessToken: token });
		return { id, name, loginId, password, token, persona, session };
	} catch (error) {
		await discardUser(id);
		throw error;
	}
}

/** Remove the n8n credential of a dedicated user and delete the user from the account. */
export async function removeDedicatedUser(user: DedicatedUser | undefined): Promise<void> {
	if (!user) return;
	await removeCredential(user.persona);
	await canvas()
		.request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${user.id}`)
		.catch(() => undefined);
}

/**
 * An account admin of the battery's own. Every other test file drives the shared admin
 * token, and Canvas throttles per token: under that load the shared token's quota can sit
 * below the node's threshold for a long time. A test file that needs an admin for its node
 * runs gets its own (its own token means its own quota) and removes it afterwards.
 */
export async function createDedicatedAdmin(label: string): Promise<DedicatedUser> {
	const suffix = randomBytes(4).toString('hex');
	const name = unique(`Battery admin ${label}`);
	const loginId = `battery.admin.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${suffix}@example.edu`;
	const password = `Pw-${randomBytes(9).toString('base64url')}-9a`;
	const user = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
		user: { name, skip_registration: true, terms_of_use: true },
		pseudonym: { unique_id: loginId, password, send_confirmation: false },
		communication_channel: { type: 'email', address: loginId, skip_confirmation: true },
	});
	const id = String(user.id);
	await canvas().post(`/api/v1/accounts/${fx('accountId')}/admins`, { user_id: id, send_confirmation: false });

	try {
		const { session, token } = await signInAndCreateToken(loginId, password, `battery admin ${label}`);
		const persona = `dedicated-admin-${label}-${suffix}`;
		await registerCredential(persona, { canvasUrl: canvasUrl(), accessToken: token });
		return { id, name, loginId, password, token, persona, session };
	} catch (error) {
		await discardUser(id, true);
		throw error;
	}
}

/** Remove a dedicated admin: its admin role, its credential and the user. */
export async function removeDedicatedAdmin(admin: DedicatedUser | undefined): Promise<void> {
	if (!admin) return;
	await canvas()
		.request('DELETE', `/api/v1/accounts/${fx('accountId')}/admins/${admin.id}`)
		.catch(() => undefined);
	await removeDedicatedUser(admin);
}
