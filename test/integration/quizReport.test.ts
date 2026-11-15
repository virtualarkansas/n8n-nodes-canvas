import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import { createQuiz, deleteQuiz, ESSAY, MULTIPLE_CHOICE, quizCourse, takeQuiz, waitFor } from './support/quizzes';

/**
 * Resource: quizReport (CSV reports of a classic quiz). Every operation runs
 * through a real n8n instance; results are verified against Canvas directly.
 * Canvas generates the CSV in a background job, so some checks wait for it.
 */
describe('quizReport', () => {
	let courseId = '';
	let quizId = '';
	let studentReportId = '';
	let itemReportId = '';

	const reportsPath = (): string => `/api/v1/courses/${courseId}/quizzes/${quizId}/reports`;
	const readReport = (id: string): Promise<Json> => canvas().get<Json>(`${reportsPath()}/${id}`);
	/** Data rows of a generated report (the CSV has one header line). */
	const csvRows = async (report: Json): Promise<string[]> => {
		const res = await canvas().request('GET', String((report.file as Json).url));
		expect(res.status).toBe(200);
		return String(res.data).trim().split('\n').slice(1);
	};
	const generated = (id: string): Promise<Json> =>
		waitFor(
			async () => {
				const report = await readReport(id);
				return report.file ? report : undefined;
			},
			`report ${id} to be generated`,
			240_000,
		);

	beforeAll(async () => {
		courseId = await quizCourse();
		const quiz = await createQuiz(courseId, { title: unique('Reported quiz "A" & B'), allowed_attempts: 2 }, [
			MULTIPLE_CHOICE,
			ESSAY,
		]);
		quizId = quiz.id;
		await takeQuiz(courseId, quizId, 'student');
		await takeQuiz(courseId, quizId, 'student');
		await takeQuiz(courseId, quizId, 'student2');
	});

	it('getAll: before anything was generated Canvas lists both report types, without files', async () => {
		const expected = await canvas().get<Json[]>(reportsPath());
		const listed = await runOk({ resource: 'quizReport', operation: 'getAll', params: { courseId, quizId } });
		expect(listed.map((r) => [r.id, r.report_type])).toEqual(expected.map((r) => [r.id, r.report_type]));
		expect(listed.map((r) => r.report_type).sort()).toEqual(['item_analysis', 'student_analysis']);
		for (const report of listed) {
			expect(report).toMatchObject({ quiz_id: Number(quizId), generatable: true });
			expect(report).not.toHaveProperty('file');
		}
		// (An item analysis always covers all attempts, whatever is asked for.)
		expect(listed.find((r) => r.report_type === 'student_analysis')).toMatchObject({ includes_all_versions: false });
	});

	it(
		'create: a student analysis over all attempts is generated and gets a CSV file',
		async () => {
			const [created] = await runOk({
				resource: 'quizReport',
				operation: 'create',
				persona: 'teacher',
				params: { courseId, quizId, reportType: 'student_analysis', options: { includes_all_versions: true } },
			});
			studentReportId = String(created.id);
			expect(created).toMatchObject({
				report_type: 'student_analysis',
				includes_all_versions: true,
				quiz_id: Number(quizId),
			});
			expect(String(created.progress_url)).toMatch(/\/api\/v1\/progress\/\d+$/);

			const report = await generated(studentReportId);
			expect(report).toMatchObject({ id: Number(studentReportId), report_type: 'student_analysis', includes_all_versions: true });
			const file = report.file as Json;
			expect(file['content-type']).toBe('text/csv');
			expect(Number(file.size)).toBeGreaterThan(0);

			// All attempts: two rows for the student who took it twice, one for the other.
			expect(await csvRows(report)).toHaveLength(3);
		},
		300_000,
	);

	it(
		'create: an item analysis; "all versions" does not apply to it',
		async () => {
			const [created] = await runOk({
				resource: 'quizReport',
				operation: 'create',
				params: { courseId, quizId: Number(quizId), reportType: 'item_analysis' },
			});
			itemReportId = String(created.id);
			expect(created).toMatchObject({ report_type: 'item_analysis', quiz_id: Number(quizId) });
			const report = await generated(itemReportId);
			expect((report.file as Json)['content-type']).toBe('text/csv');
		},
		300_000,
	);

	it('create: asking again for a report that is up to date returns the same report', async () => {
		const [again] = await runOk({
			resource: 'quizReport',
			operation: 'create',
			params: { courseId, quizId, reportType: 'student_analysis', options: { includes_all_versions: true } },
		});
		expect(again.id).toBe(Number(studentReportId));
		await generated(studentReportId);
	});

	it('create: only the latest attempt of each student when "all versions" is off', async () => {
		const [created] = await runOk({
			resource: 'quizReport',
			operation: 'create',
			params: { courseId, quizId, reportType: 'student_analysis', options: { includes_all_versions: false } },
		});
		expect(created).toMatchObject({ report_type: 'student_analysis', includes_all_versions: false });
		expect(created.id).not.toBe(Number(studentReportId));
		const report = await generated(String(created.id));
		expect(await csvRows(report)).toHaveLength(2);
	}, 300_000);

	it('get: returns a report with its file; numeric IDs from expressions work', async () => {
		const result = await runNode({
			resource: 'quizReport',
			operation: 'get',
			items: [{ id: Number(studentReportId) }, { id: Number(itemReportId) }],
			params: { courseId, quizId, reportId: '={{ $json.id }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((r) => [r.id, r.report_type])).toEqual([
			[Number(studentReportId), 'student_analysis'],
			[Number(itemReportId), 'item_analysis'],
		]);
		const expected = await readReport(studentReportId);
		expect((result.success[0].file as Json).id).toBe((expected.file as Json).id);
		expect((result.success[0].file as Json).filename).toBe((expected.file as Json).filename);
	});

	it('getAll: the "all versions" option selects which reports are listed', async () => {
		const latestOnly = await runOk({ resource: 'quizReport', operation: 'getAll', params: { courseId, quizId } });
		expect(latestOnly.map((r) => r.id)).toEqual((await canvas().get<Json[]>(reportsPath())).map((r) => r.id));
		expect(latestOnly.find((r) => r.report_type === 'student_analysis')).toMatchObject({ includes_all_versions: false });
		expect(latestOnly.map((r) => r.id)).not.toContain(Number(studentReportId));

		const allVersions = await runOk({
			resource: 'quizReport',
			operation: 'getAll',
			params: { courseId, quizId, options: { includes_all_versions: true }, pagination: { returnAll: true } },
		});
		expect(allVersions.map((r) => r.id)).toEqual(
			(await canvas().get<Json[]>(`${reportsPath()}?includes_all_versions=true`)).map((r) => r.id),
		);
		const student = allVersions.find((r) => r.report_type === 'student_analysis') as Json;
		expect(student).toMatchObject({ id: Number(studentReportId), includes_all_versions: true });
		expect(student.file).toBeTypeOf('object');
	});

	it('abort: removes a generated report file; a report without a file cannot be aborted', async () => {
		const [result] = await runOk({
			resource: 'quizReport',
			operation: 'abort',
			persona: 'teacher',
			params: { courseId, quizId, reportId: studentReportId },
		});
		expect(result).toEqual({ success: true });
		expect(await readReport(studentReportId)).not.toHaveProperty('file');

		const again = await runNode({
			resource: 'quizReport',
			operation: 'abort',
			params: { courseId, quizId, reportId: studentReportId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', operation: 'abort' });
		expect(String(again.error[0].errorMessage)).toContain('report is not being generated');
	});

	it('create: a quiz nobody has taken still gets a report', async () => {
		const empty = await createQuiz(courseId, { title: unique('Untaken') }, [MULTIPLE_CHOICE]);
		const [created] = await runOk({
			resource: 'quizReport',
			operation: 'create',
			params: { courseId, quizId: empty.id, reportType: 'student_analysis' },
		});
		expect(created).toMatchObject({ report_type: 'student_analysis', quiz_id: Number(empty.id) });
		const fetched = await canvas().get<Json>(`/api/v1/courses/${courseId}/quizzes/${empty.id}/reports/${String(created.id)}`);
		expect(fetched.id).toBe(created.id);
		await deleteQuiz(courseId, empty.id);
	});

	it('errors: unknown report, and students may not use reports at all', async () => {
		const missing = await runNode({
			resource: 'quizReport',
			operation: 'get',
			params: { courseId, quizId, reportId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'quizReport', operation: 'get' });

		for (const [operation, params] of [
			['getAll', {}],
			['get', { reportId: itemReportId }],
			['create', { reportType: 'item_analysis' }],
			['abort', { reportId: itemReportId }],
		] as Array<[string, Json]>) {
			const result = await runNode({
				resource: 'quizReport',
				operation,
				persona: 'student',
				params: { courseId, quizId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', operation });
		}
		expect(await readReport(itemReportId)).toHaveProperty('file');
		await deleteQuiz(courseId, quizId);
	});
});
