import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// New Quiz
// ============================================

export function buildNewQuizRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes`,
				body: { title: getParam('title'), ...getParamObject('additionalFields') },
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${getParam('assignmentId')}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${getParam('assignmentId')}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${getParam('assignmentId')}`,
				body: getParamObject('updateFields'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for newQuiz`);
	}
}

// ============================================
// New Quiz Item
// ============================================

export function buildNewQuizItemRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');
	const basePath = `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/items`;

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const interactionDataRaw = getParam('interactionData');
			const scoringDataRaw = getParam('scoringData');

			let interactionData: object;
			let scoringData: object;

			try {
				interactionData = JSON.parse(interactionDataRaw) as object;
			} catch {
				throw new ApplicationError('Interaction Data must be valid JSON');
			}

			try {
				scoringData = JSON.parse(scoringDataRaw) as object;
			} catch {
				throw new ApplicationError('Scoring Data must be valid JSON');
			}

			return {
				method: 'POST',
				endpoint: basePath,
				body: {
					item: {
						item_body: getParam('itemBody'),
						interaction_type_slug: getParam('interactionType'),
						interaction_data: interactionData,
						scoring_data: scoringData,
						scoring_algorithm: getParam('scoringAlgorithm'),
						...additionalFields,
					},
				},
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/${getParam('itemId')}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/${getParam('itemId')}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
			};

		case 'getMediaUploadUrl':
			return {
				method: 'GET',
				endpoint: `${basePath}/media_upload_url`,
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');

			// Parse JSON string fields if present
			if (updateFields.interaction_data && typeof updateFields.interaction_data === 'string') {
				try {
					updateFields.interaction_data = JSON.parse(updateFields.interaction_data as string);
				} catch {
					throw new ApplicationError('Interaction Data must be valid JSON');
				}
			}

			if (updateFields.scoring_data && typeof updateFields.scoring_data === 'string') {
				try {
					updateFields.scoring_data = JSON.parse(updateFields.scoring_data as string);
				} catch {
					throw new ApplicationError('Scoring Data must be valid JSON');
				}
			}

			return {
				method: 'PUT',
				endpoint: `${basePath}/${getParam('itemId')}`,
				body: { item: updateFields },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for newQuizItem`);
	}
}

// ============================================
// New Quiz Accommodations
// ============================================

export function buildNewQuizAccommodationsRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const userId = getParam('userId');

	switch (operation) {
		case 'setCourse': {
			const options = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `/api/quiz/v1/courses/${courseId}/accommodations`,
				body: {
					user_id: userId,
					...options,
				},
			};
		}

		case 'setQuiz': {
			const assignmentId = getParam('assignmentId');
			const options = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/accommodations`,
				body: {
					user_id: userId,
					...options,
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for newQuizAccommodations`);
	}
}

// ============================================
// New Quiz Report
// ============================================

export function buildNewQuizReportRequest(
	operation: string,
	getParam: GetParam,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/reports`,
				body: {
					quiz_report: {
						report_type: getParam('reportType'),
						format: getParam('format'),
					},
				},
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for newQuizReport`);
	}
}
