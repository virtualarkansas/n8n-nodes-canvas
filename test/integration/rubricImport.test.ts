import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { waitFor } from './support/commsSandbox';
import { canvas as canvasInChain, csvField, parseCsv, runChain } from './support/fileNodes';
import { createSandboxAccount, createSandboxCourse, deleteSandboxAccount, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: rubric, the CSV import operations (Import, Get Import Status,
 * List Imported Rubrics, Get Import Template). Rubrics are imported into a course
 * of this file's own and into the sub-account it lives in.
 */
// Several tests wait for background jobs of the shared Canvas: more time than the default.
describe('rubric: CSV import', { timeout: 600_000 }, () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let emptyCourse: SandboxCourse;
	const eh = { errorHandling: { onError: 'continueWithError' } };

	const HEADER =
		'Rubric Name,Criteria Name,Criteria Description,Criteria Enable Range,Rating Name,Rating Description,Rating Points,Rating Name,Rating Description,Rating Points,Rating Name,Rating Description,Rating Points';
	const row = (...fields: Array<string | number>): string => fields.map(csvField).join(',');
	const csv = (...rows: string[]): string => [HEADER, ...rows].join('\n');

	const statusOf = (base: string, importId: string | number): Promise<Json> => canvas().get<Json>(`${base}/rubrics/upload/${importId}`);
	/** Canvas imports in a background job: wait until the import has ended, one way or the other. */
	const finished = (base: string, importId: string | number): Promise<Json> =>
		waitFor(
			async () => {
				const status = await statusOf(base, importId);
				return ['succeeded', 'succeeded_with_errors', 'failed'].includes(String(status.workflow_state)) ? status : false;
			},
			300_000,
			`rubric import ${String(importId)}`,
		);
	const importedBy = (base: string, importId: string | number): Promise<Json[]> =>
		canvas().get<Json[]>(`${base}/rubrics/upload/${importId}/rubrics`);

	beforeAll(async () => {
		accountId = await createSandboxAccount('rubric import');
		course = await createSandboxCourse('rubric-import', { accountId, personas: ['teacher'] });
		courseId = course.id;
		emptyCourse = await createSandboxCourse('rubric-import-none', { accountId });
	}, 900_000);

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxCourse(emptyCourse);
		await deleteSandboxAccount(accountId);
	}, 300_000);

	// ---------------------------------------------------------------- template

	it('getImportTemplate: one item with the CSV text of the template; anybody may read it', async () => {
		const expected = String((await canvas().request('GET', '/api/v1/rubrics/upload_template')).data);
		const items = await runOk({ resource: 'rubric', operation: 'getImportTemplate' });
		expect(items).toEqual([{ value: expected }]);
		const [header, ...rows] = parseCsv(expected);
		expect(header.slice(0, 7)).toEqual(HEADER.split(',').slice(0, 7));
		expect(rows.length).toBeGreaterThan(0);

		const asStudent = await runOk({ resource: 'rubric', operation: 'getImportTemplate', persona: 'student' });
		expect(asStudent).toEqual([{ value: expected }]);
	});

	it('getImportTemplate [needs shared change]: the template is also attached as a binary file', async () => {
		const result = await runNode({ resource: 'rubric', operation: 'getImportTemplate' });
		expect(result.rawSuccess[0].json.value).toContain('Rubric Name');
		expect(result.rawSuccess[0].binary?.data).toMatchObject({ mimeType: 'text/csv', fileExtension: 'csv' });
	});

	// ---------------------------------------------------------------- import

	it('import (course): several rubrics in one file; the import record, its status and the rubrics it created', async () => {
		const first = unique('Lab report "α", 評価');
		const second = unique('Presentation');
		const csvData = csv(
			row(first, 'Hypothesis', 'States a testable claim, "clearly"', 'false', 'Excellent', 'Clear & testable', 4, 'Fair', 'Vague — ünï', '2,5', 'Missing', '', 0),
			row(first, 'Method', '', 'false', 'Sound', 'Could be repeated', 3, 'Flawed', 'Not repeatable', 1),
			row(second, 'Delivery', 'Speaks freely', 'false', 'Yes', '', 5, 'No', '', 0),
		);
		const [record] = await runOk({
			resource: 'rubric',
			operation: 'import',
			persona: 'teacher',
			params: { context: 'course', courseId, csvData },
		});
		expect(record).toMatchObject({ course_id: Number(courseId), account_id: null, error_count: 0, error_data: [] });
		expect(record.attachment).toMatchObject({ filename: 'rubrics.csv', size: Buffer.byteLength(csvData, 'utf8') });
		expect((record.user as Json).id).toBeTypeOf('number');
		const importId = String(record.id);

		const base = `/api/v1/courses/${courseId}`;
		const done = await finished(base, importId);
		expect(done).toMatchObject({ workflow_state: 'succeeded', progress: 100, error_count: 0 });

		// Status by ID and as "latest" (the default of the field).
		const [byId] = await runOk({ resource: 'rubric', operation: 'getImportStatus', persona: 'teacher', params: { context: 'course', courseId, importId } });
		expect(byId).toMatchObject({ id: Number(importId), workflow_state: 'succeeded', progress: 100, course_id: Number(courseId) });
		expect(byId.attachment).toMatchObject({ filename: 'rubrics.csv' });
		const [latest] = await runOk({ resource: 'rubric', operation: 'getImportStatus', params: { context: 'course', courseId: `sis_course_id:${course.sisId}` } });
		expect(latest.id).toBe(Number(importId));

		// The rubrics of the import, through the node and from Canvas.
		const expected = await importedBy(base, importId);
		const listed = await runOk({ resource: 'rubric', operation: 'listImportedRubrics', persona: 'teacher', params: { context: 'course', courseId, importId } });
		expect(listed).toEqual(expected);
		expect(listed.map((r) => r.title).sort()).toEqual([first, second].sort());

		const labReport = listed.find((r) => r.title === first) as Json;
		expect(labReport).toMatchObject({ context_type: 'Course', context_id: Number(courseId), points_possible: 7 });
		const [hypothesis, method] = labReport.data as Json[];
		// Canvas keeps the long description of a criterion as HTML: quotes arrive escaped.
		expect(hypothesis).toMatchObject({ description: 'Hypothesis', long_description: 'States a testable claim, &quot;clearly&quot;', points: 4 });
		expect((hypothesis.ratings as Json[]).map((r) => [r.description, r.long_description, r.points])).toEqual([
			['Excellent', 'Clear & testable', 4],
			// A decimal comma is read as a decimal point.
			['Fair', 'Vague — ünï', 2.5],
			['Missing', '', 0],
		]);
		expect(method).toMatchObject({ description: 'Method', points: 3 });
		expect((method.ratings as Json[]).map((r) => r.points)).toEqual([3, 1]);
		expect(listed.find((r) => r.title === second)).toMatchObject({ points_possible: 5 });

		// Imported rubrics are drafts: readable by ID, but not part of the rubric list of the course.
		const [draft] = await runOk({ resource: 'rubric', operation: 'get', params: { context: 'course', courseId, rubricId: String(labReport.id) } });
		expect(draft).toMatchObject({ id: labReport.id, title: first });
		const inList = await runOk({ resource: 'rubric', operation: 'getAll', params: { context: 'course', courseId, pagination: { returnAll: true } } });
		expect(inList.map((r) => r.id)).not.toContain(labReport.id);
	});

	it('import (account): rubrics for a whole account; one import per input item', async () => {
		const names = [unique('Account rubric A'), unique('Account rubric B')];
		const result = await runNode({
			resource: 'rubric',
			operation: 'import',
			items: names.map((name) => ({ csv: csv(row(name, 'Only criterion', 'Described', 'false', 'Met', '', 2, 'Not met', '', 0)) })),
			params: { context: 'account', accountId, csvData: '={{ $json.csv }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(result.success.every((record) => record.account_id === Number(accountId) && record.course_id === null)).toBe(true);

		const base = `/api/v1/accounts/${accountId}`;
		for (const [index, record] of result.success.entries()) {
			expect((await finished(base, String(record.id))).workflow_state).toBe('succeeded');
			const listed = await runOk({
				resource: 'rubric',
				operation: 'listImportedRubrics',
				items: [{ id: record.id }],
				params: { context: 'account', accountId: Number(accountId), importId: '={{ $json.id }}' },
			});
			expect(listed.map((r) => r.title)).toEqual([names[index]]);
			expect(listed[0]).toMatchObject({ context_type: 'Account', context_id: Number(accountId), points_possible: 2 });
		}

		const [latest] = await runOk({ resource: 'rubric', operation: 'getImportStatus', params: { context: 'account', accountId, importId: 'latest' } });
		expect(latest).toMatchObject({ account_id: Number(accountId), workflow_state: 'succeeded' });
		expect(result.success.map((record) => record.id)).toContain(latest.id);
		// An import of the account is not an import of the course.
		const elsewhere = await runNode({
			resource: 'rubric',
			operation: 'getImportStatus',
			params: { context: 'course', courseId, importId: String(latest.id), ...eh },
		});
		expect(elsewhere.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getImportStatus' });
	});

	it('import: the template itself can be imported, straight from Get Import Template', async () => {
		const chain = await runChain([
			canvasInChain({ resource: 'rubric', operation: 'getImportTemplate' }, 'Template'),
			canvasInChain({ resource: 'rubric', operation: 'import', params: { context: 'course', courseId, csvData: '={{ $json.value }}' } }),
		]);
		expect(chain.failure).toBeUndefined();
		const [record] = chain.output('Canvas');
		const base = `/api/v1/courses/${courseId}`;
		expect((await finished(base, String(record.id))).workflow_state).toBe('succeeded');
		const created = await importedBy(base, String(record.id));
		expect(created.map((r) => r.title)).toEqual(['Rubric 1']);
		expect((created[0].data as Json[]).map((criterion) => criterion.description)).toEqual(['Criteria 1', 'Criteria 2']);
	});

	it('import: what Canvas reports for files it can only partly use, or not at all', async () => {
		const base = `/api/v1/courses/${courseId}`;
		const run = async (csvData: string): Promise<Json> => {
			const [record] = await runOk({ resource: 'rubric', operation: 'import', params: { context: 'course', courseId, csvData } });
			await finished(base, String(record.id));
			const [status] = await runOk({ resource: 'rubric', operation: 'getImportStatus', params: { context: 'course', courseId, importId: String(record.id) } });
			return status;
		};

		// One good rubric, one without a criterion name, one without ratings: the good one is created.
		const good = unique('Partly imported');
		const partly = await run(
			csv(
				row(good, 'Criterion', '', 'false', 'Yes', '', 1, 'No', '', 0),
				row('No criterion name', '', 'Described', 'false', 'Yes', '', 1, 'No', '', 0),
				row('No ratings', 'Lonely criterion', '', 'false'),
			),
		);
		expect(partly).toMatchObject({ workflow_state: 'succeeded_with_errors', error_count: 2 });
		expect((partly.error_data as Json[]).map((e) => e.message).sort()).toEqual([
			"Missing 'Criteria Name' for No criterion name",
			'Missing ratings for Lonely criterion',
		]);
		expect((await importedBy(base, String(partly.id))).map((r) => r.title)).toEqual([good]);

		// Only the header row: nothing to import.
		const headerOnly = await run(HEADER);
		expect(headerOnly).toMatchObject({ workflow_state: 'failed', error_count: 1 });
		expect((headerOnly.error_data as Json[])[0].message).toBe('The file is empty or does not contain valid rubric data.');
		expect(await importedBy(base, String(headerOnly.id))).toEqual([]);

		// Not a rubric file at all.
		const otherColumns = await run('name,points\nSomething,3');
		expect(otherColumns).toMatchObject({ workflow_state: 'succeeded_with_errors', error_count: 1 });
		expect((otherColumns.error_data as Json[])[0].message).toBe("Missing 'Rubric Name' in some rows.");

		// Broken CSV (a quote in a field that is not quoted). Canvas records the error but never ends
		// the import: it stays "importing", so whoever polls has to look at the error count as well.
		const [broken] = await runOk({
			resource: 'rubric',
			operation: 'import',
			params: { context: 'course', courseId, csvData: csv('Broken "quoted" rubric,Criterion,,false,Yes,,1') },
		});
		const stuck = await waitFor(
			async () => {
				const status = await statusOf(base, String(broken.id));
				return Number(status.error_count) > 0 ? status : false;
			},
			300_000,
			'the error of the broken import',
		);
		expect(stuck).toMatchObject({ workflow_state: 'importing', error_count: 1 });
		expect((stuck.error_data as Json[])[0].message).toBe('The file is not a valid CSV file.');
		expect(await importedBy(base, String(broken.id))).toEqual([]);
	});

	// ---------------------------------------------------------------- errors

	it('errors: nothing to import, missing rights, unknown imports', async () => {
		const empty = await runNode({
			resource: 'rubric',
			operation: 'import',
			params: { context: 'course', courseId, csvData: ' \n ', ...eh },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'rubric', operation: 'import' });
		expect(String(empty.error[0].errorMessage)).toContain('CSV Data is empty');

		// The student persona has no part in the course or the account.
		const cases: Array<[string, Json]> = [
			['import', { context: 'course', courseId, csvData: csv(row('Not allowed', 'C', '', 'false', 'Yes', '', 1)) }],
			['import', { context: 'account', accountId, csvData: csv(row('Not allowed', 'C', '', 'false', 'Yes', '', 1)) }],
			['getImportStatus', { context: 'course', courseId }],
			['listImportedRubrics', { context: 'course', courseId, importId: '1' }],
		];
		for (const [operation, params] of cases) {
			const forbidden = await runNode({ resource: 'rubric', operation, persona: 'student', params: { ...params, ...eh } });
			expect(forbidden.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(forbidden.error[0].errorCode);
			expect(forbidden.error[0], operation).toMatchObject({ resource: 'rubric', operation });
		}

		// A course nothing was ever imported into has no latest import.
		const none = await runNode({
			resource: 'rubric',
			operation: 'getImportStatus',
			items: [{ course: Number(emptyCourse.id) }, { course: Number(courseId) }],
			params: { context: 'course', courseId: '={{ $json.course }}', ...eh },
		});
		expect(none.error).toHaveLength(1);
		expect(none.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { course: Number(emptyCourse.id) } });
		expect(none.success).toHaveLength(1);
		expect(none.rawSuccess[0].pairedItem).toEqual({ item: 1 });

		const unknown = await runNode({
			resource: 'rubric',
			operation: 'getImportStatus',
			params: { context: 'course', courseId, importId: '99999999', ...eh },
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		// The list of an unknown import is simply empty.
		const nothing = await runNode({ resource: 'rubric', operation: 'listImportedRubrics', params: { context: 'course', courseId, importId: '99999999' } });
		expect(nothing.ok).toBe(true);
		expect(nothing.success).toEqual([]);

		const noCourse = await runNode({
			resource: 'rubric',
			operation: 'import',
			params: { context: 'course', courseId: '99999999', csvData: csv(row('Nowhere', 'C', '', 'false', 'Yes', '', 1)), ...eh },
		});
		expect(noCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/courses/99999999/rubrics/upload' });
	});
});
