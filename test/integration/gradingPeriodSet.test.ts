import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { unwrap } from './support/gradingSandbox';

/**
 * Resource: gradingPeriodSet. Sets live on the root account, so every set and
 * term used here is created by this file and removed again afterwards.
 */
describe('gradingPeriodSet', () => {
	const accountId = fx('accountId');
	const termIds: string[] = [];
	const ownSetIds: string[] = [];
	let setId = '';
	const title = unique('Sét "quoted" & <i>tags</i> 学期 🗓️');

	const sets = (): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/accounts/${accountId}/grading_period_sets`, 'grading_period_sets');
	const findSet = async (id: string): Promise<Json | undefined> => (await sets()).find((s) => String(s.id) === id);
	const setOfTerm = async (termId: string): Promise<string | null> => {
		const term = await canvas().get<Json>(`/api/v1/accounts/${accountId}/terms/${termId}`);
		return term.grading_period_group_id === null ? null : String(term.grading_period_group_id);
	};

	beforeAll(async () => {
		for (const label of ['A', 'B', 'C']) {
			const term = await canvas().post<Json>(`/api/v1/accounts/${accountId}/terms`, {
				enrollment_term: { name: unique(`Grading period set term ${label}`) },
			});
			termIds.push(String(term.id));
		}
	});

	afterAll(async () => {
		for (const id of ownSetIds) {
			await canvas().request('DELETE', `/api/v1/accounts/${accountId}/grading_period_sets/${id}`);
		}
		for (const id of termIds) {
			await canvas().request('DELETE', `/api/v1/accounts/${accountId}/terms/${id}`);
		}
	});

	it('create: every optional field reaches Canvas, terms included', async () => {
		const [output] = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'create',
			params: {
				accountId,
				title,
				additionalFields: {
					display_totals_for_all_grading_periods: true,
					// Typed the way people type lists.
					enrollment_term_ids: `${termIds[0]}, ${termIds[1]}`,
					weighted: true,
				},
			},
		});
		const created = unwrap(output, 'grading_period_set');
		setId = String(created.id);
		ownSetIds.push(setId);
		expect(created).toMatchObject({ title, weighted: true, display_totals_for_all_grading_periods: true, grading_periods: [] });

		expect(await findSet(setId)).toMatchObject({
			title,
			weighted: true,
			display_totals_for_all_grading_periods: true,
			account_id: accountId,
		});
		expect(await setOfTerm(termIds[0])).toBe(setId);
		expect(await setOfTerm(termIds[1])).toBe(setId);
		expect(await setOfTerm(termIds[2])).toBeNull();
	});

	it('create: one set per input item, with only a title', async () => {
		const titles = Array.from({ length: 11 }, (_, i) => unique(`Battery set ${i + 1}`));
		const result = await runNode({
			resource: 'gradingPeriodSet',
			operation: 'create',
			items: titles.map((t) => ({ title: t, account: Number(accountId) })),
			params: { accountId: '={{ $json.account }}', title: '={{ $json.title }}' },
		});
		expect(result.error).toEqual([]);
		const created = result.success.map((item) => unwrap(item, 'grading_period_set'));
		ownSetIds.push(...created.map((s) => String(s.id)));
		expect(created.map((s) => s.title)).toEqual(titles);
		for (const set of created) {
			// Canvas leaves "weighted" unset (null) unless it is sent.
			expect(set.weighted).toBeFalsy();
			expect(set).toMatchObject({ display_totals_for_all_grading_periods: false, grading_periods: [] });
		}
	});

	it('create: a term moves to the new set (a term uses one set at a time); term IDs may be an array', async () => {
		const [output] = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'create',
			items: [{ terms: [Number(termIds[1])] }],
			params: {
				accountId,
				title: unique('Takes over a term'),
				additionalFields: { enrollment_term_ids: '={{ $json.terms }}' },
			},
		});
		const takeover = String(unwrap(output, 'grading_period_set').id);
		ownSetIds.push(takeover);
		expect(await setOfTerm(termIds[1])).toBe(takeover);
		expect(await setOfTerm(termIds[0])).toBe(setId);
	});

	it('create: a term that does not exist is refused', async () => {
		const result = await runNode({
			resource: 'gradingPeriodSet',
			operation: 'create',
			params: {
				accountId,
				title: unique('Never created'),
				additionalFields: { enrollment_term_ids: '99999999' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'gradingPeriodSet', operation: 'create' });
	});

	it('getAll: returns the sets themselves (not Canvas\' wrapper), across pages', async () => {
		const expected = await sets();
		expect(expected.length, 'more sets than one page').toBeGreaterThan(10);

		const defaults = await runOk({ resource: 'gradingPeriodSet', operation: 'getAll', params: { accountId } });
		expect(defaults.map((s) => s.id)).toEqual(expected.map((s) => s.id));
		const seeded = defaults.find((s) => s.id === fx('gradingPeriodSetId'));
		expect(seeded).toMatchObject({ title: expect.any(String), weighted: expect.any(Boolean) });
		expect((seeded?.grading_periods as Json[]).length).toBeGreaterThan(0);

		const twoPages = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'getAll',
			params: { accountId, pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(twoPages.map((s) => s.id)).toEqual(expected.slice(0, 6).map((s) => s.id));

		const all = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'getAll',
			params: { accountId, pagination: { returnAll: true } },
		});
		expect(all.map((s) => s.id)).toEqual(expected.map((s) => s.id));
		expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
	});

	it('getAll: a sub-account lists the sets of its root account', async () => {
		const expected = await sets();
		const listed = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'getAll',
			params: { accountId: fx('subAccountId'), pagination: { returnAll: true } },
		});
		expect(listed.map((s) => s.id)).toEqual(expected.map((s) => s.id));
	});

	it('update: every field reaches Canvas and the term list replaces the old one', async () => {
		const renamed = `${title} (renamed)`;
		const [result] = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'update',
			params: {
				accountId,
				gradingPeriodSetId: setId,
				enrollmentTermIds: `${termIds[0]},${termIds[2]}`,
				updateFields: { title: renamed, weighted: false, display_totals_for_all_grading_periods: false },
			},
		});
		// Canvas answers 204 No Content.
		expect(result).toEqual({ success: true });

		expect(await findSet(setId)).toMatchObject({ title: renamed, weighted: false, display_totals_for_all_grading_periods: false });
		expect(await setOfTerm(termIds[0])).toBe(setId);
		expect(await setOfTerm(termIds[2])).toBe(setId);
	});

	it('update: without set fields nothing is sent, so the terms are not replaced by a failing request', async () => {
		const result = await runNode({
			resource: 'gradingPeriodSet',
			operation: 'update',
			params: {
				accountId,
				gradingPeriodSetId: setId,
				enrollmentTermIds: termIds[2],
				updateFields: {},
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/at least one update field/i);
		// Canvas itself would have answered 400 after detaching term A.
		expect(await setOfTerm(termIds[0])).toBe(setId);
	});

	it('update: an empty term list detaches every term (Canvas replaces the list on each update)', async () => {
		await runOk({
			resource: 'gradingPeriodSet',
			operation: 'update',
			params: { accountId, gradingPeriodSetId: setId, updateFields: { weighted: true } },
		});
		expect(await findSet(setId)).toMatchObject({ weighted: true });
		expect(await setOfTerm(termIds[0])).toBeNull();
		expect(await setOfTerm(termIds[2])).toBeNull();
	});

	it('update: term IDs may arrive as an array of numbers from an expression', async () => {
		await runOk({
			resource: 'gradingPeriodSet',
			operation: 'update',
			items: [{ terms: [Number(termIds[0]), Number(termIds[2])] }],
			params: {
				accountId,
				gradingPeriodSetId: setId,
				enrollmentTermIds: '={{ $json.terms }}',
				updateFields: { title: `${title} (terms from an array)` },
			},
		});
		expect(await setOfTerm(termIds[0])).toBe(setId);
		expect(await setOfTerm(termIds[2])).toBe(setId);
		expect(await findSet(setId)).toMatchObject({ title: `${title} (terms from an array)`, weighted: true });
	});

	it('update / delete: Canvas only allows changes on the root account', async () => {
		for (const operation of ['update', 'delete']) {
			const result = await runNode({
				resource: 'gradingPeriodSet',
				operation,
				params: {
					accountId: fx('subAccountId'),
					gradingPeriodSetId: setId,
					updateFields: { title: 'from a sub-account' },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'gradingPeriodSet', operation });
		}
		expect(await findSet(setId)).toBeDefined();
	});

	it('delete: removes the set and frees its terms', async () => {
		const [result] = await runOk({
			resource: 'gradingPeriodSet',
			operation: 'delete',
			params: { accountId, gradingPeriodSetId: Number(setId) },
		});
		expect(result).toEqual({ success: true });
		expect(await findSet(setId)).toBeUndefined();
		expect(await setOfTerm(termIds[0])).toBeNull();
	});

	it('errors: a set that does not exist is "not found" for each input item', async () => {
		const result = await runNode({
			resource: 'gradingPeriodSet',
			operation: 'delete',
			items: [{ id: setId }, { id: 99999999 }],
			params: { accountId, gradingPeriodSetId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'gradingPeriodSet', operation: 'delete' });
		}
	});

	it('errors: a teacher may not create sets', async () => {
		const result = await runNode({
			resource: 'gradingPeriodSet',
			operation: 'create',
			persona: 'teacher',
			params: { accountId, title: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403]).toContain(result.error[0].errorCode);
	});
});
