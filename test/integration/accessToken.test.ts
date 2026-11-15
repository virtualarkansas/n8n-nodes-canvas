import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { failureText, ids, pairedItems, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: accessToken. Tokens are only ever created, changed and deleted on
 * a user made for this file: the tokens of the seeded personas (which the other
 * workers authenticate with) are never touched.
 *
 * A token an admin creates for another user is "pending" until that user
 * activates it, so nothing created here can be used to call the API.
 */
describe('accessToken', () => {
	const root = fx('accountId');
	let userId = '';
	let otherUserId = '';
	let tokenId = '';
	let tokenValue = '';
	const purpose = unique('Battery token Ünïcødé 令牌 "quoted" & <b>tags</b>');
	const scopes = ['url:GET|/api/v1/courses', 'url:GET|/api/v1/users/:user_id/profile'];

	const token = (id: string, user = userId): Promise<Json> => canvas().get<Json>(`/api/v1/users/${user}/tokens/${id}`);
	const listed = (user = userId): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${user}/user_generated_tokens`);

	const makeUser = async (label: string): Promise<string> => {
		const login = `${unique(`n8nbat.token.${label}`).replace(/\s/g, '.')}@example.edu`;
		const user = await canvas().post<Json>(`/api/v1/accounts/${root}/users`, {
			user: { name: unique(`Battery token ${label}`), skip_registration: true },
			pseudonym: { unique_id: login, send_confirmation: false },
		});
		return String(user.id);
	};

	beforeAll(async () => {
		userId = await makeUser('owner');
		otherUserId = await makeUser('other');
	});

	afterAll(async () => {
		for (const user of [userId, otherUserId].filter(Boolean)) {
			for (const t of await canvas().getAll<Json>(`/api/v1/users/${user}/user_generated_tokens`).catch(() => [])) {
				await canvas().request('DELETE', `/api/v1/users/${user}/tokens/${String(t.id)}`);
			}
			await canvas().request('DELETE', `/api/v1/accounts/${root}/users/${user}`);
		}
	});

	// ------------------------------------------------------------------ create

	it('create: every optional field reaches Canvas; the token value is returned once', async () => {
		const [created] = await runOk({
			resource: 'accessToken',
			operation: 'create',
			params: {
				userId,
				purpose,
				additionalFields: { expires_at: '2031-06-30T23:59:00Z', scopes: ` ${scopes[0]} , ${scopes[1]}` },
			},
		});
		tokenId = String(created.id);
		tokenValue = String(created.visible_token);
		expect(created).toMatchObject({
			purpose,
			user_id: Number(userId),
			expires_at: '2031-06-30T23:59:00Z',
			scopes,
			// Created by an admin for someone else: unusable until the user activates it.
			workflow_state: 'pending',
			app_name: 'User-Generated',
		});
		expect(tokenValue.length).toBeGreaterThan(40);
		expect(tokenValue).not.toContain('...');

		const actual = await token(tokenId);
		expect(actual).toMatchObject({
			id: Number(tokenId),
			purpose,
			user_id: Number(userId),
			expires_at: '2031-06-30T23:59:00Z',
			scopes,
			workflow_state: 'pending',
		});
		// Afterwards Canvas only shows the first characters.
		expect(actual.visible_token).toBe(`${tokenValue.slice(0, 5)}...`);
	});

	it('create: without optional fields the token never expires and is not limited by scopes', async () => {
		const [created] = await runOk({
			resource: 'accessToken',
			operation: 'create',
			params: { userId: otherUserId, purpose: 'Minimal' },
		});
		expect(await token(String(created.id), otherUserId)).toMatchObject({
			purpose: 'Minimal',
			expires_at: null,
			scopes: [],
			user_id: Number(otherUserId),
		});
	});

	it('create: several items (more tokens than one page), scopes arriving as a list', async () => {
		const items = Array.from({ length: 12 }, (_, i) => ({
			user: Number(userId),
			purpose: `Battery bulk token ${String(i).padStart(2, '0')}`,
			scopes: i % 2 === 0 ? [scopes[0]] : [],
		}));
		const created = await runOk({
			resource: 'accessToken',
			operation: 'create',
			items,
			params: {
				userId: '={{ $json.user }}',
				purpose: '={{ $json.purpose }}',
				additionalFields: { scopes: '={{ $json.scopes }}' },
			},
		});
		expect(created).toHaveLength(12);
		expect(created.map((t) => t.purpose).sort()).toEqual(items.map((i) => i.purpose).sort());
		const actual = await listed();
		expect(actual).toHaveLength(13);
		const first = actual.find((t) => t.purpose === 'Battery bulk token 00')!;
		expect(first.scopes).toEqual([scopes[0]]);
		expect(actual.find((t) => t.purpose === 'Battery bulk token 01')!.scopes).toEqual([]);
	});

	it('create: an unknown user, a blank purpose and a lesser persona are refused', async () => {
		const unknownUser = await runNode({
			resource: 'accessToken',
			operation: 'create',
			params: { userId: '99999999', purpose: 'Nobody', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknownUser.success).toEqual([]);
		expect(unknownUser.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'accessToken',
			operation: 'create',
		});

		const blank = await runNode({
			resource: 'accessToken',
			operation: 'create',
			items: [{ purpose: '' }],
			params: { userId, purpose: '={{ $json.purpose }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(blank.success).toEqual([]);
		expect(blank.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(blank.error[0].canvasErrors)).toContain('purpose');

		const asTeacher = await runNode({
			resource: 'accessToken',
			operation: 'create',
			persona: 'teacher',
			params: { userId, purpose: 'Not allowed', errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect([401, 403, 404]).toContain(asTeacher.error[0].errorCode);
		expect((await listed()).map((t) => t.purpose)).not.toContain('Not allowed');
	});

	// --------------------------------------------------------------------- get

	it('get: by ID and by token hint; never returns the full token value again', async () => {
		const [byId] = await runOk({ resource: 'accessToken', operation: 'get', params: { userId, tokenId } });
		expect(byId).toMatchObject({ id: Number(tokenId), purpose, scopes });
		expect(byId.visible_token).toBe(`${tokenValue.slice(0, 5)}...`);

		const [byHint] = await runOk({
			resource: 'accessToken',
			operation: 'get',
			params: { userId, tokenId: tokenValue.slice(0, 5) },
		});
		expect(byHint.id).toBe(Number(tokenId));
	});

	it('get: several items; a token of another user and an unknown token are not found', async () => {
		const others = await listed(otherUserId);
		const result = await runNode({
			resource: 'accessToken',
			operation: 'get',
			items: [{ id: Number(tokenId) }, { id: Number(others[0].id) }, { id: 99999999 }],
			params: { userId, tokenId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((t) => t.id)).toEqual([Number(tokenId)]);
		expect(pairedItems(result)).toEqual([0]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });
		}
	});

	it('get: another user may not read the token', async () => {
		const result = await runNode({
			resource: 'accessToken',
			operation: 'get',
			persona: 'teacher',
			params: { userId, tokenId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect([401, 403, 404]).toContain(result.error[0].errorCode);
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: lists the user\'s manually generated tokens; Return All and Limit are honoured', async () => {
		const expected = await listed();
		expect(expected).toHaveLength(13);

		const all = await runOk({
			resource: 'accessToken',
			operation: 'getAll',
			params: { userId, returnAll: true },
		});
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(13);
		expect(all.every((t) => String(t.visible_token).endsWith('...'))).toBe(true);

		const limited = await runOk({
			resource: 'accessToken',
			operation: 'getAll',
			params: { userId, returnAll: false, limit: 5 },
		});
		expect(limited).toHaveLength(5);
		expect(limited.map((t) => t.id)).toEqual(expected.slice(0, 5).map((t) => t.id));

		// Default: up to 50.
		const defaults = await runOk({ resource: 'accessToken', operation: 'getAll', params: { userId } });
		expect(defaults).toHaveLength(13);

		// Crossing a page boundary (Canvas pages by 10 unless told otherwise).
		const eleven = await runOk({
			resource: 'accessToken',
			operation: 'getAll',
			params: { userId, returnAll: false, limit: 11, pagination: { perPage: 4 } },
		});
		expect(eleven).toHaveLength(11);
		expect(new Set(ids(eleven)).size).toBe(11);
	});

	it('getAll: a user without tokens yields no items; a lesser persona is refused', async () => {
		const empty = await makeUser('empty');
		try {
			const none = await runNode({ resource: 'accessToken', operation: 'getAll', params: { userId: empty } });
			expect(none.ok).toBe(true);
			expect(none.success).toEqual([]);
		} finally {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/users/${empty}`);
		}

		const asTeacher = await runNode({
			resource: 'accessToken',
			operation: 'getAll',
			persona: 'teacher',
			params: { userId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect([401, 403, 404]).toContain(asTeacher.error[0].errorCode);
	});

	// ------------------------------------------------------------------ update

	it('update: purpose, expiry and scopes reach Canvas', async () => {
		const renamed = `${purpose} (renamed)`;
		const [updated] = await runOk({
			resource: 'accessToken',
			operation: 'update',
			params: {
				userId,
				tokenId,
				updateFields: { purpose: renamed, expires_at: '2032-01-15T08:00:00Z', scopes: scopes[1] },
			},
		});
		expect(updated.purpose).toBe(renamed);
		expect(await token(tokenId)).toMatchObject({
			purpose: renamed,
			expires_at: '2032-01-15T08:00:00Z',
			scopes: [scopes[1]],
		});
		// The value itself did not change.
		expect((await token(tokenId)).visible_token).toBe(`${tokenValue.slice(0, 5)}...`);
	});

	it('update: Regenerate issues a new token value, addressed by the old hint', async () => {
		const [regenerated] = await runOk({
			resource: 'accessToken',
			operation: 'update',
			params: { userId, tokenId: tokenValue.slice(0, 5), updateFields: { regenerate: true } },
		});
		const newValue = String(regenerated.visible_token);
		expect(regenerated.id).toBe(Number(tokenId));
		expect(newValue.length).toBeGreaterThan(40);
		expect(newValue).not.toBe(tokenValue);
		expect((await token(tokenId)).visible_token).toBe(`${newValue.slice(0, 5)}...`);
		tokenValue = newValue;

		// Regenerate: off changes nothing.
		const [unchanged] = await runOk({
			resource: 'accessToken',
			operation: 'update',
			params: { userId, tokenId, updateFields: { regenerate: false, purpose } },
		});
		expect(unchanged.visible_token).toBe(`${newValue.slice(0, 5)}...`);
		expect((await token(tokenId)).purpose).toBe(purpose);
	});

	it('update: an expired token can only be regenerated together with a new expiry', async () => {
		await runOk({
			resource: 'accessToken',
			operation: 'update',
			params: { userId, tokenId, updateFields: { expires_at: '2020-01-01T00:00:00Z' } },
		});
		expect((await token(tokenId)).can_manually_regenerate).toBe(false);

		const refused = await runNode({
			resource: 'accessToken',
			operation: 'update',
			params: { userId, tokenId, updateFields: { regenerate: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect(String(refused.error[0].errorMessage)).toContain(
			'cannot regenerate an expired token without a new expiration date',
		);

		const [renewed] = await runOk({
			resource: 'accessToken',
			operation: 'update',
			params: { userId, tokenId, updateFields: { regenerate: true, expires_at: '2033-03-03T03:03:00Z' } },
		});
		expect(String(renewed.visible_token)).not.toContain('...');
		expect(await token(tokenId)).toMatchObject({ expires_at: '2033-03-03T03:03:00Z', can_manually_regenerate: true });
	});

	it('update: nothing to update, an unknown token and a lesser persona are errors', async () => {
		const nothing = await runNode({
			resource: 'accessToken',
			operation: 'update',
			params: { userId, tokenId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.success).toEqual([]);
		expect(failureText(nothing)).toMatch(/at least one field/i);

		const unknown = await runNode({
			resource: 'accessToken',
			operation: 'update',
			params: {
				userId,
				tokenId: '99999999',
				updateFields: { purpose: 'Nope' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const asTeacher = await runNode({
			resource: 'accessToken',
			operation: 'update',
			persona: 'teacher',
			params: { userId, tokenId, updateFields: { purpose: 'Hijacked' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect([401, 403, 404]).toContain(asTeacher.error[0].errorCode);
		expect((await token(tokenId)).purpose).toBe(purpose);
	});

	// ------------------------------------------------------------------ delete

	it('delete: removes tokens by ID and by hint; several items with an unknown one in between', async () => {
		const tokens = await listed();
		const bulk = tokens.filter((t) => String(t.purpose).startsWith('Battery bulk token'));
		const result = await runNode({
			resource: 'accessToken',
			operation: 'delete',
			items: [{ id: Number(bulk[0].id) }, { id: 99999999 }, { id: String(bulk[1].visible_token).slice(0, 5) }],
			params: { userId, tokenId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((t) => t.id)).toEqual([bulk[0].id, bulk[1].id]);
		expect(pairedItems(result)).toEqual([0, 2]);
		expect(result.success.every((t) => t.workflow_state === 'deleted')).toBe(true);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });

		const remaining = await listed();
		expect(remaining).toHaveLength(11);
		expect(ids(remaining)).not.toContain(Number(bulk[0].id));
		expect(ids(remaining)).not.toContain(Number(bulk[1].id));
		const gone = await canvas().request('GET', `/api/v1/users/${userId}/tokens/${String(bulk[0].id)}`);
		expect(gone.status).toBe(404);
	});

	it('delete: a deleted token cannot be deleted again, and a lesser persona is refused', async () => {
		const [deleted] = await runOk({ resource: 'accessToken', operation: 'delete', params: { userId, tokenId } });
		expect(deleted).toMatchObject({ id: Number(tokenId), workflow_state: 'deleted' });

		const again = await runNode({
			resource: 'accessToken',
			operation: 'delete',
			params: { userId, tokenId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const others = await listed(otherUserId);
		const asTeacher = await runNode({
			resource: 'accessToken',
			operation: 'delete',
			persona: 'teacher',
			params: { userId: otherUserId, tokenId: String(others[0].id), errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect([401, 403, 404]).toContain(asTeacher.error[0].errorCode);
		expect(await listed(otherUserId)).toHaveLength(1);
	});
});
