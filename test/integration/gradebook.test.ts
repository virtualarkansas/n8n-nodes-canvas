import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { waitFor } from './pacing.fixture';
import { createSandboxAccount, deleteSandboxAccount, waitForProgress as waitUntilFinished } from './support/gradingSandbox';

/**
 * Resource: gradebook (bulk actions of the gradebook, both run as background jobs).
 *
 * Everything runs in a course of the file's own, in a sub-account of its own
 * where the "Apply Score to Ungraded" feature is switched on, with students of
 * its own, a term with grading periods of its own, and the course-level
 * "Final Grade Override" feature and setting enabled.
 */
/**
 * Wait for the job and its report: Canvas marks these jobs "completed" a moment
 * before it stores their "results".
 */
async function waitForProgress(progressId: string): Promise<Json> {
	await waitUntilFinished(progressId);
	return waitFor(
		() => canvas().get<Json>(`/api/v1/progress/${progressId}`),
		(progress) => progress.results !== undefined && progress.results !== null,
		30_000,
	);
}

describe('gradebook', () => {
	const root = fx('accountId');
	let accountId = '';
	let termId = '';
	let setId = '';
	let periodId = '';
	let courseId = '';
	let plainCourseId = '';
	const students: string[] = [];
	const assignments: Record<'pastDue' | 'future' | 'undated' | 'notGraded', string> = {
		pastDue: '',
		future: '',
		undated: '',
		notGraded: '',
	};

	const createStudent = async (label: string): Promise<string> => {
		const name = unique(label);
		const user = await canvas().post<Json>(`/api/v1/accounts/${root}/users`, {
			user: { name, skip_registration: true },
			pseudonym: { unique_id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.edu`, send_confirmation: false },
		});
		return String(user.id);
	};
	const enroll = (course: string, userId: string, type: string): Promise<Json> =>
		canvas().post<Json>(`/api/v1/courses/${course}/enrollments`, {
			enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false },
		});
	const submission = (assignment: string, student: string): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignment}/submissions/${student}`);
	/** The grades of the student's enrollment (override score included), for the course or one grading period. */
	const grades = async (student: string, gradingPeriod?: string): Promise<Json> => {
		const [enrollment] = await canvas().getAll<Json>(
			`/api/v1/courses/${courseId}/enrollments?user_id=${student}${gradingPeriod ? `&grading_period_id=${gradingPeriod}` : ''}`,
		);
		return enrollment.grades as Json;
	};

	beforeAll(async () => {
		accountId = await createSandboxAccount('gradebook');
		await canvas().put(`/api/v1/accounts/${accountId}/features/flags/apply_score_to_ungraded`, { state: 'on' });

		const term = await canvas().post<Json>(`/api/v1/accounts/${root}/terms`, { enrollment_term: { name: unique('Gradebook battery term') } });
		termId = String(term.id);
		const set = await canvas().post<Json>(`/api/v1/accounts/${root}/grading_period_sets`, {
			enrollment_term_ids: [termId],
			grading_period_set: { title: unique('Gradebook battery periods') },
		});
		setId = String((set.grading_period_set as Json).id);
		const periods = await canvas().request('PATCH', `/api/v1/grading_period_sets/${setId}/grading_periods/batch_update`, {
			grading_periods: [
				{ title: 'Always', start_date: '2020-01-01T00:00:00Z', end_date: '2040-01-01T00:00:00Z', close_date: '2040-01-01T00:00:00Z' },
			],
		});
		periodId = String(((periods.data as Json).grading_periods as Json[])[0].id);

		const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('Gradebook battery course'), term_id: termId },
			offer: true,
		});
		courseId = String(course.id);
		await canvas().put(`/api/v1/courses/${courseId}/features/flags/final_grades_override`, { state: 'on' });
		await canvas().put(`/api/v1/courses/${courseId}/settings`, { allow_final_grade_override: true });

		const day = 86_400_000;
		const create = async (name: string, attributes: Json): Promise<string> => {
			const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
				assignment: { name, submission_types: ['online_text_entry'], published: true, ...attributes },
			});
			return String(assignment.id);
		};
		assignments.pastDue = await create('Past due (10 points)', { points_possible: 10, due_at: new Date(Date.now() - 3 * day).toISOString() });
		assignments.future = await create('Due next week (20 points)', { points_possible: 20, due_at: new Date(Date.now() + 7 * day).toISOString() });
		assignments.undated = await create('No due date (5 points)', { points_possible: 5 });
		assignments.notGraded = await create('Not graded', { submission_types: ['not_graded'], grading_type: 'not_graded' });

		for (const label of ['Gradebook Student One', 'Gradebook Student Two', 'Gradebook Student Three']) {
			const id = await createStudent(label);
			students.push(id);
			await enroll(courseId, id, 'StudentEnrollment');
		}
		await enroll(courseId, fx('teacherUserId'), 'TeacherEnrollment');
		await enroll(courseId, fx('studentUserId'), 'StudentEnrollment');

		// One submission is graded already; bulk scoring must leave it alone.
		await canvas().put(`/api/v1/courses/${courseId}/assignments/${assignments.pastDue}/submissions/${students[0]}`, {
			submission: { posted_grade: '7' },
		});

		// A course in an account without the "Apply Score to Ungraded" feature and without final grade override.
		const plain = await canvas().post<Json>(`/api/v1/accounts/${root}/courses`, { course: { name: unique('Gradebook battery: features off') }, offer: true });
		plainCourseId = String(plain.id);
		await enroll(plainCourseId, students[0], 'StudentEnrollment');
	});

	afterAll(async () => {
		for (const id of [courseId, plainCourseId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		for (const id of students) await canvas().request('DELETE', `/api/v1/accounts/${root}/users/${id}`);
		if (setId) await canvas().request('DELETE', `/api/v1/accounts/${root}/grading_period_sets/${setId}`);
		if (termId) await canvas().request('DELETE', `/api/v1/accounts/${root}/terms/${termId}`);
		await deleteSandboxAccount(accountId);
	});

	// ----------------------------------
	//         applyScoreToUngraded
	// ----------------------------------
	it('applyScoreToUngraded: gives the ungraded submissions of the chosen students and assignments a percent score', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			params: {
				courseId,
				assignmentIds: ` ${assignments.pastDue} , ${assignments.future}, ${assignments.notGraded} `,
				studentIds: `${students[0]},${students[1]}`,
				grade: 'percent',
				percent: 50,
			},
		});
		expect(progress).toMatchObject({ tag: 'apply_score_to_ungraded_assignments', context_type: 'Course', context_id: Number(courseId) });
		const finished = await waitForProgress(String(progress.id));
		expect(finished.workflow_state).toBe('completed');
		expect(finished.results).toEqual({ errors: [] });

		// 50% of 10 and of 20 points; the submission that had a grade keeps it.
		expect((await submission(assignments.pastDue, students[0])).score).toBe(7);
		expect(await submission(assignments.pastDue, students[1])).toMatchObject({ score: 5, grade: '5', workflow_state: 'graded', grader_id: Number(root) });
		expect((await submission(assignments.future, students[0])).score).toBe(10);
		expect((await submission(assignments.future, students[1])).score).toBe(10);
		// Not chosen: the third student, and the assignment without due date.
		expect((await submission(assignments.pastDue, students[2])).score).toBeNull();
		expect((await submission(assignments.undated, students[0])).score).toBeNull();
		// The assignment that is not graded stays untouched.
		expect((await submission(assignments.notGraded, students[0])).workflow_state).toBe('unsubmitted');
	});

	it('applyScoreToUngraded: "Only Past Due" and "Mark as Missing"; IDs as arrays from an expression; run by a teacher', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			persona: 'teacher',
			items: [
				{
					assignments: [Number(assignments.pastDue), Number(assignments.future), Number(assignments.undated)],
					students: [Number(students[2])],
				},
			],
			params: {
				courseId,
				assignmentIds: '={{ $json.assignments }}',
				studentIds: '={{ $json.students }}',
				grade: 'percent',
				percent: 0,
				options: { only_past_due: true, mark_as_missing: true },
			},
		});
		const finished = await waitForProgress(String(progress.id));
		expect(finished.workflow_state).toBe('completed');

		expect(await submission(assignments.pastDue, students[2])).toMatchObject({
			score: 0,
			missing: true,
			late_policy_status: 'missing',
			grader_id: Number(fx('teacherUserId')),
		});
		// Not due yet, or no due date at all: left alone.
		expect((await submission(assignments.future, students[2])).score).toBeNull();
		expect((await submission(assignments.undated, students[2])).score).toBeNull();
	});

	it('applyScoreToUngraded: a fractional percent, and both options switched off explicitly', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			params: {
				courseId,
				assignmentIds: assignments.future,
				studentIds: students[2],
				grade: 'percent',
				percent: 87.5,
				options: { only_past_due: false, mark_as_missing: false },
			},
		});
		await waitForProgress(String(progress.id));
		expect(await submission(assignments.future, students[2])).toMatchObject({ score: 17.5, missing: false, late_policy_status: null });
	});

	it('applyScoreToUngraded: "Excused" excuses what is still ungraded', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			params: {
				courseId,
				assignmentIds: `${assignments.undated},${assignments.pastDue}`,
				studentIds: students.join(','),
				grade: 'excused',
				// Left over in the node from an earlier choice of "Percent Score": must not be sent.
				percent: 30,
			},
		});
		const finished = await waitForProgress(String(progress.id));
		expect(finished.workflow_state).toBe('completed');
		for (const student of students) {
			expect(await submission(assignments.undated, student)).toMatchObject({ excused: true, score: null });
		}
		// Graded before: not excused.
		expect(await submission(assignments.pastDue, students[0])).toMatchObject({ excused: false, score: 7 });
		expect(await submission(assignments.pastDue, students[1])).toMatchObject({ excused: false, score: 5 });
	});

	it('applyScoreToUngraded: several items start one job each', async () => {
		const persona = fx('studentUserId');
		const result = await runNode({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			items: [
				{ assignment: Number(assignments.pastDue), percent: 100 },
				{ assignment: Number(assignments.future), percent: 25 },
			],
			params: {
				courseId,
				assignmentIds: '={{ $json.assignment }}',
				studentIds: persona,
				grade: 'percent',
				percent: '={{ $json.percent }}',
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(2);
		for (const progress of result.success) await waitForProgress(String(progress.id));
		expect((await submission(assignments.pastDue, persona)).score).toBe(10);
		expect((await submission(assignments.future, persona)).score).toBe(5);
	});

	it('applyScoreToUngraded: unusable input is refused before anything is sent', async () => {
		const cases: Array<[Json, string]> = [
			[{ assignmentIds: assignments.undated, studentIds: students[0], grade: 'percent', percent: 101 }, 'between 0 and 100'],
			[{ assignmentIds: assignments.undated, studentIds: students[0], grade: 'percent', percent: -1 }, 'between 0 and 100'],
			[{ assignmentIds: ' , ', studentIds: students[0], grade: 'excused' }, 'at least one assignment ID'],
			[{ assignmentIds: assignments.undated, studentIds: ' ', grade: 'excused' }, 'at least one student ID'],
		];
		for (const [params, message] of cases) {
			const result = await runNode({
				resource: 'gradebook',
				operation: 'applyScoreToUngraded',
				params: { courseId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'gradebook' });
			expect(String(result.error[0].errorMessage)).toContain(message);
		}
	});

	it('applyScoreToUngraded: refused for students, and in an account without the feature', async () => {
		const params = { assignmentIds: assignments.future, studentIds: students[0], grade: 'percent', percent: 1 };
		const asStudent = await runNode({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			persona: 'student',
			params: { courseId, ...params, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'applyScoreToUngraded' });

		const featureOff = await runNode({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			params: { courseId: plainCourseId, ...params, errorHandling: { onError: 'continueWithError' } },
		});
		expect(featureOff.success).toEqual([]);
		expect(featureOff.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });

		const missing = await runNode({
			resource: 'gradebook',
			operation: 'applyScoreToUngraded',
			params: { courseId: '99999999', ...params, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ----------------------------------
	//         updateFinalGradeOverrides
	// ----------------------------------
	it('updateFinalGradeOverrides: sets the final grade overrides of several students', async () => {
		expect((await grades(students[0])).override_score).toBeUndefined();
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			params: {
				courseId,
				overrideScores: {
					score: [
						{ student_id: students[0], override_score: 91.5 },
						{ student_id: ` ${students[1]} `, override_score: 0 },
					],
				},
			},
		});
		expect(progress).toMatchObject({ tag: 'override_grade_update', context_type: 'Course', context_id: Number(courseId) });
		const finished = await waitForProgress(String(progress.id));
		expect(finished.workflow_state).toBe('completed');
		expect(finished.results).toEqual({ errors: [] });

		expect((await grades(students[0])).override_score).toBe(91.5);
		expect((await grades(students[1])).override_score).toBe(0);
		expect((await grades(students[2])).override_score).toBeUndefined();
		// The grading period is not affected by an override of the course total.
		expect((await grades(students[0], periodId)).override_score).toBeUndefined();
	});

	it('updateFinalGradeOverrides: "Grading Period ID" overrides the grade of that period only; values from expressions', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			persona: 'teacher',
			items: [{ student: Number(students[0]), score: 64.25, period: Number(periodId) }],
			params: {
				courseId,
				overrideScores: { score: [{ student_id: '={{ $json.student }}', override_score: '={{ $json.score }}' }] },
				options: { grading_period_id: '={{ $json.period }}' },
			},
		});
		const finished = await waitForProgress(String(progress.id));
		expect(finished.results).toEqual({ errors: [] });
		expect((await grades(students[0], periodId)).override_score).toBe(64.25);
		expect((await grades(students[0])).override_score).toBe(91.5);
	});

	it('updateFinalGradeOverrides: "Remove Override" brings the calculated grade back', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			params: {
				courseId,
				overrideScores: {
					score: [
						{ student_id: students[0], override_score: 55, remove: true },
						{ student_id: students[2], override_score: 100, remove: false },
					],
				},
			},
		});
		await waitForProgress(String(progress.id));
		expect((await grades(students[0])).override_score).toBeUndefined();
		expect((await grades(students[1])).override_score).toBe(0);
		expect((await grades(students[2])).override_score).toBe(100);
		// The override of the grading period is a separate one.
		expect((await grades(students[0], periodId)).override_score).toBe(64.25);
	});

	it('updateFinalGradeOverrides: students who are not in the course are skipped; the job reports IDs it cannot use', async () => {
		const [progress] = await runOk({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			params: {
				courseId,
				overrideScores: {
					score: [
						{ student_id: fx('registrarUserId'), override_score: 10 },
						{ student_id: 'sis_user_id:nobody', override_score: 20 },
						{ student_id: students[1], override_score: 33.3 },
					],
				},
			},
		});
		const finished = await waitForProgress(String(progress.id));
		expect(finished.workflow_state).toBe('completed');
		expect(finished.results).toEqual({ errors: [{ student_id: 'sis_user_id:nobody', error: 'invalid_student_id' }] });
		expect((await grades(students[1])).override_score).toBe(33.3);
	});

	it('updateFinalGradeOverrides: unusable input is refused before anything is sent', async () => {
		const cases: Array<[Json, string]> = [
			[{ overrideScores: {} }, 'at least one override score'],
			[{ overrideScores: { score: [{ student_id: ' ', override_score: 50 }] } }, 'at least one override score'],
			[{ overrideScores: { score: [{ student_id: students[0], override_score: 'ninety' }] } }, 'is not a number'],
		];
		for (const [params, message] of cases) {
			const result = await runNode({
				resource: 'gradebook',
				operation: 'updateFinalGradeOverrides',
				params: { courseId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', operation: 'updateFinalGradeOverrides' });
			expect(String(result.error[0].errorMessage)).toContain(message);
		}
		expect((await grades(students[0])).override_score).toBeUndefined();
	});

	it('updateFinalGradeOverrides: Canvas refuses an unknown grading period, students, and courses without final grade override', async () => {
		const overrideScores = { score: [{ student_id: students[0], override_score: 12 }] };
		const badPeriod = await runNode({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			params: { courseId, overrideScores, options: { grading_period_id: '99999999' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(badPeriod.success).toEqual([]);
		expect(badPeriod.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'updateFinalGradeOverrides' });
		expect(String(badPeriod.error[0].errorMessage)).toContain('invalid_grading_period');

		const asStudent = await runNode({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			persona: 'student',
			params: { courseId, overrideScores, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });

		const notEnabled = await runNode({
			resource: 'gradebook',
			operation: 'updateFinalGradeOverrides',
			params: { courseId: plainCourseId, overrideScores, errorHandling: { onError: 'continueWithError' } },
		});
		expect(notEnabled.success).toEqual([]);
		expect(notEnabled.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
		expect((await grades(students[0])).override_score).toBeUndefined();
	});
});
