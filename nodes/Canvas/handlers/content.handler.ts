import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { downloadIfAsked, isBlank, parseJsonObjectFor, pollUntil, stateIn, toList } from './shared';

/** Where a content export keeps its generated file. An export that is not finished has none. */
const EXPORT_FILE = {
	urlField: 'attachment.url',
	fileNameField: 'attachment.filename',
	contentTypeField: 'attachment.content-type',
	optional: true,
};

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
	switch (operation) {
		case 'create': {
			const basePath = getContentExportBasePath(getParam);
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				// Groups and users can only export their files as a zip.
				export_type: getParam('exportType', 'zip'),
			};

			// "Select ..." fields become select[<type>][]=<id>: the objects to export.
			const select: Record<string, string[]> = {};
			for (const [key, value] of Object.entries(additionalFields)) {
				if (key.startsWith('select_')) {
					const ids = toList(value);
					if (ids.length > 0) {
						select[key.slice('select_'.length)] = ids;
					}
				} else if (!isBlank(value)) {
					body[key] = value;
				}
			}
			if (Object.keys(select).length > 0) {
				body.select = select;
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
				endpoint: `${getContentExportBasePath(getParam)}/content_exports/${getParam('contentExportId')}`,
				download: downloadIfAsked(getParam, EXPORT_FILE),
			};

		case 'waitForCompletion':
			return {
				method: 'GET',
				endpoint: `${getContentExportBasePath(getParam)}/content_exports/${getParam('contentExportId')}`,
				poll: pollUntil(getParam, stateIn('workflow_state', ['exported', 'failed'])),
				download: downloadIfAsked(getParam, EXPORT_FILE),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${getContentExportBasePath(getParam)}/content_exports`,
			};

		case 'getContentList': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/content_list`,
				qs: isBlank(options.type) ? {} : { type: options.type },
			};
		}

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

/** Fields of the UI that Canvas expects inside `settings[...]`. */
const MIGRATION_SETTINGS = new Set([
	'content_export_id',
	'file_url',
	'folder_id',
	'import_blueprint_settings',
	'importer_skips',
	'insert_into_module_id',
	'insert_into_module_position',
	'insert_into_module_type',
	'move_to_assignment_group_id',
	'overwrite_quizzes',
	'question_bank_id',
	'question_bank_name',
	'source_course_id',
]);

/**
 * Turn "copy[all_assignments], copy[wiki_pages][id_abc]" (the `property` values
 * of Get Selective Data) into { all_assignments: "1", wiki_pages: { id_abc: "1" } }.
 */
function buildCopyParameters(value: unknown): Record<string, unknown> | undefined {
	const properties = toList(value);
	if (properties.length === 0) {
		return undefined;
	}
	const copy: Record<string, unknown> = {};
	for (const property of properties) {
		// "copy[assignments][id_x]" as Canvas reports it; "assignments[id_x]" or "all_assignments" work too.
		const match = /^(?:copy(?=\[))?([^[\]]+)?((?:\[[^[\]]+\])*)$/.exec(property);
		const keys = match
			? [...(match[1] ? [match[1]] : []), ...(match[2] ? match[2].slice(1, -1).split('][') : [])]
			: [];
		if (keys.length === 0) {
			throw new ApplicationError(
				`Copy Properties: "${property}" is not a copy property (expected e.g. copy[all_assignments] or copy[assignments][id_...]) for contentMigration update`,
			);
		}
		let target = copy;
		keys.forEach((key, index) => {
			if (index === keys.length - 1) {
				target[key] = '1';
			} else {
				if (typeof target[key] !== 'object' || target[key] === null) {
					target[key] = {};
				}
				target = target[key] as Record<string, unknown>;
			}
		});
	}
	return copy;
}

/**
 * Build the arguments shared by create and update from the flat fields of the UI:
 * settings[...], date_shift_options[...], pre_attachment[...], select and selective_import.
 */
function buildMigrationBody(
	fields: Record<string, unknown>,
	context: string,
): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	const settings: Record<string, unknown> = {};
	const dateShiftOptions: Record<string, unknown> = {};
	const preAttachment: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(fields)) {
		if (isBlank(value)) {
			continue;
		}
		if (key === 'date_shift_options_day_substitutions') {
			const substitutions = parseJsonObjectFor(value, 'Day Substitutions', context);
			if (substitutions !== undefined && Object.keys(substitutions).length > 0) {
				dateShiftOptions.day_substitutions = substitutions;
			}
		} else if (key.startsWith('date_shift_options_')) {
			dateShiftOptions[key.slice('date_shift_options_'.length)] = value;
		} else if (key.startsWith('pre_attachment_')) {
			preAttachment[key.slice('pre_attachment_'.length)] = value;
		} else if (key === 'select') {
			const select = parseJsonObjectFor(value, 'Select', context);
			if (select !== undefined && Object.keys(select).length > 0) {
				body.select = select;
			}
		} else if (key === 'importer_skips') {
			const skips = toList(value);
			if (skips.length > 0) {
				settings.importer_skips = skips;
			}
		} else if (MIGRATION_SETTINGS.has(key)) {
			settings[key] = value;
		} else {
			body[key] = value;
		}
	}

	if (Object.keys(settings).length > 0) {
		body.settings = settings;
	}
	if (Object.keys(dateShiftOptions).length > 0) {
		body.date_shift_options = dateShiftOptions;
	}
	if (Object.keys(preAttachment).length > 0) {
		body.pre_attachment = preAttachment;
	}
	return body;
}

