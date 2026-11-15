import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';
import { loadState } from '../lib/state';

/**
 * Resource: sisImportError. Read-only for the node; the errors come from two
 * imports made here that cannot change any record: one whose rows are all
 * refused (rows for invented users without a login) and one file Canvas cannot
 * read at all.
 */

/** Import errors have no ID of their own: import, file, row and message identify one. */
const keys = (errors: Json[]): string[] =>
	errors.map((e) => `${String(e.sis_import_id)}|${String(e.file)}|${String(e.row)}|${String(e.message)}`).sort();

/**
 * The account-wide list grows while other imports run on the shared Canvas: everything that
 * was there before and after must be listed, nothing unknown, nothing twice.
 */
function expectSameErrors(listed: Json[], before: Json[], after: Json[]): void {
	const listedKeys = new Set(keys(listed));
	const beforeKeys = new Set(keys(before));
	const afterKeys = new Set(keys(after));
	expect([...beforeKeys].filter((k) => afterKeys.has(k) && !listedKeys.has(k)), 'errors missing from the node output').toEqual([]);
	expect(
		[...listedKeys].filter((k) => !beforeKeys.has(k) && !afterKeys.has(k)),
		'errors the node returned that Canvas does not list',
	).toEqual([]);
	expect(listedKeys.size, 'duplicates in the node output').toBe(listed.length);
}

