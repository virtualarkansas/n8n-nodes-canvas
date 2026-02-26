import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// QUIZ
// ============================================

export function handleQuizResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes`,
				method: 'POST',
				body: { quiz: { title: getParam('title'), ...getParamObject('additionalFields') } },
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}`,
				method: 'PUT',
				body: { quiz: getParamObject('updateFields') },
			};

		case 'reorder': {
			const orderData = getParamObject('orderItems');
			const items = (orderData.items as Array<{ id: string; type: string }>) || [];

			if (items.length === 0) {
				throw new ApplicationError(
					'At least one item is required for quiz reorder',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reorder`,
				method: 'POST',
				body: {
					order: items.map((item) => ({ id: item.id, type: item.type })),
				},
			};
		}

		case 'validateAccessCode':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/validate_access_code`,
				method: 'POST',
				body: { access_code: getParam('accessCode') },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quiz`);
	}
}

// ============================================
// QUIZ QUESTION
// ============================================

export function handleQuizQuestionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');
	const questionId = getParam('questionId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');

			// Parse answers from JSON string if provided
			if (additionalFields.answers && typeof additionalFields.answers === 'string') {
				try {
					additionalFields.answers = JSON.parse(additionalFields.answers as string);
				} catch {
					throw new ApplicationError('Invalid JSON in answers field for quizQuestion create');
				}
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`,
				method: 'POST',
				body: {
					question: {
						question_name: getParam('questionName'),
						question_text: getParam('questionText'),
						question_type: getParam('questionType'),
						...additionalFields,
					},
				},
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');

			// Parse answers from JSON string if provided
			if (updateFields.answers && typeof updateFields.answers === 'string') {
				try {
					updateFields.answers = JSON.parse(updateFields.answers as string);
				} catch {
					throw new ApplicationError('Invalid JSON in answers field for quizQuestion update');
				}
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
				method: 'PUT',
				body: { question: updateFields },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizQuestion`);
	}
}

// ============================================
// QUIZ QUESTION GROUP
// ============================================

export function handleQuizQuestionGroupResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');
	const groupId = getParam('groupId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups`,
				method: 'POST',
				body: {
					quiz_groups: [
						{
							name: getParam('name'),
							...getParamObject('additionalFields'),
						},
					],
				},
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups`,
				method: 'GET',
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`,
				method: 'PUT',
				body: {
					quiz_groups: [getParamObject('updateFields')],
				},
			};

		case 'reorder': {
			const orderData = getParamObject('questionOrder');
			const questions = (orderData.questions as Array<{ id: string }>) || [];

			if (questions.length === 0) {
				throw new ApplicationError(
					'At least one question is required for quizQuestionGroup reorder',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}/reorder`,
				method: 'POST',
				body: {
					order: questions.map((q) => ({ id: q.id, type: 'question' })),
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizQuestionGroup`);
	}
}

// ============================================
// QUIZ SUBMISSION
// ============================================

export function handleQuizSubmissionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');
	const submissionId = getParam('submissionId');

	switch (operation) {
		case 'start': {
			const options = getParamObject('options');
			const body: Record<string, unknown> = {};

			if (options.access_code) {
				body.access_code = options.access_code;
			}
			if (options.preview !== undefined) {
				body.preview = options.preview;
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
				method: 'POST',
				body,
			};
		}

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'complete': {
			const completeOptions = getParamObject('options');
			const body: Record<string, unknown> = {
				attempt: getParam('attempt'),
				validation_token: getParam('validationToken'),
			};

			if (completeOptions.access_code) {
				body.access_code = completeOptions.access_code;
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}/complete`,
				method: 'POST',
				body,
			};
		}

		case 'updateScore': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {
				quiz_submissions: [
					{
						attempt: getParam('attempt'),
						...updateFields,
					},
				],
			};

			// Parse questions from JSON string if provided
			if (updateFields.questions && typeof updateFields.questions === 'string') {
				try {
					const parsedQuestions = JSON.parse(updateFields.questions as string);
					(body.quiz_submissions as Array<Record<string, unknown>>)[0].questions = parsedQuestions;
				} catch {
					throw new ApplicationError('Invalid JSON in questions field for quizSubmission updateScore');
				}
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}`,
				method: 'PUT',
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizSubmission`);
	}
}

// ============================================
// QUIZ REPORT
// ============================================

export function handleQuizReportResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');
	const reportId = getParam('reportId');

	switch (operation) {
		case 'create': {
			const options = getParamObject('options');
			const body: Record<string, unknown> = {
				quiz_report: {
					report_type: getParam('reportType'),
					...(options.includes_all_versions !== undefined
						? { includes_all_versions: options.includes_all_versions }
						: {}),
				},
			};

			// Pass include as query string (convertArrayParams handles bracket notation)
			const qs: Record<string, unknown> = {};
			if (options.include && Array.isArray(options.include) && (options.include as string[]).length > 0) {
				qs.include = options.include;
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reports`,
				method: 'POST',
				body,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reports/${reportId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reports`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'abort':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reports/${reportId}`,
				method: 'DELETE',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizReport`);
	}
}

// ============================================
// QUIZ STATISTICS
// ============================================

export function handleQuizStatisticsResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');

	switch (operation) {
		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/statistics`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizStatistics`);
	}
}

// ============================================
// QUIZ EXTENSION
// ============================================

export function handleQuizExtensionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');

	switch (operation) {
		case 'setExtensions': {
			const extensionsData = getParamObject('extensions');
			const extensionValues = (extensionsData.extensionValues as Array<{
				user_id: string;
				extra_attempts?: number;
				extra_time?: number;
				manually_unlocked?: boolean;
				extend_from_now?: number;
				extend_from_end_at?: number;
			}>) || [];

			if (extensionValues.length === 0) {
				throw new ApplicationError(
					'At least one extension entry is required for quizExtension setExtensions',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/extensions`,
				method: 'POST',
				body: {
					quiz_extensions: extensionValues,
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizExtension`);
	}
}
