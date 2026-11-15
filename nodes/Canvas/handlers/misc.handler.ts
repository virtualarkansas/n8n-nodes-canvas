import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/**
 * A list option may arrive as an array (multi-select, or an expression that
 * resolves to an array) or as comma-separated text. Empty entries are dropped.
 */
function toList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

/**
 * An ID placed in the request path. Canvas accepts SIS IDs there (`sis_user_id:...`) and
 * those may contain characters that would otherwise end or split the path (`/`, `?`, `#`,
 * spaces, `%`). The value is the ID itself, never URL text, so it is always encoded;
 * the colon of the SIS prefix stays readable.
 */
function pathId(value: string): string {
	return encodeURIComponent(value.trim()).replace(/%3A/gi, ':');
}

/** True when an optional field was filled in (booleans and numbers count, '' does not). */
function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

// ============================================
// Bookmark
// ============================================

/**
 * Canvas stores a bookmark's `data` as JSON. The UI field holds JSON text, so parse
 * it and send the structure itself; sending the text would store one long string.
 */
function parseBookmarkData(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const text = value.trim();
	if (text === '') {
		return undefined;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new ApplicationError('Bookmark "Data" must be valid JSON, for example {"active_tab": 1}');
	}
}

export function buildBookmarkRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const bookmarkId = pathId(getParam('bookmarkId'));

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				name: getParam('name'),
				url: getParam('url'),
			};

			const data = parseBookmarkData(additionalFields.data);
			if (data !== undefined) {
				body.data = data;
			}
			if (isSet(additionalFields.position)) {
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
			const body: Record<string, unknown> = {};

			if (updateFields.name !== undefined) {
				body.name = updateFields.name;
			}
			if (updateFields.url !== undefined) {
				body.url = updateFields.url;
			}
			const data = parseBookmarkData(updateFields.data);
			if (data !== undefined) {
				body.data = data;
			}
			if (isSet(updateFields.position)) {
				body.position = updateFields.position;
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/bookmarks/${bookmarkId}`,
				body,
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
				endpoint: `/api/v1/eportfolios/${pathId(getParam('ePortfolioId'))}`,
			};

		case 'getAll': {
			const userId = pathId(getParam('userId'));
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			// Deleted ePortfolios are only listed for admins who may moderate user content.
			if (options.include === true) {
				qs.include = ['deleted'];
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/eportfolios`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getAllPages':
			return {
				method: 'GET',
				endpoint: `/api/v1/eportfolios/${pathId(getParam('ePortfolioId'))}/pages`,
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/eportfolios/${pathId(getParam('ePortfolioId'))}`,
			};

		case 'moderate':
			return {
				method: 'PUT',
				endpoint: `/api/v1/eportfolios/${pathId(getParam('ePortfolioId'))}/moderate`,
				body: { spam_status: getParam('spamStatus') },
			};

		case 'moderateAll':
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/${pathId(getParam('userId'))}/eportfolios`,
				body: { spam_status: getParam('spamStatus') },
			};

		case 'restore':
			return {
				method: 'PUT',
				endpoint: `/api/v1/eportfolios/${pathId(getParam('ePortfolioId'))}/restore`,
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
				endpoint: `/api/v1/users/self/favorites/courses/${pathId(getParam('courseId'))}`,
			};

		case 'removeCourse':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/users/self/favorites/courses/${pathId(getParam('courseId'))}`,
			};

		case 'getAllCourses': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.exclude_blueprint_courses !== undefined) {
				qs.exclude_blueprint_courses = options.exclude_blueprint_courses;
			}
			const include = toList(options.include);
			if (include.length > 0) {
				qs.include = include;
			}
			if (options.exclude_enrollments === true) {
				qs.exclude = ['enrollments'];
			}
			if (isSet(options.observed_user_id)) {
				qs.observed_user_id = String(options.observed_user_id).trim();
			}
			if (isSet(options.sort)) {
				qs.sort = options.sort;
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
				endpoint: `/api/v1/users/self/favorites/groups/${pathId(getParam('groupId'))}`,
			};

		case 'removeGroup':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/users/self/favorites/groups/${pathId(getParam('groupId'))}`,
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
		return `/api/v1/accounts/${pathId(getParam('accountId'))}`;
	}
	if (contextType === 'user') {
		return `/api/v1/users/${pathId(getParam('userId'))}`;
	}
	return `/api/v1/courses/${pathId(getParam('courseId'))}`;
}

/** Feature names are path segments; a stray space or slash must not change the route. */
function featureSegment(getParam: GetParam): string {
	return pathId(getParam('feature'));
}

