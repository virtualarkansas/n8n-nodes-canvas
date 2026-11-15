import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { ids, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: sisIntegration (assignments flagged "post to SIS").
 *
 * Canvas only serves these endpoints where grade export to a SIS is enabled.
 * The tests switch the (hidden) "Post Grades to SIS" feature on for a
 * sub-account made here, so the root account and the seeded courses stay as
 * they are, and work on their own courses, assignments and student.
 */
describe('sisIntegration', () => {
	const root = fx('accountId');
	const tag = unique('SisInt').replace(/\s/g, '-');
	let account = '';
	let mainCourse = '';
	let pastCourse = '';
	let unpublishedCourse = '';
	let studentId = '';
	const flagged: string[] = [];
	let overriddenAssignment = '';
	let notFlagged = '';
	let unpublishedAssignment = '';
	const FLAGGED = 12;

	// Quarter 1 and Quarter 2 of the seeded Fall term.
	const dueInQ1 = '2026-09-15T12:00:00Z';
	const dueInQ2 = '2026-11-20T12:00:00Z';

	const sisAssignments = (context: string, query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/sis/${context}/assignments${query}`);
	const postToSis = async (course: string): Promise<Record<string, boolean>> => {
		const assignments = await canvas().getAll<Json>(`/api/v1/courses/${course}/assignments`);
		return Object.fromEntries(assignments.map((a) => [String(a.id), Boolean(a.post_to_sis)]));
	};

	const makeCourse = async (name: string, termId: string, publish: boolean): Promise<string> => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
			course: { name: `${tag} ${name}`, term_id: termId },
			offer: publish,
		});
		return String(course.id);
	};
	const makeAssignment = async (course: string, name: string, settings: Json): Promise<string> => {
		const assignment = await canvas().post<Json>(`/api/v1/courses/${course}/assignments`, {
			assignment: { name: `${tag} ${name}`, points_possible: 10, submission_types: ['online_text_entry'], ...settings },
		});
		return String(assignment.id);
	};

	beforeAll(async () => {
		const created = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: `${tag} account` },
		});
		account = String(created.id);
		await canvas().put(`/api/v1/accounts/${account}/features/flags/post_grades`, { state: 'on' });

		mainCourse = await makeCourse('main course', fx('termId'), true);
		pastCourse = await makeCourse('past course', fx('pastTermId'), true);
		unpublishedCourse = await makeCourse('unpublished course', fx('termId'), false);

		for (let i = 0; i < FLAGGED; i++) {
			// Four due in the first quarter, four in the second, four without a due date.
			const due = i % 3 === 0 ? { due_at: dueInQ1 } : i % 3 === 1 ? { due_at: dueInQ2 } : {};
			flagged.push(
				await makeAssignment(mainCourse, `flagged ${String(i).padStart(2, '0')}${i === 0 ? ' Ünïcødé "quoted" & <b>tags</b>' : ''}`, {
					post_to_sis: true,
					published: true,
					...due,
				}),
			);
		}
		notFlagged = await makeAssignment(mainCourse, 'not flagged', { post_to_sis: false, published: true });
		unpublishedAssignment = await makeAssignment(mainCourse, 'unpublished', { post_to_sis: true, published: false });
		await makeAssignment(pastCourse, 'past flagged', { post_to_sis: true, published: true });
		await makeAssignment(unpublishedCourse, 'in unpublished course', { post_to_sis: true, published: true });

		const login = `${tag.toLowerCase()}@example.edu`;
		const student = await canvas().post<Json>(`/api/v1/accounts/${root}/users`, {
			user: { name: `${tag} student`, skip_registration: true },
			pseudonym: { unique_id: login, send_confirmation: false },
		});
		studentId = String(student.id);
		await canvas().post(`/api/v1/courses/${mainCourse}/enrollments`, {
			enrollment: { user_id: studentId, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
		});
		overriddenAssignment = flagged[1];
		await canvas().post(`/api/v1/courses/${mainCourse}/assignments/${overriddenAssignment}/overrides`, {
			assignment_override: { student_ids: [Number(studentId)], title: `${tag} override`, due_at: '2026-12-01T12:00:00Z' },
		});
	}, 600_000);

	afterAll(async () => {
		for (const course of [mainCourse, pastCourse, unpublishedCourse].filter(Boolean)) {
			await canvas().request('DELETE', `/api/v1/courses/${course}?event=delete`);
		}
		if (studentId) await canvas().request('DELETE', `/api/v1/accounts/${root}/users/${studentId}`);
		if (account) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/features/flags/post_grades`);
			await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${account}`);
		}
	});

	// ---------------------------------------------------------- getAssignments

	it('getAssignments (course): the published, flagged assignments of the course, across pages', async () => {
		const expected = await sisAssignments(`courses/${mainCourse}`);
		expect(ids(expected)).toEqual(flagged.map(Number).sort((a, b) => a - b));

		const all = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: { context: 'course', courseId: mainCourse, pagination: { returnAll: true } },
		});
		expect(all.map((a) => a.id)).toEqual(expected.map((a) => a.id));
		expect(ids(all)).not.toContain(Number(notFlagged));
		expect(ids(all)).not.toContain(Number(unpublishedAssignment));

		const first = all.find((a) => String(a.id) === flagged[0])!;
		expect(first).toMatchObject({
			course_id: Number(mainCourse),
			name: `${tag} flagged 00 Ünïcødé "quoted" & <b>tags</b>`,
			points_possible: 10,
			due_at: dueInQ1,
		});
		expect(first.assignment_group).toBeTypeOf('object');
		const sections = first.sections as Json[];
		expect(sections.length).toBeGreaterThan(0);
		expect((sections[0].origin_course as Json).id).toBe(Number(mainCourse));
		// Without the include there is no per-student information.
		expect(first.user_overrides).toBeUndefined();

		const defaults = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: { context: 'course', courseId: mainCourse },
		});
		expect(defaults).toHaveLength(FLAGGED);

		const paged = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			items: [{ course: Number(mainCourse) }],
			params: { context: 'course', courseId: '={{ $json.course }}', pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(paged).toHaveLength(10);
		expect(new Set(ids(paged)).size).toBe(10);
	});

	it('getAssignments (course): "Student Overrides" adds the overrides of individual students', async () => {
		const withOverrides = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: {
				context: 'course',
				courseId: mainCourse,
				options: { include: ['student_overrides'] },
				pagination: { returnAll: true },
			},
		});
		expect(withOverrides).toHaveLength(FLAGGED);
		const overridden = withOverrides.find((a) => String(a.id) === overriddenAssignment)!;
		const userOverrides = overridden.user_overrides as Json[];
		expect(userOverrides).toHaveLength(1);
		expect(userOverrides[0]).toMatchObject({ title: `${tag} override`, due_at: '2026-12-01T12:00:00Z' });
		expect((userOverrides[0].students as Json[]).map((s) => s.user_id)).toEqual([Number(studentId)]);
		const plain = withOverrides.find((a) => String(a.id) === flagged[0])!;
		expect(plain.user_overrides).toEqual([]);
	});

	it('getAssignments (account): every published course below the account; date filters select courses', async () => {
		const expected = await sisAssignments(`accounts/${account}`);
		expect(expected).toHaveLength(FLAGGED + 1);

		const all = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: { context: 'account', accountId: account, pagination: { returnAll: true } },
		});
		expect(all.map((a) => a.id)).toEqual(expected.map((a) => a.id));
		expect(new Set(all.map((a) => String(a.course_id)))).toEqual(new Set([mainCourse, pastCourse]));

		// Only courses that are still running after the summer: the past course drops out.
		const running = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: {
				context: 'account',
				accountId: account,
				options: { ends_after: '2026-09-01T00:00:00Z' },
				pagination: { returnAll: true },
			},
		});
		expect(ids(running)).toEqual(ids(await sisAssignments(`accounts/${account}`, '?ends_after=2026-09-01T00:00:00Z')));
		expect(new Set(running.map((a) => String(a.course_id)))).toEqual(new Set([mainCourse]));

		// Only courses that started before the summer: just the past course.
		const started = await runOk({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: {
				context: 'account',
				accountId: account,
				options: { starts_before: '2026-06-01T00:00:00Z', include: ['student_overrides'] },
				pagination: { returnAll: true },
			},
		});
		expect(new Set(started.map((a) => String(a.course_id)))).toEqual(new Set([pastCourse]));
		expect(started[0].user_overrides).toEqual([]);

		const none = await runNode({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: {
				context: 'account',
				accountId: account,
				options: { starts_before: '2020-01-01T00:00:00Z', ends_after: '2040-01-01T00:00:00Z' },
			},
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('getAssignments: where grade export is not enabled, for unpublished courses and for a teacher Canvas refuses', async () => {
		const notEnabled = await runNode({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			params: { context: 'account', accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(notEnabled.success).toEqual([]);
		expect(notEnabled.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'sisIntegration',
			operation: 'getAssignments',
		});

		const result = await runNode({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			items: [{ course: unpublishedCourse }, { course: '99999999' }, { course: fx('courseId') }],
			params: { context: 'course', courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(3);
		const byCourse = (course: string): Json => result.error.find((e) => (e.originalItem as Json).course === course)!;
		expect(byCourse(unpublishedCourse)).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(byCourse('99999999')).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		// A seeded course outside the sub-account: the feature is not on there.
		expect(byCourse(fx('courseId'))).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		const asTeacher = await runNode({
			resource: 'sisIntegration',
			operation: 'getAssignments',
			persona: 'teacher',
			params: { context: 'course', courseId: mainCourse, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// -------------------------------------------------------- disablePostToSis

	it('disablePostToSis: with a grading period only the assignments due in it (or without due date) are switched off', async () => {
		const [result] = await runOk({
			resource: 'sisIntegration',
			operation: 'disablePostToSis',
			params: { courseId: mainCourse, options: { grading_period_id: fx('gradingPeriodId') } },
		});
		expect(result).toEqual({ success: true });

		const state = await postToSis(mainCourse);
		for (const [index, id] of flagged.entries()) {
			// Index % 3: 0 = due in quarter 1, 1 = due in quarter 2, 2 = no due date.
			expect(state[id], `assignment ${index}`).toBe(index % 3 === 1);
		}
		// Unpublished assignments are not touched.
		expect(state[unpublishedAssignment]).toBe(true);
		const remaining = await sisAssignments(`courses/${mainCourse}`);
		expect(ids(remaining)).toEqual(flagged.filter((_, index) => index % 3 === 1).map(Number).sort((a, b) => a - b));
	});

	it('disablePostToSis: without a grading period every published assignment of the course is switched off', async () => {
		const [result] = await runOk({
			resource: 'sisIntegration',
			operation: 'disablePostToSis',
			items: [{ course: Number(mainCourse) }],
			params: { courseId: '={{ $json.course }}' },
		});
		expect(result).toEqual({ success: true });
		const state = await postToSis(mainCourse);
		expect(flagged.map((id) => state[id])).toEqual(flagged.map(() => false));
		expect(state[unpublishedAssignment]).toBe(true);
		expect(await sisAssignments(`courses/${mainCourse}`)).toEqual([]);

		// Nothing left to do: still a success. Other courses were not touched.
		const [again] = await runOk({
			resource: 'sisIntegration',
			operation: 'disablePostToSis',
			params: { courseId: mainCourse },
		});
		expect(again).toEqual({ success: true });
		expect(Object.values(await postToSis(pastCourse))).toEqual([true]);
	});

	it('disablePostToSis: an unknown course and a user without rights in the course are refused', async () => {
		const unknown = await runNode({
			resource: 'sisIntegration',
			operation: 'disablePostToSis',
			params: { courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'sisIntegration',
			operation: 'disablePostToSis',
		});

		const asTeacher = await runNode({
			resource: 'sisIntegration',
			operation: 'disablePostToSis',
			persona: 'teacher',
			params: { courseId: pastCourse, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect([401, 403]).toContain(asTeacher.error[0].errorCode);
		expect(Object.values(await postToSis(pastCourse))).toEqual([true]);
	});
});
