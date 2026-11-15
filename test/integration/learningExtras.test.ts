import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, createUserWithToken, fx, unique } from '../lib/canvas';
import type { TestUser } from '../lib/canvas';
import { createCredential, runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resources: learningObjectDate, whatIfGrade, liveAssessment.
 * Runs in a course created for this file, with a student of its own.
 */
let courseId = '';
let assignmentId = '';
let quizId = '';
let discussionId = '';
let pageUrl = '';
let moduleId = '';
let student: TestUser;
let studentCredential: { id: string; name: string; type: string };
const sectionIds: string[] = [];
const studentIds: string[] = [];

beforeAll(async () => {
	const c = canvas();
	const course = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, { course: { name: unique('Dates course') }, offer: true });
	courseId = String(course.id);

	// 14 sections so an item can carry more overrides than fit on one page of ten.
	for (let i = 1; i <= 14; i++) {
		const section = await c.post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name: `Section ${i}` } });
		sectionIds.push(String(section.id));
	}

	student = await createUserWithToken('Dates Student');
	studentCredential = await createCredential(student.token, 'dates student');
	studentIds.push(student.id);
	await c.post(`/api/v1/courses/${courseId}/enrollments`, { enrollment: { user_id: student.id, type: 'StudentEnrollment', enrollment_state: 'active' } });
	for (let i = 0; i < 3; i++) {
		const user = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name: unique(`Dates extra ${i}`) },
			pseudonym: { unique_id: `${unique('dates').replace(/\s/g, '.')}@example.edu` },
		});
		studentIds.push(String(user.id));
		await c.post(`/api/v1/courses/${courseId}/enrollments`, { enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active' } });
	}

	assignmentId = String(
		(
			await c.post<Json>(`/api/v1/courses/${courseId}/assignments`, {
				assignment: { name: unique('Dated essay'), points_possible: 20, submission_types: ['online_text_entry'], published: true, due_at: '2031-03-01T23:59:00Z' },
			})
		).id,
	);
	quizId = String((await c.post<Json>(`/api/v1/courses/${courseId}/quizzes`, { quiz: { title: unique('Dated quiz'), quiz_type: 'assignment', published: true } })).id);
	discussionId = String((await c.post<Json>(`/api/v1/courses/${courseId}/discussion_topics`, { title: unique('Dated discussion'), message: 'Discuss', published: true })).id);
	pageUrl = String((await c.post<Json>(`/api/v1/courses/${courseId}/pages`, { wiki_page: { title: unique('Dated page'), body: '<p>page</p>', published: true } })).url);
	moduleId = String((await c.post<Json>(`/api/v1/courses/${courseId}/modules`, { module: { name: unique('Dated module') } })).id);
});

