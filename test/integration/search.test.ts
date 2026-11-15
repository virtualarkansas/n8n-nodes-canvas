import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createTokenPersona } from './lti-advantage.helper';
import { createUser, createUserWithToken, deleteUser, WebSession } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * The course catalog switch of the root account (`enable_course_catalog`) is
 * not settable through the REST API, only through the account settings page.
 * Do what the page does: log in to the web interface as the admin and submit
 * the settings form.
 */
async function setCourseCatalog(enabled: boolean): Promise<void> {
	const env = readFileSync(resolve(__dirname, '..', 'env', 'canvas', 'canvas.env'), 'utf8');
	const setting = (name: string): string => new RegExp(`^${name}=(.*)$`, 'm').exec(env)?.[1].trim() ?? '';
	const session = new WebSession();
	await session.login(setting('CANVAS_LMS_ADMIN_EMAIL'), setting('CANVAS_LMS_ADMIN_PASSWORD'));
	const update = await session.request('PUT', `/accounts/${fx('accountId')}`, {
		'account[settings][enable_course_catalog]': enabled ? '1' : '0',
	});
	if (update.status !== 200) throw new Error(`Could not switch the course catalog: ${update.status}`);
}

/** Recipients are users (numeric id) or contexts ("course_6"); compare them by id. */
const ids = (recipients: Json[]): string[] => recipients.map((r) => String(r.id));

