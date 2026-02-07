import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Helper: resolve context base path for externalTool
// ============================================

function getExternalToolBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType', 'course');
	const contextMap: Record<string, string> = {
		course: `/api/v1/courses/${getParam('courseId')}`,
		account: `/api/v1/accounts/${getParam('accountId')}`,
		group: `/api/v1/groups/${getParam('groupId')}`,
	};
	const base = contextMap[contextType] || contextMap.course;
	return base;
}

// ============================================
// EXTERNAL TOOL
// ============================================

export function handleExternalToolResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getExternalToolBasePath(getParam);
	const toolId = getParam('externalToolId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const authType = getParam('authType', 'lti11');

			const body: Record<string, unknown> = {
				name: getParam('name'),
				privacy_level: getParam('privacyLevel'),
				...additionalFields,
			};

			if (authType === 'lti11') {
				body.consumer_key = getParam('consumerKey');
				body.shared_secret = getParam('sharedSecret');
			} else {
				body.client_id = getParam('clientId');
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/external_tools`,
				body,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/external_tools/${toolId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/external_tools/${toolId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/external_tools`,
				qs: getParamObject('options'),
			};

		case 'getSessionlessLaunchUrl':
			return {
				method: 'GET',
				endpoint: `${basePath}/external_tools/sessionless_launch`,
				qs: {
					id: toolId,
					...getParamObject('options'),
				},
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/external_tools/${toolId}`,
				body: getParamObject('updateFields'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for externalTool`);
	}
}

// ============================================
// LINE ITEM
// ============================================

export function handleLineItemResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const lineItemId = getParam('lineItemId');
	const basePath = `/api/v1/courses/${courseId}/line_items`;

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			return {
				method: 'POST',
				endpoint: basePath,
				body: {
					label: getParam('label'),
					scoreMaximum: parseFloat(getParam('scoreMaximum', '100')),
					...additionalFields,
				},
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
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
				qs: getParamObject('options'),
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
			const configuration = getParam('configuration');
			const additionalFields = getParamObject('additionalFields');
			let parsedConfig: unknown;
			try {
				parsedConfig = JSON.parse(configuration);
			} catch {
				throw new ApplicationError(
					'Invalid JSON in configuration field for ltiRegistration create',
				);
			}

			return {
				method: 'POST',
				endpoint: basePath,
				body: {
					configuration: parsedConfig,
					...additionalFields,
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
				endpoint: `${basePath}`,
				qs: {
					client_id: getParam('clientId'),
				},
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
				qs: getParamObject('options'),
			};

		case 'reset':
			return {
				method: 'POST',
				endpoint: `${basePath}/${registrationId}/reset`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/${registrationId}`,
				body: getParamObject('updateFields'),
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

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			return {
				method: 'POST',
				endpoint: basePath,
				body: {
					url: getParam('url'),
					...additionalFields,
				},
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
				body: {
					resource_links: resourceLinks,
				},
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
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/${resourceLinkId}`,
				body: getParamObject('updateFields'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for ltiResourceLink`);
	}
}
