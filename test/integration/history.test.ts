import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, createUserWithToken, fx, railsRunner } from '../lib/canvas';
import type { TestUser } from '../lib/canvas';
import { createCredential, runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: history (recent history of a user: page views of the web
 * interface during the last three weeks).
 *
 * Canvas builds the history from page views of HTML pages; API requests are
 * excluded, but they are page views too, and Canvas pages through all of them.
 * The history of a user this file creates is compared entry by entry with what
 * Canvas returns directly; for the seeded personas, whose tokens every other
 * file uses at the same time, only what holds still is compared.
 */
describe('history', () => {
	const key = (entry: Json): string => `${String(entry.asset_code)}|${String(entry.visited_at)}|${String(entry.visited_url)}`;
	let reader: TestUser;

	beforeAll(async () => {
		// A user of this file's own with a known browsing history. Canvas pages through the page
		// views of a user (API requests included) and filters them, so the history of the shared
		// personas, whose tokens other files use all the time, shifts between two requests.
		reader = await createUserWithToken('History reader');
		await canvas().post(`/api/v1/courses/${fx('courseId')}/enrollments`, {
			enrollment: { user_id: reader.id, type: 'StudentEnrollment', enrollment_state: 'active' },
		});
		// HTML pages do not render in the local Canvas image, so the views are written directly.
		railsRunner(`
			user = User.find(${Number(reader.id)}); course = Course.find(${Number(fx('courseId'))})
			assets = course.assignments.active.order(:id).limit(6).to_a + course.wiki_pages.active.order(:id).limit(3).to_a
			12.times do |i|
				asset = assets[i % assets.size]; at = (i * 97 + 30).minutes.ago
				aua = AssetUserAccess.where(user: user, asset_code: asset.asset_string, context: course).first_or_initialize
				aua.assign_attributes(asset_category: asset.is_a?(Assignment) ? "assignments" : "wiki", asset_group_code: "x:#{course.asset_string}",
					membership_type: "StudentEnrollment", display_name: asset.title, action_level: "view", view_score: (aua.view_score || 0) + 1,
					root_account_id: course.root_account_id, last_access: [aua.last_access, at].compact.max)
				aua.save!
				id = SecureRandom.uuid
				PageView.new { |p| p.assign_attributes(id: id, request_id: id, url: "http://localhost:3000/courses/#{course.id}/x/#{asset.id}", session_id: "battery", context: course,
					controller: "assignments", action: "show", user_request: true, render_time: 0.2, user_agent: "Mozilla/5.0", account_id: course.root_account_id,
					interaction_seconds: 20.0, user: user, remote_ip: "10.0.0.1", http_method: "get", asset_user_access_id: aua.id, created_at: at, updated_at: at) }.save!
			end
		`);
	});

	afterAll(async () => {
		if (reader) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${reader.id}`);
	});

	it('getAll: the history of the token\'s user ("self" is the default), entry by entry', async () => {
		const credential = await createCredential(reader.token, 'history reader');
		const expected = await reader.client.getAll<Json>('/api/v1/users/self/history');
		expect(expected).toHaveLength(12);
		expect(new Set(expected.map((e) => e.asset_code)).size).toBe(9);

		const history = await runOk({ resource: 'history', operation: 'getAll', credential });
		expect(history.map(key)).toEqual(expected.map(key));
		// Newest first.
		expect(history.map((e) => String(e.visited_at))).toEqual(history.map((e) => String(e.visited_at)).sort().reverse());
		for (const entry of history) {
			expect(entry).toMatchObject({
				asset_code: expect.any(String),
				asset_name: expect.any(String),
				context_id: Number(fx('courseId')),
				visited_url: expect.any(String),
				visited_at: expect.any(String),
			});
		}

		// The page size is Canvas' business here (it ignores per_page); "self" may be given explicitly.
		const explicit = await runOk({
			resource: 'history',
			operation: 'getAll',
			credential,
			params: { userId: 'self', pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(explicit.map(key)).toEqual(expected.map(key));

		// An admin reads the same history by user ID.
		const asAdmin = await runOk({ resource: 'history', operation: 'getAll', params: { userId: reader.id, pagination: { returnAll: true } } });
		expect(asAdmin.map(key)).toEqual(expected.map(key));
	});

	it('getAll: the seeded personas (their history moves while other tests use their tokens)', async () => {
		for (const persona of ['teacher', 'student']) {
			const client = new CanvasClient(persona);
			const before = await client.getAll<Json>('/api/v1/users/self/history');
			const history = await runOk({ resource: 'history', operation: 'getAll', persona, params: { pagination: { returnAll: true } } });
			const after = await client.getAll<Json>('/api/v1/users/self/history');
			// Every entry the node returned is one Canvas knows; nothing invented, nothing malformed.
			const known = new Set([...before, ...after].map(key));
			expect(history.length, persona).toBeGreaterThan(0);
			expect(history.map(key).filter((k) => !known.has(k)), persona).toEqual([]);
			// And nothing that stayed in place between the two readings is missing.
			const stable = new Set(before.map(key).filter((k) => after.map(key).includes(k)));
			const got = new Set(history.map(key));
			expect([...stable].filter((k) => !got.has(k)), persona).toEqual([]);
		}
	});

	it('getAll: an admin reads the history of other users, by ID, SIS ID and numeric ID from an expression', async () => {
		const before = await canvas().getAll<Json>(`/api/v1/users/${fx('studentUserId')}/history`);
		const result = await runNode({
			resource: 'history',
			operation: 'getAll',
			items: [{ user: Number(reader.id) }, { user: `sis_user_id:${fx('studentSisUserId')}` }, { user: reader.id }],
			params: { userId: '={{ $json.user }}', pagination: { returnAll: true } },
		});
		expect(result.ok, JSON.stringify(result.failure)).toBe(true);
		expect(result.error).toEqual([]);
		const after = await canvas().getAll<Json>(`/api/v1/users/${fx('studentUserId')}/history`);
		const own = await canvas().getAll<Json>(`/api/v1/users/${reader.id}/history`);

		const byItem = (index: number): string[] =>
			result.rawSuccess.filter((item) => (item.pairedItem as Json).item === index).map((item) => key(item.json));
		// The file's own user is asked for twice (numeric ID and string ID): the same list both times.
		expect(byItem(0)).toEqual(own.map(key));
		expect(byItem(2)).toEqual(own.map(key));
		// The seeded student, by SIS ID: entries Canvas knows (the list itself moves while others use the token).
		const known = new Set([...before, ...after].map(key));
		expect(byItem(1).length).toBeGreaterThan(0);
		expect(byItem(1).filter((k) => !known.has(k))).toEqual([]);
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
