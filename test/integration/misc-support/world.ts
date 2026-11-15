import { canvas, fx, unique } from '../../lib/canvas';
import type { Json } from '../../lib/n8n';

/**
 * Small builders for records a test file owns (so nothing seeded is touched).
 * Everything is created as the seeded account admin.
 */

export interface OwnCourse {
	id: string;
	name: string;
	sisId?: string;
}

/** Create a course in the root account (published unless `publish: false`). */
export async function createCourse(
	label: string,
	opts: { publish?: boolean; sisId?: string; accountId?: string; course?: Json } = {},
): Promise<OwnCourse> {
	const name = unique(label);
	const created = await canvas().post<Json>(`/api/v1/accounts/${opts.accountId ?? fx('accountId')}/courses`, {
		course: { name, course_code: label.slice(0, 20), ...(opts.sisId ? { sis_course_id: opts.sisId } : {}), ...(opts.course ?? {}) },
		offer: opts.publish !== false,
	});
	return { id: String(created.id), name, sisId: opts.sisId };
}

/** Delete courses created by a test file (ignores ones that are already gone). */
export async function deleteCourses(courses: Array<OwnCourse | undefined>): Promise<void> {
	await Promise.all(
		courses
			.filter((c): c is OwnCourse => Boolean(c))
			.map((c) => canvas().request('DELETE', `/api/v1/courses/${c.id}?event=delete`).catch(() => undefined)),
	);
}

export async function enroll(
	courseId: string,
	userId: string,
	type: 'StudentEnrollment' | 'TeacherEnrollment' | 'ObserverEnrollment' | 'TaEnrollment',
	extra: Json = {},
): Promise<Json> {
	return canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
		enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false, ...extra },
	});
}

/** A value safe to use as an SIS ID that is unique across runs. */
export function uniqueSisId(prefix: string): string {
	return unique(prefix).replace(/\s+/g, '_');
}

/** ISO timestamp `days` from now (negative = past), at a fixed time of day for stable assertions. */
export function daysFromNow(days: number, hourUtc = 15): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	date.setUTCHours(hourUtc, 0, 0, 0);
	return date.toISOString().replace('.000Z', 'Z');
}
