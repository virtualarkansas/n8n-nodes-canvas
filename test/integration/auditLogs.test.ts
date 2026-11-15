import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { COURSE_LINKS, expectedLinked, GRADE_CHANGE_LINKS } from './support/auditLinked';

/**
 * Resources: gradebookHistory, gradeChangeLog, courseAuditLog.
 * A course of our own is created, students are graded and regraded, and the
 * node's view of the logs is compared with what Canvas returns directly.
 */
let courseId = '';
let assignmentId = '';
let secondAssignmentId = '';
const students: string[] = [];
const graderId = fx('adminUserId');
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
	const c = canvas();
	const course = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
		course: { name: unique('Audit log course') },
		offer: true,
	});
	courseId = String(course.id);
	await c.put(`/api/v1/courses/${courseId}`, { course: { course_code: 'AUDIT-1' } });

	for (let i = 0; i < 12; i++) {
		const user = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name: unique(`Audit Student ${i}`) },
			pseudonym: { unique_id: `${unique('audit').replace(/\s/g, '.')}@example.edu` },
		});
		students.push(String(user.id));
		await c.post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active' },
		});
	}

	const make = async (name: string) =>
		String(
			(
				await c.post<Json>(`/api/v1/courses/${courseId}/assignments`, {
					assignment: { name, points_possible: 10, submission_types: ['online_text_entry'], published: true },
				})
			).id,
		);
	assignmentId = await make(unique('Audited essay'));
	secondAssignmentId = await make(unique('Audited quiz'));

	// Grade everyone, then regrade some, so there are several versions and changes per student.
	for (const [index, student] of students.entries()) {
		await c.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student}`, {
			submission: { posted_grade: String(index % 11) },
		});
	}
	for (const student of students.slice(0, 5)) {
		await c.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student}`, {
			submission: { posted_grade: '9.5' },
		});
		await c.put(`/api/v1/courses/${courseId}/assignments/${secondAssignmentId}/submissions/${student}`, {
			submission: { posted_grade: '3' },
		});
	}
});

