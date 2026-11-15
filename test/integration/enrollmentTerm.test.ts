import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: enrollmentTerm. Terms live on the root account, so this file only
 * creates, changes and deletes terms of its own (recognisable by a unique tag);
 * seeded terms are read, never changed. Writes are verified by reading the term
 * back from Canvas directly.
 */
describe('enrollmentTerm', () => {
	const account = fx('accountId');
	const tag = unique('zqterm').replace(/[\s-]/g, '');
	const ownTermIds: string[] = [];
	const bulkIds: number[] = [];
	let termId = '';
	let sisId = '';

	const getTerm = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/accounts/${account}/terms/${id}`);
	const listTerms = (query: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/accounts/${account}/terms?${query}`, 'enrollment_terms');

	beforeAll(async () => {
		// More terms than one default page holds, findable by the tag.
		for (let i = 1; i <= 12; i++) {
			const term = await canvas().post<Json>(`/api/v1/accounts/${account}/terms`, {
				enrollment_term: { name: `${tag} Bulk ${String(i).padStart(2, '0')}`, start_at: `2033-${String(i).padStart(2, '0')}-01T00:00:00Z` },
			});
			ownTermIds.push(String(term.id));
			bulkIds.push(Number(term.id));
		}
	});

	afterAll(async () => {
		for (const id of ownTermIds) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/terms/${id}`);
		}
	});

	it('create: every optional field and date override reaches Canvas', async () => {
		sisId = unique('TERM-SIS').replace(/\s/g, '_');
		const name = `${tag} Tërm 学期 "quoted" & <b>tags</b> 🗓`;
		const [created] = await runOk({
			resource: 'enrollmentTerm',
			operation: 'create',
			params: {
				accountId: account,
				name,
				additionalFields: { startAt: '2031-01-01T00:00:00Z', endAt: '2031-06-30T00:00:00Z', sisTermId: sisId },
				overrides: {
					override: [
						{ enrollmentType: 'StudentEnrollment', startAt: '2031-01-05T00:00:00Z', endAt: '2031-06-20T00:00:00Z' },
						{ enrollmentType: 'TeacherEnrollment', startAt: '', endAt: '2031-07-15T00:00:00Z' },
						{ enrollmentType: 'TaEnrollment', startAt: '2031-01-02T00:00:00Z', endAt: '' },
						{ enrollmentType: 'DesignerEnrollment', startAt: '2030-12-01T00:00:00Z', endAt: '2031-08-01T00:00:00Z' },
					],
				},
			},
		});
		termId = String(created.id);
		ownTermIds.push(termId);

		expect(await getTerm(termId)).toMatchObject({
			name,
			start_at: '2031-01-01T00:00:00Z',
			end_at: '2031-06-30T00:00:00Z',
			sis_term_id: sisId,
			workflow_state: 'active',
			overrides: {
				StudentEnrollment: { start_at: '2031-01-05T00:00:00Z', end_at: '2031-06-20T00:00:00Z' },
				TeacherEnrollment: { start_at: null, end_at: '2031-07-15T00:00:00Z' },
				TaEnrollment: { start_at: '2031-01-02T00:00:00Z', end_at: null },
				DesignerEnrollment: { start_at: '2030-12-01T00:00:00Z', end_at: '2031-08-01T00:00:00Z' },
			},
		});
	});

	it('create: only a name is needed; a taken SIS ID and inverted dates are refused', async () => {
		const [minimal] = await runOk({ resource: 'enrollmentTerm', operation: 'create', params: { accountId: 'self', name: `${tag} Minimal` } });
		ownTermIds.push(String(minimal.id));
		expect(await getTerm(String(minimal.id))).toMatchObject({ name: `${tag} Minimal`, start_at: null, end_at: null, sis_term_id: null, overrides: {} });

		const before = (await listTerms(`term_name=${tag}`)).length;
		const cases: Json[] = [
			{ name: `${tag} Duplicate SIS`, additionalFields: { sisTermId: sisId } },
			{ name: `${tag} Inverted`, additionalFields: { startAt: '2031-06-01T00:00:00Z', endAt: '2031-01-01T00:00:00Z' } },
		];
		for (const params of cases) {
			const result = await runNode({
				resource: 'enrollmentTerm',
				operation: 'create',
				params: { accountId: account, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, String(params.name)).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollmentTerm', operation: 'create' });
		}
		expect((await listTerms(`term_name=${tag}`)).length).toBe(before);
	});

	it('get: by ID and by SIS ID, with course count; seeded terms are readable; several items', async () => {
		const [term] = await runOk({ resource: 'enrollmentTerm', operation: 'get', params: { accountId: account, termId } });
		expect(term).toMatchObject({ id: Number(termId), sis_term_id: sisId, course_count: 0 });
		expect(term.overrides).toBeTypeOf('object');

		const [bySis] = await runOk({ resource: 'enrollmentTerm', operation: 'get', params: { accountId: account, termId: `sis_term_id:${fx('termSisId')}` } });
		expect(bySis.id).toBe(Number(fx('termId')));
		expect(Number(bySis.course_count)).toBeGreaterThan(0);

		const result = await runNode({
			resource: 'enrollmentTerm',
			operation: 'get',
			items: [{ id: Number(fx('pastTermId')) }, { id: 99999999 }, { id: Number(fx('deletedTermId')) }],
			params: { accountId: account, termId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		// A deleted term is still returned by Canvas, marked as deleted.
		expect(result.success.map((t) => [t.id, t.workflow_state])).toEqual([
			[Number(fx('pastTermId')), 'active'],
			[Number(fx('deletedTermId')), 'deleted'],
		]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'enrollmentTerm', operation: 'get' });
	});

	it('getAll: every term is its own item, across pages', async () => {
		const expected = await listTerms('workflow_state[]=active');
		// The twelve terms created by this file alone exceed one default page of ten.
		expect(expected.length).toBeGreaterThan(12);

		const all = await runOk({ resource: 'enrollmentTerm', operation: 'getAll', params: { accountId: account, pagination: { returnAll: true } } });
		expect(all.map((t) => t.id)).toEqual(expected.map((t) => t.id));
		expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
		expect(all[0]).not.toHaveProperty('enrollment_terms');
		expect(all.map((t) => t.id)).toContain(Number(fx('termId')));
		expect(all.map((t) => t.id)).not.toContain(Number(fx('deletedTermId')));

		const defaults = await runOk({ resource: 'enrollmentTerm', operation: 'getAll', params: { accountId: account } });
		expect(defaults.map((t) => t.id)).toEqual(expected.slice(0, 50).map((t) => t.id));

		const twoPages = await runOk({ resource: 'enrollmentTerm', operation: 'getAll', params: { accountId: account, pagination: { perPage: 5, maxPages: 2 } } });
		expect(twoPages.map((t) => t.id)).toEqual(expected.slice(0, 10).map((t) => t.id));
	});

	it('getAll: name search, includes and workflow state are applied', async () => {
		const found = await runOk({
			resource: 'enrollmentTerm',
			operation: 'getAll',
			params: {
				accountId: account,
				filters: { termName: `${tag} Bulk`, include: ['course_count', 'overrides'] },
				pagination: { perPage: 5, returnAll: true },
			},
		});
		expect(found.map((t) => Number(t.id)).sort((a, b) => a - b)).toEqual(bulkIds);
		expect(found[0]).toMatchObject({ course_count: 0, overrides: {} });

		const none = await runNode({ resource: 'enrollmentTerm', operation: 'getAll', params: { accountId: account, filters: { termName: 'zz-no-such-term-zz' } } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);

		const deleted = await runOk({ resource: 'enrollmentTerm', operation: 'getAll', params: { accountId: account, filters: { workflowState: ['deleted'] }, pagination: { returnAll: true } } });
		expect(deleted.map((t) => t.id)).toContain(Number(fx('deletedTermId')));
		expect(deleted.every((t) => t.workflow_state === 'deleted')).toBe(true);

		const everything = await runOk({ resource: 'enrollmentTerm', operation: 'getAll', params: { accountId: account, filters: { workflowState: ['all'] }, pagination: { returnAll: true } } });
		expect(everything.map((t) => t.id)).toEqual(expect.arrayContaining([Number(fx('deletedTermId')), Number(fx('termId'))]));
	});

	it('update: every optional field reaches Canvas; overrides of other types are kept', async () => {
		const renamed = `${tag} Renamed`;
		const newSis = `${sisId}_v2`;
		const [updated] = await runOk({
			resource: 'enrollmentTerm',
			operation: 'update',
			params: {
				accountId: account,
				termId,
				updateFields: {
					name: renamed,
					startAt: '2032-01-01T00:00:00Z',
					endAt: '2032-06-30T00:00:00Z',
					sisTermId: newSis,
					overrideSisStickiness: true,
				},
				overrides: { override: [{ enrollmentType: 'StudentEnrollment', startAt: '2032-01-10T00:00:00Z', endAt: '2032-06-10T00:00:00Z' }] },
			},
		});
		expect(updated.id).toBe(Number(termId));
		const actual = await getTerm(termId);
		expect(actual).toMatchObject({
			name: renamed,
			start_at: '2032-01-01T00:00:00Z',
			end_at: '2032-06-30T00:00:00Z',
			sis_term_id: newSis,
		});
		expect(actual.overrides).toMatchObject({
			StudentEnrollment: { start_at: '2032-01-10T00:00:00Z', end_at: '2032-06-10T00:00:00Z' },
			TeacherEnrollment: { end_at: '2031-07-15T00:00:00Z' },
			DesignerEnrollment: { start_at: '2030-12-01T00:00:00Z' },
		});
	});

	it('update: with "Override SIS Stickiness" off, a name changed in Canvas is left alone', async () => {
		await runOk({
			resource: 'enrollmentTerm',
			operation: 'update',
			params: { accountId: account, termId, updateFields: { name: 'Must Not Apply', overrideSisStickiness: false } },
		});
		expect((await getTerm(termId)).name).toBe(`${tag} Renamed`);
	});

	it('update: empty dates and SIS ID are cleared; an empty name is not sent', async () => {
		await runOk({
			resource: 'enrollmentTerm',
			operation: 'update',
			params: { accountId: account, termId, updateFields: { startAt: '', endAt: '', sisTermId: '', name: '' } },
		});
		expect(await getTerm(termId)).toMatchObject({ start_at: null, end_at: null, sis_term_id: null, name: `${tag} Renamed` });
	});

	it('update: inverted dates and an observer override are refused with Canvas\' message', async () => {
		const before = await getTerm(termId);
		const cases: Array<[Json, RegExp | undefined]> = [
			[{ accountId: account, termId, updateFields: { startAt: '2031-06-01T00:00:00Z', endAt: '2031-01-01T00:00:00Z' } }, undefined],
			[{ accountId: account, termId, overrides: { override: [{ enrollmentType: '={{ "ObserverEnrollment" }}', endAt: '2031-07-15T00:00:00Z' }] } }, /Invalid enrollment type in overrides/],
		];
		for (const [params, message] of cases) {
			const result = await runNode({
				resource: 'enrollmentTerm',
				operation: 'update',
				params: { ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, JSON.stringify(params)).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollmentTerm', operation: 'update' });
			if (message) expect(String(result.error[0].errorMessage)).toMatch(message);
		}
		const after = await getTerm(termId);
		expect([after.name, after.start_at, after.end_at, after.overrides]).toEqual([before.name, before.start_at, before.end_at, before.overrides]);
	});

	it('sub-accounts: listing is refused with a clear message; a write is refused too and changes nothing', async () => {
		const list = await runNode({
			resource: 'enrollmentTerm',
			operation: 'getAll',
			params: { accountId: fx('subAccountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(list.success).toEqual([]);
		expect(list.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'enrollmentTerm', operation: 'getAll' });
		expect(String(list.error[0].errorMessage)).toContain('root_accounts');

		// For writes Canvas does not answer with an API error but redirects away from the
		// sub-account. The node does not follow a redirect on a write: it reports the
		// redirect itself as the failure, and the term is untouched.
		const before = await getTerm(termId);
		const write = await runNode({
			resource: 'enrollmentTerm',
			operation: 'update',
			params: { accountId: fx('subAccountId'), termId, updateFields: { name: 'Sub-account' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(write.success).toEqual([]);
		expect(write.error).toHaveLength(1);
		expect(write.error[0]).toMatchObject({ errorCode: 302, operation: 'update' });
		expect(String(write.error[0].errorMessage)).toMatch(/redirect \(HTTP 302\)/);
		expect((await getTerm(termId)).name).toBe(before.name);
	});

	it('delete: marks the terms as deleted, for several input items', async () => {
		const [first, second] = bulkIds;
		const result = await runNode({
			resource: 'enrollmentTerm',
			operation: 'delete',
			items: [{ term: first }, { term: 99999999 }, { term: second }],
			params: { accountId: account, termId: '={{ $json.term }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((t) => [t.id, t.workflow_state])).toEqual([[first, 'deleted'], [second, 'deleted']]);
		expect(result.rawSuccess.map((t) => (t.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'enrollmentTerm', operation: 'delete' });

		expect((await getTerm(String(first))).workflow_state).toBe('deleted');
		const active = (await listTerms(`term_name=${encodeURIComponent(`${tag} Bulk`)}`)).map((t) => t.id);
		expect(active).not.toContain(first);
		expect(active).not.toContain(second);
		expect(active).toHaveLength(10);

		// A deleted term can no longer be changed.
		const update = await runNode({
			resource: 'enrollmentTerm',
			operation: 'update',
			params: { accountId: account, termId: String(first), updateFields: { name: 'Zombie' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(update.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('errors: teachers may not manage terms', async () => {
		for (const [operation, params] of [
			['create', { name: `${tag} Forbidden` }],
			['delete', { termId }],
		] as const) {
			const result = await runNode({
				resource: 'enrollmentTerm',
				operation,
				persona: 'teacher',
				params: { accountId: account, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'enrollmentTerm', operation });
			expect([401, 403]).toContain(result.error[0].errorCode);
		}
		expect((await getTerm(termId)).workflow_state).toBe('active');
		expect((await listTerms(`term_name=${encodeURIComponent(`${tag} Forbidden`)}`))).toEqual([]);
	});
});
