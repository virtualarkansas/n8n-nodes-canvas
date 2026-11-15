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

/**
 * Read a JSON field of the UI (a string in the editor, already an object when
 * it comes from an expression).
 */
function parseJsonField(value: unknown, label: string): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	if (value.trim() === '') {
		return undefined;
	}
	try {
		return JSON.parse(value);
	} catch {
		throw new ApplicationError(`${label} must be valid JSON`);
	}
}

// ============================================
// ASSIGNMENT
// ============================================

/** Shape the flat UI fields of an assignment the way `assignment[...]` expects them. */
function buildAssignmentFields(fields: Fields): Fields {
	const assignment: Fields = { ...fields };

	if ('allowed_extensions' in assignment) {
		assignment.allowed_extensions = splitList(assignment.allowed_extensions);
	}

	if ('integration_data' in assignment) {
		const data = parseJsonField(assignment.integration_data, 'Integration Data');
		if (data === undefined) {
			delete assignment.integration_data;
		} else {
			assignment.integration_data = data;
		}
	}

	// External tool (LTI) assignments carry their launch settings in a nested object.
	const toolAttributes: Fields = {};
	if ('external_tool_url' in assignment) {
		toolAttributes.url = assignment.external_tool_url;
		delete assignment.external_tool_url;
	}
	if ('external_tool_new_tab' in assignment) {
		toolAttributes.new_tab = assignment.external_tool_new_tab;
		delete assignment.external_tool_new_tab;
	}
	if (Object.keys(toolAttributes).length > 0) {
		assignment.external_tool_tag_attributes = toolAttributes;
	}

	return assignment;
}

/** `assignment_override[...]` for create and update. */
function buildOverrideFields(fields: Fields): Fields {
	const override: Fields = { ...fields };
	if ('student_ids' in override) {
		override.student_ids = splitList(override.student_ids);
	}
	return override;
}

/**
 * The entries of the batch override operations: a JSON array of objects, each
 * naming its assignment (and, except for create, the override). What an entry
 * has to contain is left to Canvas, which reports problems per entry.
 */
function parseOverrideBatch(value: string, example: string): Fields[] {
	const parsed = parseJsonField(value, 'Overrides');
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new ApplicationError(`Overrides must be a JSON array with at least one entry, e.g. ${example}`);
	}
	return parsed.map((entry: unknown, index: number) => {
		if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
			throw new ApplicationError(`Overrides: entry ${index + 1} must be an object, e.g. ${example}`);
		}
		const override = { ...(entry as Fields) };
		if ('student_ids' in override) {
			override.student_ids = splitList(override.student_ids);
		}
		return override;
	});
}

const OVERRIDE_REFERENCE_EXAMPLE = '[{"id": 12, "assignment_id": 34}]';
const OVERRIDE_CREATE_EXAMPLE = '[{"assignment_id": 34, "course_section_id": 56, "due_at": "2030-01-31T23:59:00Z"}]';
const OVERRIDE_UPDATE_EXAMPLE = '[{"id": 12, "assignment_id": 34, "due_at": "2030-01-31T23:59:00Z"}]';

