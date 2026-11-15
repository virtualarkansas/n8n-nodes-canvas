import { crc32 } from 'node:zlib';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { failureText, pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';
import { loadState } from '../lib/state';

/**
 * Resource: sisImport. Real CSV and zip imports through the node.
 *
 * Safety on the shared Canvas:
 *  - every imported record carries a SIS ID invented here (prefix "n8nbat_"),
 *  - batch mode is never sent to Canvas: its parameters are only checked on the
 *    request the node would send (debug mode),
 *  - the imports run on the Site Admin account, a separate root account, so
 *    aborting imports cannot hit the imports of the seed loader on the root
 *    account everyone else works in.
 */

/** A zip archive with stored (uncompressed) entries. */
function zip(files: Record<string, string>): Buffer {
	const local: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const [name, text] of Object.entries(files)) {
		const data = Buffer.from(text, 'utf8');
		const nameBytes = Buffer.from(name, 'utf8');
		const header = Buffer.alloc(30);
		header.writeUInt32LE(0x04034b50, 0);
		header.writeUInt16LE(20, 4);
		header.writeUInt16LE(0x0800, 6);
		header.writeUInt32LE(crc32(data), 14);
		header.writeUInt32LE(data.length, 18);
		header.writeUInt32LE(data.length, 22);
		header.writeUInt16LE(nameBytes.length, 26);
		local.push(header, nameBytes, data);
		const entry = Buffer.alloc(46);
		entry.writeUInt32LE(0x02014b50, 0);
		entry.writeUInt16LE(20, 4);
		entry.writeUInt16LE(20, 6);
		entry.writeUInt16LE(0x0800, 8);
		entry.writeUInt32LE(crc32(data), 16);
		entry.writeUInt32LE(data.length, 20);
		entry.writeUInt32LE(data.length, 24);
		entry.writeUInt16LE(nameBytes.length, 28);
		entry.writeUInt32LE(offset, 42);
		central.push(entry, nameBytes);
		offset += 30 + nameBytes.length + data.length;
	}
	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(Object.keys(files).length, 8);
	end.writeUInt16LE(Object.keys(files).length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...local, directory, end]);
}

const USERS_HEADER = 'user_id,login_id,first_name,last_name,email,status';

// Canvas imports one file at a time and takes its time: several imports in a test need more
// than the default three minutes.
vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });

