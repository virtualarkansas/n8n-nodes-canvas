import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { buildUploadSource } from './submissions.handler';

// ============================================
// Helpers
// ============================================

/**
 * Parse a JSON field that may arrive as a string (typed in the UI) or already
 * as an object/array (from an expression).
 */
function parseJsonField(value: unknown, label: string): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const text = value.trim();
	if (text === '') {
		return undefined;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new ApplicationError(`Invalid JSON in ${label}`);
	}
}

/** Whole number from a parameter that the node hands over as a string. */
function toInteger(value: string, label: string): number {
	const parsed = Number(value);
	if (value.trim() === '' || !Number.isInteger(parsed)) {
		throw new ApplicationError(`${label} must be a whole number, got "${value}"`);
	}
	return parsed;
}

/** Split a comma-separated list of IDs into an array, dropping blanks. */
function splitList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
	}
	return String(value ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

/**
 * Adjust quiz settings Canvas would otherwise mishandle:
 *  - a time limit of 0 is rejected ("Time Limit is not valid"); "no time limit" is null;
 *  - when `cant_go_back` accompanies `one_question_at_a_time: false`, Canvas discards the
 *    one_question_at_a_time change instead of the (then meaningless) cant_go_back one.
 */
function normalizeQuizSettings(fields: Record<string, unknown>): Record<string, unknown> {
	if (fields.time_limit !== undefined && fields.time_limit !== null && Number(fields.time_limit) <= 0) {
		fields.time_limit = null;
	}
	if (fields.one_question_at_a_time === false && fields.cant_go_back !== undefined) {
		delete fields.cant_go_back;
	}
	return fields;
}

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
				body: {
					quiz: normalizeQuizSettings({
						title: getParam('title'),
						...getParamObject('additionalFields'),
					}),
				},
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

		// Classic quizzes and New Quizzes (assignments of the New Quizzes tool) in one list.
		case 'getAllWithNewQuizzes':
			return {
				endpoint: `/api/v1/courses/${courseId}/all_quizzes`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}`,
				method: 'PUT',
				body: { quiz: normalizeQuizSettings(getParamObject('updateFields')) },
			};

		case 'reorder': {
			const orderData = getParamObject('orderItems');
			const items = (orderData.items as Array<{ id: string | number; type: string }>) || [];

			if (items.length === 0) {
				throw new ApplicationError(
					'At least one item is required for quiz reorder',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reorder`,
				method: 'POST',
				body: {
					order: items.map((item) => ({
						id: String(item.id).trim(),
						type: item.type || 'question',
					})),
				},
			};
		}

		case 'validateAccessCode':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/validate_access_code`,
				method: 'POST',
				body: { access_code: getParam('accessCode') },
			};

		case 'getSubmissionUsers': {
			const submitted = getParam('submitted', 'all');
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submission_users`,
				method: 'GET',
				qs: submitted === 'true' || submitted === 'false' ? { submitted } : {},
				dataKey: 'users',
			};
		}

		case 'messageStudents': {
			const conversation: Record<string, unknown> = {
				body: getParam('body'),
				recipients: getParam('recipients', 'unsubmitted'),
			};
			const subject = getParam('subject');
			if (subject !== '') {
				conversation.subject = subject;
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/submission_users/message`,
				method: 'POST',
				body: { conversations: [conversation] },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quiz`);
	}
}

// ============================================
// QUIZ QUESTION
// ============================================

/** `answers` is typed as JSON in the UI; Canvas wants the array itself. */
function normalizeQuestionFields(
	fields: Record<string, unknown>,
	operation: string,
): Record<string, unknown> {
	if (fields.answers !== undefined) {
		const answers = parseJsonField(fields.answers, `answers field for quizQuestion ${operation}`);
		if (answers === undefined) {
			delete fields.answers;
		} else if (!Array.isArray(answers)) {
			throw new ApplicationError(
				`The answers field for quizQuestion ${operation} must be a JSON array of answer objects`,
			);
		} else {
			fields.answers = answers;
		}
	}
	return fields;
}

