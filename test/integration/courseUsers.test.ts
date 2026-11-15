import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createUser, deleteUser, WebSession } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * Resource: course — the roster operations (List Users, Get User, List Students,
 * List Recent Students, Get Test Student, List Content Share Users).
 *
 * The large seeded course (more than 250 people in six sections) is used for
 * paging, the main seeded course for variety: custom roles, invited, inactive,
 * concluded and rejected enrollments, several sections, a test student.
 * Expected rosters are derived from the Enrollments API, never from the
 * endpoint under test.
 */
const ids = (records: Json[]): number[] => records.map((r) => Number(r.id)).sort((a, b) => a - b);
const unique_ = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

describe('course: users', () => {
	const large = fx('largeCourseId');
	const main = fx('courseId');
	const testStudentId = Number(fx('testStudentUserId'));

	/** Every enrollment of the main course that is not deleted, straight from the Enrollments API. */
	let enrollments: Json[] = [];
	/** Users with at least one enrollment that passes the filter; the test student only on request. */
	const usersWhere = (filter: (enrollment: Json) => boolean, withTestStudent = false): number[] =>
		unique_(
			enrollments
				.filter((e) => withTestStudent || e.type !== 'StudentViewEnrollment')
				.filter(filter)
				.map((e) => Number(e.user_id)),
		);
	const current = (e: Json): boolean => e.enrollment_state === 'active' || e.enrollment_state === 'invited';

	// Read afresh for every test: other test files may add people to the seeded course while this one runs.
	beforeEach(async () => {
		enrollments = await canvas().getAll<Json>(
			`/api/v1/courses/${main}/enrollments?state[]=active&state[]=invited&state[]=completed&state[]=inactive&state[]=rejected`,
		);
	});

	// ----------------------------------
	//         listUsers: paging
	// ----------------------------------
	it('listUsers: pages through a roster of more than 200 users without losing or repeating anyone', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${large}/users`);
		expect(expected.length, 'the large course should need three pages of 100').toBeGreaterThan(200);

		const defaults = await runOk({ resource: 'course', operation: 'listUsers', params: { courseId: large } });
		expect(defaults).toHaveLength(50);
		expect(new Set(ids(defaults)).size).toBe(50);
		// The roster is sorted by name; the default pages are its first 50 entries.
		expect(defaults.map((u) => u.id)).toEqual(expected.slice(0, 50).map((u) => u.id));

		const all = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: large, pagination: { returnAll: true } },
		});
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(all.length);

		const twoPages = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: large, pagination: { perPage: 7, maxPages: 2 } },
		});
		expect(twoPages.map((u) => u.id)).toEqual(expected.slice(0, 14).map((u) => u.id));
	});

	it('listUsers: without options returns the active and invited users, not the test student', async () => {
		const listed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(usersWhere(current));
		expect(ids(listed)).not.toContain(testStudentId);
		// An admin always gets email addresses and SIS IDs, whatever is included.
		const student = listed.find((u) => u.id === Number(fx('studentUserId'))) as Json;
		expect(student).toMatchObject({
			email: fx('studentLoginId'),
			sis_user_id: fx('studentSisUserId'),
			login_id: fx('studentLoginId'),
		});
		expect(student.enrollments).toBeUndefined();
	});

	// ----------------------------------
	//         listUsers: every filter
	// ----------------------------------
	const TYPES: Array<[string, string]> = [
		['teacher', 'TeacherEnrollment'],
		['ta', 'TaEnrollment'],
		['student', 'StudentEnrollment'],
		['observer', 'ObserverEnrollment'],
		['designer', 'DesignerEnrollment'],
	];
	for (const [value, type] of TYPES) {
		it(`listUsers: enrollment type "${value}" returns exactly the users enrolled as ${type}`, async () => {
			const listed = await runOk({
				resource: 'course',
				operation: 'listUsers',
				params: { courseId: main, options: { enrollment_type: [value] }, pagination: { returnAll: true } },
			});
			const expected = usersWhere((e) => e.type === type && current(e));
			expect(expected.length).toBeGreaterThan(0);
			expect(ids(listed)).toEqual(expected);
		});
	}

	it('listUsers: several enrollment types are combined, "Test Student" returns the test student', async () => {
		const staff = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { enrollment_type: ['teacher', 'ta', 'designer'] }, pagination: { returnAll: true } },
		});
		expect(ids(staff)).toEqual(
			usersWhere((e) => ['TeacherEnrollment', 'TaEnrollment', 'DesignerEnrollment'].includes(String(e.type)) && current(e)),
		);

		const testStudents = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { enrollment_type: ['student_view'] } },
		});
		expect(ids(testStudents)).toEqual([testStudentId]);
	});

	it('listUsers: enrollment role ID filters by built-in and by custom role', async () => {
		for (const roleId of [fx('customRoleId'), fx('customStudentRoleId'), fx('taRoleId')]) {
			const listed = await runOk({
				resource: 'course',
				operation: 'listUsers',
				params: { courseId: main, options: { enrollment_role_id: roleId }, pagination: { returnAll: true } },
			});
			const expected = usersWhere((e) => String(e.role_id) === roleId && current(e));
			expect(expected.length, `role ${roleId} should be used in the main course`).toBeGreaterThan(0);
			expect(ids(listed)).toEqual(expected);
		}
	});

	for (const state of ['active', 'invited', 'completed', 'inactive', 'rejected']) {
		it(`listUsers: enrollment state "${state}" returns exactly the users with such an enrollment`, async () => {
			const listed = await runOk({
				resource: 'course',
				operation: 'listUsers',
				params: { courseId: main, options: { enrollment_state: [state] }, pagination: { returnAll: true } },
			});
			const expected = usersWhere((e) => e.enrollment_state === state);
			expect(expected.length, `the main course should have ${state} enrollments`).toBeGreaterThan(0);
			expect(ids(listed)).toEqual(expected);
		});
	}

	it('listUsers: several enrollment states, and "Include Inactive", widen the roster', async () => {
		const ended = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { enrollment_state: ['completed', 'inactive'] }, pagination: { returnAll: true } },
		});
		expect(ids(ended)).toEqual(usersWhere((e) => e.enrollment_state === 'completed' || e.enrollment_state === 'inactive'));

		const withInactive = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { include_inactive: true }, pagination: { returnAll: true } },
		});
		const expected = usersWhere((e) => current(e) || e.enrollment_state === 'inactive');
		expect(expected.length).toBeGreaterThan(usersWhere(current).length);
		expect(ids(withInactive)).toEqual(expected);
	});

	it('listUsers: section IDs (typed with spaces, or an array from an expression) limit the roster to those sections', async () => {
		const sectionA = fx('sectionId');
		const sectionB = fx('sectionId2');
		const one = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { section_ids: sectionA }, pagination: { returnAll: true } },
		});
		expect(ids(one)).toEqual(usersWhere((e) => String(e.course_section_id) === sectionA && current(e)));

		const both = usersWhere((e) => [sectionA, sectionB].includes(String(e.course_section_id)) && current(e));
		expect(both.length).toBeGreaterThan(one.length);
		const typed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { section_ids: ` ${sectionA} , ${sectionB} ` }, pagination: { returnAll: true } },
		});
		expect(ids(typed)).toEqual(both);

		const fromExpression = await runOk({
			resource: 'course',
			operation: 'listUsers',
			items: [{ sections: [Number(sectionA), Number(sectionB)] }],
			params: { courseId: main, options: { section_ids: '={{ $json.sections }}' }, pagination: { returnAll: true } },
		});
		expect(ids(fromExpression)).toEqual(both);
	});

	it('listUsers: user IDs return only those users; unknown IDs are simply not found', async () => {
		const wanted = [Number(fx('studentUserId')), Number(fx('teacherUserId')), Number(fx('unicodeUserId'))];
		const typed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { user_ids: `${wanted.join(', ')}, 99999999` } },
		});
		expect(ids(typed)).toEqual([...wanted].sort((a, b) => a - b));

		const fromExpression = await runOk({
			resource: 'course',
			operation: 'listUsers',
			items: [{ wanted }],
			params: { courseId: main, options: { user_ids: '={{ $json.wanted }}' } },
		});
		expect(ids(fromExpression)).toEqual([...wanted].sort((a, b) => a - b));

		const single = await runOk({
			resource: 'course',
			operation: 'listUsers',
			items: [{ id: wanted[0] }],
			params: { courseId: main, options: { user_ids: '={{ $json.id }}' } },
		});
		expect(ids(single)).toEqual([wanted[0]]);
	});

	it('listUsers: search term matches names (also non-Latin), logins and exact IDs', async () => {
		const unicodeUser = await canvas().get<Json>(`/api/v1/users/${fx('unicodeUserId')}`);
		const name = String(unicodeUser.name);
		const byName = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { search_term: name } },
		});
		expect(ids(byName)).toContain(Number(fx('unicodeUserId')));
		for (const user of byName) expect(String(user.name)).toContain(name);

		const byLogin = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { search_term: fx('studentLoginId') } },
		});
		expect(ids(byLogin)).toEqual([Number(fx('studentUserId'))]);

		// A search term that is a number finds the user with that ID. Canvas wants two characters:
		// the seeded personas have one-digit IDs on a new database, so a user with a longer one is used.
		const roster = await canvas().getAll<Json>(`/api/v1/courses/${main}/users?enrollment_type[]=student`);
		const longId = roster.map((u) => Number(u.id)).find((id) => id >= 10)!;
		const byId = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { search_term: String(longId) } },
		});
		expect(ids(byId)).toEqual([longId]);

		const tooShort = await runNode({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { search_term: '7' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(tooShort.success).toEqual([]);
		expect(tooShort.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: '2 or more characters is required',
		});

		const nobody = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { search_term: unique('nobody is called') } },
		});
		expect(nobody).toEqual([]);
	});

	it('listUsers: search and filters combine', async () => {
		const family = String((await canvas().get<Json>(`/api/v1/users/${fx('student2UserId')}`)).sortable_name).split(',')[0];
		const all = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: large, options: { search_term: 'an' }, pagination: { returnAll: true } },
		});
		const students = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: {
				courseId: large,
				options: { search_term: 'an', enrollment_type: ['student'], section_ids: fx('largeCourseSectionIds').split(',')[0] },
				pagination: { returnAll: true },
			},
		});
		expect(family.length).toBeGreaterThan(0);
		expect(students.length).toBeGreaterThan(0);
		expect(students.length).toBeLessThan(all.length);
		const sectionStudents = await canvas().getAll<Json>(
			`/api/v1/sections/${fx('largeCourseSectionIds').split(',')[0]}/enrollments?type[]=StudentEnrollment`,
		);
		const inSection = new Set(sectionStudents.map((e) => Number(e.user_id)));
		for (const user of students) {
			expect(inSection.has(Number(user.id)), `${String(user.name)} is a student of the section`).toBe(true);
		}
	});

	it('listUsers: sort orders the roster by email, SIS ID or name', async () => {
		const run = (sort?: string): Promise<Json[]> =>
			runOk({
				resource: 'course',
				operation: 'listUsers',
				params: { courseId: large, options: sort ? { sort } : {}, pagination: { returnAll: true } },
			});
		const byDefault = await run();
		const everyone = ids(byDefault);

		const byEmail = await run('email');
		expect(ids(byEmail)).toEqual(everyone);
		const emails = byEmail.map((u) => String(u.email ?? '')).filter((email) => email !== '');
		expect(emails.length).toBeGreaterThan(200);
		expect(emails).toEqual([...emails].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
		expect(byEmail.map((u) => u.id)).not.toEqual(byDefault.map((u) => u.id));

		const bySis = await run('sis_id');
		expect(ids(bySis)).toEqual(everyone);
		const sisIds = bySis.map((u) => u.sis_user_id).filter((sis): sis is string => typeof sis === 'string');
		expect(sisIds.length).toBeGreaterThan(200);
		expect(sisIds).toEqual([...sisIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));

		const byName = await run('username');
		expect(byName.map((u) => u.id)).toEqual(byDefault.map((u) => u.id));
	});

	it('listUsers: "Page Containing User ID" returns exactly the roster page that holds that user', async () => {
		const roster = await canvas().getAll<Json>(`/api/v1/courses/${large}/users`);
		const index = 173;
		const target = roster[index];
		// Canvas' "next" link of such a page leads back to the same page; the node must not follow it,
		// whatever the pagination options ask for.
		for (const pagination of [{ perPage: 10, maxPages: 3 }, { perPage: 10 }]) {
			const listed = await runOk({
				resource: 'course',
				operation: 'listUsers',
				params: { courseId: large, options: { user_id: String(target.id) }, pagination },
			});
			// Pages of 10: the user at index 173 is on the page that starts at index 170.
			expect(listed.map((u) => u.id)).toEqual(roster.slice(170, 180).map((u) => u.id));
			expect(listed.map((u) => u.id)).toContain(target.id);
		}
		const hundred = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: large, options: { user_id: String(target.id) }, pagination: { returnAll: true } },
		});
		expect(hundred.map((u) => u.id)).toEqual(roster.slice(100, 200).map((u) => u.id));

		// A user who is not on the roster: the first page.
		const unaffected = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: large, options: { user_id: fx('registrarUserId') }, pagination: { perPage: 10, maxPages: 3 } },
		});
		expect(unaffected.map((u) => u.id)).toEqual(roster.slice(0, 10).map((u) => u.id));
	});

	// ----------------------------------
	//         listUsers: includes
	// ----------------------------------
	it('listUsers: every include adds its data', async () => {
		const listed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: {
				courseId: main,
				options: {
					include: [
						'avatar_url',
						'bio',
						'current_grading_period_scores',
						'custom_links',
						'enrollments',
						'group_ids',
						'locked',
						'test_student',
						'uuid',
					],
				},
				pagination: { returnAll: true },
			},
		});
		// "Test Student" adds the test student to the roster.
		expect(ids(listed)).toEqual(unique_([...usersWhere(current), testStudentId]));

		const student = listed.find((u) => u.id === Number(fx('studentUserId'))) as Json;
		const direct = await canvas().get<Json>(`/api/v1/users/${fx('studentUserId')}/profile`);
		expect(student.avatar_url).toBe(direct.avatar_url);
		expect(student.bio).toBe(direct.bio);
		expect(String(student.bio).length).toBeGreaterThan(0);
		expect(student.uuid).toBeTypeOf('string');
		expect(student.custom_links).toBeInstanceOf(Array);

		const groups = await canvas().getAll<Json>(`/api/v1/courses/${main}/groups`);
		const memberOf: number[] = [];
		for (const group of groups) {
			const members = await canvas().getAll<Json>(`/api/v1/groups/${String(group.id)}/memberships?filter_states[]=accepted`);
			if (members.some((m) => m.user_id === student.id)) memberOf.push(Number(group.id));
		}
		expect(memberOf.length).toBeGreaterThan(0);
		expect([...(student.group_ids as number[])].sort((a, b) => a - b)).toEqual(memberOf.sort((a, b) => a - b));

		const own = enrollments.filter((e) => e.user_id === student.id && current(e));
		const listedEnrollments = student.enrollments as Json[];
		expect(listedEnrollments.map((e) => e.id).sort()).toEqual(own.map((e) => e.id).sort());
		for (const enrollment of listedEnrollments) {
			expect(enrollment.locked).toBeTypeOf('boolean');
			expect(enrollment.type).toBe('StudentEnrollment');
			// "Current Grading Period Scores": the grades are those of the current grading period.
			expect((enrollment.grades as Json).grading_period_id).toBe(Number(fx('currentGradingPeriodId')));
		}

		// A student enrolled in several sections is listed once and carries every enrollment.
		const perStudent = new Map<number, number[]>();
		for (const e of enrollments.filter((e) => e.type === 'StudentEnrollment' && current(e))) {
			perStudent.set(Number(e.user_id), [...(perStudent.get(Number(e.user_id)) ?? []), Number(e.id)]);
		}
		const [multiUserId, multiEnrollments] = [...perStudent].find(([, list]) => list.length > 1) ?? [0, []];
		expect(multiEnrollments.length, 'the main course should have a student in two sections').toBeGreaterThan(1);
		const multiUser = listed.filter((u) => u.id === multiUserId);
		expect(multiUser).toHaveLength(1);
		expect((multiUser[0].enrollments as Json[]).map((e) => Number(e.id)).sort((a, b) => a - b)).toEqual(
			multiEnrollments.sort((a, b) => a - b),
		);
	});

	it('listUsers: enrollments follow the enrollment state and type filters', async () => {
		const listed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: {
				courseId: main,
				options: { include: ['enrollments'], enrollment_state: ['invited'], enrollment_type: ['student', 'ta'] },
				pagination: { returnAll: true },
			},
		});
		expect(ids(listed)).toEqual(
			usersWhere((e) => e.enrollment_state === 'invited' && ['StudentEnrollment', 'TaEnrollment'].includes(String(e.type))),
		);
		for (const user of listed) {
			for (const enrollment of user.enrollments as Json[]) {
				expect(enrollment.enrollment_state).toBe('invited');
			}
			// People who have not accepted yet are listed without login details.
			expect(user.login_id).toBeUndefined();
		}
	});

	// ----------------------------------
	//         listUsers: personas, edge cases, errors
	// ----------------------------------
	it('listUsers: a teacher sees the whole roster with email addresses and grades', async () => {
		const expected = await new CanvasClient('teacher').getAll<Json>(`/api/v1/courses/${large}/users?include[]=enrollments`);
		const listed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			persona: 'teacher',
			params: { courseId: large, options: { include: ['enrollments'] }, pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(ids(expected));
		expect(listed.length).toBeGreaterThan(200);
		const students = listed.filter((u) => (u.enrollments as Json[]).some((e) => e.type === 'StudentEnrollment'));
		expect(students.length).toBeGreaterThan(200);
		for (const student of students) {
			// A user without an email address has `email: null`; the property is always there for a teacher.
			expect(student, `email of ${String(student.name)}`).toHaveProperty('email');
			const enrollment = (student.enrollments as Json[]).find((e) => e.type === 'StudentEnrollment') as Json;
			expect(enrollment.grades, `grades of ${String(student.name)}`).toHaveProperty('final_score');
		}
		expect(students.filter((student) => typeof student.email === 'string').length).toBeGreaterThan(200);
	});

	it('listUsers: a student sees classmates, but no email addresses, logins or grades of others', async () => {
		const expected = await new CanvasClient('student').getAll<Json>(`/api/v1/courses/${large}/users`);
		const listed = await runOk({
			resource: 'course',
			operation: 'listUsers',
			persona: 'student',
			params: { courseId: large, options: { include: ['enrollments', 'avatar_url'] }, pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(ids(expected));
		expect(listed.length).toBeGreaterThan(200);
		const self = Number(fx('studentUserId'));
		for (const user of listed) {
			expect(user.avatar_url).toBeTypeOf('string');
			expect(user.login_id).toBeUndefined();
			expect(user.sis_user_id).toBeUndefined();
			if (user.id !== self) {
				expect(user.email, `email of ${String(user.name)}`).toBeUndefined();
				for (const enrollment of user.enrollments as Json[]) {
					// Only the link to the grades page, no scores.
					expect(Object.keys((enrollment.grades ?? {}) as Json), `grades of ${String(user.name)}`).toEqual(
						enrollment.grades ? ['html_url'] : [],
					);
				}
			}
		}
	});

	it('listUsers: accepts a SIS course ID; an empty course yields no items', async () => {
		const bySis = await runOk({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: `sis_course_id:${fx('largeCourseSisId')}`, options: { enrollment_type: ['teacher'] } },
		});
		const teachers = await canvas().getAll<Json>(`/api/v1/courses/${large}/enrollments?type[]=TeacherEnrollment`);
		expect(ids(bySis)).toEqual(unique_(teachers.map((e) => Number(e.user_id))));

		const students = await runNode({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: fx('emptyCourseId'), options: { enrollment_type: ['student'] } },
		});
		expect(students.ok).toBe(true);
		expect(students.success).toEqual([]);
		expect(students.error).toEqual([]);
	});

	it('listUsers: several input items, each with its own roster; a missing course goes to the Error output', async () => {
		const result = await runNode({
			resource: 'course',
			operation: 'listUsers',
			items: [{ course: Number(main) }, { course: 99999999 }, { course: Number(fx('courseId2')) }],
			params: {
				courseId: '={{ $json.course }}',
				options: { enrollment_type: ['teacher'] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.ok).toBe(true);
		const teachersOf = async (course: string): Promise<number[]> =>
			unique_(
				(await canvas().getAll<Json>(`/api/v1/courses/${course}/enrollments?type[]=TeacherEnrollment`)).map((e) => Number(e.user_id)),
			);
		const first = result.rawSuccess.filter((item) => (item.pairedItem as Json).item === 0).map((item) => item.json);
		const third = result.rawSuccess.filter((item) => (item.pairedItem as Json).item === 2).map((item) => item.json);
		expect(ids(first)).toEqual(await teachersOf(main));
		expect(ids(third)).toEqual(await teachersOf(fx('courseId2')));
		expect(first.length + third.length).toBe(result.success.length);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'course',
			operation: 'listUsers',
			originalItem: { course: 99999999 },
		});
	});

	it('listUsers: Canvas\' own validation messages reach the Error output', async () => {
		const tooShort = await runNode({
			resource: 'course',
			operation: 'listUsers',
			params: { courseId: main, options: { search_term: 'a' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(tooShort.success).toEqual([]);
		expect(tooShort.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(tooShort.error[0].errorMessage)).toContain('2 or more characters');
	});

	it('listUsers: an observer may not read the roster', async () => {
		const result = await runNode({
			resource: 'course',
			operation: 'listUsers',
			persona: 'observer',
			params: { courseId: main, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'listUsers' });
	});

	// ----------------------------------
	//         getUser
	// ----------------------------------
	it('getUser: returns one user of the course with every include', async () => {
		const [user] = await runOk({
			resource: 'course',
			operation: 'getUser',
			params: {
				courseId: main,
				userId: fx('studentUserId'),
				options: {
					include: [
						'avatar_url',
						'bio',
						'current_grading_period_scores',
						'custom_links',
						'email',
						'enrollments',
						'inactive_enrollments',
						'locked',
						'uuid',
					],
				},
			},
		});
		const profile = await canvas().get<Json>(`/api/v1/users/${fx('studentUserId')}/profile`);
		expect(user).toMatchObject({
			id: Number(fx('studentUserId')),
			email: fx('studentLoginId'),
			avatar_url: profile.avatar_url,
			bio: profile.bio,
			sis_user_id: fx('studentSisUserId'),
		});
		expect(user.uuid).toBeTypeOf('string');
		expect(user.custom_links).toBeInstanceOf(Array);
		const listed = user.enrollments as Json[];
		expect(listed.map((e) => e.id)).toContain(Number(fx('enrollmentId')));
		for (const enrollment of listed) {
			expect(enrollment.course_id).toBe(Number(main));
			expect(enrollment.locked).toBeTypeOf('boolean');
			expect((enrollment.grades as Json).grading_period_id).toBe(Number(fx('currentGradingPeriodId')));
		}
	});

	it('getUser: without includes there is no email and no enrollment list', async () => {
		const [user] = await runOk({
			resource: 'course',
			operation: 'getUser',
			params: { courseId: main, userId: fx('studentUserId') },
		});
		expect(user.id).toBe(Number(fx('studentUserId')));
		expect(user.email).toBeUndefined();
		expect(user.enrollments).toBeUndefined();
	});

	it('getUser: accepts SIS IDs for course and user, and "self"', async () => {
		const [bySis] = await runOk({
			resource: 'course',
			operation: 'getUser',
			params: { courseId: `sis_course_id:${fx('courseSisId')}`, userId: `sis_user_id:${fx('studentSisUserId')}` },
		});
		expect(bySis.id).toBe(Number(fx('studentUserId')));

		const [self] = await runOk({
			resource: 'course',
			operation: 'getUser',
			persona: 'teacher',
			params: { courseId: main, userId: 'self' },
		});
		expect(self.id).toBe(Number(fx('teacherUserId')));
	});

	it('getUser: a user with an inactive enrollment is only found with "Inactive Enrollments"', async () => {
		const inactive = fx('inactiveStudentUserId');
		const without = await runNode({
			resource: 'course',
			operation: 'getUser',
			params: { courseId: main, userId: inactive, errorHandling: { onError: 'continueWithError' } },
		});
		expect(without.success).toEqual([]);
		expect(without.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getUser' });

		const [found] = await runOk({
			resource: 'course',
			operation: 'getUser',
			params: { courseId: main, userId: inactive, options: { include: ['inactive_enrollments', 'enrollments'] } },
		});
		expect(found.id).toBe(Number(inactive));
		// The user is found; the enrollment list itself only ever holds enrollments that have not ended.
		expect(found.enrollments).toEqual([]);
	});

	it('getUser: a student can look up a classmate but gets no email address', async () => {
		const [classmate] = await runOk({
			resource: 'course',
			operation: 'getUser',
			persona: 'student',
			params: { courseId: main, userId: fx('student2UserId'), options: { include: ['email', 'enrollments'] } },
		});
		expect(classmate.id).toBe(Number(fx('student2UserId')));
		expect(classmate.email).toBeUndefined();
		expect((classmate.enrollments as Json[]).length).toBeGreaterThan(0);
		for (const enrollment of classmate.enrollments as Json[]) {
			// Only the link to the grades page, no scores.
			expect(Object.keys((enrollment.grades ?? {}) as Json)).toEqual(enrollment.grades ? ['html_url'] : []);
		}
	});

	it('getUser: several items with numeric IDs from an expression; someone who is not in the course is a 404', async () => {
		const outsider = Number(fx('registrarUserId'));
		expect(enrollments.some((e) => e.user_id === outsider), 'the registrar is not enrolled in the main course').toBe(false);
		const result = await runNode({
			resource: 'course',
			operation: 'getUser',
			items: [{ id: Number(fx('studentUserId')) }, { id: outsider }, { id: Number(fx('teacherUserId')) }],
			params: { courseId: main, userId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((u) => u.id)).toEqual([Number(fx('studentUserId')), Number(fx('teacherUserId'))]);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			originalItem: { id: outsider },
		});
	});

	// ----------------------------------
	//         listStudents
	// ----------------------------------
	it('listStudents: lists every student once, also students with several enrollments, whatever the pagination says', async () => {
		const expected = usersWhere((e) => e.type === 'StudentEnrollment' && current(e));
		const multiple = enrollments.filter((e) => e.type === 'StudentEnrollment' && current(e)).length;
		expect(multiple, 'the main course should have students with more than one enrollment').toBeGreaterThan(expected.length);

		const students = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: { courseId: main, pagination: { perPage: 5, maxPages: 1 } },
		});
		expect(students.map((s) => Number(s.id)).sort((a, b) => a - b)).toEqual(expected);
		expect(ids(students)).not.toContain(testStudentId);
	});

	it('listStudents: every option takes effect', async () => {
		const completed = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: { courseId: main, options: { enrollment_state: ['completed', 'inactive'] } },
		});
		expect(ids(completed)).toEqual(
			usersWhere((e) => e.type === 'StudentEnrollment' && (e.enrollment_state === 'completed' || e.enrollment_state === 'inactive')),
		);

		const withIncludes = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: {
				courseId: main,
				options: { include: ['avatar_url', 'bio', 'enrollments', 'group_ids', 'locale', 'test_student', 'uuid'], sort: 'email' },
			},
		});
		// "Test Student" adds the test student to the students.
		expect(ids(withIncludes)).toEqual(
			unique_([...usersWhere((e) => e.type === 'StudentEnrollment' && current(e)), testStudentId]),
		);
		// Sorted by email the way the database collates (case and punctuation do not count).
		const key = (email: unknown): string => String(email ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
		const emails = withIncludes.map((u) => key(u.email)).filter((email) => email !== '');
		expect(emails.length).toBeGreaterThan(50);
		expect(emails).toEqual([...emails].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
		const student = withIncludes.find((u) => u.id === Number(fx('studentUserId'))) as Json;
		expect(student.avatar_url).toBeTypeOf('string');
		expect(String(student.bio).length).toBeGreaterThan(0);
		expect(student.uuid).toBeTypeOf('string');
		expect(student.group_ids).toBeInstanceOf(Array);
		expect(student).toHaveProperty('locale');
		for (const enrollment of student.enrollments as Json[]) {
			expect(enrollment.type).toBe('StudentEnrollment');
		}

		const searched = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: { courseId: main, options: { search_term: fx('studentLoginId') } },
		});
		expect(ids(searched)).toEqual([Number(fx('studentUserId'))]);

		// The teacher is in the course but is not a student.
		const picked = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: {
				courseId: main,
				options: { user_ids: `${fx('studentUserId')},${fx('student2UserId')},${fx('teacherUserId')}` },
			},
		});
		expect(ids(picked)).toEqual([Number(fx('studentUserId')), Number(fx('student2UserId'))].sort((a, b) => a - b));
	});

	it('listStudents: a workflow saved with the former "Last Login" sort keeps working', async () => {
		const students = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: { courseId: fx('courseId2'), options: { sort: 'last_login' } },
		});
		const expected = await canvas().getAll<Json>(
			`/api/v1/courses/${fx('courseId2')}/enrollments?type[]=StudentEnrollment&state[]=active&state[]=invited`,
		);
		expect(expected.length).toBeGreaterThan(0);
		expect(ids(students)).toEqual(unique_(expected.map((e) => Number(e.user_id))));
	});

	it('listStudents: as a student, and refused for an observer', async () => {
		const expected = await new CanvasClient('student').getAll<Json>(`/api/v1/courses/${large}/users?enrollment_type[]=student`);
		const students = await runOk({ resource: 'course', operation: 'listStudents', persona: 'student', params: { courseId: large } });
		expect(ids(students)).toEqual(ids(expected));
		expect(students.length).toBeGreaterThan(200);

		const refused = await runNode({
			resource: 'course',
			operation: 'listStudents',
			persona: 'observer',
			params: { courseId: main, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
	});

	// ----------------------------------
	//         listContentShareUsers
	// ----------------------------------
	it('listContentShareUsers: finds teachers and admins by name or email, paged', async () => {
		const teacher = await canvas().get<Json>(`/api/v1/users/${fx('teacherUserId')}`);
		const byName = await runOk({
			resource: 'course',
			operation: 'listContentShareUsers',
			params: { courseId: main, searchTerm: String(teacher.name) },
		});
		expect(ids(byName)).toContain(Number(fx('teacherUserId')));
		expect(byName[0]).toHaveProperty('avatar_url');

		// Students are never offered, whatever the search term.
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${main}/content_share_users?search_term=example`);
		expect(expected.length, 'enough share users to need more than one page').toBeGreaterThan(10);
		const all = await runOk({
			resource: 'course',
			operation: 'listContentShareUsers',
			params: { courseId: main, searchTerm: 'example', pagination: { returnAll: true } },
		});
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(all.length);
		expect(ids(all)).not.toContain(Number(fx('studentUserId')));
		expect(ids(all)).toContain(Number(fx('teacherUserId')));

		const firstPages = await runOk({
			resource: 'course',
			operation: 'listContentShareUsers',
			params: { courseId: main, searchTerm: 'example', pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(firstPages.map((u) => u.id)).toEqual(expected.slice(0, 6).map((u) => u.id));

		const nobody = await runOk({
			resource: 'course',
			operation: 'listContentShareUsers',
			params: { courseId: main, searchTerm: unique('no such person') },
		});
		expect(nobody).toEqual([]);
	});

	it('listContentShareUsers: a teacher may search, a student may not', async () => {
		const asTeacher = await runOk({
			resource: 'course',
			operation: 'listContentShareUsers',
			persona: 'teacher',
			params: { courseId: main, searchTerm: 'persona' },
		});
		const expected = await new CanvasClient('teacher').getAll<Json>(`/api/v1/courses/${main}/content_share_users?search_term=persona`);
		expect(ids(asTeacher)).toEqual(ids(expected));
		expect(asTeacher.length).toBeGreaterThan(0);

		const refused = await runNode({
			resource: 'course',
			operation: 'listContentShareUsers',
			persona: 'student',
			params: { courseId: main, searchTerm: 'persona', errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'listContentShareUsers' });
	});

	// ----------------------------------
	//         listRecentStudents, getTestStudent (a course of the file's own)
	// ----------------------------------
	describe('in a course of its own', () => {
		let courseId = '';
		const students: OwnUser[] = [];

		beforeAll(async () => {
			const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
				course: { name: unique('Roster battery course') },
				offer: true,
			});
			courseId = String(course.id);
			for (const label of ['Early Login', 'Late Login', 'Never Login']) {
				const user = await createUser(`Roster ${label}`);
				students.push(user);
				await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
					enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
				});
			}
			await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: { user_id: fx('teacherUserId'), type: 'TeacherEnrollment', enrollment_state: 'active', notify: false },
			});
			await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: { user_id: fx('studentUserId'), type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
			});
			// Two of the three log in to the web interface, one after the other.
			await new WebSession().login(students[0].login, students[0].password);
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await new WebSession().login(students[1].login, students[1].password);
		});

		afterAll(async () => {
			if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
			for (const user of students) await deleteUser(user);
		});

		it('listRecentStudents: orders students by their last login, most recent first, never logged in last', async () => {
			const listed = await runOk({ resource: 'course', operation: 'listRecentStudents', params: { courseId } });
			const own = listed.filter((u) => students.some((s) => s.id === String(u.id)));
			expect(own.map((u) => String(u.id))).toEqual([students[1].id, students[0].id, students[2].id]);
			const [late, early, never] = own;
			expect(Date.parse(String(late.last_login))).toBeGreaterThan(Date.parse(String(early.last_login)));
			expect(Date.now() - Date.parse(String(late.last_login))).toBeLessThan(10 * 60_000);
			expect(never.last_login).toBeNull();
			// Only students are listed.
			expect(ids(listed)).toEqual(
				[...students.map((s) => Number(s.id)), Number(fx('studentUserId'))].sort((a, b) => a - b),
			);

			const asTeacher = await runOk({ resource: 'course', operation: 'listRecentStudents', persona: 'teacher', params: { courseId } });
			expect(asTeacher.map((u) => u.id)).toEqual(listed.map((u) => u.id));
		});

		it('listRecentStudents: a student may not see who logged in', async () => {
			const refused = await runNode({
				resource: 'course',
				operation: 'listRecentStudents',
				persona: 'student',
				params: { courseId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'listRecentStudents' });
		});

		it('getTestStudent: creates the test student of a course that has none, and returns the same one afterwards', async () => {
			const testStudents = (): Promise<Json[]> =>
				canvas().getAll<Json>(`/api/v1/courses/${courseId}/users?enrollment_type[]=student_view`);
			expect(await testStudents()).toEqual([]);

			const [created] = await runOk({ resource: 'course', operation: 'getTestStudent', params: { courseId } });
			expect(created.id).toBeTypeOf('number');
			expect(created.name).toBe('Test Student');
			expect(ids(await testStudents())).toEqual([Number(created.id)]);

			const [again] = await runOk({ resource: 'course', operation: 'getTestStudent', persona: 'teacher', params: { courseId } });
			expect(again.id).toBe(created.id);
			expect(ids(await testStudents())).toEqual([Number(created.id)]);

			// The test student is not a "real" student: the roster and the recent students leave it out.
			const recent = await runOk({ resource: 'course', operation: 'listRecentStudents', params: { courseId } });
			expect(ids(recent)).not.toContain(Number(created.id));
		});

		it('getTestStudent: a student may not use the student view', async () => {
			const refused = await runNode({
				resource: 'course',
				operation: 'getTestStudent',
				persona: 'student',
				params: { courseId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getTestStudent' });
			const testStudents = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/users?enrollment_type[]=student_view`);
			expect(testStudents).toHaveLength(1);
		});
	});

	it('getTestStudent: returns the existing test student of a seeded course', async () => {
		const [testStudent] = await runOk({ resource: 'course', operation: 'getTestStudent', params: { courseId: main } });
		expect(testStudent.id).toBe(testStudentId);
	});

	it('listRecentStudents: pages through the students of the large course without repeating anyone', async () => {
		// Everyone who is or was a student: also inactive and concluded enrollments.
		const students = await canvas().getAll<Json>(
			`/api/v1/courses/${large}/enrollments?type[]=StudentEnrollment&state[]=active&state[]=invited&state[]=completed&state[]=inactive&state[]=rejected`,
		);
		const everyStudent = unique_(students.map((e) => Number(e.user_id)));
		expect(everyStudent.length).toBeGreaterThan(200);

		// Nobody in this course ever logged in, so the whole list is one big tie. Canvas orders such
		// ties differently from page to page: pages of 10 repeat some students (and skip others).
		const direct: number[] = [];
		for (let page = 1; page <= 5; page++) {
			const res = await canvas().get<Json[]>(`/api/v1/courses/${large}/recent_students?per_page=10&page=${page}`);
			direct.push(...res.map((u) => Number(u.id)));
		}
		expect(direct).toHaveLength(50);

		// The node never outputs a student twice.
		const defaults = await runOk({ resource: 'course', operation: 'listRecentStudents', params: { courseId: large } });
		expect(new Set(ids(defaults)).size).toBe(defaults.length);
		expect(defaults.length).toBeGreaterThan(40);
		expect(defaults.length).toBeLessThanOrEqual(50);
		for (const student of defaults) {
			expect(everyStudent).toContain(student.id);
			expect(student).toHaveProperty('last_login');
		}

		// Pages of 100 keep the ties together: the list is complete.
		const all = await runOk({
			resource: 'course',
			operation: 'listRecentStudents',
			params: { courseId: large, pagination: { returnAll: true } },
		});
		expect(new Set(ids(all)).size).toBe(all.length);
		expect(ids(all)).toEqual(everyStudent);

		const some = await runOk({
			resource: 'course',
			operation: 'listRecentStudents',
			params: { courseId: large, pagination: { perPage: 4, maxPages: 3 } },
		});
		expect(new Set(ids(some)).size).toBe(some.length);
		expect(some.length).toBeGreaterThan(8);
		expect(some.length).toBeLessThanOrEqual(12);
	});
});
