import { describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { runNode, skipOp } from '../lib/harness';
import { withoutPaging } from './support/debug';

/**
 * Resource: smartSearch.
 *
 * Smart Search needs the `smart_search` feature and an embedding service (AWS
 * Bedrock) configured in Canvas. The local open-source Canvas has neither: the
 * endpoint exists but answers 403 for everyone, whatever the query. The
 * request is therefore asserted in debug mode, the refusal is asserted for
 * real, and the operation is declared as skipped for the coverage report.
 */
skipOp(
	'smartSearch',
	'search',
	'Smart Search needs the smart_search feature and an AWS Bedrock embedding service; the local Canvas answers 403 for every query. Request asserted in debug mode.',
);

describe('smartSearch', () => {
	it('search: sends the query, the type filters and the includes', async () => {
		const result = await runNode({
			resource: 'smartSearch',
			operation: 'search',
			items: [{ q: 'how do cells divide? "mitosis" & meiosis – 細胞分裂' }, { q: 'second question' }],
			params: {
				debugMode: true,
				courseId: fx('courseId'),
				query: '={{ $json.q }}',
				options: {
					filter: ['announcements', 'assignments', 'discussion_topics', 'pages'],
					include: ['modules', 'status'],
				},
			},
		});
		expect(result.debug).toHaveLength(2);
		expect(result.debug[0]).toMatchObject({
			method: 'GET',
			queryString: {
				q: 'how do cells divide? "mitosis" & meiosis – 細胞分裂',
				filter: ['announcements', 'assignments', 'discussion_topics', 'pages'],
				include: ['modules', 'status'],
			},
			body: {},
		});
		const url = new URL(String(result.debug[0].url));
		expect(`${url.origin}${url.pathname}`).toBe(`${canvas().url}/api/v1/courses/${fx('courseId')}/smartsearch`);
		expect(url.searchParams.get('q')).toBe('how do cells divide? "mitosis" & meiosis – 細胞分裂');
		expect(url.searchParams.getAll('filter[]')).toEqual(['announcements', 'assignments', 'discussion_topics', 'pages']);
		expect(url.searchParams.getAll('include[]')).toEqual(['modules', 'status']);
		expect(new URL(String(result.debug[1].url)).searchParams.get('q')).toBe('second question');
	});

	it('search: without options only the query is sent', async () => {
		const result = await runNode({
			resource: 'smartSearch',
			operation: 'search',
			params: { debugMode: true, courseId: `sis_course_id:${fx('courseSisId')}`, query: 'photosynthesis', options: { filter: [], include: [] } },
		});
		expect(withoutPaging(result.debug[0])).toMatchObject({
			method: 'GET',
			url: `${canvas().url}/api/v1/courses/sis_course_id:${fx('courseSisId')}/smartsearch?q=photosynthesis`,
			queryString: { q: 'photosynthesis' },
		});
	});

	it('search: where Smart Search is not available Canvas refuses, and the node says so', async () => {
		for (const persona of ['admin', 'student']) {
			const result = await runNode({
				resource: 'smartSearch',
				operation: 'search',
				persona,
				params: {
					courseId: fx('courseId'),
					query: 'photosynthesis',
					options: { filter: ['pages'], include: ['status'] },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({
				errorCode: 403,
				errorType: 'FORBIDDEN',
				resource: 'smartSearch',
				operation: 'search',
				endpoint: `/api/v1/courses/${fx('courseId')}/smartsearch`,
			});
		}
	});

	it('search: an unknown course is a 404', async () => {
		const result = await runNode({
			resource: 'smartSearch',
			operation: 'search',
			params: { courseId: '99999999', query: 'anything', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