export function handleQuizQuestionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');
	const questionId = getParam('questionId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`,
				method: 'POST',
				body: {
					question: {
						question_name: getParam('questionName'),
						question_text: getParam('questionText'),
						question_type: getParam('questionType'),
						...normalizeQuestionFields(getParamObject('additionalFields'), 'create'),
					},
				},
			};

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

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			const submissionId = String(options.quiz_submission_id ?? '').trim();
			if (submissionId !== '') {
				// Canvas only switches to "questions of that submission" when both are present.
				qs.quiz_submission_id = submissionId;
				qs.quiz_submission_attempt = options.quiz_submission_attempt ?? 1;
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`,
				method: 'GET',
				qs,
			};
		}

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
				method: 'PUT',
				body: { question: normalizeQuestionFields(getParamObject('updateFields'), 'update') },
			};

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
				dataKey: 'quiz_groups',
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
				dataKey: 'quiz_groups',
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}`,
				method: 'PUT',
				body: {
					quiz_groups: [getParamObject('updateFields')],
				},
				dataKey: 'quiz_groups',
			};

		case 'reorder': {
			const orderData = getParamObject('questionOrder');
			const questions = (orderData.questions as Array<{ id: string | number }>) || [];

			if (questions.length === 0) {
				throw new ApplicationError(
					'At least one question is required for quizQuestionGroup reorder',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/groups/${groupId}/reorder`,
				method: 'POST',
				body: {
					order: questions.map((q) => ({ id: String(q.id).trim(), type: 'question' })),
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
	const base = `/api/v1/courses/${courseId}/quizzes/${quizId}`;

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
				endpoint: `${base}/submissions`,
				method: 'POST',
				body,
				dataKey: 'quiz_submissions',
			};
		}

		case 'get': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.attempt !== undefined && options.attempt !== '' && Number(options.attempt) > 0) {
				qs.attempt = options.attempt;
			}
			const include = splitList(options.include);
			if (include.length > 0) {
				// The associations come back next to `quiz_submissions`, so the compound
				// document is returned as it is instead of being unwrapped.
				return { endpoint: `${base}/submissions/${submissionId}`, method: 'GET', qs: { ...qs, include } };
			}
			return {
				endpoint: `${base}/submissions/${submissionId}`,
				method: 'GET',
				qs,
				dataKey: 'quiz_submissions',
			};
		}

		case 'getAll':
			return {
				endpoint: `${base}/submissions`,
				method: 'GET',
				dataKey: 'quiz_submissions',
			};

		case 'getOwn':
			return {
				endpoint: `${base}/submission`,
				method: 'GET',
				dataKey: 'quiz_submissions',
			};

		case 'getTime':
			return {
				endpoint: `${base}/submissions/${submissionId}/time`,
				method: 'GET',
			};

		case 'complete': {
			const completeOptions = getParamObject('options');
			const body: Record<string, unknown> = {
				attempt: toInteger(getParam('attempt', '1'), 'Attempt'),
				validation_token: getParam('validationToken'),
			};

			if (completeOptions.access_code) {
				body.access_code = completeOptions.access_code;
			}

			return {
				endpoint: `${base}/submissions/${submissionId}/complete`,
				method: 'POST',
				body,
				dataKey: 'quiz_submissions',
			};
		}

		case 'updateScore': {
			const updateFields = getParamObject('updateFields');
			const entry: Record<string, unknown> = {
				attempt: toInteger(getParam('attempt', '1'), 'Attempt'),
			};

			if (updateFields.fudge_points !== undefined && updateFields.fudge_points !== '') {
				entry.fudge_points = updateFields.fudge_points;
			}

			const questions = parseJsonField(
				updateFields.questions,
				'questions field for quizSubmission updateScore',
			);
			if (questions !== undefined && questions !== null) {
				if (typeof questions !== 'object' || Array.isArray(questions)) {
					throw new ApplicationError(
						'The questions field for quizSubmission updateScore must be a JSON object keyed by question ID',
					);
				}
				if (Object.keys(questions as Record<string, unknown>).length > 0) {
					entry.questions = questions;
				}
			}

			return {
				endpoint: `${base}/submissions/${submissionId}`,
				method: 'PUT',
				body: { quiz_submissions: [entry] },
				dataKey: 'quiz_submissions',
			};
		}

		case 'getAllOutstanding':
			return {
				endpoint: `${base}/outstanding_quiz_submissions`,
				method: 'GET',
				dataKey: 'quiz_submissions',
			};

		case 'gradeOutstanding': {
			const ids = splitList(getParam('quizSubmissionIds'));
			if (ids.length === 0) {
				throw new ApplicationError(
					'At least one quiz submission ID is required for quizSubmission gradeOutstanding',
				);
			}
			return {
				endpoint: `${base}/outstanding_quiz_submissions`,
				method: 'POST',
				body: { quiz_submission_ids: ids },
			};
		}

		case 'uploadFile': {
			// Step 1 of the upload, for the running attempt of the user of the credential.
			// The ID of the finished file answers a file upload question.
			const options = getParamObject('options');
			const body: Record<string, unknown> = {};
			if (options.name) {
				body.name = options.name;
			}
			if (options.content_type) {
				body.content_type = options.content_type;
			}
			return {
				endpoint: `${base}/submissions/self/files`,
				method: 'POST',
				body,
				upload: buildUploadSource(getParam),
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
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reports`,
				method: 'POST',
				body: {
					quiz_report: {
						report_type: getParam('reportType'),
						...(options.includes_all_versions !== undefined
							? { includes_all_versions: options.includes_all_versions }
							: {}),
					},
				},
			};
		}

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/reports/${reportId}`,
				method: 'GET',
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
		case 'get': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.all_versions !== undefined) {
				qs.all_versions = options.all_versions;
			}
			const sectionIds = splitList(options.section_ids);
			if (sectionIds.length > 0) {
				qs.section_ids = sectionIds;
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/statistics`,
				method: 'GET',
				qs,
				dataKey: 'quiz_statistics',
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizStatistics`);
	}
}

// ============================================
// QUIZ EXTENSION
// ============================================

interface IQuizExtensionEntry {
	user_id: string | number;
	extra_attempts?: number | string;
	extra_time?: number | string;
	manually_unlocked?: boolean;
	extend_from_now?: number | string;
	extend_from_end_at?: number | string;
}

/**
 * Build the `quiz_extensions` array. Extra attempts / extra time / manually
 * unlocked are sent as entered (the operation sets them); the two "extend"
 * values are only sent when they are positive.
 */
function buildExtensionEntries(getParamObject: GetParamObject, label: string): Array<Record<string, unknown>> {
	const extensionsData = getParamObject('extensions');
	const extensionValues = (extensionsData.extensionValues as IQuizExtensionEntry[]) || [];

	if (extensionValues.length === 0) {
		throw new ApplicationError(`At least one extension entry is required for ${label}`);
	}

	return extensionValues.map((entry) => {
		const userId = String(entry.user_id ?? '').trim();
		if (userId === '') {
			throw new ApplicationError(`Every extension entry needs a User ID (${label})`);
		}
		const out: Record<string, unknown> = { user_id: userId };
		for (const key of ['extra_attempts', 'extra_time'] as const) {
			if (entry[key] !== undefined && entry[key] !== '' && entry[key] !== null) {
				out[key] = entry[key];
			}
		}
		if (entry.manually_unlocked !== undefined) {
			out.manually_unlocked = entry.manually_unlocked;
		}
		// Canvas looks at extend_from_now first and treats a 0 there as "an extension was
		// given", which silently cancels extend_from_end_at; so zeros are left out. When
		// both are set, Canvas applies Extend From Now.
		if (Number(entry.extend_from_now) > 0) {
			out.extend_from_now = entry.extend_from_now;
		} else if (Number(entry.extend_from_end_at) > 0) {
			out.extend_from_end_at = entry.extend_from_end_at;
		}
		return out;
	});
}

export function handleQuizExtensionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const quizId = getParam('quizId');

	switch (operation) {
		case 'setExtensions':
			return {
				endpoint: `/api/v1/courses/${courseId}/quizzes/${quizId}/extensions`,
				method: 'POST',
				body: {
					quiz_extensions: buildExtensionEntries(getParamObject, 'quizExtension setExtensions'),
				},
				dataKey: 'quiz_extensions',
			};

		case 'setCourseExtensions':
			return {
				endpoint: `/api/v1/courses/${courseId}/quiz_extensions`,
				method: 'POST',
				body: {
					quiz_extensions: buildExtensionEntries(getParamObject, 'quizExtension setCourseExtensions'),
				},
				dataKey: 'quiz_extensions',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for quizExtension`);
	}
}
