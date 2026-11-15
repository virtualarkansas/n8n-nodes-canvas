import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/**
 * Split a comma-separated field into trimmed, non-empty entries.
 * Accepts what the UI and expressions produce: "1, 2", an array, or a single number.
 */
function toList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

/** Keep only the listed keys of a collection (options that do not apply to the chosen context are not sent). */
function pick(fields: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of keys) {
		if (fields[key] !== undefined) {
			out[key] = fields[key];
		}
	}
	return out;
}

// ============================================
// Group
// ============================================

/** A membership is addressed either by its own ID or by the member's user ID. */
function membershipPath(groupId: string, getParam: GetParam): string {
	if (getParam('membershipBy', 'user') === 'membership') {
		return `/api/v1/groups/${groupId}/memberships/${getParam('membershipId')}`;
	}
	return `/api/v1/groups/${groupId}/users/${getParam('userId')}`;
}

export function buildGroupRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const groupId = getParam('groupId');

	switch (operation) {
		case 'create': {
			const groupCategoryId = getParam('groupCategoryId');
			const body = { name: getParam('name'), ...getParamObject('additionalFields') };
			return {
				method: 'POST',
				// Without a category Canvas creates a community group in the root account.
				endpoint: groupCategoryId ? `/api/v1/group_categories/${groupCategoryId}/groups` : '/api/v1/groups',
				body,
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
			const options = getParamObject('options');

			switch (context) {
				case 'account':
					return {
						method: 'GET',
						endpoint: `/api/v1/accounts/${getParam('accountId')}/groups`,
						qs: pick(options, ['collaboration_state', 'include', 'only_own_groups']),
					};
				case 'course':
					return {
						method: 'GET',
						endpoint: `/api/v1/courses/${getParam('courseId')}/groups`,
						qs: pick(options, ['collaboration_state', 'include', 'only_own_groups']),
					};
				case 'self':
					return {
						method: 'GET',
						endpoint: '/api/v1/users/self/groups',
						qs: pick(options, ['context_type', 'include']),
					};
				default:
					throw new ApplicationError(`Unknown group context: ${context}`);
			}
		}

		case 'update': {
			const body = getParamObject('updateFields');
			if (body.members !== undefined) {
				const members = toList(body.members);
				if (members.length > 0) {
					body.members = members;
				} else {
					// An empty list would remove every member; that is what Remove Members is for.
					delete body.members;
				}
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/groups/${groupId}`,
				body,
			};
		}

		case 'invite':
			return {
				method: 'POST',
				endpoint: `/api/v1/groups/${groupId}/invite`,
				body: { invitees: toList(getParam('invitees')) },
			};

		case 'listUsers':
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}/users`,
				qs: getParamObject('options'),
			};

		case 'listMemberships':
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}/memberships`,
				qs: getParamObject('options'),
			};

		case 'getMembership':
			return {
				method: 'GET',
				endpoint: membershipPath(groupId, getParam),
			};

		case 'addMember':
			return {
				method: 'POST',
				endpoint: `/api/v1/groups/${groupId}/memberships`,
				body: { user_id: getParam('userId') },
			};

		case 'updateMembership': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};
			// "accepted" is the only state Canvas lets the API set.
			if (updateFields.accept === true) {
				body.workflow_state = 'accepted';
			}
			if (updateFields.moderator !== undefined) {
				body.moderator = updateFields.moderator;
			}
			return {
				method: 'PUT',
				endpoint: membershipPath(groupId, getParam),
				body,
			};
		}

		case 'removeMember':
			return {
				method: 'DELETE',
				endpoint: membershipPath(groupId, getParam),
			};

		case 'removeMembers': {
			const userIds = toList(getParam('userIds'));
			if (userIds.length === 0) {
				throw new ApplicationError('Enter at least one user ID to remove from the group');
			}
			return {
				method: 'DELETE',
				endpoint: `/api/v1/groups/${groupId}/users`,
				qs: { user_ids: userIds },
			};
		}

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
	const contextPath = (): string =>
		getParam('context') === 'account'
			? `/api/v1/accounts/${getParam('accountId')}/group_categories`
			: `/api/v1/courses/${getParam('courseId')}/group_categories`;

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: contextPath(),
				body: { name: getParam('name'), ...getParamObject('additionalFields') },
			};

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

		case 'getAll':
			return {
				method: 'GET',
				endpoint: contextPath(),
				qs: getParamObject('options'),
			};

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
				body: getParamObject('options'),
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
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${getCollaborationBasePath(getParam)}/collaborations/${getParam('collaborationId')}`,
				dataKey: 'collaboration',
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${getCollaborationBasePath(getParam)}/collaborations`,
			};

		case 'listMembers':
			return {
				method: 'GET',
				endpoint: `/api/v1/collaborations/${getParam('collaborationId')}/members`,
				qs: getParamObject('options'),
			};

		case 'listPotentialMembers':
			return {
				method: 'GET',
				endpoint: `${getCollaborationBasePath(getParam)}/potential_collaborators`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for collaboration`);
	}
}

// ============================================
// Conference
// ============================================

function getConferenceBasePath(getParam: GetParam): string {
	if (getParam('context') === 'group') {
		return `/api/v1/groups/${getParam('groupId')}/conferences`;
	}
	return `/api/v1/courses/${getParam('courseId')}/conferences`;
}

export function buildConferenceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: getConferenceBasePath(getParam),
				body: {
					web_conference: {
						title: getParam('title'),
						conference_type: getParam('conferenceType'),
						...getParamObject('additionalFields'),
					},
				},
			};

		// Canvas wraps both lists: { "conferences": [ ... ] }
		case 'getAll':
			return {
				method: 'GET',
				endpoint: getConferenceBasePath(getParam),
				dataKey: 'conferences',
			};

		case 'getAllForUser': {
			const qs = getParamObject('options');
			if (qs.state !== 'live') {
				delete qs.state;
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/conferences',
				qs,
				dataKey: 'conferences',
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for conference`);
	}
}
