import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: user. Everything destructive happens on users created by this file;
 * seeded users are only read. Writes are verified by reading the user, profile,
 * logins and communication channels back from Canvas directly.
 *
 * The account's user list changes while the battery runs (other files create and
 * delete users), so list checks use users created here or invariants that hold
 * for any snapshot (page sizes, ordering, no duplicates).
 */
describe('user', () => {
	const account = fx('accountId');
	const createdIds: string[] = [];
	const tag = unique('zqbat').replace(/[\s-]/g, '');
	const searchIds: number[] = [];
	let userId = '';
	let sisId = '';

	const slug = (prefix: string): string => `${unique(prefix).replace(/\s/g, '.')}@example.edu`;
	const getUser = (id: string, query = ''): Promise<Json> => canvas().get<Json>(`/api/v1/users/${id}${query}`);
	const getProfile = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/users/${id}/profile`);
	const getLogins = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${id}/logins`);
	const getChannels = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${id}/communication_channels`);

	/** A user made directly in Canvas for a test; removed in afterAll. */
	const makeUser = async (name: string, extra: Json = {}): Promise<Json> => {
		const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name, skip_registration: true },
			pseudonym: { unique_id: slug('user'), send_confirmation: false, ...extra },
		});
		createdIds.push(String(user.id));
		return user;
	};

	beforeAll(async () => {
		for (let i = 1; i <= 12; i++) {
			const user = await makeUser(`${tag} Person ${String(i).padStart(2, '0')}`);
			searchIds.push(Number(user.id));
		}
	});

	afterAll(async () => {
		for (const id of createdIds) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
	});

	it('create: every optional field reaches Canvas', async () => {
		const login = slug('login');
		const email = slug('mail');
		sisId = unique('SIS-U').replace(/\s/g, '_');
		const integrationId = unique('INT-U').replace(/\s/g, '_');
		const name = unique('Battery Üser 测试 "quoted" & <b>tags</b> 🎓');
		const [created] = await runOk({
			resource: 'user',
			operation: 'create',
			params: {
				accountId: account,
				name,
				uniqueId: login,
				additionalFields: {
					authenticationProviderId: 'canvas',
					destination: `${canvas().url}/courses`,
					email,
					enableSisReactivation: false,
					forceSelfRegistration: false,
					forceValidations: false,
					integrationId,
					locale: 'es',
					password: fx('defaultPassword'),
					sendConfirmation: false,
					shortName: 'Shorty',
					sisUserId: sisId,
					skipConfirmation: true,
					skipRegistration: true,
					sortableName: 'Sortable, Name',
					termsOfUse: true,
					timeZone: 'Europe/Berlin',
				},
			},
		});
		userId = String(created.id);
		createdIds.push(userId);
		expect(created.name).toBe(name);
		// A password plus a destination on this Canvas yields a one-time login URL.
		expect(String(created.destination)).toContain('session_token=');

		expect(await getUser(userId)).toMatchObject({
			name,
			short_name: 'Shorty',
			sortable_name: 'Sortable, Name',
			sis_user_id: sisId,
			integration_id: integrationId,
			login_id: login,
			email,
			locale: 'es',
		});
		expect(await getProfile(userId)).toMatchObject({ primary_email: email, login_id: login, time_zone: 'Europe/Berlin', locale: 'es' });

		const logins = await getLogins(userId);
		expect(logins).toHaveLength(1);
		expect(logins[0]).toMatchObject({
			unique_id: login,
			sis_user_id: sisId,
			integration_id: integrationId,
			authentication_provider_id: Number(fx('canvasAuthenticationProviderId')),
			workflow_state: 'active',
		});

		const channels = await getChannels(userId);
		expect(channels.map((c) => [c.type, c.address, c.workflow_state])).toEqual([['email', email, 'active']]);
	});

	it('create: an unconfirmed email with "Return Confirmation URL"; a login that is no email address gets no channel', async () => {
		const email = slug('pending');
		const [pending] = await runOk({
			resource: 'user',
			operation: 'create',
			params: {
				accountId: account,
				name: unique('Pending Person'),
				uniqueId: unique('plain-login').replace(/\s/g, '_'),
				additionalFields: { email, confirmationUrl: true, sendConfirmation: false },
			},
		});
		createdIds.push(String(pending.id));
		expect(String(pending.confirmation_url)).toMatch(/^https?:\/\/.+\/register\//);
		expect((await getChannels(String(pending.id))).map((c) => [c.address, c.workflow_state])).toEqual([[email, 'unconfirmed']]);

		const [bare] = await runOk({
			resource: 'user',
			operation: 'create',
			params: { accountId: account, name: unique('No Mail'), uniqueId: unique('nomail').replace(/\s/g, '_') },
		});
		createdIds.push(String(bare.id));
		expect(await getChannels(String(bare.id))).toEqual([]);
	});

	it('create: "Enable SIS Reactivation" revives a deleted user with the same SIS ID', async () => {
		const reviveSis = unique('SIS-REVIVE').replace(/\s/g, '_');
		const original = await makeUser(unique('To Be Revived'), { sis_user_id: reviveSis });
		await canvas().delete(`/api/v1/accounts/${account}/users/${String(original.id)}`);

		const [revived] = await runOk({
			resource: 'user',
			operation: 'create',
			params: {
				accountId: account,
				name: 'Revived',
				uniqueId: slug('revived'),
				additionalFields: { sisUserId: reviveSis, enableSisReactivation: true, skipRegistration: true, sendConfirmation: false },
			},
		});
		expect(revived.id).toBe(original.id);
		expect((await getUser(String(original.id))).sis_user_id).toBe(reviveSis);
	});

	it('create: a login that already exists is rejected with Canvas\' validation errors; students may not create users', async () => {
		const existing = String((await getLogins(userId))[0].unique_id);
		const duplicate = await runNode({
			resource: 'user',
			operation: 'create',
			params: { accountId: account, name: unique('Duplicate'), uniqueId: existing, errorHandling: { onError: 'continueWithError' } },
		});
		expect(duplicate.success).toEqual([]);
		expect(duplicate.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'user', operation: 'create' });
		expect(JSON.stringify(duplicate.error[0].canvasErrors)).toContain('unique_id');

		const forbidden = await runNode({
			resource: 'user',
			operation: 'create',
			persona: 'student',
			params: {
				accountId: account,
				name: unique('Forbidden'),
				uniqueId: slug('forbidden'),
				additionalFields: { password: fx('defaultPassword') },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error).toHaveLength(1);
		expect([400, 401, 403]).toContain(forbidden.error[0].errorCode);
	});

	it('get: includes, SIS IDs (also with characters that need URL encoding) and IDs from expressions', async () => {
		const [user] = await runOk({
			resource: 'user',
			operation: 'get',
			params: { userId, additionalFields: { include: ['avatar_state', 'last_login', 'uuid'] } },
		});
		expect(user).toMatchObject({ id: Number(userId), sis_user_id: sisId });
		expect(user.uuid).toBeTypeOf('string');
		expect(user).toHaveProperty('last_login');
		expect(user).toHaveProperty('avatar_state');

		const [bySis] = await runOk({ resource: 'user', operation: 'get', params: { userId: `sis_user_id:${sisId}` } });
		expect(bySis.id).toBe(Number(userId));

		const [odd] = await runOk({
			resource: 'user',
			operation: 'get',
			params: { userId: `sis_user_id:${encodeURIComponent(fx('oddSisUserSisId'))}` },
		});
		expect(odd.id).toBe(Number(fx('oddSisUserId')));

		const result = await runNode({
			resource: 'user',
			operation: 'get',
			items: [{ id: Number(fx('studentUserId')) }, { id: 99999999 }, { id: Number(fx('unicodeUserId')) }, { id: Number(fx('deletedUserId')) }],
			params: { userId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((u) => u.id)).toEqual([Number(fx('studentUserId')), Number(fx('unicodeUserId'))]);
		expect(result.rawSuccess.map((u) => (u.pairedItem as Json).item)).toEqual([0, 2]);
		// Canvas answers 404 for a missing user and for a deleted one.
		expect(result.error.map((e) => [e.errorCode, e.errorType])).toEqual([[404, 'NOT_FOUND'], [404, 'NOT_FOUND']]);
	});

	it('getSelf: returns the user of the credential in use', async () => {
		for (const [persona, fixture] of [['admin', 'adminUserId'], ['teacher', 'teacherUserId'], ['student', 'studentUserId']] as const) {
			const [self] = await runOk({ resource: 'user', operation: 'getSelf', persona, params: { additionalFields: { include: ['uuid'] } } });
			expect(self.id, persona).toBe(Number(fx(fixture)));
			expect(self.uuid).toBeTypeOf('string');
		}
	});

	it('getProfile: returns the profile, also for "self"', async () => {
		const expected = await getProfile(fx('teacherUserId'));
		const [profile] = await runOk({ resource: 'user', operation: 'getProfile', params: { userId: fx('teacherUserId') } });
		expect(profile).toMatchObject({ id: expected.id, login_id: expected.login_id, primary_email: expected.primary_email, time_zone: expected.time_zone });

		const [own] = await runOk({ resource: 'user', operation: 'getProfile', persona: 'student', params: { userId: 'self' } });
		expect(own.id).toBe(Number(fx('studentUserId')));

		const other = await runNode({
			resource: 'user',
			operation: 'getProfile',
			persona: 'student',
			params: { userId: fx('adminUserId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(other.success).toEqual([]);
		expect([401, 403, 404]).toContain(other.error[0].errorCode);
	});

	/** The first pages of the account's users straight from Canvas, oldest users first. */
	const directPages = async (perPage: number, pages: number): Promise<number[]> => {
		const ids: number[] = [];
		let next: string | undefined = `/api/v1/accounts/${account}/users?sort=id&order=asc&per_page=${perPage}`;
		for (let page = 0; page < pages && next; page++) {
			const res = await canvas().request('GET', next);
			ids.push(...(res.data as Json[]).map((u) => Number(u.id)));
			next = /<([^>]+)>\s*;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1];
		}
		return ids;
	};

	it('getAll: returns exactly the pages Canvas serves, without gaps or duplicates', async () => {
		const byId = { sort: 'id', order: 'asc' };

		// Default paging: 5 pages of 10.
		const expectedDefault = await directPages(10, 5);
		expect(expectedDefault).toHaveLength(50);
		const defaults = await runOk({ resource: 'user', operation: 'getAll', params: { accountId: account, additionalFields: byId } });
		expect(defaults.map((u) => u.id)).toEqual(expectedDefault);

		const expectedSmall = await directPages(7, 3);
		const small = await runOk({ resource: 'user', operation: 'getAll', params: { accountId: account, additionalFields: byId, pagination: { perPage: 7, maxPages: 3 } } });
		expect(small.map((u) => u.id)).toEqual(expectedSmall);
		expect(small).toHaveLength(21);

		// Without an explicit sort the list still never exceeds the page budget or repeats a user.
		const unsorted = await runOk({ resource: 'user', operation: 'getAll', params: { accountId: account } });
		expect(unsorted.length).toBeLessThanOrEqual(50);
		expect(unsorted.length).toBeGreaterThan(40);
		expect(new Set(unsorted.map((u) => u.id)).size).toBe(unsorted.length);

		const all = await runOk({
			resource: 'user',
			operation: 'getAll',
			params: { accountId: account, additionalFields: byId, pagination: { returnAll: true } },
		});
		const ids = all.map((u) => Number(u.id));
		expect(ids.length).toBeGreaterThan(500);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual([...ids].sort((a, b) => a - b));
		expect(ids.slice(0, 50)).toEqual(expectedDefault);
		for (const id of [fx('teacherUserId'), fx('studentUserId'), fx('unicodeUserId'), ...searchIds.map(String)]) {
			expect(ids, `user ${id} missing from the full list`).toContain(Number(id));
		}
	});

	it('getAll: search, sort order and includes are applied', async () => {
		const found = await runOk({
			resource: 'user',
			operation: 'getAll',
			params: {
				accountId: account,
				additionalFields: {
					searchTerm: tag,
					sort: 'username',
					order: 'desc',
					include: ['avatar_url', 'email', 'last_login', 'time_zone', 'uuid'],
				},
				pagination: { perPage: 5, returnAll: true },
			},
		});
		expect(found.map((u) => u.id).sort()).toEqual([...searchIds].sort());
		const names = found.map((u) => String(u.sortable_name));
		expect(names).toEqual([...names].sort().reverse());
		for (const key of ['avatar_url', 'email', 'last_login', 'time_zone', 'uuid']) {
			expect(found[0], key).toHaveProperty(key);
		}

		const none = await runNode({ resource: 'user', operation: 'getAll', params: { accountId: account, additionalFields: { searchTerm: 'zz-no-such-user-zz' } } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);
	});

	it('getAll: enrollment type, deleted users and sub-accounts', async () => {
		const teachers = await runOk({
			resource: 'user',
			operation: 'getAll',
			params: { accountId: account, additionalFields: { enrollmentType: 'teacher', sort: 'id' }, pagination: { returnAll: true } },
		});
		const teacherIds = teachers.map((u) => Number(u.id));
		expect(teacherIds).toContain(Number(fx('teacherUserId')));
		expect(teacherIds).not.toContain(Number(fx('studentUserId')));
		expect(teacherIds.length).toBeLessThan(200);

		const gone = await makeUser(`${tag} Departed`);
		await canvas().delete(`/api/v1/accounts/${account}/users/${String(gone.id)}`);
		const withoutDeleted = await runOk({ resource: 'user', operation: 'getAll', params: { accountId: account, additionalFields: { searchTerm: `${tag} Departed` } } });
		expect(withoutDeleted.map((u) => u.id)).not.toContain(gone.id);

		// "Include Deleted Users": the local Canvas build itself fails on this option (its SQL refers
		// to a column the schema does not have), with or without the node. The option reaches Canvas
		// and the failure is reported; the listing of deleted users cannot be verified here.
		const direct = await canvas().request('GET', `/api/v1/accounts/${account}/users?include_deleted_users=true&per_page=5`);
		expect(direct.status).toBe(500);
		const withDeleted = await runNode({
			resource: 'user',
			operation: 'getAll',
			params: {
				accountId: account,
				additionalFields: { searchTerm: `${tag} Departed`, includeDeletedUsers: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(withDeleted.success).toEqual([]);
		expect(withDeleted.error[0]).toMatchObject({ errorCode: 500, errorType: 'SERVER_ERROR', resource: 'user', operation: 'getAll' });

		// Users created on the root account are not listed for a sub-account they have no course in.
		const inSub = await runOk({ resource: 'user', operation: 'getAll', params: { accountId: fx('subAccountId'), additionalFields: { searchTerm: tag } } });
		expect(inSub).toEqual([]);

		const asStudent = await runNode({
			resource: 'user',
			operation: 'getAll',
			persona: 'student',
			params: { accountId: account, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'user', operation: 'getAll' });
	});

	it('update: every optional field reaches Canvas', async () => {
		const email = slug('changed');
		const [updated] = await runOk({
			resource: 'user',
			operation: 'update',
			params: {
				userId,
				updateFields: {
					avatarUrl: 'https://example.com/avatar.png',
					bio: 'Bio with "quotes", <b>tags</b> & emoji 🎓',
					email,
					locale: 'fr',
					name: 'Renamed Üser',
					overrideSisStickiness: true,
					shortName: 'Ren',
					sortableName: 'Üser, Renamed',
					timeZone: 'Asia/Tokyo',
					title: 'Dr.',
				},
			},
		});
		expect(updated.id).toBe(Number(userId));

		expect(await getUser(userId, '?include[]=avatar_state')).toMatchObject({
			name: 'Renamed Üser',
			short_name: 'Ren',
			sortable_name: 'Üser, Renamed',
			locale: 'fr',
			email,
			// The avatar image itself is only served where avatars are enabled; the state shows it was set.
			avatar_state: 'approved',
		});
		expect(await getProfile(userId)).toMatchObject({
			bio: 'Bio with "quotes", <b>tags</b> & emoji 🎓',
			title: 'Dr.',
			time_zone: 'Asia/Tokyo',
			primary_email: email,
		});
	});

	it('update: empty profile texts are cleared; an empty name or email is not sent', async () => {
		const before = await getUser(userId);
		await runOk({
			resource: 'user',
			operation: 'update',
			params: { userId, updateFields: { bio: '', title: '', name: '', email: '', shortName: '' } },
		});
		expect(await getProfile(userId)).toMatchObject({ bio: '', title: '', primary_email: before.email });
		expect(await getUser(userId)).toMatchObject({ name: before.name, short_name: before.short_name, email: before.email });
	});

	it('update: an avatar token from the user\'s avatar list is accepted', async () => {
		const avatars = await canvas().get<Json[]>(`/api/v1/users/${userId}/avatars`);
		const noPic = avatars.find((a) => a.type === 'no_pic');
		expect(noPic, 'Canvas should offer the "no pic" avatar').toBeDefined();
		const result = await runNode({
			resource: 'user',
			operation: 'update',
			params: { userId, updateFields: { avatarToken: String(noPic?.token) } },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success[0].id).toBe(Number(userId));
	});

	it('update: with "Override SIS Stickiness" off, a name changed in Canvas is left alone while other fields change', async () => {
		await runOk({
			resource: 'user',
			operation: 'update',
			params: { userId, updateFields: { name: 'Must Not Apply', timeZone: 'Europe/Berlin', overrideSisStickiness: false } },
		});
		expect((await getUser(userId)).name).toBe('Renamed Üser');
		expect((await getProfile(userId)).time_zone).toBe('Europe/Berlin');
	});

	it('update: a pronoun that is not configured on the account is ignored by Canvas without an error', async () => {
		const result = await runNode({
			resource: 'user',
			operation: 'update',
			params: { userId, updateFields: { pronouns: 'Not/A-Configured-Pronoun' } },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect((await getUser(userId)).pronouns ?? null).toBeNull();
	});

	it('update: "Event" suspends and unsuspends the logins of the user', async () => {
		await runOk({ resource: 'user', operation: 'update', params: { userId, updateFields: { event: 'suspend' } } });
		expect((await getLogins(userId)).map((l) => l.workflow_state)).toEqual(['suspended']);
		await runOk({ resource: 'user', operation: 'update', params: { userId, updateFields: { event: 'unsuspend' } } });
		expect((await getLogins(userId)).map((l) => l.workflow_state)).toEqual(['active']);
	});

	it('update: several users from input items; a teacher may not rename someone else', async () => {
		const result = await runNode({
			resource: 'user',
			operation: 'update',
			items: [{ id: searchIds[0], short: 'First' }, { id: 99999999, short: 'Nobody' }, { id: searchIds[1], short: 'Second' }],
			params: {
				userId: '={{ $json.id }}',
				updateFields: { shortName: '={{ $json.short }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((u) => u.short_name)).toEqual(['First', 'Second']);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'update' });
		expect((await getUser(String(searchIds[0]))).short_name).toBe('First');
		expect((await getUser(String(searchIds[1]))).short_name).toBe('Second');

		const forbidden = await runNode({
			resource: 'user',
			operation: 'update',
			persona: 'teacher',
			params: { userId: String(searchIds[2]), updateFields: { name: 'Hacked' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403, 404]).toContain(forbidden.error[0].errorCode);
		expect((await getUser(String(searchIds[2]))).name).not.toBe('Hacked');
	});

	it('terminateSessions: expires the access tokens of the user', async () => {
		const token = await canvas().post<Json>(`/api/v1/users/${userId}/tokens?as_user_id=${userId}`, { token: { purpose: 'battery terminate' } });
		expect(token.expires_at ?? null).toBeNull();

		const [result] = await runOk({ resource: 'user', operation: 'terminateSessions', params: { userId } });
		expect(result).toEqual({ message: 'All sessions terminated' });

		const after = await canvas().get<Json>(`/api/v1/users/${userId}/tokens/${String(token.id)}?as_user_id=${userId}`);
		expect(after.expires_at).toBeTypeOf('string');
		expect(Date.parse(String(after.expires_at))).toBeLessThanOrEqual(Date.now() + 5000);
	});

	it('merge and split: merges one user into another, then splits them again', async () => {
		const source = await makeUser(unique('Merge Source'));
		const target = await makeUser(unique('Merge Target'));
		const sourceLogin = String((await getLogins(String(source.id)))[0].unique_id);

		const [merged] = await runOk({
			resource: 'user',
			operation: 'merge',
			params: { sourceUserId: String(source.id), destinationUserId: String(target.id) },
		});
		expect(merged.id).toBe(target.id);
		expect((await canvas().request('GET', `/api/v1/users/${String(source.id)}`)).status).toBe(404);
		expect((await getLogins(String(target.id))).map((l) => l.unique_id)).toContain(sourceLogin);

		const users = await runOk({ resource: 'user', operation: 'split', params: { userId: String(target.id) } });
		expect(users).toHaveLength(2);
		expect(users.map((u) => u.id)).toContain(target.id);
		const restored = users.find((u) => u.id !== target.id) as Json;
		createdIds.push(String(restored.id));
		expect((await getLogins(String(restored.id))).map((l) => l.unique_id)).toEqual([sourceLogin]);
		expect((await getLogins(String(target.id))).map((l) => l.unique_id)).not.toContain(sourceLogin);

		const nothing = await runNode({
			resource: 'user',
			operation: 'split',
			params: { userId: String(searchIds[3]), errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.success).toEqual([]);
		expect(nothing.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'user', operation: 'split' });
	});

	it('merge: with a destination account, the destination can be given by SIS ID', async () => {
		const targetSis = unique('SIS-MERGE').replace(/\s/g, '_');
		const source = await makeUser(unique('Merge Source 2'));
		const target = await makeUser(unique('Merge Target 2'), { sis_user_id: targetSis });

		const [merged] = await runOk({
			resource: 'user',
			operation: 'merge',
			params: { sourceUserId: String(source.id), destinationUserId: `sis_user_id:${targetSis}`, destinationAccountId: account },
		});
		expect(merged.id).toBe(target.id);
		expect((await canvas().request('GET', `/api/v1/users/${String(source.id)}`)).status).toBe(404);

		const missing = await runNode({
			resource: 'user',
			operation: 'merge',
			params: { sourceUserId: String(searchIds[4]), destinationUserId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'merge' });
		expect((await getUser(String(searchIds[4]))).id).toBe(searchIds[4]);
	});

	it('delete and restore: removes the user from the root account and brings them back', async () => {
		const victim = await makeUser(unique('Delete Me'));
		const id = String(victim.id);

		const onSubAccount = await runNode({
			resource: 'user',
			operation: 'delete',
			params: { accountId: fx('subAccountId'), userId: id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(onSubAccount.success).toEqual([]);
		expect(onSubAccount.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'delete' });
		expect((await canvas().request('GET', `/api/v1/users/${id}`)).status).toBe(200);

		const notDeleted = await runNode({
			resource: 'user',
			operation: 'restore',
			params: { accountId: account, userId: id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(notDeleted.success).toEqual([]);
		expect(notDeleted.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'user', operation: 'restore' });

		const [deleted] = await runOk({ resource: 'user', operation: 'delete', params: { accountId: account, userId: Number(id) } });
		expect(JSON.stringify(deleted)).toContain(String(victim.name));
		// Canvas keeps the user record readable by ID; the deletion removes the logins and
		// takes the user off the account.
		const listed = (): Promise<Json[]> =>
			canvas().getAll<Json>(`/api/v1/accounts/${account}/users?search_term=${encodeURIComponent(String(victim.name))}`);
		expect(await getLogins(id)).toEqual([]);
		expect((await listed()).map((u) => u.id)).not.toContain(victim.id);

		const [restored] = await runOk({ resource: 'user', operation: 'restore', params: { accountId: 'self', userId: id } });
		expect(restored.id).toBe(victim.id);
		expect((await getLogins(id)).map((l) => l.workflow_state)).toEqual(['active']);
		expect((await listed()).map((u) => u.id)).toContain(victim.id);
	});

	it('errors: only admins may delete users', async () => {
		const result = await runNode({
			resource: 'user',
			operation: 'delete',
			persona: 'teacher',
			params: { accountId: account, userId: String(searchIds[5]), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'user', operation: 'delete' });
		expect([401, 403]).toContain(result.error[0].errorCode);
		expect((await canvas().request('GET', `/api/v1/users/${String(searchIds[5])}`)).status).toBe(200);
	});
});