export function handleContentMigrationResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const basePath = getContentMigrationBasePath(getParam);
			const migrationType = getParam('migrationType');
			const body = buildMigrationBody(getParamObject('additionalFields'), 'contentMigration create');
			body.migration_type = migrationType;

			// A course copy needs the course to copy from.
			if (migrationType === 'course_copy_importer') {
				body.settings = {
					...((body.settings as Record<string, unknown> | undefined) ?? {}),
					source_course_id: getParam('sourceCourseId'),
				};
			}

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

		case 'getIssue': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}/migration_issues/${getParam('issueId')}`,
			};
		}

		case 'getIssues': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}/migration_issues`,
			};
		}

		case 'getSelectiveData': {
			const basePath = getContentMigrationBasePath(getParam);
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}/selective_data`,
				qs: isBlank(options.type) ? {} : { type: options.type },
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
			const body = buildMigrationBody(getParamObject('updateFields'), 'contentMigration update');
			const copy = buildCopyParameters(getParam('copyProperties'));
			if (copy !== undefined) {
				body.copy = copy;
			}
			return {
				method: 'PUT',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}`,
				body,
			};
		}

		case 'updateIssue': {
			const basePath = getContentMigrationBasePath(getParam);
			return {
				method: 'PUT',
				endpoint: `${basePath}/content_migrations/${getParam('contentMigrationId')}/migration_issues/${getParam('issueId')}`,
				body: { workflow_state: getParam('issueState', 'resolved') },
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
	// Reading works for other users (admins, linked observers); Canvas only lets
	// a user create, change and remove their own shares.
	const readBase = `/api/v1/users/${getParam('userId', 'self')}/content_shares`;
	const ownBase = '/api/v1/users/self/content_shares';

	const receiverIds = (): string[] => {
		const ids = toList(getParam('receiverIds'));
		if (ids.length === 0) {
			throw new ApplicationError(
				`At least one receiver ID is required for contentShare ${operation}`,
			);
		}
		return ids;
	};

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: ownBase,
				body: {
					content_type: getParam('contentType'),
					content_id: getParam('contentId'),
					receiver_ids: receiverIds(),
				},
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${readBase}/${getParam('contentShareId')}`,
			};

		case 'getAll': {
			const shareType = getParam('shareType', 'received');
			return {
				method: 'GET',
				endpoint: `${readBase}/${shareType}`,
			};
		}

		case 'getUnreadCount':
			return {
				method: 'GET',
				endpoint: `${readBase}/unread_count`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${ownBase}/${getParam('contentShareId')}`,
				body: {
					read_state: getParam('readState'),
				},
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${ownBase}/${getParam('contentShareId')}`,
			};

		case 'addUsers':
			return {
				method: 'POST',
				endpoint: `${ownBase}/${getParam('contentShareId')}/add_users`,
				body: {
					receiver_ids: receiverIds(),
				},
			};

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
			const courseIdsToAdd = toList(getParam('courseIdsToAdd'));
			const courseIdsToRemove = toList(getParam('courseIdsToRemove'));

			if (courseIdsToAdd.length > 0) {
				body.course_ids_to_add = courseIdsToAdd;
			}
			if (courseIdsToRemove.length > 0) {
				body.course_ids_to_remove = courseIdsToRemove;
			}

			return {
				method: 'PUT',
				endpoint: `${templateBase}/update_associations`,
				body,
			};
		}

		case 'beginMigration': {
			const body: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(getParamObject('additionalFields'))) {
				if (!isBlank(value)) {
					body[key] = value;
				}
			}
			return {
				method: 'POST',
				endpoint: `${templateBase}/migrations`,
				body,
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
			const restricted = getParam('restricted', 'true') === 'true';

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