describe('search', () => {
	const marker = `catalog${randomUUID().slice(0, 8)}`;
	const ownCourses: string[] = [];
	const recipientCourses: string[] = [];
	let catalogChanged = false;
	const ownUsers: OwnUser[] = [];
	let removePersona: (() => Promise<void>) | undefined;

	afterAll(async () => {
		if (catalogChanged) await setCourseCatalog(false);
		await removePersona?.();
		for (const user of ownUsers) {
			await deleteUser(user);
		}
		for (const id of [...ownCourses, ...recipientCourses]) {
			await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
	});

	describe('findRecipients', () => {
		it('pages through the students of a large course', async () => {
			const context = `course_${fx('largeCourseId')}_students`;
			const expected = await canvas().getAll<Json>(`/api/v1/search/recipients?context=${context}&type=user`);
			expect(expected.length).toBeGreaterThan(100);

			const defaults = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { context, type: 'user' } },
			});
			expect(defaults).toHaveLength(50);
			expect(ids(defaults)).toEqual(ids(expected).slice(0, 50));

			const all = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { context, type: 'user' }, pagination: { returnAll: true } },
			});
			expect(ids(all)).toEqual(ids(expected));
			expect(new Set(ids(all)).size).toBe(all.length);

			const twoPages = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { context, type: 'user' }, pagination: { perPage: 7, maxPages: 2 } },
			});
			expect(ids(twoPages)).toEqual(ids(expected).slice(0, 14));
		});

		it('search terms: every word must match; names with accents, apostrophes, emoji and right-to-left script', async () => {
			const context = `course_${fx('courseId')}`;
			for (const search of ['Zoë', "O'Malley", 'Zoë Quinn', 'محمد', 'persona']) {
				const expected = await canvas().getAll<Json>(
					`/api/v1/search/recipients?context=${context}&search=${encodeURIComponent(search)}`,
				);
				const found = await runOk({
					resource: 'search',
					operation: 'findRecipients',
					params: { options: { context, search }, pagination: { returnAll: true } },
				});
				expect(ids(found), `search "${search}"`).toEqual(ids(expected));
				if (search !== 'persona') {
					expect(found.length, `search "${search}" should find someone`).toBeGreaterThan(0);
				}
			}

			const nobody = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { context, search: 'Zoë zzz-no-such-word' } },
			});
			expect(nobody).toEqual([]);
		});

		it('type: only users, only contexts, or both', async () => {
			const search = 'Biology';
			const users = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'teacher',
				params: { options: { search, type: 'user' }, pagination: { returnAll: true } },
			});
			expect(users.every((r) => typeof r.id === 'number')).toBe(true);

			const contexts = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'teacher',
				params: {
					options: { search, type: 'context', permissions: ['send_messages', 'send_messages_all'] },
					pagination: { returnAll: true },
				},
			});
			expect(contexts.length).toBeGreaterThan(0);
			expect(contexts.every((r) => r.type === 'context' && /^(course|section|group)_\d+$/.test(String(r.id)))).toBe(true);
			expect(ids(contexts)).toContain(`course_${fx('courseId')}`);
			// The requested permissions are reported for each context.
			const mainCourse = contexts.find((r) => r.id === `course_${fx('courseId')}`) as Json;
			expect(mainCourse.permissions).toEqual({ send_messages: true, send_messages_all: true });

			// "All" is the empty choice of the dropdown: it must not be sent as type=.
			const teacher = new CanvasClient('teacher');
			const expectedBoth = await teacher.getAll<Json>(`/api/v1/search/recipients?search=${search}`);
			const both = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'teacher',
				params: { options: { search, type: '', context: '', exclude: '', user_id: '' }, pagination: { returnAll: true } },
			});
			expect(ids(both)).toEqual(ids(expectedBoth));
			expect(ids(both)).toEqual(expect.arrayContaining(ids(contexts)));
		});

		it('exclude: users by number, contexts by prefixed ID', async () => {
			const context = `course_${fx('courseId')}_teachers`;
			const teachers = await canvas().getAll<Json>(`/api/v1/search/recipients?context=${context}`);
			expect(teachers.length).toBeGreaterThanOrEqual(2);
			const excluded = ids(teachers).slice(0, 2);
			const remaining = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { context, exclude: ` ${excluded[0]} , ${excluded[1]},` }, pagination: { returnAll: true } },
			});
			expect(ids(remaining)).toEqual(ids(teachers).slice(2));

			const teacher = new CanvasClient('teacher');
			const all = await teacher.getAll<Json>('/api/v1/search/recipients?search=Biology&type=context');
			const withoutMain = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'teacher',
				params: {
					options: { search: 'Biology', type: 'context', exclude: `course_${fx('courseId')}` },
					pagination: { returnAll: true },
				},
			});
			expect(ids(withoutMain)).toEqual(ids(all).filter((id) => id !== `course_${fx('courseId')}`));
		});

		it('user ID: looks up one user, and only if the token\'s user may message them', async () => {
			const [known] = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'teacher',
				items: [{ user: Number(fx('studentUserId')) }],
				params: { options: { user_id: '={{ $json.user }}', search: 'ignored when a user ID is given' } },
			});
			expect(known).toMatchObject({ id: Number(fx('studentUserId')) });
			expect(Object.keys(known.common_courses as Json)).toContain(fx('courseId'));

			// The student persona shares no course or group with the registrar.
			const stranger = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'student',
				params: { options: { user_id: fx('registrarUserId') } },
			});
			expect(stranger).toEqual([]);
		});

		it('from conversation ID: finds a user the token\'s user only shares a conversation with', async () => {
			// Two users of this file without any course or group in common ...
			const insider = await createUserWithToken('Search insider');
			const stranger = await createUser('Search stranger');
			ownUsers.push(insider, stranger);
			removePersona = await createTokenPersona('searchInsider', insider.token as string);
			// ... whom an admin puts into one group conversation.
			const [conversation] = await canvas().post<Json[]>('/api/v1/conversations', {
				recipients: [insider.id, stranger.id],
				subject: 'Battery: shared conversation',
				body: 'You two should talk.',
				group_conversation: true,
			});

			const without = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'searchInsider',
				params: { options: { user_id: stranger.id } },
			});
			expect(without).toEqual([]);

			const [within] = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'searchInsider',
				items: [{ conversation: conversation.id }],
				params: { options: { user_id: stranger.id, from_conversation_id: '={{ $json.conversation }}' } },
			});
			expect(within).toMatchObject({ id: Number(stranger.id), name: stranger.name });
		});

		it('without a search term, a context or a user ID there is nothing to find', async () => {
			const nothing = await runOk({ resource: 'search', operation: 'findRecipients' });
			expect(nothing).toEqual([]);
		});

		it('a student only finds the people and contexts they can message', async () => {
			// The seeded courses change all the time while other files run, so this uses a course
			// of its own: the insider of the previous test as a student, with a teacher and a classmate.
			const insider = ownUsers[0];
			const stranger = ownUsers[1];
			const teacher = await createUser('Search teacher');
			const classmate = await createUser('Search classmate');
			ownUsers.push(teacher, classmate);
			const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
				course: { name: `Recipients ${marker}` },
				offer: true,
			});
			const courseId = String(course.id);
			recipientCourses.push(courseId);
			for (const [user, type] of [
				[insider, 'StudentEnrollment'],
				[classmate, 'StudentEnrollment'],
				[teacher, 'TeacherEnrollment'],
			] as Array<[OwnUser, string]>) {
				await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
					enrollment: { user_id: user.id, type, enrollment_state: 'active' },
				});
			}

			const everyone = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'searchInsider',
				params: { options: { search: 'Search', type: 'user' }, pagination: { returnAll: true } },
			});
			// The people of the course (the insider included), but not the stranger. Compared as a set:
			// right after enrollments change, Canvas now and then lists the searching user twice.
			expect([...new Set(ids(everyone))].sort()).toEqual([insider.id, classmate.id, teacher.id].sort());
			expect(ids(everyone)).not.toContain(stranger.id);

			const teachers = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'searchInsider',
				params: { options: { context: `course_${courseId}_teachers` } },
			});
			expect(ids(teachers)).toEqual([teacher.id]);

			const contexts = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'searchInsider',
				params: { options: { search: marker, type: 'context', permissions: ['send_messages_all'] } },
			});
			expect(ids(contexts)).toEqual([`course_${courseId}`]);
			// A student may not message the whole course at once.
			expect(contexts[0].permissions).toEqual({});

			// A course the insider is not in gives nothing away.
			const elsewhere = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				persona: 'searchInsider',
				params: { options: { search: 'a', context: `course_${fx('largeCourseId')}` } },
			});
			expect(elsewhere).toEqual([]);
			// The admin, in contrast, finds the stranger by name.
			const asAdmin = await runOk({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { search: stranger.name, type: 'user' } },
			});
			expect(ids(asAdmin)).toEqual([stranger.id]);
		});

		it('errors: an unknown user ID is a 404 on the Error output', async () => {
			const result = await runNode({
				resource: 'search',
				operation: 'findRecipients',
				params: { options: { user_id: '99999999' }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({
				errorCode: 404,
				errorType: 'NOT_FOUND',
				resource: 'search',
				operation: 'findRecipients',
			});
		});
	});

	describe('listAllCourses', () => {
		it('is refused while the course catalog is turned off (the default)', async () => {
			const result = await runNode({
				resource: 'search',
				operation: 'listAllCourses',
				params: { errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({
				errorCode: 403,
				errorType: 'FORBIDDEN',
				resource: 'search',
				operation: 'listAllCourses',
				endpoint: '/api/v1/search/all_courses',
			});
		});

		it('lists the indexed, published courses; filters by search term, public content and self enrollment', async () => {
			// 12 indexed courses: 4 plain, 4 public, 4 public with self enrollment.
			for (let i = 0; i < 12; i++) {
				const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
					course: {
						name: `${marker} course ${String(i).padStart(2, '0')}`,
						indexed: true,
						is_public: i >= 4,
						open_enrollment: i >= 8,
					},
					offer: true,
				});
				ownCourses.push(String(course.id));
			}
			// Not in the index: unpublished, and published but not indexed.
			for (const extra of [
				{ course: { name: `${marker} unpublished`, indexed: true } },
				{ course: { name: `${marker} not indexed` }, offer: true },
			]) {
				ownCourses.push(String((await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, extra)).id));
			}

			// Canvas runs several server processes and each notices the changed account setting on its
			// own (within about a minute). A burst of parallel requests reaches all of them: wait until
			// two bursts in a row are answered the same way by every process.
			const everyProcessAnswers = async (status: number): Promise<void> => {
				for (let good = 0, attempt = 0; good < 2; attempt++) {
					const burst = await Promise.all(
						Array.from({ length: 12 }, () => canvas().request('GET', `/api/v1/search/all_courses?search=${marker}`)),
					);
					good = burst.every((res) => res.status === status) ? good + 1 : 0;
					if (attempt > 90) throw new Error(`Not every Canvas process answers ${status} for the course catalog`);
					if (good === 0) await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			};

			catalogChanged = true;
			await setCourseCatalog(true);
			await everyProcessAnswers(200);
			try {
				// Canvas wraps every entry as { course: {...} }; the node outputs the course itself.
				const courseIds = (items: Json[]): number[] => items.map((item) => ((item.course as Json | undefined) ?? item).id as number);
				const own = ownCourses.slice(0, 12).map(Number);

				const expected = await canvas().getAll<Json>(`/api/v1/search/all_courses?search=${marker}`);
				expect(courseIds(expected)).toEqual(own);

				const found = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					params: { options: { search: marker } },
				});
				expect(courseIds(found)).toEqual(own);
				expect(found[0].name).toBe(`${marker} course 00`);
				expect(found[0]).not.toHaveProperty('course');

				const twoPages = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					params: { options: { search: marker }, pagination: { perPage: 5, maxPages: 2 } },
				});
				expect(courseIds(twoPages)).toEqual(own.slice(0, 10));

				const publicOnly = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					params: { options: { search: marker, public_only: true }, pagination: { returnAll: true } },
				});
				expect(courseIds(publicOnly)).toEqual(own.slice(4));

				const selfEnrollment = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					params: {
						options: { search: marker, public_only: true, open_enrollment_only: true },
						pagination: { returnAll: true },
					},
				});
				expect(courseIds(selfEnrollment)).toEqual(own.slice(8));

				// Switched off explicitly: no filtering (Canvas itself would filter on "false").
				const unfiltered = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					params: {
						options: { search: marker, public_only: false, open_enrollment_only: false },
						pagination: { returnAll: true },
					},
				});
				expect(courseIds(unfiltered)).toEqual(own);

				// Without a search term: the whole public index, also for a student.
				const everything = await canvas().getAll<Json>('/api/v1/search/all_courses');
				expect(everything.length).toBeGreaterThanOrEqual(12);
				const asStudent = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					persona: 'student',
					params: { pagination: { returnAll: true } },
				});
				expect(courseIds(asStudent)).toEqual(courseIds(everything));

				const none = await runOk({
					resource: 'search',
					operation: 'listAllCourses',
					params: { options: { search: `${marker} no such course` } },
				});
				expect(none).toEqual([]);
			} finally {
				await setCourseCatalog(false);
				catalogChanged = false;
			}
			// Switched off again, the catalog is refused (once every process has noticed).
			await everyProcessAnswers(403);
		});
	});
});
