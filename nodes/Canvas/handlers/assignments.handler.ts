import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// ASSIGNMENT
// ============================================

export function handleAssignmentResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments`,
				method: 'POST',
				body: { assignment: { name: getParam('name'), ...getParamObject('additionalFields') } },
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
				method: 'PUT',
				body: { assignment: getParamObject('updateFields') },
			};

		case 'duplicate':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/duplicate`,
				method: 'POST',
				body: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for assignment`);
	}
}

// ============================================
// ASSIGNMENT GROUP
// ============================================

export function handleAssignmentGroupResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentGroupId = getParam('assignmentGroupId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups`,
				method: 'POST',
				body: { name: getParam('name'), ...getParamObject('additionalFields') },
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`,
				method: 'DELETE',
				qs: getParamObject('options'),
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`,
				method: 'PUT',
				body: getParamObject('updateFields'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for assignmentGroup`);
	}
}

// ============================================
// ASSIGNMENT EXTENSION
// ============================================

export function handleAssignmentExtensionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'setExtensions': {
			const extensionsData = getParamObject('extensions');
			const extensionValues = (extensionsData.extensionValues as Array<{
				user_id: string;
				extra_attempts: number;
			}>) || [];

			if (extensionValues.length === 0) {
				throw new ApplicationError(
					'At least one extension entry is required for assignmentExtension setExtensions',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/extensions`,
				method: 'POST',
				body: {
					assignment_extensions: extensionValues,
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for assignmentExtension`);
	}
}
