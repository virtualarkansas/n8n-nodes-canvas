import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, createUserWithToken, fx, unique } from '../lib/canvas';
import type { TestUser } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Node-level option Request Options > Act as User ID (Canvas masquerading, `as_user_id`).
 * It applies to every request made for an item, whatever the resource, so it is tested
 * with a few unrelated operations on users this file creates.
 */
describe('request options: act as user', () => {
	let first: TestUser;
	let second: TestUser;
	let sisUser: { id: string; sis: string };

	beforeAll(async () => {
		[first, second] = await Promise.all([createUserWithToken('Masquerade One'), createUserWithToken('Masquerade Two')]);
		const sis = unique('masq-sis').toLowerCase();
		const created = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name: 'Masquerade SIS', skip_registration: true },
			pseudonym: { unique_id: `${sis}@example.edu`, sis_user_id: sis, send_confirmation: false },
		});
		sisUser = { id: String(created.id), sis };
	});

	afterAll(async () => {
		for (const id of [first?.id, second?.id, sisUser?.id]) {
			if (id) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${id}`);
		}
	});

	it('each item acts as its own user; without the option the token\'s user answers', async () => {
		const result = await runNode({
			resource: 'user',
			operation: 'getSelf',
			items: [{ as: first.id }, { as: Number(second.id) }, { as: ` sis_user_id:${sisUser.sis} ` }, { as: '' }],
			params: { requestOptions: { asUserId: '={{ $json.as }}' } },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((u) => String(u.id))).toEqual([first.id, second.id, sisUser.id, String(fx('adminUserId'))]);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 1, 2, 3]);
	});

	it('a write is carried out as that user', async () => {
		const name = unique('Masquerade bookmark');
		const [created] = await runOk({
			resource: 'bookmark',
			operation: 'create',
			params: { name, url: '/courses', requestOptions: { asUserId: first.id } },
		});
		expect(created.name).toBe(name);
		// It is the user's bookmark, not the admin's.
		const own = await first.client.getAll<Json>('/api/v1/users/self/bookmarks');
		expect(own.map((b) => b.id)).toContain(created.id);
		const admins = await canvas().getAll<Json>('/api/v1/users/self/bookmarks');
		expect(admins.map((b) => b.id)).not.toContain(created.id);
	});

	it('follow-up pages are read as that user too', async () => {
		for (let i = 0; i < 6; i++) {
			await second.client.post('/api/v1/users/self/bookmarks', { name: `Paged ${i}`, url: `/courses?n=${i}` });
		}
		const expected = await second.client.getAll<Json>('/api/v1/users/self/bookmarks');
		expect(expected).toHaveLength(6);

		const listed = await runOk({
			resource: 'bookmark',
			operation: 'getAll',
			params: { requestOptions: { asUserId: second.id }, pagination: { perPage: 2, maxPages: 0 } },
		});
		expect(listed.map((b) => b.id)).toEqual(expected.map((b) => b.id));
	});

	it('Canvas refuses a user who may not masquerade, and an unknown user', async () => {
		const eh = { errorHandling: { onError: 'continueWithError' } };
		const asTeacher = await runNode({
			resource: 'user',
			operation: 'getSelf',
			persona: 'teacher',
			params: { requestOptions: { asUserId: first.id }, ...eh },
		});
		expect(asTeacher.success).toEqual([]);
		expect([401, 403]).toContain(asTeacher.error[0].errorCode);
		expect(String(asTeacher.error[0].errorMessage)).toMatch(/as_user_id/);

		const unknown = await runNode({
			resource: 'user',
			operation: 'getSelf',
			params: { requestOptions: { asUserId: '999999999' }, ...eh },
		});
		expect(unknown.success).toEqual([]);
		expect([401, 403, 404]).toContain(unknown.error[0].errorCode);
	});

	it('debug mode shows the parameter; an operation\'s own "act as" field wins over the node option', async () => {
		const shown = await runNode({
			resource: 'course',
			operation: 'get',
			params: { debugMode: true, courseId: '7', requestOptions: { asUserId: 'sis_user_id:j doe' } },
		});
		expect(String(shown.debug[0].url)).toMatch(/\/api\/v1\/courses\/7\?per_page=10&as_user_id=sis_user_id%3Aj%20doe$/);
		expect(String(shown.debug[0].curl)).toContain('as_user_id=sis_user_id%3Aj%20doe');

		const own = await runNode({
			resource: 'notificationPreference',
			operation: 'update',
			params: {
				debugMode: true,
				channelId: '5',
				notification: 'new_announcement',
				frequency: 'daily',
				options: { as_user_id: '11' },
				requestOptions: { asUserId: '22' },
			},
		});
		expect(String(own.debug[0].url)).toContain('as_user_id=11');
		expect(String(own.debug[0].url)).not.toContain('as_user_id=22');
	});
});
