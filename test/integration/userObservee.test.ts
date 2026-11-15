import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: userObservee. Observation links are only created between users made
 * by this file; the seeded observer/observee pair is read, never changed.
 *
 * Not verifiable on the local Canvas (stated, not skipped silently):
 *  - pairing codes: need self-registration on the account's authentication provider,
 *    so only Canvas' refusal of an invalid code is exercised;
 *  - access tokens: a token the battery can mint for its own user stays "pending" and
 *    Canvas does not accept it, so only the refusal path is exercised.
 */
describe('userObservee', () => {
	const account = fx('accountId');
	const password = fx('defaultPassword');
	let observerId = '';
	const students: Array<{ id: string; login: string }> = [];

	const observees = (): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${observerId}/observees`);
	const observeeIds = async (): Promise<number[]> => (await observees()).map((u) => Number(u.id));

	beforeAll(async () => {
		const mk = async (name: string): Promise<{ id: string; login: string }> => {
			const login = `${unique('observee').replace(/\s/g, '.')}@example.edu`;
			const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
				user: { name, skip_registration: true },
				pseudonym: { unique_id: login, send_confirmation: false, password },
			});
			return { id: String(user.id), login };
		};
		observerId = (await mk(unique('Observee Battery Parent'))).id;
		// More observees than one default page holds.
		for (let i = 1; i <= 13; i++) {
			students.push(await mk(`${unique('Observee Battery Child')} ${String(i).padStart(2, '0')}`));
		}
	});

	afterAll(async () => {
		for (const id of [observerId, ...students.map((s) => s.id)]) {
			if (id) await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
	});

	it('add: links an observee by ID, for several input items', async () => {
		const result = await runNode({
			resource: 'userObservee',
			operation: 'add',
			items: [...students.slice(0, 12).map((s) => ({ student: Number(s.id) })), { student: 99999999 }],
			params: { userId: Number(observerId), observeeId: '={{ $json.student }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((u) => u.id)).toEqual(students.slice(0, 12).map((s) => Number(s.id)));
		expect(result.success[0].observation_link_root_account_ids).toEqual([Number(account)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'userObservee', operation: 'add' });
		expect((await observeeIds()).sort()).toEqual(students.slice(0, 12).map((s) => Number(s.id)).sort());
	});

	it('add: with a root account; adding the same observee twice is harmless', async () => {
		const last = students[12];
		for (let attempt = 0; attempt < 2; attempt++) {
			const [linked] = await runOk({
				resource: 'userObservee',
				operation: 'add',
				params: { userId: observerId, observeeId: last.id, additionalFields: { rootAccountId: account } },
			});
			expect(linked).toMatchObject({ id: Number(last.id), observation_link_root_account_ids: [Number(account)] });
		}
		expect((await observeeIds()).filter((id) => id === Number(last.id))).toHaveLength(1);
		expect(await observeeIds()).toHaveLength(13);
	});

	it('getAll: pages through the observees', async () => {
		const expected = await observees();
		expect(expected).toHaveLength(13);

		const defaults = await runOk({ resource: 'userObservee', operation: 'getAll', params: { userId: observerId } });
		expect(defaults.map((u) => u.id)).toEqual(expected.map((u) => u.id));

		const all = await runOk({
			resource: 'userObservee',
			operation: 'getAll',
			params: { userId: observerId, additionalFields: { include: ['avatar_url'] }, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(all[0]).toHaveProperty('avatar_url');
		expect(all[0].observation_link_root_account_ids).toEqual([Number(account)]);

		const twoPages = await runOk({ resource: 'userObservee', operation: 'getAll', params: { userId: observerId, pagination: { perPage: 4, maxPages: 2 } } });
		expect(twoPages.map((u) => u.id)).toEqual(expected.slice(0, 8).map((u) => u.id));
		expect(new Set(twoPages.map((u) => u.id)).size).toBe(8);
	});

	it('getAll and listObservers: the seeded observer and student see each other (read-only); a user without links yields nothing', async () => {
		const seededObservees = await canvas().getAll<Json>(`/api/v1/users/${fx('observerUserId')}/observees`);
		const own = await runOk({ resource: 'userObservee', operation: 'getAll', persona: 'observer', params: { userId: 'self' } });
		expect(own.map((u) => u.id)).toEqual(seededObservees.map((u) => u.id));
		expect(own.map((u) => u.id)).toContain(Number(fx('observeeUserId')));

		const expected = await canvas().getAll<Json>(`/api/v1/users/${fx('observeeUserId')}/observers`);
		const observers = await runOk({
			resource: 'userObservee',
			operation: 'listObservers',
			params: { userId: fx('observeeUserId'), additionalFields: { include: ['avatar_url'] }, pagination: { returnAll: true } },
		});
		expect(observers.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(observers.map((u) => u.id)).toContain(Number(fx('observerUserId')));
		expect(observers[0]).toHaveProperty('avatar_url');

		const none = await runNode({ resource: 'userObservee', operation: 'listObservers', params: { userId: observerId } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);
	});

	it('get and getObserver: return the linked user from either side; unlinked users are a 404', async () => {
		const student = students[0];
		const [observee] = await runOk({ resource: 'userObservee', operation: 'get', params: { userId: observerId, observeeId: student.id } });
		expect(observee).toMatchObject({ id: Number(student.id), observation_link_root_account_ids: [Number(account)] });

		const [observer] = await runOk({ resource: 'userObservee', operation: 'getObserver', params: { userId: student.id, observerId } });
		expect(observer).toMatchObject({ id: Number(observerId), observation_link_root_account_ids: [Number(account)] });

		for (const [operation, params] of [
			['get', { userId: observerId, observeeId: fx('studentUserId') }],
			['getObserver', { userId: student.id, observerId: fx('teacherUserId') }],
		] as const) {
			const result = await runNode({ resource: 'userObservee', operation, params: { ...params, errorHandling: { onError: 'continueWithError' } } });
			expect(result.success, operation).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'userObservee', operation });
		}
	});

	it('remove: unlinks an observee; removing again is a 404', async () => {
		const student = students[0];
		const [removed] = await runOk({
			resource: 'userObservee',
			operation: 'remove',
			params: { userId: observerId, observeeId: student.id, additionalFields: { rootAccountId: account } },
		});
		expect(removed).toMatchObject({ id: Number(student.id), observation_link_root_account_ids: [] });
		expect(await observeeIds()).not.toContain(Number(student.id));
		expect(await observeeIds()).toHaveLength(12);

		const again = await runNode({
			resource: 'userObservee',
			operation: 'remove',
			params: { userId: observerId, observeeId: student.id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'userObservee', operation: 'remove' });
	});

	it('addWithCredentials: the observee\'s login and password create the link; wrong credentials do not', async () => {
		const student = students[0];
		const wrong = await runNode({
			resource: 'userObservee',
			operation: 'addWithCredentials',
			params: {
				userId: observerId,
				addMethod: 'credentials',
				uniqueId: student.login,
				password: 'not-the-password',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrong.success).toEqual([]);
		expect(wrong.error[0]).toMatchObject({ errorCode: 401, errorType: 'UNAUTHORIZED', resource: 'userObservee', operation: 'addWithCredentials' });
		expect(String(wrong.error[0].errorMessage)).toContain('Invalid credentials');
		expect(await observeeIds()).not.toContain(Number(student.id));

		const unknown = await runNode({
			resource: 'userObservee',
			operation: 'addWithCredentials',
			params: {
				userId: observerId,
				addMethod: 'credentials',
				uniqueId: 'nobody.at.all@example.edu',
				password: 'x',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR' });
		expect(String(unknown.error[0].errorMessage)).toContain('Unknown observee');

		const [linked] = await runOk({
			resource: 'userObservee',
			operation: 'addWithCredentials',
			params: {
				userId: observerId,
				addMethod: 'credentials',
				uniqueId: student.login,
				password,
				additionalFields: { rootAccountId: account },
			},
		});
		expect(linked).toMatchObject({ id: Number(student.id), observation_link_root_account_ids: [Number(account)] });
		expect(await observeeIds()).toContain(Number(student.id));
	});

	it('addWithCredentials: an invalid pairing code and an unusable access token are refused with Canvas\' message', async () => {
		const before = await observeeIds();

		const pairing = await runNode({
			resource: 'userObservee',
			operation: 'addWithCredentials',
			params: { userId: observerId, addMethod: 'pairingCode', pairingCode: 'NOPE00', errorHandling: { onError: 'continueWithError' } },
		});
		expect(pairing.success).toEqual([]);
		expect(pairing.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'userObservee', operation: 'addWithCredentials' });
		expect(String(pairing.error[0].errorMessage)).toContain('Invalid pairing code');

		// Canvas answers "Unknown observee" only on its access-token path, so this also shows
		// that the token is read from the request body.
		const token = await runNode({
			resource: 'userObservee',
			operation: 'addWithCredentials',
			params: { userId: observerId, addMethod: 'accessToken', accessToken: 'not-a-real-token', errorHandling: { onError: 'continueWithError' } },
		});
		expect(token.success).toEqual([]);
		expect(token.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR' });
		expect(String(token.error[0].errorMessage)).toContain('Unknown observee');

		expect(await observeeIds()).toEqual(before);
	});

	it('errors: a student may not manage or read another user\'s observees', async () => {
		const before = await observeeIds();
		for (const [operation, params] of [
			['getAll', {}],
			['add', { observeeId: students[1].id }],
			['remove', { observeeId: students[1].id }],
		] as const) {
			const result = await runNode({
				resource: 'userObservee',
				operation,
				persona: 'student',
				params: { userId: observerId, ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error).toHaveLength(1);
			expect([401, 403, 404], operation).toContain(result.error[0].errorCode);
		}
		expect(await observeeIds()).toEqual(before);
	});
});
