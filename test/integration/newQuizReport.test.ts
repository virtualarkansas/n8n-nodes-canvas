import { describe, expect, it } from 'vitest';
import { fx } from '../lib/canvas';
import { skipOp } from '../lib/harness';
import { buildRequest, buildRequests, NEW_QUIZZES_SKIP_REASON } from './support/debug';
import { runNode } from './support/run';

/**
 * Resource: newQuizReport. New Quizzes is a hosted Instructure service that an
 * open-source Canvas does not include, so the operation runs through n8n in the
 * node's debug mode and the request it builds is checked against the published
 * API documentation: https://canvas.instructure.com/doc/api/new_quizzes_reports.html
 */
skipOp('newQuizReport', 'create', NEW_QUIZZES_SKIP_REASON);

describe('newQuizReport', () => {
	const courseId = fx('courseId');

	it('create: POST …/quizzes/:assignment_id/reports with report type and format under "quiz_report"', async () => {
		const request = await buildRequest({
			resource: 'newQuizReport',
			operation: 'create',
			params: { courseId, assignmentId: '456', reportType: 'student_analysis', format: 'csv' },
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/quizzes/456/reports`);
		expect(request.query).toBe('');
		expect(request.body).toEqual({ quiz_report: { report_type: 'student_analysis', format: 'csv' } });
	});

	it('create: every report type and format, one request per input item', async () => {
		const combinations = [
			{ quiz: 456, type: 'student_analysis', format: 'csv' },
			{ quiz: 456, type: 'student_analysis', format: 'json' },
			{ quiz: ' 457 ', type: 'item_analysis', format: 'csv' },
			{ quiz: '457', type: 'item_analysis', format: 'json' },
		];
		const requests = await buildRequests({
			resource: 'newQuizReport',
			operation: 'create',
			items: combinations,
			params: {
				courseId: Number(courseId),
				assignmentId: '={{ $json.quiz }}',
				reportType: '={{ $json.type }}',
				format: '={{ $json.format }}',
			},
		});
		expect(requests.map((r) => [r.method, r.path, r.body])).toEqual(
			combinations.map((c) => [
				'POST',
				`/api/quiz/v1/courses/${courseId}/quizzes/${String(c.quiz).trim()}/reports`,
				{ quiz_report: { report_type: c.type, format: c.format } },
			]),
		);
	});

	it('create: the defaults are a student analysis as CSV', async () => {
		const request = await buildRequest({
			resource: 'newQuizReport',
			operation: 'create',
			params: { courseId, assignmentId: '456' },
		});
		expect(request.body).toEqual({ quiz_report: { report_type: 'student_analysis', format: 'csv' } });
	});

	it('on a Canvas without the New Quizzes service the operation ends on the Error output', async () => {
		const result = await runNode({
			resource: 'newQuizReport',
			operation: 'create',
			params: {
				courseId,
				assignmentId: '456',
				reportType: 'item_analysis',
				format: 'json',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'newQuizReport',
			operation: 'create',
			endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/456/reports`,
		});
	});
});
