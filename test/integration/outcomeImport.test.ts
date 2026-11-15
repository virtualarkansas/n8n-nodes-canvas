import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { loadState } from '../lib/state';
import { createSandboxAccount, createSandboxCourse, deleteSandboxAccount, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: outcomeImport. Imports run in a sub-account and a course of this
 * file's own. Canvas takes the CSV as the raw request body (or a multipart
 * upload), so the set-up posts it that way directly.
 */
describe('outcomeImport', () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let courseImportId = '';
	let accountImportId = '';
	let failedImportId = '';
	const tag = unique('imp').replace(/\s/g, '-');

	/** An outcomes CSV with awkward content: commas, quotes, percent signs, brackets, HTML and non-ASCII text. */
	const csv = (prefix: string): string =>
		[
			'vendor_guid,object_type,title,description,display_name,calculation_method,calculation_int,workflow_state,parent_guids',
			`${prefix}-g1,group,"Group, with ""quotes"" & 100% [x]=1",<p>Group <b>description</b></p>,,,,active,`,
			`${prefix}-g2,group,Untergruppe Ünïcode 成果,,,,,active,${prefix}-g1`,
			`${prefix}-o1,outcome,"Outcome 1, a=b&c=d",<p>Description with %41 and ünïcode</p>,Friendly name,highest,,active,${prefix}-g1`,
			`${prefix}-o2,outcome,Outcome 2,,,decaying_average,65,active,${prefix}-g2`,
		].join('\n') + '\n';

	const postCsv = async (path: string, body: string): Promise<Json> => {
		const state = loadState();
		const res = await fetch(`${state.canvas.url.replace(/\/$/, '')}${path}?import_type=instructure_csv`, {
			method: 'POST',
			headers: { authorization: `Bearer ${state.canvas.tokens.admin}`, 'content-type': 'text/csv' },
			body,
		});
		const data = (await res.json()) as Json;
		if (res.status >= 400) throw new Error(`Canvas POST ${path} -> ${res.status}: ${JSON.stringify(data)}`);
		return data;
	};
	const waitForImport = async (path: string, id: string | number): Promise<Json> => {
		const started = Date.now();
		for (;;) {
			const status = await canvas().get<Json>(`${path}/outcome_imports/${id}`);
			if (['succeeded', 'failed'].includes(String(status.workflow_state))) return status;
			if (Date.now() - started > 120_000) throw new Error(`Outcome import ${id} still ${String(status.workflow_state)}`);
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	};
	const groupsByGuid = async (path: string): Promise<Map<string, Json>> =>
		new Map((await canvas().getAll<Json>(`${path}/outcome_groups`)).map((g) => [String(g.vendor_guid), g]));

	beforeAll(async () => {
		accountId = await createSandboxAccount('outcome-imports');
		course = await createSandboxCourse('outcome-imports', { accountId, personas: ['teacher', 'student'] });
		courseId = course.id;

		const courseImport = await postCsv(`/api/v1/courses/${courseId}/outcome_imports`, csv(`${tag}-c`));
		courseImportId = String(courseImport.id);
		const accountImport = await postCsv(`/api/v1/accounts/${accountId}/outcome_imports`, csv(`${tag}-a`));
		accountImportId = String(accountImport.id);
		expect((await waitForImport(`/api/v1/courses/${courseId}`, courseImportId)).workflow_state).toBe('succeeded');
		expect((await waitForImport(`/api/v1/accounts/${accountId}`, accountImportId)).workflow_state).toBe('succeeded');
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
		const groups = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/outcome_groups`).catch(() => [] as Json[]);
		for (const group of groups.filter((g) => g.parent_outcome_group && String(g.vendor_guid).endsWith('-g1'))) {
			await canvas().request('DELETE', `/api/v1/accounts/${accountId}/outcome_groups/${String(group.id)}`);
		}
		await deleteSandboxAccount(accountId);
	});

	it('getStatus: course and account context, by ID and as "latest"', async () => {
		const [status] = await runOk({
			resource: 'outcomeImport',
			operation: 'getStatus',
			params: { context: 'course', courseId, importId: Number(courseImportId) },
		});
		expect(status).toMatchObject({
			id: Number(courseImportId),
			workflow_state: 'succeeded',
			progress: 100,
			processing_errors: [],
			data: { import_type: 'instructure_csv' },
		});
		expect(status.user).toMatchObject({ id: expect.any(Number) });

		const [latest] = await runOk({
			resource: 'outcomeImport',
			operation: 'getStatus',
			persona: 'teacher',
			params: { context: 'course', courseId: `sis_course_id:${course.sisId}`, importId: 'latest' },
		});
		expect(latest.id).toBe(Number(courseImportId));

		const [fromAccount] = await runOk({
			resource: 'outcomeImport',
			operation: 'getStatus',
			params: { context: 'account', accountId, importId: accountImportId },
		});
		expect(fromAccount).toMatchObject({ id: Number(accountImportId), workflow_state: 'succeeded' });
	});

	it('getCreatedGroupIds: one item per outcome group the import created', async () => {
		const ids = await runOk({
			resource: 'outcomeImport',
			operation: 'getCreatedGroupIds',
			params: { context: 'course', courseId, importId: courseImportId },
		});
		const groups = await groupsByGuid(`/api/v1/courses/${courseId}`);
		const expected = [String(groups.get(`${tag}-c-g1`)?.id), String(groups.get(`${tag}-c-g2`)?.id)];
		// Canvas answers a plain list of ID strings; the node wraps each one.
		expect(ids.map((item) => item.value).sort()).toEqual(expected.sort());
		expect(groups.get(`${tag}-c-g1`)).toMatchObject({ title: 'Group, with "quotes" & 100% [x]=1' });
		expect(groups.get(`${tag}-c-g2`)).toMatchObject({ title: 'Untergruppe Ünïcode 成果', parent_outcome_group: { id: groups.get(`${tag}-c-g1`)?.id } });

		const fromAccount = await runOk({
			resource: 'outcomeImport',
			operation: 'getCreatedGroupIds',
			params: { context: 'account', accountId: Number(accountId), importId: 'latest' },
		});
		const accountGroups = await groupsByGuid(`/api/v1/accounts/${accountId}`);
		expect(fromAccount.map((item) => item.value).sort()).toEqual(
			[String(accountGroups.get(`${tag}-a-g1`)?.id), String(accountGroups.get(`${tag}-a-g2`)?.id)].sort(),
		);
	});

	it('getStatus / getCreatedGroupIds: an import that failed reports its errors and has no groups', async () => {
		const failed = await postCsv(`/api/v1/courses/${courseId}/outcome_imports`, 'this,is,not\nan,outcomes,file\n');
		failedImportId = String(failed.id);
		await waitForImport(`/api/v1/courses/${courseId}`, failedImportId);

		const [status] = await runOk({
			resource: 'outcomeImport',
			operation: 'getStatus',
			params: { context: 'course', courseId, importId: failedImportId },
		});
		expect(status).toMatchObject({ id: Number(failedImportId), workflow_state: 'failed' });
		expect((status.processing_errors as unknown[]).length).toBeGreaterThan(0);

		const result = await runNode({
			resource: 'outcomeImport',
			operation: 'getCreatedGroupIds',
			params: { context: 'course', courseId, importId: failedImportId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', errorMessage: 'Import has failed' });
	});

	it('create: imports outcomes and groups from CSV text, in a course, an account and into a given group', async () => {
		const [created] = await runOk({
			resource: 'outcomeImport',
			operation: 'create',
			params: { context: 'course', courseId, csvData: csv(`${tag}-n`) },
		});
		expect(created).toMatchObject({ workflow_state: expect.stringMatching(/created|importing|succeeded/), data: { import_type: 'instructure_csv' } });
		expect((await waitForImport(`/api/v1/courses/${courseId}`, created.id as number)).workflow_state).toBe('succeeded');
		const groups = await groupsByGuid(`/api/v1/courses/${courseId}`);
		expect(groups.get(`${tag}-n-g1`)).toMatchObject({ title: 'Group, with "quotes" & 100% [x]=1' });
		const outcomes = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_groups/${String(groups.get(`${tag}-n-g1`)?.id)}/outcomes?outcome_style=full`);
		expect(outcomes.map((l) => (l.outcome as Json).title)).toEqual(['Outcome 1, a=b&c=d']);
		expect(String((outcomes[0].outcome as Json).description)).toContain('%41 and ünïcode');

		// Into a given group of the account.
		const accountGroups = await groupsByGuid(`/api/v1/accounts/${accountId}`);
		const target = String(accountGroups.get(`${tag}-a-g2`)?.id);
		const [intoGroup] = await runOk({
			resource: 'outcomeImport',
			operation: 'create',
			params: {
				context: 'account',
				accountId,
				csvData: `vendor_guid,object_type,title\n${tag}-into,outcome,Imported into a group\n`,
				additionalFields: { learning_outcome_group_id: Number(target) },
			},
		});
		expect((await waitForImport(`/api/v1/accounts/${accountId}`, intoGroup.id as number)).workflow_state).toBe('succeeded');
		const inTarget = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/outcome_groups/${target}/outcomes`);
		expect(inTarget.map((l) => (l.outcome as Json).title)).toContain('Imported into a group');
	});

	it('errors: an unknown import is "not found"; a student may not see or start imports', async () => {
		const missing = await runNode({
			resource: 'outcomeImport',
			operation: 'getStatus',
			params: { context: 'course', courseId, importId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'outcomeImport', operation: 'getStatus' });

		// An import of another context is not found either.
		const foreign = await runNode({
			resource: 'outcomeImport',
			operation: 'getStatus',
			params: { context: 'account', accountId, importId: courseImportId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(foreign.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		for (const operation of ['getStatus', 'getCreatedGroupIds', 'create']) {
			const result = await runNode({
				resource: 'outcomeImport',
				operation,
				persona: 'student',
				params: { context: 'course', courseId, importId: courseImportId, csvData: csv(`${tag}-s`), errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'outcomeImport', operation });
		}
	});
});
