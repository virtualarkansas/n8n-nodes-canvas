import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { parseJsonObjectFor, toList } from './shared';

// ============================================
// EXTERNAL TOOL
// ============================================

/**
 * Canvas serves external tools for courses and accounts; groups only have the list.
 */
function getExternalToolBasePath(getParam: GetParam, operation: string): string {
	const contextType = getParam('contextType', 'course');
	switch (contextType) {
		case 'account':
			return `/api/v1/accounts/${getParam('accountId')}`;
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'group':
			if (operation !== 'getAll') {
				throw new ApplicationError(
					`Canvas has no group endpoint for externalTool ${operation}; use the course or account context`,
				);
			}
			return `/api/v1/groups/${getParam('groupId')}`;
		default:
			throw new ApplicationError(`Unknown externalTool context type: ${contextType}`);
	}
}

/**
 * Turn the tool settings of the UI into Canvas arguments:
 *   - custom fields arrive as JSON text and must be sent as an object,
 *   - every placement is its own argument (`course_navigation[enabled]`, ...).
 */
function buildExternalToolSettings(
	fields: Record<string, unknown>,
	context: string,
): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		if (key === 'custom_fields') {
			const customFields = parseJsonObjectFor(value, 'Custom Fields', context);
			if (customFields !== undefined) {
				body.custom_fields = customFields;
			}
		} else if (key === 'placements') {
			const placements = parseJsonObjectFor(value, 'Placements', context);
			// A placement set to null is removed from the tool by Canvas.
			Object.assign(body, placements ?? {});
		} else {
			body[key] = value;
		}
	}
	return body;
}

export function handleExternalToolResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const toolId = getParam('externalToolId');

	switch (operation) {
		case 'addRceFavorite':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/external_tools/rce_favorites/${toolId}`,
			};

		case 'addTopNavFavorite':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/external_tools/top_nav_favorites/${toolId}`,
			};

		case 'create': {
			const basePath = getExternalToolBasePath(getParam, operation);

			// With a client ID Canvas installs the tool from its developer key and ignores everything else.
			if (getParam('authType', 'lti11') === 'lti13') {
				return {
					method: 'POST',
					endpoint: `${basePath}/external_tools`,
					body: { client_id: getParam('clientId') },
				};
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/external_tools`,
				body: {
					name: getParam('name'),
					privacy_level: getParam('privacyLevel'),
					consumer_key: getParam('consumerKey'),
					shared_secret: getParam('sharedSecret'),
					...buildExternalToolSettings(getParamObject('additionalFields'), 'externalTool create'),
				},
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${getExternalToolBasePath(getParam, operation)}/external_tools/${toolId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${getExternalToolBasePath(getParam, operation)}/external_tools/${toolId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${getExternalToolBasePath(getParam, operation)}/external_tools`,
				qs: getParamObject('options'),
			};

		case 'getSessionlessLaunchUrl': {
			const qs: Record<string, unknown> = {};
			if (toolId) {
				qs.id = toolId;
			}
			// Canvas treats an empty value as "given" (an empty resource_link_lookup_uuid wins over the tool ID).
			for (const [key, value] of Object.entries(getParamObject('options'))) {
				if (value !== undefined && value !== null && value !== '') {
					qs[key] = value;
				}
			}
			return {
				method: 'GET',
				endpoint: `${getExternalToolBasePath(getParam, operation)}/external_tools/sessionless_launch`,
				qs,
			};
		}

		case 'getVisibleCourseNavTools': {
			const courseIds = toList(getParam('courseIds'));
			if (courseIds.length === 0) {
				throw new ApplicationError(
					'At least one course ID is required for externalTool getVisibleCourseNavTools',
				);
			}
			if (courseIds.length === 1) {
				return {
					method: 'GET',
					endpoint: `/api/v1/courses/${courseIds[0]}/external_tools/visible_course_nav_tools`,
				};
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/external_tools/visible_course_nav_tools',
				qs: { context_codes: courseIds.map((id) => `course_${id}`) },
			};
		}

		case 'removeRceFavorite':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/external_tools/rce_favorites/${toolId}`,
			};

		case 'removeTopNavFavorite':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/external_tools/top_nav_favorites/${toolId}`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${getExternalToolBasePath(getParam, operation)}/external_tools/${toolId}`,
				body: buildExternalToolSettings(getParamObject('updateFields'), 'externalTool update'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for externalTool`);
	}
}

