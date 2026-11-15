import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createUser, deleteUser, WebSession } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * Resource: outcomeResult — the Learning Mastery Gradebook operations
 * (Get/Update Gradebook Settings, Get User Details).
 *
 * Runs on a course of the file's own with the course-level "Learning Mastery
 * Gradebook" feature switched on. The settings are stored per user, so the
 * file checks them with the token of the user who made the change.
 */
describe('outcomeResult: learning mastery gradebook', () => {
	let courseId = '';
	let plainCourseId = '';
	let sectionId = '';
	let ownStudent: OwnUser;
	const settingsPath = (): string => `/api/v1/courses/${courseId}/learning_mastery_gradebook_settings`;
	const stored = async (persona = 'admin'): Promise<Json> =>
		(await new CanvasClient(persona).get<Json>(settingsPath())).learning_mastery_gradebook_settings as Json;

	const enroll = (course: string, userId: string, type: string, section?: string): Promise<Json> =>
		canvas().post<Json>(`/api/v1/courses/${course}/enrollments`, {
			enrollment: {
				user_id: userId,
				type,
				enrollment_state: 'active',
				notify: false,
				...(section ? { course_section_id: section } : {}),
			},
		});

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('LMGB battery course') },
			offer: true,
		});
		courseId = String(course.id);
		await canvas().put(`/api/v1/courses/${courseId}/features/flags/outcome_gradebook`, { state: 'on' });
		const section = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name: 'A second section' } });
		sectionId = String(section.id);

		ownStudent = await createUser('LMGB Student');
		await enroll(courseId, ownStudent.id, 'StudentEnrollment');
		await enroll(courseId, ownStudent.id, 'StudentEnrollment', sectionId);
		await enroll(courseId, fx('teacherUserId'), 'TeacherEnrollment');
		await enroll(courseId, fx('studentUserId'), 'StudentEnrollment');
		// Canvas reports the login before the current one, so the student logs in twice.
		await new WebSession().login(ownStudent.login, ownStudent.password);
		await new WebSession().login(ownStudent.login, ownStudent.password);

		// A course whose Learning Mastery Gradebook is switched off.
		const plain = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('LMGB battery: feature off') },
			offer: true,
		});
		plainCourseId = String(plain.id);
		await canvas().put(`/api/v1/courses/${plainCourseId}/features/flags/outcome_gradebook`, { state: 'off' });
	});

	afterAll(async () => {
		for (const id of [courseId, plainCourseId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		await deleteUser(ownStudent);
	});

	// ----------------------------------
	//         getGradebookSettings / updateGradebookSettings
	// ----------------------------------
	it('getGradebookSettings: a user who never changed anything has no settings', async () => {
		const result = await runNode({ resource: 'outcomeResult', operation: 'getGradebookSettings', params: { courseId } });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([{}]);
	});

	it('updateGradebookSettings: every setting reaches Canvas, for the user of the token only', async () => {
		const settings = {
			name_display_format: 'last_first',
			outcome_arrangement: 'upload_order',
			score_display_format: 'icon_and_label',
			secondary_info_display: 'sis_id',
			show_outcomes_with_no_results: false,
			show_student_avatars: false,
			show_students_with_no_results: false,
			show_unpublished_assignments: true,
			students_per_page: 50,
		};
		const [updated] = await runOk({ resource: 'outcomeResult', operation: 'updateGradebookSettings', params: { courseId, settings } });
		expect(updated).toEqual(settings);
		expect(await stored()).toEqual(settings);
		// The teacher of the same course has their own settings.
		expect(await stored('teacher')).toEqual({});

		const [read] = await runOk({ resource: 'outcomeResult', operation: 'getGradebookSettings', params: { courseId } });
		expect(read).toEqual(settings);
	});

	it('updateGradebookSettings: only the given settings change; every other choice works too', async () => {
		const before = await stored();
		const [one] = await runOk({
			resource: 'outcomeResult',
			operation: 'updateGradebookSettings',
			params: { courseId, settings: { show_student_avatars: true } },
		});
		expect(one).toEqual({ ...before, show_student_avatars: true });
		expect(await stored()).toEqual({ ...before, show_student_avatars: true });

		const variants: Json[] = [
			{ name_display_format: 'first_last', outcome_arrangement: 'alphabetical', score_display_format: 'icon_only', secondary_info_display: 'none', students_per_page: 15 },
			{ outcome_arrangement: 'custom', score_display_format: 'icon_and_points', secondary_info_display: 'integration_id', students_per_page: 30 },
			{ secondary_info_display: 'login_id', students_per_page: 100, show_outcomes_with_no_results: true, show_students_with_no_results: true, show_unpublished_assignments: false },
		];
		let expected: Json = { ...before, show_student_avatars: true };
		for (const settings of variants) {
			expected = { ...expected, ...settings };
			const [updated] = await runOk({ resource: 'outcomeResult', operation: 'updateGradebookSettings', params: { courseId, settings } });
			expect(updated).toEqual(expected);
			expect(await stored()).toEqual(expected);
		}
	});

	it('updateGradebookSettings / getGradebookSettings: a teacher changes and reads their own settings', async () => {
		const adminSettings = await stored();
		const [updated] = await runOk({
			resource: 'outcomeResult',
			operation: 'updateGradebookSettings',
			persona: 'teacher',
			items: [{ perPage: 30, avatars: false }],
			params: { courseId, settings: { students_per_page: '={{ $json.perPage }}', show_student_avatars: '={{ $json.avatars }}' } },
		});
		expect(updated).toEqual({ students_per_page: 30, show_student_avatars: false });
		expect(await stored('teacher')).toEqual({ students_per_page: 30, show_student_avatars: false });
		expect(await stored()).toEqual(adminSettings);

		const [read] = await runOk({ resource: 'outcomeResult', operation: 'getGradebookSettings', persona: 'teacher', params: { courseId } });
		expect(read).toEqual({ students_per_page: 30, show_student_avatars: false });
	});

	it('updateGradebookSettings: Canvas names the values it does not accept; nothing is stored', async () => {
		const before = await stored();
		const result = await runNode({
			resource: 'outcomeResult',
			operation: 'updateGradebookSettings',
			items: [{ perPage: 20 }],
			params: {
				courseId,
				settings: { students_per_page: '={{ $json.perPage }}', show_student_avatars: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 422,
			errorType: 'VALIDATION_ERROR',
			resource: 'outcomeResult',
			operation: 'updateGradebookSettings',
		});
		expect(String(result.error[0].errorMessage)).toContain('Invalid students_per_page');
		expect(await stored()).toEqual(before);
	});

	it('updateGradebookSettings: nothing selected is refused before anything is sent', async () => {
		const result = await runNode({
			resource: 'outcomeResult',
			operation: 'updateGradebookSettings',
			params: { courseId, settings: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', operation: 'updateGradebookSettings' });
		expect(String(result.error[0].errorMessage)).toContain('at least one setting');
	});

	it('gradebook settings: students have no learning mastery gradebook settings', async () => {
		for (const [operation, extra] of [
			['getGradebookSettings', {}],
			['updateGradebookSettings', { settings: { students_per_page: 15 } }],
		] as Array<[string, Json]>) {
			const refused = await runNode({
				resource: 'outcomeResult',
				operation,
				persona: 'student',
				params: { courseId, ...extra, errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation });
		}
	});

	it('updateGradebookSettings: a course without the Learning Mastery Gradebook feature is reported as an error', async () => {
		// Canvas answers 204 and stores nothing.
		const result = await runNode({
			resource: 'outcomeResult',
			operation: 'updateGradebookSettings',
			params: { courseId: plainCourseId, settings: { students_per_page: 15 }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(1);
		expect(String(result.error[0].errorMessage)).toContain('Learning Mastery Gradebook feature is not enabled');
	});

	it('getGradebookSettings [needs shared change]: a course without the feature is reported as an error, not as { success: true }', async () => {
		// Canvas answers 204 without a body. `checkResponse` is only applied to writes, so the node
		// cannot tell this apart from an empty success for a GET.
		const result = await runNode({
			resource: 'outcomeResult',
			operation: 'getGradebookSettings',
			params: { courseId: plainCourseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(1);
	});

	// ----------------------------------
	//         getUserDetails
	// ----------------------------------
	it('getUserDetails: the sections of a student in the course and their last login', async () => {
		const [details] = await runOk({ resource: 'outcomeResult', operation: 'getUserDetails', params: { courseId, userId: ownStudent.id } });
		const sections = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		expect(details.course).toEqual({ name: (await canvas().get<Json>(`/api/v1/courses/${courseId}`)).name });
		const user = details.user as Json;
		// Both sections of the student, by name.
		expect(user.sections).toEqual(
			sections.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => String(a.name).localeCompare(String(b.name))),
		);
		expect(user.sections).toHaveLength(2);
		expect(Date.now() - Date.parse(String(user.last_login))).toBeLessThan(15 * 60_000);
	});

	it('getUserDetails: several users in one run; a teacher may ask; someone who is not in the course has no sections', async () => {
		const result = await runNode({
			resource: 'outcomeResult',
			operation: 'getUserDetails',
			persona: 'teacher',
			items: [{ user: Number(fx('studentUserId')) }, { user: 99999999 }, { user: Number(fx('registrarUserId')) }],
			params: { courseId, userId: '={{ $json.user }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2]);
		const [enrolled, outsider] = result.success;
		expect(((enrolled.user as Json).sections as Json[]).map((s) => s.name)).toHaveLength(1);
		expect((outsider.user as Json).sections).toEqual([]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getUserDetails', originalItem: { user: 99999999 } });
	});

	it('getUserDetails: a student may ask about themselves only; SIS IDs are not accepted by Canvas', async () => {
		const [own] = await runOk({
			resource: 'outcomeResult',
			operation: 'getUserDetails',
			persona: 'student',
			params: { courseId, userId: fx('studentUserId') },
		});
		expect(((own.user as Json).sections as Json[]).length).toBe(1);

		const other = await runNode({
			resource: 'outcomeResult',
			operation: 'getUserDetails',
			persona: 'student',
			params: { courseId, userId: ownStudent.id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(other.success).toEqual([]);
		expect(other.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getUserDetails' });
		expect(String(other.error[0].errorMessage)).toContain('not authorized to read grades for specified user');

		const bySis = await runNode({
			resource: 'outcomeResult',
			operation: 'getUserDetails',
			params: { courseId, userId: `sis_user_id:${fx('studentSisUserId')}`, errorHandling: { onError: 'continueWithError' } },
		});
		expect(bySis.success).toEqual([]);
		expect(bySis.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
