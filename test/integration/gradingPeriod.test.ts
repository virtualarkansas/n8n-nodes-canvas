import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { canvasSql, createSandboxCourse, deleteSandboxCourse, unwrap } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: gradingPeriod. Uses a grading period set, a term and courses of its
 * own. Canvas has two kinds of grading periods:
 *   - periods of a grading period set (account level), which courses inherit through their term;
 *   - legacy periods owned by a course. They can no longer be created through Canvas,
 *     but old instances still have them, and they are the only ones the single-period
 *     Update and the course-context Delete reach. This file inserts some with SQL.
 */
describe('gradingPeriod', () => {
	const accountId = fx('accountId');
	let termId = '';
	let emptyTermId = '';
	let setId = '';
	let course: SandboxCourse;
	let legacyCourse: SandboxCourse;
	let plainCourse: SandboxCourse;
	let legacyIds: string[] = [];
	let periodIds: string[] = [];

	/** Canvas renders dates in UTC on some endpoints and in the caller's time zone on others. */
	const utc = (period: Json): Json => {
		const out: Json = { ...period };
		for (const key of ['start_date', 'end_date', 'close_date']) {
			if (typeof out[key] === 'string') out[key] = new Date(out[key] as string).toISOString().replace('.000Z', 'Z');
		}
		return out;
	};
	const setPeriods = async (): Promise<Json[]> => {
		const sets = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/grading_period_sets`, 'grading_period_sets');
		const set = sets.find((s) => String(s.id) === setId);
		return ((set?.grading_periods ?? []) as Json[]).map(utc).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
	};
	const coursePeriods = async (id: string): Promise<Json[]> =>
		(await canvas().getAll<Json>(`/api/v1/courses/${id}/grading_periods`, 'grading_periods')).map(utc);

	/** Month `m` (1-based, may exceed 12) of 2031 as an ISO date. */
	const month = (m: number, day = 1): string => new Date(Date.UTC(2031, m - 1, day)).toISOString().replace('.000Z', 'Z');

	beforeAll(async () => {
		const term = await canvas().post<Json>(`/api/v1/accounts/${accountId}/terms`, {
			enrollment_term: { name: unique('Grading period term') },
		});
		termId = String(term.id);
		const set = await canvas().post<Json>(`/api/v1/accounts/${accountId}/grading_period_sets`, {
			enrollment_term_ids: [termId],
			grading_period_set: { title: unique('Grading period battery set'), weighted: true },
		});
		setId = String((set.grading_period_set as Json).id);
		course = await createSandboxCourse('periods', { personas: ['teacher', 'student'], course: { term_id: termId } });
		const emptyTerm = await canvas().post<Json>(`/api/v1/accounts/${accountId}/terms`, {
			enrollment_term: { name: unique('Term without grading periods') },
		});
		emptyTermId = String(emptyTerm.id);
		plainCourse = await createSandboxCourse('no-periods', { course: { term_id: emptyTermId } });

		legacyCourse = await createSandboxCourse('legacy-periods');
		legacyIds = canvasSql(
			`with g as (
				insert into public.grading_period_groups (course_id, title, workflow_state, root_account_id, created_at, updated_at)
				values (${Number(legacyCourse.id)}, 'Legacy course periods', 'active', ${Number(accountId)}, now(), now()) returning id)
			insert into public.grading_periods (grading_period_group_id, title, start_date, end_date, close_date, workflow_state, root_account_id, created_at, updated_at)
			select g.id, t.title, t.s::timestamp, t.e::timestamp, t.e::timestamp, 'active', ${Number(accountId)}, now(), now()
			from g, (values ('Legacy 1', '2030-01-01', '2030-03-01'), ('Legacy 2', '2030-03-01', '2030-06-01'), ('Legacy 3', '2030-06-01', '2030-09-01')) as t(title, s, e)
			returning id`,
		)
			.split('\n')
			.filter((line) => /^\d+$/.test(line));
		expect(legacyIds).toHaveLength(3);
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxCourse(legacyCourse);
		await deleteSandboxCourse(plainCourse);
		await canvas().request('DELETE', `/api/v1/accounts/${accountId}/grading_period_sets/${setId}`);
		await canvas().request('DELETE', `/api/v1/accounts/${accountId}/terms/${termId}`);
		await canvas().request('DELETE', `/api/v1/accounts/${accountId}/terms/${emptyTermId}`);
	});

	it('batchUpdate: creates the periods of a set with every field', async () => {
		const rows = Array.from({ length: 12 }, (_, i) => ({
			title: i === 0 ? 'Période 1 "quoted" & <b>bold</b> 第一期 🗓️' : `Period ${i + 1}`,
			start_date: month(i + 1),
			end_date: month(i + 2),
			close_date: month(i + 2, 5),
			weight: i < 2 ? '40' : '2',
		}));
		const output = await runOk({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			params: { gradingPeriodSetId: setId, gradingPeriods: { gradingPeriod: rows } },
		});
		// Canvas answers { grading_periods: [...] }.
		const created = output.length === 1 && Array.isArray(output[0].grading_periods) ? (output[0].grading_periods as Json[]) : output;
		expect(created.map((p) => p.title)).toEqual(rows.map((r) => r.title));

		const actual = await setPeriods();
		periodIds = actual.map((p) => String(p.id));
		expect(actual).toHaveLength(12);
		expect(actual[0]).toMatchObject({
			title: rows[0].title,
			start_date: month(1),
			end_date: month(2),
			close_date: month(2, 5),
			weight: 40,
			grading_period_group_id: setId,
		});
		expect(actual[11]).toMatchObject({ title: 'Period 12', start_date: month(12), end_date: month(13), weight: 2 });
	});

	it('batchUpdate: updates listed periods by ID (empty fields keep their value) and creates new ones in the same request', async () => {
		const before = await setPeriods();
		await runOk({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			params: {
				gradingPeriodSetId: Number(setId),
				gradingPeriods: {
					gradingPeriod: [
						// As the editor stores a row in which only ID, title and weight were filled in.
						{ id: periodIds[1], title: 'Period 2 (renamed)', start_date: '', end_date: '', close_date: '', weight: '0' },
						// Weight left empty: unchanged.
						{ id: Number(periodIds[2]), title: '', start_date: '', end_date: month(4), close_date: month(4, 20), weight: '' },
						// No close date and no weight on a new period.
						{ id: '', title: 'Period 13', start_date: month(13), end_date: month(14), close_date: '', weight: '' },
					],
				},
			},
		});
		const actual = await setPeriods();
		expect(actual).toHaveLength(13);
		expect(actual[0]).toEqual(before[0]);
		expect(actual[1]).toMatchObject({ id: periodIds[1], title: 'Period 2 (renamed)', start_date: before[1].start_date, end_date: before[1].end_date, close_date: before[1].close_date, weight: 0 });
		expect(actual[2]).toMatchObject({ id: periodIds[2], title: 'Period 3', end_date: month(4), close_date: month(4, 20), weight: 2 });
		// A new period without a close date closes on its end date; without a weight it has none.
		expect(actual[12]).toMatchObject({ title: 'Period 13', start_date: month(13), end_date: month(14), close_date: month(14), weight: null });
		periodIds = actual.map((p) => String(p.id));
	});

	it('batchUpdate: overlapping periods are refused as a whole', async () => {
		const before = await setPeriods();
		const result = await runNode({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			params: {
				gradingPeriodSetId: setId,
				gradingPeriods: {
					gradingPeriod: [
						{ title: 'Fine on its own', start_date: month(20), end_date: month(22) },
						{ title: 'Overlaps the row above', start_date: month(21), end_date: month(23) },
					],
				},
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'gradingPeriod', operation: 'batchUpdate' });
		// Canvas loses its own explanation here (it answers { errors: [{ errors: {} }] }).
		expect(result.error[0].canvasErrors).toBeDefined();

		// A single period is checked against the periods the set already has.
		const single = await runNode({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			params: {
				gradingPeriodSetId: setId,
				gradingPeriods: { gradingPeriod: [{ title: 'Overlaps period 1', start_date: month(1, 10), end_date: month(1, 20) }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(single.success).toEqual([]);
		expect(single.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR' });
		// The message itself is localized; the model-level error sits under "base".
		expect(JSON.stringify(single.error[0].canvasErrors)).toContain('"base"');
		expect(String(single.error[0].errorMessage).length).toBeGreaterThan(10);
		expect(await setPeriods()).toEqual(before);
	});

	it('batchUpdate: a new period without dates is a validation error; no rows is refused by the node', async () => {
		const invalid = await runNode({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			params: {
				gradingPeriodSetId: setId,
				gradingPeriods: { gradingPeriod: [{ title: 'No dates' }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error).toHaveLength(1);
		expect(invalid.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(invalid.error[0].canvasErrors)).toContain('start_date');

		const empty = await runNode({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			params: { gradingPeriodSetId: setId, gradingPeriods: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(String(empty.error[0].errorMessage)).toMatch(/at least one grading period/i);
		expect(await setPeriods()).toHaveLength(13);
	});

	it('getAll: account context returns the periods of every set, across pages', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/grading_periods`, 'grading_periods');
		expect(expected.length).toBeGreaterThan(13);

		const defaults = await runOk({ resource: 'gradingPeriod', operation: 'getAll', params: { context: 'account', accountId } });
		expect(defaults.map((p) => p.id)).toEqual(expected.slice(0, 50).map((p) => p.id));
		expect(defaults[0]).toMatchObject({ title: expect.any(String), start_date: expect.any(String), grading_period_group_id: expect.any(String) });

		const twoPages = await runOk({
			resource: 'gradingPeriod',
			operation: 'getAll',
			params: { context: 'account', accountId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((p) => p.id)).toEqual(expected.slice(0, 8).map((p) => p.id));

		const all = await runOk({
			resource: 'gradingPeriod',
			operation: 'getAll',
			params: { context: 'account', accountId, pagination: { returnAll: true } },
		});
		expect(all.map((p) => p.id)).toEqual(expected.map((p) => p.id));
		expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
		for (const id of periodIds) expect(all.map((p) => p.id)).toContain(id);
	});

	it('getAll: course context returns the periods the course inherits from its term\'s set', async () => {
		const expected = await coursePeriods(course.id);
		expect(expected.map((p) => String(p.id))).toEqual(periodIds);

		const listed = await runOk({
			resource: 'gradingPeriod',
			operation: 'getAll',
			persona: 'teacher',
			params: { context: 'course', courseId: course.id, pagination: { returnAll: true } },
		});
		expect(listed.map((p) => p.id)).toEqual(expected.map((p) => p.id));
		expect(listed[0]).toMatchObject({ title: 'Période 1 "quoted" & <b>bold</b> 第一期 🗓️', weight: 40, is_closed: false });

		// Default context is "course"; the course may be given by SIS ID.
		const bySis = await runOk({
			resource: 'gradingPeriod',
			operation: 'getAll',
			params: { courseId: `sis_course_id:${course.sisId}`, pagination: { perPage: 5, maxPages: 1 } },
		});
		expect(bySis.map((p) => p.id)).toEqual(expected.slice(0, 5).map((p) => p.id));
	});

	it('getAll: a course whose term has no grading period set yields no items', async () => {
		const result = await runNode({
			resource: 'gradingPeriod',
			operation: 'getAll',
			params: { context: 'course', courseId: plainCourse.id },
		});
		expect(await coursePeriods(plainCourse.id)).toEqual([]);
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([]);
	});

	it('get: returns the period itself, for several input items with a mix of found and missing', async () => {
		const result = await runNode({
			resource: 'gradingPeriod',
			operation: 'get',
			items: [{ id: Number(periodIds[0]) }, { id: 99999999 }, { id: periodIds[3] }],
			params: { courseId: Number(course.id), gradingPeriodId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((p) => p.id)).toEqual([periodIds[0], periodIds[3]]);
		expect(result.success[0]).toMatchObject({ title: 'Période 1 "quoted" & <b>bold</b> 第一期 🗓️', start_date: month(1), weight: 40 });
		expect(result.success[0]).not.toHaveProperty('grading_periods');
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'gradingPeriod', operation: 'get' });
	});

	it('update: changes a legacy course-level period', async () => {
		const [output] = await runOk({
			resource: 'gradingPeriod',
			operation: 'update',
			params: {
				courseId: legacyCourse.id,
				gradingPeriodId: legacyIds[0],
				updateFields: {
					title: 'Legacy 1 — renamed "Q1" & more 季度',
					start_date: '2030-01-05T00:00:00Z',
					end_date: '2030-02-20T00:00:00Z',
					weight: 25,
				},
			},
		});
		expect(unwrap(output, 'grading_periods')).toMatchObject({ id: legacyIds[0], title: 'Legacy 1 — renamed "Q1" & more 季度' });

		const actual = (await coursePeriods(legacyCourse.id)).find((p) => p.id === legacyIds[0]);
		expect(actual).toMatchObject({
			title: 'Legacy 1 — renamed "Q1" & more 季度',
			start_date: '2030-01-05T00:00:00Z',
			end_date: '2030-02-20T00:00:00Z',
			// A course-level period always closes on its end date.
			close_date: '2030-02-20T00:00:00Z',
			weight: 25,
		});
	});

	it('update: an end date before the start date is a validation error', async () => {
		const result = await runNode({
			resource: 'gradingPeriod',
			operation: 'update',
			params: {
				courseId: legacyCourse.id,
				gradingPeriodId: legacyIds[1],
				updateFields: { end_date: '2029-01-01T00:00:00Z' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'gradingPeriod', operation: 'update' });
	});

	it('update: a period of a grading period set is "not found" on this endpoint (use Batch Update)', async () => {
		const result = await runNode({
			resource: 'gradingPeriod',
			operation: 'update',
			params: {
				courseId: course.id,
				gradingPeriodId: periodIds[0],
				updateFields: { title: 'must not change' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((await setPeriods())[0].title).not.toBe('must not change');
	});

	it('delete: account context removes a period of a set', async () => {
		const [result] = await runOk({
			resource: 'gradingPeriod',
			operation: 'delete',
			params: { context: 'account', accountId, gradingPeriodId: Number(periodIds[12]) },
		});
		expect(result).toEqual({ success: true });
		const remaining = (await setPeriods()).map((p) => String(p.id));
		expect(remaining).toEqual(periodIds.slice(0, 12));
	});

	it('delete: course context removes a legacy period, but not one inherited from a set', async () => {
		const [result] = await runOk({
			resource: 'gradingPeriod',
			operation: 'delete',
			params: { context: 'course', courseId: legacyCourse.id, gradingPeriodId: legacyIds[2] },
		});
		expect(result).toEqual({ success: true });
		expect((await coursePeriods(legacyCourse.id)).map((p) => p.id)).toEqual([legacyIds[0], legacyIds[1]]);

		const inherited = await runNode({
			resource: 'gradingPeriod',
			operation: 'delete',
			params: { context: 'course', courseId: course.id, gradingPeriodId: periodIds[0], errorHandling: { onError: 'continueWithError' } },
		});
		expect(inherited.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		expect((await setPeriods()).map((p) => String(p.id))).toContain(periodIds[0]);
	});

	it('errors: a teacher can read but not change the periods of a set; a student cannot list account periods', async () => {
		const teacher = await runNode({
			resource: 'gradingPeriod',
			operation: 'batchUpdate',
			persona: 'teacher',
			params: {
				gradingPeriodSetId: setId,
				gradingPeriods: { gradingPeriod: [{ id: periodIds[0], title: 'by a teacher' }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(teacher.success).toEqual([]);
		expect([401, 403]).toContain(teacher.error[0].errorCode);

		const student = await runNode({
			resource: 'gradingPeriod',
			operation: 'getAll',
			persona: 'student',
			params: { context: 'account', accountId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(student.success).toEqual([]);
		expect([401, 403]).toContain(student.error[0].errorCode);
		expect((await setPeriods())[0].title).not.toBe('by a teacher');
	});
});