// ============================================
// LINE ITEM (LTI Advantage: Assignment and Grade Services)
// ============================================

/** Key of Canvas' extension that sets the submission type of the assignment a line item creates. */
const AGS_SUBMISSION_TYPE = 'https://canvas.instructure.com/lti/submission_type';

/**
 * The `id` Canvas returns for a line item is its URL
 * (`https://canvas/api/lti/courses/1/line_items/5`); accept that as well as the bare number.
 */
function resolveLineItemId(value: string): string {
	const match = /\/line_items\/([^/?#]+)/.exec(value);
	return match ? match[1] : value;
}

export function handleLineItemResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const lineItemId = resolveLineItemId(getParam('lineItemId'));
	// Served by the LTI Advantage services, not by the REST API: only an LTI Advantage
	// access token (client-credentials grant of an LTI 1.3 developer key) is accepted.
	const basePath = `/api/lti/courses/${courseId}/line_items`;

	/** `include[]=launch_url` is the only include; the UI offers it as a switch. */
	const buildQuery = (options: Record<string, unknown>): Record<string, unknown> => {
		const qs: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(options)) {
			if (key === 'include') {
				if (value === true) {
					qs.include = ['launch_url'];
				}
			} else if (value !== undefined && value !== null && value !== '') {
				qs[key] = value;
			}
		}
		return qs;
	};

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				label: getParam('label'),
				scoreMaximum: parseFloat(getParam('scoreMaximum', '100')),
			};
			for (const [key, value] of Object.entries(additionalFields)) {
				if (key === 'submissionType') {
					if (value) {
						body[AGS_SUBMISSION_TYPE] = {
							type: value,
							...(additionalFields.submissionExternalToolUrl
								? { external_tool_url: additionalFields.submissionExternalToolUrl }
								: {}),
						};
					}
				} else if (key !== 'submissionExternalToolUrl') {
					body[key] = value;
				}
			}
			return {
				method: 'POST',
				endpoint: basePath,
				body,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/${lineItemId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/${lineItemId}`,
				qs: buildQuery(getParamObject('options')),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
				qs: buildQuery(getParamObject('options')),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/${lineItemId}`,
				body: getParamObject('updateFields'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for lineItem`);
	}
}

// ============================================
// LTI REGISTRATION
// ============================================

export function handleLtiRegistrationResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');
	const registrationId = getParam('registrationId');
	const basePath = `/api/v1/accounts/${accountId}/lti_registrations`;

	/** `configuration` and `overlay` are JSON fields; Canvas needs them as objects. */
	const buildRegistrationBody = (
		fields: Record<string, unknown>,
		context: string,
	): Record<string, unknown> => {
		const body: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(fields)) {
			if (key === 'configuration' || key === 'overlay') {
				const parsed = parseJsonObjectFor(
					value,
					key === 'configuration' ? 'Configuration' : 'Overlay',
					context,
				);
				// An untouched JSON field holds "{}", which would wipe the stored value.
				if (parsed !== undefined && Object.keys(parsed).length > 0) {
					body[key] = parsed;
				}
			} else {
				body[key] = value;
			}
		}
		return body;
	};

	switch (operation) {
		case 'bind':
			return {
				method: 'POST',
				endpoint: `${basePath}/${registrationId}/bind`,
				body: {
					workflow_state: getParam('workflowState'),
				},
			};

		case 'create': {
			const configuration = parseJsonObjectFor(
				getParam('configuration'),
				'Configuration',
				'ltiRegistration create',
			);
			return {
				method: 'POST',
				endpoint: basePath,
				body: {
					configuration: configuration ?? {},
					...buildRegistrationBody(getParamObject('additionalFields'), 'ltiRegistration create'),
				},
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/${registrationId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/${registrationId}`,
				qs: getParamObject('options'),
			};

		case 'getByClientId':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/lti_registration_by_client_id/${getParam('clientId')}`,
			};

		case 'getByUnifiedToolId':
			return {
				method: 'GET',
				endpoint: `${basePath}/by_utid/${encodeURIComponent(getParam('unifiedToolId'))}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
				qs: getParamObject('options'),
				// { "total": 12, "data": [...] }
				dataKey: 'data',
			};

		case 'getHistory':
			return {
				method: 'GET',
				endpoint: `${basePath}/${registrationId}/history`,
			};

		case 'getOverlayHistory':
			return {
				method: 'GET',
				endpoint: `${basePath}/${registrationId}/overlay_history`,
				qs: getParamObject('options'),
			};

		case 'reset':
			return {
				method: 'PUT',
				endpoint: `${basePath}/${registrationId}/reset`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/${registrationId}`,
				body: buildRegistrationBody(getParamObject('updateFields'), 'ltiRegistration update'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for ltiRegistration`);
	}
}

