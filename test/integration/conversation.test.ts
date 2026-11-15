import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox, SandboxUser } from './support/commsSandbox';
import { clientFor, commsSandbox, waitFor } from './support/commsSandbox';

/**
 * Resource: conversation (the Canvas inbox). Runs entirely inside the private
 * sandbox course: its teacher writes to its students, and three students with
 * their own credentials read, star, archive and delete.
 */

/** Upload a file into the user's "conversation attachments" folder (the only place Canvas accepts attachments from). */
async function uploadAttachment(client: CanvasClient, name: string): Promise<string> {
	const content = Buffer.from(`attachment ${name}`);
	const slot = await client.post<Json>('/api/v1/users/self/files', {
		name,
		size: content.length,
		content_type: 'text/plain',
		parent_folder_path: 'conversation attachments',
		on_duplicate: 'rename',
	});
	const form = new FormData();
	for (const [key, value] of Object.entries(slot.upload_params as Json)) form.append(key, String(value));
	form.append('file', new Blob([content], { type: 'text/plain' }), name);
	const uploaded = await fetch(String(slot.upload_url), { method: 'POST', body: form, redirect: 'manual' });
	const confirmed = await client.request('GET', String(uploaded.headers.get('location')));
	return String((confirmed.data as Json).id);
}

/** A user's view of a conversation, without flipping it to "read". */
function view(client: CanvasClient, id: string | number): Promise<Json> {
	return client.get<Json>(`/api/v1/conversations/${id}?auto_mark_as_read=false`);
}

function messagesOf(conversation: Json): Json[] {
	return conversation.messages as Json[];
}

