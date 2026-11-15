import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ownPersona, removePersonas, waitForProgress } from './support/ownPersonas';
import type { OwnPersona } from './support/ownPersonas';

/**
 * Resource: enrollment — accepting and rejecting course invitations, and bulk
 * enrollment. Everything happens in a sub-account, courses and users created by
 * this file. Invitations can only be answered by the invited user, so two of the
 * users have an API token and an n8n credential of their own.
 */
describe('enrollment: invitations and bulk enrollment', () => {
	const root = fx('accountId');
	let subAccountId = '';
	/** Published courses in the sub-account; the first two also have SIS IDs. */
	const courses: string[] = [];
	const courseSisIds: string[] = [];
	let outsideCourseId = '';
	let invitee: OwnPersona;
	let bystander: OwnPersona;
	/** Users without tokens, for bulk enrollment; the first has an SIS ID. */
	const users: string[] = [];
	const userSisId = unique('SIS-BULK').replace(/\s/g, '_');

	const refuse = { errorHandling: { onError: 'continueWithError' } };
	const getEnrollment = (id: unknown): Promise<Json> => canvas().get<Json>(`/api/v1/accounts/${root}/enrollments/${String(id)}`);
	const enrollmentsOf = (courseId: string): Promise<Json[]> =>
		canvas().getAll<Json>(
			`/api/v1/courses/${courseId}/enrollments?state[]=active&state[]=invited&state[]=creation_pending&state[]=rejected`,
		);
	const invite = async (courseId: string, userId: string, type = 'StudentEnrollment', state?: string): Promise<Json> =>
		canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: userId, type, ...(state ? { enrollment_state: state } : {}) },
		});

	beforeAll(async () => {
		const sub = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: unique('Invitation battery sub-account') },
		});
		subAccountId = String(sub.id);
		for (let i = 1; i <= 4; i++) {
			const sisId = i <= 2 ? unique('SIS-INV-C').replace(/\s/g, '_') : undefined;
			const course = await canvas().post<Json>(`/api/v1/accounts/${subAccountId}/courses`, {
				course: { name: `${unique('Invitation battery course')} ${i}`, ...(sisId ? { sis_course_id: sisId } : {}) },
				offer: true,
			});
			courses.push(String(course.id));
			if (sisId) courseSisIds.push(sisId);
		}
		const outside = await canvas().post<Json>(`/api/v1/accounts/${root}/courses`, {
			course: { name: unique('Invitation battery course outside the sub-account') },
			offer: true,
		});
		outsideCourseId = String(outside.id);

		invitee = await ownPersona('Invited User');
		bystander = await ownPersona('Invitation Bystander');
		for (let i = 1; i <= 6; i++) {
			const user = await canvas().post<Json>(`/api/v1/accounts/${root}/users`, {
				user: { name: `${unique('Bulk Enrolled User')} ${i}`, skip_registration: true },
				pseudonym: {
					unique_id: `${unique('bulk').replace(/\s/g, '.')}@example.edu`,
					send_confirmation: false,
					...(i === 1 ? { sis_user_id: userSisId } : {}),
				},
			});
			users.push(String(user.id));
		}
	}, 360_000);

	afterAll(async () => {
		for (const id of [...courses, outsideCourseId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		for (const id of users) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/users/${id}`);
		}
		await removePersonas([invitee, bystander]);
		if (subAccountId) await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${subAccountId}`);
	});

	// ------------------------------------------------------------------ accept / reject

	it('acceptInvitation: the invited user accepts; accepting again is harmless', async () => {
		const invitation = await invite(courses[0], invitee.id);
		expect(invitation.enrollment_state).toBe('invited');

		for (let attempt = 0; attempt < 2; attempt++) {
			const [accepted] = await runOk({
				resource: 'enrollment',
				operation: 'acceptInvitation',
				credential: invitee.credential,
				params: { courseId: courses[0], enrollmentId: Number(invitation.id) },
			});
			expect(accepted).toEqual({ success: true });
			expect((await getEnrollment(invitation.id)).enrollment_state).toBe('active');
		}
	});

	it('rejectInvitation: the invited user rejects; a rejected invitation can still be accepted, an active one cannot be rejected', async () => {
		const invitation = await invite(courses[1], invitee.id, 'TaEnrollment');
		const asInvitee = { credential: invitee.credential };
		const params = { courseId: `sis_course_id:${courseSisIds[1]}`, enrollmentId: String(invitation.id) };

		for (let attempt = 0; attempt < 2; attempt++) {
			const [rejected] = await runOk({ resource: 'enrollment', operation: 'rejectInvitation', ...asInvitee, params });
			expect(rejected).toEqual({ success: true });
			expect((await getEnrollment(invitation.id)).enrollment_state).toBe('rejected');
		}

		const [accepted] = await runOk({ resource: 'enrollment', operation: 'acceptInvitation', ...asInvitee, params });
		expect(accepted).toEqual({ success: true });
		expect(await getEnrollment(invitation.id)).toMatchObject({ enrollment_state: 'active', type: 'TaEnrollment' });

		const tooLate = await runNode({ resource: 'enrollment', operation: 'rejectInvitation', ...asInvitee, params: { ...params, ...refuse } });
		expect(tooLate.success).toEqual([]);
		expect(tooLate.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollment', operation: 'rejectInvitation' });
		expect(String(tooLate.error[0].errorMessage)).toContain('no current invitation');
		expect((await getEnrollment(invitation.id)).enrollment_state).toBe('active');
	});

	it('acceptInvitation / rejectInvitation: several invitations per run; wrong course, unknown and foreign enrollments fail on their own', async () => {
		const mine = await invite(courses[2], invitee.id);
		const second = await invite(courses[3], invitee.id, 'ObserverEnrollment');
		const foreign = await invite(courses[2], bystander.id);
		const inactive = await invite(outsideCourseId, invitee.id, 'StudentEnrollment', 'inactive');

		const result = await runNode({
			resource: 'enrollment',
			operation: 'acceptInvitation',
			credential: invitee.credential,
			items: [
				{ course: Number(courses[2]), enrollment: mine.id },
				// Belongs to another course.
				{ course: Number(courses[3]), enrollment: mine.id },
				{ course: Number(courses[2]), enrollment: 99999999 },
				// Somebody else's invitation.
				{ course: Number(courses[2]), enrollment: foreign.id },
				// Deactivated enrollments cannot be accepted.
				{ course: Number(outsideCourseId), enrollment: inactive.id },
				{ course: Number(courses[3]), enrollment: second.id },
			],
			params: { courseId: '={{ $json.course }}', enrollmentId: '={{ $json.enrollment }}', ...refuse },
		});
		expect(result.success).toEqual([{ success: true }, { success: true }]);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 5]);
		expect(result.error.map((e) => [e.errorCode, e.errorType])).toEqual([
			[404, 'NOT_FOUND'],
			[404, 'NOT_FOUND'],
			[403, 'FORBIDDEN'],
			[400, 'VALIDATION_ERROR'],
		]);
		expect(String(result.error[3].errorMessage)).toContain('membership not activated');
		expect(result.error[0]).toMatchObject({ resource: 'enrollment', operation: 'acceptInvitation' });

		expect((await getEnrollment(mine.id)).enrollment_state).toBe('active');
		expect((await getEnrollment(second.id)).enrollment_state).toBe('active');
		expect((await getEnrollment(foreign.id)).enrollment_state).toBe('invited');
		expect((await getEnrollment(inactive.id)).enrollment_state).toBe('inactive');

		// Not even an administrator can answer for somebody else.
		for (const operation of ['acceptInvitation', 'rejectInvitation']) {
			const asAdmin = await runNode({
				resource: 'enrollment',
				operation,
				params: { courseId: courses[2], enrollmentId: String(foreign.id), ...refuse },
			});
			expect(asAdmin.success, operation).toEqual([]);
			expect(asAdmin.error[0], operation).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'enrollment', operation });
		}
		expect((await getEnrollment(foreign.id)).enrollment_state).toBe('invited');

		const [rejected] = await runOk({
			resource: 'enrollment',
			operation: 'rejectInvitation',
			credential: bystander.credential,
			params: { courseId: courses[2], enrollmentId: String(foreign.id) },
		});
		expect(rejected).toEqual({ success: true });
		expect((await getEnrollment(foreign.id)).enrollment_state).toBe('rejected');
	});

	// ------------------------------------------------------------------ bulk enrollment

	/** [user, course, type, role, state] of every enrollment of the given users in the given courses. */
	const enrolled = async (courseIds: string[], userIds: string[]): Promise<string[]> => {
		const rows: string[] = [];
		for (const courseId of courseIds) {
			for (const enrollment of await enrollmentsOf(courseId)) {
				if (userIds.includes(String(enrollment.user_id))) {
					rows.push(
						[enrollment.user_id, courseId, enrollment.type, enrollment.role_id, enrollment.enrollment_state].join(' '),
					);
				}
			}
		}
		return rows.sort();
	};

	it('bulkEnroll: enrolls every user in every course as a student and returns the Progress of the job', async () => {
		const userIds = users.slice(0, 4);
		const courseIds = courses.slice(0, 3);
		const [progress] = await runOk({
			resource: 'enrollment',
			operation: 'bulkEnroll',
			params: { accountId: subAccountId, userIds: userIds.join(','), courseIds: ` ${courseIds.join(' , ')} ` },
		});
		expect(progress).toMatchObject({
			id: expect.any(Number),
			context_type: 'Account',
			context_id: Number(subAccountId),
			tag: 'bulk_enrollment',
			user_id: Number(fx('adminUserId')),
		});
		expect(['queued', 'running', 'completed']).toContain(progress.workflow_state);

		const finished = await waitForProgress(progress.id);
		expect(finished).toMatchObject({ workflow_state: 'completed', completion: 100, results: { errors: {} } });

		const expected: string[] = [];
		for (const user of userIds) {
			for (const course of courseIds) {
				expected.push([user, course, 'StudentEnrollment', fx('studentRoleId'), 'invited'].join(' '));
			}
		}
		expect(await enrolled(courseIds, userIds)).toEqual(expected.sort());
		// Nobody else, and no other course, was touched.
		expect(await enrolled([courses[3]], users)).toEqual([]);
		expect(await enrolled(courseIds, users.slice(4))).toEqual([]);

		// The job's Progress is what the Progress resource reads.
		const [polled] = await runOk({ resource: 'progress', operation: 'get', params: { progressId: String(progress.id) } });
		expect(polled).toMatchObject({ id: progress.id, workflow_state: 'completed' });
	});

	it('bulkEnroll: enrollment type and custom role; SIS IDs (root account) and ID lists from expressions', async () => {
		const role = fx('customTeacherRoleId');

		// Canvas' job looks SIS IDs up in the account of the request. They belong to the root
		// account, so through a sub-account they are not found and silently skipped.
		const [viaSubAccount] = await runOk({
			resource: 'enrollment',
			operation: 'bulkEnroll',
			params: {
				accountId: subAccountId,
				userIds: `sis_user_id:${userSisId}`,
				courseIds: `sis_course_id:${courseSisIds[0]}`,
				additionalFields: { enrollmentType: 'TeacherEnrollment', roleId: role },
			},
		});
		expect(await waitForProgress(viaSubAccount.id)).toMatchObject({ workflow_state: 'completed', results: { errors: {} } });
		expect((await enrolled([courses[0]], [users[0]])).filter((row) => row.includes('TeacherEnrollment'))).toEqual([]);

		const result = await runNode({
			resource: 'enrollment',
			operation: 'bulkEnroll',
			items: [
				{
					account: 'self',
					users: [`sis_user_id:${userSisId}`, Number(users[4])],
					courses: [`sis_course_id:${courseSisIds[0]}`, Number(courses[3])],
				},
			],
			params: {
				accountId: '={{ $json.account }}',
				userIds: '={{ $json.users }}',
				courseIds: '={{ $json.courses }}',
				additionalFields: { enrollmentType: 'TeacherEnrollment', roleId: role },
			},
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(1);
		const finished = await waitForProgress(result.success[0].id);
		expect(finished).toMatchObject({ workflow_state: 'completed', results: { errors: {} } });

		const expected = [users[0], users[4]]
			.flatMap((user) => [courses[0], courses[3]].map((course) => [user, course, 'TeacherEnrollment', role, 'invited'].join(' ')))
			.sort();
		const actual = (await enrolled([courses[0], courses[3]], [users[0], users[4]])).filter((row) => row.includes('TeacherEnrollment'));
		expect(actual).toEqual(expected);

		// A role alone decides the type (observer role -> observer enrollments). Canvas enrolls
		// observers who have completed registration as active right away instead of inviting them.
		const [byRole] = await runOk({
			resource: 'enrollment',
			operation: 'bulkEnroll',
			params: { accountId: subAccountId, userIds: users[5], courseIds: courses[3], additionalFields: { roleId: fx('customObserverRoleId') } },
		});
		expect((await waitForProgress(byRole.id)).workflow_state).toBe('completed');
		expect(await enrolled([courses[3]], [users[5]])).toEqual([
			[users[5], courses[3], 'ObserverEnrollment', fx('customObserverRoleId'), 'active'].join(' '),
		]);
	});

	it('bulkEnroll: invitations created in bulk are answered by the users; unknown users are skipped; a course of another account works too', async () => {
		const [progress] = await runOk({
			resource: 'enrollment',
			operation: 'bulkEnroll',
			params: {
				accountId: subAccountId,
				userIds: `${bystander.id},99999999`,
				courseIds: `${courses[0]},${outsideCourseId}`,
				additionalFields: { enrollmentType: 'DesignerEnrollment' },
			},
		});
		const finished = await waitForProgress(progress.id);
		expect(finished).toMatchObject({ workflow_state: 'completed', results: { errors: {} } });

		const created = (await canvas().getAll<Json>(`/api/v1/users/${bystander.id}/enrollments?state[]=invited&type[]=DesignerEnrollment`)).filter(
			(e) => [courses[0], outsideCourseId].includes(String(e.course_id)),
		);
		expect(created.map((e) => String(e.course_id)).sort()).toEqual([courses[0], outsideCourseId].sort());

		const answers = await runNode({
			resource: 'enrollment',
			operation: 'acceptInvitation',
			credential: bystander.credential,
			items: created.map((e) => ({ course: e.course_id, enrollment: e.id })),
			params: { courseId: '={{ $json.course }}', enrollmentId: '={{ $json.enrollment }}' },
		});
		expect(answers.error).toEqual([]);
		expect(answers.success).toEqual([{ success: true }, { success: true }]);
		for (const enrollment of created) {
			expect((await getEnrollment(enrollment.id)).enrollment_state).toBe('active');
		}
	});

	it('bulkEnroll: input Canvas would choke on is rejected, and nothing is enrolled', async () => {
		const target = [courses[3]];
		const before = await enrolled(target, users);
		const attempt = (params: Json, persona?: string) =>
			runNode({
				resource: 'enrollment',
				operation: 'bulkEnroll',
				persona,
				params: { accountId: subAccountId, userIds: users[1], courseIds: courses[3], ...params, ...refuse },
			});

		for (const empty of [{ userIds: ' , ' }, { courseIds: '={{ [] }}' }]) {
			const result = await attempt(empty);
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'enrollment', operation: 'bulkEnroll' });
			expect(String(result.error[0].errorMessage)).toContain('at least one user ID and at least one course ID');
		}

		const mismatch = await attempt({ additionalFields: { enrollmentType: 'StudentEnrollment', roleId: fx('customTeacherRoleId') } });
		expect(mismatch.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(mismatch.error[0].errorMessage)).toContain('must match the base type for the role');

		const accountRole = await attempt({ additionalFields: { roleId: fx('accountRoleId') } });
		expect(accountRole.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(accountRole.error[0].errorMessage)).toContain('Invalid role');

		const inactiveRole = await attempt({ additionalFields: { roleId: fx('inactiveRoleId') } });
		expect(inactiveRole.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(inactiveRole.error[0].errorMessage)).toContain('inactive');

		// 501 users times one course is more than Canvas takes in one request.
		const tooMany = await attempt({ userIds: Array.from({ length: 501 }, (_, index) => 90000000 + index).join(',') });
		expect(tooMany.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(tooMany.error[0].errorMessage)).toContain('Too many users to enroll at once');

		const unknownCourse = await attempt({ courseIds: '99999999' });
		expect(unknownCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		for (const persona of ['teacher', 'student']) {
			const forbidden = await attempt({}, persona);
			expect(forbidden.success, persona).toEqual([]);
			expect(forbidden.error[0], persona).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'enrollment', operation: 'bulkEnroll' });
		}

		expect(await enrolled(target, users)).toEqual(before);
	});
});
