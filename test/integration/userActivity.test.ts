import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, hasFixture, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { expectListedLikeCanvas, hoursFromNow, ownPersona, readList, removePersonas, waitFor } from './support/ownPersonas';
import type { OwnPersona } from './support/ownPersonas';

/**
 * Resource: user — what a user has done and has to do: missing and graded
 * submissions, page views, and the dashboard of the current user (activity
 * stream, to-do list, upcoming events).
 *
 * Two layers of data:
 *  - two courses of this file with a learner and a parent (observer) who have API
 *    tokens of their own: every filter is verified against known records, and the
 *    operations that change something (hiding stream items) only touch them;
 *  - the seeded personas, read only, for lists that are longer than the default
 *    page budget. Other test files add to those lists while this one runs, which
 *    `expectListedLikeCanvas` allows for.
 */
describe('user: activity', () => {
	const account = fx('accountId');
	let learner: OwnPersona;
	let parent: OwnPersona;
	let outsiderId = '';
	let courseA = '';
	let courseB = '';
	/** Only there to make the learner's activity stream longer than the default page budget. */
	let courseC = '';
	let enrollmentB = '';
	let overrideId = 0;
	let quizId = 0;
	let eventId = 0;
	/** Assignment IDs by what they are for. */
	const a: Record<'open' | 'locked' | 'soon' | 'graded' | 'unpublished' | 'gradedB' | 'missingB', number> = {
		open: 0,
		locked: 0,
		soon: 0,
		graded: 0,
		unpublished: 0,
		gradedB: 0,
		missingB: 0,
	};

	const STREAM_FILLERS = 52;
	const refuse = { errorHandling: { onError: 'continueWithError' } };
	const ids = (items: Json[]): number[] => items.map((item) => Number(item.id));
	const sorted = (values: number[]): number[] => [...values].sort((x, y) => x - y);
	const asLearner = (): { credential: OwnPersona['credential'] } => ({ credential: learner.credential });
	const asParent = (): { credential: OwnPersona['credential'] } => ({ credential: parent.credential });
	const learnerStream = (query = ''): Promise<Json[]> => learner.client.getAll<Json>(`/api/v1/users/self/activity_stream${query}`);

	beforeAll(async () => {
		const c = canvas();
		learner = await ownPersona('Activity Learner');
		parent = await ownPersona('Activity Parent');
		const outsider = await c.post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name: unique('Activity Outsider'), skip_registration: true },
			pseudonym: { unique_id: `${unique('activity').replace(/\s/g, '.')}@example.edu`, send_confirmation: false },
		});
		outsiderId = String(outsider.id);

		const course = async (label: string): Promise<string> =>
			String((await c.post<Json>(`/api/v1/accounts/${account}/courses`, { course: { name: unique(label) }, offer: true })).id);
		courseA = await course('Activity course A');
		courseB = await course('Activity course B');

		const enroll = (courseId: string, userId: string, type: string, extra: Json = {}): Promise<Json> =>
			c.post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: { user_id: userId, type, enrollment_state: 'active', ...extra },
			});
		await enroll(courseA, learner.id, 'StudentEnrollment');
		enrollmentB = String((await enroll(courseB, learner.id, 'StudentEnrollment')).id);
		await enroll(courseA, parent.id, 'ObserverEnrollment', { associated_user_id: learner.id });
		courseC = await course('Activity course C');
		await enroll(courseC, learner.id, 'StudentEnrollment');

		const assignment = async (courseId: string, name: string, extra: Json): Promise<number> =>
			Number(
				(
					await c.post<Json>(`/api/v1/courses/${courseId}/assignments`, {
						assignment: { name: unique(name), points_possible: 10, submission_types: ['online_text_entry'], published: true, ...extra },
					})
				).id,
			);
		a.locked = await assignment(courseA, 'Missing and locked', { due_at: hoursFromNow(-48), lock_at: hoursFromNow(-24) });
		a.open = await assignment(courseA, 'Missing and open', { due_at: hoursFromNow(-24) });
		a.missingB = await assignment(courseB, 'Missing in course B', { due_at: hoursFromNow(-12) });
		a.soon = await assignment(courseA, 'Due soon', { due_at: hoursFromNow(48) });
		a.graded = await assignment(courseA, 'Graded', {});
		a.unpublished = await assignment(courseA, 'Graded, then unpublished', {});
		a.gradedB = await assignment(courseB, 'Graded in course B', {});

		// Graded one after the other: Canvas lists graded submissions by the time of grading.
		for (const [courseId, assignmentId, grade] of [
			[courseA, a.graded, '7'],
			[courseA, a.unpublished, '8'],
			[courseB, a.gradedB, '9'],
		] as const) {
			await c.put(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${learner.id}`, { submission: { posted_grade: grade } });
			await new Promise((resolve) => setTimeout(resolve, 1100));
		}
		await c.put(`/api/v1/courses/${courseA}/assignments/${a.unpublished}`, { assignment: { published: false } });

		quizId = Number(
			(
				await c.post<Json>(`/api/v1/courses/${courseA}/quizzes`, {
					quiz: { title: unique('Practice quiz'), quiz_type: 'practice_quiz', published: true, due_at: hoursFromNow(48) },
				})
			).id,
		);
		eventId = Number(
			(
				await c.post<Json>('/api/v1/calendar_events', {
					calendar_event: { context_code: `course_${courseA}`, title: unique('Activity event'), start_at: hoursFromNow(24), end_at: hoursFromNow(25) },
				})
			).id,
		);
		for (const [courseId, label] of [
			[courseA, 'first in A'],
			[courseA, 'second in A'],
			[courseB, 'only one in B'],
		]) {
			await c.post(`/api/v1/courses/${courseId}/discussion_topics`, {
				title: unique(`Activity announcement, ${label}`),
				message: '<p>Announcement of the battery</p>',
				is_announcement: true,
				published: true,
			});
		}
		// Every new assignment puts an "Assignment Created" message into the stream of the students.
		// On paper and without a due date, so they are neither to-do items nor ever missing.
		for (let i = 0; i < STREAM_FILLERS; i += 4) {
			await Promise.all(
				Array.from({ length: Math.min(4, STREAM_FILLERS - i) }, (_, offset) =>
					c.post(`/api/v1/courses/${courseC}/assignments`, {
						assignment: { name: `${unique('Stream filler')} ${i + offset + 1}`, submission_types: ['on_paper'], published: true },
					}),
				),
			);
		}
		overrideId = Number(
			(
				await learner.client.post<Json>('/api/v1/planner/overrides', {
					plannable_type: 'assignment',
					plannable_id: a.open,
					marked_complete: false,
				})
			).id,
		);

		// Stream items and due dates are computed by background jobs, which all test files share.
		await waitFor(
			'the activity of the learner',
			async () => {
				const stream = await learnerStream();
				const missing = await c.getAll<Json>(`/api/v1/users/${learner.id}/missing_submissions`);
				const todo = await learner.client.getAll<Json>('/api/v1/users/self/todo');
				return (
					stream.length >= STREAM_FILLERS + 6 &&
					stream.filter((item) => item.type === 'Announcement').length >= 3 &&
					stream.filter((item) => item.type === 'Submission').length >= 3 &&
					missing.length >= 3 &&
					todo.some((item) => (item.assignment as Json | undefined)?.id === a.soon)
				);
			},
			300_000,
		);
	}, 480_000);

	afterAll(async () => {
		for (const id of [courseA, courseB, courseC]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		if (outsiderId) await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${outsiderId}`);
		await removePersonas([learner, parent]);
	});

	// ------------------------------------------------------------------ missing submissions

	it('getMissingSubmissions: past-due assignments without a submission, with every filter and include', async () => {
		const direct = (query = ''): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${learner.id}/missing_submissions${query}`);
		const run = (additionalFields: Json = {}, userId: string | number = learner.id): Promise<Json[]> =>
			runOk({ resource: 'user', operation: 'getMissingSubmissions', params: { userId, additionalFields } });

		// Oldest due date first, as Canvas orders them.
		const all = await run();
		expect(ids(all)).toEqual([a.locked, a.open, a.missingB]);
		expect(ids(all)).toEqual(ids(await direct()));
		expect(all[0]).not.toHaveProperty('course');
		expect(all[0]).not.toHaveProperty('planner_override');

		expect(ids(await run({ courseIds: courseA }, Number(learner.id)))).toEqual([a.locked, a.open]);
		expect(ids(await run({ courseIds: ` ${courseB} , ${courseA} ` }))).toEqual([a.locked, a.open, a.missingB]);
		expect(ids(await run({ courseIds: courseB }))).toEqual([a.missingB]);
		// A locked assignment can no longer be submitted.
		expect(ids(await run({ filter: ['submittable'] }))).toEqual([a.open, a.missingB]);
		expect(ids(await run({ filter: ['submittable'], courseIds: courseA }))).toEqual([a.open]);
		// The filter itself is shown on the seeded student below (these courses have no grading periods).
		expect(ids(await run({ filter: ['current_grading_period'] }))).toEqual(ids(await direct('?filter[]=current_grading_period')));

		const detailed = await run({ include: ['course', 'planner_overrides'] });
		expect(detailed.map((entry) => String((entry.course as Json).id))).toEqual([courseA, courseA, courseB]);
		expect(detailed.map((entry) => (entry.planner_override as Json | null)?.id ?? null)).toEqual([null, overrideId, null]);
		expect((detailed[1].planner_override as Json).marked_complete).toBe(false);

		// Several users per run; one without any enrollment yields no item.
		const several = await runNode({
			resource: 'user',
			operation: 'getMissingSubmissions',
			items: [{ id: Number(learner.id) }, { id: Number(outsiderId) }, { id: 99999999 }],
			params: { userId: '={{ $json.id }}', ...refuse },
		});
		expect(ids(several.success)).toEqual([a.locked, a.open, a.missingB]);
		expect(several.rawSuccess.every((item) => (item.pairedItem as Json).item === 0)).toBe(true);
		expect(several.error).toHaveLength(1);
		expect(several.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'getMissingSubmissions' });
	});

	it('getMissingSubmissions: students read their own, observers those of an observed student in the given courses, nobody else', async () => {
		const own = await runOk({ resource: 'user', operation: 'getMissingSubmissions', ...asLearner(), params: { userId: 'self' } });
		expect(ids(own)).toEqual([a.locked, a.open, a.missingB]);

		// The parent observes the learner in course A only.
		const observed = await runOk({
			resource: 'user',
			operation: 'getMissingSubmissions',
			...asParent(),
			params: { userId: 'self', additionalFields: { observedUserId: Number(learner.id), courseIds: `${courseA},${courseB}`, include: ['planner_overrides'] } },
		});
		expect(ids(observed)).toEqual([a.locked, a.open]);
		// The override belongs to the observed student, and is shown.
		expect((observed[1].planner_override as Json).id).toBe(overrideId);

		for (const additionalFields of [{ observedUserId: learner.id }, { observedUserId: learner.id, courseIds: courseB }]) {
			const refused = await runNode({
				resource: 'user',
				operation: 'getMissingSubmissions',
				...asParent(),
				params: { userId: 'self', additionalFields, ...refuse },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation: 'getMissingSubmissions' });
		}

		const stranger = await runNode({
			resource: 'user',
			operation: 'getMissingSubmissions',
			persona: 'student2',
			params: { userId: learner.id, ...refuse },
		});
		expect(stranger.success).toEqual([]);
		expect(stranger.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
	});

	it('getMissingSubmissions: pages through the many missing submissions of a seeded student, as admin, student and observer', async () => {
		const student = fx('studentUserId');
		const path = `/api/v1/users/${student}/missing_submissions`;
		const direct = (limit?: number): Promise<Json[]> => readList(canvas(), path, limit);
		const run = (params: Json, persona?: string): (() => Promise<Json[]>) => () =>
			runOk({ resource: 'user', operation: 'getMissingSubmissions', persona, params });
		// Canvas pages this list by page number.
		const numberedPages = true;

		const { all } = await expectListedLikeCanvas(run({ userId: student, pagination: { returnAll: true } }), direct, { numberedPages });
		// The seed alone leaves the student with about 25 missing submissions (other test files add
		// more while they run): more than the three pages of five read below, so the limit cuts.
		expect(all.length).toBeGreaterThan(15);
		await expectListedLikeCanvas(run({ userId: student }), direct, { take: 50, numberedPages });
		await expectListedLikeCanvas(run({ userId: student, pagination: { perPage: 5, maxPages: 3 } }), direct, { take: 15, numberedPages });

		const inPeriod = await expectListedLikeCanvas(
			run({ userId: student, additionalFields: { filter: ['current_grading_period'] }, pagination: { returnAll: true } }),
			(limit) => readList(canvas(), `${path}?filter[]=current_grading_period`, limit),
			{ numberedPages },
		);
		expect(inPeriod.all.length).toBeGreaterThan(0);
		expect(inPeriod.all.length).toBeLessThan(all.length);

		await expectListedLikeCanvas(run({ userId: 'self', pagination: { returnAll: true } }, 'student'), direct, { numberedPages });

		// The seeded observer observes the student in some of their courses.
		const links = await canvas().getAll<Json>(`/api/v1/users/${fx('observerUserId')}/enrollments?type[]=ObserverEnrollment&state[]=active`);
		const observedCourses = new Set(links.filter((link) => String(link.associated_user_id) === student).map((link) => Number(link.course_id)));
		const courseIds = Array.from(new Set(all.map((entry) => Number(entry.course_id)))).filter((id) => observedCourses.has(id));
		expect(courseIds.length).toBeGreaterThan(1);
		const observerClient = new CanvasClient('observer');
		const query = `?observed_user_id=${student}&${courseIds.map((id) => `course_ids[]=${id}`).join('&')}`;
		const observed = await expectListedLikeCanvas(
			run({ userId: 'self', additionalFields: { observedUserId: student, courseIds: courseIds.join(',') }, pagination: { returnAll: true } }, 'observer'),
			(limit) => readList(observerClient, `/api/v1/users/self/missing_submissions${query}`, limit),
			{ numberedPages },
		);
		expect(observed.listed.length).toBeGreaterThan(0);
		expect(observed.listed.every((entry) => courseIds.includes(Number(entry.course_id)))).toBe(true);
	});

	// ------------------------------------------------------------------ graded submissions

	it('getGradedSubmissions: most recently graded first, with the assignment and the published-only filter', async () => {
		const direct = (query = ''): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${learner.id}/graded_submissions${query}`);
		const run = (additionalFields: Json = {}, userId: string | number = learner.id): Promise<Json[]> =>
			runOk({ resource: 'user', operation: 'getGradedSubmissions', params: { userId, additionalFields } });
		const assignmentIds = (items: Json[]): number[] => items.map((item) => Number(item.assignment_id));

		const all = await run();
		expect(assignmentIds(all)).toEqual([a.gradedB, a.unpublished, a.graded]);
		expect(ids(all)).toEqual(ids(await direct()));
		expect(all.map((submission) => submission.grade)).toEqual(['9', '8', '7']);
		expect(all.every((submission) => Number(submission.user_id) === Number(learner.id))).toBe(true);
		expect(all[0]).not.toHaveProperty('assignment');

		const withAssignment = await run({ include: ['assignment'] }, Number(learner.id));
		expect(withAssignment.map((submission) => (submission.assignment as Json).id)).toEqual([a.gradedB, a.unpublished, a.graded]);

		expect(assignmentIds(await run({ onlyPublishedAssignments: true }))).toEqual([a.gradedB, a.graded]);
		expect(assignmentIds(await run({ onlyPublishedAssignments: false }))).toEqual([a.gradedB, a.unpublished, a.graded]);
		// While both enrollments are active, "Only Current Enrollments" changes nothing.
		expect(assignmentIds(await run({ onlyCurrentEnrollments: true }))).toEqual([a.gradedB, a.unpublished, a.graded]);

		const own = await runOk({ resource: 'user', operation: 'getGradedSubmissions', ...asLearner(), params: { userId: 'self' } });
		expect(assignmentIds(own)).toEqual([a.gradedB, a.unpublished, a.graded]);

		const none = await runNode({ resource: 'user', operation: 'getGradedSubmissions', params: { userId: outsiderId } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);
	});

	it('getGradedSubmissions: observers, other students and unknown users are refused', async () => {
		const attempts: Array<[string, Json]> = [
			['parent', { ...asParent(), params: { userId: learner.id, ...refuse } }],
			['student2', { persona: 'student2', params: { userId: learner.id, ...refuse } }],
		];
		for (const [who, options] of attempts) {
			const refused = await runNode({ resource: 'user', operation: 'getGradedSubmissions', ...options });
			expect(refused.success, who).toEqual([]);
			expect(refused.error[0], who).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation: 'getGradedSubmissions' });
		}
		const missing = await runNode({ resource: 'user', operation: 'getGradedSubmissions', params: { userId: '99999999', ...refuse } });
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('getGradedSubmissions: pages through the hundreds of graded submissions of a seeded student', async () => {
		const student = fx('studentUserId');
		const path = `/api/v1/users/${student}/graded_submissions`;
		const direct = (limit?: number): Promise<Json[]> => readList(canvas(), path, limit);
		const run = (params: Json, persona?: string): (() => Promise<Json[]>) => () =>
			runOk({ resource: 'user', operation: 'getGradedSubmissions', persona, params });

		const { listed, all } = await expectListedLikeCanvas(run({ userId: student, pagination: { returnAll: true } }), direct);
		// More than one page of 100.
		expect(all.length).toBeGreaterThan(100);
		const gradedAt = listed.map((submission) => Date.parse(String(submission.graded_at)));
		expect(gradedAt).toEqual([...gradedAt].sort((x, y) => y - x));

		await expectListedLikeCanvas(run({ userId: student }), direct, { take: 50 });
		await expectListedLikeCanvas(run({ userId: student, pagination: { perPage: 7, maxPages: 3 } }), direct, { take: 21 });
		await expectListedLikeCanvas(run({ userId: 'self', pagination: { perPage: 30, maxPages: 2 } }, 'student'), direct, { take: 60 });

		const current = await expectListedLikeCanvas(
			run({ userId: student, additionalFields: { onlyCurrentEnrollments: true, onlyPublishedAssignments: true, include: ['assignment'] }, pagination: { returnAll: true } }),
			(limit) => readList(canvas(), `${path}?only_current_enrollments=true&only_published_assignments=true`, limit),
		);
		expect(current.listed.length).toBeGreaterThan(0);
		expect(current.listed.length).toBeLessThanOrEqual(all.length);
		expect(current.listed.every((submission) => (submission.assignment as Json).published === true)).toBe(true);
	});

	// ------------------------------------------------------------------ activity stream

	const summaryKey = (entry: Json): string => `${String(entry.type)}|${String(entry.notification_category)}`;
	const bySummaryKey = (entries: Json[]): Json[] => [...entries].sort((x, y) => summaryKey(x).localeCompare(summaryKey(y)));

	it('getActivityStream / getActivityStreamSummary: the stream of the user of the credential', async () => {
		// Nobody else writes into this stream, so it must match Canvas exactly, page by page.
		const direct = (limit?: number): Promise<Json[]> => readList(learner.client, '/api/v1/users/self/activity_stream', limit);
		const run = (params: Json): (() => Promise<Json[]>) => () => runOk({ resource: 'user', operation: 'getActivityStream', ...asLearner(), params });
		const expected = await learnerStream();
		// Longer than the default page budget of 5 x 10.
		expect(expected.length).toBeGreaterThan(55);

		const { listed: stream } = await expectListedLikeCanvas(run({ pagination: { returnAll: true, perPage: 20 } }), direct);
		expect(ids(stream)).toEqual(ids(expected));
		const announcements = stream.filter((item) => item.type === 'Announcement');
		expect(announcements.map((item) => String(item.course_id)).sort()).toEqual([courseA, courseA, courseB].sort());
		expect(stream.filter((item) => item.type === 'Submission')).toHaveLength(3);
		expect(stream.filter((item) => item.type === 'Message' && String(item.course_id) === courseC)).toHaveLength(STREAM_FILLERS);

		await expectListedLikeCanvas(run({}), direct, { take: 50 });
		await expectListedLikeCanvas(run({ pagination: { perPage: 7, maxPages: 3 } }), direct, { take: 21 });
		await expectListedLikeCanvas(run({ additionalFields: { onlyActiveCourses: false }, pagination: { perPage: 4, maxPages: 2 } }), direct, { take: 8 });

		const summary = await runOk({ resource: 'user', operation: 'getActivityStreamSummary', ...asLearner(), params: {} });
		expect(bySummaryKey(summary)).toEqual(bySummaryKey(await learner.client.get<Json[]>('/api/v1/users/self/activity_stream/summary')));
		expect(summary.find((entry) => entry.type === 'Announcement')).toMatchObject({ count: 3, unread_count: 3 });

		// It is always the stream of the credential's user: the parent gets their own, without the learner's grades.
		const parentStream = await runOk({ resource: 'user', operation: 'getActivityStream', ...asParent(), params: { pagination: { returnAll: true } } });
		expect(ids(parentStream)).toEqual(ids(await parent.client.getAll<Json>('/api/v1/users/self/activity_stream')));
		expect(parentStream.length).toBeGreaterThan(0);
		expect(parentStream.some((item) => item.type === 'Submission')).toBe(false);
		expect(ids(parentStream)).not.toEqual(ids(expected));
	});

	it('getActivityStream: pages through the long stream of a seeded student', async () => {
		const client = new CanvasClient('student');
		const path = '/api/v1/users/self/activity_stream';
		const direct = (limit?: number): Promise<Json[]> => readList(client, path, limit);
		const run = (params: Json): (() => Promise<Json[]>) => () => runOk({ resource: 'user', operation: 'getActivityStream', persona: 'student', params });
		// Canvas pages the stream by page number, and other test files post into the student's
		// courses (and delete again) while it is read.
		const busy = { numberedPages: true, volatile: true };

		// Two pages of the largest size (the seed alone gives the stream about 240 heavy items, and
		// it grows while other files run; reading all of a stream is verified on the learner's own above).
		const large = await expectListedLikeCanvas(run({ pagination: { perPage: 100, maxPages: 2 } }), direct, { take: 200, ...busy });
		expect(large.listed).toHaveLength(200);
		await expectListedLikeCanvas(run({}), direct, { take: 50, ...busy });

		// The filtered stream: only items of courses, no conversations.
		const active = await expectListedLikeCanvas(
			run({ additionalFields: { onlyActiveCourses: true }, pagination: { perPage: 50, maxPages: 2 } }),
			(limit) => readList(client, `${path}?only_active_courses=true`, limit),
			{ take: 100, ...busy },
		);
		expect(active.listed).toHaveLength(100);
		expect(active.listed.every((item) => item.course_id !== null && item.course_id !== undefined)).toBe(true);
		expect(active.listed.some((item) => item.type === 'Conversation')).toBe(false);

		// The summary counts the same stream (compared while nobody adds to it).
		let agreed = false;
		for (let attempt = 0; attempt < 4 && !agreed; attempt++) {
			const before = bySummaryKey(await client.get<Json[]>('/api/v1/users/self/activity_stream/summary'));
			const summary = bySummaryKey(await runOk({ resource: 'user', operation: 'getActivityStreamSummary', persona: 'student', params: {} }));
			const after = bySummaryKey(await client.get<Json[]>('/api/v1/users/self/activity_stream/summary'));
			agreed = JSON.stringify(summary) === JSON.stringify(before) || JSON.stringify(summary) === JSON.stringify(after);
		}
		expect(agreed, 'the summary of the node matches the one Canvas reports').toBe(true);
	});

	// ------------------------------------------------------------------ to-do list and upcoming events

	const todoKey = (item: Json): string =>
		`${String(item.type)}:${item.quiz ? `quiz_${String((item.quiz as Json).id)}` : `assignment_${String((item.assignment as Json).id)}`}`;

	it('getTodoItems / getTodoItemCount / getUpcomingEvents: what the user of the credential has to do', async () => {
		const todo = await runOk({ resource: 'user', operation: 'getTodoItems', ...asLearner(), params: {} });
		expect(todo.map(todoKey)).toEqual((await learner.client.getAll<Json>('/api/v1/users/self/todo')).map(todoKey));
		expect(todo.map(todoKey)).toContain(`submitting:assignment_${a.soon}`);
		expect(todo.some((item) => item.quiz)).toBe(false);
		expect(todo.every((item) => String(item.course_id) === courseA || String(item.course_id) === courseB)).toBe(true);

		const withQuizzes = await runOk({
			resource: 'user',
			operation: 'getTodoItems',
			...asLearner(),
			params: { additionalFields: { include: ['ungraded_quizzes'] } },
		});
		expect(withQuizzes.map(todoKey)).toEqual(
			(await learner.client.getAll<Json>('/api/v1/users/self/todo?include[]=ungraded_quizzes')).map(todoKey),
		);
		expect(withQuizzes.map(todoKey).sort()).toEqual([...todo.map(todoKey), `submitting:quiz_${quizId}`].sort());

		const [count] = await runOk({ resource: 'user', operation: 'getTodoItemCount', ...asLearner(), params: {} });
		expect(count).toEqual({ needs_grading_count: 0, assignments_needing_submitting: todo.length });
		const [countWithQuizzes] = await runOk({
			resource: 'user',
			operation: 'getTodoItemCount',
			...asLearner(),
			params: { additionalFields: { include: ['ungraded_quizzes'] } },
		});
		expect(countWithQuizzes).toEqual({ needs_grading_count: 0, assignments_needing_submitting: todo.length + 1 });

		const upcoming = await runOk({ resource: 'user', operation: 'getUpcomingEvents', ...asLearner(), params: {} });
		expect(upcoming.map((event) => String(event.id))).toEqual(
			(await learner.client.get<Json[]>('/api/v1/users/self/upcoming_events')).map((event) => String(event.id)),
		);
		expect(upcoming.map((event) => String(event.id))).toEqual(expect.arrayContaining([String(eventId), `assignment_${a.soon}`]));

		// Somebody with nothing to do: no items, and a count of zero.
		const nothing = await runNode({ resource: 'user', operation: 'getTodoItems', ...asParent(), params: {} });
		expect(nothing.ok).toBe(true);
		expect(nothing.success).toEqual([]);
		expect(nothing.error).toEqual([]);
		const [zero] = await runOk({ resource: 'user', operation: 'getTodoItemCount', ...asParent(), params: {} });
		expect(zero).toEqual({ needs_grading_count: 0, assignments_needing_submitting: 0 });
	});

	it('getTodoItems: pages through the long to-do list of a seeded teacher', async () => {
		const client = new CanvasClient('teacher');
		const direct = (limit?: number): Promise<Json[]> => readList(client, '/api/v1/users/self/todo', limit);
		const run = (params: Json): (() => Promise<Json[]>) => () => runOk({ resource: 'user', operation: 'getTodoItems', persona: 'teacher', params });

		const { listed, all } = await expectListedLikeCanvas(run({ pagination: { returnAll: true } }), direct, { key: todoKey });
		expect(all.length).toBeGreaterThan(50);
		expect(listed.every((item) => item.type === 'grading')).toBe(true);
		await expectListedLikeCanvas(run({}), direct, { key: todoKey, take: 50 });
		await expectListedLikeCanvas(run({ pagination: { perPage: 7, maxPages: 3 } }), direct, { key: todoKey, take: 21 });

		const [count] = await runOk({ resource: 'user', operation: 'getTodoItemCount', persona: 'teacher', params: {} });
		expect(Number(count.needs_grading_count)).toBeGreaterThan(0);
		expect(count.assignments_needing_submitting).toBe(0);
	});

	// ------------------------------------------------------------------ concluded enrollments

	it('only active courses / only current enrollments: a concluded enrollment drops out of the stream and the graded submissions', async () => {
		await canvas().delete(`/api/v1/courses/${courseB}/enrollments/${enrollmentB}?task=conclude`);

		const everything = await runOk({ resource: 'user', operation: 'getActivityStream', ...asLearner(), params: { pagination: { returnAll: true } } });
		expect(everything.some((item) => String(item.course_id) === courseB)).toBe(true);

		const active = await runOk({
			resource: 'user',
			operation: 'getActivityStream',
			...asLearner(),
			params: { additionalFields: { onlyActiveCourses: true }, pagination: { returnAll: true } },
		});
		expect(ids(active)).toEqual(ids(await learnerStream('?only_active_courses=true')));
		expect(active.length).toBeGreaterThan(0);
		expect(active.some((item) => String(item.course_id) === courseA)).toBe(true);
		expect(active.every((item) => [courseA, courseC].includes(String(item.course_id)))).toBe(true);
		expect(active.length).toBeLessThan(everything.length);

		const summary = await runOk({
			resource: 'user',
			operation: 'getActivityStreamSummary',
			...asLearner(),
			params: { additionalFields: { onlyActiveCourses: true } },
		});
		expect(bySummaryKey(summary)).toEqual(
			bySummaryKey(await learner.client.get<Json[]>('/api/v1/users/self/activity_stream/summary?only_active_courses=true')),
		);
		expect(summary.find((entry) => entry.type === 'Announcement')).toMatchObject({ count: 2 });

		const graded = (additionalFields: Json): Promise<Json[]> =>
			runOk({ resource: 'user', operation: 'getGradedSubmissions', params: { userId: learner.id, additionalFields } });
		expect((await graded({ onlyCurrentEnrollments: true })).map((s) => s.assignment_id)).toEqual([a.unpublished, a.graded]);
		expect((await graded({ onlyCurrentEnrollments: true, onlyPublishedAssignments: true })).map((s) => s.assignment_id)).toEqual([a.graded]);
		expect((await graded({ onlyCurrentEnrollments: false })).map((s) => s.assignment_id)).toEqual([a.gradedB, a.unpublished, a.graded]);
	});

	// ------------------------------------------------------------------ hiding stream items

	it('hideStreamItem: hides items for the user of the credential only; an ID that is not in the stream is answered the same way', async () => {
		const before = await learnerStream();
		const parentBefore = ids(await parent.client.getAll<Json>('/api/v1/users/self/activity_stream'));
		const [first, second] = before.filter((item) => item.type === 'Announcement' && String(item.course_id) === courseA);
		// The admin wrote the announcements and has the very same stream items: hiding is per user.
		const adminHas = async (): Promise<number[]> =>
			ids(await canvas().getAll<Json>('/api/v1/users/self/activity_stream')).filter((id) => [Number(first.id), Number(second.id)].includes(id));
		expect(sorted(await adminHas())).toEqual(sorted([Number(first.id), Number(second.id)]));

		const [hidden] = await runOk({ resource: 'user', operation: 'hideStreamItem', ...asLearner(), params: { streamItemId: Number(first.id) } });
		expect(hidden).toEqual({ hidden: true });
		expect(ids(await learnerStream())).toEqual(ids(before).filter((id) => id !== Number(first.id)));

		const result = await runNode({
			resource: 'user',
			operation: 'hideStreamItem',
			...asLearner(),
			items: [{ id: String(second.id) }, { id: 99999999 }],
			params: { streamItemId: '={{ $json.id }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([{ hidden: true }, { hidden: true }]);
		expect(ids(await learnerStream())).toEqual(ids(before).filter((id) => ![Number(first.id), Number(second.id)].includes(id)));

		expect(sorted(await adminHas())).toEqual(sorted([Number(first.id), Number(second.id)]));
		expect(ids(await parent.client.getAll<Json>('/api/v1/users/self/activity_stream'))).toEqual(parentBefore);
	});

	it('hideAllStreamItems: empties the stream of the user of the credential and nobody else\'s', async () => {
		const parentBefore = ids(await parent.client.getAll<Json>('/api/v1/users/self/activity_stream'));
		expect((await learnerStream()).length).toBeGreaterThan(0);

		const [hidden] = await runOk({ resource: 'user', operation: 'hideAllStreamItems', ...asLearner(), params: {} });
		expect(hidden).toEqual({ hidden: true });
		expect(await learnerStream()).toEqual([]);

		const empty = await runNode({ resource: 'user', operation: 'getActivityStream', ...asLearner(), params: {} });
		expect(empty.ok).toBe(true);
		expect(empty.success).toEqual([]);
		expect(empty.error).toEqual([]);
		const summary = await runOk({ resource: 'user', operation: 'getActivityStreamSummary', ...asLearner(), params: {} });
		expect(summary).toEqual(await learner.client.get<Json[]>('/api/v1/users/self/activity_stream/summary'));
		expect(summary.reduce((total, entry) => total + Number(entry.count), 0)).toBe(0);

		expect(parentBefore.length).toBeGreaterThan(0);
		expect(ids(await parent.client.getAll<Json>('/api/v1/users/self/activity_stream'))).toEqual(parentBefore);
	});

	// ------------------------------------------------------------------ page views

	it('getPageViews: newest first, paged, and limited by start and end time', async () => {
		// Canvas records a page view per request once page views are switched on (and the web
		// process was restarted since). Then the learner produces their own; otherwise the page
		// views the seed wrote for the seeded student are used. Either way nothing changes while
		// the list is read.
		for (let i = 0; i < 56; i++) {
			await learner.client.request('GET', `/api/v1/users/self/profile?battery_page_view=${i}`);
		}
		const produced = await waitFor(
			'page views of the learner',
			async () => {
				const views = await canvas().getAll<Json>(`/api/v1/users/${learner.id}/page_views`);
				return views.filter((view) => String(view.url).includes('battery_page_view=')).length >= 56 ? views : undefined;
			},
			20_000,
		).catch(() => undefined);
		if (!produced && !hasFixture('pageViewUserIds')) throw new Error('This Canvas neither records page views nor has seeded ones');
		const userId = produced ? learner.id : fx('studentUserId');

		const path = `/api/v1/users/${userId}/page_views`;
		const direct = (limit?: number): Promise<Json[]> => readList(canvas(), path, limit);
		const run = (params: Json): (() => Promise<Json[]>) => () => runOk({ resource: 'user', operation: 'getPageViews', params: { userId, ...params } });

		const { listed, all } = await expectListedLikeCanvas(run({ pagination: { returnAll: true } }), direct);
		// More than the default page budget of 5 x 10.
		expect(all.length).toBeGreaterThan(55);
		const createdAt = listed.map((view) => Date.parse(String(view.created_at)));
		expect(createdAt).toEqual([...createdAt].sort((x, y) => y - x));
		expect(listed[0]).toMatchObject({ links: { user: Number(userId) } });
		await expectListedLikeCanvas(run({}), direct, { take: 50 });
		await expectListedLikeCanvas(run({ pagination: { perPage: 7, maxPages: 3 } }), direct, { take: 21 });

		// A boundary in the middle of the recorded range splits the list in two.
		const times = Array.from(new Set(createdAt)).sort((x, y) => x - y);
		expect(times.length, 'page views at three or more points in time').toBeGreaterThan(2);
		const boundary = new Date(times[Math.floor(times.length / 2)]).toISOString();
		const from = await expectListedLikeCanvas(
			run({ additionalFields: { startTime: boundary }, pagination: { returnAll: true } }),
			(limit) => readList(canvas(), `${path}?start_time=${encodeURIComponent(boundary)}`, limit),
		);
		const until = await expectListedLikeCanvas(
			run({ additionalFields: { endTime: boundary }, pagination: { returnAll: true } }),
			(limit) => readList(canvas(), `${path}?end_time=${encodeURIComponent(boundary)}`, limit),
		);
		expect(from.listed.length).toBeGreaterThan(0);
		expect(until.listed.length).toBeGreaterThan(0);
		expect(from.listed.length).toBeLessThan(all.length);
		expect(until.listed.length).toBeLessThan(all.length);
		expect(from.listed.every((view) => Date.parse(String(view.created_at)) >= Date.parse(boundary))).toBe(true);
		expect(until.listed.every((view) => Date.parse(String(view.created_at)) <= Date.parse(boundary))).toBe(true);

		const first = new Date(times[0]).toISOString();
		const last = new Date(times[times.length - 1]).toISOString();
		const between = await expectListedLikeCanvas(
			run({ additionalFields: { startTime: first, endTime: last }, pagination: { returnAll: true } }),
			(limit) => readList(canvas(), `${path}?start_time=${encodeURIComponent(first)}&end_time=${encodeURIComponent(last)}`, limit),
		);
		expect(between.listed.length).toBeGreaterThan(from.listed.length);
	});

	it('getPageViews: a user without page views yields nothing; impossible time ranges and non-admins are refused', async () => {
		const none = await runNode({ resource: 'user', operation: 'getPageViews', params: { userId: outsiderId } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);

		const future = await runNode({
			resource: 'user',
			operation: 'getPageViews',
			params: { userId: learner.id, additionalFields: { startTime: hoursFromNow(48) }, ...refuse },
		});
		expect(future.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'user', operation: 'getPageViews' });
		expect(String(future.error[0].errorMessage)).toContain('start_time cannot be in the future');

		const reversed = await runNode({
			resource: 'user',
			operation: 'getPageViews',
			params: { userId: learner.id, additionalFields: { startTime: hoursFromNow(-1), endTime: hoursFromNow(-5) }, ...refuse },
		});
		expect(reversed.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(reversed.error[0].errorMessage)).toContain('end_time must be after start_time');

		for (const options of [{ persona: 'teacher', params: { userId: learner.id, ...refuse } }, { ...asLearner(), params: { userId: 'self', ...refuse } }]) {
			const forbidden = await runNode({ resource: 'user', operation: 'getPageViews', ...options });
			expect(forbidden.success).toEqual([]);
			expect(forbidden.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation: 'getPageViews' });
		}
		const missing = await runNode({ resource: 'user', operation: 'getPageViews', params: { userId: '99999999', ...refuse } });
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
