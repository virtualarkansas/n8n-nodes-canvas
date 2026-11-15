import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import {
	downloadFile,
	ensureAssignmentsBattery,
	ensureSubmissionExtrasBattery,
	ensureSubmissionsBattery,
	patternBuffer,
	uploadDirect,
} from './contentBattery';
import type { SubmissionExtrasBattery, SubmissionsBattery } from './contentBattery';
import { startFileServer } from './support/fileServer';
import type { FileServer } from './support/fileServer';

/**
 * Resource: submission. Runs in a dedicated course with 57 students, two
 * sections and long-lived assignments of every submission type (see
 * contentBattery.ts). Students used for grading tests are not the ones whose
 * submissions the list tests count.
 *
 * Anonymous grading, read state and restricted uploads use a second course
 * whose features and assignments are made for them (the "extras" battery).
 */
describe('submission', () => {
	let battery: SubmissionsBattery;
	let extras: SubmissionExtrasBattery;
	let courseId = '';
	let base = '';
	/** Bulk students nothing else depends on. */
	let gradees: string[] = [];
	/** Bulk students for uploads and grading across assignments. */
	let uploaders: string[] = [];
	let server: FileServer;

	const submissionFromCanvas = (assignmentId: string, userId: string, query = ''): Promise<Json> =>
		canvas().get<Json>(`${base}/assignments/${assignmentId}/submissions/${userId}${query}`);
	const key = (list: Json[]): string[] => list.map((s) => `${String(s.assignment_id)}:${String(s.user_id)}`).sort();
	const userIds = (list: Json[]): string[] => list.map((s) => String(s.user_id));

	beforeAll(async () => {
		battery = await ensureSubmissionsBattery();
		extras = await ensureSubmissionExtrasBattery();
		courseId = battery.courseId;
		base = `/api/v1/courses/${courseId}`;
		gradees = battery.studentIds.slice(40, 46);
		uploaders = battery.studentIds.slice(24, 30);
		server = await startFileServer();
	}, 1_200_000);

	afterAll(() => {
		server?.close();
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: pages through every submission of an assignment without duplicates', async () => {
		const expected = await canvas().getAll<Json>(`${base}/assignments/${battery.bulkAssignmentId}/submissions`);
		expect(expected).toHaveLength(57);
		const params = { courseId, assignmentId: battery.bulkAssignmentId };

		const defaults = await runOk({ resource: 'submission', operation: 'getAll', params });
		expect(defaults.map((s) => s.id)).toEqual(expected.slice(0, 50).map((s) => s.id));

		const all = await runOk({ resource: 'submission', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(all.map((s) => s.id)).toEqual(expected.map((s) => s.id));
		expect(new Set(all.map((s) => s.id)).size).toBe(57);
		expect(all.filter((s) => s.workflow_state === 'graded')).toHaveLength(10);
		expect(all.filter((s) => s.workflow_state === 'submitted')).toHaveLength(10);

		const some = await runOk({
			resource: 'submission',
			operation: 'getAll',
			params: { ...params, pagination: { perPage: 10, maxPages: 2 } },
		});
		expect(some.map((s) => s.id)).toEqual(expected.slice(0, 20).map((s) => s.id));
	});

	it('getAll: every include adds its data', async () => {
		const [first] = await runOk({
			resource: 'submission',
			operation: 'getAll',
			params: {
				courseId,
				assignmentId: battery.bulkAssignmentId,
				options: {
					grouped: false,
					include: [
						'assignment',
						'course',
						'group',
						'read_state',
						'rubric_assessment',
						'student_entered_score',
						'submission_comments',
						'submission_history',
						'submission_html_comments',
						'user',
						'visibility',
					],
				},
				pagination: { perPage: 3, maxPages: 1 },
			},
		});
		expect(first.assignment).toMatchObject({ id: Number(battery.bulkAssignmentId) });
		expect(first.course).toMatchObject({ id: Number(courseId) });
		expect(first.user).toMatchObject({ id: first.user_id });
		expect(first.submission_comments).toBeInstanceOf(Array);
		expect(first.submission_history).toBeInstanceOf(Array);
		expect(first.submission_html_comments).toBeInstanceOf(Array);
		expect(['read', 'unread']).toContain(first.read_state);
		expect(first).toHaveProperty('assignment_visible');
		expect(first).toHaveProperty('group');

		const [plain] = await runOk({
			resource: 'submission',
			operation: 'getAll',
			params: { courseId, assignmentId: battery.bulkAssignmentId, pagination: { perPage: 1, maxPages: 1 } },
		});
		for (const extra of ['assignment', 'course', 'user', 'submission_comments', 'submission_history', 'read_state']) {
			expect(plain).not.toHaveProperty(extra);
		}
	});

	it('getAll: "grouped" returns one submission per group for a group assignment', async () => {
		const params = { courseId, assignmentId: battery.group.assignmentId };
		const expected = await canvas().getAll<Json>(`${base}/assignments/${battery.group.assignmentId}/submissions?grouped=true`);
		const grouped = await runOk({
			resource: 'submission',
			operation: 'getAll',
			params: { ...params, options: { grouped: true, include: ['group'] }, pagination: { returnAll: true } },
		});
		expect(grouped.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
		// Two groups with five students between them: 57 students collapse to 54 representatives.
		expect(grouped).toHaveLength(54);

		const individual = await runOk({ resource: 'submission', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(individual).toHaveLength(57);
	});

	it('getAll: the section context only returns the students of that section', async () => {
		const listed = await runOk({
			resource: 'submission',
			operation: 'getAll',
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: battery.bulkAssignmentId,
				pagination: { returnAll: true },
			},
		});
		expect(userIds(listed).sort()).toEqual([...battery.sectionTwo.studentIds].sort());
	});

	// --------------------------------------------------------------------- get

	it('get: returns one submission, with every include', async () => {
		const student = battery.gradedIds[0];
		const [submission] = await runOk({
			resource: 'submission',
			operation: 'get',
			params: {
				courseId,
				assignmentId: battery.bulkAssignmentId,
				userId: student,
				options: {
					include: [
						'course',
						'full_rubric_assessment',
						'read_state',
						'rubric_assessment',
						'student_entered_score',
						'submission_comments',
						'submission_history',
						'submission_html_comments',
						'user',
						'visibility',
					],
				},
			},
		});
		expect(submission).toMatchObject({
			user_id: Number(student),
			assignment_id: Number(battery.bulkAssignmentId),
			workflow_state: 'graded',
			submission_type: 'online_text_entry',
		});
		expect(submission.course).toMatchObject({ id: Number(courseId) });
		expect(submission.user).toMatchObject({ id: Number(student) });
		expect(submission.submission_comments).toBeInstanceOf(Array);
		expect((submission.submission_history as Json[]).length).toBeGreaterThanOrEqual(1);
		expect(['read', 'unread']).toContain(submission.read_state);
		expect(submission).toHaveProperty('assignment_visible');
	});

	it('get: IDs from expressions, the section context, and SIS user IDs', async () => {
		const student = battery.sectionTwo.studentIds[0];
		const [viaSection] = await runOk({
			resource: 'submission',
			operation: 'get',
			items: [{ assignment: Number(battery.bulkAssignmentId), user: Number(student) }],
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: '={{ $json.assignment }}',
				userId: '={{ $json.user }}',
			},
		});
		expect(viaSection.user_id).toBe(Number(student));

		const [viaSis] = await runOk({
			resource: 'submission',
			operation: 'get',
			params: { courseId, assignmentId: battery.bulkAssignmentId, userId: 'sis_user_id:W5682-S-001' },
		});
		expect(viaSis.user_id).toBe(Number(battery.studentIds[0]));
	});

	it('get: a student of another section is not found through the section; a student cannot read a classmate', async () => {
		const wrongSection = await runNode({
			resource: 'submission',
			operation: 'get',
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: battery.bulkAssignmentId,
				userId: battery.studentIds[0],
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongSection.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const classmate = await runNode({
			resource: 'submission',
			operation: 'get',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.bulkAssignmentId,
				userId: battery.studentIds[0],
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(classmate.success).toEqual([]);
		expect(classmate.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(classmate.error[0].errorCode);

		const [own] = await runOk({
			resource: 'submission',
			operation: 'get',
			persona: 'student',
			params: { courseId, assignmentId: battery.bulkAssignmentId, userId: 'self' },
		});
		expect(own.user_id).toBe(Number(fx('studentUserId')));
	});

	// ------------------------------------------------------- getAllForStudents

	it('getAllForStudents: all students and all assignments, paginated', async () => {
		const expected = await canvas().getAll<Json>(`${base}/students/submissions?student_ids[]=all`);
		expect(expected.length).toBeGreaterThan(300);

		const defaults = await runOk({ resource: 'submission', operation: 'getAllForStudents', params: { courseId, studentIds: 'all' } });
		expect(defaults.map((s) => s.id)).toEqual(expected.slice(0, 50).map((s) => s.id));

		const all = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			params: { courseId, studentIds: 'all', pagination: { returnAll: true } },
		});
		expect(all.map((s) => s.id)).toEqual(expected.map((s) => s.id));
		expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
	});

	it('getAllForStudents: student IDs and assignment IDs narrow the list', async () => {
		const students = battery.studentIds.slice(0, 3);
		const assignments = [battery.bulkAssignmentId, battery.playgroundAssignmentId];
		const listed = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			params: {
				courseId,
				studentIds: ` ${students.join(', ')} `,
				options: { assignment_ids: assignments.join(',') },
				pagination: { returnAll: true },
			},
		});
		expect(key(listed)).toEqual(students.flatMap((s) => assignments.map((a) => `${a}:${s}`)).sort());

		// One ID of each, arriving as numbers from an expression.
		const single = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			items: [{ student: Number(students[0]), assignment: Number(assignments[0]) }],
			params: { courseId, studentIds: '={{ $json.student }}', options: { assignment_ids: '={{ $json.assignment }}' } },
		});
		expect(key(single)).toEqual([`${assignments[0]}:${students[0]}`]);
	});

	it('getAllForStudents: workflow state, dates, order and enrollment state', async () => {
		const run = (options: Json): Promise<Json[]> =>
			runOk({
				resource: 'submission',
				operation: 'getAllForStudents',
				params: {
					courseId,
					studentIds: 'all',
					options: { assignment_ids: battery.bulkAssignmentId, ...options },
					pagination: { returnAll: true },
				},
			});

		expect(userIds(await run({ workflow_state: 'graded' })).sort()).toEqual([...battery.gradedIds].sort());
		expect(userIds(await run({ workflow_state: 'submitted' })).sort()).toEqual(battery.submittedIds.slice(10).sort());
		expect(await run({ workflow_state: 'unsubmitted' })).toHaveLength(37);
		expect(await run({ workflow_state: 'pending_review' })).toEqual([]);

		expect(userIds(await run({ submitted_since: '2020-01-01T00:00:00Z' })).sort()).toEqual([...battery.submittedIds].sort());
		expect(await run({ submitted_since: '2090-01-01T00:00:00Z' })).toEqual([]);
		expect(userIds(await run({ graded_since: '2020-01-01T00:00:00Z' })).sort()).toEqual([...battery.gradedIds].sort());
		expect(await run({ graded_since: '2090-01-01T00:00:00Z' })).toEqual([]);

		const newestGraded = await run({ workflow_state: 'graded', order: 'graded_at', order_direction: 'descending' });
		const times = newestGraded.map((s) => Date.parse(String(s.graded_at)));
		expect(times).toEqual([...times].sort((a, b) => b - a));
		const byIdDescending = await run({ order: 'id', order_direction: 'descending' });
		const idsDescending = byIdDescending.map((s) => Number(s.id));
		expect(idsDescending).toEqual([...idsDescending].sort((a, b) => b - a));

		expect(await run({ enrollment_state: 'active', state_based_on_date: true })).toHaveLength(57);
		expect(await run({ enrollment_state: 'concluded', state_based_on_date: false })).toEqual([]);
		// Nobody was enrolled through the SIS, and the assignment is not posted to it.
		expect(await run({ post_to_sis: true })).toEqual([]);
		expect(await run({ post_to_sis: false })).toHaveLength(57);
	});

	it('getAllForStudents: grouped by student, with total scores and other includes', async () => {
		const students = battery.gradedIds.slice(0, 2);
		const grouped = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			params: {
				courseId,
				studentIds: students.join(','),
				options: {
					grouped: true,
					include: ['assignment', 'course', 'submission_comments', 'submission_history', 'total_scores', 'user', 'visibility'],
				},
				pagination: { returnAll: true },
			},
		});
		expect(grouped.map((g) => String(g.user_id)).sort()).toEqual([...students].sort());
		for (const entry of grouped) {
			expect(entry).toHaveProperty('computed_final_score');
			expect(entry).toHaveProperty('computed_current_score');
			const submissions = entry.submissions as Json[];
			expect(submissions.length).toBeGreaterThan(5);
			expect(submissions[0].assignment).toBeTypeOf('object');
			expect(submissions[0].user).toBeTypeOf('object');
			expect(submissions[0].submission_history).toBeInstanceOf(Array);
		}

		const flat = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			params: { courseId, studentIds: students.join(','), options: { grouped: false }, pagination: { returnAll: true } },
		});
		expect(flat[0]).not.toHaveProperty('submissions');
		expect(flat[0]).toHaveProperty('assignment_id');
	});

	it('getAllForStudents: grading period, section context and a student\'s own submissions', async () => {
		const periods = (await ensureAssignmentsBattery()).periods;
		const inPeriod = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			params: {
				courseId: periods.courseId,
				studentIds: 'all',
				options: { grading_period_id: periods.secondPeriodId },
				pagination: { returnAll: true },
			},
		});
		expect(inPeriod.map((s) => String(s.assignment_id))).toEqual([periods.secondAssignmentId]);

		const section = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				studentIds: 'all',
				options: { assignment_ids: battery.bulkAssignmentId },
				pagination: { returnAll: true },
			},
		});
		expect(userIds(section).sort()).toEqual([...battery.sectionTwo.studentIds].sort());

		// Without student IDs Canvas returns the submissions of the calling user.
		const own = await runOk({
			resource: 'submission',
			operation: 'getAllForStudents',
			persona: 'student2',
			params: { courseId, studentIds: '', pagination: { returnAll: true } },
		});
		expect(own.length).toBeGreaterThan(5);
		expect(new Set(userIds(own))).toEqual(new Set([fx('student2UserId')]));

		const others = await runNode({
			resource: 'submission',
			operation: 'getAllForStudents',
			persona: 'student2',
			params: { courseId, studentIds: 'all', errorHandling: { onError: 'continueWithError' } },
		});
		// "all" silently narrows to the student's own submissions; naming a classmate is refused.
		expect(new Set(userIds(others.success))).toEqual(new Set([fx('student2UserId')]));
		const classmate = await runNode({
			resource: 'submission',
			operation: 'getAllForStudents',
			persona: 'student2',
			params: { courseId, studentIds: battery.studentIds[0], errorHandling: { onError: 'continueWithError' } },
		});
		expect(classmate.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
	});

	// ------------------------------------------- summary and gradeable students

	it('getSummary: counts graded, ungraded and missing submissions', async () => {
		const [summary] = await runOk({
			resource: 'submission',
			operation: 'getSummary',
			params: { courseId, assignmentId: battery.bulkAssignmentId },
		});
		expect(summary).toEqual({ graded: 10, ungraded: 10, not_submitted: 37 });

		const groupPath = `${base}/assignments/${battery.group.assignmentId}/submission_summary`;
		const [grouped] = await runOk({
			resource: 'submission',
			operation: 'getSummary',
			params: { courseId, assignmentId: battery.group.assignmentId, options: { grouped: true, include_deactivated: true } },
		});
		expect(grouped).toEqual(await canvas().get<Json>(`${groupPath}?grouped=true&include_deactivated=true`));
		const [ungrouped] = await runOk({
			resource: 'submission',
			operation: 'getSummary',
			params: { courseId, assignmentId: battery.group.assignmentId, options: { grouped: false, include_deactivated: false } },
		});
		expect(ungrouped).toEqual(await canvas().get<Json>(groupPath));
		const total = (s: Json): number => Number(s.graded) + Number(s.ungraded) + Number(s.not_submitted);
		// Grouped counts groups (2), not students (57).
		expect(total(grouped)).toBe(2);
		expect(total(ungrouped)).toBe(57);
	});

	it('listGradeableStudents: lists every student once, sorted on request', async () => {
		const path = `${base}/assignments/${battery.bulkAssignmentId}/gradeable_students`;
		const params = { courseId, assignmentId: battery.bulkAssignmentId };
		const expected = await canvas().getAll<Json>(path);
		expect(expected).toHaveLength(57);

		const all = await runOk({ resource: 'submission', operation: 'listGradeableStudents', params: { ...params, pagination: { returnAll: true } } });
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		const defaults = await runOk({ resource: 'submission', operation: 'listGradeableStudents', params });
		expect(defaults).toHaveLength(50);

		const byNameDesc = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudents',
			params: { ...params, options: { sort: 'name', order: 'desc' }, pagination: { returnAll: true } },
		});
		expect(byNameDesc.map((u) => u.id)).toEqual((await canvas().getAll<Json>(`${path}?sort=name&order=desc`)).map((u) => u.id));
		const byNameAsc = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudents',
			params: { ...params, options: { sort: 'name', order: 'asc' }, pagination: { returnAll: true } },
		});
		expect(byNameAsc.map((u) => u.id)).toEqual([...byNameDesc.map((u) => u.id)].reverse());
		expect(byNameAsc.map((u) => u.id)).not.toEqual(all.map((u) => u.id));
	});

	// ------------------------------------------------------------------- grade

	it('grade: points, percentage and a comment', async () => {
		const student = gradees[0];
		// Canvas strips HTML tags from comments; everything else is kept as typed.
		const text = unique('Kommentar ünï "quoted" & more 💬');
		const [graded] = await runOk({
			resource: 'submission',
			operation: 'grade',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				userId: student,
				gradeFields: { posted_grade: '13.5', comment: `<b>${text}</b>` },
			},
		});
		expect(graded).toMatchObject({ user_id: Number(student), score: 13.5, grade: '13.5', workflow_state: 'graded' });
		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, student, '?include[]=submission_comments');
		expect(actual).toMatchObject({ score: 13.5, grader_id: Number(fx('adminUserId')) });
		expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain(text);

		await runOk({
			resource: 'submission',
			operation: 'grade',
			params: { courseId, assignmentId: battery.playgroundAssignmentId, userId: student, gradeFields: { posted_grade: '50%' } },
		});
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, student)).score).toBe(10);
	});

	it('grade: excuse, and an empty grade removes the grade again', async () => {
		const student = gradees[1];
		const params = { courseId, assignmentId: battery.playgroundAssignmentId, userId: student };
		await runOk({ resource: 'submission', operation: 'grade', params: { ...params, gradeFields: { excuse: true } } });
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, student)).toMatchObject({ excused: true, score: null });

		await runOk({ resource: 'submission', operation: 'grade', params: { ...params, gradeFields: { posted_grade: '7' } } });
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, student)).toMatchObject({ excused: false, score: 7 });

		await runOk({ resource: 'submission', operation: 'grade', params: { ...params, gradeFields: { posted_grade: '' } } });
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, student)).toMatchObject({ score: null, grade: null });
	});

	it('grade: late policy status and seconds late', async () => {
		const student = gradees[2];
		const params = { courseId, assignmentId: battery.playgroundAssignmentId, userId: student };
		const set = (gradeFields: Json): Promise<Json[]> => runOk({ resource: 'submission', operation: 'grade', params: { ...params, gradeFields } });

		await set({ late_policy_status: 'late', seconds_late_override: 7200 });
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, student)).toMatchObject({
			late_policy_status: 'late',
			late: true,
			seconds_late: 7200,
		});
		await set({ late_policy_status: 'missing' });
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, student)).toMatchObject({ late_policy_status: 'missing', missing: true });
		await set({ late_policy_status: 'extended' });
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, student)).late_policy_status).toBe('extended');
		await set({ late_policy_status: 'none' });
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, student)).toMatchObject({
			late_policy_status: 'none',
			late: false,
			missing: false,
		});
	});

	it('grade: a rubric assessment sets the criteria and, through them, the grade', async () => {
		const student = gradees[3];
		const [content, form] = battery.rubric.criterionIds;
		await runOk({
			resource: 'submission',
			operation: 'grade',
			params: {
				courseId,
				assignmentId: battery.rubric.assignmentId,
				userId: student,
				gradeFields: {
					prefer_points_over_scheme: true,
					rubric_assessment: JSON.stringify({ [content]: { points: 5, comments: 'Almost complete' }, [form]: { points: 2 } }),
				},
			},
		});
		const actual = await submissionFromCanvas(battery.rubric.assignmentId, student, '?include[]=rubric_assessment');
		expect(actual.score).toBe(7);
		expect(actual.rubric_assessment).toMatchObject({
			[content]: { points: 5, comments: 'Almost complete' },
			[form]: { points: 2 },
		});

		// As an object from an expression, together with an explicit grade: the grade wins.
		const result = await runNode({
			resource: 'submission',
			operation: 'grade',
			items: [{ assessment: { [content]: { points: 6 }, [form]: { points: 4 } } }],
			params: {
				courseId,
				assignmentId: battery.rubric.assignmentId,
				userId: student,
				gradeFields: { rubric_assessment: '={{ $json.assessment }}' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect((await submissionFromCanvas(battery.rubric.assignmentId, student)).score).toBe(10);
	});

	it('grade: a group assignment grades and comments the whole group', async () => {
		const [leader, ...others] = battery.group.groups[0].memberIds;
		const text = unique('Group feedback');
		await runOk({
			resource: 'submission',
			operation: 'grade',
			params: {
				courseId,
				assignmentId: battery.group.assignmentId,
				userId: leader,
				gradeFields: { posted_grade: '8', comment: text, group_comment: true },
			},
		});
		for (const member of [leader, ...others]) {
			const actual = await submissionFromCanvas(battery.group.assignmentId, member, '?include[]=submission_comments');
			expect(actual.score, `member ${member}`).toBe(8);
			expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain(text);
		}
		// Without "group comment" only the addressed student gets the comment.
		const solo = unique('Private feedback');
		await runOk({
			resource: 'submission',
			operation: 'grade',
			params: { courseId, assignmentId: battery.group.assignmentId, userId: leader, gradeFields: { comment: solo, group_comment: false } },
		});
		const other = await submissionFromCanvas(battery.group.assignmentId, others[0], '?include[]=submission_comments');
		expect((other.submission_comments as Json[]).map((c) => c.comment)).not.toContain(solo);
	});

	it('grade: through a section, for several input items, with failures reported per item', async () => {
		const [inSection] = battery.sectionTwo.studentIds;
		const result = await runNode({
			resource: 'submission',
			operation: 'grade',
			items: [
				{ user: Number(inSection), grade: '4' },
				{ user: Number(battery.studentIds[0]), grade: '5' },
				{ user: battery.sectionTwo.studentIds[1], grade: 'banana' },
				{ user: battery.sectionTwo.studentIds[2], grade: 'pass' },
			],
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: battery.playgroundAssignmentId,
				userId: '={{ $json.user }}',
				gradeFields: { posted_grade: '={{ $json.grade }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		// Item 1 is not in the section. Items 0 and 3 are graded ("pass" on a points assignment gives
		// full marks). Item 2 is not a grade Canvas understands: it answers 200 and leaves no grade.
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }, { item: 3 }]);
		expect(result.success.map((s) => s.score)).toEqual([4, null, 20]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'submission', operation: 'grade' });
		expect((result.error[0].originalItem as Json).user).toBe(Number(battery.studentIds[0]));
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, inSection)).score).toBe(4);
	});

	it('grade: a grade Canvas cannot parse removes the existing grade without an error; a bad rubric assessment is refused', async () => {
		const student = battery.sectionTwo.studentIds[1];
		const params = { courseId, assignmentId: battery.playgroundAssignmentId, userId: student };
		await runOk({ resource: 'submission', operation: 'grade', params: { ...params, gradeFields: { posted_grade: '9' } } });
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, student)).score).toBe(9);
		const [result] = await runOk({ resource: 'submission', operation: 'grade', params: { ...params, gradeFields: { posted_grade: 'banana' } } });
		expect(result.score).toBeNull();
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, student)).score).toBeNull();

		const badRubric = await runNode({
			resource: 'submission',
			operation: 'grade',
			params: {
				courseId,
				assignmentId: battery.rubric.assignmentId,
				userId: student,
				gradeFields: { rubric_assessment: '{"no_such_criterion": {"points": 3}}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badRubric.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'invalid rubric_assessment',
		});
		const notJson = await runNode({
			resource: 'submission',
			operation: 'grade',
			params: {
				courseId,
				assignmentId: battery.rubric.assignmentId,
				userId: student,
				gradeFields: { rubric_assessment: '{points: 3' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(notJson.error[0]).toMatchObject({ errorCode: 0, errorMessage: 'Rubric Assessment must be valid JSON' });
	});

	it('grade: a student may not grade', async () => {
		const result = await runNode({
			resource: 'submission',
			operation: 'grade',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				userId: fx('studentUserId'),
				gradeFields: { posted_grade: '20' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(result.error[0].errorCode);
	});

	// --------------------------------------------------------------- bulkGrade

	it('bulkGrade: grades, excuses and comments several students in one job', async () => {
		const [a, b, c] = gradees.slice(3, 6);
		const text = unique('Bulk comment');
		const [progress] = await runOk({
			resource: 'submission',
			operation: 'bulkGrade',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				grades: {
					gradeValues: [
						{ student_id: a, posted_grade: '11' },
						{ student_id: ` ${b} `, posted_grade: '', excuse: true },
						{ student_id: c, posted_grade: '75%', text_comment: text, group_comment: false },
					],
				},
			},
		});
		expect(progress).toMatchObject({ tag: 'submissions_update', context_type: 'Course' });

		let state = '';
		for (let i = 0; i < 90 && state !== 'completed' && state !== 'failed'; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			state = String((await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`)).workflow_state);
		}
		expect(state).toBe('completed');
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, a)).score).toBe(11);
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, b)).excused).toBe(true);
		const third = await submissionFromCanvas(battery.playgroundAssignmentId, c, '?include[]=submission_comments');
		expect(third.score).toBe(15);
		expect((third.submission_comments as Json[]).map((comment) => comment.comment)).toContain(text);
	});

	it('bulkGrade: entries from expressions, the section context, and errors', async () => {
		const [inSection] = battery.sectionTwo.studentIds.slice(3);
		const [progress] = await runOk({
			resource: 'submission',
			operation: 'bulkGrade',
			items: [{ student: Number(inSection), grade: 3 }],
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: battery.playgroundAssignmentId,
				grades: { gradeValues: [{ student_id: '={{ $json.student }}', posted_grade: '={{ $json.grade }}' }] },
			},
		});
		let state = '';
		for (let i = 0; i < 90 && state !== 'completed' && state !== 'failed'; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			state = String((await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`)).workflow_state);
		}
		expect(state).toBe('completed');
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, inSection)).score).toBe(3);

		const none = await runNode({
			resource: 'submission',
			operation: 'bulkGrade',
			params: { courseId, assignmentId: battery.playgroundAssignmentId, grades: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(none.error[0].errorCode).toBe(0);
		expect(String(none.error[0].errorMessage)).toContain('At least one grade entry is required');

		const forbidden = await runNode({
			resource: 'submission',
			operation: 'bulkGrade',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				grades: { gradeValues: [{ student_id: fx('studentUserId'), posted_grade: '20' }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403]).toContain(forbidden.error[0].errorCode);
	});

	// ------------------------------------------------------------------ submit

	it('submit: text entry as the student, with a comment', async () => {
		const before = await submissionFromCanvas(battery.playgroundAssignmentId, fx('studentUserId'));
		const body = `<p>Antwort ünï 答案 🎓 ${unique('text')}</p><ul><li>one &amp; two</li></ul>`;
		const comment = unique('Submitted with a comment');
		const [submission] = await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_text_entry',
				body,
				additionalFields: { comment },
			},
		});
		expect(submission).toMatchObject({ user_id: Number(fx('studentUserId')), submission_type: 'online_text_entry', workflow_state: 'submitted' });
		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, fx('studentUserId'), '?include[]=submission_comments');
		expect(actual.body).toBe(body);
		expect(actual.attempt).toBe(Number(before.attempt ?? 0) + 1);
		expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain(comment);
	});

	it('submit: a URL', async () => {
		const url = `https://example.com/work/${Date.now()}?a=1&b=two%20words`;
		await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student2',
			params: { courseId, assignmentId: battery.playgroundAssignmentId, submissionType: 'online_url', url },
		});
		expect(await submissionFromCanvas(battery.playgroundAssignmentId, fx('student2UserId'))).toMatchObject({
			submission_type: 'online_url',
			url,
		});
	});

	it('submit: uploaded files', async () => {
		const student = new CanvasClient('student');
		const uploadPath = `${base}/assignments/${battery.playgroundAssignmentId}/submissions/self/files`;
		const first = await uploadDirect(student, uploadPath, `${unique('essay').replace(/\s/g, '-')}.txt`, Buffer.from('essay text'), 'text/plain');
		const second = await uploadDirect(student, uploadPath, `${unique('appendix').replace(/\s/g, '-')}.csv`, Buffer.from('a,b\n1,2\n'), 'text/csv');

		const [submission] = await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_upload',
				fileIds: `${String(first.id)}, ${String(second.id)}`,
			},
		});
		expect(submission.submission_type).toBe('online_upload');
		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, fx('studentUserId'));
		expect((actual.attachments as Json[]).map((a) => a.display_name).sort()).toEqual([first.display_name, second.display_name].sort());

		// A single file ID arriving as a number from an expression.
		await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			items: [{ file: first.id }],
			params: { courseId, assignmentId: battery.playgroundAssignmentId, submissionType: 'online_upload', fileIds: '={{ $json.file }}' },
		});
		const again = await submissionFromCanvas(battery.playgroundAssignmentId, fx('studentUserId'));
		// Handing in a file a second time makes Canvas attach a renamed copy of it.
		expect(again.attachments as Json[]).toHaveLength(1);
		expect(String((again.attachments as Json[])[0].display_name)).toMatch(/^essay-.*\.txt$/);
		expect(again.attempt).toBe(Number(actual.attempt) + 1);
	});

	it('submit: file IDs that are not numbers, or not the student\'s files, are refused', async () => {
		const notNumbers = await runNode({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_upload',
				fileIds: '12, essay.pdf',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(notNumbers.error[0].errorCode).toBe(0);
		expect(String(notNumbers.error[0].errorMessage)).toContain('File IDs must be a comma-separated list of numeric IDs');

		const foreign = await runNode({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_upload',
				fileIds: battery.annotation.fileId,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(foreign.success).toEqual([]);
		expect(foreign.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});

	it('submit: media recording, student annotation and basic LTI launch', async () => {
		const mediaId = `m-${unique('rec').replace(/[^a-z0-9]/gi, '')}`;
		for (const type of ['audio', 'video']) {
			await runOk({
				resource: 'submission',
				operation: 'submit',
				persona: 'student2',
				params: {
					courseId,
					assignmentId: battery.playgroundAssignmentId,
					submissionType: 'media_recording',
					mediaCommentId: `${mediaId}-${type}`,
					mediaCommentType: type,
				},
			});
			const actual = await submissionFromCanvas(battery.playgroundAssignmentId, fx('student2UserId'));
			expect(actual.submission_type).toBe('media_recording');
			expect(actual.media_comment).toMatchObject({ media_id: `${mediaId}-${type}`, media_type: type });
		}

		const [annotation] = await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student2',
			params: {
				courseId,
				assignmentId: battery.annotation.assignmentId,
				submissionType: 'student_annotation',
				annotatableAttachmentId: battery.annotation.fileId,
			},
		});
		expect(annotation).toMatchObject({ submission_type: 'student_annotation', workflow_state: 'submitted' });

		const launchUrl = `${fx('externalToolUrl')}?result=${Date.now()}`;
		await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student2',
			params: { courseId, assignmentId: battery.ltiAssignmentId, submissionType: 'basic_lti_launch', url: launchUrl },
		});
		const lti = await submissionFromCanvas(battery.ltiAssignmentId, fx('student2UserId'));
		expect(lti.submission_type).toBe('basic_lti_launch');
		expect(String(lti.url)).toContain(encodeURIComponent(launchUrl));
	});

	it('submit: on behalf of students, with a submission time, for several items and through a section', async () => {
		const [a, b] = battery.studentIds.slice(46, 48);
		const result = await runNode({
			resource: 'submission',
			operation: 'submit',
			items: [
				{ user: Number(a), text: '<p>first</p>' },
				{ user: Number(b), text: '<p>second</p>' },
			],
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_text_entry',
				body: '={{ $json.text }}',
				additionalFields: { user_id: '={{ $json.user }}', submitted_at: '2026-03-04T05:06:07Z', comment: 'Handed in on paper' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.success.map((s) => s.user_id)).toEqual([Number(a), Number(b)]);
		for (const [student, text] of [
			[a, '<p>first</p>'],
			[b, '<p>second</p>'],
		]) {
			const actual = await submissionFromCanvas(battery.playgroundAssignmentId, student, '?include[]=submission_comments');
			expect(actual).toMatchObject({ body: text, submitted_at: '2026-03-04T05:06:07Z', workflow_state: 'submitted' });
			expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain('Handed in on paper');
		}

		const inSection = battery.sectionTwo.studentIds[4];
		await runOk({
			resource: 'submission',
			operation: 'submit',
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_url',
				url: 'https://example.org/section-work',
				additionalFields: { user_id: inSection },
			},
		});
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, inSection)).url).toBe('https://example.org/section-work');
	});

	it('submit: a group submission with a group comment reaches every member', async () => {
		const [leader, ...others] = battery.group.groups[1].memberIds;
		const comment = unique('Group hand-in');
		const body = `<p>${unique('group work')}</p>`;
		await runOk({
			resource: 'submission',
			operation: 'submit',
			params: {
				courseId,
				assignmentId: battery.group.assignmentId,
				submissionType: 'online_text_entry',
				body,
				additionalFields: { user_id: leader, comment, group_comment: true },
			},
		});
		for (const member of [leader, ...others]) {
			const actual = await submissionFromCanvas(battery.group.assignmentId, member, '?include[]=submission_comments');
			expect(actual.body, `member ${member}`).toBe(body);
			expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain(comment);
		}
	});

	it('submit: Canvas refuses a type the assignment does not accept and users who are not students', async () => {
		const wrongType = await runNode({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.annotation.assignmentId,
				submissionType: 'online_url',
				url: 'https://example.com/x',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongType.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'Invalid submission[submission_type] given',
		});

		const notStudent = await runNode({
			resource: 'submission',
			operation: 'submit',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_text_entry',
				body: 'admin is not a student',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(notStudent.success).toEqual([]);
		expect(notStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });

		const onBehalfByStudent = await runNode({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_text_entry',
				body: 'not mine',
				additionalFields: { user_id: fx('student2UserId') },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(onBehalfByStudent.success).toEqual([]);
		expect([401, 403]).toContain(onBehalfByStudent.error[0].errorCode);
	});

	// ------------------------------------------------------------- read state

	it('markRead / markUnread: change the read state of a submission for the calling user', async () => {
		const student = fx('studentUserId');
		const params = { courseId, assignmentId: battery.playgroundAssignmentId, userId: student };
		const readState = async (): Promise<unknown> =>
			(
				await new CanvasClient('student').get<Json>(
					`${base}/assignments/${battery.playgroundAssignmentId}/submissions/${student}?include[]=read_state`,
				)
			).read_state;

		// A grade and feedback from the teacher make the submission unread for the student.
		await canvas().put(`${base}/assignments/${battery.playgroundAssignmentId}/submissions/${student}`, {
			submission: { posted_grade: '12' },
			comment: { text_comment: unique('Feedback to read') },
		});
		expect(await readState()).toBe('unread');

		// Grade, comments and rubric have a read state of their own: all of them have to be read.
		for (const item of ['grade', 'comment', 'rubric']) {
			const [marked] = await runOk({
				resource: 'submission',
				operation: 'markRead',
				persona: 'student',
				params: { ...params, options: { item } },
			});
			expect(marked).toEqual({ success: true });
		}
		const [read] = await runOk({ resource: 'submission', operation: 'markRead', persona: 'student', params });
		expect(read).toEqual({ success: true });
		expect(await readState()).toBe('read');

		const [unread] = await runOk({ resource: 'submission', operation: 'markUnread', persona: 'student', params });
		expect(unread).toEqual({ success: true });
		expect(await readState()).toBe('unread');

		const [viaSection] = await runOk({
			resource: 'submission',
			operation: 'markRead',
			persona: 'student',
			params: { contextType: 'section', sectionId: battery.sectionId, assignmentId: battery.playgroundAssignmentId, userId: 'self' },
		});
		expect(viaSection).toEqual({ success: true });
		expect(await readState()).toBe('read');
		const [unreadViaSection] = await runOk({
			resource: 'submission',
			operation: 'markUnread',
			persona: 'student',
			params: { contextType: 'section', sectionId: battery.sectionId, assignmentId: battery.playgroundAssignmentId, userId: 'self' },
		});
		expect(unreadViaSection).toEqual({ success: true });
		expect(await readState()).toBe('unread');

		const missing = await runNode({
			resource: 'submission',
			operation: 'markUnread',
			params: { courseId, assignmentId: '999999999', userId: student, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ------------------------------------------------------------- uploadFile

	const sha = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');
	const fileName = (label: string, extension: string): string => `${unique(label).replace(/\s/g, '-')}.${extension}`;
	const attachmentsOf = (submission: Json): Json[] => (submission.attachments ?? []) as Json[];
	const onError = { errorHandling: { onError: 'continueWithError' } };
	const waitForProgress = async (id: unknown, client: CanvasClient = canvas()): Promise<Json> => {
		let progress: Json = {};
		for (let i = 0; i < 90 && progress.workflow_state !== 'completed' && progress.workflow_state !== 'failed'; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			progress = await client.get<Json>(`/api/v1/progress/${String(id)}`);
		}
		return progress;
	};

	it('uploadFile + submit: a student uploads a file, hands it in, and it reads back byte for byte', async () => {
		const student = fx('studentUserId');
		const size = 70_001;
		const name = fileName('essay', 'bin');
		const before = await submissionFromCanvas(battery.playgroundAssignmentId, student);

		const uploaded = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			persona: 'student',
			binary: [{ fileName: name, mimeType: 'application/octet-stream', size }],
			params: { courseId, assignmentId: battery.playgroundAssignmentId, userId: 'self' },
		});
		expect(uploaded.failure, JSON.stringify(uploaded.failure)).toBeUndefined();
		expect(uploaded.error).toEqual([]);
		const [file] = uploaded.success;
		expect(file).toMatchObject({ display_name: name, size, 'content-type': 'application/octet-stream', upload_status: 'success' });

		// Canvas keeps the file in the student's folder for submissions to this course ...
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(file.folder_id)}`);
		expect(folder).toMatchObject({ context_type: 'User', context_id: Number(student), for_submissions: true });
		// ... and uploading alone hands nothing in.
		const untouched = await submissionFromCanvas(battery.playgroundAssignmentId, student);
		expect(untouched.attempt).toBe(before.attempt);

		const [submission] = await runOk({
			resource: 'submission',
			operation: 'submit',
			persona: 'student',
			items: [{ file: file.id }],
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_upload',
				fileIds: '={{ $json.file }}',
			},
		});
		expect(submission).toMatchObject({ submission_type: 'online_upload', workflow_state: 'submitted' });

		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, student);
		expect(actual.attempt).toBe(Number(before.attempt ?? 0) + 1);
		expect(attachmentsOf(actual).map((a) => a.id)).toEqual([file.id]);
		const downloaded = await downloadFile(attachmentsOf(actual)[0]);
		expect(downloaded.length).toBe(size);
		expect(sha(downloaded)).toBe(sha(patternBuffer(size)));
	});

	it('uploadFile + submit: a grader uploads files for a student, with names and types of their own, and hands them in on the student\'s behalf', async () => {
		const student = uploaders[0];
		// (Names are new on every run: in a submissions folder Canvas renames a second file of the same name.)
		const stamp = unique('up');
		const essayName = `Aufsatz ünï (final) "v2" ${stamp}.pdf`;
		const appendixName = `appendix ünï ${stamp}.csv`;
		const pdf = Buffer.from(`%PDF-1.4 ünï 课程 ${stamp}\n`);
		const appendixSize = 1_048_576 + 7;
		const uploaded = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			binary: [
				{
					fileName: 'scan-0001.bin',
					mimeType: 'application/octet-stream',
					b64: pdf.toString('base64'),
					json: { student: Number(student), name: essayName, type: 'application/pdf' },
				},
				// Without the options the name and type of the binary data are used. (The same student, by SIS ID.)
				{ fileName: appendixName, mimeType: 'text/csv', size: appendixSize, json: { student: 'sis_user_id:W5682-S-025', name: '', type: '' } },
			],
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				userId: '={{ $json.student }}',
				options: { content_type: '={{ $json.type }}', name: '={{ $json.name }}' },
			},
		});
		expect(uploaded.failure, JSON.stringify(uploaded.failure)).toBeUndefined();
		expect(uploaded.error).toEqual([]);
		const [essay, appendix] = uploaded.success;
		expect(essay).toMatchObject({ display_name: essayName, 'content-type': 'application/pdf', size: pdf.length });
		expect(appendix).toMatchObject({ display_name: appendixName, 'content-type': 'text/csv', size: appendixSize });
		expect(uploaded.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		// The files belong to the student, not to the grader who uploaded them.
		expect(appendix.folder_id).toBe(essay.folder_id);
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(essay.folder_id)}`);
		expect(folder).toMatchObject({ context_type: 'User', context_id: Number(student), for_submissions: true });

		const [submission] = await runOk({
			resource: 'submission',
			operation: 'submit',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_upload',
				fileIds: `${String(essay.id)},${String(appendix.id)}`,
				additionalFields: { user_id: student },
			},
		});
		expect(submission).toMatchObject({ user_id: Number(student), submission_type: 'online_upload' });

		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, student);
		const attachments = attachmentsOf(actual);
		expect(attachments.map((a) => a.id).sort()).toEqual([essay.id, appendix.id].sort());
		const byId = new Map(attachments.map((a) => [a.id, a]));
		expect((await downloadFile(byId.get(essay.id) as Json)).equals(pdf)).toBe(true);
		expect(sha(await downloadFile(byId.get(appendix.id) as Json))).toBe(sha(patternBuffer(appendixSize)));

		// "self" is the user of the credential, and the administrator is no student of the course.
		const self = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			binary: [{ fileName: 'mine.txt', mimeType: 'text/plain', b64: 'eA==' }],
			params: { courseId, assignmentId: battery.playgroundAssignmentId, userId: 'self', ...onError },
		});
		expect(self.success).toEqual([]);
		expect(self.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'submission', operation: 'uploadFile' });
	});

	it('uploadFile: through a section, only for the students of that section', async () => {
		const [inSection] = battery.sectionTwo.studentIds;
		const content = Buffer.from(`section upload ${unique('s')}\n`);
		const result = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			binary: [
				{ fileName: fileName('section', 'txt'), mimeType: 'text/plain', b64: content.toString('base64'), json: { user: inSection } },
				{ fileName: fileName('elsewhere', 'txt'), mimeType: 'text/plain', b64: 'eA==', json: { user: uploaders[0] } },
			],
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				assignmentId: battery.playgroundAssignmentId,
				userId: '={{ $json.user }}',
				...onError,
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((result.error[0].originalItem as Json).user).toBe(uploaders[0]);

		const [file] = result.success;
		expect((await downloadFile(file)).equals(content)).toBe(true);
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(file.folder_id)}`);
		expect(folder).toMatchObject({ context_type: 'User', context_id: Number(inSection) });

		// A student uploads for themselves through their own section.
		const own = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			persona: 'student2',
			binary: [{ fileName: fileName('own-section', 'txt'), mimeType: 'text/plain', b64: content.toString('base64') }],
			params: { contextType: 'section', sectionId: battery.sectionId, assignmentId: battery.playgroundAssignmentId, userId: 'self' },
		});
		expect(own.failure, JSON.stringify(own.failure)).toBeUndefined();
		expect(own.error).toEqual([]);
		expect((await canvas().get<Json>(`/api/v1/folders/${String(own.success[0].folder_id)}`)).context_id).toBe(Number(fx('student2UserId')));
	});

	it('uploadFile from URL: Canvas fetches the file; it is only handed in when asked to', async () => {
		expect(server.url, 'this machine has no address Canvas is willing to fetch from').not.toBe('');
		const student = fx('studentUserId');
		const stamp = unique('url');
		const stored = Buffer.concat([Buffer.from(stamp), patternBuffer(200_000)]);
		const handedIn = Buffer.from(`handed in straight from a URL ${stamp}\n`);
		server.serve('/stored.bin', stored, 'application/octet-stream');
		const handedInName = `handed in ünï ${stamp}.txt`;
		server.serve(`/${handedInName}`, handedIn);
		const params = { courseId, assignmentId: battery.playgroundAssignmentId, userId: 'self', uploadSource: 'url' };
		const before = await submissionFromCanvas(battery.playgroundAssignmentId, student);

		// Default: the file is stored for the student and nothing is handed in.
		const [file] = await runOk({
			resource: 'submission',
			operation: 'uploadFile',
			persona: 'student',
			params: {
				...params,
				fileUrl: `${server.url}/stored.bin?token=abc`,
				// (A content type Canvas has never heard of would be replaced by its own guess.)
				options: { comment: 'not used without Submit Assignment', content_type: 'application/zip', name: `Stored ünï ${stamp}.dat` },
			},
		});
		expect(file).toMatchObject({ display_name: `Stored ünï ${stamp}.dat`, 'content-type': 'application/zip', size: stored.length });
		expect(sha(await downloadFile(file))).toBe(sha(stored));
		const untouched = await submissionFromCanvas(battery.playgroundAssignmentId, student, '?include[]=submission_comments');
		expect(untouched.attempt).toBe(before.attempt);
		expect((untouched.submission_comments as Json[]).map((c) => c.comment)).not.toContain('not used without Submit Assignment');

		// Submit Assignment: Canvas hands the file in as soon as it has it, with the comment.
		const comment = unique('Straight from the URL');
		const [submitted] = await runOk({
			resource: 'submission',
			operation: 'uploadFile',
			persona: 'student',
			params: {
				...params,
				fileUrl: `${server.url}/${encodeURIComponent(handedInName)}`,
				submitAssignment: true,
				waitForCompletion: true,
				options: { comment },
			},
		});
		// Without a name the last part of the URL is used, decoded.
		expect(submitted).toMatchObject({ display_name: handedInName, size: handedIn.length });
		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, student, '?include[]=submission_comments');
		expect(actual).toMatchObject({ submission_type: 'online_upload', attempt: Number(before.attempt ?? 0) + 1 });
		expect(attachmentsOf(actual).map((a) => a.id)).toEqual([submitted.id]);
		expect((await downloadFile(attachmentsOf(actual)[0])).equals(handedIn)).toBe(true);
		expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain(comment);
	});

	it('uploadFile from URL: without waiting the progress is returned; a grader stores a file for a student and hands it in', async () => {
		const student = uploaders[1];
		const content = Buffer.from(`fetched for a student ${unique('url')}\n`);
		server.serve('/for-student.txt', content);
		const before = await submissionFromCanvas(battery.playgroundAssignmentId, student);

		const [started] = await runOk({
			resource: 'submission',
			operation: 'uploadFile',
			items: [{ student: Number(student) }],
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				userId: '={{ $json.student }}',
				uploadSource: 'url',
				fileUrl: `${server.url}/for-student.txt`,
				submitAssignment: false,
				waitForCompletion: false,
			},
		});
		const progress = started.progress as Json;
		expect(progress).toMatchObject({ tag: 'upload_via_url', context_type: 'Assignment', context_id: Number(battery.playgroundAssignmentId) });
		const done = await waitForProgress(progress.id);
		expect(done.workflow_state).toBe('completed');
		const fileId = String((done.results as Json).id);
		// Nothing was handed in for the student ...
		const untouched = await submissionFromCanvas(battery.playgroundAssignmentId, student);
		expect(untouched.attempt).toBe(before.attempt);
		expect(attachmentsOf(untouched).map((a) => String(a.id))).not.toContain(fileId);

		// ... until the grader does so with the file.
		await runOk({
			resource: 'submission',
			operation: 'submit',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				submissionType: 'online_upload',
				fileIds: fileId,
				additionalFields: { user_id: student },
			},
		});
		const actual = await submissionFromCanvas(battery.playgroundAssignmentId, student);
		expect(actual.attempt).toBe(Number(before.attempt ?? 0) + 1);
		expect(attachmentsOf(actual).map((a) => String(a.id))).toEqual([fileId]);
		expect((await downloadFile(attachmentsOf(actual)[0])).equals(content)).toBe(true);
	});

	it('uploadFile: Canvas refuses file types the assignment does not accept, other students\' submissions and assignments without uploads', async () => {
		const restricted = { courseId: extras.courseId, assignmentId: extras.restrictedUploadAssignmentId, userId: 'self' };
		const stamp = unique('r');
		const text = Buffer.from(`allowed ${stamp}\n`);
		const result = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			persona: 'student',
			binary: [
				{ fileName: 'notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', b64: 'eA==' },
				// The extension counts whatever its case.
				{ fileName: `notes ${stamp}.TXT`, mimeType: 'text/plain', b64: text.toString('base64') },
				// The name given in the options decides, not the name of the binary data.
				{ fileName: 'scan.bin', mimeType: 'application/octet-stream', b64: 'JVBERg==', json: { name: `scan ${stamp}.pdf` } },
				{ fileName: 'scan.pdf', mimeType: 'application/pdf', b64: 'JVBERg==', json: { name: 'scan.exe' } },
			],
			params: { ...restricted, options: { name: '={{ $json.name }}' }, ...onError },
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 1 }, { item: 2 }]);
		expect(result.success.map((f) => f.display_name)).toEqual([`notes ${stamp}.TXT`, `scan ${stamp}.pdf`]);
		expect((await downloadFile(result.success[0])).equals(text)).toBe(true);
		expect(result.error).toHaveLength(2);
		for (const refused of result.error) {
			expect(refused).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'filetype not allowed' });
		}

		const upload = (persona: string, params: Json, input = [{ fileName: 'x.txt', mimeType: 'text/plain', b64: 'eA==' }]): ReturnType<typeof runNode> =>
			runNode({ resource: 'submission', operation: 'uploadFile', persona, binary: input, params: { ...params, ...onError } });

		// The bulk assignment takes text and URLs, no uploads.
		const noUploads = await upload('student', { courseId, assignmentId: battery.bulkAssignmentId, userId: 'self' });
		expect(noUploads.success).toEqual([]);
		expect(noUploads.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(noUploads.error[0].errorCode);

		const classmate = await upload('student', { courseId, assignmentId: battery.playgroundAssignmentId, userId: fx('student2UserId') });
		expect(classmate.success).toEqual([]);
		expect(classmate.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });

		const unknown = await upload('admin', { courseId, assignmentId: '999999999', userId: uploaders[0] });
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// Problems with the input never reach Canvas.
		const empty = await upload('student', { courseId, assignmentId: battery.playgroundAssignmentId, userId: 'self' }, [
			{ fileName: 'empty.txt', mimeType: 'text/plain', size: 0 } as never,
		]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(empty.error[0].errorMessage)).toContain('The file to upload is empty');
		const noBinary = await upload('student', { courseId, assignmentId: battery.playgroundAssignmentId, userId: 'self' }, [
			{ json: { note: 'no file here' } } as never,
		]);
		expect(noBinary.success).toEqual([]);
		expect(noBinary.error[0]).toMatchObject({ errorCode: 0, operation: 'uploadFile' });

		// A URL Canvas cannot fetch fails with the reason.
		const unreachable = await runNode({
			resource: 'submission',
			operation: 'uploadFile',
			persona: 'student',
			params: {
				courseId,
				assignmentId: battery.playgroundAssignmentId,
				userId: 'self',
				uploadSource: 'url',
				fileUrl: `${server.url}/does-not-exist.txt`,
				...onError,
			},
		});
		expect(unreachable.success).toEqual([]);
		expect(String(unreachable.error[0].errorMessage)).toContain('Canvas URL upload failed');
	});

	// --------------------------------------------- bulkMarkRead, clearUnread

	const extrasBase = (): string => `/api/v1/courses/${extras.courseId}`;
	/**
	 * Give a student something unread on an assignment of the extras course: a new grade,
	 * optionally with a comment. Returns the ID of the submission.
	 */
	const makeUnread = async (assignmentId: string, userId: string, withComment = false): Promise<string> => {
		const path = `${extrasBase()}/assignments/${assignmentId}/submissions/${userId}`;
		const current = await canvas().get<Json>(path);
		// Only a grade that differs from the current one counts as news.
		const updated = await canvas().put<Json>(path, {
			submission: { posted_grade: current.score === 3 ? '4' : '3' },
			...(withComment ? { comment: { text_comment: unique('Feedback to read') } } : {}),
		});
		return String(updated.id);
	};
	/**
	 * The read state as the student sees it. Asking for it marks the grade as read, so every
	 * state is asked for exactly once.
	 */
	const readStateOf = async (persona: string, assignmentId: string): Promise<unknown> =>
		(await new CanvasClient(persona).get<Json>(`${extrasBase()}/assignments/${assignmentId}/submissions/self?include[]=read_state`))
			.read_state;

	it('bulkMarkRead: marks the listed submissions of the calling user as read, and no others', async () => {
		const [a, b] = extras.readStateAssignmentIds;
		const ownA = await makeUnread(a, fx('studentUserId'));
		const ownB = await makeUnread(b, fx('studentUserId'));
		const classmateA = await makeUnread(a, fx('student2UserId'));

		const [marked] = await runOk({
			resource: 'submission',
			operation: 'bulkMarkRead',
			persona: 'student',
			params: { courseId: extras.courseId, submissionIds: ` ${ownA}, ${classmateA} ` },
		});
		expect(marked).toEqual({ success: true });
		expect(await readStateOf('student', a)).toBe('read');
		// Not listed: still unread. Listed but somebody else's: skipped without an error.
		expect(await readStateOf('student', b)).toBe('unread');
		expect(await readStateOf('student2', a)).toBe('unread');

		// Through the section, with a single ID arriving as a number from an expression.
		expect(await makeUnread(b, fx('studentUserId'))).toBe(ownB);
		const [viaSection] = await runOk({
			resource: 'submission',
			operation: 'bulkMarkRead',
			persona: 'student',
			items: [{ submission: Number(ownB) }],
			params: { contextType: 'section', sectionId: extras.sectionId, submissionIds: '={{ $json.submission }}' },
		});
		expect(viaSection).toEqual({ success: true });
		expect(await readStateOf('student', b)).toBe('read');
	});

	it('bulkMarkRead: IDs that are not numbers are rejected by the node, an unknown course by Canvas', async () => {
		const notNumbers = await runNode({
			resource: 'submission',
			operation: 'bulkMarkRead',
			persona: 'student',
			params: { courseId: extras.courseId, submissionIds: '12, latest', ...onError },
		});
		expect(notNumbers.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(notNumbers.error[0].errorMessage)).toContain('Submission IDs must be a comma-separated list of numeric IDs (got "latest")');

		const none = await runNode({
			resource: 'submission',
			operation: 'bulkMarkRead',
			persona: 'student',
			params: { courseId: extras.courseId, submissionIds: ' , ', ...onError },
		});
		expect(String(none.error[0].errorMessage)).toContain('At least one submission ID is required');

		const unknown = await runNode({
			resource: 'submission',
			operation: 'bulkMarkRead',
			persona: 'student',
			params: { courseId: '999999999', submissionIds: '1', ...onError },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'submission', operation: 'bulkMarkRead' });
	});

	it('clearUnread: a site administrator marks everything of one student in the course as read', async () => {
		const [a, b] = extras.readStateAssignmentIds;
		const student2 = fx('student2UserId');
		await makeUnread(a, student2, true);
		await makeUnread(b, student2);
		await makeUnread(a, fx('studentUserId'));

		// Teachers may not do this ...
		const asTeacher = await runNode({
			resource: 'submission',
			operation: 'clearUnread',
			persona: 'teacher',
			params: { courseId: extras.courseId, userId: student2, ...onError },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'clearUnread' });
		expect([401, 403]).toContain(asTeacher.error[0].errorCode);

		// ... a site administrator may.
		const [cleared] = await runOk({
			resource: 'submission',
			operation: 'clearUnread',
			items: [{ user: Number(student2) }],
			params: { courseId: extras.courseId, userId: '={{ $json.user }}' },
		});
		expect(cleared).toEqual({ success: true });
		// Grade and comment alike are read now; the classmate's submission is untouched.
		expect(await readStateOf('student2', a)).toBe('read');
		expect(await readStateOf('student2', b)).toBe('read');
		expect(await readStateOf('student', a)).toBe('unread');

		await makeUnread(b, student2, true);
		const [viaSection] = await runOk({
			resource: 'submission',
			operation: 'clearUnread',
			params: { contextType: 'section', sectionId: extras.sectionId, userId: student2 },
		});
		expect(viaSection).toEqual({ success: true });
		expect(await readStateOf('student2', b)).toBe('read');

		// The user is looked up by numeric ID only.
		const bySisId = await runNode({
			resource: 'submission',
			operation: 'clearUnread',
			params: { courseId: extras.courseId, userId: 'sis_user_id:W5682-S-001', ...onError },
		});
		expect(bySisId.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ----------------------------------------------- getReadState, markRead

	it('getReadState / markRead: document annotations and rubric assessments have flags of their own', async () => {
		const [assignmentId] = extras.readStateAssignmentIds;
		const student = fx('studentUserId');
		const path = `${extrasBase()}/assignments/${assignmentId}/submissions/${student}`;
		const submission = await canvas().get<Json>(path);
		const params = { courseId: extras.courseId, assignmentId, userId: student };
		const state = (persona: string, item: string, extra: Json = {}): Promise<Json[]> =>
			runOk({ resource: 'submission', operation: 'getReadState', persona, params: { ...params, readStateItem: item, ...extra } });
		const fromCanvas = async (kind: string): Promise<unknown> => (await canvas().get<Json>(`${path}/${kind}/read`)).read;

		// The document viewer tells Canvas about new annotations with this (site administrator) call.
		await canvas().post(`${path}/annotation_notification`, { author_id: fx('adminUserId') });
		expect(await fromCanvas('document_annotations')).toBe(false);

		expect(await state('admin', 'document_annotations')).toEqual([{ read: false }]);
		expect(await state('student', 'document_annotations', { userId: 'self' })).toEqual([{ read: false }]);
		expect(
			await state('student', 'document_annotations', { contextType: 'section', sectionId: extras.sectionId, courseId: undefined }),
		).toEqual([{ read: false }]);

		// Only the student can mark them as read.
		const byGrader = await runNode({
			resource: 'submission',
			operation: 'markRead',
			params: { ...params, options: { item: 'document_annotations' }, ...onError },
		});
		expect(byGrader.success).toEqual([]);
		expect(byGrader.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'markRead' });
		expect(await fromCanvas('document_annotations')).toBe(false);

		const [marked] = await runOk({
			resource: 'submission',
			operation: 'markRead',
			persona: 'student',
			params: { ...params, userId: 'self', options: { item: 'document_annotations' } },
		});
		expect(marked).toEqual({ read: true });
		expect(await fromCanvas('document_annotations')).toBe(true);
		expect(await state('admin', 'document_annotations')).toEqual([{ read: true }]);

		// Nothing in Canvas raises the rubric flag through the API, so it is raised inside Canvas.
		expect(await state('admin', 'rubric_assessments')).toEqual([{ read: true }]);
		execFileSync(
			'docker',
			[
				'exec',
				'canvas-web',
				'bundle',
				'exec',
				'rails',
				'runner',
				`User.find(${Number(student)}).mark_rubric_assessments_unread!(Submission.find(${Number(submission.id)}))`,
			],
			{ encoding: 'utf8' },
		);
		expect(await fromCanvas('rubric_assessments')).toBe(false);
		expect(await state('student', 'rubric_assessments')).toEqual([{ read: false }]);
		// The annotations flag is a different one.
		expect(await state('student', 'document_annotations')).toEqual([{ read: true }]);

		const [rubricMarked] = await runOk({
			resource: 'submission',
			operation: 'markRead',
			persona: 'student',
			params: {
				contextType: 'section',
				sectionId: extras.sectionId,
				assignmentId,
				userId: 'self',
				options: { item: 'rubric_assessments' },
			},
		});
		expect(rubricMarked).toEqual({ read: true });
		expect(await fromCanvas('rubric_assessments')).toBe(true);
		// Canvas knows the same flag as "rubric comments".
		expect(await fromCanvas('rubric_comments')).toBe(true);
	});

	it('getReadState: a classmate may not ask; an unknown assignment is not found', async () => {
		const [assignmentId] = extras.readStateAssignmentIds;
		const classmate = await runNode({
			resource: 'submission',
			operation: 'getReadState',
			persona: 'student2',
			params: { courseId: extras.courseId, assignmentId, userId: fx('studentUserId'), readStateItem: 'rubric_assessments', ...onError },
		});
		expect(classmate.success).toEqual([]);
		expect(classmate.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'getReadState' });

		const unknown = await runNode({
			resource: 'submission',
			operation: 'getReadState',
			params: { courseId: extras.courseId, assignmentId: '999999999', userId: fx('studentUserId'), ...onError },
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ------------------------------------------ listGradeableStudentsMultiple

	it('listGradeableStudentsMultiple: every gradeable student once, with the assignments that apply to them', async () => {
		const ids = [battery.bulkAssignmentId, battery.playgroundAssignmentId];
		const expected = await canvas().getAll<Json>(
			`${base}/assignments/gradeable_students?assignment_ids[]=${ids[0]}&assignment_ids[]=${ids[1]}`,
		);
		expect(expected).toHaveLength(57);
		const params = { courseId, assignmentIds: ` ${ids.join(' , ')} ` };

		const defaults = await runOk({ resource: 'submission', operation: 'listGradeableStudentsMultiple', params });
		expect(defaults.map((u) => u.id)).toEqual(expected.slice(0, 50).map((u) => u.id));

		const all = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudentsMultiple',
			params: { ...params, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(new Set(all.map((u) => u.id)).size).toBe(57);
		for (const user of all) {
			expect([...(user.assignment_ids as number[])].sort(), `user ${String(user.id)}`).toEqual(ids.map(Number).sort());
			expect(user.display_name).toBeTypeOf('string');
		}

		const some = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudentsMultiple',
			params: { ...params, pagination: { perPage: 10, maxPages: 2 } },
		});
		expect(some.map((u) => u.id)).toEqual(expected.slice(0, 20).map((u) => u.id));
	});

	it('listGradeableStudentsMultiple: an assignment for some students only narrows the list and the assignment IDs', async () => {
		const everyone = extras.readStateAssignmentIds[0];
		const selective = extras.selective.assignmentId;
		const chosen = extras.selective.studentIds.map(Number).sort();

		const both = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudentsMultiple',
			items: [{ ids: [Number(everyone), Number(selective)] }],
			params: { courseId: extras.courseId, assignmentIds: '={{ $json.ids }}', pagination: { returnAll: true } },
		});
		// Six students of the course's own and the two student personas.
		expect(both).toHaveLength(8);
		for (const user of both) {
			const expectedIds = chosen.includes(Number(user.id)) ? [Number(everyone), Number(selective)] : [Number(everyone)];
			expect([...(user.assignment_ids as number[])].sort(), `user ${String(user.id)}`).toEqual(expectedIds.sort());
		}

		// A single ID arriving as a number.
		const onlySelective = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudentsMultiple',
			items: [{ id: Number(selective) }],
			params: { courseId: extras.courseId, assignmentIds: '={{ $json.id }}' },
		});
		expect(onlySelective.map((u) => Number(u.id)).sort()).toEqual(chosen);
		expect(onlySelective.map((u) => u.assignment_ids)).toEqual([[Number(selective)], [Number(selective)]]);
	});

	it('listGradeableStudentsMultiple: students may not list; bad IDs are rejected by the node', async () => {
		const forbidden = await runNode({
			resource: 'submission',
			operation: 'listGradeableStudentsMultiple',
			persona: 'student',
			params: { courseId, assignmentIds: battery.bulkAssignmentId, ...onError },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'listGradeableStudentsMultiple' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const bad = await runNode({
			resource: 'submission',
			operation: 'listGradeableStudentsMultiple',
			params: { courseId, assignmentIds: `${battery.bulkAssignmentId}, all`, ...onError },
		});
		expect(bad.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(bad.error[0].errorMessage)).toContain('Assignment IDs must be a comma-separated list of numeric IDs (got "all")');
	});

	// ----------------------------------------------------- anonymous grading

	it('get / grade by anonymous ID: an anonymously graded submission is read and graded without naming the student', async () => {
		const assignmentId = extras.anonymous.assignmentId;
		const assignmentPath = `${extrasBase()}/assignments/${assignmentId}`;
		const [first, second] = extras.anonymous.submittedIds;
		// The account administrator sees both IDs; that is the key to check against.
		const listed = await canvas().getAll<Json>(`${assignmentPath}/submissions`);
		const anonymousIdOf = (userId: string): string => String(listed.find((s) => String(s.user_id) === userId)!.anonymous_id);
		expect(anonymousIdOf(first)).toMatch(/^[A-Za-z0-9]{5}$/);

		// The teacher only gets anonymous IDs for the students ...
		const asTeacher = new CanvasClient('teacher');
		const gradeable = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudents',
			persona: 'teacher',
			params: { courseId: extras.courseId, assignmentId, options: { allow_new_anonymous_id: true }, pagination: { returnAll: true } },
		});
		expect(gradeable).toEqual(await asTeacher.getAll<Json>(`${assignmentPath}/gradeable_students?allow_new_anonymous_id=true`));
		expect(gradeable.map((s) => s.anonymous_id).sort()).toEqual(listed.map((s) => s.anonymous_id).sort());
		for (const entry of gradeable) expect(entry).not.toHaveProperty('id');
		// ... unless the option is off, which is what the endpoint does by default.
		const named = await runOk({
			resource: 'submission',
			operation: 'listGradeableStudents',
			persona: 'teacher',
			params: { courseId: extras.courseId, assignmentId, options: { allow_new_anonymous_id: false }, pagination: { returnAll: true } },
		});
		expect(named.map((s) => String(s.id)).sort()).toEqual(listed.map((s) => String(s.user_id)).sort());

		const [submission] = await runOk({
			resource: 'submission',
			operation: 'get',
			persona: 'teacher',
			params: {
				courseId: extras.courseId,
				assignmentId,
				submissionBy: 'anonymousId',
				anonymousId: anonymousIdOf(first),
				options: { include: ['submission_comments', 'submission_history', 'user', 'visibility'] },
			},
		});
		expect(submission).toMatchObject({
			anonymous_id: anonymousIdOf(first),
			assignment_id: Number(assignmentId),
			body: `<p>Answer of ${first}</p>`,
			workflow_state: expect.stringMatching(/submitted|graded/),
		});
		// Nothing gives the student away.
		expect(submission).not.toHaveProperty('user_id');
		expect(submission).not.toHaveProperty('user');
		expect(submission.submission_history).toBeInstanceOf(Array);
		expect(submission).toHaveProperty('assignment_visible');

		const feedback = unique('Anonymous feedback ünï');
		const [graded] = await runOk({
			resource: 'submission',
			operation: 'grade',
			persona: 'teacher',
			items: [{ anon: anonymousIdOf(first) }],
			params: {
				courseId: extras.courseId,
				assignmentId,
				submissionBy: 'anonymousId',
				anonymousId: '={{ $json.anon }}',
				gradeFields: { posted_grade: '7.5', comment: feedback },
			},
		});
		expect(graded).toMatchObject({ anonymous_id: anonymousIdOf(first), score: 7.5 });
		expect(graded).not.toHaveProperty('user_id');
		const actual = await canvas().get<Json>(`${assignmentPath}/submissions/${first}?include[]=submission_comments`);
		expect(actual).toMatchObject({ score: 7.5, grader_id: Number(fx('teacherUserId')) });
		expect((actual.submission_comments as Json[]).map((c) => c.comment)).toContain(feedback);
		// The classmate's submission is untouched by it.
		expect((await canvas().get<Json>(`${assignmentPath}/submissions/${second}?include[]=submission_comments`)).submission_comments).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ comment: feedback })]),
		);

		// Through the section, with every kind of grade field.
		const sectionParams = {
			contextType: 'section',
			sectionId: extras.sectionId,
			assignmentId,
			submissionBy: 'anonymousId',
			anonymousId: anonymousIdOf(second),
		};
		const [viaSection] = await runOk({ resource: 'submission', operation: 'get', params: sectionParams });
		expect(viaSection).toMatchObject({ anonymous_id: anonymousIdOf(second), body: `<p>Answer of ${second}</p>` });
		await runOk({
			resource: 'submission',
			operation: 'grade',
			params: { ...sectionParams, gradeFields: { posted_grade: '4', late_policy_status: 'late', seconds_late_override: 3600 } },
		});
		expect(await canvas().get<Json>(`${assignmentPath}/submissions/${second}`)).toMatchObject({
			score: 4,
			late_policy_status: 'late',
			seconds_late: 3600,
		});
		await runOk({ resource: 'submission', operation: 'grade', params: { ...sectionParams, gradeFields: { excuse: true } } });
		expect((await canvas().get<Json>(`${assignmentPath}/submissions/${second}`)).excused).toBe(true);
	});

	it('get / grade by anonymous ID: unknown IDs are not found; students have no access', async () => {
		const assignmentId = extras.anonymous.assignmentId;
		const listed = await canvas().getAll<Json>(`${extrasBase()}/assignments/${assignmentId}/submissions`);
		const anonymousId = String(listed.find((s) => String(s.user_id) === extras.anonymous.submittedIds[2])!.anonymous_id);
		const params = { courseId: extras.courseId, assignmentId, submissionBy: 'anonymousId' };

		const result = await runNode({
			resource: 'submission',
			operation: 'get',
			items: [{ anon: 'zzzzz' }, { anon: anonymousId }],
			params: { ...params, anonymousId: '={{ $json.anon }}', ...onError },
		});
		expect(result.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 1 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'submission', operation: 'get' });
		expect(String(result.error[0].endpoint)).toContain(`/assignments/${assignmentId}/anonymous_submissions/zzzzz`);

		// The anonymous ID belongs to this assignment only.
		const elsewhere = await runNode({
			resource: 'submission',
			operation: 'grade',
			params: {
				...params,
				assignmentId: extras.readStateAssignmentIds[0],
				anonymousId,
				gradeFields: { posted_grade: '1' },
				...onError,
			},
		});
		expect(elsewhere.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const asStudent = await runNode({
			resource: 'submission',
			operation: 'grade',
			persona: 'student',
			params: { ...params, anonymousId, gradeFields: { posted_grade: '10' }, ...onError },
		});
		expect(asStudent.success).toEqual([]);
		expect([401, 403, 404]).toContain(asStudent.error[0].errorCode);
		expect((await canvas().get<Json>(`${extrasBase()}/assignments/${assignmentId}/submissions/${extras.anonymous.submittedIds[2]}`)).score).not.toBe(10);
	});

	// ------------------------------------------------------ bulkGradeMultiple

	it('bulkGradeMultiple: grades, excuses, rubric assessments and comments across assignments in one job', async () => {
		const [, , a, b, c] = uploaders;
		const [content, form] = battery.rubric.criterionIds;
		const [leader, ...members] = battery.group.groups[1].memberIds;
		const text = unique('Across assignments ünï');
		const groupText = unique('To the whole group');
		const mediaId = `m-${unique('bulk').replace(/[^a-z0-9]/gi, '')}`;
		const attachment = Buffer.from(`marked up ${text}\n`);
		const file = await uploadDirect(
			canvas(),
			`${base}/assignments/${battery.rubric.assignmentId}/submissions/${b}/comments/files`,
			fileName('marked-up', 'txt'),
			attachment,
			'text/plain',
		);

		const [progress] = await runOk({
			resource: 'submission',
			operation: 'bulkGradeMultiple',
			items: [{ student: Number(a), points: 12 }],
			params: {
				courseId,
				grades: {
					gradeValues: [
						{ assignment_id: battery.playgroundAssignmentId, student_id: '={{ $json.student }}', posted_grade: '={{ $json.points }}' },
						{ assignment_id: ` ${battery.playgroundAssignmentId} `, student_id: ` ${b} `, posted_grade: '', excuse: true },
						{
							assignment_id: battery.rubric.assignmentId,
							student_id: a,
							rubric_assessment: JSON.stringify({ [content]: { points: 5, comments: 'From the bulk job' }, [form]: { points: 3 } }),
						},
						{
							assignment_id: battery.rubric.assignmentId,
							student_id: b,
							text_comment: text,
							file_ids: ` ${String(file.id)} `,
							group_comment: false,
						},
						{ assignment_id: battery.rubric.assignmentId, student_id: c, media_comment_id: mediaId, media_comment_type: 'audio' },
						{
							assignment_id: battery.group.assignmentId,
							student_id: leader,
							posted_grade: '9',
							text_comment: groupText,
							group_comment: true,
						},
					],
				},
			},
		});
		expect(progress).toMatchObject({ tag: 'submissions_update', context_type: 'Course', context_id: Number(courseId) });
		expect(await waitForProgress(progress.id)).toMatchObject({ workflow_state: 'completed' });

		expect((await submissionFromCanvas(battery.playgroundAssignmentId, a)).score).toBe(12);
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, b)).excused).toBe(true);

		const assessed = await submissionFromCanvas(battery.rubric.assignmentId, a, '?include[]=rubric_assessment');
		expect(assessed.score).toBe(8);
		expect(assessed.rubric_assessment).toMatchObject({ [content]: { points: 5, comments: 'From the bulk job' }, [form]: { points: 3 } });

		const commented = await submissionFromCanvas(battery.rubric.assignmentId, b, '?include[]=submission_comments');
		const withFile = (commented.submission_comments as Json[]).find((comment) => comment.comment === text)!;
		expect(withFile, 'the text comment').toBeDefined();
		expect((withFile.attachments as Json[]).map((x) => x.id)).toEqual([file.id]);
		expect((await downloadFile((withFile.attachments as Json[])[0])).equals(attachment)).toBe(true);

		const recorded = await submissionFromCanvas(battery.rubric.assignmentId, c, '?include[]=submission_comments');
		expect((recorded.submission_comments as Json[]).map((comment) => comment.media_comment)).toEqual(
			expect.arrayContaining([expect.objectContaining({ media_id: mediaId, media_type: 'audio' })]),
		);

		for (const member of [leader, ...members]) {
			const actual = await submissionFromCanvas(battery.group.assignmentId, member, '?include[]=submission_comments');
			expect(actual.score, `member ${member}`).toBe(9);
			expect((actual.submission_comments as Json[]).map((comment) => comment.comment)).toContain(groupText);
		}
	});

	it('bulkGradeMultiple: through a section the job only finds the students of that section, and says who was missing', async () => {
		const inSection = battery.sectionTwo.studentIds[2];
		const outside = uploaders[2];
		const before = await submissionFromCanvas(battery.rubric.assignmentId, outside);
		const text = unique('Section job');
		const [progress] = await runOk({
			resource: 'submission',
			operation: 'bulkGradeMultiple',
			params: {
				contextType: 'section',
				sectionId: battery.sectionTwo.id,
				grades: {
					gradeValues: [
						{ assignment_id: battery.playgroundAssignmentId, student_id: inSection, posted_grade: '2' },
						{ assignment_id: battery.rubric.assignmentId, student_id: inSection, text_comment: text },
						{ assignment_id: battery.rubric.assignmentId, student_id: outside, posted_grade: '1' },
					],
				},
			},
		});
		expect(progress).toMatchObject({ tag: 'submissions_update' });
		const done = await waitForProgress(progress.id);
		// The job reports the student it could not find in the section as a failure ...
		expect(done.workflow_state).toBe('failed');
		expect(String(done.message)).toContain(`'${outside}'`);
		expect((await submissionFromCanvas(battery.rubric.assignmentId, outside)).score).toBe(before.score);
		// ... and still graded and commented the others.
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, inSection)).score).toBe(2);
		const commented = await submissionFromCanvas(battery.rubric.assignmentId, inSection, '?include[]=submission_comments');
		expect((commented.submission_comments as Json[]).map((comment) => comment.comment)).toContain(text);
	});

	it('bulkGradeMultiple: incomplete entries are rejected by the node; unpublished or unknown assignments and students by Canvas', async () => {
		const run = (gradeValues: Json[] | undefined, persona = 'admin', course = courseId): ReturnType<typeof runNode> =>
			runNode({
				resource: 'submission',
				operation: 'bulkGradeMultiple',
				persona,
				params: { courseId: course, grades: gradeValues ? { gradeValues } : {}, ...onError },
			});

		const none = await run(undefined);
		expect(none.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(none.error[0].errorMessage)).toContain('At least one grade entry is required');

		// (n8n itself refuses to run with an empty required field; an expression can still come up empty.)
		const noAssignment = await run([{ assignment_id: '={{ $json.missing }}', student_id: uploaders[2], posted_grade: '5' }]);
		expect(noAssignment.failure, JSON.stringify(noAssignment.failure)).toBeUndefined();
		expect(noAssignment.error[0]).toMatchObject({ errorCode: 0 });
		expect(String(noAssignment.error[0].errorMessage)).toContain('Every grade entry needs an Assignment ID and a Student ID');

		const badRubric = await run([{ assignment_id: battery.rubric.assignmentId, student_id: uploaders[2], rubric_assessment: '[1, 2]' }]);
		expect(String(badRubric.error[0].errorMessage)).toContain('Rubric Assessment must be a JSON object');

		const unknown = await run([{ assignment_id: '999999999', student_id: uploaders[2], posted_grade: '5' }]);
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(unknown.error[0].errorMessage)).toContain('Some assignments could not be found');

		const draft = await canvas().post<Json>(`${extrasBase()}/assignments`, {
			assignment: { name: unique('Unpublished'), submission_types: ['online_text_entry'], points_possible: 5, published: false },
		});
		try {
			const unpublished = await run([{ assignment_id: String(draft.id), student_id: extras.studentIds[3], posted_grade: '5' }], 'admin', extras.courseId);
			expect(unpublished.success).toEqual([]);
			expect(unpublished.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		} finally {
			await canvas().delete(`${extrasBase()}/assignments/${String(draft.id)}`);
		}

		const asStudent = await run([{ assignment_id: battery.playgroundAssignmentId, student_id: fx('studentUserId'), posted_grade: '20' }], 'student');
		expect(asStudent.success).toEqual([]);
		expect([401, 403]).toContain(asStudent.error[0].errorCode);
	});

	it('bulkGrade: rubric assessments, comment files and media comments for one assignment', async () => {
		const [, , , , , a] = uploaders;
		const b = uploaders[4];
		const [content, form] = battery.rubric.criterionIds;
		const text = unique('One assignment, with a file');
		const mediaId = `m-${unique('one').replace(/[^a-z0-9]/gi, '')}`;
		const file = await uploadDirect(
			canvas(),
			`${base}/assignments/${battery.rubric.assignmentId}/submissions/${a}/comments/files`,
			fileName('notes', 'txt'),
			Buffer.from('notes for the student'),
			'text/plain',
		);
		const [progress] = await runOk({
			resource: 'submission',
			operation: 'bulkGrade',
			items: [{ assessment: { [content]: { points: 6 }, [form]: { points: 1 } } }],
			params: {
				courseId,
				assignmentId: battery.rubric.assignmentId,
				grades: {
					gradeValues: [
						// The rubric assessment as an object from an expression.
						{ student_id: a, rubric_assessment: '={{ $json.assessment }}', text_comment: text, file_ids: String(file.id) },
						{ student_id: b, media_comment_id: mediaId, media_comment_type: 'video', posted_grade: '3' },
					],
				},
			},
		});
		expect(await waitForProgress(progress.id)).toMatchObject({ workflow_state: 'completed' });

		const first = await submissionFromCanvas(battery.rubric.assignmentId, a, '?include[]=rubric_assessment&include[]=submission_comments');
		expect(first.score).toBe(7);
		expect(first.rubric_assessment).toMatchObject({ [content]: { points: 6 }, [form]: { points: 1 } });
		const comment = (first.submission_comments as Json[]).find((entry) => entry.comment === text)!;
		expect((comment.attachments as Json[]).map((x) => x.id)).toEqual([file.id]);

		const second = await submissionFromCanvas(battery.rubric.assignmentId, b, '?include[]=submission_comments');
		expect(second.score).toBe(3);
		expect((second.submission_comments as Json[]).map((entry) => entry.media_comment)).toEqual(
			expect.arrayContaining([expect.objectContaining({ media_id: mediaId, media_type: 'video' })]),
		);
	});
});
