import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

type Fields = Record<string, unknown>;

/**
 * Turn a comma-separated string (or an array coming from an expression) into
 * a list of trimmed, non-empty strings. Canvas expects real arrays for
 * parameters documented as `name[]`.
 */
function splitList(value: unknown): string[] {
	const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

// ============================================
// MODULE
// ============================================

export function handleModuleResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const moduleId = getParam('moduleId');

	switch (operation) {
		case 'create': {
			const module: Fields = { name: getParam('name'), ...getParamObject('additionalFields') };
			if ('prerequisite_module_ids' in module) {
				// module[prerequisite_module_ids][] must be an array; Canvas fails on a plain string.
				const ids = splitList(module.prerequisite_module_ids);
				if (ids.length > 0) {
					module.prerequisite_module_ids = ids;
				} else {
					delete module.prerequisite_module_ids;
				}
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/modules`,
				method: 'POST',
				body: { module },
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update': {
			const module: Fields = getParamObject('updateFields');
			if ('prerequisite_module_ids' in module) {
				// An empty value removes all prerequisites (Canvas treats a blank value as "none").
				const ids = splitList(module.prerequisite_module_ids);
				module.prerequisite_module_ids = ids.length > 0 ? ids : '';
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}`,
				method: 'PUT',
				body: { module },
			};
		}

		case 'listItems':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'relock':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/relock`,
				method: 'PUT',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for module`);
	}
}

// ============================================
// MODULE ITEM
// ============================================

/**
 * The UI offers the completion requirement as two flat fields; Canvas wants
 * `module_item[completion_requirement][type]` / `[min_score]`.
 * Type "none" removes an existing requirement (Canvas clears it on a blank value).
 */
function nestCompletionRequirement(fields: Fields, allowRemoval: boolean): void {
	const type = fields.completion_requirement_type as string | undefined;
	const minScore = fields.completion_requirement_min_score as number | undefined;
	delete fields.completion_requirement_type;
	delete fields.completion_requirement_min_score;

	if (type === 'none') {
		if (allowRemoval) {
			fields.completion_requirement = '';
		}
		return;
	}
	if (type === 'min_score' || (!type && minScore !== undefined)) {
		fields.completion_requirement = { type: 'min_score', min_score: minScore ?? 0 };
		return;
	}
	if (type) {
		fields.completion_requirement = { type };
	}
}

export function handleModuleItemResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const moduleId = getParam('moduleId');
	const itemId = getParam('itemId');

	switch (operation) {
		case 'create': {
			const type = getParam('type');
			const itemBody: Fields = { type, ...getParamObject('additionalFields') };
			nestCompletionRequirement(itemBody, false);

			// Include the correct identifier based on item type
			if (type === 'Page') {
				itemBody.page_url = getParam('pageUrl');
			} else if (['File', 'Discussion', 'Assignment', 'Quiz'].includes(type)) {
				itemBody.content_id = getParam('contentId');
			} else if (['ExternalUrl', 'ExternalTool'].includes(type)) {
				itemBody.external_url = getParam('externalUrl');
				itemBody.title = getParam('title');
			} else if (type === 'SubHeader') {
				itemBody.title = getParam('title');
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items`,
				method: 'POST',
				body: { module_item: itemBody },
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`,
				method: 'DELETE',
			};

		case 'duplicate':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/items/${itemId}/duplicate`,
				method: 'POST',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getSequence':
			return {
				endpoint: `/api/v1/courses/${courseId}/module_item_sequence`,
				method: 'GET',
				qs: { asset_type: getParam('assetType'), asset_id: getParam('assetId') },
			};

		case 'update': {
			const itemBody: Fields = getParamObject('updateFields');
			nestCompletionRequirement(itemBody, true);
			if (typeof itemBody.new_tab === 'boolean') {
				// Canvas only looks at new_tab when the value is truthy, so a JSON `false` is
				// skipped; the string "false" is read as intended.
				itemBody.new_tab = String(itemBody.new_tab);
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`,
				method: 'PUT',
				body: { module_item: itemBody },
			};
		}

		case 'markDone':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}/done`,
				method: 'PUT',
			};

		case 'markNotDone':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}/done`,
				method: 'DELETE',
			};

		case 'markRead':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}/mark_read`,
				method: 'POST',
			};

		case 'selectMasteryPath':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}/select_mastery_path`,
				method: 'POST',
				body: { assignment_set_id: getParam('assignmentSetId') },
				qs: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for moduleItem`);
	}
}

// ============================================
// PAGE
// ============================================

/**
 * Pages live in courses and in groups; both expose the same endpoints
 * (except duplicating a page, which is course-only).
 */
function getPageContextBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType', 'course');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'group':
			return `/api/v1/groups/${getParam('groupId')}`;
		default:
			throw new ApplicationError(`Unknown page context type: ${contextType}`);
	}
}

/**
 * `wiki_page[editing_roles]` is a comma-separated string; a JSON array is
 * silently dropped by Canvas.
 */
function normalizePageFields(fields: Fields): Fields {
	if ('editing_roles' in fields) {
		fields.editing_roles = splitList(fields.editing_roles).join(',');
	}
	return fields;
}

export function handlePageResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getPageContextBasePath(getParam);
	// Page URLs are slugs that may contain non-ASCII letters; `page_id:<id>` is accepted as well.
	const pageUrl = encodeURIComponent(getParam('pageUrl'));

	switch (operation) {
		case 'create':
			return {
				endpoint: `${basePath}/pages`,
				method: 'POST',
				body: {
					wiki_page: normalizePageFields({
						title: getParam('title'),
						...getParamObject('additionalFields'),
					}),
				},
			};

		case 'delete':
			return {
				endpoint: `${basePath}/pages/${pageUrl}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `${basePath}/pages/${pageUrl}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `${basePath}/pages`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getFrontPage':
			return {
				endpoint: `${basePath}/front_page`,
				method: 'GET',
			};

		case 'update':
			return {
				endpoint: `${basePath}/pages/${pageUrl}`,
				method: 'PUT',
				body: { wiki_page: normalizePageFields(getParamObject('updateFields')) },
			};

		case 'updateFrontPage':
			return {
				endpoint: `${basePath}/front_page`,
				method: 'PUT',
				body: { wiki_page: normalizePageFields(getParamObject('updateFields')) },
			};

		case 'duplicate':
			return {
				endpoint: `/api/v1/courses/${getParam('courseId')}/pages/${pageUrl}/duplicate`,
				method: 'POST',
			};

		case 'listRevisions':
			return {
				endpoint: `${basePath}/pages/${pageUrl}/revisions`,
				method: 'GET',
			};

		case 'getRevision': {
			// Empty or "latest" returns the current revision.
			const revisionId = getParam('revisionId', 'latest');
			return {
				endpoint: `${basePath}/pages/${pageUrl}/revisions/${encodeURIComponent(revisionId)}`,
				method: 'GET',
				qs: getParamObject('options'),
			};
		}

		case 'revert': {
			const revisionId = getParam('revisionId');
			return {
				endpoint: `${basePath}/pages/${pageUrl}/revisions/${revisionId}`,
				method: 'POST',
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for page`);
	}
}