// ============================================
// LTI RESOURCE LINK
// ============================================

export function handleLtiResourceLinkResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const resourceLinkId = getParam('resourceLinkId');
	const basePath = `/api/v1/courses/${courseId}/lti_resource_links`;

	/**
	 * Canvas only checks whether `include_deleted` is present, so "false" would
	 * include deleted links too: send it only when it is switched on.
	 */
	const includeDeleted = (options: Record<string, unknown>): Record<string, unknown> =>
		options.include_deleted === true ? { include_deleted: true } : {};

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = { url: getParam('url') };
			if (additionalFields.title !== undefined && additionalFields.title !== '') {
				body.title = additionalFields.title;
			}
			const custom = parseJsonObjectFor(additionalFields.custom, 'Custom', 'ltiResourceLink create');
			if (custom !== undefined && Object.keys(custom).length > 0) {
				body.custom = custom;
			}
			return {
				method: 'POST',
				endpoint: basePath,
				body,
			};
		}

		case 'bulkCreate': {
			const resourceLinksJson = getParam('resourceLinks');
			let resourceLinks: unknown;
			try {
				resourceLinks = JSON.parse(resourceLinksJson);
			} catch {
				throw new ApplicationError(
					'Invalid JSON in resourceLinks field for ltiResourceLink bulkCreate',
				);
			}

			if (!Array.isArray(resourceLinks)) {
				throw new ApplicationError(
					'resourceLinks must be a JSON array for ltiResourceLink bulkCreate',
				);
			}

			if (resourceLinks.length === 0) {
				throw new ApplicationError(
					'At least one resource link is required for ltiResourceLink bulkCreate',
				);
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/bulk`,
				// The request body is the JSON array itself, not an object wrapping it.
				body: resourceLinks as unknown as Record<string, unknown>,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/${resourceLinkId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/${resourceLinkId}`,
				qs: includeDeleted(getParamObject('options')),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
				qs: includeDeleted(getParamObject('options')),
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(updateFields)) {
				if (key === 'custom') {
					const custom = parseJsonObjectFor(value, 'Custom', 'ltiResourceLink update');
					if (custom !== undefined) {
						body.custom = custom;
					}
				} else if (key !== 'include_deleted') {
					body[key] = value;
				}
			}
			return {
				method: 'PUT',
				endpoint: `${basePath}/${resourceLinkId}`,
				qs: includeDeleted(updateFields),
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for ltiResourceLink`);
	}
}
