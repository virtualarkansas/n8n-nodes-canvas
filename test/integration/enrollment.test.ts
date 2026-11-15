import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: enrollment. Enrollments are only created, changed and removed in a
 * course made by this file, for users made by this file. Seeded courses and
 * users are read, never changed. Writes are verified by reading the enrollment
 * back from Canvas directly.
 *
 * Sent but without a way to read them back through the Canvas API (stated, not
 * silently assumed): "Notify" and "Self Enrolled". The happy path of "Self
 * Enrollment Code" is not run because it would enroll one of the shared personas;
 * only Canvas' refusals are exercised.
 */
describe('enrollment', () => {
	const account = fx('accountId');
	let courseId = '';
	let sectionId = '';
	const users: string[] = [];
	let studentEnrollmentId = '';

	const getEnrollment = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/accounts/${account}/enrollments/${id}`);
	const courseEnrollments = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/enrollments?${query}`);
	const ids = (items: Json[]): number[] => items.map((e) => Number(e.id));
	const sorted = (values: number[]): number[] => [...values].sort((a, b) => a - b);

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
			course: { name: unique('Enrollment battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const section = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, {
			course_section: { name: unique('Enrollment battery section'), sis_section_id: unique('ENR-SEC').replace(/\s/g, '_') },
		});
		sectionId = String(section.id);
		for (let i = 1; i <= 7; i++) {
			const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
				user: { name: `${unique('Enrollment Battery User')} ${i}`, skip_registration: true },
				pseudonym: { unique_id: `${unique('enr').replace(/\s/g, '.')}@example.edu`, send_confirmation: false },
			});
			users.push(String(user.id));
		}
	});

	afterAll(async () => {
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		for (const id of users) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
	});

	it('create: every optional field reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'enrollment',
			operation: 'create',
			params: {
				courseId,
				userId: users[0],
				enrollmentType: 'StudentEnrollment',
				additionalFields: {
					courseSectionId: sectionId,
					endAt: '2030-06-30T23:59:00Z',
					enrollmentState: 'active',
					limitPrivilegesToCourseSection: true,
					notify: false,
					roleId: fx('customStudentRoleId'),
					selfEnrolled: true,
					startAt: '2026-01-10T08:00:00Z',
				},
			},
		});
		studentEnrollmentId = String(created.id);
		expect(await getEnrollment(studentEnrollmentId)).toMatchObject({
			user_id: Number(users[0]),
			course_id: Number(courseId),
			type: 'StudentEnrollment',
			role_id: Number(fx('customStudentRoleId')),
			enrollment_state: 'active',
			course_section_id: Number(sectionId),
			limit_privileges_to_course_section: true,
			start_at: '2026-01-10T08:00:00Z',
			end_at: '2030-06-30T23:59:00Z',
		});
	});

	it('create: every enrollment type; without a state Canvas invites the user into the default section', async () => {
		const types = ['DesignerEnrollment', 'TaEnrollment', 'TeacherEnrollment', 'StudentEnrollment'];
		const result = await runNode({
			resource: 'enrollment',
			operation: 'create',
			items: types.map((type, index) => ({ user: Number(users[index + 1]), type })),
			params: { courseId: Number(courseId), userId: '={{ $json.user }}', enrollmentType: '={{ $json.type }}' },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success.map((e) => e.type)).toEqual(types);
		for (const [index, enrollment] of result.success.entries()) {
			const actual = await getEnrollment(String(enrollment.id));
			expect(actual).toMatchObject({ user_id: Number(users[index + 1]), type: types[index], enrollment_state: 'invited' });
			expect(actual.course_section_id).not.toBe(Number(sectionId));
		}
	});

	it('create: an observer linked to a student, and an inactive enrollment', async () => {
		const [observer] = await runOk({
			resource: 'enrollment',
			operation: 'create',
			params: {
				courseId,
				userId: users[5],
				enrollmentType: 'ObserverEnrollment',
				additionalFields: { associatedUserId: users[0], enrollmentState: 'active' },
			},
		});
		expect(await getEnrollment(String(observer.id))).toMatchObject({
			type: 'ObserverEnrollment',
			associated_user_id: Number(users[0]),
			enrollment_state: 'active',
		});

		const [inactive] = await runOk({
			resource: 'enrollment',
			operation: 'create',
			params: { courseId, userId: users[6], enrollmentType: 'StudentEnrollment', additionalFields: { enrollmentState: 'inactive' } },
		});
		expect((await getEnrollment(String(inactive.id))).enrollment_state).toBe('inactive');
	});

	it('create: Canvas\' refusals are reported and nothing is created', async () => {
		const before = sorted(ids(await courseEnrollments('state[]=active&state[]=invited&state[]=inactive')));
		const cases: Array<[Json, string | undefined, number[], RegExp | undefined]> = [
			[{ userId: users[6], enrollmentType: 'TeacherEnrollment', additionalFields: { roleId: fx('studentRoleId') } }, undefined, [400], /must match the base type/],
			[{ userId: '99999999', enrollmentType: 'StudentEnrollment' }, undefined, [404], undefined],
			[{ userId: 'self', enrollmentType: 'StudentEnrollment', additionalFields: { selfEnrollmentCode: 'NOTACODE' } }, undefined, [400], /self_enrollment_code\] is invalid/],
			[{ userId: users[6], enrollmentType: 'StudentEnrollment', additionalFields: { selfEnrollmentCode: 'NOTACODE' } }, undefined, [400], /must be 'self'/],
			[{ userId: users[6], enrollmentType: 'TeacherEnrollment' }, 'teacher', [401, 403], undefined],
		];
		for (const [params, persona, codes, message] of cases) {
			const result = await runNode({
				resource: 'enrollment',
				operation: 'create',
				persona,
				params: { courseId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, JSON.stringify(params)).toEqual([]);
			expect(result.error).toHaveLength(1);
			expect(codes, JSON.stringify(params)).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'enrollment', operation: 'create' });
			if (message) expect(String(result.error[0].errorMessage)).toMatch(message);
		}
		expect(sorted(ids(await courseEnrollments('state[]=active&state[]=invited&state[]=inactive')))).toEqual(before);
	});

	it('get: by ID through the root account, also for IDs from expressions', async () => {
		const [enrollment] = await runOk({ resource: 'enrollment', operation: 'get', params: { accountId: 'self', enrollmentId: studentEnrollmentId } });
		expect(enrollment).toMatchObject({ id: Number(studentEnrollmentId), user_id: Number(users[0]), course_section_id: Number(sectionId) });

		const result = await runNode({
			resource: 'enrollment',
			operation: 'get',
			items: [{ id: Number(fx('enrollmentId')) }, { id: 99999999 }, { id: Number(fx('deletedEnrollmentId')) }],
			params: { accountId: account, enrollmentId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		// Canvas returns a deleted enrollment as well, marked as deleted.
		expect(result.success.map((e) => [e.id, e.enrollment_state])).toEqual([
			[Number(fx('enrollmentId')), 'active'],
			[Number(fx('deletedEnrollmentId')), 'deleted'],
		]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'enrollment', operation: 'get' });

		// An account the course does not belong to.
		const elsewhere = await runNode({
			resource: 'enrollment',
			operation: 'get',
			params: { accountId: fx('secondSubAccountId'), enrollmentId: studentEnrollmentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(elsewhere.success).toEqual([]);
		expect(elsewhere.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('getAll: by course, with state, type, role, role ID and user filters', async () => {
		const check = async (filters: Json, query: string): Promise<Json[]> => {
			const expected = await courseEnrollments(query);
			const listed = await runOk({ resource: 'enrollment', operation: 'getAll', params: { listBy: 'course', courseId, filters, pagination: { returnAll: true } } });
			expect(ids(listed), JSON.stringify(filters)).toEqual(ids(expected));
			return listed;
		};

		const defaults = await check({}, '');
		expect(defaults.length).toBeGreaterThanOrEqual(6);

		const inactive = await check({ state: ['inactive'] }, 'state[]=inactive');
		expect(inactive.map((e) => e.user_id)).toEqual([Number(users[6])]);

		const staff = await check({ type: ['TeacherEnrollment', 'TaEnrollment'] }, 'type[]=TeacherEnrollment&type[]=TaEnrollment');
		expect(staff.map((e) => e.type).sort()).toEqual(['TaEnrollment', 'TeacherEnrollment']);

		const designers = await check({ role: ['DesignerEnrollment'] }, 'role[]=DesignerEnrollment');
		expect(designers.map((e) => e.user_id)).toEqual([Number(users[1])]);

		const custom = await check({ roleIds: ` ${fx('customStudentRoleId')} , ${fx('taRoleId')} ` }, `role_id[]=${fx('customStudentRoleId')}&role_id[]=${fx('taRoleId')}`);
		expect(sorted(custom.map((e) => Number(e.user_id)))).toEqual(sorted([Number(users[0]), Number(users[2])]));

		const oneUser = await check({ userId: users[5], include: ['observed_users', 'can_be_removed', 'avatar_url', 'uuid'] }, `user_id=${users[5]}`);
		expect(oneUser).toHaveLength(1);
		expect(oneUser[0].observed_user).toMatchObject({ id: Number(users[0]) });
		expect(oneUser[0]).toHaveProperty('can_be_removed');
		expect(oneUser[0].user).toHaveProperty('avatar_url');

		// Filters that were added but left empty must not narrow anything.
		const blank = await check({ userId: '', state: [], sisUserIds: '', roleIds: '' }, '');
		expect(ids(blank)).toEqual(ids(defaults));
	});

	it('getAll: by section and by user', async () => {
		const expectedSection = await canvas().getAll<Json>(`/api/v1/sections/${sectionId}/enrollments`);
		const bySection = await runOk({ resource: 'enrollment', operation: 'getAll', params: { listBy: 'section', sectionId } });
		expect(ids(bySection)).toEqual(ids(expectedSection));
		expect(ids(bySection)).toEqual([Number(studentEnrollmentId)]);

		const byUser = await runOk({
			resource: 'enrollment',
			operation: 'getAll',
			params: { listBy: 'user', userId: users[0], filters: { enrollmentTermId: fx('defaultTermId') } },
		});
		expect(ids(byUser)).toEqual([Number(studentEnrollmentId)]);

		const otherTerm = await runNode({
			resource: 'enrollment',
			operation: 'getAll',
			params: { listBy: 'user', userId: users[0], filters: { enrollmentTermId: fx('pastTermId') } },
		});
		expect(otherTerm.ok).toBe(true);
		expect(otherTerm.success).toEqual([]);
		expect(otherTerm.error).toEqual([]);
	});

	it('getAll: pages through the enrollments of the large seeded course exactly as Canvas serves them (read-only)', async () => {
		const large = fx('largeCourseId');
		const path = `/api/v1/courses/${large}/enrollments?type[]=StudentEnrollment`;
		const expected = await canvas().getAll<Json>(path);
		expect(expected.length).toBeGreaterThan(100);
		const params = { listBy: 'course', courseId: large, filters: { type: ['StudentEnrollment'] } };

		const all = await runOk({ resource: 'enrollment', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(all.length);

		const defaults = await runOk({ resource: 'enrollment', operation: 'getAll', params });
		expect(ids(defaults)).toEqual(ids(expected).slice(0, 50));

		const small = await runOk({ resource: 'enrollment', operation: 'getAll', params: { ...params, pagination: { perPage: 7, maxPages: 3 } } });
		expect(ids(small)).toEqual(ids(expected).slice(0, 21));
	});

	it('getAll: SIS ID filters and states of the seeded main course match Canvas (read-only)', async () => {
		const main = fx('courseId');
		const compare = async (listBy: Json, filters: Json, path: string): Promise<number> => {
			const expected = await canvas().getAll<Json>(path);
			const listed = await runOk({ resource: 'enrollment', operation: 'getAll', params: { ...listBy, filters, pagination: { returnAll: true } } });
			expect(sorted(ids(listed)), path).toEqual(sorted(ids(expected)));
			return expected.length;
		};
		const everything = (await canvas().getAll<Json>(`/api/v1/courses/${main}/enrollments`)).length;

		const bySisUser = await compare({ listBy: 'course', courseId: main }, { sisUserIds: fx('studentSisUserId') }, `/api/v1/courses/${main}/enrollments?sis_user_id[]=${encodeURIComponent(fx('studentSisUserId'))}`);
		expect(bySisUser).toBeGreaterThan(0);
		expect(bySisUser).toBeLessThan(everything);

		const bySisSection = await compare({ listBy: 'course', courseId: main }, { sisSectionIds: fx('sectionSisId') }, `/api/v1/courses/${main}/enrollments?sis_section_id[]=${encodeURIComponent(fx('sectionSisId'))}`);
		expect(bySisSection).toBeGreaterThan(0);
		expect(bySisSection).toBeLessThan(everything);

		const student = fx('studentUserId');
		const ofStudent = (await canvas().getAll<Json>(`/api/v1/users/${student}/enrollments`)).length;
		const bySisCourse = await compare({ listBy: 'user', userId: student }, { sisCourseIds: `${fx('courseSisId')}, NO-SUCH-COURSE` }, `/api/v1/users/${student}/enrollments?sis_course_id[]=${encodeURIComponent(fx('courseSisId'))}&sis_course_id[]=NO-SUCH-COURSE`);
		expect(bySisCourse).toBeGreaterThan(0);
		expect(bySisCourse).toBeLessThanOrEqual(ofStudent);

		await compare({ listBy: 'user', userId: student }, { sisAccountIds: fx('subAccountSisId') }, `/api/v1/users/${student}/enrollments?sis_account_id[]=${encodeURIComponent(fx('subAccountSisId'))}`);

		for (const state of ['invited', 'inactive', 'completed', 'deleted']) {
			const count = await compare({ listBy: 'course', courseId: main }, { state: [state] }, `/api/v1/courses/${main}/enrollments?state[]=${state}`);
			expect(count, state).toBeGreaterThan(0);
		}
	});

	it('getAll: the combined states work for the current user; an invalid grading period is refused', async () => {
		// ("current_future_and_restricted" is documented by Canvas too, but this Canvas version
		// answers it with a server error, so the node does not offer it.)
		for (const state of ['current_and_invited', 'current_and_future', 'current_and_concluded']) {
			const result = await runNode({
				resource: 'enrollment',
				operation: 'getAll',
				persona: 'student',
				params: { listBy: 'user', userId: 'self', filters: { state: [state] }, pagination: { returnAll: true } },
			});
			expect(result.ok, state).toBe(true);
			expect(result.error, state).toEqual([]);
			expect(result.success.length, state).toBeGreaterThan(0);
			expect(result.success.every((e) => e.user_id === Number(fx('studentUserId')))).toBe(true);
		}

		const invalid = await runNode({
			resource: 'enrollment',
			operation: 'getAll',
			params: { listBy: 'course', courseId, filters: { gradingPeriodId: '99999999' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollment', operation: 'getAll' });
		expect(String(invalid.error[0].errorMessage)).toContain('invalid grading_period_id');

		const forbidden = await runNode({
			resource: 'enrollment',
			operation: 'getAll',
			persona: 'student',
			params: { listBy: 'course', courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403]).toContain(forbidden.error[0].errorCode);
	});

	it('deactivate, reactivate, conclude: change the state of an enrollment', async () => {
		const [deactivated] = await runOk({ resource: 'enrollment', operation: 'deactivate', params: { courseId, enrollmentId: studentEnrollmentId } });
		expect(deactivated.enrollment_state).toBe('inactive');
		expect((await getEnrollment(studentEnrollmentId)).enrollment_state).toBe('inactive');

		const [reactivated] = await runOk({ resource: 'enrollment', operation: 'reactivate', params: { courseId, enrollmentId: Number(studentEnrollmentId) } });
		expect(reactivated.enrollment_state).toBe('active');
		expect((await getEnrollment(studentEnrollmentId)).enrollment_state).toBe('active');

		const again = await runNode({
			resource: 'enrollment',
			operation: 'reactivate',
			params: { courseId, enrollmentId: studentEnrollmentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollment', operation: 'reactivate' });
		expect(String(again.error[0].errorMessage)).toContain('enrollment not inactive');

		const [concluded] = await runOk({ resource: 'enrollment', operation: 'conclude', params: { courseId, enrollmentId: studentEnrollmentId } });
		expect(concluded.enrollment_state).toBe('completed');
		expect((await getEnrollment(studentEnrollmentId)).enrollment_state).toBe('completed');
	});

	it('setLastAttended: stores the date on the student\'s enrollment', async () => {
		const [result] = await runOk({
			resource: 'enrollment',
			operation: 'setLastAttended',
			params: { courseId, userId: users[0], date: '2026-03-04T10:00:00Z' },
		});
		expect(result).toEqual({ date: '2026-03-04T10:00:00Z' });
		expect((await getEnrollment(studentEnrollmentId)).last_attended_at).toBe('2026-03-04T10:00:00Z');

		const invalid = await runNode({
			resource: 'enrollment',
			operation: 'setLastAttended',
			params: { courseId, userId: users[0], date: '={{ "not a date" }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollment', operation: 'setLastAttended' });
		expect((await getEnrollment(studentEnrollmentId)).last_attended_at).toBe('2026-03-04T10:00:00Z');
	});

	it('delete: removes enrollments, for several input items', async () => {
		const targets = await courseEnrollments('type[]=TeacherEnrollment&type[]=TaEnrollment');
		expect(targets).toHaveLength(2);
		const result = await runNode({
			resource: 'enrollment',
			operation: 'delete',
			items: [{ id: targets[0].id }, { id: 99999999 }, { id: targets[1].id }],
			params: { courseId, enrollmentId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((e) => [e.id, e.enrollment_state])).toEqual([[targets[0].id, 'deleted'], [targets[1].id, 'deleted']]);
		expect(result.rawSuccess.map((e) => (e.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'enrollment', operation: 'delete' });

		expect(await courseEnrollments('type[]=TeacherEnrollment&type[]=TaEnrollment')).toEqual([]);
		for (const target of targets) {
			expect((await getEnrollment(String(target.id))).enrollment_state).toBe('deleted');
		}
	});

	it('errors: a student may not change enrollments of a course they are not in', async () => {
		const [target] = await courseEnrollments('type[]=DesignerEnrollment');
		for (const operation of ['conclude', 'deactivate', 'delete']) {
			const result = await runNode({
				resource: 'enrollment',
				operation,
				persona: 'student',
				params: { courseId, enrollmentId: String(target.id), errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error).toHaveLength(1);
			expect([401, 403, 404], operation).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'enrollment', operation });
		}
		expect((await getEnrollment(String(target.id))).enrollment_state).toBe('invited');
	});
});
