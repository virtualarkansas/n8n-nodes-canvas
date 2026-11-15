import { describe, expect, it } from 'vitest';
import { fx } from '../lib/canvas';
import { skipOp } from '../lib/harness';
import { buildRequest, buildRequests, NEW_QUIZZES_SKIP_REASON } from './support/debug';
import { runNode } from './support/run';

/**
 * Resource: newQuizItem (questions of a New Quiz). New Quizzes is a hosted
 * Instructure service that an open-source Canvas does not include, so every
 * operation runs through n8n in the node's debug mode and the request it builds
 * is checked against the published API documentation:
 * https://canvas.instructure.com/doc/api/new_quiz_items.html
 */
for (const operation of ['create', 'delete', 'get', 'getAll', 'getMediaUploadUrl', 'update']) {
	skipOp('newQuizItem', operation, NEW_QUIZZES_SKIP_REASON);
}

describe('newQuizItem', () => {
	const courseId = fx('courseId');
	const assignmentId = '4711';
	const items = `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/items`;

	// The multiple-choice example of the API documentation ("Appendix: Question Types").
	const choiceInteraction = {
		choices: [
			{ id: '1bd82f75-b070-477d-bea6-b954ef766fbf', position: 1, itemBody: '<p>mitochondria</p>' },
			{ id: '96e68487-086e-4a0b-9a70-0ad623c83aa3', position: 2, itemBody: '<p>nucleus</p>' },
		],
	};
	const choiceScoring = { value: '96e68487-086e-4a0b-9a70-0ad623c83aa3' };

	it('create: POST …/items with the question under item.entry and entry_type "Item"', async () => {
		const request = await buildRequest({
			resource: 'newQuizItem',
			operation: 'create',
			params: {
				courseId,
				assignmentId,
				itemBody: '<p>Which part of the cell holds most of its DNA? ¿Cuál? 🧬</p>',
				interactionType: 'choice',
				interactionData: JSON.stringify(choiceInteraction),
				scoringData: JSON.stringify(choiceScoring),
				scoringAlgorithm: 'Equivalence',
			},
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(items);
		expect(request.query).toBe('');
		expect(request.body).toEqual({
			item: {
				entry_type: 'Item',
				entry: {
					item_body: '<p>Which part of the cell holds most of its DNA? ¿Cuál? 🧬</p>',
					interaction_type_slug: 'choice',
					interaction_data: choiceInteraction,
					scoring_data: choiceScoring,
					scoring_algorithm: 'Equivalence',
				},
			},
		});
	});

	it('create: every optional field lands where the API documents it', async () => {
		const properties = { shuffleRules: { choices: { toLock: [], shuffled: true } }, varyPointsByAnswer: false };
		const answerFeedback = { '1bd82f75-b070-477d-bea6-b954ef766fbf': '<p>A small amount of DNA can be found here.</p>' };
		const request = await buildRequest({
			resource: 'newQuizItem',
			operation: 'create',
			params: {
				courseId,
				assignmentId: Number(assignmentId),
				itemBody: '<p>Where is the DNA?</p>',
				interactionType: 'choice',
				interactionData: JSON.stringify(choiceInteraction),
				scoringData: JSON.stringify(choiceScoring),
				scoringAlgorithm: 'VaryPointsByAnswer',
				additionalFields: {
					answer_feedback: JSON.stringify(answerFeedback),
					calculator_type: 'scientific',
					feedback_correct: '<p>Nice job!</p>',
					feedback_incorrect: '<p>Study textbook pg. 105.</p>',
					feedback_neutral: '<p>That was a hard one.</p>',
					points_possible: 2.5,
					position: 3,
					properties: JSON.stringify(properties),
					title: 'Cell "DNA" & more',
				},
			},
		});
		expect(request.method).toBe('POST');
		expect(request.path).toBe(items);
		expect(request.body).toEqual({
			item: {
				position: 3,
				points_possible: 2.5,
				entry_type: 'Item',
				entry: {
					title: 'Cell "DNA" & more',
					item_body: '<p>Where is the DNA?</p>',
					calculator_type: 'scientific',
					interaction_type_slug: 'choice',
					interaction_data: choiceInteraction,
					properties,
					scoring_data: choiceScoring,
					answer_feedback: answerFeedback,
					scoring_algorithm: 'VaryPointsByAnswer',
					feedback: {
						correct: '<p>Nice job!</p>',
						incorrect: '<p>Study textbook pg. 105.</p>',
						neutral: '<p>That was a hard one.</p>',
					},
				},
			},
		});
	});

	it('create: each interaction type with the scoring algorithm the API names for it', async () => {
		// From "Details about each question type" in the API documentation.
		const types: Array<[string, string, object, object]> = [
			['true-false', 'Equivalence', { true_choice: 'True', false_choice: 'False' }, { value: true }],
			['categorization', 'Categorization', { categories: {}, distractors: {}, category_order: [] }, { value: [] }],
			['matching', 'DeepEquals', { answers: [], questions: [] }, { value: {} }],
			['matching', 'PartialDeep', { answers: [], questions: [] }, { value: {} }],
			['file-upload', 'None', { files_count: '1', restrict_count: false }, { value: '' }],
			['formula', 'Numeric', {}, { value: { formula: 'x + 1', numeric: { type: 'marginOfError', margin: '0' } } }],
			['ordering', 'DeepEquals', { choices: {} }, { value: [] }],
			['rich-fill-blank', 'MultipleMethods', { blanks: [] }, { value: [] }],
			['hot-spot', 'HotSpot', { imageUrl: 'https://example.com/cell.png' }, { value: [] }],
			['multi-answer', 'AllOrNothing', { choices: [] }, { value: [] }],
			['multi-answer', 'PartialScore', { choices: [] }, { value: [] }],
			['numeric', 'Numeric', {}, { value: [{ id: '1', type: 'exactResponse', value: '42' }] }],
			['essay', 'None', { rce: true, word_limit_enabled: true }, { value: '' }],
		];
		const requests = await buildRequests({
			resource: 'newQuizItem',
			operation: 'create',
			items: types.map(([type, algorithm, interaction, scoring]) => ({ type, algorithm, interaction, scoring })),
			params: {
				courseId,
				assignmentId,
				itemBody: '=Question of type {{ $json.type }}',
				interactionType: '={{ $json.type }}',
				interactionData: '={{ $json.interaction }}',
				scoringData: '={{ $json.scoring }}',
				scoringAlgorithm: '={{ $json.algorithm }}',
			},
		});
		expect(requests).toHaveLength(types.length);
		requests.forEach((request, index) => {
			const [type, algorithm, interaction, scoring] = types[index];
			expect([request.method, request.path]).toEqual(['POST', items]);
			expect(request.body, type).toEqual({
				item: {
					entry_type: 'Item',
					entry: {
						item_body: `Question of type ${type}`,
						interaction_type_slug: type,
						interaction_data: interaction,
						scoring_data: scoring,
						scoring_algorithm: algorithm,
					},
				},
			});
		});
	});

	it('create: malformed question data stops the node with a clear message', async () => {
		for (const [params, message] of [
			[{ interactionData: '{"choices": [' }, 'Interaction Data must be valid JSON'],
			[{ scoringData: '"just a string"' }, 'Scoring Data must be a JSON object'],
			[{ additionalFields: { properties: '[1]' } }, 'Properties must be a JSON object'],
			[{ additionalFields: { answer_feedback: '{oops}' } }, 'Answer Feedback must be valid JSON'],
		] as Array<[Record<string, unknown>, string]>) {
			const result = await runNode({
				resource: 'newQuizItem',
				operation: 'create',
				params: {
					courseId,
					assignmentId,
					itemBody: 'Broken',
					interactionType: 'essay',
					interactionData: '{}',
					scoringData: '{}',
					scoringAlgorithm: 'None',
					...params,
					debugMode: true,
				},
			});
			expect(result.ok, message).toBe(false);
			expect(result.failure?.message).toContain(message);
		}
	});

	it('get: GET …/items/:item_id', async () => {
		const requests = await buildRequests({
			resource: 'newQuizItem',
			operation: 'get',
			items: [{ item: 35 }, { item: ' 36 ' }],
			params: { courseId, assignmentId, itemId: '={{ $json.item }}' },
		});
		expect(requests.map((r) => [r.method, r.path, r.query])).toEqual([
			['GET', `${items}/35`, ''],
			['GET', `${items}/36`, ''],
		]);
	});

	it('getAll: GET …/items', async () => {
		const request = await buildRequest({ resource: 'newQuizItem', operation: 'getAll', params: { courseId, assignmentId } });
		expect([request.method, request.path, request.query]).toEqual(['GET', items, '']);
		expect(request.body).toEqual({});
	});

	it('getMediaUploadUrl: GET …/items/media_upload_url', async () => {
		const request = await buildRequest({
			resource: 'newQuizItem',
			operation: 'getMediaUploadUrl',
			params: { courseId, assignmentId },
		});
		expect([request.method, request.path, request.query]).toEqual(['GET', `${items}/media_upload_url`, '']);
	});

	it('update: PATCH …/items/:item_id with only the chosen fields', async () => {
		// The example of the API documentation: points, title and calculator.
		const request = await buildRequest({
			resource: 'newQuizItem',
			operation: 'update',
			params: {
				courseId,
				assignmentId,
				itemId: '145',
				updateFields: { points_possible: 25, title: 'Question 1', calculator_type: 'scientific' },
			},
		});
		expect(request.method).toBe('PATCH');
		expect(request.path).toBe(`${items}/145`);
		expect(request.curl).toContain('-X PATCH');
		expect(request.body).toEqual({
			item: { points_possible: 25, entry: { title: 'Question 1', calculator_type: 'scientific' } },
		});

		const onlyPosition = await buildRequest({
			resource: 'newQuizItem',
			operation: 'update',
			params: { courseId, assignmentId, itemId: 145, updateFields: { position: 2 } },
		});
		expect(onlyPosition.body).toEqual({ item: { position: 2 } });
	});

	it('update: every optional field lands where the API documents it', async () => {
		const request = await buildRequest({
			resource: 'newQuizItem',
			operation: 'update',
			params: {
				courseId,
				assignmentId,
				itemId: '145',
				updateFields: {
					answer_feedback: '{"a": "<p>No.</p>"}',
					calculator_type: 'basic',
					feedback_correct: 'Yes',
					feedback_incorrect: 'No',
					feedback_neutral: 'Hm',
					interaction_data: JSON.stringify(choiceInteraction),
					interaction_type_slug: 'choice',
					item_body: '<p>Changed</p>',
					points_possible: 4,
					position: 1,
					properties: '{"varyPointsByAnswer": true}',
					scoring_algorithm: 'VaryPointsByAnswer',
					scoring_data: JSON.stringify(choiceScoring),
					title: 'Changed title',
				},
			},
		});
		expect(request.method).toBe('PATCH');
		expect(request.body).toEqual({
			item: {
				position: 1,
				points_possible: 4,
				entry: {
					title: 'Changed title',
					item_body: '<p>Changed</p>',
					calculator_type: 'basic',
					interaction_type_slug: 'choice',
					interaction_data: choiceInteraction,
					properties: { varyPointsByAnswer: true },
					scoring_data: choiceScoring,
					answer_feedback: { a: '<p>No.</p>' },
					scoring_algorithm: 'VaryPointsByAnswer',
					feedback: { correct: 'Yes', incorrect: 'No', neutral: 'Hm' },
				},
			},
		});
	});

	it('delete: DELETE …/items/:item_id', async () => {
		const request = await buildRequest({
			resource: 'newQuizItem',
			operation: 'delete',
			params: { courseId, assignmentId, itemId: '123' },
		});
		expect([request.method, request.path, request.query]).toEqual(['DELETE', `${items}/123`, '']);
		expect(request.body).toEqual({});
	});

	it('on a Canvas without the New Quizzes service the operation ends on the Error output', async () => {
		const result = await runNode({
			resource: 'newQuizItem',
			operation: 'getAll',
			params: { courseId, assignmentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'newQuizItem', endpoint: items });
	});
});
