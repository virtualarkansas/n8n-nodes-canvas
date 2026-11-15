import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { canvas, CanvasClient, fx } from '../../lib/canvas';
import { n8n } from '../../lib/harness';
import type { Json } from '../../lib/n8n';
import { loadState, STATE_PATH } from '../../lib/state';

/**
 * A private corner of the shared Canvas for the messaging / calendar / group
 * tests: one published course with its own teacher and students, three of
 * which can be driven through the node (they have an API token and an n8n
 * credential, registered as personas in the local test state).
 *
 * These tests change per-user state (inbox read flags, notification
 * preferences, group memberships, reservations), which must never happen to
 * the seeded personas other tests rely on.
 *
 * The sandbox is created once and cached in test/.results (git-ignored); every
 * later run, and every test file, reuses it after checking it is still alive.
 */

export interface SandboxUser {
	id: string;
	name: string;
	login: string;
	/** Persona name usable with `runNode({ persona })` and `new CanvasClient(persona)`. */
	persona?: string;
	token?: string;
	/** ID of the user's e-mail communication channel. */
	channelId?: string;
}

export interface Sandbox {
	canvasUrl: string;
	courseId: string;
	sectionId: string;
	teacher: SandboxUser;
	/** 60 active students; the first three have tokens (personas sbxStudent1..3). */
	students: SandboxUser[];
}

const PASSWORD = 'SandboxPass123!x';
const STUDENT_COUNT = 60;
const TOKEN_STUDENTS = 3;
const RESULTS_DIR = resolve(dirname(STATE_PATH), '.results');
const CACHE_PATH = resolve(RESULTS_DIR, 'comms-sandbox.json');
const LOCK_PATH = resolve(RESULTS_DIR, 'comms-sandbox.lock');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
	mkdirSync(RESULTS_DIR, { recursive: true });
	const started = Date.now();
	for (;;) {
		try {
			mkdirSync(LOCK_PATH);
			break;
		} catch {
			// Another test file is building the sandbox; a lock older than ten minutes is stale.
			try {
				if (Date.now() - statSync(LOCK_PATH).mtimeMs > 600_000) rmdirSync(LOCK_PATH);
			} catch {
				// lock vanished in between
			}
			if (Date.now() - started > 900_000) throw new Error('Timed out waiting for the sandbox lock');
			await sleep(250);
		}
	}
	try {
		return await fn();
	} finally {
		try {
			rmdirSync(LOCK_PATH);
		} catch {
			// already gone
		}
	}
}

/** Read-modify-write of the test state that other test files can never observe half-written. */
function patchState(mutate: (state: ReturnType<typeof loadState>) => void): void {
	const state = loadState();
	mutate(state);
	const tmp = `${STATE_PATH}.${process.pid}.tmp`;
	writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
	renameSync(tmp, STATE_PATH);
}

/**
 * Canvas only hands out a usable token to the user it belongs to (a token an
 * admin creates for someone else stays "pending"), so log in as the user with
 * a browser-style session and let them create their own.
 */
