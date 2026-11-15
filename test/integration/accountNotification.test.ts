import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { ids, runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: accountNotification (global announcements). Notifications created
 * here target admins only or live in a private sub-account, so the other
 * personas on the shared Canvas are not flooded; all of them are removed again.
 */

const hoursFromNow = (hours: number): string => new Date(Date.now() + hours * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

describe('accountNotification', () => {
	const root = fx('accountId');
	let ownAccount = '';
	const createdNotifications: Array<{ account: string; id: string }> = [];
	let activeId = '';
	let futureId = '';
	const subject = unique('Battery Notice Ünïcødé 通知 "quoted" & <b>tags</b> 📣');

	/** All notifications of an account, including future and past ones (admin view). */
	const allFor = (account: string): Promise<Json[]> =>
		canvas().get<Json[]>(`/api/v1/accounts/${account}/account_notifications?include_all=true`);
	const find = async (account: string, id: string): Promise<Json | undefined> =>
		(await allFor(account)).find((n) => String(n.id) === id);

	beforeAll(async () => {
		const account = await canvas().post<Json>(`/api/v1/accounts/${root}/sub_accounts`, {
			account: { name: unique('Battery notifications') },
		});
		ownAccount = String(account.id);
	});

	afterAll(async () => {
		for (const n of createdNotifications) {
			await canvas().request('DELETE', `/api/v1/accounts/${n.account}/account_notifications/${n.id}?remove=true`);
		}
		if (ownAccount) {
			await canvas().request('DELETE', `/api/v1/accounts/${root}/sub_accounts/${ownAccount}`);
		}
	});

	// ------------------------------------------------------------------ create

	it('create: every optional field reaches Canvas (roles by name)', async () => {
		const startAt = hoursFromNow(-2);
		const endAt = hoursFromNow(48);
		const [created] = await runOk({
			resource: 'accountNotification',
			operation: 'create',
			params: {
				accountId: root,
				subject,
				message: '<p>Message with <strong>HTML</strong>, an &amp; and emoji 🎓</p>',
				startAt,
				endAt,
				additionalFields: {
					icon: 'calendar',
					roles: 'AccountAdmin, TeacherEnrollment',
					send_message: false,
				},
			},
		});
		activeId = String(created.id);
		createdNotifications.push({ account: root, id: activeId });

		const actual = (await find(root, activeId))!;
		expect(actual).toMatchObject({ subject, icon: 'calendar', start_at: startAt, end_at: endAt });
		expect(String(actual.message)).toContain('<strong>HTML</strong>');
		expect(String(actual.message)).toContain('🎓');
		expect((actual.role_ids as number[]).sort()).toEqual(
			[Number(fx('accountAdminRoleId')), Number(fx('teacherRoleId'))].sort(),
		);
		expect((actual.roles as string[]).sort()).toEqual(['AccountAdmin', 'TeacherEnrollment']);
	});

	it('create: roles by ID (custom role) and "NilEnrollment"; several items with expressions', async () => {
		const result = await runOk({
			resource: 'accountNotification',
			operation: 'create',
			items: [
				{ subject: unique('Battery by role ID'), roles: `${fx('customRoleId')},NilEnrollment`, start: hoursFromNow(24) },
				{ subject: unique('Battery by role array'), roles: [Number(fx('studentRoleId'))], start: hoursFromNow(30) },
			],
			params: {
				accountId: ownAccount,
				subject: '={{ $json.subject }}',
				message: 'Plain text body',
				startAt: '={{ $json.start }}',
				endAt: hoursFromNow(72),
				additionalFields: { roles: '={{ $json.roles }}', icon: 'question' },
			},
		});
		expect(result).toHaveLength(2);
		for (const n of result) createdNotifications.push({ account: ownAccount, id: String(n.id) });

		const first = (await find(ownAccount, String(result[0].id)))!;
		expect(first.icon).toBe('question');
		expect(first.role_ids).toEqual(expect.arrayContaining([Number(fx('customRoleId')), null]));
		expect(first.role_ids).toHaveLength(2);
		const second = (await find(ownAccount, String(result[1].id)))!;
		expect(second.role_ids).toEqual([Number(fx('studentRoleId'))]);
	});

	it('create: without optional fields the notification is for everyone and gets the warning icon', async () => {
		// Dated in the future, so it never shows up on anyone's dashboard on the shared Canvas.
		const [created] = await runOk({
			resource: 'accountNotification',
			operation: 'create',
			params: {
				accountId: 'self',
				subject: unique('Battery minimal'),
				message: 'Minimal',
				startAt: hoursFromNow(500),
				endAt: hoursFromNow(501),
			},
		});
		futureId = String(created.id);
		createdNotifications.push({ account: root, id: futureId });
		const actual = (await find(root, futureId))!;
		expect(actual).toMatchObject({ icon: 'warning', role_ids: [], roles: [], message: 'Minimal' });
	});

	it('create: "Send Message" reaches Canvas (which refuses it on the Site Admin account)', async () => {
		const result = await runNode({
			resource: 'accountNotification',
			operation: 'create',
			params: {
				accountId: fx('siteAdminAccountId'),
				subject: unique('Battery must not exist'),
				message: 'Never created',
				startAt: hoursFromNow(100),
				endAt: hoursFromNow(101),
				additionalFields: { send_message: true, roles: 'AccountAdmin' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('send_message');
	});

	it('create: an end before the start, and a teacher, are refused', async () => {
		const badDates = await runNode({
			resource: 'accountNotification',
			operation: 'create',
			params: {
				accountId: ownAccount,
				subject: unique('Battery bad dates'),
				message: 'x',
				startAt: hoursFromNow(10),
				endAt: hoursFromNow(5),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badDates.success).toEqual([]);
		expect(badDates.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(JSON.stringify(badDates.error[0].canvasErrors)).toContain('end_at');

		const asTeacher = await runNode({
			resource: 'accountNotification',
			operation: 'create',
			persona: 'teacher',
			params: {
				accountId: root,
				subject: unique('Battery forbidden'),
				message: 'x',
				startAt: hoursFromNow(1),
				endAt: hoursFromNow(2),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});

	// --------------------------------------------------------------------- get

	it('get: returns a notification that is currently shown to the user', async () => {
		const [notification] = await runOk({
			resource: 'accountNotification',
			operation: 'get',
			params: { accountId: root, notificationId: activeId },
		});
		const actual = await canvas().get<Json>(`/api/v1/accounts/${root}/account_notifications/${activeId}`);
		expect(notification).toEqual(actual);
		expect(notification).toMatchObject({ id: Number(activeId), subject, icon: 'calendar' });
	});

	it('get: notifications that are not on the user\'s dashboard (future, other roles, unknown) are errors', async () => {
		const result = await runNode({
			resource: 'accountNotification',
			operation: 'get',
			items: [
				{ id: Number(fx('futureAccountNotificationId')) },
				{ id: Number(activeId) },
				{ id: 99999999 },
			],
			params: {
				accountId: root,
				notificationId: '={{ $json.id }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((n) => n.id)).toEqual([Number(activeId)]);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([1]);
		expect(result.error).toHaveLength(2);
		const future = result.error.find((e) => (e.originalItem as Json).id === Number(fx('futureAccountNotificationId')))!;
		expect(future.errorType).toBe('FORBIDDEN');
		const unknown = result.error.find((e) => (e.originalItem as Json).id === 99999999)!;
		expect(unknown).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// The notification targets admins and teachers only: a student cannot fetch it.
		const asStudent = await runNode({
			resource: 'accountNotification',
			operation: 'get',
			persona: 'student',
			params: { accountId: root, notificationId: activeId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asStudent.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------------ getAll

	it('getAll: current notifications by default; past and future ones on request', async () => {
		const current = await canvas().get<Json[]>(`/api/v1/accounts/${root}/account_notifications`);
		const listed = await runOk({ resource: 'accountNotification', operation: 'getAll', params: { accountId: root } });
		expect(ids(listed)).toEqual(ids(current));
		expect(ids(listed)).toContain(Number(activeId));
		expect(ids(listed)).toContain(Number(fx('accountNotificationId')));
		expect(ids(listed)).not.toContain(Number(fx('pastAccountNotificationId')));
		expect(ids(listed)).not.toContain(Number(fx('futureAccountNotificationId')));
		expect(listed[0].closed).toBeUndefined();

		const withPast = await runOk({
			resource: 'accountNotification',
			operation: 'getAll',
			params: { accountId: root, options: { include_past: true, show_is_closed: true } },
		});
		const expectedPast = await canvas().get<Json[]>(
			`/api/v1/accounts/${root}/account_notifications?include_past=true&show_is_closed=true`,
		);
		expect(ids(withPast)).toEqual(ids(expectedPast));
		expect(ids(withPast)).toContain(Number(fx('pastAccountNotificationId')));
		expect(withPast.every((n) => typeof n.closed === 'boolean')).toBe(true);

		const everything = await runOk({
			resource: 'accountNotification',
			operation: 'getAll',
			params: { accountId: root, options: { include_all: true }, pagination: { returnAll: true } },
		});
		const expectedAll = await allFor(root);
		expect(ids(everything)).toEqual(ids(expectedAll));
		expect(ids(everything)).toContain(Number(fx('futureAccountNotificationId')));
		expect(ids(everything)).toContain(Number(fx('pastAccountNotificationId')));
		// The admin view names the author.
		expect(everything.find((n) => String(n.id) === activeId)!.author).toMatchObject({ id: Number(fx('adminUserId')) });
		expect(new Set(ids(everything)).size).toBe(everything.length);
	});

	it('getAll: "Include All" on a sub-account lists its own notifications and those of the accounts above it', async () => {
		const expected = await allFor(ownAccount);
		const listed = await runOk({
			resource: 'accountNotification',
			operation: 'getAll',
			params: { accountId: ownAccount, options: { include_all: true }, pagination: { returnAll: true } },
		});
		expect(ids(listed)).toEqual(ids(expected));
		for (const n of createdNotifications.filter((c) => c.account === ownAccount)) {
			expect(ids(listed)).toContain(Number(n.id));
		}
		expect(ids(listed)).toContain(Number(fx('accountNotificationId')));
	});

	it('getAll: a student sees only what targets them, and may not use "Include All"', async () => {
		const student = new CanvasClient('student');
		const expected = await student.get<Json[]>(`/api/v1/accounts/${root}/account_notifications`);
		const listed = await runOk({
			resource: 'accountNotification',
			operation: 'getAll',
			persona: 'student',
			params: { accountId: root },
		});
		expect(ids(listed)).toEqual(ids(expected));
		expect(ids(listed)).not.toContain(Number(activeId));

		const all = await runNode({
			resource: 'accountNotification',
			operation: 'getAll',
			persona: 'student',
			params: { accountId: root, options: { include_all: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(all.success).toEqual([]);
		expect(all.error[0].errorType).toBe('FORBIDDEN');
	});

	// ------------------------------------------------------------------ update

	it('update: every optional field reaches Canvas', async () => {
		const startAt = hoursFromNow(600);
		const endAt = hoursFromNow(700);
		const newSubject = unique('Battery updated — عنوان جديد');
		const [updated] = await runOk({
			resource: 'accountNotification',
			operation: 'update',
			params: {
				accountId: root,
				notificationId: futureId,
				message: '<p>Second <em>version</em> with "quotes" &amp; 🎓</p>',
				updateFields: {
					subject: newSubject,
					start_at: startAt,
					end_at: endAt,
					icon: 'error',
					roles: `StudentEnrollment,${fx('accountAdminRoleId')}`,
					send_message: false,
				},
			},
		});
		expect(updated.subject).toBe(newSubject);
		const actual = (await find(root, futureId))!;
		expect(actual).toMatchObject({ subject: newSubject, icon: 'error', start_at: startAt, end_at: endAt });
		expect(String(actual.message)).toContain('<em>version</em>');
		expect(String(actual.message)).toContain('"quotes"');
		expect((actual.role_ids as number[]).sort()).toEqual(
			[Number(fx('studentRoleId')), Number(fx('accountAdminRoleId'))].sort(),
		);
	});

	it('update: only the message and the roles are replaced when nothing else is set', async () => {
		const before = (await find(root, futureId))!;
		await runOk({
			resource: 'accountNotification',
			operation: 'update',
			items: [{ roles: ['TeacherEnrollment', Number(fx('customRoleId'))] }],
			params: {
				accountId: root,
				notificationId: futureId,
				message: 'Third version',
				updateFields: { roles: '={{ $json.roles }}' },
			},
		});
		const actual = (await find(root, futureId))!;
		expect(actual).toMatchObject({
			message: 'Third version',
			subject: before.subject,
			icon: before.icon,
			start_at: before.start_at,
			end_at: before.end_at,
		});
		expect((actual.role_ids as number[]).sort()).toEqual(
			[Number(fx('teacherRoleId')), Number(fx('customRoleId'))].sort(),
		);
	});

	it('update: Canvas replaces the roles on every update, so leaving them out opens the notification to everyone', async () => {
		await runOk({
			resource: 'accountNotification',
			operation: 'update',
			params: {
				accountId: root,
				notificationId: futureId,
				message: 'Fourth version',
				updateFields: { icon: 'information' },
			},
		});
		const actual = (await find(root, futureId))!;
		expect(actual).toMatchObject({ icon: 'information', message: 'Fourth version' });
		expect(actual.role_ids).toEqual([]);
	});

	it('update: the message is required, because Canvas rejects an update without it', async () => {
		// Left out entirely: n8n refuses to run the workflow (required field).
		const missing = await runNode({
			resource: 'accountNotification',
			operation: 'update',
			params: {
				accountId: root,
				notificationId: futureId,
				updateFields: { icon: 'warning' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(missing.success).toEqual([]);
		expect(missing.ok && missing.error.length === 0).toBe(false);

		// Resolving to nothing at run time: the node explains it instead of passing on Canvas' 400.
		const empty = await runNode({
			resource: 'accountNotification',
			operation: 'update',
			items: [{ text: '' }],
			params: {
				accountId: root,
				notificationId: futureId,
				message: '={{ $json.text }}',
				updateFields: { icon: 'warning' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(empty.success).toEqual([]);
		expect(String(empty.error[0]?.errorMessage ?? empty.failure?.message)).toMatch(/Message is required/);
		expect(await find(root, futureId)).toMatchObject({ icon: 'information', message: 'Fourth version' });
	});

	it('update: an invalid date range is refused with the field named', async () => {
		const result = await runNode({
			resource: 'accountNotification',
			operation: 'update',
			params: {
				accountId: root,
				notificationId: futureId,
				message: 'Should not be applied',
				updateFields: { end_at: hoursFromNow(-5000) },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('end_at');
		expect((await find(root, futureId))!.message).toBe('Fourth version');
	});

	it('update: an unknown notification and a notification of another account are not found', async () => {
		const result = await runNode({
			resource: 'accountNotification',
			operation: 'update',
			items: [{ account: ownAccount, id: '99999999' }, { account: ownAccount, id: activeId }],
			params: {
				accountId: '={{ $json.account }}',
				notificationId: '={{ $json.id }}',
				message: 'Should not be applied',
				updateFields: { subject: 'Should not be applied' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'update' });
		}
		expect((await find(root, activeId))!.subject).toBe(subject);
	});

	// ------------------------------------------------------------------- close

	it('close: dismisses the notification for the current user only', async () => {
		const [closed] = await runOk({
			resource: 'accountNotification',
			operation: 'close',
			params: { accountId: root, notificationId: activeId },
		});
		expect(closed).toMatchObject({ id: Number(activeId), subject });

		const current = await canvas().get<Json[]>(`/api/v1/accounts/${root}/account_notifications`);
		expect(ids(current)).not.toContain(Number(activeId));
		// Once closed, Canvas no longer hands it out to this user ...
		const single = await canvas().request('GET', `/api/v1/accounts/${root}/account_notifications/${activeId}`);
		expect([401, 403]).toContain(single.status);
		// ... and flags it as closed in the list with past notifications (cached for up to 10
		// minutes by Canvas, so a notification created moments ago may not be listed yet).
		const withClosed = await canvas().get<Json[]>(
			`/api/v1/accounts/${root}/account_notifications?include_past=true&show_is_closed=true`,
		);
		const listedAgain = withClosed.find((n) => String(n.id) === activeId);
		if (listedAgain) expect(listedAgain.closed).toBe(true);
		// Still exists for everyone else.
		expect(await find(root, activeId)).toBeDefined();
		// (What other users see cannot be asserted here: Canvas caches the list of current
		// notifications for up to 10 minutes for users with enrollments in sub-accounts.)
	});

	it('close: "Remove" off behaves like close, and a teacher cannot remove a notification', async () => {
		const result = await runNode({
			resource: 'accountNotification',
			operation: 'close',
			persona: 'teacher',
			items: [{ remove: false }, { remove: true }],
			params: {
				accountId: root,
				notificationId: activeId,
				options: { remove: '={{ $json.remove }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((n) => n.id)).toEqual([Number(activeId)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ originalItem: { remove: true } });
		expect([401, 403]).toContain(result.error[0].errorCode);
		expect(await find(root, activeId)).toBeDefined();
	});

	it('close: with "Remove" an admin deletes the notification for everyone', async () => {
		const [removed] = await runOk({
			resource: 'accountNotification',
			operation: 'close',
			params: { accountId: root, notificationId: activeId, options: { remove: true } },
		});
		expect(removed.id).toBe(Number(activeId));
		expect(await find(root, activeId)).toBeUndefined();

		// Canvas answers a repeated removal with the (already removed) record instead of an error.
		const again = await runNode({
			resource: 'accountNotification',
			operation: 'close',
			params: {
				accountId: root,
				notificationId: activeId,
				options: { remove: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(again.error).toEqual([]);
		expect(again.success.map((n) => n.id)).toEqual([Number(activeId)]);
		expect(await find(root, activeId)).toBeUndefined();
	});
});
