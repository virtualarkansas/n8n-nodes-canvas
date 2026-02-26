import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Bookmark
// ============================================

export function buildBookmarkRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const bookmarkId = getParam('bookmarkId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				name: getParam('name'),
				url: getParam('url'),
			};

			if (additionalFields.data) {
				body.data = additionalFields.data;
			}
			if (additionalFields.position !== undefined) {
				body.position = additionalFields.position;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/users/self/bookmarks',
				body,
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/users/self/bookmarks/${bookmarkId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/users/self/bookmarks',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/bookmarks/${bookmarkId}`,
				body: updateFields,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/users/self/bookmarks/${bookmarkId}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for bookmark`);
	}
}

// ============================================
// ePortfolio
// ============================================

export function buildEPortfolioRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/eportfolios/${getParam('ePortfolioId')}`,
			};

		case 'getAll': {
			const userId = getParam('userId');
			const options = getParamObject('options');

			// Convert boolean include flag to array value for bracket notation
			if (options.include !== undefined) {
				options.include = ['deleted'];
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/eportfolios`,
				qs: options,
			};
		}

		case 'getAllPages':
			return {
				method: 'GET',
				endpoint: `/api/v1/eportfolios/${getParam('ePortfolioId')}/pages`,
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/eportfolios/${getParam('ePortfolioId')}`,
			};

		case 'moderate': {
			const ePortfolioId = getParam('ePortfolioId');
			const spamStatus = getParam('spamStatus');
			return {
				method: 'PUT',
				endpoint: `/api/v1/eportfolios/${ePortfolioId}/moderate/${spamStatus}`,
			};
		}

		case 'moderateAll': {
			const userId = getParam('userId');
			const spamStatus = getParam('spamStatus');
			return {
				method: 'PUT',
				endpoint: `/api/v1/eportfolios/moderate_all`,
				body: {
					user_id: userId,
					spam_status: spamStatus,
				},
			};
		}

		case 'restore':
			return {
				method: 'PUT',
				endpoint: `/api/v1/eportfolios/${getParam('ePortfolioId')}`,
				body: { eportfolio: { deleted: false } },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for ePortfolio`);
	}
}

// ============================================
// Favorite
// ============================================

export function buildFavoriteRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'addCourse':
			return {
				method: 'POST',
				endpoint: `/api/v1/users/self/favorites/courses/${getParam('courseId')}`,
			};

		case 'removeCourse':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/users/self/favorites/courses/${getParam('courseId')}`,
			};

		case 'getAllCourses': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.exclude_blueprint_courses !== undefined) {
				qs.exclude_blueprint_courses = options.exclude_blueprint_courses;
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/users/self/favorites/courses',
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'addGroup':
			return {
				method: 'POST',
				endpoint: `/api/v1/users/self/favorites/groups/${getParam('groupId')}`,
			};

		case 'removeGroup':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/users/self/favorites/groups/${getParam('groupId')}`,
			};

		case 'getAllGroups':
			return {
				method: 'GET',
				endpoint: '/api/v1/users/self/favorites/groups',
			};

		case 'resetCourses':
			return {
				method: 'DELETE',
				endpoint: '/api/v1/users/self/favorites/courses',
			};

		case 'resetGroups':
			return {
				method: 'DELETE',
				endpoint: '/api/v1/users/self/favorites/groups',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for favorite`);
	}
}

// ============================================
// Feature Flag
// ============================================

function getFeatureFlagBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	if (contextType === 'account') {
		return `/api/v1/accounts/${getParam('accountId')}`;
	}
	if (contextType === 'user') {
		return `/api/v1/users/${getParam('userId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

export function buildFeatureFlagRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getFeatureFlagBasePath(getParam);

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/features/flags/${getParam('feature')}`,
			};

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.hide_inherited_enabled !== undefined) {
				qs.hide_inherited_enabled = options.hide_inherited_enabled;
			}

			return {
				method: 'GET',
				endpoint: `${basePath}/features`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getAllEnabled':
			return {
				method: 'GET',
				endpoint: `${basePath}/features/enabled`,
			};

		case 'getAllEnvironment':
			return {
				method: 'GET',
				endpoint: '/api/v1/features/environment',
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/features/flags/${getParam('feature')}`,
				body: { state: getParam('state') },
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/features/flags/${getParam('feature')}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for featureFlag`);
	}
}

// ============================================
// Planner
// ============================================

export function buildPlannerRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		// ----- Items -----
		case 'getAllItems': {
			const options = getParamObject('options');

			// Convert CSV context_codes to array for bracket notation
			if (options.context_codes && typeof options.context_codes === 'string') {
				options.context_codes = (options.context_codes as string).split(',').map((code) => code.trim());
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/planner/items',
				qs: options,
			};
		}

		// ----- Notes -----
		case 'createNote': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				title: getParam('title'),
				todo_date: getParam('todoDate'),
			};

			if (additionalFields.details) {
				body.details = additionalFields.details;
			}
			if (additionalFields.course_id) {
				body.course_id = additionalFields.course_id;
			}
			if (additionalFields.linked_object_type) {
				body.linked_object_type = additionalFields.linked_object_type;
			}
			if (additionalFields.linked_object_id) {
				body.linked_object_id = additionalFields.linked_object_id;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/planner_notes',
				body,
			};
		}

		case 'getNote':
			return {
				method: 'GET',
				endpoint: `/api/v1/planner_notes/${getParam('noteId')}`,
			};

		case 'getAllNotes': {
			const options = getParamObject('options');

			// Convert CSV context_codes to array for bracket notation
			if (options.context_codes && typeof options.context_codes === 'string') {
				options.context_codes = (options.context_codes as string).split(',').map((code) => code.trim());
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/planner_notes',
				qs: options,
			};
		}

		case 'updateNote': {
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `/api/v1/planner_notes/${getParam('noteId')}`,
				body: updateFields,
			};
		}

		case 'deleteNote':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/planner_notes/${getParam('noteId')}`,
			};

		// ----- Overrides -----
		case 'createOverride': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				plannable_type: getParam('plannableType'),
				plannable_id: getParam('plannableId'),
			};

			if (additionalFields.marked_complete !== undefined) {
				body.marked_complete = additionalFields.marked_complete;
			}
			if (additionalFields.dismissed !== undefined) {
				body.dismissed = additionalFields.dismissed;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/planner/overrides',
				body,
			};
		}

		case 'getOverride':
			return {
				method: 'GET',
				endpoint: `/api/v1/planner/overrides/${getParam('overrideId')}`,
			};

		case 'getAllOverrides':
			return {
				method: 'GET',
				endpoint: '/api/v1/planner/overrides',
			};

		case 'updateOverride': {
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `/api/v1/planner/overrides/${getParam('overrideId')}`,
				body: updateFields,
			};
		}

		case 'deleteOverride':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/planner/overrides/${getParam('overrideId')}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for planner`);
	}
}

// ============================================
// Poll
// ============================================

export function buildPollRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const pollId = getParam('pollId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const poll: Record<string, unknown> = {
				question: getParam('question'),
			};

			if (additionalFields.description) {
				poll.description = additionalFields.description;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/polls',
				body: { polls: [poll] },
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/polls/${pollId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/polls',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const poll: Record<string, unknown> = {};

			if (updateFields.question) {
				poll.question = updateFields.question;
			}
			if (updateFields.description) {
				poll.description = updateFields.description;
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/polls/${pollId}`,
				body: { polls: [poll] },
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/polls/${pollId}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for poll`);
	}
}
