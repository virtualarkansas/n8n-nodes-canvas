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

/** Query of the "list files" endpoints (shared by File > Get Many and Folder > List Files). */
function buildFileListQuery(options: Fields): Fields {
	const qs: Fields = { ...options };

	for (const key of ['content_types', 'exclude_content_types']) {
		if (key in qs) {
			const types = splitList(qs[key]);
			if (types.length > 0) {
				qs[key] = types;
			} else {
				delete qs[key];
			}
		}
	}

	// The API spells "only names" as only[]=names.
	if (qs.only_names === true) {
		qs.only = ['names'];
	}
	delete qs.only_names;

	return qs;
}

/** file_ids[] / folder_ids[] of the usage rights endpoints. */
function buildUsageRightsTargets(getParam: GetParam): Fields {
	const fileIds = splitList(getParam('fileIds'));
	const folderIds = splitList(getParam('folderIds'));
	if (fileIds.length === 0 && folderIds.length === 0) {
		throw new ApplicationError('At least one file ID or folder ID is required to change usage rights');
	}
	return {
		...(fileIds.length > 0 ? { file_ids: fileIds } : {}),
		...(folderIds.length > 0 ? { folder_ids: folderIds } : {}),
	};
}

export function handleFileResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'get': {
			const qs: Fields = getParamObject('options');
			// Canvas only follows the replacement chain for courses and needs both parameters.
			const chainCourseId = String(qs.replacement_chain_context_id ?? '').trim();
			delete qs.replacement_chain_context_type;
			if (chainCourseId) {
				qs.replacement_chain_context_id = chainCourseId;
				qs.replacement_chain_context_type = 'course';
			} else {
				delete qs.replacement_chain_context_id;
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/files/${getParam('fileId')}`,
				qs,
			};
		}

		case 'getAll': {
			const basePath = getFileContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/files`,
				qs: buildFileListQuery(getParamObject('options')),
			};
		}

		case 'delete': {
			const options = getParamObject('options');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/files/${getParam('fileId')}`,
				...(options.replace === true ? { qs: { replace: true } } : {}),
			};
		}

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/files/${getParam('fileId')}`,
				body: getParamObject('updateFields'),
			};

		case 'copy': {
			const options = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `/api/v1/folders/${getParam('destinationFolderId')}/copy_file`,
				body: {
					source_file_id: getParam('fileId'),
					...(options.on_duplicate ? { on_duplicate: options.on_duplicate } : {}),
				},
			};
		}

		case 'getPublicUrl': {
			const options = getParamObject('options');
			const submissionId = String(options.submission_id ?? '').trim();
			return {
				method: 'GET',
				endpoint: `/api/v1/files/${getParam('fileId')}/public_url`,
				...(submissionId ? { qs: { submission_id: submissionId } } : {}),
			};
		}

		case 'getQuota': {
			const basePath = getFileContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/files/quota`,
			};
		}

		case 'listLicenses': {
			const basePath = getFileContextBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_licenses`,
			};
		}

		case 'setUsageRights': {
			const basePath = getFileContextBasePath(getParam);
			const options = getParamObject('options');
			const usageRights: Fields = { use_justification: getParam('useJustification') };
			if (options.legal_copyright) {
				usageRights.legal_copyright = options.legal_copyright;
			}
			if (options.license) {
				usageRights.license = options.license;
			}
			return {
				method: 'PUT',
				endpoint: `${basePath}/usage_rights`,
				body: {
					...buildUsageRightsTargets(getParam),
					usage_rights: usageRights,
					...(options.publish === true ? { publish: true } : {}),
				},
			};
		}

		case 'removeUsageRights': {
			const basePath = getFileContextBasePath(getParam);
			return {
				method: 'DELETE',
				endpoint: `${basePath}/usage_rights`,
				qs: buildUsageRightsTargets(getParam),
			};
		}

		case 'initiateUpload':
		case 'upload': {
			// Builds the Step 1 request config (notify Canvas, get upload URL).
			// For 'upload': processItem() in Canvas.node.ts orchestrates all three steps and
			// fills in name, size and content type from the binary data.
			// For 'initiateUpload': returns the Step 1 response directly; what Canvas should
			// know about the file has to be given in the parameters.
			const basePath = getFileContextBasePath(getParam);
			const options = getParamObject('options');
			const body: Record<string, unknown> = {};

			const name = operation === 'initiateUpload' ? getParam('fileName') || options.name : options.name;
			if (name) {
				body.name = name;
			}
			if (options.content_type) {
				body.content_type = options.content_type;
			}
			if (operation === 'initiateUpload' && options.size !== undefined && options.size !== '') {
				body.size = options.size;
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

		case 'delete': {
			const options = getParamObject('options');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/folders/${getParam('folderId')}`,
				...(options.force === true ? { qs: { force: true } } : {}),
			};
		}

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
			// Folder names may contain spaces, non-ASCII characters, "#", "?" ...: encode each
			// segment. An empty path resolves to the root folder of the context.
			const segments = getParam('folderPath')
				.split('/')
				.map((segment) => segment.trim())
				.filter((segment) => segment !== '')
				.map((segment) => encodeURIComponent(segment));
			return {
				method: 'GET',
				endpoint: `${basePath}/folders/by_path${segments.length > 0 ? `/${segments.join('/')}` : ''}`,
			};
		}

		case 'listFiles':
			return {
				method: 'GET',
				endpoint: `/api/v1/folders/${getParam('folderId')}/files`,
				qs: buildFileListQuery(getParamObject('options')),
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
				// The parameter is called user_entered_title; "title" is ignored by Canvas.
				body: { user_entered_title: getParam('title') },
			};

		case 'listTracks':
			return {
				method: 'GET',
				endpoint: `/api/v1/media_objects/${getParam('mediaObjectId')}/media_tracks`,
				qs: getParamObject('options'),
			};

		case 'updateTracks': {
			const tracks = ((getParamObject('tracks').trackValues ?? []) as Fields[])
				.filter((track) => String(track.locale ?? '').trim() !== '')
				.map((track) => {
					const entry: Fields = { locale: String(track.locale).trim() };
					// A track without content keeps the captions Canvas already has for that language.
					if (track.content !== undefined && track.content !== '') {
						entry.content = track.content;
					}
					if (track.kind) {
						entry.kind = track.kind;
					}
					return entry;
				});
			if (tracks.length === 0) {
				throw new ApplicationError('At least one track is required for mediaObject updateTracks');
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/media_objects/${getParam('mediaObjectId')}/media_tracks`,
				qs: getParamObject('options'),
				// The endpoint takes a bare JSON array: the complete list of tracks to keep.
				body: tracks as unknown as Record<string, unknown>,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for mediaObject`);
	}
}
