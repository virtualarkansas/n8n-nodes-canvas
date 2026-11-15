import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { collectionRows, isBlankOrWhitespace, pickDefined, takeKeys, toList } from './shared';

/**
 * A CSV import file. Canvas reads it from the request body itself, so it is handed to the
 * request layer as the body: the text as it is, or the content of a binary property.
 * No `extension` argument: with it Canvas loses the uploaded body.
 */
function csvImportBody(getParam: GetParam): Pick<IRequestConfig, 'body' | 'contentType' | 'binaryBody'> {
	if (getParam('fileSource', 'binaryData') === 'binaryData') {
		return {
			binaryBody: {
				propertyName: getParam('binaryPropertyName', 'data'),
				// Canvas only reads CSV here, whatever type the file claims to have.
				prepare: () => ({ contentType: 'text/csv' }),
			},
		};
	}
	const content = getParam('fileContent');
	if (content.trim() === '') {
		throw new ApplicationError('File Content is empty. Enter the CSV text to import, including its header row.');
	}
	return { body: content, contentType: 'text/csv' };
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
						qs: pickDefined(options, ['collaboration_state', 'include', 'only_own_groups']),
					};
				case 'course':
					return {
						method: 'GET',
						endpoint: `/api/v1/courses/${getParam('courseId')}/groups`,
						qs: pickDefined(options, ['collaboration_state', 'include', 'only_own_groups']),
					};
				case 'self':
					return {
						method: 'GET',
						endpoint: '/api/v1/users/self/groups',
						qs: pickDefined(options, ['context_type', 'include']),
					};
				default:
					throw new ApplicationError(`Unknown group context: ${context}`);
			}
		}

		case 'update': {
			const body = getParamObject('updateFields');
			// A request-level argument in Canvas, not an attribute of the group. It goes into the
			// query string: Canvas treats a JSON `false` in the body as "not given".
			const qs = takeKeys(body, ['override_sis_stickiness']);
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
				...(Object.keys(qs).length > 0 ? { qs } : {}),
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

		case 'getActivityStream':
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}/activity_stream`,
			};

		case 'getActivityStreamSummary':
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}/activity_stream/summary`,
			};

		case 'getPermissions': {
			// Without names Canvas reports every right of the caller in the group.
			const permissions = toList(getParam('permissions'));
			return {
				method: 'GET',
				endpoint: `/api/v1/groups/${groupId}/permissions`,
				...(permissions.length > 0 ? { qs: { permissions } } : {}),
			};
		}

		case 'previewHtml':
			return {
				method: 'POST',
				endpoint: `/api/v1/groups/${groupId}/preview_html`,
				body: { html: getParam('html') },
			};

		case 'getUserDifferentiationTags': {
			const userIds = toList(getParam('userIds'));
			if (userIds.length === 0) {
				throw new ApplicationError('Enter at least one user ID to look up differentiation tags for');
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/bulk_user_tags`,
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

		// Canvas answers with CSV text, not JSON.
		case 'export':
			return {
				method: 'GET',
				endpoint: `/api/v1/group_categories/${groupCategoryId}/export`,
				singlePage: true,
				responseFile: { fileName: `group_category_${groupCategoryId}.csv`, mimeType: 'text/csv' },
			};

		case 'import':
			return {
				method: 'POST',
				endpoint: `/api/v1/group_categories/${groupCategoryId}/import`,
				...csvImportBody(getParam),
			};

		case 'exportDifferentiationTags':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/group_categories/export_tags`,
				singlePage: true,
				responseFile: { fileName: `differentiation_tags_course_${getParam('courseId')}.csv`, mimeType: 'text/csv' },
			};

		case 'importDifferentiationTags':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/group_categories/import_tags`,
				...csvImportBody(getParam),
			};

		case 'bulkManageDifferentiationTags': {
			const create = collectionRows(getParamObject('tagsToCreate'), 'tags')
				.filter((row) => !isBlankOrWhitespace(row.name))
				.map((row) => ({ name: String(row.name) }));
			const update = collectionRows(getParamObject('tagsToRename'), 'tags')
				.filter((row) => !isBlankOrWhitespace(row.id) && !isBlankOrWhitespace(row.name))
				.map((row) => ({ id: String(row.id).trim(), name: String(row.name) }));
			const remove = toList(getParam('tagIdsToDelete')).map((id) => ({ id }));

			const tagSet: Record<string, unknown> = {};
			if (!isBlankOrWhitespace(groupCategoryId)) {
				tagSet.id = groupCategoryId;
			}
			const tagSetName = getParam('tagSetName');
			if (!isBlankOrWhitespace(tagSetName)) {
				tagSet.name = tagSetName;
			}
			if (Object.keys(tagSet).length === 0) {
				throw new ApplicationError(
					'Enter the Tag Set ID of an existing set of differentiation tags, or a Tag Set Name to create a new one',
				);
			}
			if (create.length + update.length + remove.length === 0) {
				throw new ApplicationError('Enter at least one tag to create, rename or delete');
			}

			// Canvas needs the `operations` object to hold something; it reads missing lists as empty.
			const operations: Record<string, unknown> = {};
			if (create.length > 0) {
				operations.create = create;
			}
			if (update.length > 0) {
				operations.update = update;
			}
			if (remove.length > 0) {
				operations.delete = remove;
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/group_categories/bulk_manage_differentiation_tag`,
				body: { operations, group_category: tagSet },
			};
		}

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
