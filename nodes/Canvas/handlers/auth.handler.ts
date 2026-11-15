import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { isBlank, linkedIfAsked, parseJsonObjectOrEmpty, toList } from './shared';
import type { WithPageTransform } from './shared';

// ============================================
// ACCESS TOKEN
// ============================================

export function buildAccessTokenRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const userId = getParam('userId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const tokenBody: Record<string, unknown> = {
				purpose: getParam('purpose'),
			};
			if (!isBlank(additionalFields.expires_at)) {
				tokenBody.expires_at = additionalFields.expires_at;
			}
			const scopes = toList(additionalFields.scopes);
			if (scopes.length > 0) {
				tokenBody.scopes = scopes;
			}

			return {
				endpoint: `/api/v1/users/${userId}/tokens`,
				method: 'POST',
				body: { token: tokenBody },
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/users/${userId}/tokens/${getParam('tokenId')}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/users/${userId}/tokens/${getParam('tokenId')}`,
				method: 'GET',
			};

		case 'getAll':
			// There is no GET /users/:id/tokens; the list of manually generated tokens lives here.
			return {
				endpoint: `/api/v1/users/${userId}/user_generated_tokens`,
				method: 'GET',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const tokenUpdate: Record<string, unknown> = {};

			if (!isBlank(updateFields.purpose)) {
				tokenUpdate.purpose = updateFields.purpose;
			}
			if (!isBlank(updateFields.expires_at)) {
				tokenUpdate.expires_at = updateFields.expires_at;
			}
			if (updateFields.regenerate !== undefined && updateFields.regenerate !== '') {
				tokenUpdate.regenerate = updateFields.regenerate;
			}
			const scopes = toList(updateFields.scopes);
			if (scopes.length > 0) {
				tokenUpdate.scopes = scopes;
			}
			if (Object.keys(tokenUpdate).length === 0) {
				throw new ApplicationError('Set at least one field to update on the access token');
			}

			return {
				endpoint: `/api/v1/users/${userId}/tokens/${getParam('tokenId')}`,
				method: 'PUT',
				body: { token: tokenUpdate },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for accessToken`);
	}
}

// ============================================
// API TOKEN SCOPE
// ============================================

export function buildApiTokenScopeRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const accountId = getParam('accountId');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (!isBlank(options.group_by)) {
				qs.group_by = options.group_by;
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/scopes`,
				method: 'GET',
				qs,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for apiTokenScope`);
	}
}

// ============================================
// AUTHENTICATION PROVIDER
// ============================================

/**
 * Settings of a provider as Canvas expects them: empty text fields that were
 * added but not filled in are left out, federated attributes are parsed.
 */
function providerSettings(fields: Record<string, unknown>): Record<string, unknown> {
	const settings: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		if (key === 'federated_attributes') {
			settings.federated_attributes = parseJsonObjectOrEmpty(value, 'Federated Attributes');
		} else if (!isBlank(value)) {
			settings[key] = value;
		}
	}
	return settings;
}

