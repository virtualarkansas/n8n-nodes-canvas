import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

function splitIds(value: unknown): string[] {
	return String(value ?? '')
		.split(/[\s,]+/)
		.map((id) => id.trim())
		.filter((id) => id !== '');
}

// ============================================
// Quiz Submission User List
// ============================================

export function buildQuizSubmissionUserRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = `/api/v1/courses/${getParam('courseId')}/quizzes/${getParam('quizId')}/submission_users`;

	switch (operation) {
		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.submitted !== undefined) {
				qs.submitted = options.submitted;
			}
			// Canvas names this argument "include" in the request although the docs say "includes".
			if (Array.isArray(options.include) && options.include.length > 0) {
				qs.include = options.include;
			}
			return { method: 'GET', endpoint: base, qs, dataKey: 'users' };
		}
		case 'message': {
			const conversation: IDataObject = {
				body: getParam('body'),
				recipients: getParam('recipients', 'unsubmitted'),
				...getParamObject('additionalFields'),
			};
			return { method: 'POST', endpoint: `${base}/message`, body: { conversations: [conversation] } };
		}
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizSubmissionUser`);
	}
}

// ============================================
// Quiz Submission Events
// ============================================

export function buildQuizSubmissionEventRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/quizzes/${getParam('quizId')}/submissions/${getParam('quizSubmissionId')}/events`,
				qs: getParamObject('options'),
				dataKey: 'quiz_submission_events',
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizSubmissionEvent`);
	}
}

// ============================================
// Course Quiz Extensions
// ============================================

export function buildCourseQuizExtensionRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'set': {
			const entries = ((getParamObject('extensions').extension as IDataObject[] | undefined) ?? []).filter(
				(entry) => entry.user_id !== undefined && entry.user_id !== '',
			);
			if (entries.length === 0) {
				throw new ApplicationError('At least one extension with a User ID is required for courseQuizExtension set');
			}
			const quizExtensions = entries.map((entry) => {
				const extension: IDataObject = { user_id: entry.user_id };
				// 0 means "not set" for the minute and attempt fields; sending both extend_* is an error in Canvas.
				for (const key of ['extra_attempts', 'extra_time', 'extend_from_now', 'extend_from_end_at']) {
					if (typeof entry[key] === 'number' && (entry[key] as number) > 0) {
						extension[key] = entry[key];
					}
				}
				if (entry.manually_unlocked !== undefined) {
					extension.manually_unlocked = entry.manually_unlocked;
				}
				if (extension.extend_from_now !== undefined && extension.extend_from_end_at !== undefined) {
					throw new ApplicationError(
						`Extension for user ${String(entry.user_id)}: use either Extend From Now or Extend From End At, not both`,
					);
				}
				return extension;
			});
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/quiz_extensions`,
				body: { quiz_extensions: quizExtensions },
				dataKey: 'quiz_extensions',
			};
		}
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for courseQuizExtension`);
	}
}

// ============================================
// Quiz Assignment Overrides
// ============================================

export function buildQuizAssignmentOverrideRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const course = `/api/v1/courses/${getParam('courseId')}`;
	const quizIds = splitIds(getParamObject('options').quiz_ids);
	// Canvas reads the first element of an array: quiz_assignment_overrides[][quiz_ids][]=...
	const qs: Record<string, unknown> =
		quizIds.length > 0 ? { quiz_assignment_overrides: [{ quiz_ids: quizIds }] } : {};

	switch (operation) {
		case 'getAll':
			return { method: 'GET', endpoint: `${course}/quizzes/assignment_overrides`, qs, dataKey: 'quiz_assignment_overrides' };
		case 'getAllNewQuizzes':
			return { method: 'GET', endpoint: `${course}/new_quizzes/assignment_overrides`, qs, dataKey: 'quiz_assignment_overrides' };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizAssignmentOverride`);
	}
}

// ============================================
// Quiz IP Filters
// ============================================

export function buildQuizIpFilterRequest(operation: string, getParam: GetParam): IRequestConfig {
	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/quizzes/${getParam('quizId')}/ip_filters`,
				dataKey: 'quiz_ip_filters',
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizIpFilter`);
	}
}

// ============================================
// Quiz Submission Questions
// ============================================

export function buildQuizSubmissionQuestionRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = `/api/v1/quiz_submissions/${getParam('quizSubmissionId')}/questions`;
	const dataKey = 'quiz_submission_questions';
	const attemptBody = (): IDataObject => {
		const body: IDataObject = {
			attempt: Number(getParam('attempt', '1')),
			validation_token: getParam('validationToken'),
		};
		const accessCode = getParamObject('additionalFields').access_code;
		if (accessCode !== undefined && accessCode !== '') {
			body.access_code = accessCode as string;
		}
		return body;
	};

	switch (operation) {
		case 'getAll':
			return { method: 'GET', endpoint: base, qs: getParamObject('options'), dataKey };
		case 'answer': {
			let answers: unknown;
			try {
				answers = JSON.parse(getParam('answers', '[]'));
			} catch {
				throw new ApplicationError('Answers must be a JSON array, e.g. [{"question_id": 12, "answer": "Hello"}]');
			}
			if (!Array.isArray(answers) || answers.length === 0) {
				throw new ApplicationError('At least one answer is required for quizSubmissionQuestion answer');
			}
			// Canvas wants { id, answer }; accept question_id as the more readable spelling.
			const quizQuestions = (answers as IDataObject[]).map((entry, index) => {
				const id = entry?.id ?? entry?.question_id;
				if (id === undefined || id === null || id === '') {
					throw new ApplicationError(`Answer ${index + 1} has no question_id`);
				}
				return { id, answer: entry.answer };
			});
			return {
				method: 'POST',
				endpoint: base,
				body: { ...attemptBody(), quiz_questions: quizQuestions },
				dataKey,
			};
		}
		case 'flag':
			return { method: 'PUT', endpoint: `${base}/${getParam('questionId')}/flag`, body: attemptBody(), dataKey };
		case 'unflag':
			return { method: 'PUT', endpoint: `${base}/${getParam('questionId')}/unflag`, body: attemptBody(), dataKey };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizSubmissionQuestion`);
	}
}