export function handleAssignmentResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'batchGetOverrides': {
			// Only the two IDs are sent, always both and in this order: Rails starts a new entry
			// of `assignment_overrides[]` whenever a key repeats.
			const requested = parseOverrideBatch(getParam('overrides'), OVERRIDE_REFERENCE_EXAMPLE).map((entry) => ({
				id: String(entry.id ?? '').trim(),
				assignment_id: String(entry.assignment_id ?? '').trim(),
			}));
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/overrides`,
				method: 'GET',
				qs: { assignment_overrides: requested },
				// Canvas answers in the order asked, with null for an override it cannot find
				// (or that the user may not see): say which one that was instead of losing it.
				transform: (records) =>
					records.map((record, index) =>
						record === null || record === undefined
							? { ...(requested[index] ?? {}), not_found: true }
							: record,
					),
			};
		}

		case 'batchCreateOverrides':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/overrides`,
				method: 'POST',
				body: { assignment_overrides: parseOverrideBatch(getParam('overrides'), OVERRIDE_CREATE_EXAMPLE) },
			};

		case 'batchUpdateOverrides':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/overrides`,
				method: 'PUT',
				body: { assignment_overrides: parseOverrideBatch(getParam('overrides'), OVERRIDE_UPDATE_EXAMPLE) },
			};

		case 'listGroupMembers':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/users/${getParam('userId')}/group_members`,
				method: 'GET',
			};

		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments`,
				method: 'POST',
				body: {
					assignment: buildAssignmentFields({ name: getParam('name'), ...getParamObject('additionalFields') }),
				},
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const qs: Fields = getParamObject('options');

			// Narrow the list to one assignment group and/or to what one user can see.
			const assignmentGroupId = String(qs.assignment_group_id ?? '').trim();
			const userId = String(qs.user_id ?? '').trim();
			delete qs.assignment_group_id;
			delete qs.user_id;

			if ('assignment_ids' in qs) {
				const ids = splitList(qs.assignment_ids);
				if (ids.length > 0) {
					qs.assignment_ids = ids;
				} else {
					delete qs.assignment_ids;
				}
			}
			// Canvas treats the mere presence of these parameters as "on".
			if (!qs.bucket) {
				delete qs.bucket;
			}
			if (qs.new_quizzes !== true) {
				delete qs.new_quizzes;
			}

			let endpoint = `/api/v1/courses/${courseId}/assignments`;
			if (userId) {
				endpoint = `/api/v1/users/${userId}/courses/${courseId}/assignments`;
				if (assignmentGroupId) {
					qs.assignment_group_id = assignmentGroupId;
				}
			} else if (assignmentGroupId) {
				endpoint = `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}/assignments`;
			}

			return { endpoint, method: 'GET', qs };
		}

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
				method: 'PUT',
				body: { assignment: buildAssignmentFields(getParamObject('updateFields')) },
			};

		case 'duplicate': {
			const options = getParamObject('options');
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/duplicate`,
				method: 'POST',
				...(options.result_type ? { qs: { result_type: options.result_type } } : {}),
			};
		}

		case 'bulkUpdateDates': {
			const dates = parseJsonField(getParam('dates'), 'Dates');
			if (!Array.isArray(dates) || dates.length === 0) {
				throw new ApplicationError(
					'Dates must be a JSON array with at least one entry, e.g. [{"id": 1, "all_dates": [{"base": true, "due_at": "2030-01-31T23:59:00Z"}]}]',
				);
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/bulk_update`,
				method: 'PUT',
				// The endpoint takes a bare JSON array as its body.
				body: dates as unknown as Record<string, unknown>,
			};
		}

		case 'listOverrides':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides`,
				method: 'GET',
			};

		case 'getOverride': {
			// The override that applies to a group or a section can be asked for directly;
			// Canvas answers with a redirect to the override.
			const overrideBy = getParam('overrideBy', 'id');
			if (overrideBy === 'group') {
				return {
					endpoint: `/api/v1/groups/${getParam('groupId')}/assignments/${assignmentId}/override`,
					method: 'GET',
				};
			}
			if (overrideBy === 'section') {
				return {
					endpoint: `/api/v1/sections/${getParam('courseSectionId')}/assignments/${assignmentId}/override`,
					method: 'GET',
				};
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides/${getParam('overrideId')}`,
				method: 'GET',
			};
		}

		case 'createOverride': {
			const target = getParam('overrideTarget', 'students');
			const override: Fields = buildOverrideFields(getParamObject('additionalFields'));
			if (target === 'section') {
				override.course_section_id = getParam('courseSectionId');
			} else if (target === 'group') {
				override.group_id = getParam('groupId');
			} else {
				override.student_ids = splitList(getParam('studentIds'));
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides`,
				method: 'POST',
				body: { assignment_override: override },
			};
		}

		case 'updateOverride':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides/${getParam('overrideId')}`,
				method: 'PUT',
				body: { assignment_override: buildOverrideFields(getParamObject('updateFields')) },
			};

		case 'deleteOverride':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/overrides/${getParam('overrideId')}`,
				method: 'DELETE',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for assignment`);
	}
}

// ============================================
// ASSIGNMENT GROUP
// ============================================

/** `integration_data` and `rules` are objects; the UI offers them as JSON text. */
function buildAssignmentGroupFields(fields: Fields): Fields {
	const group: Fields = { ...fields };
	for (const [key, label] of [
		['integration_data', 'Integration Data'],
		['rules', 'Rules'],
	]) {
		if (key in group) {
			const parsed = parseJsonField(group[key], label);
			if (parsed === undefined) {
				delete group[key];
			} else {
				group[key] = parsed;
			}
		}
	}
	return group;
}

export function handleAssignmentGroupResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentGroupId = getParam('assignmentGroupId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups`,
				method: 'POST',
				body: buildAssignmentGroupFields({ name: getParam('name'), ...getParamObject('additionalFields') }),
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`,
				method: 'DELETE',
				qs: getParamObject('options'),
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const qs: Fields = getParamObject('options');
			if ('assignment_ids' in qs) {
				const ids = splitList(qs.assignment_ids);
				if (ids.length > 0) {
					qs.assignment_ids = ids;
				} else {
					delete qs.assignment_ids;
				}
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups`,
				method: 'GET',
				qs,
			};
		}

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignment_groups/${assignmentGroupId}`,
				method: 'PUT',
				body: buildAssignmentGroupFields(getParamObject('updateFields')),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for assignmentGroup`);
	}
}

// ============================================
// ASSIGNMENT EXTENSION
// ============================================

export function handleAssignmentExtensionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'setExtensions': {
			const extensionsData = getParamObject('extensions');
			const extensionValues = (extensionsData.extensionValues as Array<{
				user_id: string | number;
				extra_attempts: number;
			}>) || [];

			if (extensionValues.length === 0) {
				throw new ApplicationError(
					'At least one extension entry is required for assignmentExtension setExtensions',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/extensions`,
				method: 'POST',
				body: {
					assignment_extensions: extensionValues.map((entry) => ({
						user_id: String(entry.user_id ?? '').trim(),
						extra_attempts: entry.extra_attempts,
					})),
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for assignmentExtension`);
	}
}
