import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { waitFor } from './pacing.fixture';
import { actingAs, createSandboxAccount, deleteSandboxAccount } from './support/gradingSandbox';

/**
 * Resource: course — what happens in a course for its people: module progress
 * (Get User Progress, Get Bulk User Progress), Get Effective Due Dates, List
 * To-Do Items, the activity stream and its summary, and the courses of a user
 * (Get Many for User).
 *
 * Exact values are checked in a course of the file's own (a module with
 * completion requirements, assignments with overrides, two students of its
 * own); paging is checked on the seeded courses, read-only.
 */
const numeric = (values: unknown[]): number[] => values.map(Number).sort((a, b) => a - b);

describe('course: progress, due dates, to-do, activity', () => {
	const main = fx('courseId');
	let accountId = '';
	let courseId = '';
	let moduleId = '';
	let pageItemId = '';
	let assignmentItemId = '';
	let assignmentId = '';
	let undatedAssignmentId = '';
	let quizId = '';
	let sectionId = '';
	let studentA = '';
	let studentB = '';
	const dueForAll = new Date(Date.now() + 2 * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z');
	const dueForA = new Date(Date.now() + 4 * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z');

	const createStudent = async (label: string): Promise<string> => {
		const name = unique(label);
		const user = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name, skip_registration: true },
			pseudonym: { unique_id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.edu`, send_confirmation: false },
		});
		return String(user.id);
	};
	const enroll = (userId: string, type: string, section?: string): Promise<Json> =>
		canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: {
				user_id: userId,
				type,
				enrollment_state: 'active',
				notify: false,
				...(section ? { course_section_id: section } : {}),
			},
		});

	beforeAll(async () => {
		accountId = await createSandboxAccount('course-progress');
		const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('Progress battery course'), public_description: 'Progress battery — public description' },
			offer: true,
		});
		courseId = String(course.id);
		const section = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name: 'Progress section B' } });
		sectionId = String(section.id);

		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: 'Essay with a due date', submission_types: ['online_text_entry'], points_possible: 10, due_at: dueForAll, published: true },
		});
		assignmentId = String(assignment.id);
		const undated = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: 'Reading log without due date', submission_types: ['online_text_entry'], points_possible: 5, published: true },
		});
		undatedAssignmentId = String(undated.id);
		const page = await canvas().post<Json>(`/api/v1/courses/${courseId}/pages`, {
			wiki_page: { title: 'Read me first', body: '<p>Welcome</p>', published: true },
		});
		const quiz = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes`, {
			quiz: { title: 'Practice quiz (ungraded)', quiz_type: 'practice_quiz', due_at: dueForAll, published: true },
		});
		quizId = String(quiz.id);

		const module = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules`, {
			module: { name: 'Unit 1', require_sequential_progress: true },
		});
		moduleId = String(module.id);
		const pageItem = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
			module_item: { type: 'Page', page_url: page.url, completion_requirement: { type: 'must_mark_done' } },
		});
		pageItemId = String(pageItem.id);
		const assignmentItem = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
			module_item: { type: 'Assignment', content_id: assignment.id, completion_requirement: { type: 'must_submit' } },
		});
		assignmentItemId = String(assignmentItem.id);
		await canvas().put(`/api/v1/courses/${courseId}/modules/${moduleId}`, { module: { published: true } });

		studentA = await createStudent('Progress Student Ada');
		studentB = await createStudent('Progress Student Björn');
		await enroll(studentA, 'StudentEnrollment');
		await enroll(studentB, 'StudentEnrollment', sectionId);
		await enroll(fx('teacherUserId'), 'TeacherEnrollment');
		await enroll(fx('studentUserId'), 'StudentEnrollment');

		// Student A alone gets a later due date for the essay.
		await canvas().post(`/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides`, {
			assignment_override: { student_ids: [Number(studentA)], title: 'Extension', due_at: dueForA },
		});
	});

	afterAll(async () => {
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		for (const user of [studentA, studentB]) {
			if (user) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${user}`);
		}
		await deleteSandboxAccount(accountId);
	});

	// ----------------------------------
	//         getUserProgress / getBulkUserProgress
	// ----------------------------------
	it('getUserProgress: counts the completed module requirements of a student', async () => {
		const [initial] = await runOk({ resource: 'course', operation: 'getUserProgress', params: { courseId, userId: studentA } });
		// Canvas works out the next requirement once the student has been in the course.
		expect(initial).toEqual({ requirement_count: 2, requirement_completed_count: 0, next_requirement_url: null, completed_at: null });

		// The student marks the page as done.
		await actingAs(studentA).put(`/api/v1/courses/${courseId}/modules/${moduleId}/items/${pageItemId}/done`);
		const [afterFirst] = await runOk({ resource: 'course', operation: 'getUserProgress', params: { courseId, userId: studentA } });
		expect(afterFirst).toEqual(await canvas().get<Json>(`/api/v1/courses/${courseId}/users/${studentA}/progress`));
		expect(afterFirst).toMatchObject({ requirement_count: 2, requirement_completed_count: 1, completed_at: null });
		expect(String(afterFirst.next_requirement_url)).toContain(`/courses/${courseId}/modules/items/${assignmentItemId}`);

		// ... and hands in the essay: the course is complete.
		await actingAs(studentA).post(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, {
			submission: { submission_type: 'online_text_entry', body: '<p>My essay</p>' },
		});
		const done = await waitFor(
			() => canvas().get<Json>(`/api/v1/courses/${courseId}/users/${studentA}/progress`),
			(progress) => progress.requirement_completed_count === 2,
		);
		const [finished] = await runOk({ resource: 'course', operation: 'getUserProgress', params: { courseId, userId: studentA } });
		expect(finished).toEqual(done);
		expect(finished).toMatchObject({ requirement_count: 2, requirement_completed_count: 2, next_requirement_url: null });
		expect(Date.now() - Date.parse(String(finished.completed_at))).toBeLessThan(10 * 60_000);
	});

	it('getUserProgress: several users in one run; "self" for a student; a teacher asking about a student', async () => {
		const result = await runOk({
			resource: 'course',
			operation: 'getUserProgress',
			items: [{ user: Number(studentA) }, { user: Number(studentB) }],
			params: { courseId, userId: '={{ $json.user }}' },
		});
		expect(result.map((p) => p.requirement_completed_count)).toEqual([2, 0]);

		const [own] = await runOk({ resource: 'course', operation: 'getUserProgress', persona: 'student', params: { courseId, userId: 'self' } });
		expect(own).toMatchObject({ requirement_count: 2, requirement_completed_count: 0 });

		const [byTeacher] = await runOk({ resource: 'course', operation: 'getUserProgress', persona: 'teacher', params: { courseId, userId: studentB } });
		expect(byTeacher).toMatchObject({ requirement_count: 2, requirement_completed_count: 0 });
	});

	it('getUserProgress: errors — a classmate\'s progress is private, a teacher has no progress, an unknown user is not found', async () => {
		const classmate = await runNode({
			resource: 'course',
			operation: 'getUserProgress',
			persona: 'student',
			params: { courseId, userId: studentA, errorHandling: { onError: 'continueWithError' } },
		});
		expect(classmate.success).toEqual([]);
		expect(classmate.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getUserProgress' });

		// Canvas answers 400 with an explanation when the user is not a student of the course.
		const teacher = await runNode({
			resource: 'course',
			operation: 'getUserProgress',
			params: { courseId, userId: fx('teacherUserId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(teacher.success).toEqual([]);
		expect(teacher.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'getUserProgress' });
		expect(String(teacher.error[0].errorMessage)).toContain('not enrolled as a student');

		const unknown = await runNode({
			resource: 'course',
			operation: 'getUserProgress',
			params: { courseId, userId: fx('registrarUserId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('getBulkUserProgress: one entry per student with their progress', async () => {
		const listed = await runOk({ resource: 'course', operation: 'getBulkUserProgress', params: { courseId } });
		expect(numeric(listed.map((u) => u.id))).toEqual(numeric([studentA, studentB, fx('studentUserId')]));
		const byId = new Map(listed.map((u) => [String(u.id), u]));
		expect(byId.get(studentA)?.progress).toMatchObject({ requirement_count: 2, requirement_completed_count: 2, next_requirement_url: null });
		expect((byId.get(studentA)?.progress as Json).completed_at).toBeTypeOf('string');
		expect(byId.get(studentB)?.progress).toMatchObject({ requirement_count: 2, requirement_completed_count: 0, completed_at: null });
		expect(byId.get(studentA)).toHaveProperty('display_name');
		expect(String(byId.get(studentB)?.html_url)).toContain(`/courses/${courseId}/users/${studentB}`);

		const asTeacher = await runOk({ resource: 'course', operation: 'getBulkUserProgress', persona: 'teacher', params: { courseId } });
		expect(asTeacher.map((u) => [u.id, (u.progress as Json).requirement_completed_count])).toEqual(
			listed.map((u) => [u.id, (u.progress as Json).requirement_completed_count]),
		);
	});

	it('getBulkUserProgress: pages through the students of the main seeded course', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${main}/bulk_user_progress`);
		expect(expected.length).toBeGreaterThan(50);
		const students = await canvas().getAll<Json>(`/api/v1/courses/${main}/enrollments?type[]=StudentEnrollment&state[]=active&state[]=invited`);
		expect(numeric(expected.map((u) => u.id))).toEqual(numeric([...new Set(students.map((e) => e.user_id))]));

		const defaults = await runOk({ resource: 'course', operation: 'getBulkUserProgress', params: { courseId: main } });
		expect(defaults.map((u) => u.id)).toEqual(expected.slice(0, 50).map((u) => u.id));

		const all = await runOk({
			resource: 'course',
			operation: 'getBulkUserProgress',
			params: { courseId: main, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(new Set(all.map((u) => u.id)).size).toBe(all.length);
		const persona = all.find((u) => u.id === Number(fx('studentUserId'))) as Json;
		expect(persona.progress).toEqual(await canvas().get<Json>(`/api/v1/courses/${main}/users/${fx('studentUserId')}/progress`));

		const some = await runOk({
			resource: 'course',
			operation: 'getBulkUserProgress',
			params: { courseId: main, pagination: { perPage: 6, maxPages: 2 } },
		});
		expect(some.map((u) => u.id)).toEqual(expected.slice(0, 12).map((u) => u.id));
	});

	it('getBulkUserProgress: errors — a course without module requirements, and a student asking', async () => {
		const notModuleBased = await runNode({
			resource: 'course',
			operation: 'getBulkUserProgress',
			params: { courseId: fx('emptyCourseId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(notModuleBased.success).toEqual([]);
		expect(notModuleBased.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'getBulkUserProgress' });
		expect(String(notModuleBased.error[0].errorMessage)).toContain('not module based');

		const refused = await runNode({
			resource: 'course',
			operation: 'getBulkUserProgress',
			persona: 'student',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
	});

	// ----------------------------------
	//         getEffectiveDueDates
	// ----------------------------------
	it('getEffectiveDueDates: one record keyed by assignment and student, with overrides applied', async () => {
		const [dates] = await runOk({ resource: 'course', operation: 'getEffectiveDueDates', params: { courseId } });
		expect(dates).toEqual(await canvas().get<Json>(`/api/v1/courses/${courseId}/effective_due_dates`));
		// Every assignment of the course is a key (the practice quiz has no assignment).
		expect(Object.keys(dates).sort()).toEqual([assignmentId, undatedAssignmentId].sort());
		const essay = dates[assignmentId] as Record<string, Json>;
		expect(Object.keys(essay).sort()).toEqual([studentA, studentB, fx('studentUserId')].sort());
		expect(essay[studentA]).toEqual({ due_at: dueForA, grading_period_id: null, in_closed_grading_period: false });
		expect(essay[studentB]).toEqual({ due_at: dueForAll, grading_period_id: null, in_closed_grading_period: false });
		const undated = dates[undatedAssignmentId] as Record<string, Json>;
		expect(undated[studentB]).toEqual({ due_at: null, grading_period_id: null, in_closed_grading_period: false });
	});

	it('getEffectiveDueDates: assignment IDs limit the result (typed list, array from an expression)', async () => {
		const [one] = await runOk({
			resource: 'course',
			operation: 'getEffectiveDueDates',
			persona: 'teacher',
			params: { courseId, options: { assignment_ids: ` ${assignmentId} ` } },
		});
		expect(Object.keys(one)).toEqual([assignmentId]);

		const [both] = await runOk({
			resource: 'course',
			operation: 'getEffectiveDueDates',
			items: [{ wanted: [Number(undatedAssignmentId), Number(assignmentId)] }],
			params: { courseId, options: { assignment_ids: '={{ $json.wanted }}' } },
		});
		expect(Object.keys(both).sort()).toEqual([assignmentId, undatedAssignmentId].sort());

		// An assignment of another course is not in this one: nothing to report.
		const [none] = await runOk({
			resource: 'course',
			operation: 'getEffectiveDueDates',
			params: { courseId, options: { assignment_ids: fx('assignmentId') } },
		});
		expect(none).toEqual({});
	});

	it('getEffectiveDueDates: grading periods of a seeded course are reported', async () => {
		const assignment = fx('assignmentId');
		const [dates] = await runOk({
			resource: 'course',
			operation: 'getEffectiveDueDates',
			params: { courseId: main, options: { assignment_ids: `${assignment},${fx('overrideAssignmentId')}` } },
		});
		expect(dates).toEqual(
			await canvas().get<Json>(
				`/api/v1/courses/${main}/effective_due_dates?assignment_ids[]=${assignment}&assignment_ids[]=${fx('overrideAssignmentId')}`,
			),
		);
		const persona = (dates[assignment] as Record<string, Json>)[fx('studentUserId')];
		expect(persona.grading_period_id).toBeTypeOf('number');
		expect(persona.in_closed_grading_period).toBeTypeOf('boolean');
		expect(Object.keys(dates[assignment] as Json).length).toBeGreaterThan(50);
	});

	it('getEffectiveDueDates: errors — invalid IDs are rejected by Canvas, students may not ask', async () => {
		const invalid = await runNode({
			resource: 'course',
			operation: 'getEffectiveDueDates',
			params: { courseId, options: { assignment_ids: 'essay' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', operation: 'getEffectiveDueDates' });
		expect(String(invalid.error[0].errorMessage)).toContain('assignment_ids param is invalid');

		const refused = await runNode({
			resource: 'course',
			operation: 'getEffectiveDueDates',
			persona: 'student',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
	});

	// ----------------------------------
	//         listTodoItems
	// ----------------------------------
	const todoKey = (item: Json): string =>
		`${String(item.type)}:${item.assignment ? `assignment ${String((item.assignment as Json).id)}` : `quiz ${String((item.quiz as Json).id)}`}`;

	it('listTodoItems: a student has the essay to submit; ungraded quizzes only on request', async () => {
		const items = await runOk({ resource: 'course', operation: 'listTodoItems', persona: 'student', params: { courseId } });
		expect(items.map(todoKey).sort()).toEqual([`submitting:assignment ${assignmentId}`]);
		expect(items[0]).toMatchObject({ type: 'submitting', course_id: Number(courseId), context_type: 'Course' });
		expect((items[0].assignment as Json).name).toBe('Essay with a due date');
		expect(String(items[0].html_url)).toContain(`/courses/${courseId}/assignments/${assignmentId}`);

		const withQuizzes = await runOk({
			resource: 'course',
			operation: 'listTodoItems',
			persona: 'student',
			params: { courseId, options: { include: ['ungraded_quizzes'] } },
		});
		expect(withQuizzes.map(todoKey).sort()).toEqual([`submitting:assignment ${assignmentId}`, `submitting:quiz ${quizId}`].sort());
	});

	it('listTodoItems: a teacher has the handed-in essay to grade', async () => {
		const items = await waitFor(
			() => runOk({ resource: 'course', operation: 'listTodoItems', persona: 'teacher', params: { courseId } }),
			(list) => list.length > 0,
			60_000,
		);
		expect(items.map(todoKey)).toEqual([`grading:assignment ${assignmentId}`]);
		expect(items[0]).toMatchObject({ type: 'grading', needs_grading_count: 1 });

		// Nothing to do for an admin who neither teaches nor studies here.
		const none = await runNode({ resource: 'course', operation: 'listTodoItems', params: { courseId } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
	});

	it('listTodoItems: pages through the to-do list of the teacher in the main seeded course', async () => {
		const expected = await new CanvasClient('teacher').getAll<Json>(`/api/v1/courses/${main}/todo`);
		expect(expected.length, 'the teacher should have more than one page of items to grade').toBeGreaterThan(10);

		const all = await runOk({
			resource: 'course',
			operation: 'listTodoItems',
			persona: 'teacher',
			params: { courseId: main, pagination: { returnAll: true } },
		});
		expect(all.map(todoKey)).toEqual(expected.map(todoKey));
		expect(new Set(all.map(todoKey)).size).toBe(all.length);

		const defaults = await runOk({ resource: 'course', operation: 'listTodoItems', persona: 'teacher', params: { courseId: main } });
		expect(defaults.map(todoKey)).toEqual(expected.slice(0, 50).map(todoKey));

		const some = await runOk({
			resource: 'course',
			operation: 'listTodoItems',
			persona: 'teacher',
			params: { courseId: main, pagination: { perPage: 3, maxPages: 3 } },
		});
		expect(some.map(todoKey)).toEqual(expected.slice(0, 9).map(todoKey));
	});

	it('listTodoItems: no access to the course is refused', async () => {
		const refused = await runNode({
			resource: 'course',
			operation: 'listTodoItems',
			persona: 'student2',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'listTodoItems' });
	});

	// ----------------------------------
	//         getActivityStream / getActivityStreamSummary
	// ----------------------------------
	it('getActivityStream: pages through the stream of the teacher in the main seeded course', async () => {
		const teacher = new CanvasClient('teacher');
		const expected = await teacher.getAll<Json>(`/api/v1/courses/${main}/activity_stream`);
		expect(expected.length).toBeGreaterThan(100);

		const all = await runOk({
			resource: 'course',
			operation: 'getActivityStream',
			persona: 'teacher',
			params: { courseId: main, pagination: { returnAll: true } },
		});
		expect(all.map((i) => i.id)).toEqual(expected.map((i) => i.id));
		expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
		for (const item of all) {
			expect(item.course_id).toBe(Number(main));
			expect(item.type).toBeTypeOf('string');
		}

		const defaults = await runOk({ resource: 'course', operation: 'getActivityStream', persona: 'teacher', params: { courseId: main } });
		expect(defaults.map((i) => i.id)).toEqual(expected.slice(0, 50).map((i) => i.id));

		const some = await runOk({
			resource: 'course',
			operation: 'getActivityStream',
			persona: 'teacher',
			params: { courseId: main, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(some.map((i) => i.id)).toEqual(expected.slice(0, 8).map((i) => i.id));
	});

	it('getActivityStreamSummary: counts the stream items per type, for the token\'s user', async () => {
		for (const persona of ['teacher', 'student']) {
			const summary = await runOk({ resource: 'course', operation: 'getActivityStreamSummary', persona, params: { courseId: main } });
			expect(summary).toEqual(await new CanvasClient(persona).get<Json[]>(`/api/v1/courses/${main}/activity_stream/summary`));
			expect(summary.length).toBeGreaterThan(2);
			for (const entry of summary) {
				expect(entry.type).toBeTypeOf('string');
				expect(entry.count).toBeTypeOf('number');
				expect(entry.unread_count).toBeTypeOf('number');
			}
		}
		// The summary adds up to the stream itself.
		const summary = await runOk({ resource: 'course', operation: 'getActivityStreamSummary', persona: 'teacher', params: { courseId: main } });
		const stream = await new CanvasClient('teacher').getAll<Json>(`/api/v1/courses/${main}/activity_stream`);
		expect(summary.reduce((sum, entry) => sum + Number(entry.count), 0)).toBe(stream.length);
	});

	it('getActivityStream / Summary: a new announcement shows up for the students of the course', async () => {
		const title = unique('Stream announcement 📣');
		await actingAs(fx('teacherUserId')).post(`/api/v1/courses/${courseId}/discussion_topics`, {
			title,
			message: '<p>Read this</p>',
			is_announcement: true,
			published: true,
		});
		const stream = await waitFor(
			() => runOk({ resource: 'course', operation: 'getActivityStream', persona: 'student', params: { courseId } }),
			(items) => items.some((item) => item.title === title),
			90_000,
		);
		const announcement = stream.find((item) => item.title === title) as Json;
		expect(announcement).toMatchObject({ type: 'Announcement', course_id: Number(courseId), read_state: false });

		const summary = await runOk({ resource: 'course', operation: 'getActivityStreamSummary', persona: 'student', params: { courseId } });
		expect(summary.find((entry) => entry.type === 'Announcement')).toMatchObject({ count: 1, unread_count: 1 });
	});

	it('getActivityStream / Summary: an empty stream yields no items; no access to the course is refused', async () => {
		const empty = await runNode({ resource: 'course', operation: 'getActivityStream', params: { courseId: fx('emptyCourseId') } });
		expect(empty.ok).toBe(true);
		expect(empty.success).toEqual([]);
		expect(empty.error).toEqual([]);

		for (const operation of ['getActivityStream', 'getActivityStreamSummary']) {
			const refused = await runNode({
				resource: 'course',
				operation,
				persona: 'student2',
				params: { courseId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation });
		}
	});

	// ----------------------------------
	//         getAllForUser
	// ----------------------------------
	it('getAllForUser: an admin lists the courses of a teacher, paged', async () => {
		const teacherId = fx('teacherUserId');
		const expected = await canvas().getAll<Json>(`/api/v1/users/${teacherId}/courses`);
		expect(expected.length, 'the teacher persona should have more than 10 courses').toBeGreaterThan(10);
		// The same courses the teacher gets from "Get Many".
		const own = await new CanvasClient('teacher').getAll<Json>('/api/v1/courses');
		expect(numeric(expected.map((c) => c.id))).toEqual(numeric(own.map((c) => c.id)));

		const defaults = await runOk({ resource: 'course', operation: 'getAllForUser', params: { userId: teacherId } });
		expect(defaults.map((c) => c.id)).toEqual(expected.slice(0, 50).map((c) => c.id));

		const all = await runOk({ resource: 'course', operation: 'getAllForUser', params: { userId: teacherId, pagination: { returnAll: true } } });
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(new Set(all.map((c) => c.id)).size).toBe(all.length);

		const some = await runOk({
			resource: 'course',
			operation: 'getAllForUser',
			params: { userId: teacherId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(some.map((c) => c.id)).toEqual(expected.slice(0, 8).map((c) => c.id));
	});

	it('getAllForUser: every include adds its data', async () => {
		const include = [
			'account',
			'banner_image',
			'concluded',
			'course_image',
			'course_progress',
			'current_grading_period_scores',
			'favorites',
			'grading_periods',
			'needs_grading_count',
			'observed_users',
			'passback_status',
			'permissions',
			'post_manually',
			'public_description',
			'sections',
			'storage_quota_used_mb',
			'syllabus_body',
			'tabs',
			'teachers',
			'term',
			'total_scores',
			'total_students',
		];
		const courses = await runOk({
			resource: 'course',
			operation: 'getAllForUser',
			params: { userId: fx('studentUserId'), options: { include }, pagination: { returnAll: true } },
		});
		const own = courses.find((c) => c.id === Number(courseId)) as Json;
		expect(own, 'the course of this file is among the courses of the student persona').toBeTypeOf('object');
		expect(own.account).toMatchObject({ id: Number(accountId) });
		expect(own.concluded).toBe(false);
		expect(own.course_progress).toMatchObject({ requirement_count: 2, requirement_completed_count: 0 });
		expect(own.is_favorite).toBe(false);
		expect(own).toHaveProperty('grading_periods');
		expect(own).toHaveProperty('passback_status');
		expect(own.post_manually).toBe(false);
		expect(own.public_description).toBe('Progress battery — public description');
		expect((own.sections as Json[]).map((s) => s.enrollment_role)).toEqual(['StudentEnrollment']);
		expect(own.storage_quota_used_mb).toBeTypeOf('number');
		expect(own).toHaveProperty('syllabus_body');
		expect((own.tabs as Json[]).map((t) => t.id)).toContain('home');
		expect((own.teachers as Json[]).map((t) => t.id)).toEqual([Number(fx('teacherUserId'))]);
		expect(own.term).toBeTypeOf('object');
		expect(own.total_students).toBe(3);
		const enrollment = (own.enrollments as Json[])[0];
		expect(enrollment).toMatchObject({ type: 'student', user_id: Number(fx('studentUserId')) });
		expect(enrollment).toHaveProperty('computed_current_score');
		expect(enrollment).toHaveProperty('has_grading_periods');

		// The main seeded course has grading periods and a course image.
		const seeded = courses.find((c) => c.id === Number(main)) as Json;
		expect((seeded.grading_periods as Json[]).length).toBeGreaterThan(0);
		expect((seeded.enrollments as Json[])[0]).toHaveProperty('current_grading_period_id');
		expect(seeded.course_progress).toEqual(await canvas().get<Json>(`/api/v1/courses/${main}/users/${fx('studentUserId')}/progress`));
	});

	it('getAllForUser: filters by account, state, enrollment state and role', async () => {
		const student = fx('studentUserId');
		const run = (options: Json): Promise<Json[]> =>
			runOk({ resource: 'course', operation: 'getAllForUser', params: { userId: student, options, pagination: { returnAll: true } } });
		const direct = (query: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${student}/courses?${query}`);

		const inAccount = await run({ account_id: accountId });
		expect(inAccount.map((c) => c.id)).toEqual([Number(courseId)]);

		const everything = await direct('state[]=available&state[]=completed&state[]=unpublished');
		const available = await run({ state: ['available'] });
		expect(numeric(available.map((c) => c.id))).toEqual(numeric(everything.filter((c) => c.workflow_state === 'available').map((c) => c.id)));
		const completed = await run({ state: ['completed'] });
		expect(completed.length).toBeGreaterThan(0);
		for (const course of completed) expect(course.workflow_state).toBe('completed');
		expect(numeric(completed.map((c) => c.id))).toEqual(numeric(everything.filter((c) => c.workflow_state === 'completed').map((c) => c.id)));

		for (const state of ['active', 'invited_or_pending', 'completed']) {
			const listed = await run({ enrollment_state: state });
			expect(numeric(listed.map((c) => c.id)), `enrollment state ${state}`).toEqual(
				numeric((await direct(`enrollment_state=${state}`)).map((c) => c.id)),
			);
		}
		const active = await run({ enrollment_state: 'active' });
		const concluded = await run({ enrollment_state: 'completed' });
		expect(active.map((c) => c.id)).toContain(Number(courseId));
		expect(concluded.length).toBeGreaterThan(0);
		expect(concluded.map((c) => c.id)).not.toContain(Number(courseId));

		const asStudent = await run({ enrollment_type: 'student' });
		expect(asStudent.map((c) => c.id)).toContain(Number(courseId));
		const asTeacher = await run({ enrollment_type: 'teacher' });
		expect(asTeacher.map((c) => c.id)).not.toContain(Number(courseId));
		const byRole = await run({ enrollment_role_id: fx('studentRoleId') });
		expect(numeric(byRole.map((c) => c.id))).toEqual(numeric((await direct(`enrollment_role_id=${fx('studentRoleId')}`)).map((c) => c.id)));
		expect(byRole.map((c) => c.id)).toContain(Number(courseId));

		const noBlueprints = await run({ exclude_blueprint_courses: true });
		expect(noBlueprints.map((c) => c.id)).not.toContain(Number(fx('blueprintCourseId')));
		const homerooms = await run({ homeroom: true });
		for (const course of homerooms) expect(course.homeroom_course).toBe(true);
		expect(homerooms.map((c) => c.id)).not.toContain(Number(courseId));
	});

	it('getAllForUser: "Homeroom" keeps only homeroom courses', async () => {
		const homeroom = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('Progress battery homeroom'), homeroom_course: true },
			offer: true,
		});
		const homeroomId = String(homeroom.id);
		try {
			await canvas().post(`/api/v1/courses/${homeroomId}/enrollments`, {
				enrollment: { user_id: studentB, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
			});
			const everything = await runOk({ resource: 'course', operation: 'getAllForUser', params: { userId: studentB } });
			expect(numeric(everything.map((c) => c.id))).toEqual(numeric([courseId, homeroomId]));

			const homerooms = await runOk({
				resource: 'course',
				operation: 'getAllForUser',
				params: { userId: studentB, options: { homeroom: true } },
			});
			expect(homerooms.map((c) => c.id)).toEqual([Number(homeroomId)]);
			expect(homerooms[0].homeroom_course).toBe(true);
		} finally {
			await canvas().request('DELETE', `/api/v1/courses/${homeroomId}?event=delete`);
		}
	});

	it('getAllForUser: "self" and SIS user IDs; several users in one run', async () => {
		const own = await new CanvasClient('student').getAll<Json>('/api/v1/courses');
		const self = await runOk({
			resource: 'course',
			operation: 'getAllForUser',
			persona: 'student',
			params: { userId: 'self', pagination: { returnAll: true } },
		});
		expect(numeric(self.map((c) => c.id))).toEqual(numeric(own.map((c) => c.id)));

		const result = await runNode({
			resource: 'course',
			operation: 'getAllForUser',
			items: [{ user: `sis_user_id:${fx('studentSisUserId')}` }, { user: 99999999 }, { user: Number(studentB) }],
			params: { userId: '={{ $json.user }}', pagination: { returnAll: true }, errorHandling: { onError: 'continueWithError' } },
		});
		const first = result.rawSuccess.filter((item) => (item.pairedItem as Json).item === 0).map((item) => item.json);
		const third = result.rawSuccess.filter((item) => (item.pairedItem as Json).item === 2).map((item) => item.json);
		// As seen by the admin, who may also see courses the student cannot open yet.
		expect(numeric(first.map((c) => c.id))).toEqual(
			numeric((await canvas().getAll<Json>(`/api/v1/users/${fx('studentUserId')}/courses`)).map((c) => c.id)),
		);
		expect(third.map((c) => c.id)).toEqual([Number(courseId)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAllForUser', originalItem: { user: 99999999 } });
	});

	it('getAllForUser: an observer may list the courses of the student they observe; other students may not', async () => {
		const observed = await runOk({
			resource: 'course',
			operation: 'getAllForUser',
			persona: 'observer',
			params: { userId: fx('observeeUserId'), pagination: { returnAll: true } },
		});
		const expected = await new CanvasClient('observer').getAll<Json>(`/api/v1/users/${fx('observeeUserId')}/courses`);
		expect(numeric(observed.map((c) => c.id))).toEqual(numeric(expected.map((c) => c.id)));
		expect(observed.length).toBeGreaterThan(0);

		const refused = await runNode({
			resource: 'course',
			operation: 'getAllForUser',
			persona: 'student2',
			params: { userId: fx('studentUserId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getAllForUser' });
	});

	it('getAll: the options added for Get Many for User work for the token\'s own courses too', async () => {
		const courses = await runOk({
			resource: 'course',
			operation: 'getAll',
			persona: 'student',
			params: {
				options: { account_id: accountId, include: ['account', 'course_progress', 'passback_status', 'post_manually', 'storage_quota_used_mb', 'tabs'] },
				pagination: { returnAll: true },
			},
		});
		expect(courses.map((c) => c.id)).toEqual([Number(courseId)]);
		expect(courses[0].account).toMatchObject({ id: Number(accountId) });
		expect(courses[0].course_progress).toMatchObject({ requirement_count: 2 });
		expect(courses[0]).toHaveProperty('passback_status');
		expect(courses[0].post_manually).toBe(false);
		expect(courses[0].storage_quota_used_mb).toBeTypeOf('number');
		expect((courses[0].tabs as Json[]).length).toBeGreaterThan(0);
	});
});