describe('sisImportError', () => {
	const account = fx('accountId');
	const tag = `n8nbat_${unique('sie').replace(/[^a-z0-9]/gi, '')}`;
	const ROWS = 12;
	let rowErrorsImport = '';
	let failedImport = '';

	const importErrors = (id: string, query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/accounts/${account}/sis_imports/${id}/errors${query}`, 'sis_import_errors');
	const accountErrors = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/accounts/${account}/sis_import_errors${query}`, 'sis_import_errors');

	/** Upload a file the way Canvas expects it (the file is the request body) and wait for the import. */
	async function importFile(csv: string): Promise<Json> {
		const state = loadState();
		const res = await fetch(`${state.canvas.url}/api/v1/accounts/${account}/sis_imports?extension=csv`, {
			method: 'POST',
			headers: { authorization: `Bearer ${state.canvas.tokens.admin}`, 'content-type': 'text/csv' },
			body: csv,
		});
		if (!res.ok) throw new Error(`could not start the SIS import: ${res.status}`);
		const created = (await res.json()) as Json;
		for (let attempt = 0; attempt < 300; attempt++) {
			const current = await canvas().get<Json>(`/api/v1/accounts/${account}/sis_imports/${String(created.id)}`);
			if (!['initializing', 'created', 'importing', 'cleanup_batch'].includes(String(current.workflow_state))) {
				return current;
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
		throw new Error(`SIS import ${String(created.id)} did not finish`);
	}

	beforeAll(async () => {
		// Users without a login: every row is refused, nothing is created.
		const rows = Array.from({ length: ROWS }, (_, i) => `${tag}_${i},,No,Login ${i},,active`);
		const withRowErrors = await importFile(`user_id,login_id,first_name,last_name,email,status\n${rows.join('\n')}\n`);
		rowErrorsImport = String(withRowErrors.id);
		const failed = await importFile(`${tag},is,not\na,sis,file\n`);
		failedImport = String(failed.id);
		expect(failed.workflow_state).toBe('failed_with_messages');
	}, 900_000);

	// ------------------------------------------------------------------ getAll

	it('getAll: one item per error of the import, across pages', async () => {
		const expected = await importErrors(rowErrorsImport);
		expect(expected).toHaveLength(ROWS);

		const all = await runOk({
			resource: 'sisImportError',
			operation: 'getAll',
			params: { accountId: account, importId: rowErrorsImport, pagination: { returnAll: true } },
		});
		expect(keys(all)).toEqual(keys(expected));
		// The { sis_import_errors: [...] } wrapper is unwrapped.
		expect(all[0].sis_import_errors).toBeUndefined();
		for (const error of all) {
			expect(error).toMatchObject({ sis_import_id: Number(rowErrorsImport), file: 'sis_import.csv' });
			expect(String(error.message)).toContain(tag);
			expect(error.row).toBeTypeOf('number');
			expect(String(error.row_info)).toContain(tag);
		}
		expect(new Set(all.map((e) => e.row)).size).toBe(ROWS);

		const defaults = await runOk({
			resource: 'sisImportError',
			operation: 'getAll',
			params: { accountId: 'self', importId: rowErrorsImport },
		});
		expect(defaults).toHaveLength(ROWS);

		const paged = await runOk({
			resource: 'sisImportError',
			operation: 'getAll',
			items: [{ id: Number(rowErrorsImport) }],
			params: { accountId: account, importId: '={{ $json.id }}', pagination: { perPage: 5, maxPages: 2 } },
		});
		// Canvas sorts these lists by creation time only and the errors of one import share a
		// timestamp, so across small pages a row can show up twice while another is missing.
		// Hence only: two pages of five, all of them errors of this import.
		expect(paged).toHaveLength(10);
		expect(keys(paged).filter((k) => !keys(expected).includes(k))).toEqual([]);
	});

	it('getAll: "Failure Only" keeps the errors that made an import fail', async () => {
		// Refused rows are not failures ...
		const rowFailures = await runNode({
			resource: 'sisImportError',
			operation: 'getAll',
			params: { accountId: account, importId: rowErrorsImport, options: { failure: true } },
		});
		expect(rowFailures.ok).toBe(true);
		expect(rowFailures.success).toEqual([]);

		// ... an unreadable file is.
		const failures = await runOk({
			resource: 'sisImportError',
			operation: 'getAll',
			params: { accountId: account, importId: failedImport, options: { failure: true } },
		});
		expect(keys(failures)).toEqual(keys(await importErrors(failedImport, '?failure=true')));
		expect(failures.length).toBeGreaterThan(0);

		// Switched off it does not filter.
		const unfiltered = await runOk({
			resource: 'sisImportError',
			operation: 'getAll',
			params: { accountId: account, importId: rowErrorsImport, options: { failure: false }, pagination: { returnAll: true } },
		});
		expect(unfiltered).toHaveLength(ROWS);
	});

	it('getAll: several imports, an unknown one in between; a teacher is refused', async () => {
		const result = await runNode({
			resource: 'sisImportError',
			operation: 'getAll',
			items: [{ id: failedImport }, { id: '99999999' }],
			params: { accountId: account, importId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.length).toBeGreaterThan(0);
		expect(result.success.every((e) => e.sis_import_id === Number(failedImport))).toBe(true);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'sisImportError',
			operation: 'getAll',
		});

		const asTeacher = await runNode({
			resource: 'sisImportError',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountId: account, importId: rowErrorsImport, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// --------------------------------------------------------- getAllForAccount

	it('getAllForAccount: the errors of every import of the account, across pages', async () => {
		const before = await accountErrors();
		expect(before.length).toBeGreaterThan(ROWS);

		const all = await runOk({
			resource: 'sisImportError',
			operation: 'getAllForAccount',
			params: { accountId: account, pagination: { returnAll: true } },
		});
		expectSameErrors(all, before, await accountErrors());
		const importsSeen = new Set(all.map((e) => String(e.sis_import_id)));
		expect(importsSeen.has(rowErrorsImport)).toBe(true);
		expect(importsSeen.has(failedImport)).toBe(true);
		expect(all.filter((e) => String(e.sis_import_id) === rowErrorsImport)).toHaveLength(ROWS);

		const defaults = await runOk({
			resource: 'sisImportError',
			operation: 'getAllForAccount',
			params: { accountId: account },
		});
		expect(defaults.length).toBeGreaterThan(10);
		expect(defaults.length).toBeLessThanOrEqual(50);

		const paged = await runOk({
			resource: 'sisImportError',
			operation: 'getAllForAccount',
			params: { accountId: account, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(paged).toHaveLength(10);
		const known = new Set(keys(await accountErrors()));
		expect(keys(paged).filter((k) => !known.has(k))).toEqual([]);
	});

	it('getAllForAccount: "Failure Only" filters across imports', async () => {
		const before = await accountErrors('?failure=true');
		const failures = await runOk({
			resource: 'sisImportError',
			operation: 'getAllForAccount',
			params: { accountId: account, options: { failure: true }, pagination: { returnAll: true } },
		});
		expectSameErrors(failures, before, await accountErrors('?failure=true'));
		const importsSeen = new Set(failures.map((e) => String(e.sis_import_id)));
		expect(importsSeen.has(failedImport)).toBe(true);
		expect(importsSeen.has(rowErrorsImport)).toBe(false);
	});

	it('getAllForAccount: only root accounts have import errors; a teacher is refused', async () => {
		const subAccount = await runNode({
			resource: 'sisImportError',
			operation: 'getAllForAccount',
			params: { accountId: fx('subAccountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(subAccount.success).toEqual([]);
		expect(subAccount.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(subAccount.error[0].errorMessage)).toContain('SIS imports can only be executed on root accounts');

		const asTeacher = await runNode({
			resource: 'sisImportError',
			operation: 'getAllForAccount',
			persona: 'teacher',
			params: { accountId: account, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});
});
