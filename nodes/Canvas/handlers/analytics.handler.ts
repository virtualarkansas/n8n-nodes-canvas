import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/** Drop options the user added but left empty; Canvas treats `key=` as a value. */
function withoutEmpty(options: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(options)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value) && value.length === 0) continue;
		result[key] = value;
	}
	return result;
}

/** Split a comma-separated list into trimmed, non-empty entries. */
function splitList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
	}
	return String(value ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Build the term filter path segment for department analytics endpoints.
 * Returns 'current', 'completed', or 'terms/{termId}'.
 */
function buildTermFilterSegment(getParam: GetParam): string {
	const termFilter = getParam('termFilter', 'current');
	if (termFilter === 'term') {
		return `terms/${getParam('termId')}`;
	}
	return termFilter;
}

export function handleAnalyticsResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		// ----------------------------------
		// Course-level analytics
		// ----------------------------------
		case 'getCourseActivity':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/activity`,
			};

		case 'getCourseAssignments':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/assignments`,
				qs: withoutEmpty(getParamObject('options')),
			};

		case 'getStudentSummaries':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/student_summaries`,
				qs: withoutEmpty(getParamObject('options')),
			};

		// ----------------------------------
		// User-level analytics (within a course)
		// ----------------------------------
		case 'getUserActivity':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/users/${getParam('studentId')}/activity`,
			};

		case 'getUserAssignments':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/users/${getParam('studentId')}/assignments`,
			};

		case 'getUserCommunication':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/users/${getParam('studentId')}/communication`,
			};

		// ----------------------------------
		// Department-level analytics
		// ----------------------------------
		case 'getDepartmentActivity': {
			const accountId = getParam('accountId');
			const termSegment = buildTermFilterSegment(getParam);
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/analytics/${termSegment}/activity`,
			};
		}

		case 'getDepartmentGrades': {
			const accountId = getParam('accountId');
			const termSegment = buildTermFilterSegment(getParam);
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/analytics/${termSegment}/grades`,
			};
		}

		case 'getDepartmentStatistics': {
			const accountId = getParam('accountId');
			const termSegment = buildTermFilterSegment(getParam);
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/analytics/${termSegment}/statistics`,
			};
		}

		case 'getDepartmentStatisticsBySubaccount': {
			const accountId = getParam('accountId');
			const termSegment = buildTermFilterSegment(getParam);
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/analytics/${termSegment}/statistics_by_subaccount`,
				// { "accounts": [ { "name": ..., "id": ..., "courses": ... }, ... ] }
				dataKey: 'accounts',
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for analytics`);
	}
}

// ============================================
// PROGRESS
// ============================================

export function handleProgressResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const progressId = getParam('progressId');

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/progress/${progressId}`,
			};

		case 'cancel':
			return {
				method: 'POST',
				endpoint: `/api/v1/progress/${progressId}/cancel`,
				body: withoutEmpty(getParamObject('options')),
			};

		case 'getLti':
			// LTI Advantage service: only an LTI Advantage access token is accepted here.
			return {
				method: 'GET',
				endpoint: `/api/lti/courses/${getParam('courseId')}/progress/${progressId}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for progress`);
	}
}

// ============================================
// SEARCH
// ============================================

export function handleSearchResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'findRecipients': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(withoutEmpty(options))) {
				if (key === 'exclude') {
					// "1, 2, course_3" -> exclude[]=1&exclude[]=2&exclude[]=course_3
					const exclude = splitList(value);
					if (exclude.length > 0) {
						qs.exclude = exclude;
					}
				} else {
					qs[key] = value;
				}
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/search/recipients',
				qs,
			};
		}

		case 'listAllCourses': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.search !== undefined && options.search !== '') {
				qs.search = options.search;
			}
			// Canvas only checks whether these are present ("false" filters too): send them only when on.
			if (options.public_only === true) {
				qs.public_only = true;
			}
			if (options.open_enrollment_only === true) {
				qs.open_enrollment_only = true;
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/search/all_courses',
				qs,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for search`);
	}
}

// ============================================
// SMART SEARCH
// ============================================

export function handleSmartSearchResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'search':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/smartsearch`,
				qs: {
					q: getParam('query'),
					...withoutEmpty(getParamObject('options')),
				},
				// { "results": [...], "status": "index_incomplete", "indexing_progress": 40 }
				dataKey: 'results',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for smartSearch`);
	}
}

// ============================================
// HISTORY
// ============================================

export function handleHistoryResource(
	operation: string,
	getParam: GetParam,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${getParam('userId', 'self')}/history`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for history`);
	}
}