describe('conversation', () => {
	let sbx: Sandbox;
	let teacherUser: SandboxUser;
	let s1User: SandboxUser;
	let s2User: SandboxUser;
	let s3User: SandboxUser;
	let teacher: CanvasClient;
	let s1: CanvasClient;
	let s2: CanvasClient;
	let s3: CanvasClient;
	let courseCode = '';

	/** Private conversation teacher <-> student 1 in the course context. */
	let privateId = '';
	/** Group conversation teacher + students 1 and 2. */
	let groupId = '';
	let groupFirstMessageId = '';

	const asTeacher = 'sbxTeacher';

	/** A new group-style conversation from the teacher, for tests that need a clean one. */
	async function newConversation(recipients: SandboxUser[], body = 'Fresh conversation'): Promise<Json> {
		const created = await teacher.post<Json[]>('/api/v1/conversations', {
			recipients: recipients.map((r) => r.id),
			body,
			subject: unique('Battery'),
			// Group conversations are never reused, so this is always a new thread.
			group_conversation: true,
		});
		return created[0];
	}

	beforeAll(async () => {
		sbx = await commsSandbox();
		teacherUser = sbx.teacher;
		[s1User, s2User, s3User] = sbx.students;
		teacher = clientFor(teacherUser);
		s1 = clientFor(s1User);
		s2 = clientFor(s2User);
		s3 = clientFor(s3User);
		courseCode = `course_${sbx.courseId}`;
	}, 900_000);

	// ---------------------------------------------------------------- create

	it('create: a private conversation with every optional field', async () => {
		const attachmentId = await uploadAttachment(teacher, 'reading list.txt');
		const subject = unique('Private "quoted" & <b>tags</b> ünïcødé 日本語');
		const body = 'Hello 👋 — first line\nsecond line & "quotes" <script>alert(1)</script> مرحبا بالعالم';
		const mediaId = unique('m-battery').replace(/\s/g, '-');

		const created = await runOk({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: {
				recipients: s1User.id,
				body,
				additionalFields: {
					attachment_ids: attachmentId,
					context_code: courseCode,
					group_conversation: false,
					media_comment_id: mediaId,
					media_comment_type: 'video',
					mode: 'sync',
					subject,
				},
			},
		});
		expect(created).toHaveLength(1);
		privateId = String(created[0].id);

		const actual = await view(teacher, privateId);
		expect(actual).toMatchObject({ private: true, context_code: courseCode, audience: [Number(s1User.id)] });
		const [message] = messagesOf(actual);
		expect(message).toMatchObject({ body, author_id: Number(teacherUser.id) });
		expect((message.attachments as Json[]).map((a) => String(a.id))).toEqual([attachmentId]);
		expect(message.media_comment).toMatchObject({ media_id: mediaId, media_type: 'video' });

		// The recipient really got it, unread.
		const inbox = await s1.getAll<Json>('/api/v1/conversations?scope=unread');
		expect(inbox.map((c) => String(c.id))).toContain(privateId);
	});

	it('create: without "Force New" a private conversation is reused and the subject ignored', async () => {
		const before = await view(teacher, privateId);
		const [again] = await runOk({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: {
				recipients: ` ${s1User.id} `,
				body: 'Second message, same thread',
				additionalFields: { context_code: courseCode, subject: 'This subject is ignored' },
			},
		});
		expect(String(again.id)).toBe(privateId);
		const after = await view(teacher, privateId);
		expect(after.subject).toBe(before.subject);
		expect(after.message_count).toBe(Number(before.message_count) + 1);
	});

	it('create: "Force New" starts a separate conversation with the same person', async () => {
		const subject = unique('Forced');
		const [forced] = await runOk({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: {
				recipients: s1User.id,
				body: 'A new thread although one exists',
				additionalFields: { context_code: courseCode, force_new: true, subject },
			},
		});
		expect(String(forced.id)).not.toBe(privateId);
		expect(await view(teacher, String(forced.id))).toMatchObject({ subject, message_count: 1 });
	});

	it('create: a group conversation puts all recipients in one thread', async () => {
		const subject = unique('Group 🧪 مجموعة');
		const created = await runOk({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: {
				recipients: `${s1User.id}, ${s2User.id}`,
				body: 'Everyone can see every reply',
				additionalFields: { group_conversation: true, subject, context_code: courseCode },
			},
		});
		expect(created).toHaveLength(1);
		groupId = String(created[0].id);
		const actual = await view(teacher, groupId);
		expect(actual).toMatchObject({ subject, private: false });
		expect((actual.audience as number[]).sort()).toEqual([Number(s1User.id), Number(s2User.id)].sort());
		groupFirstMessageId = String(messagesOf(actual)[0].id);
		expect((await view(s2, groupId)).subject).toBe(subject);
	});

	it('create: "Bulk Message" and "Force New" give each recipient their own new conversation', async () => {
		for (const flags of [{ group_conversation: true, bulk_message: true }, { force_new: true }]) {
			const subject = unique('Individually');
			const created = await runOk({
				resource: 'conversation',
				operation: 'create',
				persona: asTeacher,
				params: {
					recipients: `${s1User.id},${s2User.id}`,
					body: 'Same text, separate threads',
					additionalFields: { ...flags, subject, context_code: courseCode },
				},
			});
			expect(created, JSON.stringify(flags)).toHaveLength(2);
			expect(created.map((c) => (c.audience as number[])[0]).sort()).toEqual([Number(s1User.id), Number(s2User.id)].sort());
			for (const conversation of created) {
				expect(await view(teacher, String(conversation.id))).toMatchObject({ subject, message_count: 1 });
			}
		}
	});

	it('create: a course as recipient makes one private conversation per student', async () => {
		// Private conversations are kept apart per context, so the two rounds address different threads
		// (and leave the teacher with more sent conversations than fit on one Canvas page).
		for (const context of [{ context_code: courseCode }, {}]) {
			const body = unique('Reminder to the whole class');
			const created = await runOk({
				resource: 'conversation',
				operation: 'create',
				persona: asTeacher,
				params: {
					recipients: `${courseCode}_students`,
					body,
					additionalFields: { ...context, subject: 'Class reminder' },
				},
			});
			expect(created).toHaveLength(sbx.students.length);
			const audiences = created.map((c) => (c.audience as number[])[0]).sort((a, b) => a - b);
			expect(audiences).toEqual(sbx.students.map((s) => Number(s.id)).sort((a, b) => a - b));
			expect(created.every((c) => c.private === true)).toBe(true);
			const lastStudent = sbx.students[sbx.students.length - 1];
			const theirs = created.find((c) => (c.audience as number[])[0] === Number(lastStudent.id)) as Json;
			const actual = await view(teacher, String(theirs.id));
			expect(actual.last_authored_message).toBe(body);
			expect(actual.context_code ?? null).toBe(context.context_code ?? null);
		}
	});

	it('create + getBatches: async mode returns no items and the batch can be followed', async () => {
		const body = unique('Async announcement');
		const result = await runNode({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: { recipients: `${courseCode}_students`, body, additionalFields: { context_code: courseCode, mode: 'async' } },
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([]);

		const batches = await runOk({ resource: 'conversation', operation: 'getBatches', persona: asTeacher });
		const stillRunning = await teacher.getAll<Json>('/api/v1/conversations/batches');
		// Batches only ever disappear, so what Canvas still reports must have been in the node's output.
		const listed = batches.map((b) => b.id);
		for (const batch of stillRunning) expect(listed).toContain(batch.id);
		for (const batch of batches) expect(batch).toHaveProperty('workflow_state');

		// The messages do arrive once the job has run.
		const lastStudent = sbx.students[sbx.students.length - 1];
		await waitFor(
			async () => {
				const sent = await teacher.getAll<Json>(`/api/v1/conversations?scope=sent&filter[]=user_${lastStudent.id}`);
				return sent.some((c) => c.last_authored_message === body);
			},
			150_000,
			'the async batch to be delivered',
		);
	});

	// ---------------------------------------------------------------- getAll

	it('getAll: Return All / Limit against a mailbox larger than a page', async () => {
		const expected = await teacher.getAll<Json>('/api/v1/conversations?scope=sent');
		expect(expected.length, 'the bulk messages should have left more sent conversations than one page holds').toBeGreaterThan(100);

		const all = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { returnAll: true, options: { scope: 'sent' } },
		});
		expect(all.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(new Set(all.map((c) => c.id)).size).toBe(all.length);

		const byDefault = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { scope: 'sent' } },
		});
		expect(byDefault.map((c) => c.id)).toEqual(expected.slice(0, 50).map((c) => c.id));

		const seven = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { returnAll: false, limit: 7, options: { scope: 'sent' } },
		});
		expect(seven.map((c) => c.id)).toEqual(expected.slice(0, 7).map((c) => c.id));

		const generous = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { returnAll: false, limit: 5000, options: { scope: 'sent' } },
		});
		expect(generous.map((c) => c.id)).toEqual(expected.map((c) => c.id));

		// A limit beyond one Canvas page (100) ends in the middle of the second page.
		const beyondAPage = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { returnAll: false, limit: 104, options: { scope: 'sent' } },
		});
		expect(beyondAPage.map((c) => c.id)).toEqual(expected.slice(0, 104).map((c) => c.id));
	});

	it('getAll: filters by person and context, combined with And / Or', async () => {
		const both = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: {
				returnAll: true,
				options: { scope: 'sent', filter: `user_${s1User.id}, user_${s2User.id}`, filter_mode: 'and' },
			},
		});
		const expectedBoth = await teacher.getAll<Json>(
			`/api/v1/conversations?scope=sent&filter[]=user_${s1User.id}&filter[]=user_${s2User.id}&filter_mode=and`,
		);
		expect(both.map((c) => c.id)).toEqual(expectedBoth.map((c) => c.id));
		expect(both.map((c) => String(c.id))).toContain(groupId);
		expect(both.map((c) => String(c.id))).not.toContain(privateId);

		const either = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: {
				returnAll: true,
				options: { scope: 'sent', filter: `user_${s1User.id},user_${s2User.id}`, filter_mode: 'or' },
			},
		});
		const expectedEither = await teacher.getAll<Json>(
			`/api/v1/conversations?scope=sent&filter[]=user_${s1User.id}&filter[]=user_${s2User.id}&filter_mode=or`,
		);
		expect(either.map((c) => c.id)).toEqual(expectedEither.map((c) => c.id));
		expect(either.length).toBeGreaterThan(both.length);
		expect(either.map((c) => String(c.id))).toContain(privateId);

		const single = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { returnAll: true, options: { scope: 'sent', filter: `user_${s2User.id}` } },
		});
		expect(single.length).toBeGreaterThan(0);
		for (const conversation of single) {
			expect((conversation.participants as Json[]).map((p) => String(p.id))).toContain(s2User.id);
		}

		const nobody = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { returnAll: true, options: { scope: 'sent', filter: 'user_99999999' } },
		});
		expect(nobody).toEqual([]);
	});

	it('getAll: includes add participant avatars and UUIDs', async () => {
		const plain = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { limit: 3, options: { scope: 'sent' } },
		});
		expect((plain[0].participants as Json[])[0]).not.toHaveProperty('uuid');

		const rich = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { limit: 3, options: { scope: 'sent', include: ['participant_avatars', 'uuid'] } },
		});
		expect(rich).toHaveLength(3);
		for (const conversation of rich) {
			for (const participant of conversation.participants as Json[]) {
				expect(participant.uuid).toBeTypeOf('string');
				expect(participant).toHaveProperty('avatar_url');
			}
		}
	});

	it('getAll: "Include All Conversation IDs" yields one item with the page and every ID', async () => {
		const expected = await teacher.getAll<Json>('/api/v1/conversations?scope=sent');
		const result = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { limit: 5, options: { scope: 'sent', include_all_conversation_ids: true } },
		});
		expect(result).toHaveLength(1);
		expect(result[0].conversation_ids).toEqual(expected.map((c) => c.id));
		expect((result[0].conversations as Json[]).map((c) => c.id)).toEqual(expected.slice(0, 5).map((c) => c.id));

		// Switched off it must not change the shape.
		const off = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: asTeacher,
			params: { limit: 5, options: { scope: 'sent', include_all_conversation_ids: false } },
		});
		expect(off.map((c) => c.id)).toEqual(expected.slice(0, 5).map((c) => c.id));
	});

	// ---------------------------------------------------------------- get

	it('get: returns the messages; reading marks it read unless told otherwise', async () => {
		const fresh = await newConversation([s1User], 'Read me');
		const id = String(fresh.id);
		const stateFor = async (): Promise<unknown> =>
			(await s1.getAll<Json>('/api/v1/conversations')).find((c) => String(c.id) === id)?.workflow_state;
		expect(await stateFor()).toBe('unread');

		const [peek] = await runOk({
			resource: 'conversation',
			operation: 'get',
			persona: 'sbxStudent1',
			params: { conversationId: id, options: { auto_mark_as_read: false } },
		});
		expect(peek).toMatchObject({ id: Number(id), subject: fresh.subject });
		expect(messagesOf(peek).map((m) => m.body)).toEqual(['Read me']);
		expect(await stateFor()).toBe('unread');

		const [read] = await runOk({
			resource: 'conversation',
			operation: 'get',
			persona: 'sbxStudent1',
			params: { conversationId: id },
		});
		expect(read.workflow_state).toBe('read');
		expect(await stateFor()).toBe('read');
	});

	it('get: scope and filter decide the "visible" flag', async () => {
		const inScope = await runOk({
			resource: 'conversation',
			operation: 'get',
			persona: asTeacher,
			params: { conversationId: groupId, options: { scope: 'sent', filter: `user_${s1User.id}, ${courseCode}` } },
		});
		expect(inScope[0].visible).toBe(true);

		const wrongScope = await runOk({
			resource: 'conversation',
			operation: 'get',
			persona: asTeacher,
			params: { conversationId: groupId, options: { scope: 'starred' } },
		});
		expect(wrongScope[0].visible).toBe(false);

		const wrongFilter = await runOk({
			resource: 'conversation',
			operation: 'get',
			persona: asTeacher,
			params: { conversationId: groupId, options: { scope: 'sent', filter: `user_${s3User.id}` } },
		});
		expect(wrongFilter[0].visible).toBe(false);
	});

	it('get: several input items, numeric IDs from expressions, one of them missing', async () => {
		const result = await runNode({
			resource: 'conversation',
			operation: 'get',
			persona: asTeacher,
			items: [{ id: Number(privateId) }, { id: 99999999 }, { id: Number(groupId) }],
			params: {
				conversationId: '={{ $json.id }}',
				options: { auto_mark_as_read: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((c) => String(c.id))).toEqual([privateId, groupId]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'conversation',
			operation: 'get',
			originalItem: { id: 99999999 },
		});
	});

	// ---------------------------------------------------------------- update

	it('update: star, archive and unsubscribe', async () => {
		const [updated] = await runOk({
			resource: 'conversation',
			operation: 'update',
			persona: 'sbxStudent2',
			params: { conversationId: groupId, updateFields: { starred: true, subscribed: false, workflow_state: 'archived' } },
		});
		expect(updated).toMatchObject({ id: Number(groupId), starred: true, subscribed: false, workflow_state: 'archived' });

		const archived = await s2.getAll<Json>('/api/v1/conversations?scope=archived');
		expect(archived.find((c) => String(c.id) === groupId)).toMatchObject({ starred: true, subscribed: false });
		const starred = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: 'sbxStudent2',
			params: { returnAll: true, options: { scope: 'starred' } },
		});
		expect(starred.map((c) => String(c.id))).toContain(groupId);
		const archivedByNode = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: 'sbxStudent2',
			params: { returnAll: true, options: { scope: 'archived' } },
		});
		expect(archivedByNode.map((c) => c.id)).toEqual(archived.map((c) => c.id));
		// Nobody else's view changed.
		expect(await view(teacher, groupId)).toMatchObject({ starred: false, subscribed: true });

		const [back] = await runOk({
			resource: 'conversation',
			operation: 'update',
			persona: 'sbxStudent2',
			params: { conversationId: groupId, updateFields: { starred: false, subscribed: true, workflow_state: 'unread' } },
		});
		expect(back).toMatchObject({ starred: false, subscribed: true, workflow_state: 'unread' });
		const unread = await runOk({
			resource: 'conversation',
			operation: 'getAll',
			persona: 'sbxStudent2',
			params: { returnAll: true, options: { scope: 'unread' } },
		});
		expect(unread.map((c) => String(c.id))).toContain(groupId);
		expect(unread.every((c) => c.workflow_state === 'unread')).toBe(true);
	});

	// ---------------------------------------------------------------- addMessage / addRecipients

	it('addMessage: a reply with attachment and media comment reaches everyone', async () => {
		const attachmentId = await uploadAttachment(s1, 'my homework ✏️.txt');
		const mediaId = unique('m-reply').replace(/\s/g, '-');
		const body = 'Here is my file — "thanks" & regards 😀';
		const [reply] = await runOk({
			resource: 'conversation',
			operation: 'addMessage',
			persona: 'sbxStudent1',
			params: {
				conversationId: groupId,
				messageBody: body,
				additionalFields: { attachment_ids: ` ${attachmentId} `, media_comment_id: mediaId, media_comment_type: 'audio' },
			},
		});
		expect(messagesOf(reply)).toHaveLength(1);
		const messageId = messagesOf(reply)[0].id;

		for (const reader of [teacher, s2]) {
			const message = messagesOf(await view(reader, groupId)).find((m) => m.id === messageId) as Json;
			expect(message).toMatchObject({ body, author_id: Number(s1User.id) });
			expect((message.attachments as Json[]).map((a) => String(a.id))).toEqual([attachmentId]);
			expect(message.media_comment).toMatchObject({ media_id: mediaId, media_type: 'audio' });
		}
	});

	it('addMessage: "Recipients" limits who receives the message', async () => {
		const body = unique('Only for student 1');
		await runOk({
			resource: 'conversation',
			operation: 'addMessage',
			persona: asTeacher,
			params: { conversationId: groupId, messageBody: body, additionalFields: { recipients: s1User.id } },
		});
		expect(messagesOf(await view(s1, groupId)).map((m) => m.body)).toContain(body);
		expect(messagesOf(await view(s2, groupId)).map((m) => m.body)).not.toContain(body);
	});

	it('addRecipients: a newcomer joins the thread and receives its history', async () => {
		const [grown] = await runOk({
			resource: 'conversation',
			operation: 'addRecipients',
			persona: asTeacher,
			params: { conversationId: groupId, recipients: `${s3User.id}` },
		});
		expect((grown.audience as number[]).map(String)).toContain(s3User.id);
		expect((grown.participants as Json[]).map((p) => String(p.id))).toContain(s3User.id);
		// The output carries the generated "... was added" message.
		expect(messagesOf(grown)[0]).toMatchObject({ generated: true });

		const theirs = await view(s3, groupId);
		expect(messagesOf(theirs).map((m) => String(m.id))).toContain(groupFirstMessageId);
		expect((await s3.getAll<Json>('/api/v1/conversations?scope=unread')).map((c) => String(c.id))).toContain(groupId);
	});

	it('addMessage: "Recipients" can bring in someone new without history; "Included Messages" forwards selected ones', async () => {
		const fresh = await newConversation([s1User], 'The original question');
		const id = String(fresh.id);
		const firstMessageId = String(messagesOf(await view(teacher, id))[0].id);

		// Student 2 is not part of the conversation yet and only gets the new message.
		const bodyForTwo = unique('Joining you in');
		await runOk({
			resource: 'conversation',
			operation: 'addMessage',
			persona: asTeacher,
			params: { conversationId: id, messageBody: bodyForTwo, additionalFields: { recipients: s2User.id } },
		});
		expect(messagesOf(await view(s2, id)).map((m) => m.body)).toEqual([bodyForTwo]);

		// Student 3 gets the new message and the forwarded original.
		const bodyForThree = unique('Joining you in, with context');
		await runOk({
			resource: 'conversation',
			operation: 'addMessage',
			persona: asTeacher,
			params: {
				conversationId: id,
				messageBody: bodyForThree,
				additionalFields: { included_messages: ` ${firstMessageId} `, recipients: `${s3User.id}` },
			},
		});
		const forThree = messagesOf(await view(s3, id));
		expect(forThree.map((m) => m.body)).toEqual([bodyForThree, 'The original question']);
		expect(forThree.map((m) => String(m.id))).toContain(firstMessageId);
		// Student 1 was in neither recipient list.
		expect(messagesOf(await view(s1, id)).map((m) => m.body)).toEqual(['The original question']);
	});

	it('addRecipients: several recipients at once, given with spaces', async () => {
		const fresh = await newConversation([s1User]);
		const [grown] = await runOk({
			resource: 'conversation',
			operation: 'addRecipients',
			persona: asTeacher,
			params: { conversationId: String(fresh.id), recipients: ` ${s2User.id} , ${s3User.id},` },
		});
		expect((grown.audience as number[]).sort()).toEqual([s1User, s2User, s3User].map((u) => Number(u.id)).sort());
	});

	it('addRecipients: Canvas cannot widen a private conversation (reported as an error)', async () => {
		const result = await runNode({
			resource: 'conversation',
			operation: 'addRecipients',
			persona: asTeacher,
			params: { conversationId: privateId, recipients: s2User.id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 500, errorType: 'SERVER_ERROR', operation: 'addRecipients' });
		expect((await view(teacher, privateId)).audience).toEqual([Number(s1User.id)]);
	});

	// ---------------------------------------------------------------- deleteMessages / getDeleted / restore

	it('deleteMessages -> getDeleted -> restore: a student removes messages and a site admin brings them back', async () => {
		const fresh = await newConversation([s1User], 'Message one');
		const id = String(fresh.id);
		for (const body of ['Message two', 'Message three']) {
			await teacher.post(`/api/v1/conversations/${id}/add_message`, { body });
		}
		const original = messagesOf(await view(s1, id));
		expect(original).toHaveLength(3);
		const [third, second, first] = original.map((m) => String(m.id));
		const beforeDelete = new Date(Date.now() - 5000).toISOString();

		const [trimmed] = await runOk({
			resource: 'conversation',
			operation: 'deleteMessages',
			persona: 'sbxStudent1',
			params: { conversationId: id, messageIds: `${first}, ${second}` },
		});
		expect(trimmed.message_count).toBe(1);
		expect(messagesOf(await view(s1, id)).map((m) => String(m.id))).toEqual([third]);
		// Only the student's own view changed.
		expect(messagesOf(await view(teacher, id))).toHaveLength(3);

		const deleted = await runOk({
			resource: 'conversation',
			operation: 'getDeleted',
			params: { userId: s1User.id, options: { conversation_id: id } },
		});
		expect(deleted.map((m) => String(m.id)).sort()).toEqual([first, second].sort());
		for (const message of deleted) {
			expect(message).toMatchObject({ user_id: Number(s1User.id), conversation_id: Number(id) });
			expect(message.deleted_at).toBeTypeOf('string');
		}

		const since = await runOk({
			resource: 'conversation',
			operation: 'getDeleted',
			params: { userId: s1User.id, options: { conversation_id: id, deleted_after: beforeDelete } },
		});
		expect(since).toHaveLength(2);
		const earlier = await runOk({
			resource: 'conversation',
			operation: 'getDeleted',
			params: { userId: s1User.id, options: { conversation_id: id, deleted_before: beforeDelete } },
		});
		expect(earlier).toEqual([]);
		const later = await runOk({
			resource: 'conversation',
			operation: 'getDeleted',
			params: {
				userId: s1User.id,
				options: { conversation_id: id, deleted_after: new Date(Date.now() + 3_600_000).toISOString() },
			},
		});
		expect(later).toEqual([]);

		// Restore both messages in one execution (one input item per message).
		const restored = await runOk({
			resource: 'conversation',
			operation: 'restore',
			items: [{ message: Number(first) }, { message: Number(second) }],
			params: { conversationId: id, userId: s1User.id, messageId: '={{ $json.message }}' },
		});
		expect(restored.map((m) => String(m.id)).sort()).toEqual([first, second].sort());
		expect(
			messagesOf(await view(s1, id))
				.map((m) => String(m.id))
				.sort(),
		).toEqual([first, second, third].sort());
		const none = await runOk({
			resource: 'conversation',
			operation: 'getDeleted',
			params: { userId: s1User.id, options: { conversation_id: id } },
		});
		expect(none).toEqual([]);
	});

	it('delete -> getDeleted: more deleted messages than a page are listed exactly once', async () => {
		const fresh = await newConversation([s2User], 'Thread message 0');
		const id = String(fresh.id);
		for (let i = 1; i <= 11; i++) {
			await teacher.post(`/api/v1/conversations/${id}/add_message`, { body: `Thread message ${i}` });
		}

		const [gone] = await runOk({
			resource: 'conversation',
			operation: 'delete',
			persona: 'sbxStudent2',
			params: { conversationId: id },
		});
		expect(gone).toMatchObject({ id: Number(id), message_count: 0 });
		expect((await s2.request('GET', `/api/v1/conversations/${id}`)).status).toBe(404);
		expect((await view(teacher, id)).message_count).toBe(12);

		// Canvas returns every deleted message on every "page" of this endpoint; the node must not multiply them.
		const expected = (await canvas().get<Json[]>(`/api/v1/conversations/deleted?user_id=${s2User.id}&per_page=100`)).map((m) => m.id);
		expect(expected.length).toBeGreaterThanOrEqual(12);
		expect(expected.length, 'keep this user below one Canvas page of deleted messages').toBeLessThanOrEqual(100);
		const deleted = await runOk({ resource: 'conversation', operation: 'getDeleted', params: { userId: s2User.id } });
		expect(deleted.map((m) => m.id)).toEqual(expected);
		expect(new Set(deleted.map((m) => m.id)).size).toBe(deleted.length);

		// Put them back so the user's pile of deleted messages does not grow from run to run.
		const mine = deleted.filter((m) => String(m.conversation_id) === id);
		expect(mine).toHaveLength(12);
		const restored = await runOk({
			resource: 'conversation',
			operation: 'restore',
			items: mine.map((m) => ({ id: m.id })),
			params: { conversationId: id, userId: s2User.id, messageId: '={{ $json.id }}' },
		});
		expect(restored).toHaveLength(12);
		expect((await view(s2, id)).message_count).toBe(12);
	});

	// ---------------------------------------------------------------- batchUpdate

	it('batchUpdate: every event is applied to all listed conversations', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 3; i++) ids.push(String((await newConversation([s3User], `Batch ${i}`)).id));
		// The teacher needs something in their own inbox view: a reply from the student.
		for (const id of ids) await s3.post(`/api/v1/conversations/${id}/add_message`, { body: 'Reply' });

		const run = async (event: string): Promise<void> => {
			const [progress] = await runOk({
				resource: 'conversation',
				operation: 'batchUpdate',
				persona: asTeacher,
				params: { conversationIds: ids.join(', '), event },
			});
			expect(progress).toMatchObject({ tag: 'conversation_batch_update' });
			await waitFor(
				async () => (await teacher.get<Json>(`/api/v1/progress/${String(progress.id)}`)).workflow_state === 'completed',
				150_000,
				`batch ${event} to complete`,
			);
		};
		const states = async (): Promise<Json[]> => Promise.all(ids.map((id) => view(teacher, id)));

		await run('star');
		expect((await states()).map((c) => c.starred)).toEqual([true, true, true]);
		await run('unstar');
		expect((await states()).map((c) => c.starred)).toEqual([false, false, false]);
		await run('mark_as_read');
		expect((await states()).map((c) => c.workflow_state)).toEqual(['read', 'read', 'read']);
		await run('mark_as_unread');
		expect((await states()).map((c) => c.workflow_state)).toEqual(['unread', 'unread', 'unread']);
		await run('archive');
		expect((await states()).map((c) => c.workflow_state)).toEqual(['archived', 'archived', 'archived']);
		await run('destroy');
		for (const id of ids) {
			expect((await teacher.request('GET', `/api/v1/conversations/${id}`)).status).toBe(404);
			// "Destroy" only removes the caller's copy.
			expect((await view(s3, id)).message_count).toBeGreaterThan(0);
		}
	});

	it('batchUpdate: an unknown event is refused by Canvas', async () => {
		const result = await runNode({
			resource: 'conversation',
			operation: 'batchUpdate',
			persona: asTeacher,
			params: { conversationIds: privateId, event: 'explode', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(result.error[0].errorMessage)).toContain('invalid event');
	});

	// ---------------------------------------------------------------- unread count / mark all as read

	it('getUnreadCount + markAllAsRead: the counter follows the inbox', async () => {
		await newConversation([s3User], 'Unread for the counter');
		const expected = await s3.get<Json>('/api/v1/conversations/unread_count');
		expect(Number(expected.unread_count)).toBeGreaterThan(0);

		const [count] = await runOk({ resource: 'conversation', operation: 'getUnreadCount', persona: 'sbxStudent3' });
		expect(count).toEqual(expected);

		const marked = await runOk({ resource: 'conversation', operation: 'markAllAsRead', persona: 'sbxStudent3' });
		expect(marked).toHaveLength(1);
		expect(await s3.get<Json>('/api/v1/conversations/unread_count')).toEqual({ unread_count: '0' });
		expect(await s3.getAll<Json>('/api/v1/conversations?scope=unread')).toEqual([]);
		const [zero] = await runOk({ resource: 'conversation', operation: 'getUnreadCount', persona: 'sbxStudent3' });
		expect(zero).toEqual({ unread_count: '0' });
	});

	// ---------------------------------------------------------------- deleteForAll

	it('deleteForAll: a site admin removes a conversation from every inbox', async () => {
		const fresh = await newConversation([s1User, s2User], 'To be purged');
		const id = String(fresh.id);
		expect((await s1.request('GET', `/api/v1/conversations/${id}?auto_mark_as_read=false`)).status).toBe(200);

		const purged = await runOk({ resource: 'conversation', operation: 'deleteForAll', params: { conversationId: id } });
		expect(purged).toHaveLength(1);
		for (const reader of [teacher, s1, s2]) {
			expect((await reader.request('GET', `/api/v1/conversations/${id}`)).status).toBe(404);
		}
	});

	// ---------------------------------------------------------------- errors

	it('errors: an unknown recipient or an empty body is a validation error', async () => {
		const unknown = await runNode({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: { recipients: '99999999', body: 'Nobody home', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'conversation',
			operation: 'create',
			endpoint: '/api/v1/conversations',
		});

		const blank = await runNode({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: { recipients: s1User.id, body: '   ', errorHandling: { onError: 'continueWithError' } },
		});
		expect(blank.success).toEqual([]);
		expect(blank.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});

	it('errors: a subject longer than 255 characters is rejected with the field name', async () => {
		const result = await runNode({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: {
				recipients: s1User.id,
				body: 'Too long a subject',
				additionalFields: { subject: 'S'.repeat(256), group_conversation: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(result.error[0].errorMessage)).toMatch(/^subject: /);
		expect(result.error[0].canvasErrors).toMatchObject({ subject: [{ attribute: 'subject', type: 'too_long' }] });

		// 255 characters are fine.
		const [ok] = await runOk({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: { recipients: s1User.id, body: 'Long but legal', additionalFields: { subject: 'S'.repeat(255), group_conversation: true } },
		});
		expect((await view(teacher, String(ok.id))).subject).toBe('S'.repeat(255));
	});

	// Canvas reports these as a bare list, `[{"attribute":"recipients","message":"invalid"}]`.
	it('errors: the Error output names the attribute Canvas rejected', async () => {
		const unknown = await runNode({
			resource: 'conversation',
			operation: 'create',
			persona: asTeacher,
			params: { recipients: '99999999', body: 'Nobody home', errorHandling: { onError: 'continueWithError' } },
		});
		expect(String(unknown.error[0].errorMessage)).toContain('recipients');
		expect(unknown.error[0].canvasErrors).toEqual([{ attribute: 'recipients', message: 'invalid' }]);
	});

	it('errors: students may not message someone outside their courses', async () => {
		const result = await runNode({
			resource: 'conversation',
			operation: 'create',
			persona: 'sbxStudent1',
			// The seeded admin shares no course with the sandbox student.
			params: { recipients: '1', body: 'Hello stranger', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});

	it('errors: the admin-only operations are forbidden for ordinary users', async () => {
		for (const [operation, params] of [
			['getDeleted', { userId: s1User.id }],
			['restore', { conversationId: privateId, userId: s1User.id, messageId: '1' }],
			['deleteForAll', { conversationId: privateId }],
		] as Array<[string, Json]>) {
			const result = await runNode({
				resource: 'conversation',
				operation,
				persona: asTeacher,
				params: { ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', operation });
			expect([401, 403], operation).toContain(result.error[0].errorCode);
		}
		expect((await view(teacher, privateId)).id).toBe(Number(privateId));
	});

	it('errors: another person\'s conversation is not found', async () => {
		const result = await runNode({
			resource: 'conversation',
			operation: 'update',
			persona: 'sbxStudent3',
			params: { conversationId: privateId, updateFields: { starred: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
