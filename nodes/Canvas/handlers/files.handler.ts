import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// FILE
// ============================================

/**
 * Resolves the base path for file context-based operations.
 * file contextType supports: course, user, group, folder
 */
function getFileContextBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'user':
			return `/api/v1/users/${getParam('userId', 'self')}`;
		case 'group':
			return `/api/v1/groups/${getParam('groupId')}`;
		case 'folder':
			return `/api/v1/folders/${getParam('folderId')}`;
		default:
			throw new ApplicationError(`Unknown file context type: ${contextType}`);
	}
}

export function handleFileResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/files/${getParam('fileId')}`,
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const basePath = getFileContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/files`,
				qs: getParamObject('options'),
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/files/${getParam('fileId')}`,
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/files/${getParam('fileId')}`,
				body: getParamObject('updateFields'),
			};

		case 'getQuota': {
			const basePath = getFileContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/files/quota`,
			};
		}

		case 'initiateUpload':
		case 'upload': {
			// Builds the Step 1 request config (notify Canvas, get upload URL).
			// For 'upload': processItem() in Canvas.node.ts orchestrates all three steps.
			// For 'initiateUpload': returns the Step 1 response directly.
			const basePath = getFileContextBasePath(getParam);
			const options = getParamObject('options');
			const body: Record<string, unknown> = {};

			if (options.name) {
				body.name = options.name;
			}
			if (options.content_type) {
				body.content_type = options.content_type;
			}
			if (options.parent_folder_id) {
				body.parent_folder_id = options.parent_folder_id;
			}
			if (options.parent_folder_path) {
				body.parent_folder_path = options.parent_folder_path;
			}
			if (options.on_duplicate) {
				body.on_duplicate = options.on_duplicate;
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/files`,
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for file`);
	}
}

// ============================================
// FOLDER
// ============================================

/**
 * Resolves the base path for folder context-based operations.
 * folder contextType supports: course, user, group, account, folder
 */
function getFolderContextBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'user':
			return `/api/v1/users/${getParam('userId', 'self')}`;
		case 'group':
			return `/api/v1/groups/${getParam('groupId')}`;
		case 'account':
			return `/api/v1/accounts/${getParam('accountId')}`;
		case 'folder':
			return `/api/v1/folders/${getParam('parentFolderId')}`;
		default:
			throw new ApplicationError(`Unknown folder context type: ${contextType}`);
	}
}

export function handleFolderResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const basePath = getFolderContextBasePath(getParam);
			return {
				method: 'POST',
				endpoint: `${basePath}/folders`,
				body: { name: getParam('name'), ...getParamObject('additionalFields') },
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/folders/${getParam('folderId')}`,
			};

		case 'getAll': {
			const basePath = getFolderContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/folders`,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/folders/${getParam('folderId')}`,
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/folders/${getParam('folderId')}`,
				body: getParamObject('updateFields'),
			};

		case 'copy':
			return {
				method: 'POST',
				endpoint: `/api/v1/folders/${getParam('destinationFolderId')}/copy_folder`,
				body: { source_folder_id: getParam('sourceFolderId') },
			};

		case 'getByPath': {
			const basePath = getFolderContextBasePath(getParam);
			const folderPath = getParam('folderPath');
			return {
				method: 'GET',
				endpoint: `${basePath}/folders/by_path/${folderPath}`,
			};
		}

		case 'listFiles':
			return {
				method: 'GET',
				endpoint: `/api/v1/folders/${getParam('folderId')}/files`,
				qs: getParamObject('options'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for folder`);
	}
}

// ============================================
// MEDIA OBJECT
// ============================================

/**
 * Resolves the base path for media object context-based operations.
 * mediaObject contextType supports: course, group, user
 */
function getMediaObjectContextBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'group':
			return `/api/v1/groups/${getParam('groupId')}`;
		case 'user':
			return '/api/v1';
		default:
			throw new ApplicationError(`Unknown media object context type: ${contextType}`);
	}
}

export function handleMediaObjectResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const basePath = getMediaObjectContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/media_objects`,
				qs: getParamObject('options'),
			};
		}

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/media_objects/${getParam('mediaObjectId')}`,
				body: { title: getParam('title') },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for mediaObject`);
	}
}
