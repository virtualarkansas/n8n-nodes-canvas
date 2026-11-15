import { beforeAll, describe, expect, it } from 'vitest';
import { canvas } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox, SandboxUser } from './support/commsSandbox';
import { commsSandbox } from './support/commsSandbox';

/**
 * Resource: notificationPreference. Preferences are only ever changed for
 * users of the private sandbox: student 3 through their own credential, and
 * student 11 (who has no credential) by an admin acting on their behalf.
 */
describe('notificationPreference', () => {
	let sbx: Sandbox;
	let owner: SandboxUser;
	let other: SandboxUser;
	let otherChannelId = '';
	const asOwner = 'sbxStudent3';

	const prefsPath = (user: SandboxUser, channelId: string): string =>
		`/api/v1/users/${user.id}/communication_channels/${channelId}/notification_preferences`;

	/** Canvas' own view of the preferences of a channel, keyed by notification. */
	async function actual(user: SandboxUser, channelId: string): Promise<Record<string, Json>> {
		const list = (await canvas().get<Json>(prefsPath(user, channelId))).notification_preferences as Json[];
		return Object.fromEntries(list.map((p) => [String(p.notification), p]));
	}

	/** Update operations answer with `{ notification_preferences: [...] }`. */
	const changed = (item: Json): Json[] => (item.notification_preferences as Json[] | undefined) ?? [item];

	beforeAll(async () => {
		sbx = await commsSandbox();
		owner = sbx.students[2];
		other = sbx.students[10];
		const channels = await canvas().getAll<Json>(`/api/v1/users/${other.id}/communication_channels`);
		otherChannelId = String(channels.find((c) => c.type === 'email')?.id);
	}, 900_000);

	// ---------------------------------------------------------------- read

	it('getAll: every preference of the channel is returned, one item each', async () => {
		const expected = (await canvas().get<Json>(prefsPath(owner, String(owner.channelId)))).notification_preferences as Json[];
		expect(expected.length, 'Canvas has more notification types than a default page or limit').toBeGreaterThan(50);

		const byAdmin = await runOk({
			resource: 'notificationPreference',
			operation: 'getAll',
			params: { userId: owner.id, channelId: owner.channelId },
		});
		expect(byAdmin).toEqual(expected);
		for (const preference of byAdmin) {
			expect(Object.keys(preference).sort()).toEqual(['category', 'frequency', 'notification']);
		}

		// "self" is the default user, and the channel may be given as a number.
		const bySelf = await runOk({
			resource: 'notificationPreference',
			operation: 'getAll',
			persona: asOwner,
			items: [{ channel: Number(owner.channelId) }],
			params: { channelId: '={{ $json.channel }}' },
		});
		expect(bySelf).toEqual(expected);

		// Node-level paging options do not cut this (unpaginated) list short.
		const paged = await runOk({
			resource: 'notificationPreference',
			operation: 'getAll',
			params: { userId: owner.id, channelId: owner.channelId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(paged).toHaveLength(expected.length);
	});

	it('getAll / get: the channel can be identified by type and address', async () => {
		const expected = (await canvas().get<Json>(prefsPath(owner, String(owner.channelId)))).notification_preferences as Json[];
		const byAddress = await runOk({
			resource: 'notificationPreference',
			operation: 'getAll',
			params: { userId: owner.id, channelBy: 'address', channelType: 'email', channelAddress: ` ${owner.login} ` },
		});
		expect(byAddress).toEqual(expected);

		const [one] = await runOk({
			resource: 'notificationPreference',
			operation: 'get',
			params: {
				userId: owner.id,
				channelBy: 'address',
				channelType: 'email',
				channelAddress: owner.login,
				notification: 'new_announcement',
			},
		});
		expect(one).toEqual(expected.find((p) => p.notification === 'new_announcement'));
	});

	it('get: one preference, unwrapped', async () => {
		const expected = await actual(owner, String(owner.channelId));
		const result = await runOk({
			resource: 'notificationPreference',
			operation: 'get',
			items: [{ name: 'assignment_due_date_changed' }, { name: 'new_announcement' }],
			params: { userId: owner.id, channelId: owner.channelId, notification: '={{ $json.name }}' },
		});
		expect(result).toEqual([expected.assignment_due_date_changed, expected.new_announcement]);
		expect(result[0]).toMatchObject({ notification: 'assignment_due_date_changed', category: 'due_date' });
	});

	it('getCategories: one item listing the category slugs', async () => {
		const expected = await canvas().get<Json>(
			`/api/v1/users/${owner.id}/communication_channels/${owner.channelId}/notification_preference_categories`,
		);
		const result = await runOk({
			resource: 'notificationPreference',
			operation: 'getCategories',
			params: { userId: owner.id, channelId: owner.channelId },
		});
		expect(result).toEqual([expected]);
		expect(result[0].categories).toContain('course_content');
		expect(result[0].categories).toContain('discussionentry');
	});

	// ---------------------------------------------------------------- update

	it('update: each frequency is stored for the caller\'s own channel', async () => {
		for (const frequency of ['daily', 'weekly', 'never', 'immediately']) {
			const [result] = await runOk({
				resource: 'notificationPreference',
				operation: 'update',
				persona: asOwner,
				params: { channelId: owner.channelId, notification: 'new_announcement', frequency },
			});
			expect(changed(result)).toEqual([{ notification: 'new_announcement', category: 'announcement', frequency }]);
			expect((await actual(owner, String(owner.channelId))).new_announcement.frequency).toBe(frequency);
		}
	});

	it('update: by channel address', async () => {
		await runOk({
			resource: 'notificationPreference',
			operation: 'update',
			persona: asOwner,
			params: {
				channelBy: 'address',
				channelType: 'email',
				channelAddress: owner.login,
				notification: 'assignment_due_date_changed',
				frequency: 'weekly',
			},
		});
		expect((await actual(owner, String(owner.channelId))).assignment_due_date_changed.frequency).toBe('weekly');
		await runOk({
			resource: 'notificationPreference',
			operation: 'update',
			persona: asOwner,
			params: {
				channelBy: 'address',
				channelType: 'email',
				channelAddress: owner.login,
				notification: 'assignment_due_date_changed',
				frequency: 'immediately',
			},
		});
		expect((await actual(owner, String(owner.channelId))).assignment_due_date_changed.frequency).toBe('immediately');
	});

	it('update: an admin changes another user\'s preference with "Act as User ID"', async () => {
		const before = (await actual(other, otherChannelId)).new_announcement.frequency;
		const target = before === 'daily' ? 'weekly' : 'daily';
		const [result] = await runOk({
			resource: 'notificationPreference',
			operation: 'update',
			params: {
				channelId: otherChannelId,
				notification: 'new_announcement',
				frequency: target,
				options: { as_user_id: ` ${other.id} ` },
			},
		});
		expect(changed(result)[0]).toMatchObject({ notification: 'new_announcement', frequency: target });
		expect((await actual(other, otherChannelId)).new_announcement.frequency).toBe(target);
	});

	it('update: several input items, one with a notification Canvas does not know', async () => {
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'update',
			persona: asOwner,
			items: [
				{ name: 'grade_weight_changed', how: 'never' },
				{ name: 'no_such_notification', how: 'daily' },
				{ name: 'new_discussion_topic', how: 'weekly' },
			],
			params: {
				channelId: owner.channelId,
				notification: '={{ $json.name }}',
				frequency: '={{ $json.how }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'notificationPreference',
			operation: 'update',
			originalItem: { name: 'no_such_notification' },
		});
		const stored = await actual(owner, String(owner.channelId));
		expect(stored.grade_weight_changed.frequency).toBe('never');
		expect(stored.new_discussion_topic.frequency).toBe('weekly');
	});

	// The update endpoints answer `{ "notification_preferences": [ ... ] }`. The node can only unwrap
	// such responses for GET requests (`dataKey`); doing it here needs a change in Canvas.node.ts.
	it('update [needs shared change]: the output is the changed preference itself, like Get', async () => {
		const [result] = await runOk({
			resource: 'notificationPreference',
			operation: 'update',
			persona: asOwner,
			params: { channelId: owner.channelId, notification: 'new_announcement', frequency: 'immediately' },
		});
		expect(result).toEqual({ notification: 'new_announcement', category: 'announcement', frequency: 'immediately' });
	});

	it('updateByCategory: changes every notification of the category', async () => {
		const before = await actual(owner, String(owner.channelId));
		const inCategory = Object.values(before).filter((p) => p.category === 'course_content');
		expect(inCategory.length).toBeGreaterThan(1);

		const [result] = await runOk({
			resource: 'notificationPreference',
			operation: 'updateByCategory',
			persona: asOwner,
			params: { channelId: owner.channelId, category: 'course_content', frequency: 'never' },
		});
		expect(
			changed(result)
				.map((p) => p.notification)
				.sort(),
		).toEqual(inCategory.map((p) => p.notification).sort());
		const after = await actual(owner, String(owner.channelId));
		for (const preference of inCategory) {
			expect(after[String(preference.notification)].frequency).toBe('never');
		}
		// Other categories are untouched.
		expect(after.new_announcement.frequency).toBe(before.new_announcement.frequency);

		await runOk({
			resource: 'notificationPreference',
			operation: 'updateByCategory',
			persona: asOwner,
			params: { channelId: owner.channelId, category: 'course_content', frequency: 'immediately' },
		});
		const restored = await actual(owner, String(owner.channelId));
		for (const preference of inCategory) {
			expect(restored[String(preference.notification)].frequency).toBe('immediately');
		}
	});

	it('updateByCategory: categories whose slug differs from the "category" field, and acting for another user', async () => {
		// Get Many reports "discussion_entry"; the category endpoint only knows "discussionentry".
		const before = await actual(other, otherChannelId);
		const inCategory = Object.values(before).filter((p) => p.category === 'discussion_entry');
		expect(inCategory.length).toBeGreaterThan(0);
		const target = inCategory[0].frequency === 'weekly' ? 'daily' : 'weekly';

		await runOk({
			resource: 'notificationPreference',
			operation: 'updateByCategory',
			params: { channelId: otherChannelId, category: 'discussionentry', frequency: target, options: { as_user_id: other.id } },
		});
		const after = await actual(other, otherChannelId);
		for (const preference of inCategory) {
			expect(after[String(preference.notification)].frequency).toBe(target);
		}

		const wrongSlug = await runNode({
			resource: 'notificationPreference',
			operation: 'updateByCategory',
			params: {
				channelId: otherChannelId,
				category: 'discussion_entry',
				frequency: 'never',
				options: { as_user_id: other.id },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongSlug.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('updateMultiple: several notifications with different frequencies in one request', async () => {
		const [result] = await runOk({
			resource: 'notificationPreference',
			operation: 'updateMultiple',
			persona: asOwner,
			params: {
				channelId: owner.channelId,
				preferences: {
					preferenceValues: [
						{ notification: 'new_announcement', frequency: 'weekly' },
						{ notification: ' assignment_due_date_changed ', frequency: 'never' },
						{ notification: 'submission_comment', frequency: 'daily' },
						// A row left empty in the UI is ignored.
						{ notification: '', frequency: 'never' },
					],
				},
			},
		});
		expect(changed(result)).toHaveLength(3);
		const stored = await actual(owner, String(owner.channelId));
		expect(stored.new_announcement.frequency).toBe('weekly');
		expect(stored.assignment_due_date_changed.frequency).toBe('never');
		expect(stored.submission_comment.frequency).toBe('daily');

		// By address, for another user, back to the defaults.
		await runOk({
			resource: 'notificationPreference',
			operation: 'updateMultiple',
			params: {
				channelBy: 'address',
				channelType: 'email',
				channelAddress: owner.login,
				preferences: {
					preferenceValues: [
						{ notification: 'new_announcement', frequency: 'immediately' },
						{ notification: 'assignment_due_date_changed', frequency: 'immediately' },
						{ notification: 'submission_comment', frequency: 'immediately' },
					],
				},
				options: { as_user_id: owner.id },
			},
		});
		const restored = await actual(owner, String(owner.channelId));
		expect(restored.new_announcement.frequency).toBe('immediately');
		expect(restored.assignment_due_date_changed.frequency).toBe('immediately');
		expect(restored.submission_comment.frequency).toBe('immediately');
	});

	// ---------------------------------------------------------------- errors

	it('errors: updateMultiple without any preference is rejected before a request is sent', async () => {
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'updateMultiple',
			persona: asOwner,
			params: { channelId: owner.channelId, preferences: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		// No HTTP request was made: there is no status code and no endpoint.
		expect(result.error[0]).toMatchObject({ errorCode: 0, endpoint: '', operation: 'updateMultiple' });
		expect(String(result.error[0].errorMessage)).toContain('at least one preference');
	});

	it('errors: a frequency Canvas does not know is a validation error', async () => {
		const before = (await actual(owner, String(owner.channelId))).new_announcement.frequency;
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'update',
			persona: asOwner,
			items: [{ how: 'hourly' }],
			params: {
				channelId: owner.channelId,
				notification: 'new_announcement',
				frequency: '={{ $json.how }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', canvasErrorCode: 'inclusion' });
		expect((await actual(owner, String(owner.channelId))).new_announcement.frequency).toBe(before);
	});

	it('errors: without "Act as User ID" another user\'s channel cannot be changed', async () => {
		const before = (await actual(other, otherChannelId)).new_announcement.frequency;
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'update',
			params: {
				channelId: otherChannelId,
				notification: 'new_announcement',
				frequency: before === 'never' ? 'daily' : 'never',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		// The channel is looked up among the caller's own channels.
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((await actual(other, otherChannelId)).new_announcement.frequency).toBe(before);
	});

	it('errors: users without the right to act for others are refused', async () => {
		const before = (await actual(other, otherChannelId)).new_announcement.frequency;
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'update',
			persona: asOwner,
			params: {
				channelId: otherChannelId,
				notification: 'new_announcement',
				frequency: before === 'never' ? 'daily' : 'never',
				options: { as_user_id: other.id },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect([401, 403]).toContain(result.error[0].errorCode);
		expect((await actual(other, otherChannelId)).new_announcement.frequency).toBe(before);
	});

	it('errors: a teacher may not read a student\'s preferences', async () => {
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'getAll',
			persona: 'sbxTeacher',
			params: { userId: owner.id, channelId: owner.channelId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'notificationPreference', operation: 'getAll' });
		expect([401, 403]).toContain(result.error[0].errorCode);
	});

	it('errors: an unknown channel is not found', async () => {
		const result = await runNode({
			resource: 'notificationPreference',
			operation: 'get',
			params: {
				userId: owner.id,
				channelBy: 'address',
				channelType: 'email',
				channelAddress: 'nobody@example.invalid',
				notification: 'new_announcement',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
