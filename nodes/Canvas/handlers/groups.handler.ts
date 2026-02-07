import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Group
// ============================================

export function buildGroupRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const groupId = getParam('groupId');

	switch (operation) {
		case 'create': {
			const groupCategoryId = getParam('groupCategoryId');
			const additionalFields = getParamObject('additionalFields');

			if (groupCategoryId) {
				return {
					method: 'POST',
					endpoint: `/api/v1/group_categories/${groupCategoryId}/groups`,
					body: { name: getParam('name'), ...additionalFields },
				};
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/groups',
				body: { name: getParam('name'), ...additionalFields },
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/groups/${groupId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}`,
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const context = getParam('context');
			let endpoint: string;

			switch (context) {
				case 'account':
					endpoint = `/api/v1/accounts/${getParam('accountId')}/groups`;
					break;
				case 'course':
					endpoint = `/api/v1/courses/${getParam('courseId')}/groups`;
					break;
				case 'self':
					endpoint = '/api/v1/users/self/groups';
					break;
				default:
					throw new ApplicationError(`Unknown group context: ${context}`);
			}

			return {
				method: 'GET',
				endpoint,
				qs: getParamObject('options'),
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};

			if (updateFields.members) {
				const membersStr = updateFields.members as string;
				body.members = membersStr.split(',').map((id) => id.trim());
				delete updateFields.members;
			}

			Object.assign(body, updateFields);

			return {
				method: 'PUT',
				endpoint: `/api/v1/groups/${groupId}`,
				body,
			};
		}

		case 'invite': {
			const inviteesStr = getParam('invitees');
			const invitees = inviteesStr.split(',').map((email) => email.trim());

			return {
				method: 'POST',
				endpoint: `/api/v1/groups/${groupId}/invite`,
				body: { invitees },
			};
		}

		case 'listUsers':
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}/users`,
				qs: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for group`);
	}
}

// ============================================
// Group Category
// ============================================

export function buildGroupCategoryRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const groupCategoryId = getParam('groupCategoryId');

	switch (operation) {
		case 'create': {
			const context = getParam('context');
			let endpoint: string;

			if (context === 'account') {
				endpoint = `/api/v1/accounts/${getParam('accountId')}/group_categories`;
			} else {
				endpoint = `/api/v1/courses/${getParam('courseId')}/group_categories`;
			}

			return {
				method: 'POST',
				endpoint,
				body: { name: getParam('name'), ...getParamObject('additionalFields') },
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/group_categories/${groupCategoryId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/group_categories/${groupCategoryId}`,
			};

		case 'getAll': {
			const context = getParam('context');
			let endpoint: string;

			if (context === 'account') {
				endpoint = `/api/v1/accounts/${getParam('accountId')}/group_categories`;
			} else {
				endpoint = `/api/v1/courses/${getParam('courseId')}/group_categories`;
			}

			return {
				method: 'GET',
				endpoint,
				qs: getParamObject('options'),
			};
		}

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/group_categories/${groupCategoryId}`,
				body: getParamObject('updateFields'),
			};

		case 'listGroups':
			return {
				method: 'GET',
				endpoint: `/api/v1/group_categories/${groupCategoryId}/groups`,
			};

		case 'listUsers':
			return {
				method: 'GET',
				endpoint: `/api/v1/group_categories/${groupCategoryId}/users`,
				qs: getParamObject('options'),
			};

		case 'assignUnassignedMembers':
			return {
				method: 'POST',
				endpoint: `/api/v1/group_categories/${groupCategoryId}/assign_unassigned_members`,
				qs: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for groupCategory`);
	}
}

// ============================================
// Collaboration
// ============================================

function getCollaborationBasePath(getParam: GetParam): string {
	const context = getParam('context');
	if (context === 'group') {
		return `/api/v1/groups/${getParam('groupId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

export function buildCollaborationRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const basePath = getCollaborationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/collaborations`,
			};
		}

		case 'listMembers':
			return {
				method: 'GET',
				endpoint: `/api/v1/collaborations/${getParam('collaborationId')}/members`,
				qs: getParamObject('options'),
			};

		case 'listPotentialMembers': {
			const basePath = getCollaborationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/potential_collaborators`,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for collaboration`);
	}
}

// ============================================
// Conference
// ============================================

export function buildConferenceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const context = getParam('context');
			let endpoint: string;

			if (context === 'group') {
				endpoint = `/api/v1/groups/${getParam('groupId')}/conferences`;
			} else {
				endpoint = `/api/v1/courses/${getParam('courseId')}/conferences`;
			}

			return {
				method: 'GET',
				endpoint,
			};
		}

		case 'getAllForUser':
			return {
				method: 'GET',
				endpoint: '/api/v1/conferences',
				qs: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for conference`);
	}
}
