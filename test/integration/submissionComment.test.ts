import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ensureSubmissionsBattery, uploadDirect } from './contentBattery';
import type { SubmissionsBattery } from './contentBattery';

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
	}, 1_200_000);

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
		const mine = (await commentsFromCanvas(student)).map((c) => String(c.id));
		expect(mine.length).toBeGreaterThanOrEqual(2);
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