export async function createTokenByLogin(canvasUrl: string, login: string, password: string): Promise<string> {
	const jar = new Map<string, string>();
	const absorb = (res: Response): void => {
		for (const cookie of res.headers.getSetCookie()) {
			const [pair] = cookie.split(';');
			const eq = pair.indexOf('=');
			jar.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
	};
	const cookieHeader = (): string =>
		Array.from(jar.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	const csrf = (): string => decodeURIComponent(jar.get('_csrf_token') ?? '');

	// Any response sets the CSRF cookie (HTML pages are not available on a Canvas without compiled assets).
	absorb(await fetch(`${canvasUrl}/api/v1/accounts`, { headers: { accept: 'application/json' } }));
	const form = new URLSearchParams({
		authenticity_token: csrf(),
		'pseudonym_session[unique_id]': login,
		'pseudonym_session[password]': password,
	});
	const loginRes = await fetch(`${canvasUrl}/login/canvas`, {
		method: 'POST',
		redirect: 'manual',
		headers: { cookie: cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' },
		body: form.toString(),
	});
	absorb(loginRes);
	if (loginRes.status !== 302 || !String(loginRes.headers.get('location')).includes('login_success')) {
		throw new Error(`Canvas login as ${login} failed with status ${loginRes.status}`);
	}
	const tokenRes = await fetch(`${canvasUrl}/api/v1/users/self/tokens`, {
		method: 'POST',
		headers: { cookie: cookieHeader(), 'x-csrf-token': csrf(), 'content-type': 'application/json' },
		// Students must give their tokens an expiry (at most 120 days ahead).
		body: JSON.stringify({
			token: { purpose: 'n8n battery sandbox', expires_at: new Date(Date.now() + 100 * 86_400_000).toISOString() },
		}),
	});
	const body = (await tokenRes.json()) as Json;
	if (tokenRes.status >= 300 || typeof body.visible_token !== 'string' || body.workflow_state !== 'active') {
		throw new Error(`Could not create a token for ${login}: ${JSON.stringify(body).slice(0, 300)}`);
	}
	return body.visible_token;
}

async function createUser(name: string, login: string): Promise<SandboxUser> {
	const user = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
		user: { name, skip_registration: true, terms_of_use: true },
		pseudonym: { unique_id: login, password: PASSWORD, send_confirmation: false },
		communication_channel: { type: 'email', address: login, skip_confirmation: true },
	});
	return { id: String(user.id), name, login };
}

/** Make sure the persona's token and n8n credential are in the local test state. */
async function registerPersona(user: SandboxUser, canvasUrl: string): Promise<void> {
	if (!user.persona || !user.token) return;
	const state = loadState();
	const persona = user.persona;
	const known = state.n8n.credentials[persona];
	// n8n's public API cannot read credentials back; the bootstrap empties this list whenever
	// it starts on a fresh n8n database, so an entry here means the credential exists.
	if (known && state.canvas.tokens[persona] === user.token) return;
	if (known) {
		await n8n()
			.api('DELETE', `/credentials/${known.id}`)
			.catch(() => undefined);
	}
	const name = `Canvas battery (${persona})`;
	const created = await n8n().api<{ id: string }>('POST', '/credentials', {
		name,
		type: 'canvasApi',
		data: { canvasUrl, accessToken: user.token, allowedHttpRequestDomains: 'all' },
	});
	patchState((s) => {
		s.canvas.tokens[persona] = user.token as string;
		s.n8n.credentials[persona] = { id: String(created.id), name, type: 'canvasApi' };
	});
}

async function inParallel<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(size, items.length) }, async () => {
			for (;;) {
				const index = next++;
				if (index >= items.length) return;
				out[index] = await fn(items[index], index);
			}
		}),
	);
	return out;
}

