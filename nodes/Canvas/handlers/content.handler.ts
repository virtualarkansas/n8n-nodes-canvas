import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// CONTENT EXPORT
// ============================================

/**
 * Resolves the base path for content export context-based operations.
 * contentExport contextType supports: course, group, user
 */
function getContentExportBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType', 'course');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'group':
			return `/api/v1/groups/${getParam('groupId')}`;
		case 'user':
			return `/api/v1/users/${getParam('userId', 'self')}`;
		default:
			throw new ApplicationError(`Unknown content export context type: ${contextType}`);
	}
}

export function handleContentExportResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getContentExportBasePath(getParam);

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				export_type: getParam('exportType'),
			};

			// Handle selective content export fields (select_*)
			for (const [key, value] of Object.entries(additionalFields)) {
				if (key.startsWith('select_') && typeof value === 'string' && value) {
					body[key] = (value as string).split(',').map((id) => id.trim());
				} else {
					body[key] = value;
				}
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/content_exports`,
				body,
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/content_exports/${getParam('contentExportId')}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/content_exports`,
			};

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for contentExport`,
			);
	}
}

// ============================================
// CONTENT MIGRATION
// ============================================

/**
 * Resolves the base path for content migration context-based operations.
 * contentMigration contextType supports: course, account, group, user
 */
function getContentMigrationBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType', 'course');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'account':
			return `/api/v1/accounts/${getParam('accountId')}`;
		case 'group':
			return `/api/v1/groups/${getParam('groupId')}`;
		case 'user':
			return `/api/v1/users/${getParam('userId', 'self')}`;
		default:
			throw new ApplicationError(`Unknown content migration context type: ${contextType}`);
	}
}

export function handleContentMigrationResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const basePath = getContentMigrationBasePath(getParam);
			const additionalFields = getParamObject('additionalFields');
			const migrationType = getParam('migrationType');

			const body: Record<string, unknown> = {
				migration_type: migrationType,
			};

			// For course_copy_importer, include the source course ID
			if (migrationType === 'course_copy_importer') {
				body.settings = { source_course_id: getParam('sourceCourseId') };
			}

			// Handle date_shift_options fields (nested under date_shift_options in the API)
			const dateShiftOptions: Record<string, unknown> = {};
			const regularFields: Record<string, unknown> = {};

			for (const [key, value] of Object.entries(additionalFields)) {
				if (key.startsWith('date_shift_options_')) {
					const subKey = key.replace('date_shift_options_', '');
					dateShiftOptions[subKey] = value;
				} else {
					regularFields[key] = value;
				}
			}

			if (Object.keys(dateShiftOptions).length > 0) {
				body.date_shift_options = dateShiftOptions;
			}

			// Merge remaining additional fields into body
			Object.assign(body, regularFields);

			return {
				method: 'POST',
				endpoint: `${basePath}/content_migrations`,
				body,
			};
		}

		case 'get': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}`,
			};
		}

		case 'getAll': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations`,
			};
		}

		case 'getAssetIdMapping': {
			// Asset ID mapping is only available for courses
			const courseId = getParam('courseId');
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/content_migrations/${getParam('contentMigrationId')}/asset_id_mapping`,
			};
		}

		case 'getSelectiveData': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}/content_list`,
			};
		}

		case 'listMigrators': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations/migrators`,
			};
		}

		case 'update': {
			const basePath = getContentMigrationBasePath(getParam);
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}`,
				body: updateFields,
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for contentMigration`,
			);
	}
}

// ============================================
// CONTENT SHARE
// ============================================

