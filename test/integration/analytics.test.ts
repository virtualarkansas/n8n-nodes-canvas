import { describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { runNode, skipOp } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { withoutPaging } from './support/debug';

/**
 * Resource: analytics.
 *
 * The Analytics API is served by a plugin of Instructure-hosted Canvas that is
 * not part of the open-source application, so the local Canvas has none of
 * these routes (it answers 404). The requests the node builds are therefore
 * asserted in debug mode against the published documentation
 * (https://canvas.instructure.com/doc/api/analytics.html), and each operation
 * is declared as skipped for the coverage report.
 */
const REASON =
	'Analytics is a plugin of Instructure-hosted Canvas; open-source Canvas has no /analytics routes (404). Request asserted in debug mode against the API documentation.';

for (const operation of [
	'getCourseActivity',
	'getCourseAssignments',
	'getDepartmentActivity',
	'getDepartmentGrades',
	'getDepartmentStatistics',
	'getDepartmentStatisticsBySubaccount',
	'getStudentSummaries',
	'getUserActivity',
	'getUserAssignments',
	'getUserCommunication',
]) {
	skipOp('analytics', operation, REASON);
}

/** The request the node would send, from its Debug output. */
async function debugRequests(operation: string, params: Json, items?: Json[]): Promise<Json[]> {
	const result = await runNode({ resource: 'analytics', operation, items, params: { debugMode: true, ...params } });
	expect(result.ok, JSON.stringify(result.failure)).toBe(true);
	expect(result.success).toEqual([]);
	expect(result.error).toEqual([]);
	return result.debug.map(withoutPaging);
}

describe('analytics', () => {
	const url = (path: string): string => `${canvas().url}/api/v1${path}`;

	it('course level: activity, assignments, student summaries', async () => {
		const [activity] = await debugRequests('getCourseActivity', { courseId: fx('courseId') });
		expect(activity).toMatchObject({
			method: 'GET',
			url: url(`/courses/${fx('courseId')}/analytics/activity`),
			queryString: {},
			body: {},
		});

		const [assignments] = await debugRequests('getCourseAssignments', { courseId: `sis_course_id:${fx('courseSisId')}` });
		expect(assignments).toMatchObject({
			method: 'GET',
			url: url(`/courses/sis_course_id:${fx('courseSisId')}/analytics/assignments`),
			queryString: {},
		});
		const [asynchronous] = await debugRequests('getCourseAssignments', {
			courseId: fx('courseId'),
			options: { async: true },
		});
		expect(asynchronous).toMatchObject({
			url: url(`/courses/${fx('courseId')}/analytics/assignments?async=true`),
			queryString: { async: true },
		});

		const [summaries] = await debugRequests('getStudentSummaries', { courseId: fx('courseId') });
		expect(summaries).toMatchObject({
			method: 'GET',
			url: url(`/courses/${fx('courseId')}/analytics/student_summaries`),
			queryString: {},
		});
	});

	it('student summaries: every documented sort order, and a single student', async () => {
		const orders = [
			'name',
			'name_descending',
			'score',
			'score_descending',
			'participations',
			'participations_descending',
			'page_views',
			'page_views_descending',
		];
		const requests = await debugRequests(
			'getStudentSummaries',
			{ courseId: fx('courseId'), options: { sort_column: '={{ $json.order }}', student_id: '={{ $json.student }}' } },
			orders.map((order) => ({ order, student: Number(fx('studentUserId')) })),
		);
		expect(requests.map((r) => r.url)).toEqual(
			orders.map((order) =>
				url(`/courses/${fx('courseId')}/analytics/student_summaries?sort_column=${order}&student_id=${fx('studentUserId')}`),
			),
		);

		// An option that was added but left empty is not sent.
		const [unfiltered] = await debugRequests('getStudentSummaries', {
			courseId: fx('courseId'),
			options: { sort_column: 'score_descending', student_id: '' },
		});
		expect(unfiltered.queryString).toEqual({ sort_column: 'score_descending' });
	});

	it('student level: activity, assignments, communication (IDs arriving as numbers)', async () => {
		const expected: Record<string, string> = {
			getUserActivity: 'activity',
			getUserAssignments: 'assignments',
			getUserCommunication: 'communication',
		};
		for (const [operation, suffix] of Object.entries(expected)) {
			const [request] = await debugRequests(
				operation,
				{ courseId: '={{ $json.course }}', studentId: '={{ $json.student }}' },
				[{ course: Number(fx('courseId')), student: Number(fx('studentUserId')) }],
			);
			expect(request).toMatchObject({
				method: 'GET',
				url: url(`/courses/${fx('courseId')}/analytics/users/${fx('studentUserId')}/${suffix}`),
				queryString: {},
				body: {},
			});
		}
	});

	it('department level: current, completed and one term, for every statistic', async () => {
		const expected: Record<string, string> = {
			getDepartmentActivity: 'activity',
			getDepartmentGrades: 'grades',
			getDepartmentStatistics: 'statistics',
			getDepartmentStatisticsBySubaccount: 'statistics_by_subaccount',
		};
		for (const [operation, suffix] of Object.entries(expected)) {
			const [current] = await debugRequests(operation, { accountId: fx('accountId'), termFilter: 'current' });
			expect(current).toMatchObject({
				method: 'GET',
				url: url(`/accounts/${fx('accountId')}/analytics/current/${suffix}`),
				queryString: {},
			});

			const [completed] = await debugRequests(operation, {
				accountId: `sis_account_id:${fx('subAccountSisId')}`,
				termFilter: 'completed',
			});
			expect(completed.url).toBe(url(`/accounts/sis_account_id:${fx('subAccountSisId')}/analytics/completed/${suffix}`));

			const terms = await debugRequests(
				operation,
				{ accountId: fx('accountId'), termFilter: 'term', termId: '={{ $json.term }}' },
				[{ term: Number(fx('termId')) }, { term: `sis_term_id:${fx('termSisId')}` }],
			);
			expect(terms.map((t) => t.url)).toEqual([
				url(`/accounts/${fx('accountId')}/analytics/terms/${fx('termId')}/${suffix}`),
				url(`/accounts/${fx('accountId')}/analytics/terms/sis_term_id:${fx('termSisId')}/${suffix}`),
			]);
		}
	});

	it('a term ID that resolves to nothing is caught before a request with a broken path is sent', async () => {
		const result = await runNode({
			resource: 'analytics',
			operation: 'getDepartmentStatistics',
			items: [{ term: '' }],
			params: {
				accountId: fx('accountId'),
				termFilter: 'term',
				termId: '={{ $json.term }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0]?.errorMessage ?? result.failure?.message)).toMatch(/required parameter is empty/i);
	});

	it('on a Canvas without the Analytics plugin the operations end on the Error output with 404', async () => {
		const result = await runNode({
			resource: 'analytics',
			operation: 'getCourseActivity',
			params: { courseId: fx('courseId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'analytics',
			operation: 'getCourseActivity',
			endpoint: `/api/v1/courses/${fx('courseId')}/analytics/activity`,
		});
	});
});