async function build(): Promise<Sandbox> {
	const canvasUrl = canvas().url;
	const stamp = Date.now().toString(36);
	const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
		course: { name: `Battery sandbox ${stamp} (messaging, calendar, groups)`, course_code: `SBX-${stamp}` },
		offer: true,
	});
	const courseId = String(course.id);
	const createdUsers: SandboxUser[] = [];

	const enroll = (userId: string, type: string): Promise<Json> =>
		canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false },
		});

	try {
		const teacher = await createUser(`Sandbox Teacher ${stamp}`, `sbx.${stamp}.teacher@example.edu`);
		createdUsers.push(teacher);
		await enroll(teacher.id, 'TeacherEnrollment');
		teacher.token = await createTokenByLogin(canvasUrl, teacher.login, PASSWORD);
		teacher.persona = 'sbxTeacher';

		const students = await inParallel(
			Array.from({ length: STUDENT_COUNT }, (_, i) => i),
			4,
			async (i) => {
				const number = String(i + 1).padStart(2, '0');
				// A few names real rosters have: accents, an apostrophe, non-Latin script.
				const flavour = ['', ' Ñandú', " O'Brien", ' 李'][i % 4];
				const student = await createUser(`Sandbox Student ${number}${flavour}`, `sbx.${stamp}.s${number}@example.edu`);
				createdUsers.push(student);
				await enroll(student.id, 'StudentEnrollment');
				return student;
			},
		);
		for (let i = 0; i < TOKEN_STUDENTS; i++) {
			students[i].token = await createTokenByLogin(canvasUrl, students[i].login, PASSWORD);
			students[i].persona = `sbxStudent${i + 1}`;
		}
		for (const user of [teacher, ...students.slice(0, TOKEN_STUDENTS)]) {
			const channels = await canvas().getAll<Json>(`/api/v1/users/${user.id}/communication_channels`);
			user.channelId = String(channels.find((c) => c.type === 'email')?.id ?? '');
		}
		// The default section only exists once somebody is enrolled.
		const sections = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		return { canvasUrl, courseId, sectionId: String(sections[0].id), teacher, students };
	} catch (error) {
		// Do not leave half a sandbox behind in the shared Canvas.
		await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		for (const user of createdUsers) {
			await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${user.id}`);
		}
		throw error;
	}
}

async function alive(sandbox: Sandbox): Promise<boolean> {
	if (sandbox.canvasUrl !== canvas().url) return false;
	const course = await canvas().request('GET', `/api/v1/courses/${sandbox.courseId}`);
	if (course.status !== 200 || (course.data as Json).workflow_state !== 'available') return false;
	for (const user of [sandbox.teacher, ...sandbox.students.slice(0, TOKEN_STUDENTS)]) {
		const self = await fetch(`${sandbox.canvasUrl}/api/v1/users/self`, {
			headers: { authorization: `Bearer ${user.token}` },
		});
		if (self.status !== 200) return false;
	}
	return true;
}

let cached: Sandbox | undefined;

export async function commsSandbox(): Promise<Sandbox> {
	if (cached) return cached;
	cached = await withLock(async () => {
		let sandbox: Sandbox | undefined;
		if (existsSync(CACHE_PATH)) {
			try {
				const stored = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Sandbox;
				if (await alive(stored)) sandbox = stored;
			} catch {
				// unreadable cache: rebuild
			}
		}
		if (!sandbox) {
			sandbox = await build();
			writeFileSync(CACHE_PATH, JSON.stringify(sandbox, null, 2) + '\n');
		}
		for (const user of [sandbox.teacher, ...sandbox.students.slice(0, TOKEN_STUDENTS)]) {
			await registerPersona(user, sandbox.canvasUrl);
		}
		return sandbox;
	});
	return cached;
}

/** Canvas client acting as one of the sandbox users that have a token. */
export function clientFor(user: SandboxUser): CanvasClient {
	if (!user.persona) throw new Error(`Sandbox user ${user.name} has no token`);
	return new CanvasClient(user.persona);
}

/** A brand-new user (with token, persona and e-mail channel) for tests that need a clean slate. */
export async function freshUser(personaName: string, label: string): Promise<SandboxUser> {
	const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
	const user = await createUser(`${label} ${stamp}`, `sbx.${stamp}.fresh@example.edu`);
	user.token = await createTokenByLogin(canvas().url, user.login, PASSWORD);
	user.persona = personaName;
	const channels = await canvas().getAll<Json>(`/api/v1/users/${user.id}/communication_channels`);
	user.channelId = String(channels.find((c) => c.type === 'email')?.id ?? '');
	await withLock(() => registerPersona(user, canvas().url));
	return user;
}

/** Poll until `probe` returns a value (Canvas does some work in background jobs). */
export async function waitFor<T>(probe: () => Promise<T | undefined | false>, timeoutMs = 60_000, label = 'condition'): Promise<T> {
	const started = Date.now();
	for (;;) {
		const value = await probe();
		if (value) return value;
		if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
		await sleep(500);
	}
}
