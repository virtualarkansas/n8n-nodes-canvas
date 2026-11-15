import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox } from './support/commsSandbox';
import { clientFor, commsSandbox, sandboxSubAccount } from './support/commsSandbox';

/**
 * Resource: blackoutDate (days that do not count in course pacing).
 * Course context: a course created for this run. Account context: the
 * battery's own sub-account, never the root account.
 */
describe('blackoutDate', () => {
	let sbx: Sandbox;
	let teacher: CanvasClient;
	let courseId = '';
	let subAccountId = '';
	const asTeacher = 'sbxTeacher';

	let courseDateId = '';
	let accountDateId = '';

	/** Canvas wraps single blackout dates as `{ "blackout_date": { ... } }`; lists are plain. */
	const unwrap = (item: Json): Json => (item.blackout_date as Json | undefined) ?? item;
	const listOf = (context: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/${context}/blackout_dates`);

	beforeAll(async () => {
		sbx = await commsSandbox();
		teacher = clientFor(sbx.teacher);
		subAccountId = await sandboxSubAccount();
		// "Replace All" deletes whatever is not listed, so this file works on a course of its own.
		const course = await canvas().post<Json>(`/api/v1/accounts/${subAccountId}/courses`, {
			course: { name: unique('Battery blackout dates') },
			offer: true,
		});
		courseId = String(course.id);
		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: sbx.teacher.id, type: 'TeacherEnrollment', enrollment_state: 'active', notify: false },
		});
		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: sbx.students[0].id, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
		});
	}, 900_000);

	afterAll(async () => {
		// The course only exists for this run.
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
	}, 120_000);

	// ---------------------------------------------------------------- create

	it('create (course): title and both dates are stored; only the day of a timestamp counts', async () => {
		const title = unique('Spring break "🌷" & <b>more</b>');
		const [created] = await runOk({
			resource: 'blackoutDate',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextType: 'course',
				courseId,
				eventTitle: title,
				// What a date picker hands over: full timestamps, with and without an offset.
				startDate: '2027-03-15T00:00:00',
				endDate: '2027-03-19T23:30:00-05:00',
			},
		});
		courseDateId = String(unwrap(created).id);

		const actual = unwrap(await teacher.get<Json>(`/api/v1/courses/${courseId}/blackout_dates/${courseDateId}`));
		expect(actual).toMatchObject({
			id: Number(courseDateId),
			context_type: 'Course',
			context_id: Number(courseId),
			event_title: title,
			start_date: '2027-03-15',
			end_date: '2027-03-19',
		});
	});

	it('create (account): on the battery\'s own sub-account', async () => {
		const [created] = await runOk({
			resource: 'blackoutDate',
			operation: 'create',
			params: {
				contextType: 'account',
				accountId: subAccountId,
				eventTitle: 'District closure',
				startDate: '2027-11-25',
				endDate: '2027-11-26',
			},
		});
		accountDateId = String(unwrap(created).id);
		const all = await listOf(`accounts/${subAccountId}`);
		expect(all.find((d) => String(d.id) === accountDateId)).toMatchObject({
			context_type: 'Account',
			context_id: Number(subAccountId),
			event_title: 'District closure',
			start_date: '2027-11-25',
			end_date: '2027-11-26',
		});
	});

	// ---------------------------------------------------------------- get / getAll

	it('get: in both contexts', async () => {
		const [inCourse] = await runOk({
			resource: 'blackoutDate',
			operation: 'get',
			persona: asTeacher,
			items: [{ id: Number(courseDateId) }],
			params: { contextType: 'course', courseId, blackoutDateId: '={{ $json.id }}' },
		});
		expect(unwrap(inCourse)).toMatchObject({ id: Number(courseDateId), start_date: '2027-03-15', end_date: '2027-03-19' });

		const [inAccount] = await runOk({
			resource: 'blackoutDate',
			operation: 'get',
			params: { contextType: 'account', accountId: subAccountId, blackoutDateId: accountDateId },
		});
		expect(unwrap(inAccount)).toMatchObject({ id: Number(accountDateId), event_title: 'District closure' });
	});

	// Canvas answers Create, Get and Update with `{ "blackout_date": { ... } }` while Get Many returns the
	// plain records. Unwrapping single records needs support in the shared node code (see the report).
	it('get [needs shared change]: the output is the blackout date itself, like the items of Get Many', async () => {
		const [inCourse] = await runOk({
			resource: 'blackoutDate',
			operation: 'get',
			persona: asTeacher,
			params: { contextType: 'course', courseId, blackoutDateId: courseDateId },
		});
		expect(inCourse).toMatchObject({ id: Number(courseDateId), start_date: '2027-03-15' });
	});

	it('getAll: in both contexts, ordered by start date, with more entries than a page', async () => {
		// 55 single-day blackout dates in one request (see Replace All below for that operation itself).
		const existing = await listOf(`courses/${courseId}`);
		const days = Array.from({ length: 55 }, (_, i) => {
			const day = new Date(Date.UTC(2028, 0, 3 + i)).toISOString().slice(0, 10);
			return { event_title: `Closure ${i + 1}`, start_date: day, end_date: day };
		});
		await teacher.put(`/api/v1/courses/${courseId}/blackout_dates`, {
			blackout_dates: [...existing.map((d) => ({ id: d.id, event_title: d.event_title, start_date: d.start_date, end_date: d.end_date })), ...days],
		});
		const expected = await listOf(`courses/${courseId}`);
		expect(expected).toHaveLength(56);

		const all = await runOk({
			resource: 'blackoutDate',
			operation: 'getAll',
			persona: asTeacher,
			params: { contextType: 'course', courseId, pagination: { returnAll: true } },
		});
		expect(all).toEqual(expected);
		const starts = all.map((d) => String(d.start_date));
		expect(starts).toEqual([...starts].sort());

		// The endpoint is not paginated: page settings must neither cut the list nor repeat entries.
		const byDefault = await runOk({ resource: 'blackoutDate', operation: 'getAll', persona: asTeacher, params: { contextType: 'course', courseId } });
		expect(byDefault.map((d) => d.id)).toEqual(expected.map((d) => d.id));
		const smallPages = await runOk({
			resource: 'blackoutDate',
			operation: 'getAll',
			persona: asTeacher,
			params: { contextType: 'course', courseId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(smallPages.map((d) => d.id)).toEqual(expected.map((d) => d.id));

		const inAccount = await runOk({
			resource: 'blackoutDate',
			operation: 'getAll',
			params: { contextType: 'account', accountId: subAccountId },
		});
		expect(inAccount).toEqual(await listOf(`accounts/${subAccountId}`));
		expect(inAccount.map((d) => String(d.id))).toContain(accountDateId);
	});

	// ---------------------------------------------------------------- update

	it('update: each field on its own and all together, in both contexts', async () => {
		const read = async (): Promise<Json> => unwrap(await teacher.get<Json>(`/api/v1/courses/${courseId}/blackout_dates/${courseDateId}`));

		await runOk({
			resource: 'blackoutDate',
			operation: 'update',
			persona: asTeacher,
			params: { contextType: 'course', courseId, blackoutDateId: courseDateId, updateFields: { event_title: 'Spring break (extended)' } },
		});
		expect(await read()).toMatchObject({ event_title: 'Spring break (extended)', start_date: '2027-03-15', end_date: '2027-03-19' });

		await runOk({
			resource: 'blackoutDate',
			operation: 'update',
			persona: asTeacher,
			params: { contextType: 'course', courseId, blackoutDateId: courseDateId, updateFields: { end_date: '2027-03-26T12:00:00Z' } },
		});
		expect(await read()).toMatchObject({ start_date: '2027-03-15', end_date: '2027-03-26' });

		const [updated] = await runOk({
			resource: 'blackoutDate',
			operation: 'update',
			persona: asTeacher,
			params: {
				contextType: 'course',
				courseId,
				blackoutDateId: courseDateId,
				updateFields: { event_title: 'Easter break', start_date: '2027-03-22', end_date: '2027-03-29' },
			},
		});
		expect(unwrap(updated)).toMatchObject({ id: Number(courseDateId), event_title: 'Easter break' });
		expect(await read()).toMatchObject({ event_title: 'Easter break', start_date: '2027-03-22', end_date: '2027-03-29' });

		await runOk({
			resource: 'blackoutDate',
			operation: 'update',
			params: {
				contextType: 'account',
				accountId: subAccountId,
				blackoutDateId: accountDateId,
				updateFields: { event_title: 'District closure (moved)', start_date: '2027-12-02', end_date: '2027-12-03' },
			},
		});
		const inAccount = (await listOf(`accounts/${subAccountId}`)).find((d) => String(d.id) === accountDateId);
		expect(inAccount).toMatchObject({ event_title: 'District closure (moved)', start_date: '2027-12-02', end_date: '2027-12-03' });
	});

	// ---------------------------------------------------------------- replaceAll

	it('replaceAll: updates listed IDs, creates entries without ID, deletes the rest', async () => {
		const before = await listOf(`courses/${courseId}`);
		expect(before.length).toBeGreaterThan(50);
		const keep = before.find((d) => String(d.id) === courseDateId) as Json;
		const alsoKeep = before.find((d) => d.event_title === 'Closure 1') as Json;

		const result = await runOk({
			resource: 'blackoutDate',
			operation: 'replaceAll',
			persona: asTeacher,
			params: {
				courseId,
				blackoutDates: {
					dates: [
						// kept and renamed
						{ id: Number(keep.id), event_title: 'Easter break (final)', start_date: '2027-03-22', end_date: '2027-03-30T08:00:00Z' },
						// kept as it is
						{ id: String(alsoKeep.id), event_title: alsoKeep.event_title, start_date: alsoKeep.start_date, end_date: alsoKeep.end_date },
						// new, a single day: the end date defaults to the start date
						{ id: '', event_title: 'Teacher training 🧑‍🏫', start_date: '2027-10-11T00:00:00', end_date: '' },
						// new, several days
						{ event_title: 'Autumn break', start_date: '2027-10-18', end_date: '2027-10-22' },
						// a row added in the UI but left empty is ignored
						{ id: '', event_title: '', start_date: '', end_date: '' },
					],
				},
			},
		});
		const after = await listOf(`courses/${courseId}`);
		// The response lists the blackout dates the course now has (in no particular order).
		const byId = (a: Json, b: Json): number => Number(a.id) - Number(b.id);
		expect([...result].sort(byId)).toEqual([...after].sort(byId));
		expect(after.map((d) => [d.event_title, d.start_date, d.end_date])).toEqual([
			['Easter break (final)', '2027-03-22', '2027-03-30'],
			['Teacher training 🧑‍🏫', '2027-10-11', '2027-10-11'],
			['Autumn break', '2027-10-18', '2027-10-22'],
			['Closure 1', '2028-01-03', '2028-01-03'],
		]);
		expect(after.map((d) => d.id)).toContain(keep.id);
		expect(after.map((d) => d.id)).toContain(alsoKeep.id);
	});

	it('replaceAll: an empty list is refused by the node instead of wiping the course', async () => {
		const before = await listOf(`courses/${courseId}`);
		const result = await runNode({
			resource: 'blackoutDate',
			operation: 'replaceAll',
			persona: asTeacher,
			params: { courseId, blackoutDates: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 0, operation: 'replaceAll' });
		expect(String(result.error[0].errorMessage)).toContain('at least one blackout date');
		expect(await listOf(`courses/${courseId}`)).toEqual(before);
	});

	// ---------------------------------------------------------------- delete

	it('delete: in both contexts, several input items with one unknown ID', async () => {
		const mine = await listOf(`courses/${courseId}`);
		const result = await runNode({
			resource: 'blackoutDate',
			operation: 'delete',
			persona: asTeacher,
			items: [{ id: mine[0].id }, { id: 99999999 }, { id: mine[1].id }],
			params: {
				contextType: 'course',
				courseId,
				blackoutDateId: '={{ $json.id }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([{ success: true }, { success: true }]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: 99999999 } });
		expect((await listOf(`courses/${courseId}`)).map((d) => d.id)).toEqual(mine.slice(2).map((d) => d.id));

		const [gone] = await runOk({
			resource: 'blackoutDate',
			operation: 'delete',
			params: { contextType: 'account', accountId: subAccountId, blackoutDateId: accountDateId },
		});
		expect(gone).toEqual({ success: true });
		expect((await listOf(`accounts/${subAccountId}`)).map((d) => String(d.id))).not.toContain(accountDateId);
	});

	// ---------------------------------------------------------------- errors

	it('errors: validation messages from Canvas, wrong context, missing rights', async () => {
		const backwards = await runNode({
			resource: 'blackoutDate',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextType: 'course',
				courseId,
				eventTitle: 'Backwards',
				startDate: '2027-05-10',
				endDate: '2027-05-01',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(backwards.success).toEqual([]);
		expect(backwards.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'blackoutDate', operation: 'create' });
		expect(String(backwards.error[0].errorMessage)).toContain("End date can't be before start date");

		// A course blackout date cannot be reached through the account context.
		const [left] = await listOf(`courses/${courseId}`);
		const wrongContext = await runNode({
			resource: 'blackoutDate',
			operation: 'get',
			params: {
				contextType: 'account',
				accountId: subAccountId,
				blackoutDateId: String(left.id),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongContext.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const student = await runNode({
			resource: 'blackoutDate',
			operation: 'create',
			persona: 'sbxStudent1',
			params: {
				contextType: 'course',
				courseId,
				eventTitle: 'Self-declared holiday',
				startDate: '2027-05-10',
				endDate: '2027-05-10',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(student.success).toEqual([]);
		expect(student.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });

		const teacherOnAccount = await runNode({
			resource: 'blackoutDate',
			operation: 'getAll',
			persona: asTeacher,
			params: { contextType: 'account', accountId: subAccountId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(teacherOnAccount.success).toEqual([]);
		expect(teacherOnAccount.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
	});
});
