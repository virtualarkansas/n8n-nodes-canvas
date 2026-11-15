import { execFileSync } from 'node:child_process';
import { canvas, CanvasClient, fx, unique } from '../../lib/canvas';
import type { Json } from '../../lib/n8n';

/**
 * Records of their own for the grading / rubric / outcome test files, so that
 * nothing seeded (and nothing another test file uses) is ever modified:
 *
 *   - a pool of students (and graders) that is created once and found again by SIS ID on later runs,
 *   - a fresh course per test file with those students and the personas enrolled.
 */

interface Pool {
	sisPrefix: string;
	loginPrefix: string;
	name: string;
}

const STUDENTS: Pool = { sisPrefix: 'BATTERY-GRD-STU-', loginPrefix: 'grd.sandbox.student.', name: 'Grading Sandbox Student' };
const GRADERS: Pool = { sisPrefix: 'BATTERY-GRD-GRADER-', loginPrefix: 'grd.sandbox.grader.', name: 'Grading Sandbox Grader' };

async function inChunks<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
	}
	return out;
}

async function poolUsers(pool: Pool, count: number): Promise<number[]> {
	const api = canvas();
	const existing = await api.getAll<Json>(
		`/api/v1/accounts/${fx('accountId')}/users?search_term=${encodeURIComponent(pool.loginPrefix)}`,
	);
	const bySis = new Map(existing.map((user) => [String(user.sis_user_id), Number(user.id)]));

	const wanted = Array.from({ length: count }, (_, i) => i + 1);
	return inChunks(wanted, 5, async (index) => {
		const number = String(index).padStart(3, '0');
		const sisId = `${pool.sisPrefix}${number}`;
		const known = bySis.get(sisId);
		if (known) return known;
		const created = await api.request('POST', `/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name: `${pool.name} ${number}`, skip_registration: true },
			pseudonym: { unique_id: `${pool.loginPrefix}${number}@example.edu`, sis_user_id: sisId, send_confirmation: false },
			communication_channel: { skip_confirmation: true },
		});
		if (created.status < 400) return Number((created.data as Json).id);
		// Another test file created the same user a moment ago.
		const found = await api.get<Json>(`/api/v1/users/sis_user_id:${sisId}`);
		return Number(found.id);
	});
}

/** IDs of `count` sandbox students, created on first use. */
export function sandboxStudents(count: number): Promise<number[]> {
	return poolUsers(STUDENTS, count);
}

/** IDs of `count` sandbox users meant to be enrolled as teachers (the seeded TA role may not grade). */
export function sandboxGraders(count: number): Promise<number[]> {
	return poolUsers(GRADERS, count);
}

export interface SandboxCourse {
	id: string;
	sisId: string;
	studentIds: number[];
}

export interface SandboxCourseOptions {
	/** Number of sandbox students to enrol (active). */
	students?: number;
	/** Personas to enrol: teacher -> teacher, ta -> TA, student -> student. */
	personas?: Array<'teacher' | 'ta' | 'student' | 'student2' | 'designer'>;
	/** Extra course attributes (enrollment_term_id, ...). */
	course?: Json;
	/** Account to create the course in (default: the root account). */
	accountId?: string;
}

const PERSONA_ENROLLMENT: Record<string, { fixture: string; type: string }> = {
	teacher: { fixture: 'teacherUserId', type: 'TeacherEnrollment' },
	ta: { fixture: 'taUserId', type: 'TaEnrollment' },
	student: { fixture: 'studentUserId', type: 'StudentEnrollment' },
	student2: { fixture: 'student2UserId', type: 'StudentEnrollment' },
	designer: { fixture: 'designerUserId', type: 'DesignerEnrollment' },
};

export async function enroll(courseId: string, userId: number | string, type: string): Promise<Json> {
	return canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
		enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false },
	});
}

/** A published course of its own for one test file. Delete it with `deleteSandboxCourse` afterwards. */
export async function createSandboxCourse(label: string, options: SandboxCourseOptions = {}): Promise<SandboxCourse> {
	const sisId = unique(`GRD-${label}`).replace(/\s/g, '-');
	const course = await canvas().post<Json>(`/api/v1/accounts/${options.accountId ?? fx('accountId')}/courses`, {
		course: { name: unique(`Grading sandbox: ${label}`), course_code: label, sis_course_id: sisId, ...(options.course ?? {}) },
		offer: true,
	});
	const id = String(course.id);

	const studentIds = options.students ? await sandboxStudents(options.students) : [];
	await inChunks(studentIds, 5, (userId) => enroll(id, userId, 'StudentEnrollment'));
	for (const persona of options.personas ?? []) {
		const { fixture, type } = PERSONA_ENROLLMENT[persona];
		await enroll(id, fx(fixture), type);
	}
	return { id, sisId, studentIds };
}

export async function deleteSandboxCourse(course: SandboxCourse | undefined): Promise<void> {
	if (!course) return;
	await canvas().request('DELETE', `/api/v1/courses/${course.id}?event=delete`);
}

/** A sub-account of its own, for account-level settings that must not touch the root account. */
export async function createSandboxAccount(label: string): Promise<string> {
	const account = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, {
		account: { name: unique(`Grading sandbox account: ${label}`) },
	});
	return String(account.id);
}

/** Delete a sandbox sub-account (its courses must have been deleted first). */
export async function deleteSandboxAccount(accountId: string | undefined): Promise<void> {
	if (!accountId) return;
	await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/sub_accounts/${accountId}`);
}

/** Wait for a Canvas Progress (background job) to finish and return it. */
export async function waitForProgress(progressId: number | string, timeoutMs = 120_000): Promise<Json> {
	const started = Date.now();
	for (;;) {
		const progress = await canvas().get<Json>(`/api/v1/progress/${progressId}`);
		if (progress.workflow_state === 'completed' || progress.workflow_state === 'failed') return progress;
		if (Date.now() - started > timeoutMs) {
			throw new Error(`Progress ${progressId} still ${String(progress.workflow_state)} after ${timeoutMs} ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

/** A Canvas client that acts as another user (admin masquerading), for set-up only. */
export function actingAs(userId: number | string): {
	put: <T = Json>(path: string, body?: unknown) => Promise<T>;
	post: <T = Json>(path: string, body?: unknown) => Promise<T>;
	get: <T = Json>(path: string) => Promise<T>;
} {
	const withUser = (path: string): string => `${path}${path.includes('?') ? '&' : '?'}as_user_id=${userId}`;
	const api: CanvasClient = canvas();
	return {
		put: (path, body) => api.put(withUser(path), body),
		post: (path, body) => api.post(withUser(path), body),
		get: (path) => api.get(withUser(path)),
	};
}

/**
 * Run SQL in the Canvas database container. Only for states that exist in real
 * Canvas instances but can no longer be produced through the API (legacy records).
 */
export function canvasSql(sql: string): string {
	const container = process.env.CANVAS_PG_CONTAINER ?? 'canvas-pg';
	return execFileSync(
		'docker',
		['exec', container, 'psql', '-U', 'postgres', '-d', 'canvas_development', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
		{ encoding: 'utf8' },
	).trim();
}

/** Unwrap `{ key: record }` / `{ key: [record] }` responses Canvas uses for some resources. */
export function unwrap(item: Json, key: string): Json {
	const inner = item[key];
	if (Array.isArray(inner)) return inner[0] as Json;
	if (inner !== null && typeof inner === 'object') return inner as Json;
	return item;
}
