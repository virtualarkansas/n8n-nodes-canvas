import { describe, expect, it } from 'vitest';
import { fx } from '../lib/canvas';
import { skipOp } from '../lib/harness';
import { buildRequest, buildRequests, NEW_QUIZZES_SKIP_REASON } from './support/debug';
import { runNode } from './support/run';

/**
 * Resource: newQuiz. New Quizzes is a hosted Instructure service that an
 * open-source Canvas does not include, so the operations cannot be executed here.
 * Instead every operation runs through n8n in the node's debug mode and the
 * request it builds (method, URL, body) is checked against the published
 * API documentation: https://canvas.instructure.com/doc/api/new_quizzes.html
 */
for (const operation of ['create', 'delete', 'get', 'getAll', 'update']) {
	skipOp('newQuiz', operation, NEW_QUIZZES_SKIP_REASON);
}

describe('newQuiz', () => {
	const courseId = fx('courseId');

	it('create: POST /api/quiz/v1/courses/:course_id/quizzes with the title under "quiz"', async () => {
		const request = await buildRequest({
			resource: 'newQuiz',
			operation: 'create',
			params: { courseId, title: 'Hamlet Act 3 "Quiz" & more — ünï 测验' },
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/quizzes`);
		expect(request.query).toBe('');
		expect(request.body).toEqual({ quiz: { title: 'Hamlet Act 3 "Quiz" & more — ünï 测验' } });
		expect(request.curl).toContain('-X POST');
	});

	it('create: every optional field lands where the API documents it', async () => {
		const request = await buildRequest({
			resource: 'newQuiz',
			operation: 'create',
			params: {
				courseId,
				title: 'Full quiz',
				additionalFields: {
					allow_backtracking: false,
					assignment_group_id: '12',
					attempt_limit: true,
					calculator_type: 'scientific',
					cooling_period: true,
					cooling_period_seconds: 93600,
					due_at: '2031-01-02T00:00:00Z',
					filter_ip_address: true,
					filters: '[["10.0.0.0", "10.10.0.0"], ["12.0.0.0", "12.10.10.0"]]',
					grading_type: 'points',
					has_time_limit: true,
					instructions: '<p>Instructions for <strong>quiz</strong></p>',
					lock_at: '2031-01-03T00:00:00Z',
					max_attempts: 4,
					multiple_attempts_enabled: true,
					one_at_a_time_type: 'question',
					points_possible: 100,
					require_student_access_code: true,
					result_view_settings: JSON.stringify({
						result_view_restricted: true,
						display_points_awarded: true,
						display_points_possible: true,
						display_items: true,
						display_item_response: true,
						display_item_response_qualifier: 'always',
						show_item_responses_at: '2031-01-01T00:00:00Z',
						hide_item_responses_at: '2031-01-02T00:00:00Z',
						display_item_response_correctness: true,
						display_item_response_correctness_qualifier: 'after_last_attempt',
						show_item_response_correctness_at: '2031-01-01T00:00:00Z',
						hide_item_response_correctness_at: '2031-01-02T00:00:00Z',
						display_item_correct_answer: true,
						display_item_feedback: true,
					}),
					score_to_keep: 'average',
					session_time_limit_in_seconds: 7500,
					shuffle_answers: true,
					shuffle_questions: true,
					student_access_code: '12345',
					unlock_at: '2031-01-01T00:00:00Z',
				},
			},
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/quizzes`);
		expect(request.body).toEqual({
			quiz: {
				title: 'Full quiz',
				assignment_group_id: '12',
				points_possible: 100,
				due_at: '2031-01-02T00:00:00Z',
				lock_at: '2031-01-03T00:00:00Z',
				unlock_at: '2031-01-01T00:00:00Z',
				grading_type: 'points',
				instructions: '<p>Instructions for <strong>quiz</strong></p>',
				quiz_settings: {
					calculator_type: 'scientific',
					filter_ip_address: true,
					filters: {
						ips: [
							['10.0.0.0', '10.10.0.0'],
							['12.0.0.0', '12.10.10.0'],
						],
					},
					one_at_a_time_type: 'question',
					allow_backtracking: false,
					shuffle_answers: true,
					shuffle_questions: true,
					require_student_access_code: true,
					student_access_code: '12345',
					has_time_limit: true,
					session_time_limit_in_seconds: 7500,
					multiple_attempts: {
						multiple_attempts_enabled: true,
						attempt_limit: true,
						max_attempts: 4,
						score_to_keep: 'average',
						cooling_period: true,
						cooling_period_seconds: 93600,
					},
					result_view_settings: {
						result_view_restricted: true,
						display_points_awarded: true,
						display_points_possible: true,
						display_items: true,
						display_item_response: true,
						display_item_response_qualifier: 'always',
						show_item_responses_at: '2031-01-01T00:00:00Z',
						hide_item_responses_at: '2031-01-02T00:00:00Z',
						display_item_response_correctness: true,
						display_item_response_correctness_qualifier: 'after_last_attempt',
						show_item_response_correctness_at: '2031-01-01T00:00:00Z',
						hide_item_response_correctness_at: '2031-01-02T00:00:00Z',
						display_item_correct_answer: true,
						display_item_feedback: true,
					},
				},
			},
		});
	});

	it('create: an access code or a time limit switch on the setting that makes them count', async () => {
		const request = await buildRequest({
			resource: 'newQuiz',
			operation: 'create',
			params: {
				courseId,
				title: 'Coded and timed',
				additionalFields: { student_access_code: 'sésame "1"', session_time_limit_in_seconds: 600 },
			},
		});
		expect(request.body).toEqual({
			quiz: {
				title: 'Coded and timed',
				quiz_settings: {
					require_student_access_code: true,
					student_access_code: 'sésame "1"',
					has_time_limit: true,
					session_time_limit_in_seconds: 600,
				},
			},
		});
	});

	it('create: values from expressions — IDs as numbers, filters and result settings as objects', async () => {
		const requests = await buildRequests({
			resource: 'newQuiz',
			operation: 'create',
			items: [
				{ course: Number(courseId), title: 'From item 1', ranges: [['10.0.0.1', '10.0.0.9']], view: { result_view_restricted: true } },
				{ course: `sis_course_id:${fx('courseSisId')}`, title: 'From item 2', ranges: { ips: [] }, view: {} },
			],
			params: {
				courseId: '={{ $json.course }}',
				title: '={{ $json.title }}',
				additionalFields: { filters: '={{ $json.ranges }}', result_view_settings: '={{ $json.view }}' },
			},
		});
		expect(requests.map((r) => r.path)).toEqual([
			`/api/quiz/v1/courses/${courseId}/quizzes`,
			`/api/quiz/v1/courses/sis_course_id:${fx('courseSisId')}/quizzes`,
		]);
		expect(requests[0].body).toEqual({
			quiz: {
				title: 'From item 1',
				quiz_settings: { filters: { ips: [['10.0.0.1', '10.0.0.9']] }, result_view_settings: { result_view_restricted: true } },
			},
		});
		expect(requests[1].body).toEqual({ quiz: { title: 'From item 2', quiz_settings: { filters: { ips: [] } } } });
	});

	it('create: malformed JSON in a settings field stops the node with a clear message', async () => {
		for (const [fields, message] of [
			[{ filters: '[["10.0.0.0", ' }, 'IP Filters must be valid JSON'],
			[{ filters: '{"ranges": []}' }, 'IP Filters must be a JSON array'],
			[{ result_view_settings: '[true]' }, 'Result View Settings must be a JSON object'],
		] as Array<[Record<string, string>, string]>) {
			const result = await runNode({
				resource: 'newQuiz',
				operation: 'create',
				params: { courseId, title: 'Broken', additionalFields: fields, debugMode: true },
			});
			expect(result.ok, JSON.stringify(fields)).toBe(false);
			expect(result.failure?.message).toContain(message);
		}
	});

	it('get: GET /api/quiz/v1/courses/:course_id/quizzes/:assignment_id', async () => {
		const requests = await buildRequests({
			resource: 'newQuiz',
			operation: 'get',
			items: [{ assignment: 4711 }, { assignment: ' 4712 ' }],
			params: { courseId, assignmentId: '={{ $json.assignment }}' },
		});
		expect(requests.map((r) => [r.method, r.path, r.query])).toEqual([
			['GET', `/api/quiz/v1/courses/${courseId}/quizzes/4711`, ''],
			['GET', `/api/quiz/v1/courses/${courseId}/quizzes/4712`, ''],
		]);
		expect(requests[0].body).toEqual({});
	});

	it('getAll: GET /api/quiz/v1/courses/:course_id/quizzes', async () => {
		const request = await buildRequest({ resource: 'newQuiz', operation: 'getAll', params: { courseId } });
		expect([request.method, request.path, request.query]).toEqual(['GET', `/api/quiz/v1/courses/${courseId}/quizzes`, '']);
		expect(request.body).toEqual({});
	});

	it('update: PATCH with only the chosen fields, nested like on create', async () => {
		const request = await buildRequest({
			resource: 'newQuiz',
			operation: 'update',
			params: {
				courseId,
				assignmentId: '4711',
				updateFields: {
					title: 'Renamed',
					points_possible: 20,
					due_at: '2032-01-02T00:00:00Z',
					shuffle_answers: false,
					multiple_attempts_enabled: true,
					attempt_limit: false,
					score_to_keep: 'latest',
				},
			},
		});
		expect(request.method).toBe('PATCH');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/quizzes/4711`);
		expect(request.curl).toContain('-X PATCH');
		expect(request.body).toEqual({
			quiz: {
				title: 'Renamed',
				points_possible: 20,
				due_at: '2032-01-02T00:00:00Z',
				quiz_settings: {
					shuffle_answers: false,
					multiple_attempts: { multiple_attempts_enabled: true, attempt_limit: false, score_to_keep: 'latest' },
				},
			},
		});
	});

	it('update: every optional field; removing the access code and the time limit', async () => {
		const request = await buildRequest({
			resource: 'newQuiz',
			operation: 'update',
			params: {
				courseId,
				assignmentId: 4711,
				updateFields: {
					allow_backtracking: true,
					assignment_group_id: '13',
					attempt_limit: true,
					calculator_type: 'basic',
					cooling_period: false,
					cooling_period_seconds: 60,
					due_at: '2032-01-02T00:00:00Z',
					filter_ip_address: false,
					filters: '{"ips": [["1.1.1.1", "1.1.1.3"]]}',
					grading_type: 'pass_fail',
					instructions: 'Changed',
					lock_at: '2032-01-03T00:00:00Z',
					max_attempts: 2,
					multiple_attempts_enabled: false,
					one_at_a_time_type: 'none',
					points_possible: 5,
					result_view_settings: '{"result_view_restricted": false}',
					score_to_keep: 'first',
					session_time_limit_in_seconds: 0,
					shuffle_answers: true,
					shuffle_questions: false,
					student_access_code: '',
					title: 'Everything',
					unlock_at: '2032-01-01T00:00:00Z',
				},
			},
		});
		expect(request.method).toBe('PATCH');
		expect(request.path).toBe(`/api/quiz/v1/courses/${courseId}/quizzes/4711`);
		expect(request.body).toEqual({
			quiz: {
				title: 'Everything',
				assignment_group_id: '13',
				points_possible: 5,
				due_at: '2032-01-02T00:00:00Z',
				lock_at: '2032-01-03T00:00:00Z',
				unlock_at: '2032-01-01T00:00:00Z',
				grading_type: 'pass_fail',
				instructions: 'Changed',
				quiz_settings: {
					calculator_type: 'basic',
					filter_ip_address: false,
					filters: { ips: [['1.1.1.1', '1.1.1.3']] },
					one_at_a_time_type: 'none',
					allow_backtracking: true,
					shuffle_answers: true,
					shuffle_questions: false,
					// An empty access code and a time limit of 0 switch the restriction off.
					require_student_access_code: false,
					student_access_code: null,
					has_time_limit: false,
					session_time_limit_in_seconds: null,
					multiple_attempts: {
						multiple_attempts_enabled: false,
						attempt_limit: true,
						max_attempts: 2,
						score_to_keep: 'first',
						cooling_period: false,
						cooling_period_seconds: 60,
					},
					result_view_settings: { result_view_restricted: false },
				},
			},
		});
	});

	it('delete: DELETE /api/quiz/v1/courses/:course_id/quizzes/:assignment_id', async () => {
		const request = await buildRequest({
			resource: 'newQuiz',
			operation: 'delete',
			params: { courseId, assignmentId: '4711' },
		});
		expect([request.method, request.path, request.query]).toEqual([
			'DELETE',
			`/api/quiz/v1/courses/${courseId}/quizzes/4711`,
			'',
		]);
		expect(request.body).toEqual({});
	});

	it('on a Canvas without the New Quizzes service the operation ends on the Error output', async () => {
		const result = await runNode({
			resource: 'newQuiz',
			operation: 'getAll',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'newQuiz',
			operation: 'getAll',
			endpoint: `/api/quiz/v1/courses/${courseId}/quizzes`,
		});
	});
});