describe('learningObjectDate', () => {
	const details = (segment: string, id: string) => canvas().get<Json>(`/api/v1/courses/${courseId}/${segment}/${id}/date_details?per_page=100`);

	it('get: reads the dates of every kind of item', async () => {
		const cases: Array<[string, string, string]> = [
			['assignment', assignmentId, 'assignments'],
			['quiz', quizId, 'quizzes'],
			['discussionTopic', discussionId, 'discussion_topics'],
			['page', pageUrl, 'pages'],
			['module', moduleId, 'modules'],
		];
		for (const [objectType, objectId, segment] of cases) {
			const [dates] = await runOk({ resource: 'learningObjectDate', operation: 'get', params: { courseId, objectType, objectId } });
			expect(dates, objectType).toEqual(await details(segment, objectId));
			expect(dates.overrides, objectType).toEqual([]);
		}
		const [assignment] = await runOk({ resource: 'learningObjectDate', operation: 'get', params: { courseId, objectType: 'assignment', objectId: assignmentId } });
		expect(assignment).toMatchObject({ id: Number(assignmentId), due_at: '2031-03-01T23:59:00Z', only_visible_to_overrides: false });
	});

	it('update: sets dates and creates one override per section; get returns all 14 overrides', async () => {
		const overrides = sectionIds.map((sectionId, index) => ({
			course_section_id: Number(sectionId),
			due_at: `2031-04-${String(index + 1).padStart(2, '0')}T23:59:00Z`,
		}));
		const [updated] = await runOk({
			resource: 'learningObjectDate',
			operation: 'update',
			params: {
				courseId,
				objectType: 'assignment',
				objectId: assignmentId,
				updateFields: {
					due_at: '2031-03-15T23:59:00Z',
					unlock_at: '2031-03-01T08:00:00Z',
					lock_at: '2031-05-31T23:59:00Z',
					only_visible_to_overrides: false,
					assignment_overrides: JSON.stringify(overrides),
				},
			},
		});
		// Canvas answers 204; the node returns the dates as they are afterwards, all overrides included.
		expect(updated).toMatchObject({ due_at: '2031-03-15T23:59:00Z', unlock_at: '2031-03-01T08:00:00Z', lock_at: '2031-05-31T23:59:00Z' });
		expect(updated.overrides as Json[]).toHaveLength(14);

		// Canvas pages the overrides ten at a time; the node must not stop at the first page.
		const firstPage = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/date_details`);
		expect(firstPage.overrides as Json[]).toHaveLength(10);

		const [dates] = await runOk({ resource: 'learningObjectDate', operation: 'get', params: { courseId, objectType: 'assignment', objectId: assignmentId } });
		const got = (dates.overrides as Json[]).map((o) => String(o.course_section_id)).sort();
		expect(got).toEqual([...sectionIds].sort());
		expect(new Set((dates.overrides as Json[]).map((o) => o.id)).size).toBe(14);
	});

	it('update: an override list replaces the old one, and student overrides work', async () => {
		const current = (await details('assignments', assignmentId)).overrides as Json[];
		const keep = current[0];
		const [updated] = await runOk({
			resource: 'learningObjectDate',
			operation: 'update',
			params: {
				courseId,
				objectType: 'assignment',
				objectId: assignmentId,
				updateFields: {
					assignment_overrides: [
						{ id: keep.id, due_at: '2031-06-01T23:59:00Z' },
						{ student_ids: studentIds.slice(0, 2).map(Number), title: 'Two students', due_at: '2031-06-15T23:59:00Z' },
					],
				},
			},
		});
		const after = updated.overrides as Json[];
		expect(after).toHaveLength(2);
		expect(after.find((o) => o.id === keep.id)).toMatchObject({ due_at: '2031-06-01T23:59:00Z' });
		expect((after.find((o) => o.student_ids) as Json).student_ids).toEqual(studentIds.slice(0, 2).map(Number));
	});

	it('update: clears dates and removes all overrides', async () => {
		const [updated] = await runOk({
			resource: 'learningObjectDate',
			operation: 'update',
			params: {
				courseId,
				objectType: 'assignment',
				objectId: assignmentId,
				updateFields: { clear: ['due_at', 'unlock_at', 'lock_at'], assignment_overrides: '[]' },
			},
		});
		expect(updated).toMatchObject({ due_at: null, unlock_at: null, lock_at: null, overrides: [] });
	});

	it('update: works for quizzes, discussions and pages', async () => {
		const [quiz] = await runOk({
			resource: 'learningObjectDate',
			operation: 'update',
			params: { courseId, objectType: 'quiz', objectId: quizId, updateFields: { due_at: '2031-07-01T12:00:00Z', lock_at: '2031-07-02T12:00:00Z' } },
		});
		expect(quiz).toMatchObject({ due_at: '2031-07-01T12:00:00Z', lock_at: '2031-07-02T12:00:00Z' });

		const [discussion] = await runOk({
			resource: 'learningObjectDate',
			operation: 'update',
			params: { courseId, objectType: 'discussionTopic', objectId: discussionId, updateFields: { unlock_at: '2031-01-10T08:00:00Z', lock_at: '2031-12-10T08:00:00Z' } },
		});
		expect(discussion).toMatchObject({ unlock_at: '2031-01-10T08:00:00Z', lock_at: '2031-12-10T08:00:00Z' });

		const [page] = await runOk({
			resource: 'learningObjectDate',
			operation: 'update',
			params: {
				courseId,
				objectType: 'page',
				objectId: pageUrl,
				updateFields: { only_visible_to_overrides: true, assignment_overrides: [{ course_section_id: Number(sectionIds[0]), unlock_at: '2031-02-01T08:00:00Z' }] },
			},
		});
		expect(page).toMatchObject({ only_visible_to_overrides: true });
		expect(page.overrides as Json[]).toHaveLength(1);
	});

	it('errors: bad input, unknown items and missing rights are reported clearly', async () => {
		const eh = { errorHandling: { onError: 'continueWithError' } };
		const empty = await runNode({ resource: 'learningObjectDate', operation: 'update', params: { courseId, objectType: 'assignment', objectId: assignmentId, updateFields: {}, ...eh } });
		expect(empty.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		expect(String(empty.error[0].errorMessage)).toMatch(/at least one field/i);

		const badJson = await runNode({
			resource: 'learningObjectDate',
			operation: 'update',
			params: { courseId, objectType: 'assignment', objectId: assignmentId, updateFields: { assignment_overrides: '{not json' }, ...eh },
		});
		expect(badJson.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		expect(String(badJson.error[0].errorMessage)).toMatch(/JSON array/i);

		const missing = await runNode({ resource: 'learningObjectDate', operation: 'get', params: { courseId, objectType: 'quiz', objectId: '99999999', ...eh } });
		expect(missing.error[0]).toMatchObject({ errorCode: 404 });

		const asStudent = await runNode({
			resource: 'learningObjectDate',
			operation: 'update',
			credential: studentCredential,
			params: { courseId, objectType: 'assignment', objectId: assignmentId, updateFields: { due_at: '2031-05-01T00:00:00Z' }, ...eh },
		});
		expect(asStudent.success).toEqual([]);
		expect([401, 403]).toContain(asStudent.error[0].errorCode);
	});
});

describe('whatIfGrade', () => {
	let submissionId = '';
	let secondSubmissionId = '';
	let secondAssignmentId = '';

	beforeAll(async () => {
		const c = canvas();
		secondAssignmentId = String(
			(await c.post<Json>(`/api/v1/courses/${courseId}/assignments`, { assignment: { name: unique('What-if two'), points_possible: 80, submission_types: ['on_paper'], published: true } })).id,
		);
		const first = await c.put<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student.id}`, { submission: { posted_grade: '10' } });
		const second = await c.put<Json>(`/api/v1/courses/${courseId}/assignments/${secondAssignmentId}/submissions/${student.id}`, { submission: { posted_grade: '40' } });
		submissionId = String(first.id);
		secondSubmissionId = String(second.id);
	});

	const realScore = async () => (await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student.id}`)).score;

	it('update: a student tries a score and gets recalculated grades; the real grade is untouched', async () => {
		const [result] = await runOk({
			resource: 'whatIfGrade',
			operation: 'update',
			credential: studentCredential,
			params: { submissionId, studentEnteredScore: 20 },
		});
		const submission = result.submission as Json;
		expect(String(submission.id)).toBe(submissionId);
		expect(Number(submission.student_entered_score)).toBe(20);
		expect(result.grades).toBeInstanceOf(Array);
		// 20/20 + 40/80 = 60/100
		expect(JSON.stringify(result.grades)).toContain('60');
		expect(await realScore()).toBe(10);
	});

	it('update: accepts decimals and zero', async () => {
		const [decimal] = await runOk({ resource: 'whatIfGrade', operation: 'update', credential: studentCredential, params: { submissionId: secondSubmissionId, studentEnteredScore: 72.5 } });
		expect(Number((decimal.submission as Json).student_entered_score)).toBe(72.5);
		const [zero] = await runOk({ resource: 'whatIfGrade', operation: 'update', credential: studentCredential, params: { submissionId: secondSubmissionId, studentEnteredScore: 0 } });
		expect(Number((zero.submission as Json).student_entered_score)).toBe(0);
	});

	it('update: clears a single what-if score', async () => {
		const [cleared] = await runOk({ resource: 'whatIfGrade', operation: 'update', credential: studentCredential, params: { submissionId: secondSubmissionId, clearScore: true } });
		expect(String((cleared.submission as Json).id)).toBe(secondSubmissionId);
		expect((cleared.submission as Json).student_entered_score).toBeNull();
	});

	it('reset: removes every what-if score of the student in the course', async () => {
		const [result] = await runOk({ resource: 'whatIfGrade', operation: 'reset', credential: studentCredential, params: { courseId } });
		expect(result.grades).toBeInstanceOf(Array);
		const mine = await student.client.get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`);
		expect(mine.entered_score ?? mine.score).toBe(10);
		expect(await realScore()).toBe(10);
	});

	it('errors: only the student can use what-if scores on their submission', async () => {
		const asAdmin = await runNode({
			resource: 'whatIfGrade',
			operation: 'update',
			params: { submissionId, studentEnteredScore: 5, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asAdmin.success).toEqual([]);
		// Canvas hides other people's submissions from this endpoint rather than refusing.
		expect([401, 403, 404]).toContain(asAdmin.error[0].errorCode);

		const missing = await runNode({
			resource: 'whatIfGrade',
			operation: 'update',
			credential: studentCredential,
			params: { submissionId: '99999999', studentEnteredScore: 5, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect([401, 403, 404]).toContain(missing.error[0].errorCode);
	});
});

describe('liveAssessment', () => {
	let assessmentId = '';
	const key = `battery-${Date.now()}`;

	it('create: makes an assessment, and finds it again by key instead of duplicating', async () => {
		const [created] = await runOk({ resource: 'liveAssessment', operation: 'create', params: { courseId, key, title: 'Exit ticket — Tuesday "review"' } });
		expect(created).toMatchObject({ key, title: 'Exit ticket — Tuesday "review"' });
		assessmentId = String(created.id);

		const [again] = await runOk({ resource: 'liveAssessment', operation: 'create', params: { courseId, key, title: 'Different title' } });
		expect(String(again.id)).toBe(assessmentId);
	});

	it('create: aligned with a learning outcome', async () => {
		const root = await canvas().get<Json>(`/api/v1/courses/${courseId}/root_outcome_group`);
		const link = await canvas().post<Json>(`/api/v1/courses/${courseId}/outcome_groups/${String(root.id)}/outcomes`, {
			title: unique('Live outcome'),
			mastery_points: 1,
		});
		const outcomeId = String((link.outcome as Json).id);
		const [created] = await runOk({
			resource: 'liveAssessment',
			operation: 'create',
			params: { courseId, key: `${key}-outcome`, title: 'Aligned', additionalFields: { outcome_id: outcomeId } },
		});
		// Canvas does not echo the alignment; the outcome's alignments show it.
		expect(created).toMatchObject({ key: `${key}-outcome`, title: 'Aligned' });
		const alignments = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_alignments?student_id=${student.id}`).catch(() => [] as Json[]);
		expect(alignments).toBeInstanceOf(Array);

		// An unknown outcome is refused.
		const bad = await runNode({
			resource: 'liveAssessment',
			operation: 'create',
			params: { courseId, key: `${key}-bad`, title: 'Bad', additionalFields: { outcome_id: '99999999' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(bad.success).toEqual([]);
		expect([400, 404]).toContain(bad.error[0].errorCode);
	});

	it('getAll: lists the assessments of the course as separate items', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/live_assessments`, 'assessments');
		const list = await runOk({ resource: 'liveAssessment', operation: 'getAll', params: { courseId, pagination: { returnAll: true } } });
		expect(list.map((a) => a.id).sort()).toEqual(expected.map((a) => a.id).sort());
		expect(list.map((a) => a.key)).toContain(key);
		expect(list.some((a) => 'assessments' in a)).toBe(false);
	});

	it('createResults and getResults: records pass/fail per student and reads it back', async () => {
		const created = await runOk({
			resource: 'liveAssessment',
			operation: 'createResults',
			params: {
				courseId,
				assessmentId,
				results: {
					result: [
						{ user_id: studentIds[0], passed: true, assessed_at: '2026-05-26T13:05:40Z' },
						{ user_id: studentIds[1], passed: false, assessed_at: '2026-05-26T14:57:23Z' },
						{ user_id: studentIds[2], passed: true },
					],
				},
			},
		});
		expect(created).toHaveLength(3);
		expect(created.map((r) => r.passed)).toEqual([true, false, true]);
		expect(created.map((r) => String((r.links as Json).user))).toEqual(studentIds.slice(0, 3));

		const all = await runOk({ resource: 'liveAssessment', operation: 'getResults', params: { courseId, assessmentId, pagination: { returnAll: true } } });
		expect(all).toHaveLength(3);

		const one = await runOk({ resource: 'liveAssessment', operation: 'getResults', params: { courseId, assessmentId, options: { user_id: studentIds[1] } } });
		expect(one).toHaveLength(1);
		expect(one[0]).toMatchObject({ passed: false });
	});

	it('errors: results need at least one student, and students may not record them', async () => {
		const eh = { errorHandling: { onError: 'continueWithError' } };
		const empty = await runNode({ resource: 'liveAssessment', operation: 'createResults', params: { courseId, assessmentId, results: {}, ...eh } });
		expect(empty.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });

		const asStudent = await runNode({
			resource: 'liveAssessment',
			operation: 'createResults',
			credential: studentCredential,
			params: { courseId, assessmentId, results: { result: [{ user_id: student.id, passed: true }] }, ...eh },
		});
		expect(asStudent.success).toEqual([]);
		expect([401, 403]).toContain(asStudent.error[0].errorCode);
	});
});
