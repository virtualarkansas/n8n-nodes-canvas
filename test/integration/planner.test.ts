import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createDedicatedAdmin, createDedicatedUser, removeDedicatedAdmin, removeDedicatedUser } from './misc-support/dedicated';
import type { DedicatedUser } from './misc-support/dedicated';
import { createCourse, daysFromNow, deleteCourses } from './misc-support/world';
import type { OwnCourse } from './misc-support/world';

vi.mock('../lib/state', async (original) =>
	(await import('./misc-support/state-overlay')).overlayState(await original()),
);

/**
 * Resource: planner (items, notes, overrides). Notes and overrides belong to the
 * user of the credential, so the writes run as a student and a teacher of the
 * battery's own, in courses of its own with a known set of dated items. The shared
 * personas are only read, over the large seeded data.
 */
describe('planner', () => {
	let admin: DedicatedUser;
	let api: CanvasClient;
	let pupil: DedicatedUser; // student in all three courses, time zone Asia/Tokyo (UTC+9, no DST)
	let coach: DedicatedUser; // teacher in main and second
	let parent: DedicatedUser; // observer of the pupil in main
	let asPupil: CanvasClient;
	let main: OwnCourse;
	let second: OwnCourse;
	let concluded: OwnCourse;

	// Every user of the instance also gets the events of the seeded account calendars, and other
	// test files add to those while this one runs. Listing the battery's own contexts keeps the
	// expected set exact; `own()` drops account events where no context codes are given.
	const DATES = { start_date: daysFromNow(-400), end_date: daysFromNow(400) };
	let WIDE: { start_date: string; end_date: string; context_codes: string };
	let wideQuery = '';
	const datesQuery = `start_date=${DATES.start_date}&end_date=${DATES.end_date}`;
	const own = (items: Json[]): Json[] => items.filter((i) => i.context_type !== 'Account');
	const mainAssignments: Json[] = [];
	let quizId = '';
	let pageId = '';
	let discussionId = '';
	let announcementId = '';
	let eventId = '';
	let submittedAssignmentId = '';

	const run = (opts: RunNodeOptions): Promise<RunNodeResult> => runNode({ persona: pupil.persona, ...opts });
	const ok = (opts: RunNodeOptions): Promise<Json[]> => runOk({ persona: pupil.persona, ...opts });
	const key = (item: Json): string => `${String(item.plannable_type)}:${String(item.plannable_id)}`;
	const keys = (items: Json[]): string[] => items.map(key);
	const itemsFor = (client: CanvasClient, query = wideQuery, path = '/api/v1/planner/items'): Promise<Json[]> =>
		client.getAll<Json>(`${path}?${query}`);

	beforeAll(async () => {
		admin = await createDedicatedAdmin('planner');
		api = new CanvasClient(admin.persona);
		[main, second, concluded] = await Promise.all([
			createCourse('Planner Main'),
			createCourse('Planner Second'),
			createCourse('Planner Concluded'),
		]);
		[pupil, coach, parent] = await Promise.all([
			createDedicatedUser(
				'planner-student',
				[main, second, concluded].map((c) => ({ courseId: c.id, type: 'StudentEnrollment' as const })),
				{ timeZone: 'Asia/Tokyo' },
			),
			createDedicatedUser('planner-teacher', [
				{ courseId: main.id, type: 'TeacherEnrollment' },
				{ courseId: second.id, type: 'TeacherEnrollment' },
			]),
			createDedicatedUser('planner-observer'),
		]);
		asPupil = new CanvasClient(pupil.persona);
		WIDE = { ...DATES, context_codes: `course_${main.id},course_${second.id},user_${pupil.id}` };
		wideQuery = `${datesQuery}&context_codes[]=course_${main.id}&context_codes[]=course_${second.id}&context_codes[]=user_${pupil.id}`;
		// Reading a student's planner needs a user-level observer link (an observer enrollment is not enough).
		await api.put(`/api/v1/users/${parent.id}/observees/${pupil.id}`);

		const assignment = (courseId: string, name: string, dueInDays: number): Promise<Json> =>
			api.post<Json>(`/api/v1/courses/${courseId}/assignments`, {
				assignment: { name, due_at: daysFromNow(dueInDays), published: true, submission_types: ['online_text_entry'], points_possible: 10 },
			});
		// Main course: 14 assignments from 13 days ago to 26 days ahead, plus one of every other planner type.
		for (let i = 0; i < 14; i++) {
			mainAssignments.push(await assignment(main.id, `Main assignment ${String(i).padStart(2, '0')}`, -13 + i * 3));
		}
		await assignment(second.id, 'Second assignment A', 2);
		await assignment(second.id, 'Second assignment B', 9);
		await assignment(concluded.id, 'Concluded assignment', 4);

		quizId = String(
			(
				await api.post<Json>(`/api/v1/courses/${main.id}/quizzes`, {
					quiz: { title: 'Practice quiz', quiz_type: 'practice_quiz', due_at: daysFromNow(5), published: true },
				})
			).id,
		);
		pageId = String(
			(
				await api.post<Json>(`/api/v1/courses/${main.id}/pages`, {
					wiki_page: { title: 'Reading with a to-do date', body: '<p>Read me</p>', published: true, student_todo_at: daysFromNow(6), student_planner_checkbox: true },
				})
			).page_id,
		);
		discussionId = String(
			(
				await api.post<Json>(`/api/v1/courses/${main.id}/discussion_topics`, {
					title: 'Ungraded discussion with a to-do date',
					message: 'Discuss',
					published: true,
					todo_date: daysFromNow(7),
				})
			).id,
		);
		announcementId = String(
			(
				await api.post<Json>(`/api/v1/courses/${main.id}/discussion_topics`, {
					title: 'Planner announcement',
					message: 'Welcome',
					is_announcement: true,
					published: true,
				})
			).id,
		);
		eventId = String(
			(
				await api.post<Json>('/api/v1/calendar_events', {
					calendar_event: { context_code: `course_${main.id}`, title: 'Field trip', start_at: daysFromNow(8), end_at: daysFromNow(8, 17) },
				})
			).id,
		);

		// One past assignment is handed in, so the completion filters have something to tell apart.
		submittedAssignmentId = String(mainAssignments[1].id);
		await asPupil.post(`/api/v1/courses/${main.id}/assignments/${submittedAssignmentId}/submissions`, {
			submission: { submission_type: 'online_text_entry', body: '<p>Done</p>' },
		});
		await api.request('DELETE', `/api/v1/courses/${concluded.id}?event=conclude`);
	});

	afterAll(async () => {
		await Promise.all([removeDedicatedUser(pupil), removeDedicatedUser(coach), removeDedicatedUser(parent)]);
		await deleteCourses([main, second, concluded]);
		await removeDedicatedAdmin(admin);
	});

	// ---------------------------------------------------------------- items

	describe('getAllItems', () => {
		it('lists every item of the student, of every type, in date order', async () => {
			const expected = await itemsFor(asPupil);
			const types = new Set(expected.map((i) => i.plannable_type));
			expect(types).toEqual(new Set(['assignment', 'quiz', 'wiki_page', 'discussion_topic', 'announcement', 'calendar_event']));
			expect(expected.filter((i) => i.plannable_type === 'assignment')).toHaveLength(16);

			const all = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE }, pagination: { returnAll: true } },
			});
			expect(keys(all)).toEqual(keys(expected));
			expect(new Set(keys(all)).size).toBe(all.length);
			const dates = all.map((i) => String(i.plannable_date));
			expect(dates).toEqual(dates.slice().sort());

			const first = all.find((i) => key(i) === `assignment:${String(mainAssignments[0].id)}`) as Json;
			expect(first).toMatchObject({
				context_type: 'Course',
				course_id: Number(main.id),
				planner_override: null,
				plannable_date: mainAssignments[0].due_at,
				context_name: main.name,
			});
			expect((first.plannable as Json).title).toBe('Main assignment 00');
			expect(first.submissions).toMatchObject({ submitted: false, missing: true });
		});

		it('pages through the list with Canvas\' bookmarks: no gaps, no duplicates', async () => {
			const expected = await itemsFor(asPupil);
			expect(expected.length).toBeGreaterThan(20);

			const firstPages = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE }, pagination: { perPage: 4, maxPages: 3 } },
			});
			expect(keys(firstPages)).toEqual(keys(expected).slice(0, 12));

			const everything = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE }, pagination: { perPage: 5, maxPages: 0 } },
			});
			expect(keys(everything)).toEqual(keys(expected));

			// The bookmark in the "next" link is opaque: Canvas really uses bookmarks here, not page numbers.
			const page = await asPupil.request('GET', `/api/v1/planner/items?${wideQuery}&per_page=4`);
			expect(page.headers.get('link')).toMatch(/page=bookmark:[^&>]+[^>]*>; rel="next"/);
		});

		it('start and end date bound the list; dates may be yyyy-mm-dd or carry a time zone', async () => {
			const start = daysFromNow(-5, 0);
			const end = daysFromNow(10, 0);
			const codes = wideQuery.replace(datesQuery, '');
			const expected = await itemsFor(asPupil, `start_date=${start}&end_date=${end}${codes}`);
			expect(expected.length).toBeGreaterThan(3);
			expect(expected.length).toBeLessThan((await itemsFor(asPupil)).length);

			const bounded = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { start_date: start, end_date: end, context_codes: WIDE.context_codes }, pagination: { returnAll: true } },
			});
			expect(keys(bounded)).toEqual(keys(expected));
			for (const item of bounded) {
				const date = String(item.plannable_date);
				expect(date >= start && date <= end, `${key(item)} at ${date}`).toBe(true);
			}

			// The same instants written with a +09:00 offset select the same items.
			const tokyo = (iso: string): string => {
				const shifted = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 19);
				return `${shifted}+09:00`;
			};
			const offset = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { start_date: tokyo(start), end_date: tokyo(end), context_codes: WIDE.context_codes }, pagination: { returnAll: true } },
			});
			expect(keys(offset)).toEqual(keys(expected));

			// Date-only values; only a start, only an end.
			const day = start.slice(0, 10);
			const fromDay = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { start_date: day, context_codes: WIDE.context_codes }, pagination: { returnAll: true } },
			});
			expect(keys(fromDay)).toEqual(keys(await itemsFor(asPupil, `start_date=${day}${codes}`)));
			const untilDay = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { end_date: day, context_codes: WIDE.context_codes }, pagination: { returnAll: true } },
			});
			expect(keys(untilDay)).toEqual(keys(await itemsFor(asPupil, `end_date=${day}${codes}`)));
			expect(fromDay.length + untilDay.length).toBe((await itemsFor(asPupil)).length);
		});

		it('without dates Canvas returns everything, not the documented two weeks', async () => {
			const all = own(await ok({ resource: 'planner', operation: 'getAllItems', params: { pagination: { returnAll: true } } }));
			expect(keys(all)).toEqual(keys(own(await itemsFor(asPupil, ''))));
			// Includes the assignment due 13 days ago and the one due 26 days ahead.
			expect(keys(all)).toContain(`assignment:${String(mainAssignments[0].id)}`);
			expect(keys(all)).toContain(`assignment:${String(mainAssignments[13].id)}`);
		});

		it('context codes select courses: text list, list from an expression, and the user\'s own code', async () => {
			const onlySecond = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...DATES, context_codes: `course_${second.id}` }, pagination: { returnAll: true } },
			});
			expect(onlySecond.map((i) => (i.plannable as Json).title)).toEqual(['Second assignment A', 'Second assignment B']);

			const both = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...DATES, context_codes: ` course_${second.id} , course_${main.id},, ` }, pagination: { returnAll: true } },
			});
			const expectedBoth = await itemsFor(asPupil, `${datesQuery}&context_codes[]=course_${second.id}&context_codes[]=course_${main.id}`);
			expect(keys(both)).toEqual(keys(expectedBoth));
			expect(new Set(both.map((i) => i.course_id))).toEqual(new Set([Number(main.id), Number(second.id)]));

			const fromArray = await run({
				resource: 'planner',
				operation: 'getAllItems',
				items: [{ codes: [`course_${main.id}`, `course_${second.id}`] }, { codes: [`course_${second.id}`] }],
				params: { options: { ...DATES, context_codes: '={{ $json.codes }}' }, pagination: { returnAll: true } },
			});
			expect(fromArray.error).toEqual([]);
			const perItem = [0, 1].map((index) =>
				fromArray.rawSuccess.filter((i) => (i.pairedItem as Json).item === index).map((i) => key(i.json)),
			);
			expect(perItem[0].slice().sort()).toEqual(keys(expectedBoth).sort());
			expect(perItem[1]).toHaveLength(2);

			// A course the user is not in is refused rather than silently ignored.
			const foreign = await run({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...DATES, context_codes: `course_${fx('courseId')}` }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(foreign.success).toEqual([]);
			expect(foreign.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'planner', operation: 'getAllItems' });
		});

		it('filters: complete and incomplete items split the list; new activity is its own view', async () => {
			const total = await itemsFor(asPupil);
			const complete = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, filter: 'complete_items' }, pagination: { returnAll: true } },
			});
			expect(keys(complete)).toEqual(keys(await itemsFor(asPupil, `${wideQuery}&filter=complete_items`)));
			expect(keys(complete)).toEqual([`assignment:${submittedAssignmentId}`]);

			const incomplete = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, filter: 'incomplete_items' }, pagination: { returnAll: true } },
			});
			expect(keys(incomplete)).toEqual(keys(await itemsFor(asPupil, `${wideQuery}&filter=incomplete_items`)));
			expect(keys(incomplete)).not.toContain(`assignment:${submittedAssignmentId}`);
			expect(complete.length + incomplete.length).toBe(total.length);

			const newActivity = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, filter: 'new_activity' }, pagination: { returnAll: true } },
			});
			expect(keys(newActivity)).toEqual(keys(await itemsFor(asPupil, `${wideQuery}&filter=new_activity`)));
			expect(keys(newActivity)).toContain(`announcement:${announcementId}`);

			// "All Items" (empty value) sends no filter.
			const unfiltered = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, filter: '' }, pagination: { returnAll: true } },
			});
			expect(keys(unfiltered)).toEqual(keys(total));
		});

		it('include: all courses, concluded and account calendars are passed on', async () => {
			const fromConcluded = (items: Json[]): Json[] => items.filter((i) => i.course_id === Number(concluded.id));
			const plain = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE }, pagination: { returnAll: true } },
			});
			expect(fromConcluded(plain)).toEqual([]);

			// "All Courses" replaces the context codes by every current course of the user (no personal notes,
			// no account calendars); the three includes are passed on as include[].
			const allCourses = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...DATES, include: ['all_courses', 'concluded'] }, pagination: { returnAll: true } },
			});
			expect(keys(allCourses)).toEqual(keys(await itemsFor(asPupil, `${datesQuery}&include[]=all_courses&include[]=concluded`)));
			expect(allCourses.every((i) => i.context_type === 'Course')).toBe(true);
			expect(new Set(allCourses.map((i) => i.course_id))).toEqual(new Set([Number(main.id), Number(second.id)]));

			// Account calendars the user follows are included on request (the seed has some for every user).
			const withCalendars = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, include: ['account_calendars'] }, pagination: { returnAll: true } },
			});
			expect(keys(own(withCalendars))).toEqual(keys(plain));
			expect(withCalendars.length).toBeGreaterThanOrEqual(plain.length);
		});

		it('another user\'s planner: an observer reads the linked student, admins and teachers are refused', async () => {
			const asParent = new CanvasClient(parent.persona);
			const expected = await itemsFor(asParent, wideQuery, `/api/v1/users/${pupil.id}/planner/items`);
			expect(expected.length).toBeGreaterThan(10);
			expect(keys(expected)).toEqual(keys(await itemsFor(asPupil)));

			const viaUserId = await runOk({
				resource: 'planner',
				operation: 'getAllItems',
				persona: parent.persona,
				params: { options: { ...WIDE, user_id: ` ${pupil.id} ` }, pagination: { returnAll: true, perPage: 6 } },
			});
			expect(keys(viaUserId)).toEqual(keys(expected));

			const viaObserved = await runOk({
				resource: 'planner',
				operation: 'getAllItems',
				persona: parent.persona,
				params: {
					options: { ...DATES, observed_user_id: Number(pupil.id), context_codes: `course_${main.id}` },
					pagination: { returnAll: true },
				},
			});
			expect(keys(viaObserved)).toEqual(
				keys(await itemsFor(asParent, `${datesQuery}&observed_user_id=${pupil.id}&context_codes[]=course_${main.id}`)),
			);
			// Canvas adds every course in which the observer is linked to the student to the ones asked for.
			expect(viaObserved.length).toBeGreaterThan(10);
			expect(viaObserved.every((i) => [Number(main.id), Number(second.id)].includes(Number(i.course_id)))).toBe(true);

			// Without context codes "observed user" is refused.
			const noCodes = await runNode({
				resource: 'planner',
				operation: 'getAllItems',
				persona: parent.persona,
				params: { options: { ...DATES, observed_user_id: pupil.id }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(noCodes.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'getAllItems' });

			for (const persona of [admin.persona, coach.persona]) {
				const refused = await runNode({
					resource: 'planner',
					operation: 'getAllItems',
					persona,
					params: { options: { ...DATES, user_id: pupil.id }, errorHandling: { onError: 'continueWithError' } },
				});
				expect(refused.success).toEqual([]);
				expect(refused.error[0]).toMatchObject({
					errorType: 'FORBIDDEN',
					endpoint: `/api/v1/users/${pupil.id}/planner/items`,
				});
			}

			// Users may name themselves.
			const self = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, user_id: pupil.id }, pagination: { returnAll: true } },
			});
			expect(keys(self)).toEqual(keys(await itemsFor(asPupil)));
		});

		it('errors: an invalid date is a validation error with Canvas\' message; an unknown user is a 404', async () => {
			const result = await run({
				resource: 'planner',
				operation: 'getAllItems',
				items: [{ start: '2026-01-01' }, { start: 'not-a-date' }, { start: '2026-02-30T25:61:00Z' }],
				params: { options: { start_date: '={{ $json.start }}', end_date: '2026-01-02' }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.rawSuccess.every((i) => (i.pairedItem as Json).item === 0)).toBe(true);
			expect(result.error.length).toBeGreaterThanOrEqual(1);
			expect(result.error[0]).toMatchObject({
				errorCode: 400,
				errorType: 'VALIDATION_ERROR',
				resource: 'planner',
				operation: 'getAllItems',
				originalItem: { start: 'not-a-date' },
			});
			expect(String(result.error[0].errorMessage)).toMatch(/start_date/);

			const missing = await run({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { user_id: '999999999' }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/users/999999999/planner/items' });
		});

		it('seeded data: the shared student has more items than the default page cap', async () => {
			const asStudent = new CanvasClient('student');
			const before = keys(await itemsFor(asStudent, datesQuery));
			expect(before.length, 'the seed gives the student persona a full planner').toBeGreaterThan(100);

			const defaults = await runOk({ resource: 'planner', operation: 'getAllItems', persona: 'student', params: { options: { ...DATES } } });
			expect(defaults).toHaveLength(50);
			expect(new Set(keys(defaults)).size).toBe(50);

			const all = await runOk({
				resource: 'planner',
				operation: 'getAllItems',
				persona: 'student',
				params: { options: { ...DATES }, pagination: { returnAll: true } },
			});
			const after = keys(await itemsFor(asStudent, datesQuery));
			// Other test files add and change items of the shared persona while this runs, so compare against
			// the lists read before and after: everything in both must be there, nothing outside either.
			const got = new Set(keys(all));
			expect(got.size).toBe(all.length);
			for (const stable of before.filter((k) => after.includes(k))) {
				expect(got.has(stable), stable).toBe(true);
			}
			for (const k of got) {
				expect(before.includes(k) || after.includes(k), k).toBe(true);
			}

			// One course of the seed, incomplete items only, small pages.
			const course = await runOk({
				resource: 'planner',
				operation: 'getAllItems',
				persona: 'student',
				params: {
					options: { ...DATES, context_codes: `course_${fx('courseId')}`, filter: 'incomplete_items' },
					pagination: { perPage: 7, maxPages: 4 },
				},
			});
			expect(course).toHaveLength(28);
			expect(new Set(keys(course)).size).toBe(28);
			expect(course.every((i) => i.course_id === Number(fx('courseId')))).toBe(true);
		});

		it('seeded data: the shared observer reads the shared student; the shared teacher has no planner items', async () => {
			const observed = await runOk({
				resource: 'planner',
				operation: 'getAllItems',
				persona: 'observer',
				params: { options: { ...DATES, user_id: fx('studentUserId') }, pagination: { perPage: 20, maxPages: 2 } },
			});
			expect(observed).toHaveLength(40);
			expect(new Set(keys(observed)).size).toBe(40);

			const teacher = await runNode({
				resource: 'planner',
				operation: 'getAllItems',
				persona: 'teacher',
				params: { options: { ...DATES, context_codes: `course_${fx('courseId')}` }, pagination: { returnAll: true } },
			});
			expect(teacher.ok).toBe(true);
			expect(teacher.error).toEqual([]);
			expect(teacher.success.some((i) => i.plannable_type === 'assignment')).toBe(false);
		});
	});

	// ---------------------------------------------------------------- notes

	describe('notes', () => {
		let noteId = '';
		let linkedNoteId = '';
		const title = 'Bring the biology book — Ünïcødé 笔记 "quoted" & <b>tags</b> 📓';
		const details = `Line one\nLine two with <i>markup</i> & ampersands\n${'long text '.repeat(400)}`;
		const notes = (query = ''): Promise<Json[]> => asPupil.get<Json[]>(`/api/v1/planner_notes${query}`);

		it('getAllNotes: a user without notes gets no items', async () => {
			const result = await run({ resource: 'planner', operation: 'getAllNotes' });
			expect(result.ok).toBe(true);
			expect(result.success).toEqual([]);
		});

		it('createNote: every field reaches Canvas; a date without a time zone is the user\'s local time', async () => {
			const [created] = await ok({
				resource: 'planner',
				operation: 'createNote',
				params: {
					title,
					// n8n's date picker produces values without a time zone.
					todoDate: '2027-03-10T09:30:00',
					additionalFields: { details, course_id: Number(main.id) },
				},
			});
			noteId = String(created.id);
			expect(created).toMatchObject({ title, details, course_id: Number(main.id), user_id: Number(pupil.id), workflow_state: 'active' });

			const actual = await asPupil.get<Json>(`/api/v1/planner_notes/${noteId}`);
			expect(actual).toMatchObject({ title, details, course_id: Number(main.id), user_id: Number(pupil.id) });
			// The student's time zone is Asia/Tokyo (UTC+9): 09:30 local is 00:30 UTC.
			expect(actual.todo_date).toBe('2027-03-10T00:30:00Z');
		});

		it('createNote: dates with an explicit zone are kept exactly; a note without a course', async () => {
			const result = await run({
				resource: 'planner',
				operation: 'createNote',
				items: [
					{ when: '2027-03-11T09:30:00Z', expected: '2027-03-11T09:30:00Z' },
					{ when: '2027-03-12T09:30:00-05:00', expected: '2027-03-12T14:30:00Z' },
					{ when: '2027-03-13T23:15:00+05:30', expected: '2027-03-13T17:45:00Z' },
					{ when: '2027-03-14', expected: '2027-03-13T15:00:00Z' },
				],
				params: { title: '=Zoned {{ $itemIndex }}', todoDate: '={{ $json.when }}' },
			});
			expect(result.error).toEqual([]);
			expect(result.success).toHaveLength(4);
			for (const [index, note] of result.success.entries()) {
				const actual = await asPupil.get<Json>(`/api/v1/planner_notes/${String(note.id)}`);
				expect(actual.todo_date, String(index)).toBe(['2027-03-11T09:30:00Z', '2027-03-12T14:30:00Z', '2027-03-13T17:45:00Z', '2027-03-13T15:00:00Z'][index]);
				expect(actual).toMatchObject({ title: `Zoned ${index}`, course_id: null, details: null });
			}
		});

		it('createNote: a note linked to an assignment takes its title when none is given', async () => {
			const target = mainAssignments[5];
			const [created] = await ok({
				resource: 'planner',
				operation: 'createNote',
				params: {
					title: '',
					todoDate: daysFromNow(3),
					additionalFields: { course_id: main.id, linked_object_type: 'assignment', linked_object_id: Number(target.id), details: 'Linked' },
				},
			});
			linkedNoteId = String(created.id);
			const actual = await asPupil.get<Json>(`/api/v1/planner_notes/${linkedNoteId}`);
			expect(actual).toMatchObject({
				title: 'Main assignment 05',
				course_id: Number(main.id),
				linked_object_type: 'assignment',
				linked_object_id: Number(target.id),
				details: 'Linked',
			});
			expect(String(actual.linked_object_html_url)).toContain(`/courses/${main.id}/assignments/${String(target.id)}`);

			// Every linkable type that exists in the course, with an explicit title.
			const others = await run({
				resource: 'planner',
				operation: 'createNote',
				items: [
					{ type: 'quiz', id: quizId },
					{ type: 'wiki_page', id: pageId },
					{ type: 'discussion_topic', id: discussionId },
					{ type: 'announcement', id: announcementId },
				],
				params: {
					title: '=Linked to {{ $json.type }}',
					todoDate: daysFromNow(3),
					additionalFields: { course_id: main.id, linked_object_type: '={{ $json.type }}', linked_object_id: '={{ $json.id }}' },
				},
			});
			expect(others.error).toEqual([]);
			// Canvas stores an announcement as the discussion topic it is, and reports it that way.
			expect(others.success.map((n) => [n.linked_object_type, String(n.linked_object_id)])).toEqual([
				['quiz', quizId],
				['wiki_page', pageId],
				['discussion_topic', discussionId],
				['discussion_topic', announcementId],
			]);
		});

		it('createNote: Canvas\' refusals arrive on the Error output, per item', async () => {
			const result = await run({
				resource: 'planner',
				operation: 'createNote',
				items: [
					{ case: 'no title', title: '', course: '', type: '', object: '' },
					{ case: 'second note for the same object', title: 'dup', course: main.id, type: 'assignment', object: String(mainAssignments[5].id) },
					{ case: 'link without course', title: 'no course', course: '', type: 'assignment', object: String(mainAssignments[6].id) },
					{ case: 'object of another course', title: 'elsewhere', course: second.id, type: 'assignment', object: String(mainAssignments[6].id) },
					{ case: 'unknown course', title: 'nowhere', course: '999999999', type: '', object: '' },
					{ case: 'course the user is not in', title: 'foreign', course: fx('unpublishedCourseId'), type: '', object: '' },
					// Canvas has no length limit on the title.
					{ case: 'fine', title: `Fine ${'x'.repeat(300)}`, course: '', type: '', object: '' },
				],
				params: {
					title: '={{ $json.title }}',
					todoDate: daysFromNow(1),
					// Fields that resolve to nothing for an item are left out of that item's request.
					additionalFields: {
						course_id: '={{ $json.course }}',
						linked_object_type: '={{ $json.type }}',
						linked_object_id: '={{ $json.object }}',
					},
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success.map((n) => n.title)).toEqual([`Fine ${'x'.repeat(300)}`]);
			expect(result.success[0]).toMatchObject({ course_id: null });
			expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 6 }]);
			const byCase = Object.fromEntries(result.error.map((e) => [String((e.originalItem as Json).case), e]));
			expect(Object.keys(byCase)).toHaveLength(6);
			expect(byCase['no title']).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
			expect(String(byCase['no title'].errorMessage)).toMatch(/title/);
			expect(byCase['second note for the same object']).toMatchObject({
				errorCode: 400,
				errorMessage: 'a planner note linked to that object already exists',
			});
			expect(byCase['link without course']).toMatchObject({ errorCode: 400, errorMessage: 'must specify course_id' });
			expect(byCase['object of another course']).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
			expect(byCase['unknown course']).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
			expect(byCase['course the user is not in']).toMatchObject({ errorType: 'FORBIDDEN' });
		});

		it('getNote: returns the note; notes of other users do not exist for the caller', async () => {
			const [note] = await ok({ resource: 'planner', operation: 'getNote', params: { noteId: ` ${noteId} ` } });
			expect(note).toEqual(await asPupil.get<Json>(`/api/v1/planner_notes/${noteId}`));

			const foreign = await runNode({
				resource: 'planner',
				operation: 'getNote',
				persona: coach.persona,
				params: { noteId: Number(noteId), errorHandling: { onError: 'continueWithError' } },
			});
			expect(foreign.success).toEqual([]);
			expect(foreign.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: `/api/v1/planner_notes/${noteId}` });
		});

		it('getAllNotes: returns all notes at once, whatever the paging options', async () => {
			const bulk = await run({
				resource: 'planner',
				operation: 'createNote',
				items: Array.from({ length: 14 }, (_, i) => ({ n: i })),
				params: { title: '=Bulk note {{ $json.n }}', todoDate: `={{ "2027-05-" + String($json.n + 1).padStart(2, "0") + "T12:00:00Z" }}` },
			});
			expect(bulk.error).toEqual([]);
			const expected = await notes();
			expect(expected.length).toBeGreaterThan(20);

			// Canvas does not paginate this list: page size and page cap change nothing.
			const listed = await ok({ resource: 'planner', operation: 'getAllNotes', params: { pagination: { perPage: 3, maxPages: 1 } } });
			expect(listed.map((n) => n.id).sort()).toEqual(expected.map((n) => n.id).sort());
			expect(new Set(listed.map((n) => n.id)).size).toBe(listed.length);
		});

		it('getAllNotes: date range and context codes filter the notes', async () => {
			const ranged = await ok({
				resource: 'planner',
				operation: 'getAllNotes',
				params: { options: { start_date: '2027-05-03', end_date: '2027-05-06' } },
			});
			expect(ranged.map((n) => n.title).sort()).toEqual(['Bulk note 2', 'Bulk note 3', 'Bulk note 4', 'Bulk note 5']);
			expect(ranged.map((n) => n.id).sort()).toEqual(
				(await notes('?start_date=2027-05-03&end_date=2027-05-06')).map((n) => n.id).sort(),
			);

			const sinceOnly = await ok({ resource: 'planner', operation: 'getAllNotes', params: { options: { start_date: '2027-05-13T00:00:00Z' } } });
			expect(sinceOnly.map((n) => n.title).sort()).toEqual(['Bulk note 12', 'Bulk note 13']);

			const inCourse = await ok({
				resource: 'planner',
				operation: 'getAllNotes',
				params: { options: { context_codes: `course_${main.id}` } },
			});
			expect(inCourse.length).toBeGreaterThanOrEqual(6);
			expect(inCourse.every((n) => n.course_id === Number(main.id))).toBe(true);

			// The user's own code adds the notes without a course, but only next to a course code:
			// on its own Canvas returns nothing at all.
			const mixed = await ok({
				resource: 'planner',
				operation: 'getAllNotes',
				params: { options: { context_codes: [`user_${pupil.id}`, `course_${main.id}`] } },
			});
			expect(mixed.map((n) => n.id).sort()).toEqual(
				(await notes(`?context_codes[]=user_${pupil.id}&context_codes[]=course_${main.id}`)).map((n) => n.id).sort(),
			);
			const personal = mixed.filter((n) => n.course_id === null);
			expect(personal.length).toBeGreaterThan(14);
			expect(mixed).toHaveLength(inCourse.length + personal.length);
			expect(mixed).toHaveLength((await notes()).length);

			const userCodeOnly = await run({
				resource: 'planner',
				operation: 'getAllNotes',
				params: { options: { context_codes: `user_${pupil.id}` } },
			});
			expect(userCodeOnly.ok).toBe(true);
			expect(userCodeOnly.success).toEqual([]);
			expect(await notes(`?context_codes[]=user_${pupil.id}`)).toEqual([]);

			const invalid = await run({
				resource: 'planner',
				operation: 'getAllNotes',
				params: { options: { start_date: 'yesterday' }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(invalid.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'getAllNotes' });
		});

		it('notes show up as planner items, also for a teacher', async () => {
			const items = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { start_date: '2027-03-01', end_date: '2027-03-31', context_codes: `course_${main.id}, user_${pupil.id}` }, pagination: { returnAll: true } },
			});
			expect(items.every((i) => i.plannable_type === 'planner_note')).toBe(true);
			// "Zoned 3" was a date-only value: midnight in Tokyo, which is before "Zoned 2" in UTC.
			expect(items.map((i) => (i.plannable as Json).title)).toEqual([title, 'Zoned 0', 'Zoned 1', 'Zoned 3', 'Zoned 2']);

			// The teacher's planner holds what the teacher adds: a note, and the course's calendar event.
			const [coachNote] = await runOk({
				resource: 'planner',
				operation: 'createNote',
				persona: coach.persona,
				params: { title: 'Prepare the lab', todoDate: daysFromNow(2), additionalFields: { course_id: main.id } },
			});
			const coachItems = await runOk({
				resource: 'planner',
				operation: 'getAllItems',
				persona: coach.persona,
				params: { options: { ...DATES, context_codes: `course_${main.id},course_${second.id}` }, pagination: { returnAll: true } },
			});
			expect(keys(coachItems)).toEqual(
				keys(await itemsFor(new CanvasClient(coach.persona), `${datesQuery}&context_codes[]=course_${main.id}&context_codes[]=course_${second.id}`)),
			);
			expect(keys(coachItems)).toEqual(expect.arrayContaining([`planner_note:${String(coachNote.id)}`, `calendar_event:${eventId}`]));
			expect(coachItems.some((i) => i.plannable_type === 'assignment')).toBe(false);
		});

		it('updateNote: every field reaches Canvas', async () => {
			const [updated] = await ok({
				resource: 'planner',
				operation: 'updateNote',
				params: {
					noteId,
					updateFields: {
						title: 'Renamed note مرحبا',
						details: 'New details',
						todo_date: '2027-04-01T08:00:00+02:00',
						course_id: second.id,
					},
				},
			});
			expect(updated).toMatchObject({ id: Number(noteId), title: 'Renamed note مرحبا' });
			expect(await asPupil.get<Json>(`/api/v1/planner_notes/${noteId}`)).toMatchObject({
				title: 'Renamed note مرحبا',
				details: 'New details',
				todo_date: '2027-04-01T06:00:00Z',
				course_id: Number(second.id),
			});
		});

		it('updateNote: single fields; an empty course ID detaches the note; a linked note keeps its course', async () => {
			await ok({ resource: 'planner', operation: 'updateNote', params: { noteId, updateFields: { details: 'Only details' } } });
			expect(await asPupil.get<Json>(`/api/v1/planner_notes/${noteId}`)).toMatchObject({
				title: 'Renamed note مرحبا',
				details: 'Only details',
				todo_date: '2027-04-01T06:00:00Z',
				course_id: Number(second.id),
			});

			await ok({ resource: 'planner', operation: 'updateNote', params: { noteId, updateFields: { course_id: '' } } });
			expect((await asPupil.get<Json>(`/api/v1/planner_notes/${noteId}`)).course_id).toBeNull();

			const refuse = async (id: string | number, updateFields: Json): Promise<Json> => {
				const result = await run({
					resource: 'planner',
					operation: 'updateNote',
					params: { noteId: id, updateFields, errorHandling: { onError: 'continueWithError' } },
				});
				expect(result.success).toEqual([]);
				return result.error[0];
			};
			expect(await refuse(linkedNoteId, { course_id: second.id })).toMatchObject({
				errorCode: 400,
				errorMessage: 'course_id cannot be changed for linked planner notes',
			});
			expect(await refuse(noteId, { title: '' })).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
			expect(await refuse(noteId, { todo_date: 'not a date' })).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
			expect(await refuse(999999999, { title: 'x' })).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
			expect((await asPupil.get<Json>(`/api/v1/planner_notes/${linkedNoteId}`)).course_id).toBe(Number(main.id));
			expect((await asPupil.get<Json>(`/api/v1/planner_notes/${noteId}`)).title).toBe('Renamed note مرحبا');
		});

		it('deleteNote: removes the note from the list and returns it', async () => {
			const before = (await notes()).map((n) => n.id);
			const [deleted] = await ok({ resource: 'planner', operation: 'deleteNote', params: { noteId } });
			expect(deleted).toMatchObject({ id: Number(noteId), workflow_state: 'deleted' });
			expect((await notes()).map((n) => n.id).sort()).toEqual(before.filter((id) => id !== Number(noteId)).sort());

			const foreign = await runNode({
				resource: 'planner',
				operation: 'deleteNote',
				persona: coach.persona,
				params: { noteId: linkedNoteId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(foreign.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'deleteNote' });
			expect((await notes()).map((n) => String(n.id))).toContain(linkedNoteId);
		});
	});

	// ------------------------------------------------------------ overrides

	describe('overrides', () => {
		let overrideId = '';
		const overrides = (): Promise<Json[]> => asPupil.getAll<Json>('/api/v1/planner/overrides');
		const direct = (id: string): Promise<Json> => asPupil.get<Json>(`/api/v1/planner/overrides/${id}`);

		it('getAllOverrides: a user without overrides gets no items', async () => {
			const result = await run({ resource: 'planner', operation: 'getAllOverrides' });
			expect(result.ok).toBe(true);
			expect(result.success).toEqual([]);
		});

		it('createOverride: marks an assignment complete; the planner item carries the override', async () => {
			const target = String(mainAssignments[7].id);
			const [created] = await ok({
				resource: 'planner',
				operation: 'createOverride',
				params: { plannableType: 'assignment', plannableId: Number(target), additionalFields: { marked_complete: true, dismissed: true } },
			});
			overrideId = String(created.id);
			expect(created).toMatchObject({
				plannable_type: 'assignment',
				plannable_id: Number(target),
				user_id: Number(pupil.id),
				marked_complete: true,
				dismissed: true,
				workflow_state: 'active',
			});
			expect(await direct(overrideId)).toMatchObject({ plannable_id: Number(target), marked_complete: true, dismissed: true });

			const item = (await itemsFor(asPupil)).find((i) => key(i) === `assignment:${target}`) as Json;
			expect(item.planner_override).toMatchObject({ id: Number(overrideId), marked_complete: true });
			const complete = await ok({
				resource: 'planner',
				operation: 'getAllItems',
				params: { options: { ...WIDE, filter: 'complete_items' }, pagination: { returnAll: true } },
			});
			expect(keys(complete)).toContain(`assignment:${target}`);
		});

		it('createOverride: every plannable type that exists in the course; flags default to false', async () => {
			const noteForOverride = await asPupil.post<Json>('/api/v1/planner_notes', { title: 'Override me', todo_date: daysFromNow(1) });
			const targets = [
				{ type: 'quiz', id: quizId },
				{ type: 'wiki_page', id: pageId },
				{ type: 'discussion_topic', id: discussionId },
				{ type: 'announcement', id: announcementId },
				{ type: 'calendar_event', id: eventId },
				{ type: 'planner_note', id: String(noteForOverride.id) },
			];
			const result = await run({
				resource: 'planner',
				operation: 'createOverride',
				items: targets,
				params: { plannableType: '={{ $json.type }}', plannableId: '={{ $json.id }}' },
			});
			expect(result.error).toEqual([]);
			expect(result.success.map((o) => [o.plannable_type, String(o.plannable_id), o.marked_complete, o.dismissed])).toEqual(
				targets.map((t) => [t.type, t.id, false, false]),
			);
			expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual(targets.map((_, item) => ({ item })));
			const stored = await overrides();
			for (const override of result.success) {
				expect(stored.map((o) => o.id)).toContain(override.id);
			}
		});

		it('createOverride: a second override for the same item, an unknown item and an unknown type are refused', async () => {
			const result = await run({
				resource: 'planner',
				operation: 'createOverride',
				items: [
					{ type: 'assignment', id: String(mainAssignments[7].id) },
					{ type: 'assignment', id: '999999999' },
					{ type: 'assignment', id: String(mainAssignments[8].id) },
				],
				params: {
					plannableType: '={{ $json.type }}',
					plannableId: '={{ $json.id }}',
					additionalFields: { marked_complete: false },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success.map((o) => o.plannable_id)).toEqual([Number(mainAssignments[8].id)]);
			expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 2 }]);
			expect(result.error).toHaveLength(2);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'createOverride' });
			expect(String(result.error[0].errorMessage)).toMatch(/plannable_id/);
			expect(result.error[1]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		});

		it('getOverride / getAllOverrides: single override, and the whole list across pages', async () => {
			const [override] = await ok({ resource: 'planner', operation: 'getOverride', params: { overrideId: Number(overrideId) } });
			expect(override).toEqual(await direct(overrideId));

			// More overrides than one default page holds.
			for (const assignment of mainAssignments.slice(9, 14)) {
				await asPupil.post('/api/v1/planner/overrides', { plannable_type: 'assignment', plannable_id: assignment.id, marked_complete: false });
			}
			const expected = await overrides();
			expect(expected.length).toBeGreaterThan(10);
			const ids = (items: Json[]): number[] => items.map((o) => Number(o.id)).sort((a, b) => a - b);

			const defaults = await ok({ resource: 'planner', operation: 'getAllOverrides' });
			expect(ids(defaults)).toEqual(ids(expected));

			const twoPages = await ok({ resource: 'planner', operation: 'getAllOverrides', params: { pagination: { perPage: 4, maxPages: 2 } } });
			expect(twoPages).toHaveLength(8);
			expect(new Set(twoPages.map((o) => o.id)).size).toBe(8);

			const all = await ok({ resource: 'planner', operation: 'getAllOverrides', params: { pagination: { returnAll: true, perPage: 5 } } });
			expect(ids(all)).toEqual(ids(expected));
			expect(new Set(all.map((o) => o.id)).size).toBe(all.length);

			const foreign = await runNode({
				resource: 'planner',
				operation: 'getOverride',
				persona: coach.persona,
				params: { overrideId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(foreign.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getOverride' });
			expect((await runNode({ resource: 'planner', operation: 'getAllOverrides', persona: coach.persona })).success).toEqual([]);
		});

		it('updateOverride: both flags are written on every update (a flag left out becomes false)', async () => {
			const [both] = await ok({
				resource: 'planner',
				operation: 'updateOverride',
				params: { overrideId, updateFields: { marked_complete: false, dismissed: true } },
			});
			expect(both).toMatchObject({ id: Number(overrideId), marked_complete: false, dismissed: true });
			expect(await direct(overrideId)).toMatchObject({ marked_complete: false, dismissed: true });

			// Only "Marked Complete" given: Canvas resets "Dismissed".
			await ok({ resource: 'planner', operation: 'updateOverride', params: { overrideId, updateFields: { marked_complete: true } } });
			expect(await direct(overrideId)).toMatchObject({ marked_complete: true, dismissed: false });

			// Only "Dismissed" given: Canvas resets "Marked Complete".
			await ok({ resource: 'planner', operation: 'updateOverride', params: { overrideId, updateFields: { dismissed: true } } });
			expect(await direct(overrideId)).toMatchObject({ marked_complete: false, dismissed: true });

			// Nothing given: both off.
			await ok({ resource: 'planner', operation: 'updateOverride', params: { overrideId, updateFields: {} } });
			expect(await direct(overrideId)).toMatchObject({ marked_complete: false, dismissed: false });

			const incomplete = await itemsFor(asPupil, `${wideQuery}&filter=incomplete_items`);
			expect(keys(incomplete)).toContain(`assignment:${String(mainAssignments[7].id)}`);
		});

		it('deleteOverride: removes the override; the item is plain again', async () => {
			const [deleted] = await ok({ resource: 'planner', operation: 'deleteOverride', params: { overrideId } });
			expect(deleted).toMatchObject({ id: Number(overrideId), workflow_state: 'deleted' });
			expect((await overrides()).map((o) => String(o.id))).not.toContain(overrideId);
			const item = (await itemsFor(asPupil)).find((i) => key(i) === `assignment:${String(mainAssignments[7].id)}`) as Json;
			expect(item.planner_override).toBeNull();
		});

		it('deleteOverride / updateOverride: several items, with ones that are gone or belong to someone else', async () => {
			const [first, second] = (await overrides()).map((o) => String(o.id));
			const result = await run({
				resource: 'planner',
				operation: 'deleteOverride',
				items: [{ id: first }, { id: 999999999 }, { id: second }],
				params: { overrideId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success.map((o) => String(o.id))).toEqual([first, second]);
			expect(result.error).toHaveLength(1);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'deleteOverride', originalItem: { id: 999999999 } });

			const [third] = (await overrides()).map((o) => String(o.id));
			const foreign = await runNode({
				resource: 'planner',
				operation: 'updateOverride',
				persona: coach.persona,
				params: { overrideId: third, updateFields: { marked_complete: true }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(foreign.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'updateOverride' });
			expect((await direct(third)).marked_complete).toBe(false);
		});
	});
});
