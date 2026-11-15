import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { isPlainObject, parseJson, parseJsonObject } from './shared';

/**
 * New Quizzes is a hosted Instructure service behind /api/quiz/v1. Request
 * shapes follow the published API documentation (New Quizzes, New Quiz Items,
 * New Quizzes Accommodations, New Quizzes Reports).
 */

// ============================================
// Helpers
// ============================================

/** Canvas IDs are integers in these JSON bodies; anything else (a SIS ID) is passed on as text. */
function toId(value: string): string | number {
	const text = value.trim();
	return /^\d+$/.test(text) ? Number(text) : text;
}

// ============================================
// New Quiz
// ============================================

/** quiz[...] */
const QUIZ_FIELDS = [
	'title',
	'assignment_group_id',
	'points_possible',
	'due_at',
	'lock_at',
	'unlock_at',
	'grading_type',
	'instructions',
];

/** quiz[quiz_settings][...] */
const QUIZ_SETTINGS_FIELDS = [
	'calculator_type',
	'filter_ip_address',
	'one_at_a_time_type',
	'allow_backtracking',
	'shuffle_answers',
	'shuffle_questions',
	'require_student_access_code',
	'student_access_code',
	'has_time_limit',
	'session_time_limit_in_seconds',
];

/** quiz[quiz_settings][multiple_attempts][...] */
const MULTIPLE_ATTEMPTS_FIELDS = [
	'multiple_attempts_enabled',
	'attempt_limit',
	'max_attempts',
	'score_to_keep',
	'cooling_period',
	'cooling_period_seconds',
];

/**
 * Arrange the flat list of UI fields the way the New Quizzes API nests them:
 *
 *   quiz: { title, …, quiz_settings: { …, filters: { ips }, multiple_attempts: { … },
 *           result_view_settings: { … } } }
 */
function buildNewQuizBody(fields: Record<string, unknown>): Record<string, unknown> {
	const quiz: Record<string, unknown> = {};
	const settings: Record<string, unknown> = {};
	const multipleAttempts: Record<string, unknown> = {};

	for (const key of QUIZ_FIELDS) {
		if (fields[key] !== undefined) quiz[key] = fields[key];
	}
	for (const key of QUIZ_SETTINGS_FIELDS) {
		if (fields[key] !== undefined) settings[key] = fields[key];
	}
	for (const key of MULTIPLE_ATTEMPTS_FIELDS) {
		if (fields[key] !== undefined) multipleAttempts[key] = fields[key];
	}

	// An access code only takes effect together with its switch.
	if (typeof settings.student_access_code === 'string') {
		if (settings.student_access_code === '') {
			settings.student_access_code = null;
			settings.require_student_access_code ??= false;
		} else {
			settings.require_student_access_code ??= true;
		}
	}

	// Same for the time limit; 0 means "no time limit", which the API expresses as null.
	if (settings.session_time_limit_in_seconds !== undefined) {
		if (Number(settings.session_time_limit_in_seconds) > 0) {
			settings.has_time_limit ??= true;
		} else {
			settings.session_time_limit_in_seconds = null;
			settings.has_time_limit = false;
		}
	}

	const filters = parseJson(fields.filters, 'IP Filters must be valid JSON');
	if (filters !== undefined) {
		// Accept the list of ranges itself, or the documented { "ips": [...] } wrapper.
		const ips = isPlainObject(filters) ? filters.ips : filters;
		if (!Array.isArray(ips)) {
			throw new ApplicationError(
				'IP Filters must be a JSON array of [start address, end address] ranges',
			);
		}
		settings.filters = { ips };
	}

	const resultView = parseJsonObject(fields.result_view_settings, {
		invalidJson: 'Result View Settings must be valid JSON',
		notAnObject: 'Result View Settings must be a JSON object',
	});
	if (resultView !== undefined && Object.keys(resultView).length > 0) {
		settings.result_view_settings = resultView;
	}

	if (Object.keys(multipleAttempts).length > 0) {
		settings.multiple_attempts = multipleAttempts;
	}
	if (Object.keys(settings).length > 0) {
		quiz.quiz_settings = settings;
	}
	return { quiz };
}

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
				body: buildNewQuizBody({ title: getParam('title'), ...getParamObject('additionalFields') }),
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
				method: 'PATCH',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${getParam('assignmentId')}`,
				body: buildNewQuizBody(getParamObject('updateFields')),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for newQuiz`);
	}
}

// ============================================
// New Quiz Item
// ============================================

