import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxCourse, deleteSandboxCourse, enroll, sandboxStudents } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: moderatedGrading. A course of its own with a moderated assignment:
 * two graders (the admin and the teacher persona, who is also the final grader)
 * give provisional grades through the Submissions API, then the node moderates.
 *
 * Students 1-12 have two provisional grades (9 from the admin, 6 from the teacher),
 * student 13 has one (9), student 14 none.
 */
describe('moderatedGrading', () => {
	let course: SandboxCourse;
	let courseId = '';
	let assignmentId = '';
	let plainAssignmentId = '';
	let students: number[] = [];
	/** provisional grade IDs per student: { admin, teacher } */
	const grades = new Map<number, { admin?: number; teacher?: number }>();

	const base = (): string => `/api/v1/courses/${courseId}/assignments/${assignmentId}`;
	const gradeable = (): Promise<Json[]> =>
		canvas().getAll<Json>(`${base()}/gradeable_students?include[]=provisional_grades`);
	const selectedGradeOf = async (studentId: number): Promise<unknown> =>
		(await gradeable()).find((s) => s.id === studentId)?.selected_provisional_grade_id;
	const moderatedIds = async (): Promise<number[]> =>
		(await canvas().getAll<Json>(`${base()}/moderated_students`)).map((u) => Number(u.id));

	beforeAll(async () => {
		course = await createSandboxCourse('moderation', { students: 14, personas: ['teacher', 'student'] });
		courseId = course.id;
		students = course.studentIds;

		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: {
				name: unique('Moderated essay'),
				points_possible: 10,
				submission_types: ['online_text_entry'],
				published: true,
				moderated_grading: true,
				grader_count: 2,
				final_grader_id: Number(fx('teacherUserId')),
			},
		});
		assignmentId = String(assignment.id);
		const plain = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: unique('Not moderated'), points_possible: 10, submission_types: ['none'], published: true },
		});
		plainAssignmentId = String(plain.id);

		const teacher = new CanvasClient('teacher');
		for (const [index, studentId] of students.entries()) {
			const path = `${base()}/submissions/${studentId}`;
			if (index < 13) await canvas().put(path, { submission: { posted_grade: '9', provisional: true } });
			if (index < 12) await teacher.put(path, { submission: { posted_grade: '6', provisional: true } });
		}
		for (const student of await gradeable()) {
			const entry: { admin?: number; teacher?: number } = {};
			for (const grade of (student.provisional_grades ?? []) as Json[]) {
				if (grade.scorer_id === Number(fx('adminUserId'))) entry.admin = Number(grade.provisional_grade_id);
				if (grade.scorer_id === Number(fx('teacherUserId'))) entry.teacher = Number(grade.provisional_grade_id);
			}
			grades.set(Number(student.id), entry);
		}
		expect(grades.get(students[0])).toMatchObject({ admin: expect.any(Number), teacher: expect.any(Number) });
		expect(grades.get(students[12])?.teacher).toBeUndefined();
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
	});

	it('listModeratedStudents: returns every student of the moderation set, across pages', async () => {
		const expected = await moderatedIds();
		expect(expected.length).toBeGreaterThan(10);
		for (const id of students) expect(expected).toContain(id);

		const defaults = await runOk({ resource: 'moderatedGrading', operation: 'listModeratedStudents', params: { courseId, assignmentId } });
		expect(defaults.map((u) => u.id)).toEqual(expected);
		expect(defaults[0]).toMatchObject({ name: expect.any(String), sortable_name: expect.any(String) });

		const twoPages = await runOk({
			resource: 'moderatedGrading',
			operation: 'listModeratedStudents',
			persona: 'teacher',
			params: { courseId, assignmentId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(twoPages.map((u) => u.id)).toEqual(expected.slice(0, 10));

		const all = await runOk({
			resource: 'moderatedGrading',
			operation: 'listModeratedStudents',
			params: { courseId: `sis_course_id:${course.sisId}`, assignmentId: Number(assignmentId), pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id)).toEqual(expected);
	});

	it('selectStudentsForModeration: adds students to the moderation set and returns them', async () => {
		// A student who joins after the assignment was created.
		const [late] = (await sandboxStudents(15)).slice(14);
		await enroll(courseId, late, 'StudentEnrollment');

		const selected = await runOk({
			resource: 'moderatedGrading',
			operation: 'selectStudentsForModeration',
			// Typed with spaces; the admin is not a student of the course and is left out by Canvas.
			params: { courseId, assignmentId, studentIds: `${late}, ${students[0]} ,${fx('adminUserId')}` },
		});
		expect(selected.map((u) => u.id).sort()).toEqual([late, students[0]].sort());
		expect(await moderatedIds()).toContain(late);

		// IDs as an array of numbers from an expression.
		const again = await runOk({
			resource: 'moderatedGrading',
			operation: 'selectStudentsForModeration',
			items: [{ ids: [students[1], students[2]] }],
			params: { courseId, assignmentId, studentIds: '={{ $json.ids }}' },
		});
		expect(again.map((u) => u.id).sort()).toEqual([students[1], students[2]].sort());
	});

	it('getProvisionalGradeStatus: by student ID', async () => {
		const [status] = await runOk({
			resource: 'moderatedGrading',
			operation: 'getProvisionalGradeStatus',
			params: { courseId, assignmentId, identificationMethod: 'studentId', studentId: students[0] },
		});
		// Without "Last Updated At" Canvas only says whether the caller could still add a grade.
		expect(status).toEqual({ needs_provisional_grade: true });
	});

	it('getProvisionalGradeStatus: with "Last Updated At" the provisional grades are included', async () => {
		const result = await runNode({
			resource: 'moderatedGrading',
			operation: 'getProvisionalGradeStatus',
			persona: 'teacher',
			items: [{ student: students[0] }, { student: students[12] }, { student: students[13] }, { student: 99999999 }],
			params: {
				courseId,
				assignmentId,
				identificationMethod: 'studentId',
				studentId: '={{ $json.student }}',
				options: { last_updated_at: '2020-01-01T00:00:00Z' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toHaveLength(3);
		const [both, single, none] = result.success;
		const ids = (status: Json): number[] => (status.provisional_grades as Json[]).map((g) => Number(g.provisional_grade_id));
		expect(ids(both).sort()).toEqual([grades.get(students[0])?.admin, grades.get(students[0])?.teacher].sort());
		expect((both.provisional_grades as Json[]).map((g) => g.score).sort()).toEqual([6, 9]);
		expect((both.provisional_grades as Json[])[0]).toMatchObject({ selected: false, final: false });
		expect(ids(single)).toEqual([grades.get(students[12])?.admin]);
		expect(none.provisional_grades).toEqual([]);

		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'moderatedGrading', originalItem: { student: 99999999 } });
	});

	it('getProvisionalGradeStatus: by anonymous ID (its own Canvas endpoint)', async () => {
		const submission = await canvas().get<Json>(`${base()}/submissions/${students[1]}`);
		const anonymousId = String(submission.anonymous_id);
		expect(anonymousId).toMatch(/^[A-Za-z0-9]{5}$/);

		const [status] = await runOk({
			resource: 'moderatedGrading',
			operation: 'getProvisionalGradeStatus',
			params: {
				courseId,
				assignmentId,
				identificationMethod: 'anonymousId',
				anonymousId,
				options: { last_updated_at: '2020-01-01T00:00:00Z' },
			},
		});
		expect((status.provisional_grades as Json[]).map((g) => g.provisional_grade_id).sort()).toEqual(
			[grades.get(students[1])?.admin, grades.get(students[1])?.teacher].sort(),
		);

		const unknown = await runNode({
			resource: 'moderatedGrading',
			operation: 'getProvisionalGradeStatus',
			params: { courseId, assignmentId, identificationMethod: 'anonymousId', anonymousId: 'zzzzz', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('selectProvisionalGrade: the final grader picks the grade a student will receive', async () => {
		const pick = grades.get(students[0])?.admin as number;
		const [selection] = await runOk({
			resource: 'moderatedGrading',
			operation: 'selectProvisionalGrade',
			persona: 'teacher',
			params: { courseId, assignmentId, provisionalGradeId: pick },
		});
		expect(selection).toEqual({ assignment_id: Number(assignmentId), student_id: students[0], selected_provisional_grade_id: pick });
		expect(await selectedGradeOf(students[0])).toBe(pick);
	});

	it('selectProvisionalGrade: a grade that does not belong to the assignment is "not found"', async () => {
		const result = await runNode({
			resource: 'moderatedGrading',
			operation: 'selectProvisionalGrade',
			params: { courseId, assignmentId, provisionalGradeId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'moderatedGrading', operation: 'selectProvisionalGrade' });
	});

	it('publishProvisionalGrades: refused while a student with several grades has none selected', async () => {
		const result = await runNode({
			resource: 'moderatedGrading',
			operation: 'publishProvisionalGrades',
			persona: 'teacher',
			params: { courseId, assignmentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', operation: 'publishProvisionalGrades' });
		expect(String(result.error[0].errorMessage)).toContain('All submissions must have a selected grade');
	});

	it('bulkSelectProvisionalGrades: selects one grade per student and returns the selections that changed', async () => {
		const picks = students.slice(1, 12).map((id) => grades.get(id)?.teacher as number);
		const changed = await runOk({
			resource: 'moderatedGrading',
			operation: 'bulkSelectProvisionalGrades',
			// Typed with spaces; an ID that is not a grade of this assignment is ignored by Canvas.
			params: { courseId, assignmentId, provisionalGradeIds: `${picks.join(', ')}, 99999999` },
		});
		expect(changed).toHaveLength(11);
		expect(changed.map((s) => s.student_id).sort()).toEqual(students.slice(1, 12).sort());
		expect(changed.map((s) => s.selected_provisional_grade_id).sort()).toEqual([...picks].sort());

		const after = await gradeable();
		for (const id of students.slice(1, 12)) {
			expect(after.find((s) => s.id === id)?.selected_provisional_grade_id).toBe(grades.get(id)?.teacher);
		}
		// The earlier single selection is untouched.
		expect(after.find((s) => s.id === students[0])?.selected_provisional_grade_id).toBe(grades.get(students[0])?.admin);
	});

	it('bulkSelectProvisionalGrades: selecting what is already selected changes nothing and yields no items', async () => {
		const result = await runNode({
			resource: 'moderatedGrading',
			operation: 'bulkSelectProvisionalGrades',
			persona: 'teacher',
			items: [{ ids: [grades.get(students[1])?.teacher, grades.get(students[2])?.teacher] }],
			// IDs as an array of numbers from an expression.
			params: { courseId, assignmentId, provisionalGradeIds: '={{ $json.ids }}' },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([]);

		// Switching one student to the other grader's grade reports exactly that change.
		const [switched] = await runOk({
			resource: 'moderatedGrading',
			operation: 'bulkSelectProvisionalGrades',
			params: { courseId, assignmentId, provisionalGradeIds: String(grades.get(students[1])?.admin) },
		});
		expect(switched).toEqual({
			assignment_id: Number(assignmentId),
			student_id: students[1],
			selected_provisional_grade_id: grades.get(students[1])?.admin,
		});
	});

	it('errors: students may not moderate; an assignment without moderated grading is refused', async () => {
		for (const operation of ['listModeratedStudents', 'publishProvisionalGrades', 'bulkSelectProvisionalGrades', 'getProvisionalGradeStatus']) {
			const result = await runNode({
				resource: 'moderatedGrading',
				operation,
				persona: 'student',
				params: {
					courseId,
					assignmentId,
					provisionalGradeIds: String(grades.get(students[2])?.admin),
					studentId: students[2],
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'moderatedGrading', operation });
		}
		expect(await selectedGradeOf(students[2])).toBe(grades.get(students[2])?.teacher);

		for (const operation of ['publishProvisionalGrades', 'getProvisionalGradeStatus']) {
			const result = await runNode({
				resource: 'moderatedGrading',
				operation,
				params: { courseId, assignmentId: plainAssignmentId, studentId: students[0], errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
			expect(String(result.error[0].errorMessage)).toContain('Assignment does not use moderated grading');
		}
	});

	it('publishProvisionalGrades: the selected grades become the students\' grades', async () => {
		const [result] = await runOk({
			resource: 'moderatedGrading',
			operation: 'publishProvisionalGrades',
			persona: 'teacher',
			params: { courseId, assignmentId },
		});
		expect(result).toEqual({ message: 'OK' });

		const submissions = await canvas().getAll<Json>(`${base()}/submissions`);
		const scoreOf = (studentId: number): unknown => submissions.find((s) => s.user_id === studentId)?.score;
		expect(scoreOf(students[0])).toBe(9); // admin's grade, selected individually
		expect(scoreOf(students[1])).toBe(9); // switched to the admin's grade
		expect(scoreOf(students[2])).toBe(6); // teacher's grade, selected in bulk
		expect(scoreOf(students[12])).toBe(9); // the only provisional grade
		expect(scoreOf(students[13])).toBeNull(); // never graded
	});

	it('after publishing, Canvas refuses further moderation and says why', async () => {
		for (const operation of ['publishProvisionalGrades', 'getProvisionalGradeStatus']) {
			const result = await runNode({
				resource: 'moderatedGrading',
				operation,
				params: { courseId, assignmentId, studentId: students[0], errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'moderatedGrading', operation });
			expect(String(result.error[0].errorMessage)).toContain('Assignment grades have already been published');
		}
	});
});