describe('sisImport', () => {
	const account = fx('siteAdminAccountId');
	const tag = `n8nbat_${unique('si').replace(/[^a-z0-9]/gi, '')}`;
	const sis = (name: string): string => `${tag}_${name}`;
	/** Every user this file invents, so all of them can be removed again at the end. */
	const invented = new Set<string>();
	const userRow = (name: string, first: string, last: string, status = 'active'): string => {
		invented.add(name);
		return `${sis(name)},${sis(name)}@example.edu,${first},${last},${sis(name)}@example.edu,${status}`;
	};
	const usersCsv = (...rows: string[]): string => `${[USERS_HEADER, ...rows].join('\n')}\n`;
	const importsCreated: string[] = [];
	const extraUsers: string[] = [];

	const getImport = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/accounts/${account}/sis_imports/${id}`);
	const allImports = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/accounts/${account}/sis_imports${query}`, 'sis_imports');
	/** The user with an invented SIS ID, as the admin API of the sandbox account shows it. */
	const findUser = async (name: string): Promise<Json | undefined> => {
		const found = await canvas().getAll<Json>(
			`/api/v1/accounts/${account}/users?search_term=${encodeURIComponent(sis(name))}&include[]=email`,
		);
		return found.find((u) => u.sis_user_id === sis(name));
	};
	const logins = (userId: unknown): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${String(userId)}/logins`);

	const FINISHED = ['imported', 'imported_with_messages', 'failed', 'failed_with_messages', 'aborted'];

	/** Start an import through the node. */
	const startImport = async (fileContent: string, additionalFields: Json = {}, extra: Json = {}): Promise<Json> => {
		const [created] = await runOk({
			resource: 'sisImport',
			operation: 'create',
			params: { accountId: account, fileSource: 'text', fileContent, additionalFields, ...extra },
		});
		importsCreated.push(String(created.id));
		return created;
	};

	/** Wait for an import to finish, polling with the node's Get operation. */
	const waitFor = async (id: unknown): Promise<Json> => {
		for (let attempt = 0; attempt < 150; attempt++) {
			const [current] = await runOk({
				resource: 'sisImport',
				operation: 'get',
				params: { accountId: account, importId: String(id) },
			});
			if (FINISHED.includes(String(current.workflow_state))) return current;
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
		throw new Error(`SIS import ${String(id)} did not finish`);
	};
	const importAndWait = async (fileContent: string, additionalFields: Json = {}, extra: Json = {}): Promise<Json> =>
		waitFor((await startImport(fileContent, additionalFields, extra)).id);

	/** Upload a file directly (the file is the request body), for set-up and clean-up. */
	const uploadDirectly = async (csv: string): Promise<Json> => {
		const state = loadState();
		const res = await fetch(`${state.canvas.url}/api/v1/accounts/${account}/sis_imports?extension=csv`, {
			method: 'POST',
			headers: { authorization: `Bearer ${state.canvas.tokens.admin}`, 'content-type': 'text/csv' },
			body: csv,
		});
		if (!res.ok) throw new Error(`could not start the SIS import: ${res.status}`);
		return (await res.json()) as Json;
	};
	const waitDirectly = async (id: unknown): Promise<Json> => {
		for (let attempt = 0; attempt < 300; attempt++) {
			const current = await getImport(String(id));
			if (FINISHED.includes(String(current.workflow_state))) return current;
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
		throw new Error(`SIS import ${String(id)} did not finish`);
	};
	const counts = (finished: Json): Json => (finished.data as Json).counts as Json;

	afterAll(async () => {
		// Nothing may be left waiting, then remove every record this file invented with one last
		// import (users restored by "restore states" are not listed for the account any more, so
		// deleting through the API would miss them).
		await canvas().request('PUT', `/api/v1/accounts/${account}/sis_imports/abort_all_pending`);
		if (invented.size > 0) {
			const rows = [...invented].map((name) => `${sis(name)},${sis(name)}@example.edu,x,x,,deleted`);
			const cleanup = await uploadDirectly(usersCsv(...rows));
			await waitDirectly(cleanup.id);
		}
		// A user whose status became sticky (Add SIS Stickiness) is left alone by that import.
		const leftovers = await canvas().getAll<Json>(`/api/v1/accounts/${account}/users?search_term=${tag}`);
		for (const user of leftovers) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${String(user.id)}`);
		}
		for (const id of extraUsers) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
		const subAccounts = await canvas().getAll<Json>(`/api/v1/accounts/${account}/sub_accounts?recursive=true`);
		for (const subAccount of subAccounts.filter((a) => String(a.sis_account_id ?? '').startsWith(tag))) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/sub_accounts/${String(subAccount.id)}`);
		}
	}, 900_000);

	// ------------------------------------------------------------------ create

	it('create: imports CSV text; unicode, quoted fields and Windows line ends survive', async () => {
		const csv =
			'﻿' +
			[
				USERS_HEADER,
				userRow('u1', 'Zoë', 'Ünïcødé 测试'),
				`${sis('u2')},${sis('u2')}@example.edu,"Anne-Marie ""Annie""","O'Neil, Jr.",${sis('u2')}@example.edu,active`,
				userRow('u3', 'محمد', 'الهاشمي'),
			].join('\r\n') +
			'\r\n';
		const created = await startImport(csv);
		expect(created).toMatchObject({ workflow_state: 'created', progress: 0 });
		expect((created.data as Json).import_type).toBe('instructure_csv');

		const finished = await waitFor(created.id);
		expect(finished).toMatchObject({ id: created.id, workflow_state: 'imported', progress: 100 });
		expect(counts(finished)).toMatchObject({ users: 3, error_count: 0, warning_count: 0 });
		// Canvas stored the request body as a CSV file.
		const attachments = (await getImport(String(created.id))).csv_attachments as Json[];
		expect(attachments[0]).toMatchObject({ display_name: 'sis_import.csv', 'content-type': 'text/csv' });

		expect(await findUser('u1')).toMatchObject({ name: 'Zoë Ünïcødé 测试', login_id: `${sis('u1')}@example.edu` });
		expect(await findUser('u2')).toMatchObject({ name: 'Anne-Marie "Annie" O\'Neil, Jr.' });
		expect(await findUser('u3')).toMatchObject({ name: 'محمد الهاشمي', sis_import_id: created.id });
	});

	it('create: the non-destructive options reach Canvas', async () => {
		const series = sis('series_options');
		const created = await startImport(usersCsv(userRow('opt1', 'Option', 'One')), {
			extension: 'csv',
			import_type: 'instructure_csv',
			override_sis_stickiness: true,
			add_sis_stickiness: true,
			clear_sis_stickiness: false,
			skip_deletes: true,
			update_sis_id_if_login_claimed: true,
			change_threshold: 75,
			diff_row_count_threshold: 500,
			diffing_data_set_identifier: series,
			diffing_remaster_data_set: true,
			diffing_drop_status: 'inactive',
			diffing_user_remove_status: 'suspended',
		});
		const expected = {
			override_sis_stickiness: true,
			add_sis_stickiness: true,
			skip_deletes: true,
			update_sis_id_if_login_claimed: true,
			change_threshold: 75,
			diff_row_count_threshold: 500,
			diffing_data_set_identifier: series,
			diffing_remaster: true,
			diffing_drop_status: 'inactive',
			diffing_user_remove_status: 'suspended',
			batch_mode: null,
			batch_mode_term_id: null,
			multi_term_batch_mode: null,
		};
		expect(created).toMatchObject(expected);
		const finished = await waitFor(created.id);
		expect(finished.workflow_state).toBe('imported');
		expect(await getImport(String(created.id))).toMatchObject(expected);
		expect(await findUser('opt1')).toBeDefined();

		// Switched off, or left at "no threshold", nothing is set. (The batch-mode switches are
		// deliberately absent from every request that really goes to Canvas.)
		const plain = await startImport(usersCsv(userRow('opt1', 'Option', 'One')), {
			override_sis_stickiness: false,
			skip_deletes: false,
			update_sis_id_if_login_claimed: false,
			diffing_remaster_data_set: false,
			change_threshold: 0,
			diff_row_count_threshold: 0,
		});
		expect(plain).toMatchObject({
			override_sis_stickiness: null,
			skip_deletes: false,
			update_sis_id_if_login_claimed: false,
			batch_mode: null,
			multi_term_batch_mode: null,
			change_threshold: null,
			diff_row_count_threshold: null,
			diffing_data_set_identifier: null,
		});
		await waitFor(plain.id);
	});

	it('create: batch-mode options are built correctly (checked on the request only, never sent)', async () => {
		const debug = async (additionalFields: Json): Promise<Json> => {
			const result = await runNode({
				resource: 'sisImport',
				operation: 'create',
				params: { debugMode: true, accountId: account, fileSource: 'text', fileContent: usersCsv(), additionalFields },
			});
			expect(result.success).toEqual([]);
			expect(result.debug).toHaveLength(1);
			return result.debug[0];
		};

		const full = await debug({
			batch_mode: true,
			batch_mode_term_id: 'sis_term_id:n8nbat_term',
			batch_mode_enrollment_drop_status: 'inactive',
			multi_term_batch_mode: true,
			change_threshold: 10,
		});
		expect(full.method).toBe('POST');
		expect(String(full.url)).toContain(`/api/v1/accounts/${account}/sis_imports?`);
		expect(full.queryString).toEqual({
			extension: 'csv',
			batch_mode: true,
			batch_mode_term_id: 'sis_term_id:n8nbat_term',
			batch_mode_enrollment_drop_status: 'inactive',
			multi_term_batch_mode: true,
			change_threshold: 10,
		});

		// Canvas switches batch mode on as soon as multi_term_batch_mode is present, whatever its
		// value, so "off" must not be sent at all.
		const off = await debug({ multi_term_batch_mode: false, batch_mode: false });
		expect(off.queryString).toEqual({ extension: 'csv', batch_mode: false });
		expect(String(off.url)).not.toContain('multi_term_batch_mode');

		const bare = await debug({});
		expect(bare.queryString).toEqual({ extension: 'csv' });
	});

	it('create: Skip Deletes keeps a user the file marks as deleted', async () => {
		const skipped = await importAndWait(usersCsv(userRow('u1', 'Zoë', 'Ünïcødé 测试', 'deleted')), { skip_deletes: true });
		expect(skipped.skip_deletes).toBe(true);
		const user = (await findUser('u1'))!;
		expect((await logins(user.id)).map((l) => l.workflow_state)).toEqual(['active']);
	});

	it('create: values changed by hand are sticky unless Override SIS Stickiness is on', async () => {
		const user = (await findUser('u2'))!;
		await canvas().put(`/api/v1/users/${String(user.id)}`, { user: { name: 'Renamed By Hand' } });

		// A plain import leaves the hand-made change alone ...
		await importAndWait(usersCsv(userRow('u2', 'From', 'SIS')));
		expect((await findUser('u2'))!.name).toBe('Renamed By Hand');

		// ... the override replaces it and, with Clear SIS Stickiness, later imports may change it again.
		const overriding = await importAndWait(usersCsv(userRow('u2', 'From', 'SIS')), {
			override_sis_stickiness: true,
			clear_sis_stickiness: true,
		});
		expect(overriding).toMatchObject({ override_sis_stickiness: true, clear_sis_stickiness: true });
		expect((await findUser('u2'))!.name).toBe('From SIS');
		await importAndWait(usersCsv(userRow('u2', 'Again', 'SIS')));
		expect((await findUser('u2'))!.name).toBe('Again SIS');

		// With Add SIS Stickiness the imported value itself becomes sticky.
		await importAndWait(usersCsv(userRow('u2', 'Sticky', 'Import')), {
			override_sis_stickiness: true,
			add_sis_stickiness: true,
		});
		await importAndWait(usersCsv(userRow('u2', 'Ignored', 'Later')));
		expect((await findUser('u2'))!.name).toBe('Sticky Import');
	});

	it('create: Update SIS ID If Login Claimed moves a login that another SIS ID holds', async () => {
		const login = `${sis('claimed')}@example.edu`;
		const existing = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name: 'Existing With Another SIS ID', skip_registration: true },
			pseudonym: { unique_id: login, sis_user_id: sis('claimed_old'), send_confirmation: false },
		});
		extraUsers.push(String(existing.id));
		const row = `${sis('claimed_new')},${login},Claimed,Login,${login},active`;

		// Without the option the row is refused: the login belongs to another SIS ID.
		const refused = await importAndWait(usersCsv(row));
		expect(refused.workflow_state).toBe('imported_with_messages');
		expect(counts(refused).users).toBe(0);
		expect((await logins(existing.id))[0].sis_user_id).toBe(sis('claimed_old'));

		const claimed = await importAndWait(usersCsv(row), { update_sis_id_if_login_claimed: true });
		expect(claimed.update_sis_id_if_login_claimed).toBe(true);
		expect((await logins(existing.id))[0].sis_user_id).toBe(sis('claimed_new'));
	});

	it('create: diffing applies only the difference to the previous import of the series', async () => {
		const series = sis('series_diff');
		const first = await importAndWait(
			usersCsv(userRow('d1', 'Diff', 'One'), userRow('d2', 'Diff', 'Two')),
			{ diffing_data_set_identifier: series },
		);
		expect(first).toMatchObject({ workflow_state: 'imported', diffing_data_set_identifier: series });
		expect(counts(first).users).toBe(2);

		// The second file no longer has d2: Canvas removes it, here by suspending the login.
		const second = await importAndWait(usersCsv(userRow('d1', 'Diff', 'One')), {
			diffing_data_set_identifier: series,
			diffing_user_remove_status: 'suspended',
		});
		expect(second).toMatchObject({
			workflow_state: 'imported',
			diffing_user_remove_status: 'suspended',
			diffing_threshold_exceeded: false,
		});
		// Canvas keeps the generated difference next to the uploaded file.
		expect(((await getImport(String(second.id))).diffed_csv_attachments as Json[]).length).toBeGreaterThan(0);
		const removed = (await findUser('d2'))!;
		expect((await logins(removed.id)).map((l) => l.workflow_state)).toEqual(['suspended']);
		const kept = (await findUser('d1'))!;
		expect((await logins(kept.id)).map((l) => l.workflow_state)).toEqual(['active']);
	});

	it('create: binary files from a previous node: a CSV, a zip and a file without a name, each recognised', async () => {
		const result = await runNode({
			resource: 'sisImport',
			operation: 'create',
			// Binary File is the default File Source, "data" the default property.
			params: { accountId: account },
			binary: [
				{ fileName: 'users.csv', mimeType: 'text/csv', b64: Buffer.from(usersCsv(userRow('b1', 'Binary', 'Csv'))).toString('base64') },
				{
					fileName: 'district export.ZIP',
					mimeType: 'application/octet-stream',
					b64: zip({ 'users.csv': usersCsv(userRow('b2', 'Binary', 'Zip')) }).toString('base64'),
				},
				// Neither a name nor a telling type: treated as CSV.
				{ b64: Buffer.from(usersCsv(userRow('b3', 'Binary', 'Nameless'))).toString('base64') },
			],
		});
		expect(result.failure).toBeUndefined();
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(3);
		for (const created of result.success) importsCreated.push(String(created.id));
		for (const created of result.success) {
			const finished = await waitFor(created.id);
			expect(finished.workflow_state).toBe('imported');
			expect(counts(finished)).toMatchObject({ users: 1 });
		}
		expect(((await getImport(String(result.success[1].id))).csv_attachments as Json[]).map((a) => a.display_name)).toEqual(['users.csv']);
		for (const name of ['b1', 'b2', 'b3']) expect(await findUser(name), name).toBeDefined();

		// The request, as debug mode shows it: the file is described, not printed.
		const debug = await runNode({
			resource: 'sisImport',
			operation: 'create',
			params: { debugMode: true, accountId: account, binaryPropertyName: 'upload' },
			binary: [{ property: 'upload', fileName: 'terms.xml', mimeType: 'application/xml', b64: Buffer.from('<x/>').toString('base64') }],
		});
		expect(String(debug.debug[0].url)).toContain('extension=xml');
		expect(String(debug.debug[0].curl)).toContain("-H 'Content-Type: text/xml'");
		expect(String(debug.debug[0].curl)).toContain('--data-binary \'@<binary property "upload": terms.xml>\'');

		// An item without the binary property fails on its own.
		const missing = await runNode({
			resource: 'sisImport',
			operation: 'create',
			params: { accountId: account, errorHandling: { onError: 'continueWithError' } },
			binary: [{ json: { note: 'no file here' } }],
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 0, operation: 'create' });
		expect((missing.error[0].originalItem as Json).note).toBe('no file here');
	});

	it('waitForCompletion: several imports are waited for in one run; the final states come back', async () => {
		const first = await startImport(usersCsv(userRow('w1', 'Wait', 'One')));
		const second = await startImport('this,is,not\na,sis,file\n');
		const result = await runNode({
			resource: 'sisImport',
			operation: 'waitForCompletion',
			items: [{ id: first.id }, { id: second.id }, { id: 999999999 }],
			params: {
				accountId: account,
				importId: '={{ $json.id }}',
				pollInterval: 2,
				timeout: 600,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(pairedItems(result)).toEqual([0, 1]);
		expect(result.success[0]).toMatchObject({ id: first.id, workflow_state: 'imported', progress: 100 });
		expect(counts(result.success[0])).toMatchObject({ users: 1 });
		expect(result.success[1].id).toBe(second.id);
		expect(String(result.success[1].workflow_state)).toMatch(/^failed/);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'waitForCompletion' });
		expect(await findUser('w1')).toBeDefined();
	});

	it('create: a zip file as Base64, from several items', async () => {
		const archive = zip({
			'accounts.csv': `account_id,parent_account_id,name,status\n${sis('acct')},,Battery SIS sub-account 部门,active\n`,
			'users.csv': usersCsv(userRow('z1', 'Zip', 'One'), userRow('z2', 'Zip', 'Two')),
		});
		const result = await runOk({
			resource: 'sisImport',
			operation: 'create',
			items: [{ file: archive.toString('base64') }, { file: zip({ 'users.csv': usersCsv(userRow('z3', 'Zip', 'Three')) }).toString('base64') }],
			params: { accountId: account, fileSource: 'base64', fileContent: '={{ $json.file }}' },
		});
		expect(result).toHaveLength(2);
		for (const created of result) importsCreated.push(String(created.id));

		const first = await waitFor(result[0].id);
		expect(first.workflow_state).toBe('imported');
		expect(counts(first)).toMatchObject({ accounts: 1, users: 2 });
		// Canvas unpacked the archive: the import lists the CSV files that were in it.
		const unpacked = ((await getImport(String(result[0].id))).csv_attachments as Json[]).map((a) => a.display_name);
		expect(unpacked.sort()).toEqual(['accounts.csv', 'users.csv']);
		expect((await waitFor(result[1].id)).workflow_state).toBe('imported');

		const subAccounts = await canvas().getAll<Json>(`/api/v1/accounts/${account}/sub_accounts`);
		expect(subAccounts.find((a) => a.sis_account_id === sis('acct'))).toMatchObject({ name: 'Battery SIS sub-account 部门' });
		expect(await findUser('z1')).toBeDefined();
		expect(await findUser('z3')).toBeDefined();
	});

	it('create: a file Canvas cannot use ends as a failed import; its messages are on the import', async () => {
		const unusable = await importAndWait('this,is,not\na,sis,file\n');
		expect(unusable.workflow_state).toBe('failed_with_messages');
		expect(Number(counts(unusable).error_count)).toBeGreaterThan(0);
		expect(((await getImport(String(unusable.id))).processing_errors as unknown[]).length).toBeGreaterThan(0);

		// Rows with problems do not stop the rest of the file.
		const partly = await importAndWait(
			usersCsv(userRow('ok1', 'Fine', 'Row'), `${sis('bad1')},,No,Login,,active`),
		);
		expect(partly.workflow_state).toBe('imported_with_messages');
		expect(counts(partly).users).toBe(1);
		expect(await findUser('ok1')).toBeDefined();
		expect(await findUser('bad1')).toBeUndefined();
	});

	it('create: empty content, bad Base64, a sub-account and a teacher are refused', async () => {
		const before = (await allImports()).length;

		const empty = await runNode({
			resource: 'sisImport',
			operation: 'create',
			items: [{ csv: '   ' }],
			params: { accountId: account, fileSource: 'text', fileContent: '={{ $json.csv }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.success).toEqual([]);
		expect(failureText(empty)).toMatch(/File Content is empty/);

		const badBase64 = await runNode({
			resource: 'sisImport',
			operation: 'create',
			params: {
				accountId: account,
				fileSource: 'base64',
				fileContent: usersCsv(userRow('never', 'Never', 'Imported')),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badBase64.success).toEqual([]);
		expect(failureText(badBase64)).toMatch(/not valid Base64/);

		const subAccount = await runNode({
			resource: 'sisImport',
			operation: 'create',
			params: {
				accountId: fx('subAccountId'),
				fileSource: 'text',
				fileContent: usersCsv(userRow('never', 'Never', 'Imported')),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(subAccount.success).toEqual([]);
		expect([400, 401, 403]).toContain(subAccount.error[0].errorCode);

		const asTeacher = await runNode({
			resource: 'sisImport',
			operation: 'create',
			persona: 'teacher',
			params: {
				accountId: fx('accountId'),
				fileSource: 'text',
				fileContent: usersCsv(userRow('never', 'Never', 'Imported')),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');

		expect((await allImports()).length).toBe(before);
		expect(await findUser('never')).toBeUndefined();
	});

	// --------------------------------------------------------------------- get

	it('get: returns the import with its counts; several items keep their pairing', async () => {
		const id = importsCreated[0];
		const [single] = await runOk({ resource: 'sisImport', operation: 'get', params: { accountId: account, importId: id } });
		const actual = await getImport(id);
		expect(single).toMatchObject({
			id: Number(id),
			workflow_state: 'imported',
			created_at: actual.created_at,
			ended_at: actual.ended_at,
		});
		expect(counts(single).users).toBe(3);
		expect((single.user as Json).id).toBe(Number(fx('adminUserId')));

		const mixed = await runNode({
			resource: 'sisImport',
			operation: 'get',
			items: [{ id: Number(importsCreated[1]) }, { id: 99999999 }, { id: importsCreated[2] }],
			params: { accountId: account, importId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(mixed.success.map((i) => String(i.id))).toEqual([importsCreated[1], importsCreated[2]]);
		expect(pairedItems(mixed)).toEqual([0, 2]);
		expect(mixed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'sisImport', operation: 'get' });

		// An import belongs to one root account: it is not found under another one.
		const elsewhere = await runNode({
			resource: 'sisImport',
			operation: 'get',
			params: { accountId: fx('accountId'), importId: id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(elsewhere.success).toEqual([]);
		expect(elsewhere.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: one item per import, newest first, across pages', async () => {
		const expected = await allImports();
		expect(expected.length, 'this file alone starts more imports than one page holds').toBeGreaterThan(10);

		const all = await runOk({
			resource: 'sisImport',
			operation: 'getAll',
			params: { accountId: account, pagination: { returnAll: true } },
		});
		expect(all.map((i) => i.id)).toEqual(expected.map((i) => i.id));
		// The { sis_imports: [...] } wrapper is unwrapped.
		expect(all[0].sis_imports).toBeUndefined();
		expect(all[0].workflow_state).toBeTypeOf('string');
		expect(all.map((i) => Number(i.id))).toEqual([...all.map((i) => Number(i.id))].sort((a, b) => b - a));

		const defaults = await runOk({ resource: 'sisImport', operation: 'getAll', params: { accountId: account } });
		expect(defaults).toHaveLength(Math.min(expected.length, 50));

		const paged = await runOk({
			resource: 'sisImport',
			operation: 'getAll',
			params: { accountId: account, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(paged.map((i) => i.id)).toEqual(expected.slice(0, 8).map((i) => i.id));
	});

	it('getAll: filters by state and by creation time', async () => {
		const failed = await runOk({
			resource: 'sisImport',
			operation: 'getAll',
			params: {
				accountId: account,
				options: { workflow_state: ['failed_with_messages', 'imported_with_messages'] },
				pagination: { returnAll: true },
			},
		});
		const expectedFailed = await allImports('?workflow_state[]=failed_with_messages&workflow_state[]=imported_with_messages');
		expect(failed.map((i) => i.id)).toEqual(expectedFailed.map((i) => i.id));
		expect(failed.length).toBeGreaterThan(0);
		expect(failed.every((i) => ['failed_with_messages', 'imported_with_messages'].includes(String(i.workflow_state)))).toBe(true);

		const everything = await allImports();
		const pivot = String(everything[5].created_at);
		const since = await runOk({
			resource: 'sisImport',
			operation: 'getAll',
			params: { accountId: account, options: { created_since: pivot }, pagination: { returnAll: true } },
		});
		const expectedSince = await allImports(`?created_since=${encodeURIComponent(pivot)}`);
		expect(since.map((i) => i.id)).toEqual(expectedSince.map((i) => i.id));
		expect(since.length).toBeLessThan(everything.length);
		expect(since.every((i) => Date.parse(String(i.created_at)) >= Date.parse(pivot))).toBe(true);

		const before = await runOk({
			resource: 'sisImport',
			operation: 'getAll',
			params: { accountId: account, options: { created_before: pivot }, pagination: { returnAll: true } },
		});
		const expectedBefore = await allImports(`?created_before=${encodeURIComponent(pivot)}`);
		expect(before.map((i) => i.id)).toEqual(expectedBefore.map((i) => i.id));
		expect(before.every((i) => Date.parse(String(i.created_at)) <= Date.parse(pivot))).toBe(true);

		const none = await runNode({
			resource: 'sisImport',
			operation: 'getAll',
			params: { accountId: account, options: { created_before: '2020-01-01T00:00:00Z' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);

		const asTeacher = await runNode({
			resource: 'sisImport',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountId: fx('accountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// ----------------------------------------------------------- restoreStates

	it('restoreStates: undoes the deletions of an import', async () => {
		const user = (await findUser('u3'))!;
		const deleting = await importAndWait(usersCsv(userRow('u3', 'محمد', 'الهاشمي', 'deleted')));
		expect(deleting.workflow_state).toBe('imported');
		expect(await findUser('u3')).toBeUndefined();
		expect(await logins(user.id)).toEqual([]);

		const [progress] = await runOk({
			resource: 'sisImport',
			operation: 'restoreStates',
			params: {
				accountId: account,
				importId: String(deleting.id),
				options: { undelete_only: true, unconclude_only: false, batch_mode: false },
			},
		});
		expect(progress).toMatchObject({ context_type: 'SisBatch', context_id: deleting.id, tag: 'sis_batch_state_restore' });

		let state = '';
		for (let attempt = 0; attempt < 60 && state !== 'completed'; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			state = String((await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`)).workflow_state);
			expect(state).not.toBe('failed');
		}
		expect(state).toBe('completed');
		// The login is back, with its SIS ID.
		const restored = await logins(user.id);
		expect(restored.map((l) => [l.workflow_state, l.sis_user_id])).toEqual([['active', sis('u3')]]);
		expect(['restored', 'partially_restored']).toContain((await getImport(String(deleting.id))).workflow_state);
	});

	it('restoreStates: contradictory options and unknown imports are errors', async () => {
		const id = importsCreated[0];
		const both = await runNode({
			resource: 'sisImport',
			operation: 'restoreStates',
			items: [{ id }, { id: '99999999' }],
			params: {
				accountId: account,
				importId: '={{ $json.id }}',
				options: { undelete_only: true, unconclude_only: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(both.success).toEqual([]);
		expect(both.error).toHaveLength(2);
		const contradictory = both.error.find((e) => (e.originalItem as Json).id === id)!;
		expect(contradictory).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'restoreStates' });
		expect(String(contradictory.errorMessage)).toContain('cannot set both undelete_only and unconclude_only');
		const unknown = both.error.find((e) => (e.originalItem as Json).id === '99999999')!;
		expect(unknown).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	// ------------------------------------------- getCurrent / abort / abortAllPending

	it('getCurrent, abort and abortAllPending: while one import runs, the waiting ones can be aborted', async () => {
		// Nothing is being imported: no items.
		const idle = await runNode({ resource: 'sisImport', operation: 'getCurrent', params: { accountId: account } });
		expect(idle.ok).toBe(true);
		expect(idle.success).toEqual([]);

		// A file with enough new users to keep Canvas busy for a while; the imports of an account
		// run one at a time, so the ones uploaded after it have to wait. (Uploaded directly: this
		// test is about what happens to imports that already exist.)
		const BUSY = 120;
		const busyRows = Array.from({ length: BUSY }, (_, i) => userRow(`busy${i}`, 'Busy', `User ${i}`));
		const busy = await uploadDirectly(usersCsv(...busyRows));
		const waiting = [
			await uploadDirectly(usersCsv(userRow('w1', 'Waiting', 'One'))),
			await uploadDirectly(usersCsv(userRow('w2', 'Waiting', 'Two'))),
			await uploadDirectly(usersCsv(userRow('w3', 'Waiting', 'Three'))),
		];

		// Wait until the first import is being processed.
		let current: Json[] = [];
		for (let attempt = 0; attempt < 60 && current.length === 0; attempt++) {
			current = await runOk({ resource: 'sisImport', operation: 'getCurrent', params: { accountId: account } });
			if (current.length === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		expect(current.map((i) => i.id)).toEqual([busy.id]);
		expect(current[0].workflow_state).toBe('importing');
		expect(current[0].sis_imports).toBeUndefined();

		// Abort one waiting import.
		const [aborted] = await runOk({
			resource: 'sisImport',
			operation: 'abort',
			params: { accountId: account, importId: String(waiting[0].id) },
		});
		expect(aborted).toMatchObject({ id: waiting[0].id, workflow_state: 'aborted' });
		expect((await getImport(String(waiting[0].id))).workflow_state).toBe('aborted');

		// Abort everything that has not started; the running import is left alone.
		const [result] = await runOk({
			resource: 'sisImport',
			operation: 'abortAllPending',
			params: { accountId: account },
		});
		expect(result).toEqual({ aborted: true });
		expect((await getImport(String(waiting[1].id))).workflow_state).toBe('aborted');
		expect((await getImport(String(waiting[2].id))).workflow_state).toBe('aborted');
		expect(['importing', 'imported']).toContain((await getImport(String(busy.id))).workflow_state);

		const finished = await waitDirectly(busy.id);
		expect(finished.workflow_state).toBe('imported');
		expect(counts(finished).users).toBe(BUSY);
		expect(await findUser('w1')).toBeUndefined();
		expect(await findUser('w2')).toBeUndefined();
		expect(await findUser('w3')).toBeUndefined();

		// A finished or aborted import cannot be aborted (again); neither can an unknown one.
		const again = await runNode({
			resource: 'sisImport',
			operation: 'abort',
			items: [{ id: busy.id }, { id: waiting[0].id }, { id: 99999999 }],
			params: { accountId: account, importId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error).toHaveLength(3);
		for (const error of again.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'sisImport', operation: 'abort' });
		}
	}, 900_000);

	it('abortAllPending: with nothing waiting it still answers; a teacher is refused', async () => {
		const [result] = await runOk({ resource: 'sisImport', operation: 'abortAllPending', params: { accountId: account } });
		expect(result).toEqual({ aborted: true });

		const asTeacher = await runNode({
			resource: 'sisImport',
			operation: 'getCurrent',
			persona: 'teacher',
			params: { accountId: fx('accountId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});
});
