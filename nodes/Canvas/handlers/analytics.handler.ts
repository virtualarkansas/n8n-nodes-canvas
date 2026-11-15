import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { pollUntil, stateIn, toList, withoutBlanks } from './shared';

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
				qs: withoutBlanks(getParamObject('options')),
			};

		case 'getStudentSummaries':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/student_summaries`,
				qs: withoutBlanks(getParamObject('options')),
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

		case 'waitForCompletion':
			return {
				method: 'GET',
				endpoint: `/api/v1/progress/${progressId}`,
				poll: pollUntil(getParam, stateIn('workflow_state', ['completed', 'failed'])),
			};

		case 'cancel':
			return {
				method: 'POST',
				endpoint: `/api/v1/progress/${progressId}/cancel`,
				body: withoutBlanks(getParamObject('options')),
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
			for (const [key, value] of Object.entries(withoutBlanks(options))) {
				if (key === 'exclude') {
					// "1, 2, course_3" -> exclude[]=1&exclude[]=2&exclude[]=course_3
					const exclude = toList(value);
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
				// Canvas wraps every entry: [{ "course": { ... } }]
				itemKey: 'course',
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
					...withoutBlanks(getParamObject('options')),
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