export function buildFeatureFlagRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	// "Get Many Environment" has no context; do not read context parameters for it.
	if (operation === 'getAllEnvironment') {
		return {
			method: 'GET',
			endpoint: '/api/v1/features/environment',
		};
	}

	const basePath = getFeatureFlagBasePath(getParam);

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/features/flags/${featureSegment(getParam)}`,
			};

		case 'getAll': {
			const options = getParamObject('options');
			// Canvas pages through every feature definition and only then drops the ones the
			// caller may not see, so a page can hold fewer features than asked for, or none.
			// With small pages the default page cap would silently cut the list short; the
			// whole catalogue is a few dozen entries, so always ask for full pages.
			const qs: Record<string, unknown> = { per_page: 100 };

			if (options.hide_inherited_enabled !== undefined) {
				qs.hide_inherited_enabled = options.hide_inherited_enabled;
			}

			return {
				method: 'GET',
				endpoint: `${basePath}/features`,
				qs,
			};
		}

		case 'getAllEnabled':
			return {
				method: 'GET',
				endpoint: `${basePath}/features/enabled`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/features/flags/${featureSegment(getParam)}`,
				body: { state: getParam('state') },
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/features/flags/${featureSegment(getParam)}`,
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
			const qs: Record<string, unknown> = {};

			if (isSet(options.start_date)) {
				qs.start_date = options.start_date;
			}
			if (isSet(options.end_date)) {
				qs.end_date = options.end_date;
			}
			if (isSet(options.filter)) {
				qs.filter = options.filter;
			}
			if (isSet(options.observed_user_id)) {
				qs.observed_user_id = String(options.observed_user_id).trim();
			}
			const contextCodes = toList(options.context_codes);
			if (contextCodes.length > 0) {
				qs.context_codes = contextCodes;
			}
			const include = toList(options.include);
			if (include.length > 0) {
				qs.include = include;
			}
			if (isSet(options.order)) {
				qs.order = options.order;
			}

			// Another user's planner (an observer reading a linked student) has its own route.
			const userId = isSet(options.user_id) ? String(options.user_id).trim() : '';

			return {
				method: 'GET',
				endpoint: userId
					? `/api/v1/users/${pathId(userId)}/planner/items`
					: '/api/v1/planner/items',
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		// ----- Notes -----
		case 'createNote': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				todo_date: getParam('todoDate'),
			};

			// Without a title Canvas uses the title of the linked object, so only send one that was given.
			const title = getParam('title');
			if (title !== '') {
				body.title = title;
			}
			if (isSet(additionalFields.details)) {
				body.details = additionalFields.details;
			}
			if (isSet(additionalFields.course_id)) {
				body.course_id = String(additionalFields.course_id).trim();
			}
			if (isSet(additionalFields.linked_object_type)) {
				body.linked_object_type = additionalFields.linked_object_type;
			}
			if (isSet(additionalFields.linked_object_id)) {
				body.linked_object_id = String(additionalFields.linked_object_id).trim();
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
				endpoint: `/api/v1/planner_notes/${pathId(getParam('noteId'))}`,
			};

		case 'getAllNotes': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (isSet(options.start_date)) {
				qs.start_date = options.start_date;
			}
			if (isSet(options.end_date)) {
				qs.end_date = options.end_date;
			}
			const contextCodes = toList(options.context_codes);
			if (contextCodes.length > 0) {
				qs.context_codes = contextCodes;
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/planner_notes',
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'updateNote': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};

			if (updateFields.title !== undefined) {
				body.title = updateFields.title;
			}
			if (updateFields.details !== undefined) {
				body.details = updateFields.details;
			}
			if (updateFields.todo_date !== undefined) {
				body.todo_date = updateFields.todo_date;
			}
			// An empty course ID is meaningful: it detaches the note from its course.
			if (updateFields.course_id !== undefined) {
				body.course_id = String(updateFields.course_id ?? '').trim();
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/planner_notes/${pathId(getParam('noteId'))}`,
				body,
			};
		}

		case 'deleteNote':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/planner_notes/${pathId(getParam('noteId'))}`,
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
				endpoint: `/api/v1/planner/overrides/${pathId(getParam('overrideId'))}`,
			};

		case 'getAllOverrides':
			return {
				method: 'GET',
				endpoint: '/api/v1/planner/overrides',
			};

		case 'updateOverride': {
			const updateFields = getParamObject('updateFields');
			// Canvas rewrites both flags on every update and treats a missing one as false.
			// Send both so the request (and the debug output) shows what will be stored.
			return {
				method: 'PUT',
				endpoint: `/api/v1/planner/overrides/${pathId(getParam('overrideId'))}`,
				body: {
					marked_complete: updateFields.marked_complete === true,
					dismissed: updateFields.dismissed === true,
				},
			};
		}

		case 'deleteOverride':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/planner/overrides/${pathId(getParam('overrideId'))}`,
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
	const pollId = pathId(getParam('pollId'));

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const poll: Record<string, unknown> = {
				question: getParam('question'),
			};

			if (isSet(additionalFields.description)) {
				poll.description = additionalFields.description;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/polls',
				body: { polls: [poll] },
			};
		}

		// Canvas wraps every poll response in { "polls": [...] }.
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/polls/${pollId}`,
				dataKey: 'polls',
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/polls',
				dataKey: 'polls',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const poll: Record<string, unknown> = {};

			if (isSet(updateFields.question)) {
				poll.question = updateFields.question;
			}
			// An empty description is meaningful: it clears the text.
			if (updateFields.description !== undefined) {
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
