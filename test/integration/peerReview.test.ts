import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ensureSubmissionsBattery } from './contentBattery';
import type { SubmissionsBattery } from './contentBattery';

/**
 * Resource: peerReview. Uses the peer review assignment of the submissions
 * battery course: four students who handed in and can review each other.
 */
describe('peerReview', () => {
	let battery: SubmissionsBattery;
	let courseId = '';
	let assignmentId = '';
	let reviewsPath = '';
	/** The four students, and the ID of each one's submission. */
	let students: string[] = [];
	const submissionOf: Record<string, string> = {};

	const reviewsFromCanvas = (): Promise<Json[]> => canvas().get<Json[]>(reviewsPath);
	const pairs = (list: Json[]): string[] => list.map((r) => `${String(r.assessor_id)}>${String(r.user_id)}`).sort();
	const clear = async (): Promise<void> => {
		for (const review of await reviewsFromCanvas()) {
			await canvas().request(
				'DELETE',
				`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${String(review.asset_id)}/peer_reviews?user_id=${String(review.assessor_id)}`,
			);
		}
	};

	beforeAll(async () => {
		battery = await ensureSubmissionsBattery();
		courseId = battery.courseId;
		assignmentId = battery.peer.assignmentId;
		students = battery.peer.studentIds;
		reviewsPath = `/api/v1/courses/${courseId}/assignments/${assignmentId}/peer_reviews`;
		for (const student of students) {
			const submission = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${student}`);
			submissionOf[student] = String(submission.id);
		}
		await clear();
	}, 1_200_000);

	afterAll(async () => {
		await clear();
	});

	it('getAll: an assignment without peer reviews yields no items', async () => {
		expect(await runOk({ resource: 'peerReview', operation: 'getAll', params: { courseId, assignmentId } })).toEqual([]);
	});

	it('create: assigns a reviewer to a submission', async () => {
		const [author, reviewer] = students;
		const [review] = await runOk({
			resource: 'peerReview',
			operation: 'create',
			params: { courseId, assignmentId, submissionId: submissionOf[author], reviewerUserId: reviewer },
		});
		expect(review).toMatchObject({
			assessor_id: Number(reviewer),
			user_id: Number(author),
			asset_id: Number(submissionOf[author]),
			asset_type: 'Submission',
			workflow_state: 'assigned',
		});
		expect(pairs(await reviewsFromCanvas())).toEqual([`${reviewer}>${author}`]);
	});

	it('create: several reviews in one run, IDs from expressions; assigning twice is harmless', async () => {
		const [a, b, c, d] = students;
		const result = await runNode({
			resource: 'peerReview',
			operation: 'create',
			items: [
				{ submission: Number(submissionOf[a]), reviewer: Number(c) },
				{ submission: Number(submissionOf[b]), reviewer: Number(a) },
				{ submission: Number(submissionOf[c]), reviewer: Number(d) },
				{ submission: Number(submissionOf[a]), reviewer: Number(b) },
			],
			params: {
				courseId,
				assignmentId,
				submissionId: '={{ $json.submission }}',
				reviewerUserId: '={{ $json.reviewer }}',
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.success).toHaveLength(4);
		expect(pairs(await reviewsFromCanvas())).toEqual([`${a}>${b}`, `${b}>${a}`, `${c}>${a}`, `${d}>${c}`].sort());
	});

	it('getAll: lists the reviews of the assignment, with includes', async () => {
		const expected = await reviewsFromCanvas();
		const listed = await runOk({ resource: 'peerReview', operation: 'getAll', params: { courseId, assignmentId, pagination: { returnAll: true } } });
		expect(pairs(listed)).toEqual(pairs(expected));
		expect(listed[0]).not.toHaveProperty('user');

		const detailed = await runOk({
			resource: 'peerReview',
			operation: 'getAll',
			params: { courseId, assignmentId, options: { include: ['submission_comments', 'user'] } },
		});
		expect(pairs(detailed)).toEqual(pairs(expected));
		for (const review of detailed) {
			expect(review.user).toMatchObject({ id: review.user_id });
			expect(review.assessor).toMatchObject({ id: review.assessor_id });
			expect(review.submission_comments).toBeInstanceOf(Array);
		}
	});

	it('getAll: "submission ID" narrows the list to one submission', async () => {
		const [a, b, c] = students;
		const forA = await runOk({
			resource: 'peerReview',
			operation: 'getAll',
			items: [{ submission: Number(submissionOf[a]) }],
			params: { courseId, assignmentId, options: { submission_id: '={{ $json.submission }}', include: ['user'] } },
		});
		expect(pairs(forA)).toEqual([`${b}>${a}`, `${c}>${a}`].sort());
		expect(forA[0].user).toMatchObject({ id: Number(a) });

		const forD = await runOk({
			resource: 'peerReview',
			operation: 'getAll',
			params: { courseId, assignmentId, options: { submission_id: submissionOf[students[3]] } },
		});
		expect(forD).toEqual([]);
	});

	it('delete: removes one reviewer from a submission', async () => {
		const [a, , c] = students;
		const [removed] = await runOk({
			resource: 'peerReview',
			operation: 'delete',
			params: { courseId, assignmentId, submissionId: submissionOf[a], reviewerUserId: c },
		});
		expect(removed).toMatchObject({ assessor_id: Number(c), user_id: Number(a) });
		expect(pairs(await reviewsFromCanvas())).not.toContain(`${c}>${a}`);
		expect(await reviewsFromCanvas()).toHaveLength(3);
	});

	it('errors: self review, unknown submission, unknown reviewer, a review that does not exist', async () => {
		const [a, , c] = students;
		const run = (operation: string, submissionId: string, reviewerUserId: string): ReturnType<typeof runNode> =>
			runNode({
				resource: 'peerReview',
				operation,
				params: { courseId, assignmentId, submissionId, reviewerUserId, errorHandling: { onError: 'continueWithError' } },
			});

		const self = await run('create', submissionOf[a], a);
		expect(self.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });

		const unknownSubmission = await run('create', '999999999', a);
		expect(unknownSubmission.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const outsider = await run('create', submissionOf[a], fx('teacherUserId'));
		expect(outsider.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const gone = await run('delete', submissionOf[a], c);
		expect(gone.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'delete' });
		expect(await reviewsFromCanvas()).toHaveLength(3);
	});

	it('errors: students may not assign reviews and only see reviews of their own work', async () => {
		const [a, b] = students;
		const forbidden = await runNode({
			resource: 'peerReview',
			operation: 'create',
			persona: 'student',
			params: {
				courseId,
				assignmentId,
				submissionId: submissionOf[a],
				reviewerUserId: b,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403, 404]).toContain(forbidden.error[0].errorCode);

		const own = await runOk({ resource: 'peerReview', operation: 'getAll', persona: 'student', params: { courseId, assignmentId } });
		expect(own).toEqual([]);
	});

	it('delete: several reviews in one run', async () => {
		const remaining = await reviewsFromCanvas();
		const result = await runNode({
			resource: 'peerReview',
			operation: 'delete',
			items: remaining.map((r) => ({ submission: r.asset_id, reviewer: r.assessor_id })),
			params: {
				courseId,
				assignmentId,
				submissionId: '={{ $json.submission }}',
				reviewerUserId: '={{ $json.reviewer }}',
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(pairs(result.success)).toEqual(pairs(remaining));
		expect(await reviewsFromCanvas()).toEqual([]);
	});
});
