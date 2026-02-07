import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Course
// ============================================

export function buildCourseRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/courses`,
				body: { course: { name: getParam('name'), ...getParamObject('additionalFields') } },
			};
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${courseId}`,
				qs: { event: 'delete' },
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}`,
				qs: getParamObject('options'),
			};
		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/courses',
				qs: getParamObject('options'),
			};
		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${courseId}`,
				body: { course: getParamObject('updateFields') },
			};
		case 'conclude':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${courseId}`,
				qs: { event: 'conclude' },
			};
		case 'copy':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${courseId}/content_migrations`,
				body: {
					migration_type: 'course_copy_importer',
					settings: { source_course_id: getParam('sourceCourseId'), ...getParamObject('options') },
				},
			};
		case 'listStudents':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/students`,
				qs: getParamObject('options'),
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for course`);
	}
}

// ============================================
// Section
// ============================================

export function buildSectionRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const sectionId = getParam('sectionId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${courseId}/sections`,
				body: { course_section: { name: getParam('name'), ...getParamObject('additionalFields') } },
			};
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/sections/${sectionId}`,
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/sections/${sectionId}`,
				qs: getParamObject('options'),
			};
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/sections`,
				qs: getParamObject('options'),
			};
		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/sections/${sectionId}`,
				body: { course_section: getParamObject('updateFields') },
			};
		case 'crosslist': {
			const qs = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `/api/v1/sections/${sectionId}/crosslist/${getParam('newCourseId')}`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}
		case 'decrosslist': {
			const qs = getParamObject('options');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/sections/${sectionId}/crosslist`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for section`);
	}
}

// ============================================
// Tab
// ============================================

function getTabBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	const contextId = getParam('contextId');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${contextId}`;
		case 'account':
			return `/api/v1/accounts/${contextId}`;
		case 'group':
			return `/api/v1/groups/${contextId}`;
		case 'user':
			return `/api/v1/users/${contextId}`;
		default:
			throw new ApplicationError(`Unknown tab context type: ${contextType}`);
	}
}

export function buildTabRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getTabBasePath(getParam);

	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/tabs`,
				qs: getParamObject('options'),
			};
		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/tabs/${getParam('tabId')}`,
				body: getParamObject('updateFields'),
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for tab`);
	}
}

// ============================================
// Course Pace
// ============================================

export function buildCoursePaceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const coursePaceId = getParam('coursePaceId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${courseId}/course_pacing`,
				body: { course_pace: getParamObject('additionalFields') },
			};
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${courseId}/course_pacing/${coursePaceId}`,
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/course_pacing/${coursePaceId}`,
			};
		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${courseId}/course_pacing/${coursePaceId}`,
				body: { course_pace: getParamObject('updateFields') },
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for coursePace`);
	}
}

// ============================================
// Course Report
// ============================================

export function buildCourseReportRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const reportType = getParam('reportType');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${courseId}/reports/${reportType}`,
				body: getParamObject('options'),
			};
		case 'getStatus':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/reports/${reportType}/${getParam('reportId')}`,
			};
		case 'getLastStatus':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/reports/${reportType}`,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for courseReport`);
	}
}
