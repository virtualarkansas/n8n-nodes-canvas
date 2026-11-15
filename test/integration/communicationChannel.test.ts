import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: communicationChannel. All writes happen on a user created by this
 * file; the seeded multi-channel user is only read. Writes are verified by
 * reading the user's channels back from Canvas directly.
 */
describe('communicationChannel', () => {
	const account = fx('accountId');
	let userId = '';
	let loginEmail = '';
	let emailChannelId = '';

	const address = (prefix: string): string => `${unique(prefix).replace(/\s/g, '.')}@example.edu`;
	const channels = (id = userId): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${id}/communication_channels`);
	const summary = async (): Promise<Array<[unknown, unknown, unknown]>> =>
		(await channels()).map((c) => [c.type, c.address, c.workflow_state]);

	beforeAll(async () => {
		loginEmail = address('channel-user');
		const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name: unique('Channel Battery User'), skip_registration: true },
			pseudonym: { unique_id: loginEmail, send_confirmation: false },
		});
		userId = String(user.id);
	});

	afterAll(async () => {
		if (userId) await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${userId}`);
	});

	it('getAll: a new user has the channel of their login email', async () => {
		const listed = await runOk({ resource: 'communicationChannel', operation: 'getAll', params: { userId } });
		expect(listed.map((c) => [c.type, c.address])).toEqual([['email', loginEmail]]);
		expect(listed[0].user_id).toBe(Number(userId));
	});

	it('create: an email channel that is confirmed right away', async () => {
		const mail = `battery+tag.${Date.now()}@example.edu`;
		const [created] = await runOk({
			resource: 'communicationChannel',
			operation: 'create',
			params: { userId, channelType: 'email', address: mail, additionalFields: { skipConfirmation: true } },
		});
		emailChannelId = String(created.id);
		expect(created).toMatchObject({ type: 'email', address: mail, workflow_state: 'active', user_id: Number(userId) });
		expect(await summary()).toContainEqual(['email', mail, 'active']);
	});

	it('create: without "Skip Confirmation" the channel waits for the user; SMS is accepted too', async () => {
		const mail = address('unconfirmed');
		const [pending] = await runOk({
			resource: 'communicationChannel',
			operation: 'create',
			params: { userId: Number(userId), channelType: 'email', address: mail, additionalFields: { skipConfirmation: false } },
		});
		expect(pending.workflow_state).toBe('unconfirmed');
		expect(await summary()).toContainEqual(['email', mail, 'unconfirmed']);

		const sms = `501555${String(Date.now()).slice(-4)}@txt.att.net`;
		const [text] = await runOk({
			resource: 'communicationChannel',
			operation: 'create',
			params: { userId, channelType: 'sms', address: sms, additionalFields: { skipConfirmation: true } },
		});
		expect(text).toMatchObject({ type: 'sms', address: sms, workflow_state: 'active' });
		expect(await summary()).toContainEqual(['sms', sms, 'active']);
	});

	it('create: an address the user already has, and push without SNS, are refused with Canvas\' message', async () => {
		const duplicate = await runNode({
			resource: 'communicationChannel',
			operation: 'create',
			params: { userId, channelType: 'email', address: loginEmail, errorHandling: { onError: 'continueWithError' } },
		});
		expect(duplicate.success).toEqual([]);
		expect(duplicate.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'communicationChannel', operation: 'create' });
		expect(JSON.stringify(duplicate.error[0].canvasErrors)).toContain('unique!');

		// Push needs a developer key with Amazon SNS; a plain access token is refused.
		const before = await summary();
		const push = await runNode({
			resource: 'communicationChannel',
			operation: 'create',
			params: {
				userId,
				channelType: 'push',
				address: 'ignored-for-push',
				additionalFields: { token: 'device-token-123' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(push.success).toEqual([]);
		expect(push.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(push.error[0].errorMessage)).toContain('SNS is not configured');
		expect(await summary()).toEqual(before);
	});

	it('getAll: lists every channel of a user in Canvas\' order; retired channels are left out', async () => {
		const seeded = fx('multiChannelUserId');
		const expected = await channels(seeded);
		expect(expected.length).toBeGreaterThanOrEqual(3);

		const listed = await runOk({ resource: 'communicationChannel', operation: 'getAll', params: { userId: seeded, pagination: { perPage: 2, returnAll: true } } });
		expect(listed.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(listed.map((c) => c.id)).toContain(Number(fx('unconfirmedCommunicationChannelId')));
		expect(listed.map((c) => c.id)).toContain(Number(fx('smsCommunicationChannelId')));
		expect(listed.map((c) => c.id)).not.toContain(Number(fx('retiredCommunicationChannelId')));

		const firstPage = await runOk({ resource: 'communicationChannel', operation: 'getAll', params: { userId: seeded, pagination: { perPage: 2, maxPages: 1 } } });
		expect(firstPage.map((c) => c.id)).toEqual(expected.slice(0, 2).map((c) => c.id));

		const [own] = await runOk({ resource: 'communicationChannel', operation: 'getAll', persona: 'student', params: { userId: 'self' } });
		expect(own.user_id).toBe(Number(fx('studentUserId')));
	});

	it('delete: by ID, and by type and address (with characters that need URL encoding)', async () => {
		const mail = `battery+delete.${Date.now()}@example.edu`;
		await canvas().post(`/api/v1/users/${userId}/communication_channels`, { communication_channel: { type: 'email', address: mail }, skip_confirmation: true });

		const [byAddress] = await runOk({
			resource: 'communicationChannel',
			operation: 'delete',
			params: { userId, deleteBy: 'typeAndAddress', channelType: 'email', address: mail },
		});
		expect(byAddress).toMatchObject({ address: mail, workflow_state: 'retired' });
		expect((await summary()).map((c) => c[1])).not.toContain(mail);

		const result = await runNode({
			resource: 'communicationChannel',
			operation: 'delete',
			items: [{ channel: Number(emailChannelId) }, { channel: 99999999 }],
			params: { userId: Number(userId), deleteBy: 'id', channelId: '={{ $json.channel }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((c) => [c.id, c.workflow_state])).toEqual([[Number(emailChannelId), 'retired']]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'communicationChannel', operation: 'delete' });
		expect((await channels()).map((c) => c.id)).not.toContain(Number(emailChannelId));

		// Deleting the same address again: nothing left to delete.
		const again = await runNode({
			resource: 'communicationChannel',
			operation: 'delete',
			params: { userId, deleteBy: 'typeAndAddress', channelType: 'email', address: mail, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('errors: a student may not read or change another user\'s channels', async () => {
		const before = await summary();
		for (const [operation, params] of [
			['getAll', {}],
			['create', { channelType: 'email', address: address('intruder') }],
		] as const) {
			const result = await runNode({
				resource: 'communicationChannel',
				operation,
				persona: 'student',
				params: { userId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error).toHaveLength(1);
			expect([401, 403], operation).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'communicationChannel', operation });
		}
		expect(await summary()).toEqual(before);
	});
});
