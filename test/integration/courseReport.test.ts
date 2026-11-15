import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createPacedCourse, waitFor } from './pacing.fixture';
import type { PacedCourse } from './pacing.fixture';

/**
 * Resource: courseReport. Canvas has exactly one course-level report
 * ("course_pace_docx"), so the battery runs on a course with Course Pacing and
 * a published pace, created for this file.
 */
describe('courseReport', () => {
	let paced: PacedCourse;
	let courseId = '';
	let reportId = '';

	const readReport = (id: string): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/reports/course_pace_docx/${id}`);
	const finished = (report: Json): boolean => report.status === 'complete' || report.status === 'error';

	beforeAll(async () => {
		paced = await createPacedCourse('courseReport');
		courseId = paced.courseId;
		const created = await canvas().post<Json>(`/api/v1/courses/${courseId}/course_pacing`, {
			course_pace: {
				workflow_state: 'active',
				course_pace_module_items_attributes: paced.moduleItemIds.map((id) => ({ module_item_id: id, duration: 2 })),
			},
		});
		const paceId = String((created.course_pace as Json).id);
		await waitFor(
			async () => (await canvas().get<Json>(`/api/v1/courses/${courseId}/course_pacing/${paceId}`)).course_pace as Json,
			(pace) => pace.published_at !== null,
		);
	});

	afterAll(async () => {
		await paced?.cleanup();
	});

	it('getLastStatus: a course without any report yields an empty record, not an error', async () => {
		const result = await runNode({ resource: 'courseReport', operation: 'getLastStatus', params: { courseId, reportType: 'course_pace_docx' } });
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([{}]);
	});

	it('create: section and enrollment IDs reach Canvas and the report completes with a download', async () => {
		const [report] = await runOk({
			resource: 'courseReport',
			operation: 'create',
			params: {
				courseId,
				reportType: 'course_pace_docx',
				options: { section_ids: ` ${paced.sectionId} `, enrollment_ids: paced.studentEnrollmentId },
			},
		});
		reportId = String(report.id);
		expect(report).toMatchObject({
			report_type: 'course_pace_docx',
			course_id: Number(courseId),
			parameters: { section_ids: [paced.sectionId], enrollment_ids: [paced.studentEnrollmentId] },
		});

		const done = await waitFor(() => readReport(reportId), finished);
		expect(done.status).toBe('complete');
		expect(done.parameters).toEqual({ section_ids: [paced.sectionId], enrollment_ids: [paced.studentEnrollmentId] });
		// One document per section/enrollment, zipped when there are several.
		expect(String(done.file_url)).toContain('/files/');
		expect(String((done.attachment as Json).filename)).toMatch(/\.zip$/);
	});

	it('create: IDs arriving as numbers and a single selection produce a single document', async () => {
		const result = await runNode({
			resource: 'courseReport',
			operation: 'create',
			items: [{ section: Number(paced.sectionId) }],
			params: { courseId: Number(courseId), reportType: 'course_pace_docx', options: { section_ids: '={{ $json.section }}' } },
		});
		expect(result.ok).toBe(true);
		const report = result.success[0];
		expect((report.parameters as Json).section_ids).toEqual([paced.sectionId]);
		const done = await waitFor(() => readReport(String(report.id)), finished);
		expect(done.status).toBe('complete');
		expect(String((done.attachment as Json).filename)).toMatch(/\.docx$/);
	});

	it('create: without any option the request is still accepted (Canvas requires the parameters object)', async () => {
		const [report] = await runOk({ resource: 'courseReport', operation: 'create', params: { courseId, reportType: 'course_pace_docx' } });
		expect(report.id).toBeTypeOf('number');
		expect(report.report_type).toBe('course_pace_docx');
		const actual = await readReport(String(report.id));
		expect(actual.id).toBe(report.id);
		const done = await waitFor(() => readReport(String(report.id)), finished);
		// Nothing was selected, so there is nothing to download.
		expect(done.file_url).toBeNull();
	});

	it('getStatus: returns the report, for several input items', async () => {
		const expected = await readReport(reportId);
		const result = await runNode({
			resource: 'courseReport',
			operation: 'getStatus',
			items: [{ id: Number(reportId) }, { id: 99999999 }],
			params: { courseId, reportType: 'course_pace_docx', reportId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toHaveLength(1);
		expect(result.success[0]).toMatchObject({ id: Number(reportId), status: 'complete', report_type: 'course_pace_docx' });
		expect((result.success[0].attachment as Json).id).toBe((expected.attachment as Json).id);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'courseReport', operation: 'getStatus' });
	});

	it('getLastStatus: returns the most recent report started by the token\'s user', async () => {
		const expected = await canvas().get<Json>(`/api/v1/courses/${courseId}/reports/course_pace_docx`);
		const [last] = await runOk({ resource: 'courseReport', operation: 'getLastStatus', params: { courseId, reportType: 'course_pace_docx' } });
		expect(last.id).toBe(expected.id);
		expect(Number(last.id)).toBeGreaterThan(Number(reportId));
		expect(last.report_type).toBe('course_pace_docx');
	});

	it('errors: reports belong to the user who started them', async () => {
		// Give the teacher persona access to the course, then try to read the admin's report.
		const enrollment = await canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: fx('teacherUserId'), type: 'TeacherEnrollment', enrollment_state: 'active' },
		});
		try {
			const result = await runNode({
				resource: 'courseReport',
				operation: 'getStatus',
				persona: 'teacher',
				params: { courseId, reportType: 'course_pace_docx', reportId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'courseReport', operation: 'getStatus' });
			expect([401, 403]).toContain(result.error[0].errorCode);

			// The teacher has no report of their own yet.
			const last = await runOk({ resource: 'courseReport', operation: 'getLastStatus', persona: 'teacher', params: { courseId, reportType: 'course_pace_docx' } });
			expect(last).toEqual([{}]);
			expect(await new CanvasClient('teacher').get<Json>(`/api/v1/courses/${courseId}/reports/course_pace_docx`)).toEqual({});
		} finally {
			// Must not fail silently: this enrollment belongs to a seeded persona.
			await canvas().delete(`/api/v1/courses/${courseId}/enrollments/${String(enrollment.id)}?task=delete`);
		}
	});

	it('errors: an unknown report type and a student are refused with Canvas\' message', async () => {
		const invalid = await runNode({
			resource: 'courseReport',
			operation: 'create',
			params: { courseId, reportType: '={{ "grade_export_csv" }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'courseReport', operation: 'create' });
		expect(String(invalid.error[0].errorMessage)).toContain('invalid report type grade_export_csv');

		const forbidden = await runNode({
			resource: 'courseReport',
			operation: 'create',
			persona: 'student',
			params: { courseId: fx('courseId'), reportType: 'course_pace_docx', errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'courseReport', operation: 'create' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);
	});
});
