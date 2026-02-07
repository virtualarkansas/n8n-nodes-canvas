import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Enrollment
// ============================================

export function buildEnrollmentRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const listBy = getParam('listBy');
			let endpoint: string;

			switch (listBy) {
				case 'course':
					endpoint = `/api/v1/courses/${getParam('courseId')}/enrollments`;
					break;
				case 'section':
					endpoint = `/api/v1/sections/${getParam('sectionId')}/enrollments`;
					break;
				case 'user':
					endpoint = `/api/v1/users/${getParam('userId')}/enrollments`;
					break;
				default:
					throw new ApplicationError(`Unknown enrollment listBy value: ${listBy}`);
			}

			return {
				method: 'GET',
				endpoint,
				qs: getParamObject('filters'),
			};
		}
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/enrollments`,
				body: {
					enrollment: {
						user_id: getParam('userId'),
						type: getParam('enrollmentType'),
						...getParamObject('additionalFields'),
					},
				},
			};
		case 'conclude':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${getParam('courseId')}/enrollments/${getParam('enrollmentId')}`,
				qs: { task: 'conclude' },
			};
		case 'deactivate':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${getParam('courseId')}/enrollments/${getParam('enrollmentId')}`,
				qs: { task: 'deactivate' },
			};
		case 'reactivate':
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${getParam('courseId')}/enrollments/${getParam('enrollmentId')}/reactivate`,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for enrollment`);
	}
}

// ============================================
// Enrollment Term
// ============================================

function buildEnrollmentTermOverrides(getParamObject: GetParamObject): Record<string, object> | undefined {
	const overridesData = getParamObject('overrides');
	const overrideItems = overridesData.override as Array<{
		enrollmentType: string;
		startAt?: string;
		endAt?: string;
	}> | undefined;

	if (!overrideItems || overrideItems.length === 0) {
		return undefined;
	}

	const overrides: Record<string, object> = {};
	for (const item of overrideItems) {
		const override: Record<string, string> = {};
		if (item.startAt) {
			override.start_at = item.startAt;
		}
		if (item.endAt) {
			override.end_at = item.endAt;
		}
		overrides[item.enrollmentType] = override;
	}

	return overrides;
}

export function buildEnrollmentTermRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/terms`,
				qs: getParamObject('filters'),
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/terms/${getParam('termId')}`,
			};
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const overrides = buildEnrollmentTermOverrides(getParamObject);

			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/terms`,
				body: {
					enrollment_term: {
						name: getParam('name'),
						...additionalFields,
						...(overrides ? { overrides } : {}),
					},
				},
			};
		}
		case 'update': {
			const updateFields = getParamObject('updateFields');
			const overrides = buildEnrollmentTermOverrides(getParamObject);

			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/terms/${getParam('termId')}`,
				body: {
					enrollment_term: {
						...updateFields,
						...(overrides ? { overrides } : {}),
					},
				},
			};
		}
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/terms/${getParam('termId')}`,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for enrollmentTerm`);
	}
}
