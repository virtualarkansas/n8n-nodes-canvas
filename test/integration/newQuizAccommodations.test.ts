import { describe, expect, it } from 'vitest';
import { fx } from '../lib/canvas';
import { skipOp } from '../lib/harness';
import { buildRequest, buildRequests, NEW_QUIZZES_SKIP_REASON } from './support/debug';
import { runNode } from './support/run';

/**
 * Resource: newQuizAccommodations. New Quizzes is a hosted Instructure service
 * that an open-source Canvas does not include, so every operation runs through
 * n8n in the node's debug mode and the request it builds is checked against the
 * published API documentation:
 * https://canvas.instructure.com/doc/api/new_quizzes_accommodations.html
 *
 * Both endpoints take a JSON array of accommodation objects as the request body.
 */
for (const operation of ['setCourse', 'setQuiz']) {
	skipOp('newQuizAccommodations', operation, NEW_QUIZZES_SKIP_REASON);
}

describe('newQuizAccommodations', () => {
	const courseId = fx('courseId');
	const userId = fx('studentUserId');

	it('setQuiz: POST …/quizzes/:assignment_id/accommodations with a list holding the student', async () => {
		const request = await buildRequest({
			resource: 'newQuizAccommodations',
			operation: 'setQuiz',
			params: {
				courseId,
				userId,
				assignmentId: '456',
				options: { extra_attempts: 1, extra_time: 60, reduce_choices_enabled: true },
			},
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/quizzes/456/accommodations`);
		expect(request.query).toBe('');
		expect(request.body).toEqual([
			{ user_id: Number(userId), extra_time: 60, extra_attempts: 1, reduce_choices_enabled: true },
		]);
		// The curl command of the debug output carries the same JSON array.
		expect(request.curl).toContain(`[{"user_id":${userId},"extra_time":60,"extra_attempts":1,"reduce_choices_enabled":true}]`);
	});

	it('setQuiz: without options only the student is sent; zero and "off" are real values', async () => {
		const bare = await buildRequest({
			resource: 'newQuizAccommodations',
			operation: 'setQuiz',
			params: { courseId, userId: ` ${userId} `, assignmentId: 456 },
		});
		expect(bare.body).toEqual([{ user_id: Number(userId) }]);

		const reset = await buildRequest({
			resource: 'newQuizAccommodations',
			operation: 'setQuiz',
			params: {
				courseId,
				userId,
				assignmentId: '456',
				options: { extra_attempts: 0, extra_time: 0, reduce_choices_enabled: false },
			},
		});
		expect(reset.body).toEqual([
			{ user_id: Number(userId), extra_time: 0, extra_attempts: 0, reduce_choices_enabled: false },
		]);
	});

	it('setQuiz: one request per input item, with values from expressions', async () => {
		const requests = await buildRequests({
			resource: 'newQuizAccommodations',
			operation: 'setQuiz',
			items: [
				{ user: Number(fx('studentUserId')), quiz: 456, minutes: 30 },
				{ user: fx('student2UserId'), quiz: '457', minutes: 45 },
			],
			params: {
				courseId,
				userId: '={{ $json.user }}',
				assignmentId: '={{ $json.quiz }}',
				options: { extra_time: '={{ $json.minutes }}' },
			},
		});
		expect(requests.map((r) => [r.method, r.path, r.body])).toEqual([
			['POST', `/api/quiz/v1/courses/${courseId}/quizzes/456/accommodations`, [{ user_id: Number(fx('studentUserId')), extra_time: 30 }]],
			['POST', `/api/quiz/v1/courses/${courseId}/quizzes/457/accommodations`, [{ user_id: Number(fx('student2UserId')), extra_time: 45 }]],
		]);
	});

	it('setCourse: POST …/courses/:course_id/accommodations with a list holding the student', async () => {
		const request = await buildRequest({
			resource: 'newQuizAccommodations',
			operation: 'setCourse',
			params: {
				courseId,
				userId,
				options: { apply_to_in_progress_quiz_sessions: true, extra_time: 60, reduce_choices_enabled: true },
			},
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/accommodations`);
		expect(request.query).toBe('');
		expect(request.body).toEqual([
			{
				user_id: Number(userId),
				extra_time: 60,
				apply_to_in_progress_quiz_sessions: true,
				reduce_choices_enabled: true,
			},
		]);
	});

	it('setCourse: without options only the student is sent', async () => {
		const request = await buildRequest({
			resource: 'newQuizAccommodations',
			operation: 'setCourse',
			params: { courseId: Number(courseId), userId: Number(userId) },
		});
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/accommodations`);
		expect(request.body).toEqual([{ user_id: Number(userId) }]);
	});

	it('on a Canvas without the New Quizzes service the operation ends on the Error output', async () => {
		const result = await runNode({
			resource: 'newQuizAccommodations',
			operation: 'setCourse',
			params: { courseId, userId, options: { extra_time: 10 }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'newQuizAccommodations',
			operation: 'setCourse',
		});
	});
});
