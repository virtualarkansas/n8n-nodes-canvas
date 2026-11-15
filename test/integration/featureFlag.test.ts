import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { canvas, CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createDedicatedAdmin, createDedicatedUser, removeDedicatedAdmin, removeDedicatedUser } from './support/dedicated';
import type { DedicatedUser } from './support/dedicated';
import { createCourse, deleteCourses, uniqueSisId } from './support/world';
import type { OwnCourse } from './support/world';

vi.mock('../lib/state', async (original) =>
	(await import('./support/state-overlay')).overlayState(await original()),
);

/**
 * Resource: featureFlag. Flags are only ever changed on a sub-account, a course
 * and a user the battery creates itself; the root account is read, never written.
 */
describe('featureFlag', () => {
	let admin: DedicatedUser;
	let api: CanvasClient;
	let member: DedicatedUser; // student in the course; target of the user-level flags
	let subAccountId = '';
	const subAccountSisId = uniqueSisId('FF-ACCT 1/2#?');
	let course: OwnCourse;

	// Features of a stock Canvas, by the context they apply to.
	const COURSE_FEATURE = 'outcome_gradebook'; // allowed by default: a course may switch it on
	const COURSE_FEATURE_2 = 'quiz_log_auditing';
	const ACCOUNT_FEATURE = 'apply_score_to_ungraded';
	const USER_FEATURE = 'high_contrast';
	const USER_FEATURE_2 = 'underline_all_links';

	const run = (opts: RunNodeOptions): Promise<RunNodeResult> => runNode({ persona: admin.persona, ...opts });
	const ok = (opts: RunNodeOptions): Promise<Json[]> => runOk({ persona: admin.persona, ...opts });
	const flag = (base: string, feature: string): Promise<Json> => api.get<Json>(`${base}/features/flags/${feature}`);
	const names = (items: Json[]): string[] => items.map((f) => String(f.feature));

	beforeAll(async () => {
		admin = await createDedicatedAdmin('featureflags');
		api = new CanvasClient(admin.persona);
		const sub = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, {
			account: { name: `Feature flag battery ${Date.now().toString(36)}`, sis_account_id: subAccountSisId },
		});
		subAccountId = String(sub.id);
		course = await createCourse('Feature Flags', { accountId: subAccountId, sisId: uniqueSisId('FF-CRS') });
		member = await createDedicatedUser('featureflags-member', [{ courseId: course.id, type: 'StudentEnrollment' }]);
	});

	afterAll(async () => {
		await removeDedicatedUser(member);
		await deleteCourses([course]);
		await canvas()
			.request('DELETE', `/api/v1/accounts/${fx('accountId')}/sub_accounts/${subAccountId}`)
			.catch(() => undefined);
		await removeDedicatedAdmin(admin);
	});

	it('getAll: lists the features of an account across pages, exactly once each', async () => {
		const expected = await api.getAll<Json>(`/api/v1/accounts/${subAccountId}/features`);
		expect(expected.length).toBeGreaterThan(10);

		const all = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'account', accountId: subAccountId, pagination: { returnAll: true, perPage: 7 } },
		});
		expect(names(all)).toEqual(names(expected));
		expect(new Set(names(all)).size).toBe(all.length);
		const sample = all.find((f) => f.feature === ACCOUNT_FEATURE) as Json;
		expect(sample).toMatchObject({ applies_to: 'Account' });
		expect((sample.feature_flag as Json).state).toBe('allowed');

		// Canvas pages through every feature definition (also the ones hidden from the caller) and
		// filters afterwards, so small pages come back short or empty. The node therefore always
		// asks for full pages here: the default options and a small page size still return everything.
		const smallPage = await api.request('GET', `/api/v1/accounts/${subAccountId}/features?per_page=10`);
		expect((smallPage.data as Json[]).length).toBeLessThan(10);
		expect(smallPage.headers.get('link')).toContain('rel="next"');

		const defaults = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'account', accountId: Number(subAccountId) },
		});
		expect(names(defaults)).toEqual(names(expected));

		const smallPages = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'account', accountId: `sis_account_id:${subAccountSisId}`, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(names(smallPages)).toEqual(names(expected));
	});

	it('getAll: course and user contexts, and "Hide Inherited Enabled" drops features forced on from above', async () => {
		const courseAll = await api.getAll<Json>(`/api/v1/courses/${course.id}/features`);
		const forcedOn = courseAll.filter((f) => {
			const ff = f.feature_flag as Json;
			return ff.locked === true && (ff.state === 'on' || ff.state === 'allowed_on');
		});
		expect(forcedOn.length, 'a stock Canvas has course features that are locked on').toBeGreaterThan(0);

		const listed = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'course', courseId: course.id, pagination: { returnAll: true } },
		});
		expect(names(listed)).toEqual(names(courseAll));
		expect(listed.every((f) => f.applies_to === 'Course')).toBe(true);

		const hidden = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: {
				contextType: 'course',
				courseId: `sis_course_id:${course.sisId}`,
				options: { hide_inherited_enabled: true },
				pagination: { returnAll: true },
			},
		});
		const expectedHidden = await api.getAll<Json>(`/api/v1/courses/${course.id}/features?hide_inherited_enabled=true`);
		expect(names(hidden)).toEqual(names(expectedHidden));
		expect(hidden.length).toBeLessThan(listed.length);
		for (const f of forcedOn) {
			expect(names(hidden)).not.toContain(f.feature);
		}

		const shown = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'course', courseId: course.id, options: { hide_inherited_enabled: false }, pagination: { returnAll: true } },
		});
		expect(names(shown)).toEqual(names(courseAll));

		const userExpected = await api.getAll<Json>(`/api/v1/users/${member.id}/features`);
		const userListed = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'user', userId: member.id, pagination: { returnAll: true } },
		});
		expect(names(userListed)).toEqual(names(userExpected));
		expect(names(userListed)).toContain(USER_FEATURE);
		expect(userListed.every((f) => f.applies_to === 'User')).toBe(true);

		const ownFeatures = await runOk({
			resource: 'featureFlag',
			operation: 'getAll',
			persona: member.persona,
			params: { contextType: 'user', userId: 'self', pagination: { returnAll: true } },
		});
		expect(names(ownFeatures)).toEqual(names(userExpected));
	});

	it('get: an inherited flag reports where it comes from', async () => {
		const [inherited] = await ok({
			resource: 'featureFlag',
			operation: 'get',
			params: { contextType: 'course', courseId: course.id, feature: COURSE_FEATURE },
		});
		const direct = await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE);
		expect(inherited).toEqual(direct);
		expect(inherited).toMatchObject({ feature: COURSE_FEATURE, state: 'allowed', locked: false });
		// Not defined on the course itself.
		expect(inherited.context_type).not.toBe('Course');

		// A feature name with stray whitespace still addresses the same flag.
		const [padded] = await ok({
			resource: 'featureFlag',
			operation: 'get',
			params: { contextType: 'course', courseId: course.id, feature: `  ${COURSE_FEATURE}\n` },
		});
		expect(padded).toEqual(direct);
	});

	it('update (course): on and off are stored on the course; "allowed" is only for accounts', async () => {
		const [on] = await ok({
			resource: 'featureFlag',
			operation: 'update',
			params: { contextType: 'course', courseId: course.id, feature: COURSE_FEATURE, state: 'on' },
		});
		expect(on).toMatchObject({ feature: COURSE_FEATURE, context_type: 'Course', context_id: Number(course.id), state: 'on' });
		expect(await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE)).toMatchObject({
			context_type: 'Course',
			context_id: Number(course.id),
			state: 'on',
		});
		expect(await api.get<string[]>(`/api/v1/courses/${course.id}/features/enabled`)).toContain(COURSE_FEATURE);

		const [off] = await ok({
			resource: 'featureFlag',
			operation: 'update',
			params: { contextType: 'course', courseId: `sis_course_id:${course.sisId}`, feature: COURSE_FEATURE, state: 'off' },
		});
		expect(off).toMatchObject({ context_type: 'Course', state: 'off' });
		expect(await api.get<string[]>(`/api/v1/courses/${course.id}/features/enabled`)).not.toContain(COURSE_FEATURE);

		// "Allowed" states make no sense below an account: Canvas refuses and nothing changes.
		for (const state of ['allowed', 'allowed_on']) {
			const refused = await run({
				resource: 'featureFlag',
				operation: 'update',
				params: {
					contextType: 'course',
					courseId: course.id,
					feature: COURSE_FEATURE,
					state,
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(refused.success, state).toEqual([]);
			expect(refused.error[0], state).toMatchObject({ resource: 'featureFlag', operation: 'update' });
			expect([400, 403], state).toContain(refused.error[0].errorCode);
			expect(String(refused.error[0].errorMessage), state).toMatch(/\S/);
		}
		expect((await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE)).state).toBe('off');
	});

	it('getAllEnabled: lists the names of enabled features for each context type', async () => {
		await api.put(`/api/v1/courses/${course.id}/features/flags/${COURSE_FEATURE_2}`, { state: 'on' });
		const cases: Array<[string, Json, string]> = [
			['course', { courseId: course.id }, `/api/v1/courses/${course.id}`],
			['account', { accountId: subAccountId }, `/api/v1/accounts/${subAccountId}`],
			['user', { userId: member.id }, `/api/v1/users/${member.id}`],
			['account', { accountId: fx('accountId') }, `/api/v1/accounts/${fx('accountId')}`],
		];
		for (const [contextType, ids, base] of cases) {
			const expected = await api.get<string[]>(`${base}/features/enabled`);
			const listed = await ok({
				resource: 'featureFlag',
				operation: 'getAllEnabled',
				params: { contextType, ...ids, pagination: { perPage: 3, maxPages: 1 } },
			});
			// Canvas returns bare names, and all of them at once: every name becomes an item { value }.
			expect(listed, base).toEqual(expected.map((value) => ({ value })));
		}
		const courseEnabled = await ok({
			resource: 'featureFlag',
			operation: 'getAllEnabled',
			params: { contextType: 'course', courseId: course.id },
		});
		expect(courseEnabled.map((f) => f.value)).toContain(COURSE_FEATURE_2);
		expect(courseEnabled.map((f) => f.value)).not.toContain(COURSE_FEATURE);
	});

	it('getAllEnvironment: returns the interface feature switches as one item', async () => {
		const expected = await api.get<Json>('/api/v1/features/environment');
		const items = await ok({ resource: 'featureFlag', operation: 'getAllEnvironment' });
		expect(items).toHaveLength(1);
		expect(items[0]).toEqual(expected);
		expect(Object.values(items[0]).every((v) => typeof v === 'boolean')).toBe(true);
	});

	it('update (account): every state is stored on a sub-account and flows down to its courses', async () => {
		const base = `/api/v1/accounts/${subAccountId}`;
		for (const state of ['allowed_on', 'off', 'allowed', 'on']) {
			const [updated] = await ok({
				resource: 'featureFlag',
				operation: 'update',
				params: { contextType: 'account', accountId: subAccountId, feature: ACCOUNT_FEATURE, state },
			});
			expect(updated, state).toMatchObject({
				feature: ACCOUNT_FEATURE,
				context_type: 'Account',
				context_id: Number(subAccountId),
				state,
			});
			expect((await flag(base, ACCOUNT_FEATURE)).state, state).toBe(state);
		}
		expect(await api.get<string[]>(`${base}/features/enabled`)).toContain(ACCOUNT_FEATURE);
		// The root account is untouched.
		const root = await flag(`/api/v1/accounts/${fx('accountId')}`, ACCOUNT_FEATURE);
		expect(root.context_id === Number(subAccountId) && root.context_type === 'Account').toBe(false);
	});

	it('update: a flag locked by the account above cannot be changed in the course', async () => {
		// The sub-account forces a course feature off: the course below may no longer decide.
		await api.put(`/api/v1/accounts/${subAccountId}/features/flags/${COURSE_FEATURE}`, { state: 'off' });
		const before = await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE);
		expect(before.locked).toBe(true);

		const refused = await run({
			resource: 'featureFlag',
			operation: 'update',
			params: {
				contextType: 'course',
				courseId: course.id,
				feature: COURSE_FEATURE,
				state: 'on',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({
			errorCode: 403,
			errorType: 'FORBIDDEN',
			errorMessage: 'higher account disallows setting feature flag',
			endpoint: `/api/v1/courses/${course.id}/features/flags/${COURSE_FEATURE}`,
		});
		expect(await api.get<string[]>(`/api/v1/courses/${course.id}/features/enabled`)).not.toContain(COURSE_FEATURE);

		// Removing the account's flag hands the decision back to the course.
		const [removed] = await ok({
			resource: 'featureFlag',
			operation: 'delete',
			params: { contextType: 'account', accountId: `sis_account_id:${subAccountSisId}`, feature: COURSE_FEATURE },
		});
		expect(removed).toMatchObject({ feature: COURSE_FEATURE, context_type: 'Account', context_id: Number(subAccountId) });
		expect((await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE)).locked).toBe(false);
	});

	it('update (user): an admin sets a user\'s flag, and users set their own', async () => {
		const [byAdmin] = await ok({
			resource: 'featureFlag',
			operation: 'update',
			params: { contextType: 'user', userId: member.id, feature: USER_FEATURE, state: 'on' },
		});
		expect(byAdmin).toMatchObject({ feature: USER_FEATURE, context_type: 'User', context_id: Number(member.id), state: 'on' });

		const [bySelf] = await runOk({
			resource: 'featureFlag',
			operation: 'update',
			persona: member.persona,
			params: { contextType: 'user', userId: 'self', feature: USER_FEATURE_2, state: 'on' },
		});
		expect(bySelf).toMatchObject({ feature: USER_FEATURE_2, context_type: 'User', context_id: Number(member.id), state: 'on' });

		const enabled = await api.get<string[]>(`/api/v1/users/${member.id}/features/enabled`);
		expect(enabled).toEqual(expect.arrayContaining([USER_FEATURE, USER_FEATURE_2]));

		const [got] = await runOk({
			resource: 'featureFlag',
			operation: 'get',
			persona: member.persona,
			params: { contextType: 'user', userId: 'self', feature: USER_FEATURE },
		});
		expect(got).toMatchObject({ context_type: 'User', state: 'on' });
	});

	it('update: several items in one run, with an unknown feature and a feature of the wrong context', async () => {
		const result = await run({
			resource: 'featureFlag',
			operation: 'update',
			items: [
				{ feature: COURSE_FEATURE, state: 'on' },
				{ feature: 'no_such_feature_flag', state: 'on' },
				{ feature: USER_FEATURE, state: 'on' },
				{ feature: COURSE_FEATURE_2, state: 'off' },
			],
			params: {
				contextType: 'course',
				courseId: course.id,
				feature: '={{ $json.feature }}',
				state: '={{ $json.state }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((f) => [f.feature, f.state])).toEqual([
			[COURSE_FEATURE, 'on'],
			[COURSE_FEATURE_2, 'off'],
		]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 3 }]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'invalid feature', operation: 'update' });
		}
		expect(result.error.map((e) => (e.originalItem as Json).feature)).toEqual(['no_such_feature_flag', USER_FEATURE]);
		const enabled = await api.get<string[]>(`/api/v1/courses/${course.id}/features/enabled`);
		expect(enabled).toContain(COURSE_FEATURE);
		expect(enabled).not.toContain(COURSE_FEATURE_2);
	});

	it('delete: removes the flag from the context so the inherited state applies again', async () => {
		const [deleted] = await ok({
			resource: 'featureFlag',
			operation: 'delete',
			params: { contextType: 'course', courseId: course.id, feature: COURSE_FEATURE },
		});
		expect(deleted).toMatchObject({ feature: COURSE_FEATURE, context_type: 'Course', context_id: Number(course.id), state: 'on' });
		const after = await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE);
		expect(after.state).toBe('allowed');
		expect(after.context_type).not.toBe('Course');

		const [userDeleted] = await ok({
			resource: 'featureFlag',
			operation: 'delete',
			params: { contextType: 'user', userId: member.id, feature: USER_FEATURE },
		});
		expect(userDeleted).toMatchObject({ feature: USER_FEATURE, context_type: 'User' });
		expect(await api.get<string[]>(`/api/v1/users/${member.id}/features/enabled`)).not.toContain(USER_FEATURE);
	});

	it('delete: a flag that is not defined on the context is a 404; an unknown feature is a 400', async () => {
		const result = await run({
			resource: 'featureFlag',
			operation: 'delete',
			items: [{ feature: COURSE_FEATURE }, { feature: 'no_such_feature_flag' }],
			params: {
				contextType: 'course',
				courseId: course.id,
				feature: '={{ $json.feature }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		expect(result.error[1]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'invalid feature' });
	});

	it('errors: unknown feature on get, missing course, and an empty feature name', async () => {
		const unknown = await run({
			resource: 'featureFlag',
			operation: 'get',
			params: { contextType: 'course', courseId: course.id, feature: 'no_such_feature_flag', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'featureFlag', operation: 'get' });

		const noCourse = await run({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'course', courseId: '999999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(noCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/courses/999999999/features' });

		const empty = await run({
			resource: 'featureFlag',
			operation: 'update',
			items: [{ feature: '' }],
			params: {
				contextType: 'course',
				courseId: course.id,
				feature: '={{ $json.feature }}',
				state: 'on',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(empty.success).toEqual([]);
		expect(String(empty.error[0].errorMessage)).toContain('A required parameter is empty for featureFlag/update');
	});

	it('permissions: a student reads the course\'s flags but may not change them', async () => {
		const readable = await runOk({
			resource: 'featureFlag',
			operation: 'getAllEnabled',
			persona: member.persona,
			params: { contextType: 'course', courseId: course.id },
		});
		expect(readable.map((f) => f.value)).toEqual(await api.get<string[]>(`/api/v1/courses/${course.id}/features/enabled`));

		for (const operation of ['update', 'delete']) {
			const refused = await runNode({
				resource: 'featureFlag',
				operation,
				persona: member.persona,
				params: {
					contextType: 'course',
					courseId: course.id,
					feature: COURSE_FEATURE_2,
					...(operation === 'update' ? { state: 'on' } : {}),
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(refused.success, operation).toEqual([]);
			expect(refused.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', operation });
		}
		expect((await flag(`/api/v1/courses/${course.id}`, COURSE_FEATURE_2)).state).toBe('off');
	});

	it('root account and seeded course: read-only operations match Canvas for the shared personas', async () => {
		const rootBase = `/api/v1/accounts/${fx('accountId')}`;
		const rootFlag = await ok({
			resource: 'featureFlag',
			operation: 'get',
			params: { contextType: 'account', accountId: fx('accountId'), feature: fx('rootFeatureFlagName') },
		});
		expect(rootFlag[0]).toEqual(await flag(rootBase, fx('rootFeatureFlagName')));

		const rootAll = await ok({
			resource: 'featureFlag',
			operation: 'getAll',
			params: { contextType: 'account', accountId: fx('accountId'), pagination: { returnAll: true } },
		});
		expect(names(rootAll)).toEqual(names(await api.getAll<Json>(`${rootBase}/features`)));

		// A teacher sees the flags of a seeded course, including the ones the seed switched on there.
		const asTeacher = new CanvasClient('teacher');
		const expected = await asTeacher.getAll<Json>(`/api/v1/courses/${fx('courseId')}/features`);
		const listed = await runOk({
			resource: 'featureFlag',
			operation: 'getAll',
			persona: 'teacher',
			params: { contextType: 'course', courseId: fx('courseId'), pagination: { returnAll: true } },
		});
		expect(names(listed)).toEqual(names(expected));
		const seeded = listed.find((f) => f.feature === fx('courseFeatureFlagName')) as Json;
		expect(seeded.feature_flag).toMatchObject({ context_type: 'Course', context_id: Number(fx('courseId')), state: 'on' });
	});
});
