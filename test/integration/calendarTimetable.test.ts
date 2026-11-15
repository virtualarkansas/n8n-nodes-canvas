import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { sandboxSubAccount, waitFor } from './support/commsSandbox';
import { createSandboxCourse, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: calendarEvent, the course timetable operations (Get Course Timetable,
 * Set Course Timetable, Set Course Timetable Events).
 *
 * Courses of this file's own: one that runs from Monday 1 March to Monday
 * 29 March 2027 in New York time (daylight saving time starts on 14 March, so the
 * same class time is a different UTC time in the second half), with a section
 * that has dates of its own; and one without any dates.
 */
describe('calendarEvent: course timetable', () => {
	let course: SandboxCourse;
	let courseId = '';
	let courseName = '';
	let sectionId = '';
	let undated: SandboxCourse;
	const eh = { errorHandling: { onError: 'continueWithError' } };

	/** Active events of the course and of its section, as the admin sees them. */
	const events = async (): Promise<Json[]> =>
		(
			await canvas().getAll<Json>(
				`/api/v1/calendar_events?all_events=true&context_codes[]=course_${courseId}&context_codes[]=course_section_${sectionId}`,
			)
		).sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
	const ofCourse = (list: Json[]): Json[] => list.filter((event) => event.context_code === `course_${courseId}`);
	const ofSection = (list: Json[]): Json[] => list.filter((event) => event.context_code === `course_section_${sectionId}`);
	/** Canvas creates and deletes the events in a background job: wait until the calendar looks as expected. */
	const eventually = (probe: (list: Json[]) => boolean, label: string): Promise<Json[]> =>
		waitFor(
			async () => {
				const list = await events();
				return probe(list) ? list : false;
			},
			300_000,
			label,
		);
	const times = (list: Json[]): Array<[string, string]> => list.map((event) => [String(event.start_at), String(event.end_at)]);

	beforeAll(async () => {
		const accountId = await sandboxSubAccount();
		course = await createSandboxCourse('timetable', {
			accountId,
			personas: ['teacher'],
			course: {
				time_zone: 'America/New_York',
				start_at: '2027-03-01T05:00:00Z',
				end_at: '2027-03-29T04:00:00Z',
				restrict_enrollments_to_course_dates: true,
			},
		});
		courseId = course.id;
		const created = await canvas().get<Json>(`/api/v1/courses/${courseId}`);
		expect(created).toMatchObject({ start_at: '2027-03-01T05:00:00Z', end_at: '2027-03-29T04:00:00Z', time_zone: 'America/New_York' });
		courseName = String(created.name);
		const section = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, {
			course_section: { name: 'Lab section B', start_at: '2027-03-08T05:00:00Z', end_at: '2027-03-22T04:00:00Z' },
		});
		sectionId = String(section.id);

		// No course dates, and the default term has none either.
		undated = await createSandboxCourse('timetable-undated', { accountId, personas: ['teacher'] });
	}, 900_000);

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxCourse(undated);
	}, 300_000);

	it('getTimetable: a course without a timetable returns an empty record', async () => {
		const result = await runOk({ resource: 'calendarEvent', operation: 'getTimetable', params: { courseId } });
		expect(result).toEqual([{}]);
	});

	it('setTimetable: weekly meetings for the course and for a section become calendar events', async () => {
		const result = await runOk({
			resource: 'calendarEvent',
			operation: 'setTimetable',
			persona: 'teacher',
			params: {
				courseId,
				timetables: {
					timetable: [
						{ course_section_id: 'all', weekdays: ['Mon', 'Wed'], start_time: '9:00 am', end_time: '9:50 am', location_name: 'Room 237 — "Ünï" & Co' },
						// 24-hour times, no location.
						{ course_section_id: 'all', weekdays: ['Fri'], start_time: '13:00', end_time: '14:30' },
						{ course_section_id: ` ${sectionId} `, weekdays: ['Tue'], start_time: '10:15 am', end_time: '11:05 am', location_name: 'Lab B' },
					],
				},
			},
		});
		expect(result).toEqual([{ status: 'ok' }]);

		// Course: 4 Mondays, 4 Wednesdays and 4 Fridays in March; section (8 to 22 March): 2 Tuesdays.
		const list = await eventually((all) => ofCourse(all).length === 12 && ofSection(all).length === 2, 'the timetable events');
		expect(list).toHaveLength(14);

		const mondaysAndWednesdays = ofCourse(list).filter((event) => event.location_name === 'Room 237 — "Ünï" & Co');
		// 9:00 in New York is 14:00 UTC until 13 March and 13:00 UTC from 14 March on.
		expect(times(mondaysAndWednesdays)).toEqual([
			['2027-03-01T14:00:00Z', '2027-03-01T14:50:00Z'],
			['2027-03-03T14:00:00Z', '2027-03-03T14:50:00Z'],
			['2027-03-08T14:00:00Z', '2027-03-08T14:50:00Z'],
			['2027-03-10T14:00:00Z', '2027-03-10T14:50:00Z'],
			['2027-03-15T13:00:00Z', '2027-03-15T13:50:00Z'],
			['2027-03-17T13:00:00Z', '2027-03-17T13:50:00Z'],
			['2027-03-22T13:00:00Z', '2027-03-22T13:50:00Z'],
			['2027-03-24T13:00:00Z', '2027-03-24T13:50:00Z'],
		]);
		const fridays = ofCourse(list).filter((event) => event.location_name !== 'Room 237 — "Ünï" & Co');
		expect(times(fridays)).toEqual([
			['2027-03-05T18:00:00Z', '2027-03-05T19:30:00Z'],
			['2027-03-12T18:00:00Z', '2027-03-12T19:30:00Z'],
			['2027-03-19T17:00:00Z', '2027-03-19T18:30:00Z'],
			['2027-03-26T17:00:00Z', '2027-03-26T18:30:00Z'],
		]);
		expect(fridays.every((event) => event.location_name === null)).toBe(true);
		expect(ofCourse(list).every((event) => event.title === courseName && event.all_day === false && event.workflow_state === 'active')).toBe(true);

		// The section meets within its own dates only.
		expect(times(ofSection(list))).toEqual([
			['2027-03-09T15:15:00Z', '2027-03-09T16:05:00Z'],
			['2027-03-16T14:15:00Z', '2027-03-16T15:05:00Z'],
		]);
		expect(ofSection(list).every((event) => event.location_name === 'Lab B')).toBe(true);
	});

	it('getTimetable: returns what was set, per section, with the dates Canvas used', async () => {
		const expected = await canvas().get<Json>(`/api/v1/courses/${courseId}/calendar_events/timetable`);
		const [timetable] = await runOk({
			resource: 'calendarEvent',
			operation: 'getTimetable',
			persona: 'teacher',
			params: { courseId: `sis_course_id:${course.sisId}` },
		});
		expect(timetable).toEqual(expected);
		expect(Object.keys(timetable).sort()).toEqual([sectionId, 'all'].sort());
		expect(timetable.all).toEqual([
			{
				weekdays: 'Mon,Wed',
				start_time: '9:00 am',
				end_time: '9:50 am',
				location_name: 'Room 237 — "Ünï" & Co',
				course_start_at: '2027-03-01T05:00:00Z',
				course_end_at: '2027-03-29T04:00:00Z',
			},
			{ weekdays: 'Fri', start_time: '13:00', end_time: '14:30', course_start_at: '2027-03-01T05:00:00Z', course_end_at: '2027-03-29T04:00:00Z' },
		]);
		expect(timetable[sectionId]).toEqual([
			{
				weekdays: 'Tue',
				start_time: '10:15 am',
				end_time: '11:05 am',
				location_name: 'Lab B',
				course_start_at: '2027-03-08T05:00:00Z',
				course_end_at: '2027-03-22T04:00:00Z',
			},
		]);
	});

	it('setTimetable: a new timetable replaces the old one, also for sections that are no longer listed', async () => {
		const before = await events();
		const keptLocation = 'Room 237 — "Ünï" & Co';
		const keptIds = ofCourse(before)
			.filter((event) => event.location_name === keptLocation && new Date(String(event.start_at)).getUTCDay() === 1)
			.map((event) => event.id);
		expect(keptIds).toHaveLength(4);

		// Mondays stay as they were, Wednesdays and Fridays go, Thursdays are new; the section is not mentioned.
		const result = await runOk({
			resource: 'calendarEvent',
			operation: 'setTimetable',
			items: [{ days: ['Thu'], from: '8:00 am' }],
			params: {
				courseId: Number(courseId),
				timetables: {
					timetable: [
						{ course_section_id: 'all', weekdays: ['Mon'], start_time: '9:00 am', end_time: '9:50 am', location_name: keptLocation },
						{ course_section_id: '', weekdays: '={{ $json.days }}', start_time: '={{ $json.from }}', end_time: '8:45 am' },
					],
				},
			},
		});
		expect(result).toEqual([{ status: 'ok' }]);

		const list = await eventually((all) => all.length === 8 && ofSection(all).length === 0, 'the replaced timetable events');
		const mondays = ofCourse(list).filter((event) => event.location_name === keptLocation);
		// The same events as before, not new ones.
		expect(mondays.map((event) => event.id).sort()).toEqual([...keptIds].sort());
		const thursdays = ofCourse(list).filter((event) => event.location_name !== keptLocation);
		expect(times(thursdays)).toEqual([
			['2027-03-04T13:00:00Z', '2027-03-04T13:45:00Z'],
			['2027-03-11T13:00:00Z', '2027-03-11T13:45:00Z'],
			['2027-03-18T12:00:00Z', '2027-03-18T12:45:00Z'],
			['2027-03-25T12:00:00Z', '2027-03-25T12:45:00Z'],
		]);
		expect(Object.keys(await canvas().get<Json>(`/api/v1/courses/${courseId}/calendar_events/timetable`))).toEqual(['all']);
	});

	it('setTimetableEvents: a complete list of meetings for a section; codes make later calls update instead of duplicate', async () => {
		const courseEventsBefore = ofCourse(await events())
			.map((event) => event.id)
			.sort();
		const [first] = await runOk({
			resource: 'calendarEvent',
			operation: 'setTimetableEvents',
			persona: 'teacher',
			params: {
				courseId,
				courseSectionId: sectionId,
				events: {
					event: [
						{ start_at: '2027-03-09T15:00:00Z', end_at: '2027-03-09T16:30:00Z', code: 'lab-1', location_name: 'Lab "B" — ünï', title: 'Lab 1: microscopes 🔬' },
						{ start_at: '2027-03-16T15:00:00Z', end_at: '2027-03-16T16:30:00Z', code: 'lab-2', title: 'Lab 2' },
						// Neither code nor title: Canvas makes up a code and uses the name of the course.
						{ start_at: '2027-03-18T15:00:00Z', end_at: '2027-03-18T16:00:00Z' },
					],
				},
			},
		});
		expect(first).toEqual({ status: 'ok' });

		let list = await eventually((all) => ofSection(all).length === 3, 'the timetable events of the section');
		const [lab1, lab2, untitled] = ofSection(list);
		expect(lab1).toMatchObject({ start_at: '2027-03-09T15:00:00Z', end_at: '2027-03-09T16:30:00Z', location_name: 'Lab "B" — ünï' });
		expect(String(lab1.title)).toContain('Lab 1: microscopes 🔬');
		expect(lab2).toMatchObject({ start_at: '2027-03-16T15:00:00Z', location_name: null });
		expect(String(lab2.title)).toContain('Lab 2');
		expect(untitled).toMatchObject({ start_at: '2027-03-18T15:00:00Z', end_at: '2027-03-18T16:00:00Z' });
		expect(String(untitled.title)).toContain(courseName);
		// The timetable of the whole course is not touched by a call for one section.
		expect(ofCourse(list).map((event) => event.id).sort()).toEqual(courseEventsBefore);

		// Second call: lab-1 moves, lab-2 is left out, lab-3 is new. Dates from an expression.
		await runOk({
			resource: 'calendarEvent',
			operation: 'setTimetableEvents',
			items: [{ section: Number(sectionId), start: '2027-03-10T15:00:00Z', end: '2027-03-10T16:30:00Z' }],
			params: {
				courseId,
				courseSectionId: '={{ $json.section }}',
				events: {
					event: [
						{ start_at: '={{ $json.start }}', end_at: '={{ $json.end }}', code: 'lab-1', location_name: 'Lab C', title: 'Lab 1 (moved)' },
						{ start_at: '2027-03-17T15:00:00Z', end_at: '2027-03-17T16:30:00Z', code: 'lab-3', title: 'Lab 3' },
					],
				},
			},
		});
		list = await eventually(
			(all) => ofSection(all).length === 2 && ofSection(all).some((event) => String(event.title).includes('Lab 1 (moved)')),
			'the updated timetable events of the section',
		);
		const [moved, lab3] = ofSection(list);
		// The same calendar event, with its new time and place.
		expect(moved).toMatchObject({ id: lab1.id, start_at: '2027-03-10T15:00:00Z', end_at: '2027-03-10T16:30:00Z', location_name: 'Lab C' });
		expect(lab3).toMatchObject({ start_at: '2027-03-17T15:00:00Z' });
		expect(String(lab3.title)).toContain('Lab 3');
		expect(ofSection(list).map((event) => event.id)).not.toContain(lab2.id);
		expect(ofCourse(list).map((event) => event.id).sort()).toEqual(courseEventsBefore);
	});

	it('setTimetableEvents: without a section the list is the timetable of the whole course', async () => {
		const sectionBefore = ofSection(await events())
			.map((event) => event.id)
			.sort();
		await runOk({
			resource: 'calendarEvent',
			operation: 'setTimetableEvents',
			params: {
				courseId,
				events: { event: [{ start_at: '2027-03-02T14:00:00Z', end_at: '2027-03-02T15:00:00Z', code: 'kick-off', title: 'Kick-off' }] },
			},
		});
		// The eight events of the weekly timetable are not in the list, so they go.
		const list = await eventually((all) => ofCourse(all).length === 1, 'the single course event');
		expect(ofCourse(list)[0]).toMatchObject({ title: 'Kick-off', start_at: '2027-03-02T14:00:00Z', end_at: '2027-03-02T15:00:00Z' });
		expect(ofSection(list).map((event) => event.id).sort()).toEqual(sectionBefore);
	});

	it('errors: no dates to build a timetable from, invalid entries, missing rights', async () => {
		const set = (params: Json, persona = 'admin'): ReturnType<typeof runNode> =>
			runNode({ resource: 'calendarEvent', operation: 'setTimetable', persona, params: { courseId, ...params, ...eh } });
		const entry = { course_section_id: 'all', weekdays: ['Mon'], start_time: '9:00 am', end_time: '10:00 am' };
		const before = (await events()).map((event) => event.id).sort();

		// Neither the course nor its term has dates.
		const noDates = await set({ courseId: undated.id, timetables: { timetable: [entry] } }, 'teacher');
		expect(noDates.success).toEqual([]);
		expect(noDates.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'calendarEvent', operation: 'setTimetable' });
		expect(String(noDates.error[0].errorMessage)).toContain('no start date found');
		expect(String(noDates.error[0].errorMessage)).toContain('no end date found');
		expect(await canvas().get<Json>(`/api/v1/courses/${undated.id}/calendar_events/timetable`)).toEqual({});

		const badTime = await set({ timetables: { timetable: [{ ...entry, start_time: '25:99 o\'clock' }] } });
		expect(badTime.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(badTime.error[0].errorMessage)).toContain('invalid start time');

		// Refused by the node before anything is sent.
		const noEntries = await set({ timetables: {} });
		expect(noEntries.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(noEntries.error[0].errorMessage)).toContain('at least one timetable entry');
		const noWeekdays = await set({ timetables: { timetable: [{ ...entry, weekdays: [] }] } });
		expect(noWeekdays.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(noWeekdays.error[0].errorMessage)).toContain('Weekdays');

		const noSuchSection = await set({ timetables: { timetable: [{ ...entry, course_section_id: '99999999' }] } });
		expect(noSuchSection.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// The student persona is not in the course.
		for (const operation of ['getTimetable', 'setTimetable', 'setTimetableEvents']) {
			const forbidden = await runNode({
				resource: 'calendarEvent',
				operation,
				persona: 'student',
				params: {
					courseId,
					timetables: { timetable: [entry] },
					events: { event: [{ start_at: '2027-03-02T14:00:00Z', end_at: '2027-03-02T15:00:00Z' }] },
					...eh,
				},
			});
			expect(forbidden.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(forbidden.error[0].errorCode);
		}

		const setEvents = (params: Json): ReturnType<typeof runNode> =>
			runNode({ resource: 'calendarEvent', operation: 'setTimetableEvents', params: { courseId, ...params, ...eh } });
		// Two events with the same code.
		const duplicateCodes = await setEvents({
			events: {
				event: [
					{ start_at: '2027-03-02T14:00:00Z', end_at: '2027-03-02T15:00:00Z', code: 'same' },
					{ start_at: '2027-03-03T14:00:00Z', end_at: '2027-03-03T15:00:00Z', code: 'same' },
				],
			},
		});
		expect(duplicateCodes.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(duplicateCodes.error[0].errorMessage)).toContain('not unique');
		const noEnd = await setEvents({ events: { event: [{ start_at: '2027-03-02T14:00:00Z', end_at: '' }] } });
		expect(noEnd.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(noEnd.error[0].errorMessage)).toContain('Start At and an End At');
		const noEvents = await setEvents({ events: {} });
		expect(noEvents.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		const unknownCourse = await setEvents({
			courseId: '99999999',
			events: { event: [{ start_at: '2027-03-02T14:00:00Z', end_at: '2027-03-02T15:00:00Z' }] },
		});
		expect(unknownCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// None of the refused calls changed the calendar.
		expect((await events()).map((event) => event.id).sort()).toEqual(before);
	});
});