/** UI field -> key under item[entry][...] */
const ENTRY_FIELDS: Record<string, string> = {
	title: 'title',
	item_body: 'item_body',
	calculator_type: 'calculator_type',
	interaction_type_slug: 'interaction_type_slug',
	scoring_algorithm: 'scoring_algorithm',
};

/** UI field (JSON) -> key under item[entry][...] and its label for error messages */
const ENTRY_JSON_FIELDS: Record<string, string> = {
	interaction_data: 'Interaction Data',
	scoring_data: 'Scoring Data',
	properties: 'Properties',
	answer_feedback: 'Answer Feedback',
};

/** UI field -> key under item[entry][feedback][...] */
const FEEDBACK_FIELDS: Record<string, string> = {
	feedback_correct: 'correct',
	feedback_incorrect: 'incorrect',
	feedback_neutral: 'neutral',
};

/**
 * Arrange the flat list of UI fields the way the New Quiz Items API nests them:
 *
 *   item: { position, points_possible, entry_type, entry: { title, item_body, …,
 *           interaction_data, scoring_data, feedback: { correct, incorrect, neutral } } }
 */
function buildNewQuizItem(
	fields: Record<string, unknown>,
	/** JSON fields that are sent as `{}` when they were left empty. */
	alwaysSent: string[] = [],
): Record<string, unknown> {
	const item: Record<string, unknown> = {};
	const entry: Record<string, unknown> = {};
	const feedback: Record<string, unknown> = {};

	for (const key of ['position', 'points_possible']) {
		if (fields[key] !== undefined) item[key] = fields[key];
	}
	for (const [key, target] of Object.entries(ENTRY_FIELDS)) {
		if (fields[key] !== undefined) entry[target] = fields[key];
	}
	for (const [key, label] of Object.entries(ENTRY_JSON_FIELDS)) {
		const parsed = parseJsonObject(fields[key], {
			invalidJson: `${label} must be valid JSON`,
			notAnObject: `${label} must be a JSON object`,
		});
		if (parsed !== undefined) {
			entry[key] = parsed;
		} else if (alwaysSent.includes(key)) {
			entry[key] = {};
		}
	}
	for (const [key, target] of Object.entries(FEEDBACK_FIELDS)) {
		if (fields[key] !== undefined) feedback[target] = fields[key];
	}
	if (Object.keys(feedback).length > 0) {
		entry.feedback = feedback;
	}
	if (Object.keys(entry).length > 0) {
		item.entry = entry;
	}
	return item;
}

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
			const item = buildNewQuizItem(
				{
					...getParamObject('additionalFields'),
					item_body: getParam('itemBody'),
					interaction_type_slug: getParam('interactionType'),
					interaction_data: getParam('interactionData'),
					scoring_data: getParam('scoringData'),
					scoring_algorithm: getParam('scoringAlgorithm'),
				},
				// Required by the API even for the types that have no interaction data.
				['interaction_data', 'scoring_data'],
			);
			return {
				method: 'POST',
				endpoint: basePath,
				// Only question items can be created through the API.
				body: { item: { ...item, entry_type: 'Item' } },
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

		case 'update':
			return {
				method: 'PATCH',
				endpoint: `${basePath}/${getParam('itemId')}`,
				body: { item: buildNewQuizItem(getParamObject('updateFields')) },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for newQuizItem`);
	}
}

// ============================================
// New Quiz Accommodations
// ============================================

/**
 * The accommodations endpoints take a JSON array of accommodation objects
 * (one per student) as the request body, not an object.
 */
function accommodationBody(
	userId: string,
	options: Record<string, unknown>,
	allowed: string[],
): Array<Record<string, unknown>> {
	const accommodation: Record<string, unknown> = { user_id: toId(userId) };
	for (const key of allowed) {
		if (options[key] !== undefined && options[key] !== '') {
			accommodation[key] = options[key];
		}
	}
	return [accommodation];
}

export function buildNewQuizAccommodationsRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const userId = getParam('userId');

	switch (operation) {
		case 'setCourse':
			return {
				method: 'POST',
				endpoint: `/api/quiz/v1/courses/${courseId}/accommodations`,
				body: accommodationBody(userId, getParamObject('options'), [
					'extra_time',
					'apply_to_in_progress_quiz_sessions',
					'reduce_choices_enabled',
				]),
			};

		case 'setQuiz':
			return {
				method: 'POST',
				endpoint: `/api/quiz/v1/courses/${courseId}/quizzes/${getParam('assignmentId')}/accommodations`,
				body: accommodationBody(userId, getParamObject('options'), [
					'extra_time',
					'extra_attempts',
					'reduce_choices_enabled',
				]),
			};

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
