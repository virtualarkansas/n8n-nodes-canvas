import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { downloadFile, ensureSubmissionsBattery, patternBuffer, uploadDirect } from './contentBattery';
import type { SubmissionsBattery } from './contentBattery';
import { startFileServer } from './support/fileServer';
import type { FileServer } from './support/fileServer';

/**
 * Resource: submissionComment. Uses students of the submissions battery
 * course that no other test file grades or counts.
 */
describe('submissionComment', () => {
	let battery: SubmissionsBattery;
	let courseId = '';
	let base = '';
	let assignmentId = '';
	let student = '';
	let quietStudent = '';
	let commentId = '';
	let server: FileServer;
	const marker = unique('Kommentar');

	const commentsFromCanvas = async (user: string, assignment = assignmentId): Promise<Json[]> =>
		(
			(await canvas().get<Json>(`${base}/assignments/${assignment}/submissions/${user}?include[]=submission_comments`))
				.submission_comments as Json[]
		).filter((c) => String(c.comment).includes(marker) || c.media_comment);

	beforeAll(async () => {
		battery = await ensureSubmissionsBattery();
		courseId = battery.courseId;
		base = `/api/v1/courses/${courseId}`;
		assignmentId = battery.playgroundAssignmentId;
		[student, quietStudent] = battery.studentIds.slice(36, 38);
		// Two attempts, so that comments can be attached to a specific one.
		for (const text of ['<p>first attempt</p>', '<p>second attempt</p>']) {
			await canvas().post(`${base}/assignments/${assignmentId}/submissions`, {
				submission: { submission_type: 'online_text_entry', body: text, user_id: student },
			});
		}
		server = await startFileServer();
	}, 1_200_000);

	afterAll(() => {
		server?.close();
	});

	it('create: a plain comment returns the submission with its comments', async () => {
		const text = `${marker} ünï 评论 💬 "quoted" & ampersand`;
		const [submission] = await runOk({
			resource: 'submissionComment',
			operation: 'create',
			params: { courseId, assignmentId, userId: student, comment: text },
		});
		expect(submission).toMatchObject({ user_id: Number(student), assignment_id: Number(assignmentId) });
		const returned = submission.submission_comments as Json[];
		const last = returned[returned.length - 1];
		expect(last).toMatchObject({ comment: text, author_id: Number(fx('adminUserId')) });
		commentId = String(last.id);

		const actual = await commentsFromCanvas(student);
		expect(actual.map((c) => String(c.id))).toContain(commentId);
	});

	it('create: every optional field reaches Canvas', async () => {
		const file = await uploadDirect(
			canvas(),
			`${base}/assignments/${assignmentId}/submissions/${student}/comments/files`,
			`${unique('feedback').replace(/\s/g, '-')}.txt`,
			Buffer.from('annotated feedback'),
			'text/plain',
		);
		const mediaId = `m-${unique('c').replace(/[^a-z0-9]/gi, '')}`;
		const text = `${marker} with everything`;
		const [submission] = await runOk({
			resource: 'submissionComment',
			operation: 'create',
			params: {
				courseId,
				assignmentId,
				userId: student,
				comment: text,
				additionalFields: {
					attempt: 1,
					file_ids: ` ${String(file.id)} `,
					group_comment: false,
					media_comment_id: mediaId,
					media_comment_type: 'audio',
				},
			},
		});
		const returned = (submission.submission_comments as Json[]).find((c) => c.comment === text)!;
		expect(returned).toBeTruthy();

		const actual = (await commentsFromCanvas(student)).find((c) => c.comment === text)!;
		expect(actual).toMatchObject({ attempt: 1, media_comment: { media_id: mediaId, media_type: 'audio' } });
		expect((actual.attachments as Json[]).map((a) => a.id)).toEqual([file.id]);
	});

	it('create: a group comment reaches every member of the group', async () => {
		const [member, ...others] = battery.group.groups[0].memberIds;
		const text = `${marker} for the whole group`;
		await runOk({
			resource: 'submissionComment',
			operation: 'create',
			params: {
				courseId,
				assignmentId: battery.group.assignmentId,
				userId: member,
				comment: text,
				additionalFields: { group_comment: true },
			},
		});
		for (const user of [member, ...others]) {
			expect((await commentsFromCanvas(user, battery.group.assignmentId)).map((c) => c.comment), `member ${user}`).toContain(text);
		}

		const solo = `${marker} for one member only`;
		await runOk({
			resource: 'submissionComment',
			operation: 'create',
			params: { courseId, assignmentId: battery.group.assignmentId, userId: member, comment: solo },
		});
		expect((await commentsFromCanvas(others[0], battery.group.assignmentId)).map((c) => c.comment)).not.toContain(solo);
	});

	it('create: several students in one run; a student comments on their own submission', async () => {
		const targets = battery.studentIds.slice(38, 40);
		const result = await runNode({
			resource: 'submissionComment',
			operation: 'create',
			items: [...targets.map((user) => ({ user: Number(user) })), { user: 999999999 }],
			params: {
				courseId,
				assignmentId,
				userId: '={{ $json.user }}',
				comment: `=${marker} for {{ $json.user }}`,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((s) => String(s.user_id))).toEqual(targets);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'submissionComment', operation: 'create' });
		for (const user of targets) {
			expect((await commentsFromCanvas(user)).map((c) => c.comment)).toEqual([`${marker} for ${user}`]);
		}
		expect(JSON.stringify(result.success[0].submission_comments)).toContain(`${marker} for ${targets[0]}`);

		const own = `${marker} from the student`;
		const [submission] = await runOk({
			resource: 'submissionComment',
			operation: 'create',
			persona: 'student',
			params: { courseId, assignmentId, userId: 'self', comment: own },
		});
		expect(submission.user_id).toBe(Number(fx('studentUserId')));
		const mine = (await commentsFromCanvas(fx('studentUserId'))).find((c) => c.comment === own)!;
		expect(mine.author_id).toBe(Number(fx('studentUserId')));
	});

	it('create: file IDs must be numbers; a student may not comment on a classmate', async () => {
		const badFiles = await runNode({
			resource: 'submissionComment',
			operation: 'create',
			params: {
				courseId,
				assignmentId,
				userId: student,
				comment: `${marker} bad file`,
				additionalFields: { file_ids: 'feedback.pdf' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badFiles.error[0].errorCode).toBe(0);
		expect(String(badFiles.error[0].errorMessage)).toContain('File IDs must be a comma-separated list of numeric IDs');

		const forbidden = await runNode({
			resource: 'submissionComment',
			operation: 'create',
			persona: 'student2',
			params: { courseId, assignmentId, userId: student, comment: `${marker} not allowed`, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect((await commentsFromCanvas(student)).map((c) => c.comment)).not.toContain(`${marker} not allowed`);
	});

	// ------------------------------------------------------------- uploadFile

	const sha = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');
	const attachmentsOf = (comment: Json): Json[] => (comment.attachments ?? []) as Json[];

	it('uploadFile + create: files uploaded for a comment are attached with Create and read back byte for byte', async () => {
		const size = 150_003;
		const plainName = `${unique('feedback').replace(/\s/g, '-')}.bin`;
		const pdfName = `Korrektur ünï "final" ${unique('k')}.pdf`;
		const pdf = Buffer.from(`%PDF-1.4 Korrektur ${marker}\n`);
		const uploaded = await runNode({
			resource: 'submissionComment',
			operation: 'uploadFile',
			binary: [
				// Name and type of the binary data ...
				{ fileName: plainName, mimeType: 'application/octet-stream', size, json: { user: Number(student) } },
				// ... or the ones given in the options.
				{
					fileName: 'raw.bin',
					mimeType: 'application/octet-stream',
					b64: pdf.toString('base64'),
					json: { user: student, name: pdfName, type: 'application/pdf' },
				},
			],
			params: {
				courseId,
				assignmentId,
				userId: '={{ $json.user }}',
				options: { content_type: '={{ $json.type }}', name: '={{ $json.name }}' },
			},
		});
		expect(uploaded.failure, JSON.stringify(uploaded.failure)).toBeUndefined();
		expect(uploaded.error).toEqual([]);
		expect(uploaded.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		const [plain, named] = uploaded.success;
		expect(plain).toMatchObject({ display_name: plainName, size, 'content-type': 'application/octet-stream', upload_status: 'success' });
		expect(named).toMatchObject({ display_name: pdfName, size: pdf.length, 'content-type': 'application/pdf' });

		// Uploading alone adds no comment.
		const before = await commentsFromCanvas(student);
		expect(before.flatMap((c) => attachmentsOf(c).map((a) => a.id))).not.toContain(plain.id);

		const text = `${marker} with uploaded files`;
		await runOk({
			resource: 'submissionComment',
			operation: 'create',
			params: {
				courseId,
				assignmentId,
				userId: student,
				comment: text,
				additionalFields: { file_ids: `${String(plain.id)}, ${String(named.id)}` },
			},
		});
		const actual = (await commentsFromCanvas(student)).find((c) => c.comment === text)!;
		expect(attachmentsOf(actual).map((a) => a.id).sort()).toEqual([plain.id, named.id].sort());
		const byId = new Map(attachmentsOf(actual).map((a) => [a.id, a]));
		const downloaded = await downloadFile(byId.get(plain.id) as Json);
		expect(downloaded.length).toBe(size);
		expect(sha(downloaded)).toBe(sha(patternBuffer(size)));
		expect((await downloadFile(byId.get(named.id) as Json)).equals(pdf)).toBe(true);
	});

	it('uploadFile from URL: Canvas fetches the file for the comment, with or without waiting for it', async () => {
		expect(server.url, 'this machine has no address Canvas is willing to fetch from').not.toBe('');
		const stamp = unique('url');
		const waited = Buffer.concat([Buffer.from(stamp), patternBuffer(120_000)]);
		const notWaited = Buffer.from(`fetched in the background ${stamp}\n`);
		server.serve(`/rubric ${stamp}.bin`, waited, 'application/octet-stream');
		server.serve('/background.txt', notWaited);
		const params = { courseId, assignmentId, userId: student, uploadSource: 'url' };

		const [file] = await runOk({
			resource: 'submissionComment',
			operation: 'uploadFile',
			params: {
				...params,
				fileUrl: `${server.url}/${encodeURIComponent(`rubric ${stamp}.bin`)}?download=1`,
				options: { content_type: 'application/zip', name: `Bewertung ünï ${stamp}.zip` },
			},
		});
		expect(file).toMatchObject({ display_name: `Bewertung ünï ${stamp}.zip`, 'content-type': 'application/zip', size: waited.length });

		const [started] = await runOk({
			resource: 'submissionComment',
			operation: 'uploadFile',
			params: { ...params, fileUrl: `${server.url}/background.txt`, waitForCompletion: false },
		});
		const progress = started.progress as Json;
		expect(progress).toMatchObject({ tag: 'upload_via_url' });
		let done: Json = {};
		for (let i = 0; i < 60 && done.workflow_state !== 'completed' && done.workflow_state !== 'failed'; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			done = await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`);
		}
		expect(done.workflow_state).toBe('completed');
		const backgroundId = (done.results as Json).id;

		const text = `${marker} with files from URLs`;
		await runOk({
			resource: 'submissionComment',
			operation: 'create',
			items: [{ files: [file.id, backgroundId] }],
			params: { courseId, assignmentId, userId: student, comment: text, additionalFields: { file_ids: '={{ $json.files }}' } },
		});
		const actual = (await commentsFromCanvas(student)).find((c) => c.comment === text)!;
		const byId = new Map(attachmentsOf(actual).map((a) => [a.id, a]));
		expect([...byId.keys()].sort()).toEqual([file.id, backgroundId].sort());
		expect(sha(await downloadFile(byId.get(file.id) as Json))).toBe(sha(waited));
		// Without a name the last part of the URL is the file name.
		expect(byId.get(backgroundId)).toMatchObject({ display_name: 'background.txt' });
		expect((await downloadFile(byId.get(backgroundId) as Json)).equals(notWaited)).toBe(true);
	});

	it('uploadFile + create: a student attaches a file to a comment on their own submission', async () => {
		const content = Buffer.from(`my own notes ${unique('n')}\n`);
		const uploaded = await runNode({
			resource: 'submissionComment',
			operation: 'uploadFile',
			persona: 'student',
			binary: [{ fileName: 'my notes.txt', mimeType: 'text/plain', b64: content.toString('base64') }],
			params: { courseId, assignmentId, userId: 'self' },
		});
		expect(uploaded.failure, JSON.stringify(uploaded.failure)).toBeUndefined();
		expect(uploaded.error).toEqual([]);
		const [file] = uploaded.success;
		expect(file).toMatchObject({ display_name: 'my notes.txt', size: content.length });

		const text = `${marker} from the student, with a file`;
		await runOk({
			resource: 'submissionComment',
			operation: 'create',
			persona: 'student',
			params: { courseId, assignmentId, userId: 'self', comment: text, additionalFields: { file_ids: String(file.id) } },
		});
		const mine = (await commentsFromCanvas(fx('studentUserId'))).find((c) => c.comment === text)!;
		expect(mine.author_id).toBe(Number(fx('studentUserId')));
		expect(attachmentsOf(mine).map((a) => a.id)).toEqual([file.id]);
		expect((await downloadFile(attachmentsOf(mine)[0])).equals(content)).toBe(true);
	});

	it('uploadFile: unknown students, classmates and items without a file are reported per item', async () => {
		const input = { fileName: 'x.txt', mimeType: 'text/plain', b64: 'eA==' };
		const mixed = await runNode({
			resource: 'submissionComment',
			operation: 'uploadFile',
			binary: [
				{ ...input, json: { user: 999999999 } },
				{ json: { user: Number(student), note: 'no file here' } },
				{ ...input, fileName: `${unique('ok').replace(/\s/g, '-')}.txt`, json: { user: Number(student) } },
			],
			params: { courseId, assignmentId, userId: '={{ $json.user }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(mixed.failure, JSON.stringify(mixed.failure)).toBeUndefined();
		expect(mixed.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 2 }]);
		expect(mixed.error).toHaveLength(2);
		expect(mixed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'submissionComment', operation: 'uploadFile' });
		expect(mixed.error[1]).toMatchObject({ errorCode: 0 });
		expect((mixed.error[1].originalItem as Json).note).toBe('no file here');

		// Canvas stores a comment file for anyone who takes part in the assignment, whoever the
		// student is: what a classmate cannot do is attach it to a comment on that submission.
		const classmate = await runNode({
			resource: 'submissionComment',
			operation: 'uploadFile',
			persona: 'student2',
			binary: [input],
			params: { courseId, assignmentId, userId: student, errorHandling: { onError: 'continueWithError' } },
		});
		expect(classmate.error).toEqual([]);
		const attached = await runNode({
			resource: 'submissionComment',
			operation: 'create',
			persona: 'student2',
			params: {
				courseId,
				assignmentId,
				userId: student,
				comment: `${marker} with a classmate's file`,
				additionalFields: { file_ids: String(classmate.success[0].id) },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(attached.success).toEqual([]);
		expect(attached.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect((await commentsFromCanvas(student)).map((c) => c.comment)).not.toContain(`${marker} with a classmate's file`);

		// Somebody outside the course cannot upload at all.
		const outsider = await runNode({
			resource: 'submissionComment',
			operation: 'uploadFile',
			persona: 'sbxStudent1',
			binary: [input],
			params: { courseId, assignmentId, userId: student, errorHandling: { onError: 'continueWithError' } },
		});
		expect(outsider.success).toEqual([]);
		expect([401, 403, 404]).toContain(outsider.error[0].errorCode);
	});

	it('getAll: returns every comment of a submission as its own item', async () => {
		const expected = (
			await canvas().get<Json>(`${base}/assignments/${assignmentId}/submissions/${student}?include[]=submission_comments`)
		).submission_comments as Json[];
		expect(expected.length).toBeGreaterThanOrEqual(2);
		const listed = await runOk({ resource: 'submissionComment', operation: 'getAll', params: { courseId, assignmentId, userId: student } });
		expect(listed.map((c) => c.id)).toEqual(expected.map((c) => c.id));
		expect(listed[0]).toHaveProperty('author');
		expect(listed[0]).toHaveProperty('created_at');

		const none = await runOk({ resource: 'submissionComment', operation: 'getAll', params: { courseId, assignmentId, userId: quietStudent } });
		expect(none).toEqual([]);

		const result = await runNode({
			resource: 'submissionComment',
			operation: 'getAll',
			items: [{ user: student }, { user: quietStudent }, { user: battery.studentIds[38] }],
			params: { courseId, assignmentId, userId: '={{ $json.user }}' },
		});
		const third = (
			await canvas().get<Json>(
				`${base}/assignments/${assignmentId}/submissions/${battery.studentIds[38]}?include[]=submission_comments`,
			)
		).submission_comments as Json[];
		expect(third.length).toBeGreaterThanOrEqual(1);
		const paired = result.rawSuccess.map((i) => (i.pairedItem as Json).item);
		expect(paired.filter((item) => item === 0)).toHaveLength(expected.length);
		expect(paired.filter((item) => item === 1)).toHaveLength(0);
		expect(paired.filter((item) => item === 2)).toHaveLength(third.length);
	});

	it('update: changes the text of a comment', async () => {
		const text = `${marker} edited ✏️ <i>with markup</i>`;
		const [updated] = await runOk({
			resource: 'submissionComment',
			operation: 'update',
			items: [{ id: Number(commentId) }],
			params: { courseId, assignmentId, userId: student, commentId: '={{ $json.id }}', comment: text },
		});
		expect(updated).toMatchObject({ id: Number(commentId) });
		const actual = (await commentsFromCanvas(student)).find((c) => String(c.id) === commentId)!;
		// Canvas strips HTML tags from comment text.
		expect(actual.comment).toBe(`${marker} edited ✏️ with markup`);
		expect(actual.edited_at).toBeTruthy();
	});

	it('update: only the author may edit a comment; an unknown comment is not found', async () => {
		const forbidden = await runNode({
			resource: 'submissionComment',
			operation: 'update',
			persona: 'student',
			params: {
				courseId,
				assignmentId,
				userId: student,
				commentId,
				comment: `${marker} hijacked`,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });

		const missing = await runNode({
			resource: 'submissionComment',
			operation: 'update',
			params: { courseId, assignmentId, userId: student, commentId: '999999999', comment: 'x', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('delete: removes comments, reporting the ones that are already gone', async () => {
		const all = (await commentsFromCanvas(student)).map((c) => String(c.id));
		expect(all.length).toBeGreaterThanOrEqual(2);
		const [first] = await runOk({
			resource: 'submissionComment',
			operation: 'delete',
			params: { courseId, assignmentId, userId: student, commentId: all[all.length - 1] },
		});
		expect(String(first.id)).toBe(all[all.length - 1]);
		const mine = all.slice(0, -1);
		const result = await runNode({
			resource: 'submissionComment',
			operation: 'delete',
			items: [...mine.map((id) => ({ id })), { id: commentId }],
			params: {
				courseId,
				assignmentId,
				userId: student,
				commentId: '={{ $json.id }}',
				batchProcessing: { mode: 'individual' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((c) => String(c.id))).toEqual(mine);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
		expect(await commentsFromCanvas(student)).toEqual([]);
	});
});