describe('gradebookHistory', () => {
	// Canvas computes these summaries from a paginated list of submissions and returns a partial
	// entry for the same day on every page; the node reads all pages and merges them.
	const summarize = (days: Json[]) =>
		days.map((day) => ({
			date: day.date,
			graders: (day.graders as Json[])
				.map((grader) => ({
					id: grader.id,
					assignments: (grader.assignments as Json[]).map((a) => a.id).sort(),
				}))
				.sort((x, y) => Number(x.id) - Number(y.id)),
		}));

	it('getDays: one entry per day with every grader and assignment, however small the page size', async () => {
		// Canvas repeats a day on every page it spans, each time with part of its graders and
		// assignments (how it is split depends on the page size), so no raw page is the truth.
		for (const pagination of [{}, { perPage: 5, maxPages: 1 }]) {
			const days = await runOk({ resource: 'gradebookHistory', operation: 'getDays', params: { courseId, pagination } });
			expect(days).toHaveLength(1);
			expect(summarize(days)).toEqual([
				{ date: today, graders: [{ id: Number(graderId), assignments: [Number(assignmentId), Number(secondAssignmentId)].sort() }] },
			]);
			expect(days[0].date).toBe(today);
			const assignments = ((days[0].graders as Json[])[0].assignments as Json[]).map((a) => String(a.id)).sort();
			expect(assignments).toEqual([assignmentId, secondAssignmentId].sort());
		}
	});

	it('getDayDetails: every grader once with all their assignments, from a date or a date-time', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/gradebook_history/${today}`);
		for (const date of [today, `${today}T15:30:00Z`]) {
			const graders = await runOk({
				resource: 'gradebookHistory',
				operation: 'getDayDetails',
				params: { courseId, date, pagination: { perPage: 3, maxPages: 1 } },
			});
			expect(graders.map((g) => String(g.id))).toEqual([graderId]);
			expect((graders[0].assignments as Json[]).map((a) => a.id).sort()).toEqual(
				(expected[0].assignments as Json[]).map((a) => a.id).sort(),
			);
			expect(graders[0].assignments as Json[]).toHaveLength(2);
		}
	});

	it('getSubmissions: returns the graded submissions with their versions', async () => {
		const path = `/api/v1/courses/${courseId}/gradebook_history/${today}/graders/${graderId}/assignments/${assignmentId}/submissions`;
		const expected = await canvas().getAll<Json>(path);
		const submissions = await runOk({
			resource: 'gradebookHistory',
			operation: 'getSubmissions',
			params: { courseId, date: today, graderId, assignmentId, pagination: { returnAll: true } },
		});
		expect(submissions.length).toBe(expected.length);
		expect(submissions.length).toBe(students.length);
		const regraded = submissions.find((s) => (s.versions as Json[]).length > 1);
		expect(regraded, 'a regraded student should have more than one version').toBeDefined();
	});

	it('getFeed: pages through every submission version, with filters and ordering', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/gradebook_history/feed`);
		expect(expected.length).toBeGreaterThan(20);

		const all = await runOk({
			resource: 'gradebookHistory',
			operation: 'getFeed',
			params: { courseId, pagination: { returnAll: true } },
		});
		expect(all.map((v) => `${String(v.id)}:${String(v.current_grade)}:${String(v.graded_at)}`)).toEqual(
			expected.map((v) => `${String(v.id)}:${String(v.current_grade)}:${String(v.graded_at)}`),
		);

		const firstPage = await runOk({ resource: 'gradebookHistory', operation: 'getFeed', params: { courseId, pagination: { perPage: 4, maxPages: 2 } } });
		expect(firstPage).toHaveLength(8);

		const filtered = await runOk({
			resource: 'gradebookHistory',
			operation: 'getFeed',
			params: {
				courseId,
				options: { assignment_id: secondAssignmentId, user_id: students[0], ascending: true },
				pagination: { returnAll: true },
			},
		});
		expect(filtered.length).toBeGreaterThan(0);
		for (const version of filtered) {
			expect(String(version.assignment_id)).toBe(secondAssignmentId);
			expect(String(version.user_id)).toBe(students[0]);
		}
	});

	it('errors: a course that does not exist is reported on the Error output', async () => {
		const result = await runNode({
			resource: 'gradebookHistory',
			operation: 'getDays',
			params: { courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('errors: a student may not read the gradebook history', async () => {
		const result = await runNode({
			resource: 'gradebookHistory',
			operation: 'getFeed',
			persona: 'student',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403, 404]).toContain(result.error[0].errorCode);
	});
});

describe('gradeChangeLog', () => {
	const ids = (events: Json[]) => events.map((e) => String(e.id)).sort();

	it('getByCourse: one item per grade change, across pages', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/audit/grade_change/courses/${courseId}`, 'events');
		expect(expected.length).toBeGreaterThanOrEqual(students.length + 10);

		const events = await runOk({
			resource: 'gradeChangeLog',
			operation: 'getByCourse',
			params: { courseId, pagination: { returnAll: true } },
		});
		expect(ids(events)).toEqual(ids(expected));
		expect(events[0]).toHaveProperty('grade_after');
		expect(events[0]).toHaveProperty('links');
		// The wrapper object must not leak through as an item.
		expect(events.some((e) => 'events' in e)).toBe(false);

		const limited = await runOk({ resource: 'gradeChangeLog', operation: 'getByCourse', params: { courseId, pagination: { perPage: 5, maxPages: 2 } } });
		expect(limited).toHaveLength(10);
	});

	it('getByAssignment, getByStudent, getByGrader: each narrows to its subject', async () => {
		const byAssignment = await runOk({ resource: 'gradeChangeLog', operation: 'getByAssignment', params: { assignmentId: secondAssignmentId, pagination: { returnAll: true } } });
		expect(byAssignment).toHaveLength(5);
		for (const event of byAssignment) expect(String((event.links as Json).assignment)).toBe(secondAssignmentId);

		const byStudent = await runOk({ resource: 'gradeChangeLog', operation: 'getByStudent', params: { studentId: students[0], pagination: { returnAll: true } } });
		expect(byStudent).toHaveLength(3);
		for (const event of byStudent) expect(String((event.links as Json).student)).toBe(students[0]);

		const expectedByGrader = await canvas().getAll<Json>(`/api/v1/audit/grade_change/graders/${graderId}?start_time=${today}T00:00:00Z`, 'events');
		const byGrader = await runOk({
			resource: 'gradeChangeLog',
			operation: 'getByGrader',
			params: { graderId, options: { start_time: `${today}T00:00:00Z` }, pagination: { returnAll: true } },
		});
		expect(ids(byGrader)).toEqual(ids(expectedByGrader));
	});

	it('every change carries the course, assignment, student and grader it refers to, from its own page', async () => {
		const path = `/api/v1/audit/grade_change/courses/${courseId}`;
		const expected = await expectedLinked(path, GRADE_CHANGE_LINKS);
		// Pages of 4 here, of 7 in the direct read: each change must keep the records of its own page.
		const events = await runOk({
			resource: 'gradeChangeLog',
			operation: 'getByCourse',
			params: { courseId, pagination: { returnAll: true, perPage: 4 } },
		});
		expect(events).toHaveLength(expected.size);
		for (const item of events) {
			const { linked, ...event } = item;
			const direct = expected.get(String(item.id))!;
			expect(event).toEqual(direct.event);
			expect(linked).toEqual(direct.linked);
			const l = linked as Json;
			expect(String((l.course as Json).id)).toBe(courseId);
			expect(String((l.assignment as Json).id)).toBe(String((item.links as Json).assignment));
			expect((l.assignment as Json).name).toMatch(/^Audited /);
			expect(String((l.student as Json).id)).toBe(String((item.links as Json).student));
			expect((l.student as Json).name).toMatch(/^Audit Student /);
			expect(String((l.grader as Json).id)).toBe(graderId);
		}

		const bare = await runOk({
			resource: 'gradeChangeLog',
			operation: 'query',
			params: { filters: { course_id: courseId, student_id: students[2] }, includeLinked: false, pagination: { returnAll: true } },
		});
		expect(bare.length).toBeGreaterThan(0);
		for (const item of bare) expect(item).toEqual(expected.get(String(item.id))!.event);
	});

	it('time range: an end time in the past returns nothing', async () => {
		const events = await runOk({
			resource: 'gradeChangeLog',
			operation: 'getByCourse',
			params: { courseId, options: { start_time: '2001-01-01T00:00:00Z', end_time: '2001-12-31T00:00:00Z' } },
		});
		expect(events).toEqual([]);
	});

	it('query: combines filters', async () => {
		const events = await runOk({
			resource: 'gradeChangeLog',
			operation: 'query',
			params: {
				filters: { course_id: courseId, assignment_id: assignmentId, student_id: students[1], grader_id: graderId },
				pagination: { returnAll: true },
			},
		});
		expect(events).toHaveLength(2);
		expect(events.map((e) => e.grade_after).sort()).toEqual(['1', '9.5']);
	});

	it('query: refuses to run without any subject filter', async () => {
		const result = await runNode({
			resource: 'gradeChangeLog',
			operation: 'query',
			params: { filters: { start_time: `${today}T00:00:00Z` }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		expect(String(result.error[0].errorMessage)).toMatch(/at least one filter/i);
	});

	it('errors: a teacher without account rights is refused', async () => {
		const result = await runNode({
			resource: 'gradeChangeLog',
			operation: 'getByStudent',
			persona: 'student',
			params: { studentId: students[0], errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403]).toContain(result.error[0].errorCode);
	});
});

describe('courseAuditLog', () => {
	it('getByCourse: lists what happened to the course', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/audit/course/courses/${courseId}`, 'events');
		const events = await runOk({ resource: 'courseAuditLog', operation: 'getByCourse', params: { courseId, pagination: { returnAll: true } } });
		expect(events.map((e) => e.id).sort()).toEqual(expected.map((e) => e.id).sort());
		const types = events.map((e) => e.event_type);
		expect(types).toContain('created');
		expect(types).toContain('updated');
		const updated = events.find((e) => e.event_type === 'updated' && (e.event_data as Json).course_code);
		expect(updated, 'the course_code change should be logged').toBeDefined();
	});

	it('getByAccount: pages through the events of every course in the account, within a time range', async () => {
		const start = `${today}T00:00:00Z`;
		const expected = await canvas().getAll<Json>(`/api/v1/audit/course/accounts/${fx('accountId')}?start_time=${start}`, 'events');
		expect(expected.length).toBeGreaterThan(10);
		const events = await runOk({
			resource: 'courseAuditLog',
			operation: 'getByAccount',
			params: { accountId: fx('accountId'), options: { start_time: start }, pagination: { returnAll: true } },
		});
		// Other tests create courses concurrently, so the node may see a few more than the direct read did.
		const seen = new Set(events.map((e) => e.id));
		for (const event of expected) expect(seen.has(event.id)).toBe(true);
		expect(events.some((e) => String((e.links as Json).course) === courseId)).toBe(true);

		const none = await runOk({
			resource: 'courseAuditLog',
			operation: 'getByAccount',
			params: { accountId: fx('accountId'), options: { start_time: '2001-01-01T00:00:00Z', end_time: '2001-02-01T00:00:00Z' } },
		});
		expect(none).toEqual([]);
	});

	it('every event carries its course, user and the course it was reset to, from its own page', async () => {
		// Resetting a course is logged on the old course with a link to the new one ("reset_to").
		const c = canvas();
		const old = await c.post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, { course: { name: unique('Audit reset course') } });
		const fresh = await c.post<Json>(`/api/v1/courses/${old.id}/reset_content`);
		try {
			const path = `/api/v1/audit/course/courses/${old.id}`;
			const expected = await expectedLinked(path, COURSE_LINKS, 1);
			const events = await runOk({
				resource: 'courseAuditLog',
				operation: 'getByCourse',
				params: { courseId: String(old.id), pagination: { returnAll: true, perPage: 2 } },
			});
			expect(events).toHaveLength(expected.size);
			for (const item of events) {
				const { linked, ...event } = item;
				expect(event).toEqual(expected.get(String(item.id))!.event);
				expect(linked).toEqual(expected.get(String(item.id))!.linked);
				expect((linked as Json).course).toMatchObject({ id: String(old.id) });
				expect((linked as Json).user).toMatchObject({ id: graderId });
			}
			const reset = events.find((e) => e.event_type === 'reset_to');
			expect(reset, 'the reset must be logged').toBeDefined();
			expect((reset!.linked as Json).reset_to).toMatchObject({ id: String(fresh.id), name: old.name });

			const bare = await runOk({
				resource: 'courseAuditLog',
				operation: 'getByAccount',
				params: { accountId: fx('accountId'), includeLinked: false, options: { start_time: String(reset!.created_at) }, pagination: { perPage: 5, maxPages: 1 } },
			});
			expect(bare.length).toBeGreaterThan(0);
			for (const item of bare) expect(item).not.toHaveProperty('linked');
		} finally {
			await c.request('DELETE', `/api/v1/courses/${fresh.id}?event=delete`);
			await c.request('DELETE', `/api/v1/courses/${old.id}?event=delete`);
		}
	});

	it('errors: a student is refused', async () => {
		const result = await runNode({
			resource: 'courseAuditLog',
			operation: 'getByCourse',
			persona: 'student',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403]).toContain(result.error[0].errorCode);
	});
});