export function buildAuthenticationProviderRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers`,
				method: 'POST',
				body: {
					auth_type: getParam('authType'),
					...providerSettings(getParamObject('additionalFields')),
				},
			};

		case 'delete':
			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers/${getParam('providerId')}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers/${getParam('providerId')}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers`,
				method: 'GET',
			};

		case 'getSsoSettings':
			return {
				endpoint: `/api/v1/accounts/${accountId}/sso_settings`,
				method: 'GET',
			};

		case 'restore':
			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers/${getParam('providerId')}/restore`,
				method: 'PUT',
			};

		case 'update': {
			const body = providerSettings(getParamObject('updateFields'));
			if (Object.keys(body).length === 0) {
				throw new ApplicationError('Set at least one field to update on the authentication provider');
			}
			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers/${getParam('providerId')}`,
				method: 'PUT',
				body,
			};
		}

		case 'updateSsoSettings': {
			// An empty value is meaningful here: Canvas un-sets a setting that is sent blank.
			const ssoSettings = getParamObject('ssoSettings');
			if (Object.keys(ssoSettings).length === 0) {
				throw new ApplicationError('Add at least one SSO setting to update');
			}
			return {
				endpoint: `/api/v1/accounts/${accountId}/sso_settings`,
				method: 'PUT',
				body: { sso_settings: ssoSettings },
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for authenticationProvider`,
			);
	}
}

// ============================================
// AUTHENTICATIONS LOG
// ============================================

export function buildAuthenticationsLogRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const options = getParamObject('options');
	const qs: Record<string, unknown> = {};

	if (!isBlank(options.start_time)) {
		qs.start_time = options.start_time;
	}
	if (!isBlank(options.end_time)) {
		qs.end_time = options.end_time;
	}

	// Canvas answers { links, events: [...], linked: { logins, accounts, users, page_views } };
	// every event becomes one item, with the records it refers to unless switched off.
	const list = (endpoint: string): WithPageTransform => ({
		endpoint,
		method: 'GET',
		qs,
		dataKey: 'events',
		pageTransform: linkedIfAsked(getParam, {
			login: 'logins',
			account: 'accounts',
			user: 'users',
			page_view: 'page_views',
		}),
	});

	switch (operation) {
		case 'getAllByAccount':
			return list(`/api/v1/audit/authentication/accounts/${getParam('accountId')}`);

		case 'getAllByLogin':
			return list(`/api/v1/audit/authentication/logins/${getParam('loginId')}`);

		case 'getAllByUser':
			return list(`/api/v1/audit/authentication/users/${getParam('userId')}`);

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for authenticationsLog`,
			);
	}
}

// ============================================
// DEVELOPER KEY
// ============================================

const DEVELOPER_KEY_TEXT_FIELDS = [
	'client_credentials_audience',
	'email',
	'icon_url',
	'name',
	'notes',
	'vendor_code',
];
const DEVELOPER_KEY_BOOLEAN_FIELDS = [
	'allow_includes',
	'auto_expire_tokens',
	'require_scopes',
	'test_cluster_only',
	'visible',
];

function developerKeySettings(fields: Record<string, unknown>): Record<string, unknown> {
	const developerKey: Record<string, unknown> = {};
	for (const key of DEVELOPER_KEY_TEXT_FIELDS) {
		if (!isBlank(fields[key])) {
			developerKey[key] = fields[key];
		}
	}
	for (const key of DEVELOPER_KEY_BOOLEAN_FIELDS) {
		if (fields[key] !== undefined && fields[key] !== '') {
			developerKey[key] = fields[key];
		}
	}
	// One URI per line or comma-separated; Canvas wants a list.
	const redirectUris = toList(fields.redirect_uris, /[\n,]/);
	if (redirectUris.length > 0) {
		developerKey.redirect_uris = redirectUris;
	}
	const scopes = toList(fields.scopes, /[\n,]/);
	if (scopes.length > 0) {
		developerKey.scopes = scopes;
	}
	return developerKey;
}

export function buildDeveloperKeyRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const accountId = getParam('accountId');
			const developerKey = developerKeySettings(getParamObject('additionalFields'));
			// Canvas answers "developer_key is missing" when no attribute is sent.
			if (Object.keys(developerKey).length === 0) {
				throw new ApplicationError('Set at least one field (for example Name) to create a developer key');
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/developer_keys`,
				method: 'POST',
				body: { developer_key: developerKey },
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/developer_keys/${getParam('developerKeyId')}`,
				method: 'DELETE',
			};

		case 'getAll': {
			const accountId = getParam('accountId');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			// Canvas only checks that the parameter is present: "inherited=false" would still
			// list the inherited keys.
			if (options.inherited === true || options.inherited === 'true') {
				qs.inherited = true;
			}
			if (!isBlank(options.id)) {
				qs.id = options.id;
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/developer_keys`,
				method: 'GET',
				qs,
			};
		}

		case 'setAccountBinding':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/developer_keys/${getParam('developerKeyId')}/developer_key_account_bindings`,
				method: 'POST',
				body: { developer_key_account_binding: { workflow_state: getParam('bindingState', 'on') } },
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const developerKey = developerKeySettings(updateFields);
			if (!isBlank(updateFields.event)) {
				developerKey.event = updateFields.event;
			}
			if (Object.keys(developerKey).length === 0) {
				throw new ApplicationError('Set at least one field to update on the developer key');
			}

			return {
				endpoint: `/api/v1/developer_keys/${getParam('developerKeyId')}`,
				method: 'PUT',
				body: { developer_key: developerKey },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for developerKey`);
	}
}