export function handleContentShareResource(
	operation: string,
	getParam: GetParam,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_getParamObject: GetParamObject,
): IRequestConfig {
	const userId = getParam('userId', 'self');
	const base = `/api/v1/users/${userId}/content_shares`;

	switch (operation) {
		case 'create': {
			const receiverIds = getParam('receiverIds')
				.split(',')
				.map((id) => id.trim());

			return {
				method: 'POST',
				endpoint: base,
				body: {
					content_type: getParam('contentType'),
					content_id: getParam('contentId'),
					'receiver_ids[]': receiverIds,
				},
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `${base}/${getParam('contentShareId')}`,
			};

		case 'getAll': {
			const shareType = getParam('shareType', 'received');
			return {
				method: 'GET',
				endpoint: `${base}/${shareType}`,
			};
		}

		case 'getUnreadCount':
			return {
				method: 'GET',
				endpoint: `${base}/unread_count`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${base}/${getParam('contentShareId')}`,
				body: {
					read_state: getParam('readState'),
				},
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${base}/${getParam('contentShareId')}`,
			};

		case 'addUsers': {
			const receiverIds = getParam('receiverIds')
				.split(',')
				.map((id) => id.trim());

			return {
				method: 'POST',
				endpoint: `${base}/${getParam('contentShareId')}/add_users`,
				body: {
					'receiver_ids[]': receiverIds,
				},
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for contentShare`,
			);
	}
}

// ============================================
// BLUEPRINT COURSE
// ============================================

export function handleBlueprintCourseResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const templateId = getParam('templateId', 'default');
	const templateBase = `/api/v1/courses/${courseId}/blueprint_templates/${templateId}`;

	switch (operation) {
		case 'getTemplate':
			return {
				method: 'GET',
				endpoint: templateBase,
			};

		case 'getAssociatedCourses':
			return {
				method: 'GET',
				endpoint: `${templateBase}/associated_courses`,
			};

		case 'updateAssociations': {
			const body: Record<string, unknown> = {};
			const courseIdsToAdd = getParam('courseIdsToAdd');
			const courseIdsToRemove = getParam('courseIdsToRemove');

			if (courseIdsToAdd) {
				body['course_ids_to_add'] = courseIdsToAdd.split(',').map((id) => id.trim());
			}
			if (courseIdsToRemove) {
				body['course_ids_to_remove'] = courseIdsToRemove.split(',').map((id) => id.trim());
			}

			return {
				method: 'PUT',
				endpoint: `${templateBase}/update_associations`,
				body,
			};
		}

		case 'beginMigration': {
			const additionalFields = getParamObject('additionalFields');
			return {
				method: 'POST',
				endpoint: `${templateBase}/migrations`,
				body: additionalFields,
			};
		}

		case 'getAllMigrations':
			return {
				method: 'GET',
				endpoint: `${templateBase}/migrations`,
			};

		case 'getMigration':
			return {
				method: 'GET',
				endpoint: `${templateBase}/migrations/${getParam('migrationId')}`,
			};

		case 'getMigrationDetails':
			return {
				method: 'GET',
				endpoint: `${templateBase}/migrations/${getParam('migrationId')}/details`,
			};

		case 'getUnsyncedChanges':
			return {
				method: 'GET',
				endpoint: `${templateBase}/unsynced_changes`,
			};

		case 'setRestrictions': {
			const contentType = getParam('contentType');
			const contentId = getParam('contentId');
			const restricted = getParam('restricted') === 'true';

			const body: Record<string, unknown> = {
				content_type: contentType,
				content_id: contentId,
				restricted,
			};

			if (restricted) {
				const restrictions = getParamObject('restrictions');
				if (Object.keys(restrictions).length > 0) {
					body.restrictions = restrictions;
				}
			}

			return {
				method: 'PUT',
				endpoint: `${templateBase}/restrict_item`,
				body,
			};
		}

		case 'getSubscriptions':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/blueprint_subscriptions`,
			};

		case 'getAllImports': {
			const subscriptionId = getParam('subscriptionId', 'default');
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/blueprint_subscriptions/${subscriptionId}/migrations`,
			};
		}

		case 'showImport': {
			const subscriptionId = getParam('subscriptionId', 'default');
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/blueprint_subscriptions/${subscriptionId}/migrations/${getParam('migrationId')}`,
			};
		}

		case 'getImportDetails': {
			const subscriptionId = getParam('subscriptionId', 'default');
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/blueprint_subscriptions/${subscriptionId}/migrations/${getParam('migrationId')}/details`,
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for blueprintCourse`,
			);
	}
}
