import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { canvas, CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createDedicatedUser, removeDedicatedUser } from './misc-support/dedicated';
import type { DedicatedUser } from './misc-support/dedicated';
import { createCourse, deleteCourses, enroll, uniqueSisId } from './misc-support/world';
import type { OwnCourse } from './misc-support/world';

vi.mock('../lib/state', async (original) =>
	(await import('./misc-support/state-overlay')).overlayState(await original()),
);

/**
 * Resource: favorite. Favorites are the dashboard choices of the user of the
 * credential, so the battery uses its own user, courses and groups; the shared
 * personas are only read.
 */
describe('favorite', () => {
	let fan: DedicatedUser;
	let observer: DedicatedUser;
	let asFan: CanvasClient;
	let alpha: OwnCourse; // student
	let beta: OwnCourse; // student, SIS ID with characters that need URL encoding
	let blueprint: OwnCourse; // teacher, blueprint course
	let outside: OwnCourse; // not enrolled
	let groupA = '';
	let groupB = '';
	let foreignGroup = '';

	const favoriteCourseIds = async (): Promise<number[]> =>
		(await asFan.get<Json[]>('/api/v1/users/self/favorites/courses')).map((c) => Number(c.id));
	const favoriteGroupIds = async (): Promise<number[]> =>
		(await asFan.get<Json[]>('/api/v1/users/self/favorites/groups')).map((g) => Number(g.id));
	/** Favorites the user has chosen explicitly (independent of the dashboard fallback). */
	const chosen = async (): Promise<number[]> =>
		(await asFan.getAll<Json>('/api/v1/users/self/courses?include[]=favorites'))
			.filter((c) => c.is_favorite === true)
			.map((c) => Number(c.id))
			.sort((a, b) => a - b);

	beforeAll(async () => {
		[alpha, beta, blueprint, outside] = await Promise.all([
			createCourse('Fav Alpha'),
			createCourse('Fav Beta', { sisId: uniqueSisId('FAV 1/2#?%&+') }),
			createCourse('Fav Blueprint'),
			createCourse('Fav Outside'),
		]);
		fan = await createDedicatedUser('favorites', [
			{ courseId: alpha.id, type: 'StudentEnrollment' },
			{ courseId: beta.id, type: 'StudentEnrollment' },
			{ courseId: blueprint.id, type: 'TeacherEnrollment' },
		]);
		asFan = new CanvasClient(fan.persona);
		await canvas().put(`/api/v1/courses/${blueprint.id}`, { course: { blueprint: true } });

		// The observer watches the fan in Alpha only; in Beta the observer is not linked to anyone.
		observer = await createDedicatedUser('favorites-observer');
		await enroll(alpha.id, observer.id, 'ObserverEnrollment', { associated_user_id: fan.id });
		await enroll(beta.id, observer.id, 'ObserverEnrollment');

		// A student can be in only one group per group set, so the two groups live in different sets.
		const makeGroup = async (name: string, categoryId?: string): Promise<[string, string]> => {
			const category =
				categoryId ??
				String((await canvas().post<Json>(`/api/v1/courses/${alpha.id}/group_categories`, { name: `${name} set` })).id);
			const group = await canvas().post<Json>(`/api/v1/group_categories/${category}/groups`, { name });
			return [String(group.id), category];
		};
		let firstCategory = '';
		[groupA, firstCategory] = await makeGroup('Fav Group A');
		[groupB] = await makeGroup('Fav Group B');
		[foreignGroup] = await makeGroup('Fav Group Foreign', firstCategory);
		for (const group of [groupA, groupB]) {
			await canvas().post(`/api/v1/groups/${group}/memberships`, { user_id: fan.id });
		}
	});

	afterAll(async () => {
		await removeDedicatedUser(fan);
		await removeDedicatedUser(observer);
		await deleteCourses([alpha, beta, blueprint, outside]);
	});

	it('getAllCourses: without chosen favorites Canvas returns the user\'s dashboard courses', async () => {
		const expected = await favoriteCourseIds();
		expect(expected.slice().sort()).toEqual([alpha.id, beta.id, blueprint.id].map(Number).sort());

		const listed = await runOk({ resource: 'favorite', operation: 'getAllCourses', persona: fan.persona });
		expect(listed.map((c) => c.id)).toEqual(expected);
		// Each course carries the user's own enrollments by default.
		for (const course of listed) {
			expect((course.enrollments as Json[]).map((e) => e.user_id)).toEqual([Number(fan.id)]);
		}
		expect(await chosen()).toEqual([]);
	});

	it('getAllCourses: every option is honoured', async () => {
		const withOptions = await runOk({
			resource: 'favorite',
			operation: 'getAllCourses',
			persona: fan.persona,
			params: {
				options: {
					exclude_blueprint_courses: true,
					exclude_enrollments: true,
					include: ['term', 'total_students', 'teachers', 'favorites'],
				},
			},
		});
		expect(withOptions.map((c) => Number(c.id)).sort()).toEqual([alpha.id, beta.id].map(Number).sort());
		for (const course of withOptions) {
			expect(course.term).toBeTypeOf('object');
			expect(course.total_students).toBe(1);
			expect(course.teachers).toBeInstanceOf(Array);
			expect(course.is_favorite).toBe(false);
			expect(course).not.toHaveProperty('enrollments');
		}

		// exclude_blueprint_courses: false keeps the blueprint course.
		const withBlueprint = await runOk({
			resource: 'favorite',
			operation: 'getAllCourses',
			persona: fan.persona,
			params: { options: { exclude_blueprint_courses: false } },
		});
		expect(withBlueprint.map((c) => Number(c.id))).toContain(Number(blueprint.id));
	});

	it('getAllCourses: sort by nickname uses the user\'s course nicknames', async () => {
		// Teacher enrollments rank before student ones; within a rank the nickname decides.
		await asFan.put(`/api/v1/users/self/course_nicknames/${alpha.id}`, { nickname: 'zzz last' });
		await asFan.put(`/api/v1/users/self/course_nicknames/${beta.id}`, { nickname: 'aaa first' });
		const sorted = await runOk({
			resource: 'favorite',
			operation: 'getAllCourses',
			persona: fan.persona,
			params: { options: { sort: 'nickname' } },
		});
		expect(sorted.map((c) => Number(c.id))).toEqual([blueprint.id, beta.id, alpha.id].map(Number));

		await asFan.put(`/api/v1/users/self/course_nicknames/${alpha.id}`, { nickname: 'aaa now first' });
		await asFan.put(`/api/v1/users/self/course_nicknames/${beta.id}`, { nickname: 'zzz now last' });
		const resorted = await runOk({
			resource: 'favorite',
			operation: 'getAllCourses',
			persona: fan.persona,
			params: { options: { sort: 'nickname' } },
		});
		expect(resorted.map((c) => Number(c.id))).toEqual([blueprint.id, alpha.id, beta.id].map(Number));
		await asFan.delete('/api/v1/users/self/course_nicknames');
	});

	it('getAllCourses: an observer can narrow the list to the courses of one observed student', async () => {
		const asObserver = new CanvasClient(observer.persona);
		const all = await asObserver.get<Json[]>('/api/v1/users/self/favorites/courses');
		expect(all.map((c) => Number(c.id)).sort()).toEqual([alpha.id, beta.id].map(Number).sort());

		const narrowed = await runOk({
			resource: 'favorite',
			operation: 'getAllCourses',
			persona: observer.persona,
			params: { options: { observed_user_id: ` ${fan.id} `, include: ['observed_users'] } },
		});
		expect(narrowed.map((c) => Number(c.id))).toEqual([Number(alpha.id)]);
		const observed = (narrowed[0].enrollments as Json[]).filter((e) => e.type === 'student');
		expect(observed.map((e) => e.user_id)).toEqual([Number(fan.id)]);
	});

	it('addCourse: the first chosen favorite replaces the automatic list', async () => {
		const [favorite] = await runOk({
			resource: 'favorite',
			operation: 'addCourse',
			persona: fan.persona,
			params: { courseId: alpha.id },
		});
		expect(favorite).toEqual({ context_id: Number(alpha.id), context_type: 'Course' });
		expect(await favoriteCourseIds()).toEqual([Number(alpha.id)]);
		expect(await chosen()).toEqual([Number(alpha.id)]);
	});

	it('addCourse: adding a favorite twice changes nothing', async () => {
		const [again] = await runOk({
			resource: 'favorite',
			operation: 'addCourse',
			persona: fan.persona,
			params: { courseId: Number(alpha.id) },
		});
		expect(again).toEqual({ context_id: Number(alpha.id), context_type: 'Course' });
		expect(await chosen()).toEqual([Number(alpha.id)]);
	});

	it('addCourse: a course is found by an SIS ID with characters that need URL encoding', async () => {
		const [favorite] = await runOk({
			resource: 'favorite',
			operation: 'addCourse',
			persona: fan.persona,
			params: { courseId: `sis_course_id:${beta.sisId}` },
		});
		expect(favorite).toEqual({ context_id: Number(beta.id), context_type: 'Course' });
		expect(await chosen()).toEqual([alpha.id, beta.id].map(Number).sort((a, b) => a - b));
	});

	it('addCourse: several input items, one of them a course that does not exist', async () => {
		await asFan.delete('/api/v1/users/self/favorites/courses');
		const result = await runNode({
			resource: 'favorite',
			operation: 'addCourse',
			persona: fan.persona,
			items: [{ course: alpha.id }, { course: '999999999' }, { course: blueprint.id }],
			params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([
			{ context_id: Number(alpha.id), context_type: 'Course' },
			{ context_id: Number(blueprint.id), context_type: 'Course' },
		]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'favorite',
			operation: 'addCourse',
			endpoint: '/api/v1/users/self/favorites/courses/999999999',
			originalItem: { course: '999999999' },
		});
		expect(await chosen()).toEqual([alpha.id, blueprint.id].map(Number).sort((a, b) => a - b));
	});

	it('addCourse: Canvas accepts a course the user is not enrolled in, but it never shows up', async () => {
		// The API documentation says the user "must be registered in the course"; Canvas does not enforce it.
		const [favorite] = await runOk({
			resource: 'favorite',
			operation: 'addCourse',
			persona: fan.persona,
			params: { courseId: outside.id },
		});
		expect(favorite).toEqual({ context_id: Number(outside.id), context_type: 'Course' });
		expect(await favoriteCourseIds()).not.toContain(Number(outside.id));
		await asFan.delete(`/api/v1/users/self/favorites/courses/${outside.id}`);
	});

	it('getAllCourses: returns exactly the chosen favorites', async () => {
		const listed = await runOk({
			resource: 'favorite',
			operation: 'getAllCourses',
			persona: fan.persona,
			params: { options: { include: ['favorites'] }, pagination: { returnAll: true } },
		});
		expect(listed.map((c) => Number(c.id)).sort((a, b) => a - b)).toEqual(
			[alpha.id, blueprint.id].map(Number).sort((a, b) => a - b),
		);
		expect(listed.every((c) => c.is_favorite === true)).toBe(true);
	});

	it('removeCourse: removes a favorite (also by SIS ID); removing a non-favorite returns an empty object', async () => {
		await asFan.post(`/api/v1/users/self/favorites/courses/${beta.id}`);
		const result = await runNode({
			resource: 'favorite',
			operation: 'removeCourse',
			persona: fan.persona,
			items: [{ course: alpha.id }, { course: `sis_course_id:${beta.sisId}` }, { course: outside.id }],
			params: { courseId: '={{ $json.course }}' },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([
			{ context_id: Number(alpha.id), context_type: 'Course' },
			{ context_id: Number(beta.id), context_type: 'Course' },
			{},
		]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 1 }, { item: 2 }]);
		expect(await chosen()).toEqual([Number(blueprint.id)]);
	});

	it('resetCourses: clears the chosen favorites so the automatic list returns', async () => {
		await asFan.post(`/api/v1/users/self/favorites/courses/${alpha.id}`);
		const [result] = await runOk({ resource: 'favorite', operation: 'resetCourses', persona: fan.persona });
		expect(result).toEqual({ status: 'ok' });
		expect(await chosen()).toEqual([]);
		expect((await favoriteCourseIds()).sort()).toEqual([alpha.id, beta.id, blueprint.id].map(Number).sort());
	});

	it('getAllGroups: without chosen favorites every group of the user is returned', async () => {
		const listed = await runOk({ resource: 'favorite', operation: 'getAllGroups', persona: fan.persona });
		expect(listed.map((g) => Number(g.id)).sort()).toEqual([groupA, groupB].map(Number).sort());
		expect(listed.map((g) => g.id)).toEqual(await favoriteGroupIds());
	});

	it('addGroup / getAllGroups: only chosen groups are listed afterwards', async () => {
		const [favorite] = await runOk({
			resource: 'favorite',
			operation: 'addGroup',
			persona: fan.persona,
			params: { groupId: groupB },
		});
		expect(favorite).toEqual({ context_id: Number(groupB), context_type: 'Group' });
		expect(await favoriteGroupIds()).toEqual([Number(groupB)]);

		const listed = await runOk({ resource: 'favorite', operation: 'getAllGroups', persona: fan.persona });
		expect(listed.map((g) => Number(g.id))).toEqual([Number(groupB)]);
		expect(listed[0]).toMatchObject({ name: 'Fav Group B', course_id: Number(alpha.id) });
	});

	it('addGroup: a group the user is not a member of is accepted by Canvas but never listed', async () => {
		const result = await runNode({
			resource: 'favorite',
			operation: 'addGroup',
			persona: fan.persona,
			items: [{ group: groupA }, { group: foreignGroup }, { group: 999999999 }],
			params: { groupId: '={{ $json.group }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([
			{ context_id: Number(groupA), context_type: 'Group' },
			{ context_id: Number(foreignGroup), context_type: 'Group' },
		]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'addGroup', originalItem: { group: 999999999 } });
		expect((await favoriteGroupIds()).sort()).toEqual([groupA, groupB].map(Number).sort());
	});

	it('removeGroup: removes a favorite group; a non-favorite returns an empty object', async () => {
		const result = await runNode({
			resource: 'favorite',
			operation: 'removeGroup',
			persona: fan.persona,
			items: [{ group: groupA }, { group: groupA }],
			params: { groupId: '={{ $json.group }}', batchProcessing: { mode: 'individual' } },
		});
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([{ context_id: Number(groupA), context_type: 'Group' }, {}]);
		expect(await favoriteGroupIds()).toEqual([Number(groupB)]);
	});

	it('resetGroups: clears the chosen groups', async () => {
		const [result] = await runOk({ resource: 'favorite', operation: 'resetGroups', persona: fan.persona });
		expect(result).toEqual({ status: 'ok' });
		expect((await favoriteGroupIds()).sort()).toEqual([groupA, groupB].map(Number).sort());
	});

	it('errors: an unknown group and an empty course ID are reported per item', async () => {
		const missing = await runNode({
			resource: 'favorite',
			operation: 'removeGroup',
			persona: fan.persona,
			params: { groupId: '999999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'favorite', operation: 'removeGroup' });

		const empty = await runNode({
			resource: 'favorite',
			operation: 'removeCourse',
			persona: fan.persona,
			items: [{ course: null }],
			params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.success).toEqual([]);
		expect(String(empty.error[0].errorMessage)).toContain('A required parameter is empty for favorite/removeCourse');
		// The reset endpoint shares the path without an ID: the favorites must be untouched.
		expect(empty.error[0].errorCode).toBe(0);
	});

	it('getAllCourses / getAllGroups: shared personas (read only) match Canvas', async () => {
		// Other test files enrol the shared personas and add groups while this runs, so each list is
		// compared with what Canvas returns before and after the node run: everything in both must be
		// there, nothing outside either.
		const expectConsistent = (got: number[], before: number[], after: number[], label: string): void => {
			expect(new Set(got).size, label).toBe(got.length);
			for (const id of before.filter((x) => after.includes(x))) expect(got, `${label}: missing ${id}`).toContain(id);
			for (const id of got) expect(before.includes(id) || after.includes(id), `${label}: unexpected ${id}`).toBe(true);
		};
		for (const persona of ['student', 'teacher', 'observer']) {
			const client = new CanvasClient(persona);
			const list = async (kind: string): Promise<number[]> =>
				(await client.get<Json[]>(`/api/v1/users/self/favorites/${kind}`)).map((r) => Number(r.id));

			const coursesBefore = await list('courses');
			const courses = await runOk({
				resource: 'favorite',
				operation: 'getAllCourses',
				persona,
				// The endpoint is not paginated: page size options do not cut the list.
				params: { pagination: { perPage: 5, maxPages: 1 } },
			});
			expectConsistent(courses.map((c) => Number(c.id)), coursesBefore, await list('courses'), `${persona} courses`);
			if (coursesBefore.length > 5) expect(courses.length, persona).toBeGreaterThan(5);

			const groupsBefore = await list('groups');
			const groups = await runOk({ resource: 'favorite', operation: 'getAllGroups', persona });
			expectConsistent(groups.map((g) => Number(g.id)), groupsBefore, await list('groups'), `${persona} groups`);
		}
		// A teacher with more courses than the dashboard holds gets Canvas' selection of 20, not everything.
		const teacherCourses = await new CanvasClient('teacher').get<Json[]>('/api/v1/users/self/favorites/courses');
		const allTeacherCourses = await new CanvasClient('teacher').getAll<Json>('/api/v1/courses');
		expect(allTeacherCourses.length).toBeGreaterThan(20);
		expect(teacherCourses.length).toBeLessThanOrEqual(20);
	});
});
