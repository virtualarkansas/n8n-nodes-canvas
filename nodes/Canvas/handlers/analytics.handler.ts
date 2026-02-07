import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// ANALYTICS
// ============================================

/**
 * Build the term filter path segment for department analytics endpoints.
 * Returns 'current', 'completed', or 'terms/{termId}'.
 */
function buildTermFilterSegment(getParam: GetParam): string {
	const termFilter = getParam('termFilter');
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
				qs: getParamObject('options'),
			};

		case 'getStudentSummaries':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/analytics/student_summaries`,
				qs: getParamObject('options'),
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
				body: getParamObject('options'),
			};

		case 'getLti':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/progress/${progressId}`,
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

			// Handle permissions as an array parameter
			if (options.permissions) {
				qs['permissions[]'] = options.permissions;
				delete options.permissions;
			}

			// Handle exclude as comma-separated to array
			if (options.exclude) {
				qs['exclude[]'] = (options.exclude as string).split(',').map((id) => id.trim());
				delete options.exclude;
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/search/recipients',
				qs: { ...options, ...qs },
			};
		}

		case 'listAllCourses':
			return {
				method: 'GET',
				endpoint: '/api/v1/search/all_courses',
				qs: getParamObject('options'),
			};

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
		case 'search': {
			const courseId = getParam('courseId');
			const query = getParam('query');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {
				q: query,
			};

			// Handle filter as an array parameter
			if (options.filter) {
				qs['filter[]'] = options.filter;
				delete options.filter;
			}

			// Handle include as an array parameter
			if (options.include) {
				qs['include[]'] = options.include;
				delete options.include;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/smartsearch`,
				qs: { ...options, ...qs },
			};
		}

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
				endpoint: `/api/v1/users/${getParam('userId')}/history`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for history`);
	}
}
