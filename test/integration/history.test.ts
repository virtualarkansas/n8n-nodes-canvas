import { describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: history (recent history of a user: page views of the web
 * interface during the last three weeks).
 *
 * Canvas builds the history from page views of HTML pages; API requests are
 * excluded. Whatever history the seeded users have is compared entry by entry
 * with what Canvas returns directly; users who never used the web interface
 * have an empty history, which must come out as "no items", not as an error.
 */
describe('history', () => {
	const key = (entry: Json): string => `${String(entry.asset_code)}|${String(entry.visited_at)}|${String(entry.visited_url)}`;

	it('getAll: the history of the token\'s user ("self" is the default)', async () => {
		for (const persona of ['admin', 'teacher', 'student']) {
			const expected = await new CanvasClient(persona).getAll<Json>('/api/v1/users/self/history');
			const history = await runOk({
				resource: 'history',
				operation: 'getAll',
				persona,
				params: { pagination: { returnAll: true } },
			});
			expect(history.map(key)).toEqual(expected.map(key));
			for (const entry of history) {
				expect(entry).toMatchObject({
					asset_code: expect.any(String),
					visited_url: expect.any(String),
					visited_at: expect.any(String),
				});
			}

			const explicit = await runOk({
				resource: 'history',
				operation: 'getAll',
				persona,
				params: { userId: 'self', pagination: { perPage: 5, maxPages: 2 } },
			});
			expect(explicit.length).toBeLessThanOrEqual(Math.max(10, expected.length));
			expect(explicit.map(key)).toEqual(expected.slice(0, explicit.length).map(key));
		}
	});

	it('getAll: an admin reads the history of other users, by ID, SIS ID and numeric ID from an expression', async () => {
		const result = await runNode({
			resource: 'history',
			operation: 'getAll',
			items: [
				{ user: Number(fx('studentUserId')) },
				{ user: `sis_user_id:${fx('studentSisUserId')}` },
				{ user: fx('teacherUserId') },
			],
			params: { userId: '={{ $json.user }}', pagination: { returnAll: true } },
		});
		expect(result.ok, JSON.stringify(result.failure)).toBe(true);
		expect(result.error).toEqual([]);
		const student = await canvas().getAll<Json>(`/api/v1/users/${fx('studentUserId')}/history`);
		const teacher = await canvas().getAll<Json>(`/api/v1/users/${fx('teacherUserId')}/history`);
		// The student is asked for twice (by ID and by SIS ID), the teacher once.
		expect(result.success.map(key)).toEqual([...student, ...student, ...teacher].map(key));
	});

	it('errors: a student may not read someone else\'s history; unknown users are 404', async () => {
		const forbidden = await runNode({
			resource: 'history',
			operation: 'getAll',
			persona: 'student',
			params: { userId: fx('teacherUserId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({
			errorType: 'FORBIDDEN',
			resource: 'history',
			operation: 'getAll',
			endpoint: `/api/v1/users/${fx('teacherUserId')}/history`,
		});
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const missing = await runNode({
			resource: 'history',
			operation: 'getAll',
			params: { userId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
