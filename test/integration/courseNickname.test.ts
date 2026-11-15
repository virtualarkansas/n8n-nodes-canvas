import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, createUserWithToken, fx, unique } from '../lib/canvas';
import type { TestUser } from '../lib/canvas';
import { createCredential, n8n, runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxAccount, deleteSandboxAccount } from './support/gradingSandbox';

/**
 * Resource: courseNickname. Nicknames belong to the user of the token, so the
 * file acts as a user of its own (never as a seeded persona) in courses of its
 * own, and reads every change back with that user's token.
 */
describe('courseNickname', () => {
	let accountId = '';
	let user: TestUser;
	let credential: { id: string; name: string; type: string };
	const courses: Array<{ id: string; name: string; sisId: string }> = [];
	let unreadable = '';
	const COURSES = 12;

	const run = (operation: string, params: Json = {}, items?: Json[]): Promise<Json[]> =>
		runOk({ resource: 'courseNickname', operation, credential, params, items });
	const nicknameOf = async (courseId: string): Promise<unknown> =>
		(await user.client.get<Json>(`/api/v1/users/self/course_nicknames/${courseId}`)).nickname;
	const stored = (): Promise<Json[]> => user.client.getAll<Json>('/api/v1/users/self/course_nicknames');

	beforeAll(async () => {
		accountId = await createSandboxAccount('course-nicknames');
		user = await createUserWithToken('Nickname Battery User');
		credential = await createCredential(user.token, 'course nicknames');
		for (let i = 1; i <= COURSES; i++) {
			const name = unique(`Nickname battery course ${String(i).padStart(2, '0')}`);
			const sisId = unique('W2-NICK').replace(/\s/g, '-');
			const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
				course: { name, sis_course_id: sisId },
				offer: true,
			});
			courses.push({ id: String(course.id), name, sisId });
			await canvas().post(`/api/v1/courses/${String(course.id)}/enrollments`, {
				enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
			});
		}
		// A course the user is not part of.
		const other = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, { course: { name: unique('Nickname battery: not mine') } });
		unreadable = String(other.id);
	});

	afterAll(async () => {
		for (const course of [...courses.map((c) => c.id), unreadable]) {
			if (course) await canvas().request('DELETE', `/api/v1/courses/${course}?event=delete`);
		}
		if (user) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${user.id}`);
		if (credential) await n8n().api('DELETE', `/credentials/${credential.id}`).catch(() => undefined);
		await deleteSandboxAccount(accountId);
	});

	it('get: a course without a nickname has "nickname: null"', async () => {
		const [nickname] = await run('get', { courseId: courses[0].id });
		expect(nickname).toEqual({ course_id: Number(courses[0].id), name: courses[0].name, nickname: null });
	});

	it('getAll: a user without nicknames gets no items', async () => {
		const result = await runNode({ resource: 'courseNickname', operation: 'getAll', credential });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('set: gives the course a nickname that replaces its name for this user only', async () => {
		const nickname = 'Bio 🧬 "quoted" & Ünïcødé 课程';
		const [set] = await run('set', { courseId: courses[0].id, nickname });
		expect(set).toEqual({ course_id: Number(courses[0].id), name: courses[0].name, nickname });
		expect(await nicknameOf(courses[0].id)).toBe(nickname);

		// The user now sees the nickname as the name of the course ...
		const own = await user.client.get<Json>(`/api/v1/courses/${courses[0].id}`);
		expect(own).toMatchObject({ name: nickname, original_name: courses[0].name });
		// ... everyone else still sees the real name.
		const admin = await canvas().get<Json>(`/api/v1/courses/${courses[0].id}`);
		expect(admin.name).toBe(courses[0].name);
		expect((await canvas().get<Json>(`/api/v1/users/self/course_nicknames/${courses[0].id}`)).nickname).toBeNull();
	});

	it('set: replaces an existing nickname; accepts a SIS course ID; 59 characters is the longest', async () => {
		const [replaced] = await run('set', { courseId: courses[0].id, nickname: 'Biology' });
		expect(replaced.nickname).toBe('Biology');
		expect(await nicknameOf(courses[0].id)).toBe('Biology');

		const longest = 'N'.repeat(59);
		const [bySis] = await run('set', { courseId: `sis_course_id:${courses[1].sisId}`, nickname: longest });
		expect(bySis).toEqual({ course_id: Number(courses[1].id), name: courses[1].name, nickname: longest });
		expect(await nicknameOf(courses[1].id)).toBe(longest);
	});

	it('set: several courses in one run, IDs and nicknames from the input items', async () => {
		const items = courses.slice(2).map((course, index) => ({ course: Number(course.id), short: `Course #${index + 3}` }));
		const result = await runNode({
			resource: 'courseNickname',
			operation: 'set',
			credential,
			items,
			params: { courseId: '={{ $json.course }}', nickname: '={{ $json.short }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((n) => [n.course_id, n.nickname])).toEqual(items.map((item) => [item.course, item.short]));
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual(items.map((_, index) => index));
		const all = await stored();
		expect(all).toHaveLength(COURSES);
	});

	it('getAll: lists every nickname of the user, paged', async () => {
		const expected = await stored();
		expect(expected).toHaveLength(COURSES);

		const defaults = await run('getAll');
		expect(defaults).toEqual(expected);

		const all = await run('getAll', { pagination: { returnAll: true } });
		expect(all).toEqual(expected);
		expect(new Set(all.map((n) => n.course_id)).size).toBe(COURSES);
		expect(all.map((n) => n.course_id).sort()).toEqual(courses.map((c) => Number(c.id)).sort());

		const firstPages = await run('getAll', { pagination: { perPage: 5, maxPages: 2 } });
		expect(firstPages).toEqual(expected.slice(0, 10));

		// Another user has no part in this: the admin's list holds none of these courses.
		const admins = await canvas().getAll<Json>('/api/v1/users/self/course_nicknames');
		for (const nickname of admins) {
			expect(courses.map((c) => Number(c.id))).not.toContain(nickname.course_id);
		}
	});

	it('get: returns the nickname of one course', async () => {
		const [nickname] = await run('get', { courseId: `sis_course_id:${courses[1].sisId}` });
		expect(nickname).toEqual({ course_id: Number(courses[1].id), name: courses[1].name, nickname: 'N'.repeat(59) });
	});

	it('set: Canvas refuses a nickname of 60 characters and an empty one, and says why', async () => {
		const tooLong = await runNode({
			resource: 'courseNickname',
			operation: 'set',
			credential,
			params: { courseId: courses[0].id, nickname: 'N'.repeat(60), errorHandling: { onError: 'continueWithError' } },
		});
		expect(tooLong.success).toEqual([]);
		expect(tooLong.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'courseNickname',
			operation: 'set',
		});
		expect(String(tooLong.error[0].errorMessage)).toContain('nickname too long');

		const blank = await runNode({
			resource: 'courseNickname',
			operation: 'set',
			credential,
			params: { courseId: courses[0].id, nickname: '   ', errorHandling: { onError: 'continueWithError' } },
		});
		expect(blank.success).toEqual([]);
		expect(blank.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(blank.error[0].errorMessage)).toContain('missing nickname');
		expect(await nicknameOf(courses[0].id)).toBe('Biology');
	});

	it('set / get: a course the user has no access to is refused; a missing course is not found', async () => {
		for (const operation of ['set', 'get']) {
			const refused = await runNode({
				resource: 'courseNickname',
				operation,
				credential,
				params: { courseId: unreadable, nickname: 'Not mine', errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation });
		}
		const missing = await runNode({
			resource: 'courseNickname',
			operation: 'set',
			credential,
			params: { courseId: '99999999', nickname: 'Nowhere', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect(await stored()).toHaveLength(COURSES);
	});

	it('remove: takes the nickname away; removing it again is "not found"', async () => {
		const [removed] = await run('remove', { courseId: courses[0].id });
		expect(removed).toEqual({ course_id: Number(courses[0].id), name: courses[0].name, nickname: null });
		expect(await nicknameOf(courses[0].id)).toBeNull();
		expect((await user.client.get<Json>(`/api/v1/courses/${courses[0].id}`)).name).toBe(courses[0].name);
		expect((await stored()).map((n) => n.course_id)).not.toContain(Number(courses[0].id));

		const again = await runNode({
			resource: 'courseNickname',
			operation: 'remove',
			credential,
			items: [{ course: Number(courses[0].id) }, { course: Number(courses[1].id) }],
			params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		// The first course has no nickname any more, the second one loses its nickname now.
		expect(again.success).toEqual([{ course_id: Number(courses[1].id), name: courses[1].name, nickname: null }]);
		expect(again.error).toHaveLength(1);
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'remove' });
		expect(String(again.error[0].errorMessage)).toContain('no nickname exists for course');
		expect(await stored()).toHaveLength(COURSES - 2);
	});

	it('clearAll: removes every nickname of the user', async () => {
		expect((await stored()).length).toBeGreaterThan(0);
		const [cleared] = await run('clearAll');
		expect(cleared).toEqual({ message: 'OK' });
		expect(await stored()).toEqual([]);
		expect((await user.client.get<Json>(`/api/v1/courses/${courses[5].id}`)).name).toBe(courses[5].name);

		// Nothing left to clear: still fine.
		const [again] = await run('clearAll');
		expect(again).toEqual({ message: 'OK' });
	});

	it('errors: an invalid token is "unauthorized"', async () => {
		const broken = await createCredential('not-a-token', 'course nicknames invalid');
		try {
			const result = await runNode({
				resource: 'courseNickname',
				operation: 'getAll',
				credential: broken,
				params: { errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 401, errorType: 'UNAUTHORIZED', resource: 'courseNickname' });
		} finally {
			await n8n().api('DELETE', `/credentials/${broken.id}`).catch(() => undefined);
		}
	});
});
