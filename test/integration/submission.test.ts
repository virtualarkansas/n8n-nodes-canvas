import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ensureAssignmentsBattery, ensureSubmissionsBattery, uploadDirect } from './contentBattery';
import type { SubmissionsBattery } from './contentBattery';

/**
 * Resource: submission. Runs in a dedicated course with 57 students, two
 * sections and long-lived assignments of every submission type (see
 * contentBattery.ts). Students used for grading tests are not the ones whose
 * submissions the list tests count.
 */
describe('submission', () => {
	let battery: SubmissionsBattery;
	let courseId = '';
	let base = '';
	/** Bulk students nothing else depends on. */
	let gradees: string[] = [];

	const submissionFromCanvas = (assignmentId: string, userId: string, query = ''): Promise<Json> =>
		canvas().get<Json>(`${base}/assignments/${assignmentId}/submissions/${userId}${query}`);
	const key = (list: Json[]): string[] => list.map((s) => `${String(s.assignment_id)}:${String(s.user_id)}`).sort();
	const userIds = (list: Json[]): string[] => list.map((s) => String(s.user_id));

	beforeAll(async () => {
		battery = await ensureSubmissionsBattery();
		courseId = battery.courseId;
		base = `/api/v1/courses/${courseId}`;
		gradees = battery.studentIds.slice(40, 46);
	}, 1_200_000);

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

	it('grade: a workflow saved with the former "Score" field still grades', async () => {
		const student = battery.sectionTwo.studentIds[1];
		await runOk({
			resource: 'submission',
			operation: 'grade',
			params: { courseId, assignmentId: battery.playgroundAssignmentId, userId: student, gradeFields: { score: 6.5 } },
		});
		expect((await submissionFromCanvas(battery.playgroundAssignmentId, student)).score).toBe(6.5);
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

		const missing = await runNode({
			resource: 'submission',
			operation: 'markUnread',
			params: { courseId, assignmentId: '999999999', userId: student, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
