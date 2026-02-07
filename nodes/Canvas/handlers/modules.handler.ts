import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

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
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules`,
				method: 'POST',
				body: { module: { name: getParam('name'), ...getParamObject('additionalFields') } },
			};

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

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}`,
				method: 'PUT',
				body: { module: getParamObject('updateFields') },
			};

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
			const itemBody: IDataObject = { type, ...getParamObject('additionalFields') };

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

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`,
				method: 'PUT',
				body: { module_item: getParamObject('updateFields') },
			};

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

export function handlePageResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const pageUrl = getParam('pageUrl');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages`,
				method: 'POST',
				body: { wiki_page: { title: getParam('title'), ...getParamObject('additionalFields') } },
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages/${pageUrl}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages/${pageUrl}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages/${pageUrl}`,
				method: 'PUT',
				body: { wiki_page: getParamObject('updateFields') },
			};

		case 'duplicate':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages/${pageUrl}/duplicate`,
				method: 'POST',
			};

		case 'listRevisions':
			return {
				endpoint: `/api/v1/courses/${courseId}/pages/${pageUrl}/revisions`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'revert': {
			const revisionId = getParam('revisionId');
			return {
				endpoint: `/api/v1/courses/${courseId}/pages/${pageUrl}/revisions/${revisionId}`,
				method: 'POST',
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for page`);
	}
}
