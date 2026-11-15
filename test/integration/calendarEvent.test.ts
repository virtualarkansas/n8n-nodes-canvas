import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox } from './support/commsSandbox';
import { clientFor, commsSandbox, sandboxSections, sandboxSubAccount } from './support/commsSandbox';

/**
 * Resource: calendarEvent. Everything happens on the calendars of the private
 * sandbox course, its teacher and a battery-owned sub-account.
 */
describe('calendarEvent', () => {
	let sbx: Sandbox;
	let teacher: CanvasClient;
	let courseCode = '';
	let sectionCodes: string[] = [];
	const asTeacher = 'sbxTeacher';

	let eventId = '';
	let seriesIds: string[] = [];
	let bulkIds: string[] = [];
	const bulkTitle = unique('Daily stand-up');

	const read = (id: string | number): Promise<Json> => teacher.get<Json>(`/api/v1/calendar_events/${id}`);
	const duplicatesOf = (event: Json): Json[] => ((event.duplicates as Json[]) ?? []).map((d) => d.calendar_event as Json);

	beforeAll(async () => {
		sbx = await commsSandbox();
		teacher = clientFor(sbx.teacher);
		courseCode = `course_${sbx.courseId}`;
		sectionCodes = (await sandboxSections(sbx)).map((id) => `course_section_${id}`);
	}, 900_000);

	// ---------------------------------------------------------------- create

	it('create: every optional field of a single event reaches Canvas', async () => {
		const title = unique('Lab safety briefing "quoted" & <b>tags</b> ünï 実験');
		const [created] = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: ` ${courseCode} `,
				title,
				additionalFields: {
					all_day: false,
					blackout_date: true,
					description: '<p>Bring <strong>goggles</strong> 🥽 &amp; a lab coat</p>',
					end_at: '2027-06-07T16:30:00Z',
					important_dates: true,
					location_address: '1 Main St, "Suite" 4 & Co',
					location_name: 'Lab 2 — Ünïcode',
					start_at: '2027-06-07T15:00:00Z',
					time_zone_edited: 'America/Chicago',
				},
			},
		});
		eventId = String(created.id);
		expect(created.duplicates).toEqual([]);

		const actual = await read(eventId);
		expect(actual).toMatchObject({
			title,
			context_code: courseCode,
			start_at: '2027-06-07T15:00:00Z',
			end_at: '2027-06-07T16:30:00Z',
			all_day: false,
			blackout_date: true,
			important_dates: true,
			location_address: '1 Main St, "Suite" 4 & Co',
			location_name: 'Lab 2 — Ünïcode',
			workflow_state: 'active',
		});
		expect(String(actual.description)).toContain('<strong>goggles</strong> 🥽');
	});

	it('create: an all-day event falls on the day of the given time zone', async () => {
		// 20:00 UTC on 8 June is already 9 June in Tokyo.
		const [created] = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: courseCode,
				title: unique('Field trip'),
				additionalFields: { all_day: true, start_at: '2027-06-08T20:00:00Z', time_zone_edited: 'Asia/Tokyo' },
			},
		});
		expect(await read(String(created.id))).toMatchObject({ all_day: true, all_day_date: '2027-06-09' });
		await teacher.delete(`/api/v1/calendar_events/${String(created.id)}`);
	});

	it('create: section times become child events of the course event', async () => {
		const [created] = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: courseCode,
				title: unique('Midterm (per section)'),
				additionalFields: {
					start_at: '2027-06-14T14:00:00Z',
					end_at: '2027-06-14T18:00:00Z',
					child_event_data: {
						times: [
							{ context_code: sectionCodes[0], start_at: '2027-06-14T14:00:00Z', end_at: '2027-06-14T15:00:00Z' },
							{ context_code: ` ${sectionCodes[1]} `, start_at: '2027-06-14T17:00:00Z', end_at: '2027-06-14T18:00:00Z' },
							// A row added in the UI but left empty is ignored.
							{ context_code: '', start_at: '', end_at: '' },
						],
					},
				},
			},
		});
		const actual = await read(String(created.id));
		const children = (actual.child_events as Json[]).map((c) => [c.context_code, c.start_at, c.end_at]);
		expect(children.sort()).toEqual(
			[
				[sectionCodes[0], '2027-06-14T14:00:00Z', '2027-06-14T15:00:00Z'],
				[sectionCodes[1], '2027-06-14T17:00:00Z', '2027-06-14T18:00:00Z'],
			].sort(),
		);
		expect(actual.child_events_count).toBe(2);

		// update: the list replaces the section times ...
		await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: {
				eventId: String(created.id),
				updateFields: {
					child_event_data: {
						times: [{ context_code: sectionCodes[1], start_at: '2027-06-14T16:00:00Z', end_at: '2027-06-14T17:00:00Z' }],
					},
				},
			},
		});
		const replaced = (await read(String(created.id))).child_events as Json[];
		expect(replaced.map((c) => [c.context_code, c.start_at])).toEqual([[sectionCodes[1], '2027-06-14T16:00:00Z']]);

		// ... and "Remove Section Times" removes them all.
		await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId: String(created.id), updateFields: { remove_child_events: true } },
		});
		expect((await read(String(created.id))).child_events).toEqual([]);
		await teacher.delete(`/api/v1/calendar_events/${String(created.id)}`);
	});

	it('create: Duplicate Count / Interval / Frequency / Append Iterator make independent copies', async () => {
		const title = unique('Office hours');
		const [created] = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: courseCode,
				title,
				additionalFields: {
					start_at: '2027-07-05T15:00:00Z',
					end_at: '2027-07-05T16:00:00Z',
					duplicate_count: 3,
					duplicate_interval: 2,
					duplicate_frequency: 'daily',
					duplicate_append_iterator: true,
				},
			},
		});
		const copies = duplicatesOf(created);
		expect(copies).toHaveLength(3);
		const all = [created, ...copies];
		expect(all.map((e) => e.title)).toEqual([1, 2, 3, 4].map((n) => `${title} ${n}`));
		for (const [index, event] of all.entries()) {
			const actual = await read(String(event.id));
			expect(actual.title).toBe(`${title} ${index + 1}`);
			expect(actual.start_at).toBe(`2027-07-${String(5 + 2 * index).padStart(2, '0')}T15:00:00Z`);
			expect(actual.series_uuid).toBeNull();
		}
		for (const event of all) await teacher.delete(`/api/v1/calendar_events/${String(event.id)}`);

		// Weekly (the default frequency) and monthly, without numbering.
		for (const [frequency, expectedStart] of [
			['weekly', '2027-07-12T15:00:00Z'],
			['monthly', '2027-08-05T15:00:00Z'],
		]) {
			const [again] = await runOk({
				resource: 'calendarEvent',
				operation: 'create',
				persona: asTeacher,
				params: {
					contextCode: courseCode,
					title,
					additionalFields: { start_at: '2027-07-05T15:00:00Z', duplicate_count: 1, duplicate_frequency: frequency },
				},
			});
			const [copy] = duplicatesOf(again);
			expect(await read(String(copy.id)), frequency).toMatchObject({ title, start_at: expectedStart });
			for (const event of [again, copy]) await teacher.delete(`/api/v1/calendar_events/${String(event.id)}`);
		}
	});

	it('create: an RRule makes a series', async () => {
		const title = unique('Weekly seminar');
		const [created] = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: courseCode,
				title,
				additionalFields: {
					start_at: '2027-09-06T15:00:00Z',
					end_at: '2027-09-06T16:00:00Z',
					rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=5',
					time_zone_edited: 'UTC',
				},
			},
		});
		expect(created).toMatchObject({ rrule: 'FREQ=WEEKLY;INTERVAL=1;COUNT=5', series_head: true });
		expect(created.series_uuid).toBeTypeOf('string');
		const rest = duplicatesOf(created);
		expect(rest).toHaveLength(4);
		seriesIds = [created, ...rest].map((e) => String(e.id));
		for (const [index, id] of seriesIds.entries()) {
			expect(await read(id)).toMatchObject({
				title,
				series_uuid: created.series_uuid,
				start_at: new Date(Date.UTC(2027, 8, 6 + 7 * index, 15)).toISOString().replace('.000Z', 'Z'),
			});
		}
	});

	it('create: personal, group and account calendars', async () => {
		const personal = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: { contextCode: `user_${sbx.teacher.id}`, title: unique('Dentist') },
		});
		expect(await read(String(personal[0].id))).toMatchObject({ context_code: `user_${sbx.teacher.id}`, start_at: null });
		await teacher.delete(`/api/v1/calendar_events/${String(personal[0].id)}`);

		const category = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, {
			name: unique('Calendar teams'),
		});
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: 'Calendar team' });
		const inGroup = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: { contextCode: `group_${String(group.id)}`, title: unique('Team meeting') },
		});
		expect(await read(String(inGroup[0].id))).toMatchObject({ context_code: `group_${String(group.id)}` });
		await canvas().delete(`/api/v1/group_categories/${String(category.id)}`);

		const subAccount = await sandboxSubAccount();
		const inAccount = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			params: {
				contextCode: `account_${subAccount}`,
				title: unique('District holiday'),
				additionalFields: { start_at: '2027-12-24T00:00:00Z', all_day: true },
			},
		});
		expect(await canvas().get<Json>(`/api/v1/calendar_events/${String(inAccount[0].id)}`)).toMatchObject({
			context_code: `account_${subAccount}`,
			all_day: true,
		});
		await canvas().delete(`/api/v1/calendar_events/${String(inAccount[0].id)}`);
	});

	// ---------------------------------------------------------------- get

	it('get: a calendar event, and an assignment by its "assignment_<id>" code', async () => {
		const [event] = await runOk({ resource: 'calendarEvent', operation: 'get', persona: asTeacher, params: { eventId } });
		expect(event).toMatchObject({ id: Number(eventId), context_code: courseCode, type: 'event' });
		expect(event.child_events).toEqual([]);

		const assignment = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/assignments`, {
			assignment: { name: unique('Essay'), due_at: '2027-10-01T22:00:00Z', published: true, submission_types: ['online_text_entry'] },
		});
		const [asEvent] = await runOk({
			resource: 'calendarEvent',
			operation: 'get',
			persona: asTeacher,
			params: { eventId: `assignment_${String(assignment.id)}` },
		});
		expect(asEvent).toMatchObject({ id: `assignment_${String(assignment.id)}`, type: 'assignment', start_at: '2027-10-01T22:00:00Z' });
		expect((asEvent.assignment as Json).id).toBe(assignment.id);

		// update: for an assignment "Start At" moves the due date.
		await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId: `assignment_${String(assignment.id)}`, updateFields: { start_at: '2027-10-08T22:00:00Z' } },
		});
		expect((await canvas().get<Json>(`/api/v1/courses/${sbx.courseId}/assignments/${String(assignment.id)}`)).due_at).toBe(
			'2027-10-08T22:00:00Z',
		);
		await canvas().delete(`/api/v1/courses/${sbx.courseId}/assignments/${String(assignment.id)}`);
	});

	// ---------------------------------------------------------------- update

	it('update: every optional field of a single event', async () => {
		const title = unique('Lab safety briefing (moved)');
		const [updated] = await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: {
				eventId,
				updateFields: {
					all_day: false,
					blackout_date: false,
					description: '<p>Now in <em>room 7</em></p>',
					end_at: '2027-06-09T11:00:00Z',
					important_dates: false,
					location_address: '7 Side Rd',
					location_name: 'Room 7',
					start_at: '2027-06-09T10:00:00Z',
					time_zone_edited: 'Europe/Berlin',
					title,
					which: 'one',
				},
			},
		});
		expect(updated).toMatchObject({ id: Number(eventId), title });
		const actual = await read(eventId);
		expect(actual).toMatchObject({
			title,
			start_at: '2027-06-09T10:00:00Z',
			end_at: '2027-06-09T11:00:00Z',
			blackout_date: false,
			important_dates: false,
			location_address: '7 Side Rd',
			location_name: 'Room 7',
			context_code: courseCode,
		});
		expect(String(actual.description)).toContain('<em>room 7</em>');
	});

	it('update: Context Code moves the event to another calendar', async () => {
		const [moved] = await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId, updateFields: { context_code: `user_${sbx.teacher.id}` } },
		});
		expect(moved.context_code).toBe(`user_${sbx.teacher.id}`);
		expect((await read(eventId)).context_code).toBe(`user_${sbx.teacher.id}`);
		await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId, updateFields: { context_code: courseCode } },
		});
		expect((await read(eventId)).context_code).toBe(courseCode);
	});

	it('update: "Which" decides how much of a series changes', async () => {
		const titles = async (): Promise<unknown[]> => Promise.all(seriesIds.map(async (id) => (await read(id)).title));
		const original = (await read(seriesIds[0])).title;

		// One: only the third event.
		const one = await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId: seriesIds[2], updateFields: { title: 'Seminar (guest speaker)', which: 'one' } },
		});
		expect(one).toHaveLength(1);
		expect(await titles()).toEqual([original, original, 'Seminar (guest speaker)', original, original]);

		// Following: the fourth and fifth.
		const following = await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId: seriesIds[3], updateFields: { title: 'Seminar (online)', which: 'following' } },
		});
		expect(following.map((e) => String(e.id))).toEqual(seriesIds.slice(3));
		expect(await titles()).toEqual([original, original, 'Seminar (guest speaker)', 'Seminar (online)', 'Seminar (online)']);

		// All: every event, one output item each.
		const all = await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId: seriesIds[1], updateFields: { location_name: 'Auditorium', which: 'all' } },
		});
		expect(all.map((e) => String(e.id)).sort()).toEqual([...seriesIds].sort());
		for (const id of seriesIds) expect((await read(id)).location_name).toBe('Auditorium');
	});

	it('update: an RRule turns a single event into a series', async () => {
		const [single] = await teacher
			.post<Json>('/api/v1/calendar_events', {
				calendar_event: { context_code: courseCode, title: unique('Study group'), start_at: '2027-11-02T18:00:00Z', end_at: '2027-11-02T19:00:00Z' },
			})
			.then((e) => [e]);
		const result = await runOk({
			resource: 'calendarEvent',
			operation: 'update',
			persona: asTeacher,
			params: { eventId: String(single.id), updateFields: { rrule: 'FREQ=DAILY;INTERVAL=1;COUNT=3' } },
		});
		expect(result).toHaveLength(3);
		const head = await read(String(single.id));
		expect(head).toMatchObject({ rrule: 'FREQ=DAILY;INTERVAL=1;COUNT=3', series_head: true });
		expect(new Set(result.map((e) => e.series_uuid))).toEqual(new Set([head.series_uuid]));

		// delete: "All" removes the whole series, one output item per event.
		const deleted = await runOk({
			resource: 'calendarEvent',
			operation: 'delete',
			persona: asTeacher,
			params: { eventId: String(result[1].id), options: { which: 'all', cancel_reason: 'Room unavailable' } },
		});
		expect(deleted.map((e) => e.id).sort()).toEqual(result.map((e) => e.id).sort());
		for (const event of result) expect((await read(String(event.id))).workflow_state).toBe('deleted');
	});

	// ---------------------------------------------------------------- getAll

	it('create: 60 copies in one request (the events for the paging tests)', async () => {
		const [created] = await runOk({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: courseCode,
				title: bulkTitle,
				additionalFields: {
					start_at: '2029-01-08T09:00:00Z',
					end_at: '2029-01-08T09:15:00Z',
					description: '<p>Fifteen minutes, standing</p>',
					duplicate_count: 60,
					duplicate_frequency: 'daily',
				},
			},
		});
		bulkIds = [created, ...duplicatesOf(created)].map((e) => String(e.id));
		expect(bulkIds).toHaveLength(61);
	});

	it('getAll: paging through a date range with more events than a page', async () => {
		const range = 'start_date=2029-01-01&end_date=2029-04-30';
		const expected = await teacher.getAll<Json>(`/api/v1/calendar_events?context_codes[]=${courseCode}&${range}`);
		expect(expected.length).toBeGreaterThanOrEqual(61);
		const options = { context_codes: courseCode, start_date: '2029-01-01', end_date: '2029-04-30T23:59:59Z' };

		const all = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options, pagination: { returnAll: true } },
		});
		expect(all.map((e) => e.id).sort()).toEqual(expected.map((e) => e.id).sort());
		expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
		for (const id of bulkIds) expect(all.map((e) => String(e.id))).toContain(id);

		const byDefault = await runOk({ resource: 'calendarEvent', operation: 'getAll', persona: asTeacher, params: { options } });
		expect(byDefault).toHaveLength(50);
		expect(new Set(byDefault.map((e) => e.id)).size).toBe(50);

		const threePages = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options, pagination: { perPage: 7, maxPages: 3 } },
		});
		expect(threePages.map((e) => e.id)).toEqual(expected.slice(0, 21).map((e) => e.id));

		const smallPages = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options, pagination: { perPage: 20, maxPages: 0 } },
		});
		expect(smallPages.map((e) => e.id)).toEqual(expected.map((e) => e.id));
	});

	it('getAll: date range, All Events and Undated', async () => {
		const undated = await teacher.post<Json>('/api/v1/calendar_events', {
			calendar_event: { context_code: courseCode, title: unique('Sometime this term') },
		});

		const week = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: {
				options: { context_codes: courseCode, start_date: '2029-01-08T00:00:00Z', end_date: '2029-01-14T23:59:59Z' },
				pagination: { returnAll: true },
			},
		});
		expect(week.filter((e) => bulkIds.includes(String(e.id)))).toHaveLength(7);
		for (const event of week) {
			expect(String(event.start_at) >= '2029-01-08' && String(event.start_at) < '2029-01-15').toBe(true);
		}

		const everything = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { context_codes: courseCode, all_events: true }, pagination: { returnAll: true } },
		});
		const expectedAll = await teacher.getAll<Json>(`/api/v1/calendar_events?context_codes[]=${courseCode}&all_events=true`);
		expect(everything.map((e) => e.id).sort()).toEqual(expectedAll.map((e) => e.id).sort());
		expect(everything.map((e) => e.id)).toContain(undated.id);
		expect(everything.map((e) => String(e.id))).toContain(eventId);

		const onlyUndated = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { context_codes: courseCode, undated: true }, pagination: { returnAll: true } },
		});
		expect(onlyUndated.map((e) => e.id)).toContain(undated.id);
		expect(onlyUndated.every((e) => e.start_at === null)).toBe(true);

		// Without dates Canvas only looks at today: none of the future events.
		const today = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { context_codes: courseCode }, pagination: { returnAll: true } },
		});
		expect(today.filter((e) => bulkIds.includes(String(e.id)))).toEqual([]);
		await teacher.delete(`/api/v1/calendar_events/${String(undated.id)}`);
	});

	it('getAll: several calendars, and the personal calendar by default', async () => {
		const personal = await teacher.post<Json>('/api/v1/calendar_events', {
			calendar_event: { context_code: `user_${sbx.teacher.id}`, title: unique('Private note'), start_at: '2029-01-10T12:00:00Z' },
		});
		const range = { start_date: '2029-01-10', end_date: '2029-01-10' };

		const mine = await runOk({ resource: 'calendarEvent', operation: 'getAll', persona: asTeacher, params: { options: range } });
		expect(mine.map((e) => e.id)).toEqual([personal.id]);

		const both = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { ...range, context_codes: ` ${courseCode} , user_${sbx.teacher.id},` } },
		});
		expect(both.map((e) => e.context_code).sort()).toEqual([courseCode, `user_${sbx.teacher.id}`].sort());
		await teacher.delete(`/api/v1/calendar_events/${String(personal.id)}`);
	});

	it('getAll: Blackout Date and Important Dates filters, Excludes and Include', async () => {
		const flagged = await teacher.post<Json>('/api/v1/calendar_events', {
			calendar_event: {
				context_code: courseCode,
				title: unique('Winter break'),
				start_at: '2029-02-12T00:00:00Z',
				all_day: true,
				blackout_date: true,
				important_dates: true,
				description: '<p>No classes</p>',
			},
		});
		const base = { context_codes: courseCode, start_date: '2029-02-01', end_date: '2029-02-28' };

		for (const flag of ['blackout_date', 'important_dates']) {
			const only = await runOk({
				resource: 'calendarEvent',
				operation: 'getAll',
				persona: asTeacher,
				params: { options: { ...base, [flag]: true }, pagination: { returnAll: true } },
			});
			expect(only.map((e) => e.id), flag).toEqual([flagged.id]);
			const off = await runOk({
				resource: 'calendarEvent',
				operation: 'getAll',
				persona: asTeacher,
				params: { options: { ...base, [flag]: false }, pagination: { returnAll: true } },
			});
			expect(off.length, flag).toBeGreaterThan(1);
		}

		const lean = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { ...base, excludes: ['description', 'child_events'] }, pagination: { perPage: 5, maxPages: 1 } },
		});
		for (const event of lean) {
			expect(event).not.toHaveProperty('description');
			expect(event).not.toHaveProperty('child_events');
		}
		const full = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: base, pagination: { perPage: 5, maxPages: 1 } },
		});
		for (const event of full) {
			expect(event).toHaveProperty('description');
			expect(event).toHaveProperty('child_events');
		}

		// Include: the recurrence rule in words (Canvas documents `includes[]` but only reads `include[]`).
		const series = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: {
				options: { context_codes: courseCode, start_date: '2027-09-01', end_date: '2027-10-31', include: ['series_natural_language', 'web_conference'] },
			},
		});
		const ofSeries = series.filter((e) => seriesIds.includes(String(e.id)));
		expect(ofSeries).toHaveLength(seriesIds.length);
		for (const event of ofSeries) expect(event.series_natural_language).toBeTypeOf('string');
		const plain = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { context_codes: courseCode, start_date: '2027-09-01', end_date: '2027-10-31' } },
		});
		for (const event of plain) expect(event).not.toHaveProperty('series_natural_language');
		await teacher.delete(`/api/v1/calendar_events/${String(flagged.id)}`);
	});

	it('getAll: assignments, filtered by submission type', async () => {
		const made: Json[] = [];
		for (const [name, type] of [
			['Reading response', 'online_text_entry'],
			['Poster', 'on_paper'],
		]) {
			made.push(
				await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/assignments`, {
					assignment: { name: unique(name), due_at: '2029-03-05T22:00:00Z', published: true, submission_types: [type] },
				}),
			);
		}
		const base = { context_codes: courseCode, type: 'assignment', start_date: '2029-03-05', end_date: '2029-03-05' };
		const codes = (items: Json[]): unknown[] => items.map((e) => e.id).sort();

		const both = await runOk({ resource: 'calendarEvent', operation: 'getAll', persona: asTeacher, params: { options: base } });
		expect(codes(both)).toEqual(made.map((a) => `assignment_${String(a.id)}`).sort());
		expect(both.every((e) => e.type === 'assignment')).toBe(true);

		const onPaper = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { ...base, submission_types: ['on_paper'] } },
		});
		expect(codes(onPaper)).toEqual([`assignment_${String(made[1].id)}`]);

		const notOnPaper = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { ...base, exclude_submission_types: ['on_paper', 'online_quiz'] } },
		});
		expect(codes(notOnPaper)).toEqual([`assignment_${String(made[0].id)}`]);

		const withoutAssignment = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { ...base, excludes: ['assignment'] } },
		});
		for (const event of withoutAssignment) expect(event).not.toHaveProperty('assignment');
		for (const event of both) expect(event).toHaveProperty('assignment');

		// Sub assignments (discussion checkpoints) are not in use here: an empty list, not an error.
		const subAssignments = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { ...base, type: 'sub_assignment' } },
		});
		expect(subAssignments).toEqual([]);

		for (const assignment of made) await canvas().delete(`/api/v1/courses/${sbx.courseId}/assignments/${String(assignment.id)}`);
	});

	it('getAll: "User ID" reads another user\'s calendar', async () => {
		const student = sbx.students[0];
		const personal = await clientFor(student).post<Json>('/api/v1/calendar_events', {
			calendar_event: { context_code: `user_${student.id}`, title: unique('Piano lesson'), start_at: '2029-01-09T17:00:00Z' },
		});
		const range = { start_date: '2029-01-08', end_date: '2029-01-10' };

		// Without context codes: the personal calendar of that user, not of the caller.
		const theirs = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			params: { options: { ...range, user_id: ` ${student.id} ` } },
		});
		expect(theirs.map((e) => e.id)).toEqual([personal.id]);
		const own = await runOk({ resource: 'calendarEvent', operation: 'getAll', params: { options: range } });
		expect(own.map((e) => e.id)).not.toContain(personal.id);

		// With context codes: the course events as that user sees them.
		const expected = await canvas().getAll<Json>(
			`/api/v1/users/${student.id}/calendar_events?context_codes[]=${courseCode}&start_date=2029-01-08&end_date=2029-01-10`,
		);
		expect(expected).toHaveLength(3);
		const course = await runOk({
			resource: 'calendarEvent',
			operation: 'getAll',
			params: { options: { ...range, context_codes: courseCode, user_id: student.id } },
		});
		expect(course.map((e) => e.id)).toEqual(expected.map((e) => e.id));

		// A fellow student may not look.
		const refused = await runNode({
			resource: 'calendarEvent',
			operation: 'getAll',
			persona: 'sbxStudent2',
			params: { options: { ...range, user_id: student.id }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', endpoint: `/api/v1/users/${student.id}/calendar_events` });
		await clientFor(student).delete(`/api/v1/calendar_events/${String(personal.id)}`);
	});

	// ---------------------------------------------------------------- reserveTimeSlot

	it('reserveTimeSlot: students sign up, switch slots, and a teacher signs someone up', async () => {
		const group = await teacher.post<Json>('/api/v1/appointment_groups', {
			appointment_group: {
				context_codes: [courseCode],
				title: unique('Project consultations'),
				participants_per_appointment: 1,
				max_appointments_per_participant: 1,
				publish: true,
				new_appointments: [
					['2029-05-07T09:00:00Z', '2029-05-07T09:30:00Z'],
					['2029-05-07T09:30:00Z', '2029-05-07T10:00:00Z'],
					['2029-05-07T10:00:00Z', '2029-05-07T10:30:00Z'],
				],
			},
		});
		const detail = await teacher.get<Json>(`/api/v1/appointment_groups/${String(group.id)}?include[]=appointments`);
		const [slotA, slotB, slotC] = (detail.appointments as Json[]).map((a) => String(a.id));
		const [student1, student2] = sbx.students;
		const s1 = clientFor(student1);
		const reservedBy = async (slot: string): Promise<string[]> =>
			((await teacher.get<Json>(`/api/v1/calendar_events/${slot}`)).child_events as Json[]).map((c) => String((c.user as Json).id));

		// Student 1 reserves slot A with a comment.
		const [reservation] = await runOk({
			resource: 'calendarEvent',
			operation: 'reserveTimeSlot',
			persona: 'sbxStudent1',
			params: { eventId: slotA, options: { comments: 'I would like to discuss "scope" & timing 🙂' } },
		});
		expect(reservation).toMatchObject({ parent_event_id: Number(slotA), comments: 'I would like to discuss "scope" & timing 🙂' });
		expect(await reservedBy(slotA)).toEqual([student1.id]);

		expect(await s1.get<Json>(`/api/v1/calendar_events/${slotA}`)).toMatchObject({
			reserved: true,
			reserve_comments: 'I would like to discuss "scope" & timing 🙂',
			available_slots: 0,
		});

		// A second slot is refused (one appointment per participant) ...
		const second = await runNode({
			resource: 'calendarEvent',
			operation: 'reserveTimeSlot',
			persona: 'sbxStudent1',
			params: { eventId: slotB, errorHandling: { onError: 'continueWithError' } },
		});
		expect(second.success).toEqual([]);
		expect(second.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'reserveTimeSlot' });
		expect(await reservedBy(slotB)).toEqual([]);

		// ... unless the existing reservation is cancelled along the way.
		const [switched] = await runOk({
			resource: 'calendarEvent',
			operation: 'reserveTimeSlot',
			persona: 'sbxStudent1',
			params: { eventId: slotB, options: { cancel_existing: true } },
		});
		expect(switched.parent_event_id).toBe(Number(slotB));
		expect(await reservedBy(slotA)).toEqual([]);
		expect(await reservedBy(slotB)).toEqual([student1.id]);

		// The teacher reserves slot C for student 2.
		const [forOther] = await runOk({
			resource: 'calendarEvent',
			operation: 'reserveTimeSlot',
			persona: asTeacher,
			params: { eventId: slotC, options: { participant_id: student2.id, comments: 'Booked by the teacher' } },
		});
		expect(forOther).toMatchObject({ parent_event_id: Number(slotC), comments: 'Booked by the teacher' });
		expect(await reservedBy(slotC)).toEqual([student2.id]);

		// A full slot cannot be taken by someone else.
		const full = await runNode({
			resource: 'calendarEvent',
			operation: 'reserveTimeSlot',
			persona: 'sbxStudent3',
			params: { eventId: slotC, errorHandling: { onError: 'continueWithError' } },
		});
		expect(full.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		// delete: cancelling the reservation frees the slot.
		const [cancelled] = await runOk({
			resource: 'calendarEvent',
			operation: 'delete',
			persona: 'sbxStudent1',
			params: { eventId: String(switched.id), options: { cancel_reason: 'Cannot make it' } },
		});
		expect(cancelled).toMatchObject({ id: switched.id, workflow_state: 'deleted' });
		expect(await reservedBy(slotB)).toEqual([]);

		await teacher.delete(`/api/v1/appointment_groups/${String(group.id)}`);
	});

	// ---------------------------------------------------------------- delete

	it('delete: "Following" removes the rest of a series, "One" a single event', async () => {
		const following = await runOk({
			resource: 'calendarEvent',
			operation: 'delete',
			persona: asTeacher,
			params: { eventId: seriesIds[3], options: { which: 'following' } },
		});
		// Canvas also returns the events that stay: their recurrence rule was shortened.
		expect(following.filter((e) => e.workflow_state === 'deleted').map((e) => String(e.id))).toEqual(seriesIds.slice(3));
		const kept = following.filter((e) => e.workflow_state !== 'deleted');
		expect(kept.map((e) => String(e.id)).sort()).toEqual(seriesIds.slice(0, 3).sort());
		for (const event of kept) expect(event.rrule).toBe('FREQ=WEEKLY;INTERVAL=1;COUNT=3');
		const states = async (): Promise<unknown[]> => Promise.all(seriesIds.map(async (id) => (await read(id)).workflow_state));
		expect(await states()).toEqual(['active', 'active', 'active', 'deleted', 'deleted']);

		const one = await runOk({
			resource: 'calendarEvent',
			operation: 'delete',
			persona: asTeacher,
			params: { eventId: seriesIds[1], options: { which: 'one' } },
		});
		expect(one.map((e) => String(e.id))).toEqual([seriesIds[1]]);
		expect(await states()).toEqual(['active', 'deleted', 'active', 'deleted', 'deleted']);

		// Clean up what is left of the series.
		await runOk({ resource: 'calendarEvent', operation: 'delete', persona: asTeacher, params: { eventId: seriesIds[0], options: { which: 'all' } } });
		expect(await states()).toEqual(['deleted', 'deleted', 'deleted', 'deleted', 'deleted']);
	});

	it('delete: many events in one execution, one input item each', async () => {
		const result = await runNode({
			resource: 'calendarEvent',
			operation: 'delete',
			persona: asTeacher,
			items: [...bulkIds.map((id) => ({ id: Number(id) })), { id: 99999999 }],
			params: {
				eventId: '={{ $json.id }}',
				errorHandling: { onError: 'continueWithError' },
				batchProcessing: { batchSize: 20, batchDelay: 100 },
			},
		});
		expect(result.success.map((e) => String(e.id))).toEqual(bulkIds);
		expect(result.success.every((e) => e.workflow_state === 'deleted')).toBe(true);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: 99999999 } });

		const left = await teacher.getAll<Json>(
			`/api/v1/calendar_events?context_codes[]=${courseCode}&start_date=2029-01-01&end_date=2029-04-30`,
		);
		expect(left.filter((e) => bulkIds.includes(String(e.id)))).toEqual([]);
	});

	it('delete: a single event', async () => {
		const [deleted] = await runOk({ resource: 'calendarEvent', operation: 'delete', persona: asTeacher, params: { eventId } });
		expect(deleted).toMatchObject({ id: Number(eventId), workflow_state: 'deleted' });
		expect((await read(eventId)).workflow_state).toBe('deleted');
	});

	// ---------------------------------------------------------------- errors

	it('errors: missing events, foreign calendars and bad recurrence rules', async () => {
		const missing = await runNode({
			resource: 'calendarEvent',
			operation: 'get',
			persona: asTeacher,
			params: { eventId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'calendarEvent', operation: 'get' });

		const forbidden = await runNode({
			resource: 'calendarEvent',
			operation: 'create',
			persona: 'sbxStudent1',
			params: { contextCode: courseCode, title: 'Students cannot add course events', errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const noContext = await runNode({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: { contextCode: 'course_99999999', title: 'Nowhere', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noContext.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// An unending series is refused; Canvas says what is missing.
		const before = await teacher.getAll<Json>(`/api/v1/calendar_events?context_codes[]=${courseCode}&all_events=true`);
		const endless = await runNode({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCode: courseCode,
				title: 'Forever',
				additionalFields: { start_at: '2027-05-03T10:00:00Z', rrule: 'FREQ=WEEKLY;INTERVAL=1' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(endless.success).toEqual([]);
		expect(endless.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(endless.error[0].errorMessage)).not.toBe('');
		const after = await teacher.getAll<Json>(`/api/v1/calendar_events?context_codes[]=${courseCode}&all_events=true`);
		expect(after.length).toBe(before.length);

		// More than 200 copies are refused as well.
		const tooMany = await runNode({
			resource: 'calendarEvent',
			operation: 'create',
			persona: asTeacher,
			items: [{ copies: 201 }],
			params: {
				contextCode: courseCode,
				title: 'Too many',
				additionalFields: { start_at: '2027-05-03T10:00:00Z', duplicate_count: '={{ $json.copies }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(tooMany.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});
});
