import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { uploadFile } from './content.helper';
import { createTokenPersona } from './lti-advantage.helper';
import { asUser, createUser, createUserWithToken, deleteUser } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * Resource: contentShare ("Send To..."). Shares land in people's personal
 * lists, so the file works with users of its own: a teacher who sends
 * (persona `shareSender`), a colleague who receives (persona `shareReceiver`)
 * and two more receivers.
 */
describe('contentShare', () => {
	const sender = 'shareSender';
	const receiver = 'shareReceiver';
	let courseId = '';
	let senderUser: OwnUser;
	let receiverUser: OwnUser;
	let extraOne: OwnUser;
	let extraTwo: OwnUser;
	const cleanups: Array<() => Promise<void>> = [];
	/** Content of the sender's course, by content type of the share API. */
	const content: Record<string, { id: string; name: string }> = {};
	/** ID of the sender's share per content type. */
	const shares: Record<string, string> = {};

	const received = (user: OwnUser): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/users/${user.id}/content_shares/received`);
	const sent = (): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/users/${senderUser.id}/content_shares/sent`);

	beforeAll(async () => {
		[senderUser, receiverUser] = await Promise.all([
			createUserWithToken('Share sender'),
			createUserWithToken('Share receiver'),
		]);
		[extraOne, extraTwo] = await Promise.all([createUser('Share extra one'), createUser('Share extra two')]);
		cleanups.push(await createTokenPersona(sender, senderUser.token as string));
		cleanups.push(await createTokenPersona(receiver, receiverUser.token as string));

		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Share battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const api = `/api/v1/courses/${courseId}`;
		await canvas().post(`${api}/enrollments`, {
			enrollment: { user_id: senderUser.id, type: 'TeacherEnrollment', enrollment_state: 'active' },
		});

		const assignment = await canvas().post<Json>(`${api}/assignments`, {
			assignment: { name: 'Shared assignment Ünïcødé 课 "quoted" & <b>tags</b>', points_possible: 5 },
		});
		content.assignment = { id: String(assignment.id), name: String(assignment.name) };
		const topic = await canvas().post<Json>(`${api}/discussion_topics`, { title: 'Shared discussion', message: 'Talk' });
		content.discussion_topic = { id: String(topic.id), name: 'Shared discussion' };
		const page = await canvas().post<Json>(`${api}/pages`, { wiki_page: { title: 'Shared page', body: '<p>Page</p>' } });
		content.page = { id: String(page.page_id), name: 'Shared page' };
		const quiz = await canvas().post<Json>(`${api}/quizzes`, { quiz: { title: 'Shared quiz', quiz_type: 'practice_quiz' } });
		content.quiz = { id: String(quiz.id), name: 'Shared quiz' };
		const module = await canvas().post<Json>(`${api}/modules`, { module: { name: 'Shared module' } });
		content.module = { id: String(module.id), name: 'Shared module' };
		const item = await canvas().post<Json>(`${api}/modules/${String(module.id)}/items`, {
			module_item: { type: 'Page', page_url: page.url, title: 'Shared module item' },
		});
		content.module_item = { id: String(item.id), name: 'Shared module item' };
		const file = await uploadFile(`${api}/files`, 'shared-file.txt', 'shared file content');
		content.attachment = { id: String(file.id), name: 'shared-file.txt' };
	});

	afterAll(async () => {
		for (const cleanup of cleanups) await cleanup();
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		for (const user of [senderUser, receiverUser, extraOne, extraTwo]) await deleteUser(user);
	});

	it('create: shares every kind of content with one or several users', async () => {
		for (const [contentType, item] of Object.entries(content)) {
			const [share] = await runOk({
				resource: 'contentShare',
				operation: 'create',
				persona: sender,
				// IDs arriving as numbers from an expression; receivers with stray spaces.
				items: [{ content: Number(item.id) }],
				params: {
					contentType,
					contentId: '={{ $json.content }}',
					receiverIds: contentType === 'assignment' ? ` ${receiverUser.id} , ${extraOne.id} ` : receiverUser.id,
				},
			});
			shares[contentType] = String(share.id);
			expect(share).toMatchObject({
				name: item.name,
				content_type: contentType,
				user_id: Number(senderUser.id),
				read_state: 'read',
				content_export: { id: expect.any(Number) },
			});
			expect((share.receivers as Json[]).map((r) => r.id).sort()).toEqual(
				(contentType === 'assignment' ? [receiverUser.id, extraOne.id] : [receiverUser.id]).map(Number).sort(),
			);
		}

		const sentShares = await sent();
		expect(sentShares.map((s) => String(s.id)).sort()).toEqual(Object.values(shares).sort());

		const inbox = await received(receiverUser);
		expect(inbox.map((s) => s.name).sort()).toEqual(Object.values(content).map((c) => c.name).sort());
		expect(inbox.every((s) => s.read_state === 'unread' && (s.sender as Json).id === Number(senderUser.id))).toBe(true);
		expect((await received(extraOne)).map((s) => s.name)).toEqual([content.assignment.name]);
		expect(await received(extraTwo)).toEqual([]);
	});

	it('create: Canvas refuses unknown content and receivers that do not exist', async () => {
		const noContent = await runNode({
			resource: 'contentShare',
			operation: 'create',
			persona: sender,
			params: {
				contentType: 'assignment',
				contentId: '99999999',
				receiverIds: receiverUser.id,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(noContent.success).toEqual([]);
		expect(noContent.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(String(noContent.error[0].errorMessage)).toContain('Requested share content not found');

		const noReceivers = await runNode({
			resource: 'contentShare',
			operation: 'create',
			persona: sender,
			params: {
				contentType: 'page',
				contentId: content.page.id,
				receiverIds: '99999998,99999999',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(noReceivers.success).toEqual([]);
		expect(noReceivers.error[0]).toMatchObject({ errorCode: 400 });
		expect(String(noReceivers.error[0].errorMessage)).toContain('No valid receiving users found');

		// Someone who may not export the content (not a teacher of the course) cannot share it.
		const notAllowed = await runNode({
			resource: 'contentShare',
			operation: 'create',
			persona: receiver,
			params: {
				contentType: 'page',
				contentId: content.page.id,
				receiverIds: extraTwo.id,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(notAllowed.success).toEqual([]);
		expect(notAllowed.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect(await received(extraTwo)).toEqual([]);
	});

	it('getAll: sent and received shares of the token\'s user, with paging', async () => {
		const expectedSent = await asUser<Json[]>(senderUser, 'GET', '/api/v1/users/self/content_shares/sent?per_page=100');
		const sentByNode = await runOk({
			resource: 'contentShare',
			operation: 'getAll',
			persona: sender,
			params: { shareType: 'sent' },
		});
		expect(sentByNode.map((s) => s.id)).toEqual(expectedSent.map((s) => s.id));
		expect(sentByNode).toHaveLength(7);

		const expectedReceived = await asUser<Json[]>(
			receiverUser,
			'GET',
			'/api/v1/users/self/content_shares/received?per_page=100',
		);
		const receivedByNode = await runOk({
			resource: 'contentShare',
			operation: 'getAll',
			persona: receiver,
			params: { shareType: 'received', pagination: { returnAll: true } },
		});
		expect(receivedByNode.map((s) => s.id)).toEqual(expectedReceived.map((s) => s.id));

		const twoPages = await runOk({
			resource: 'contentShare',
			operation: 'getAll',
			persona: receiver,
			params: { shareType: 'received', pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(twoPages.map((s) => s.id)).toEqual(expectedReceived.slice(0, 6).map((s) => s.id));

		// The sender has received nothing, the receiver has sent nothing.
		expect(
			await runOk({ resource: 'contentShare', operation: 'getAll', persona: sender, params: { shareType: 'received' } }),
		).toEqual([]);
		expect(
			await runOk({ resource: 'contentShare', operation: 'getAll', persona: receiver, params: { shareType: 'sent' } }),
		).toEqual([]);
	});

	it('get, getAll, getUnreadCount: an admin reads the shares of another user', async () => {
		const [share] = await runOk({
			resource: 'contentShare',
			operation: 'get',
			params: { userId: senderUser.id, contentShareId: shares.quiz },
		});
		expect(share).toMatchObject({ id: Number(shares.quiz), name: 'Shared quiz', content_type: 'quiz' });

		const [own] = await runOk({
			resource: 'contentShare',
			operation: 'get',
			persona: sender,
			params: { contentShareId: shares.quiz },
		});
		expect(own).toMatchObject({ id: Number(shares.quiz), user_id: Number(senderUser.id) });

		const inbox = await runOk({
			resource: 'contentShare',
			operation: 'getAll',
			items: [{ user: Number(receiverUser.id) }],
			params: { userId: '={{ $json.user }}', shareType: 'received', pagination: { returnAll: true } },
		});
		expect(inbox.map((s) => s.id)).toEqual((await received(receiverUser)).map((s) => s.id));

		const [count] = await runOk({
			resource: 'contentShare',
			operation: 'getUnreadCount',
			params: { userId: receiverUser.id },
		});
		expect(count).toEqual({ unread_count: 7 });
		const [ownCount] = await runOk({ resource: 'contentShare', operation: 'getUnreadCount', persona: receiver });
		expect(ownCount).toEqual({ unread_count: 7 });
		const [none] = await runOk({ resource: 'contentShare', operation: 'getUnreadCount', persona: sender });
		expect(none).toEqual({ unread_count: 0 });
	});

	it('update: the receiver marks a share read and unread again', async () => {
		const inbox = await received(receiverUser);
		const target = inbox.find((s) => s.content_type === 'page') as Json;

		const [read] = await runOk({
			resource: 'contentShare',
			operation: 'update',
			persona: receiver,
			params: { contentShareId: String(target.id), readState: 'read' },
		});
		expect(read).toMatchObject({ id: target.id, read_state: 'read' });
		expect((await received(receiverUser)).find((s) => s.id === target.id)).toMatchObject({ read_state: 'read' });
		expect(await canvas().get<Json>(`/api/v1/users/${receiverUser.id}/content_shares/unread_count`)).toEqual({
			unread_count: 6,
		});

		await runOk({
			resource: 'contentShare',
			operation: 'update',
			persona: receiver,
			params: { contentShareId: String(target.id), readState: 'unread' },
		});
		expect((await received(receiverUser)).find((s) => s.id === target.id)).toMatchObject({ read_state: 'unread' });
	});

	it('addUsers: sends an existing share to more people; those who have it are skipped', async () => {
		const [share] = await runOk({
			resource: 'contentShare',
			operation: 'addUsers',
			persona: sender,
			params: { contentShareId: shares.assignment, receiverIds: `${extraOne.id},${extraTwo.id},${receiverUser.id}` },
		});
		expect((share.receivers as Json[]).map((r) => r.id).sort()).toEqual(
			[receiverUser.id, extraOne.id, extraTwo.id].map(Number).sort(),
		);
		expect((await received(extraTwo)).map((s) => s.name)).toEqual([content.assignment.name]);
		// Nobody got it twice.
		expect(await received(extraOne)).toHaveLength(1);
		expect((await received(receiverUser)).filter((s) => s.content_type === 'assignment')).toHaveLength(1);
	});

	it('addUsers / update / delete: only on the shares of the token\'s user', async () => {
		// A received share cannot be forwarded with Add Users.
		const receivedShare = (await received(receiverUser)).find((s) => s.content_type === 'quiz') as Json;
		const forward = await runNode({
			resource: 'contentShare',
			operation: 'addUsers',
			persona: receiver,
			params: {
				contentShareId: String(receivedShare.id),
				receiverIds: extraTwo.id,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forward.success).toEqual([]);
		expect(forward.error[0]).toMatchObject({ errorType: 'VALIDATION_ERROR', operation: 'addUsers' });
		expect(String(forward.error[0].errorMessage)).toContain('Content share not owned by you');

		// The admin can read the sender's share but not change or delete it.
		for (const operation of ['update', 'delete']) {
			const result = await runNode({
				resource: 'contentShare',
				operation,
				params: { contentShareId: shares.quiz, readState: 'unread', errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation });
		}
		expect((await sent()).map((s) => String(s.id))).toContain(shares.quiz);

		// A stranger may not even read them.
		const stranger = await runNode({
			resource: 'contentShare',
			operation: 'getAll',
			persona: receiver,
			params: { userId: senderUser.id, shareType: 'sent', errorHandling: { onError: 'continueWithError' } },
		});
		expect(stranger.success).toEqual([]);
		expect(stranger.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
	});

	it('delete: removes a share from one\'s own list only', async () => {
		const target = (await received(receiverUser)).find((s) => s.content_type === 'module') as Json;
		const [deleted] = await runOk({
			resource: 'contentShare',
			operation: 'delete',
			persona: receiver,
			params: { contentShareId: String(target.id) },
		});
		expect(deleted).toEqual({ message: 'content share deleted' });
		expect((await received(receiverUser)).map((s) => s.id)).not.toContain(target.id);
		// The sender still has theirs.
		expect((await sent()).map((s) => String(s.id))).toContain(shares.module);

		const [senderDeleted] = await runOk({
			resource: 'contentShare',
			operation: 'delete',
			persona: sender,
			params: { contentShareId: shares.module },
		});
		expect(senderDeleted).toEqual({ message: 'content share deleted' });
		expect((await sent()).map((s) => String(s.id))).not.toContain(shares.module);

		const again = await runNode({
			resource: 'contentShare',
			operation: 'delete',
			persona: sender,
			params: { contentShareId: shares.module, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
	});
});
