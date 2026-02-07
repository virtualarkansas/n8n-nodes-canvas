import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

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
			if (additionalFields.expires_at) {
				tokenBody.expires_at = additionalFields.expires_at;
			}
			if (additionalFields.scopes) {
				tokenBody.scopes = (additionalFields.scopes as string)
					.split(',')
					.map((s: string) => s.trim());
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
			return {
				endpoint: `/api/v1/users/${userId}/tokens`,
				method: 'GET',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const tokenUpdate: Record<string, unknown> = {};

			if (updateFields.purpose) {
				tokenUpdate.purpose = updateFields.purpose;
			}
			if (updateFields.expires_at) {
				tokenUpdate.expires_at = updateFields.expires_at;
			}
			if (updateFields.regenerate !== undefined) {
				tokenUpdate.regenerate = updateFields.regenerate;
			}
			if (updateFields.scopes) {
				tokenUpdate.scopes = (updateFields.scopes as string)
					.split(',')
					.map((s: string) => s.trim());
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

			if (options.group_by) {
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

export function buildAuthenticationProviderRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				auth_type: getParam('authType'),
				...additionalFields,
			};

			// Parse federated_attributes from JSON string if present
			if (body.federated_attributes && typeof body.federated_attributes === 'string') {
				try {
					body.federated_attributes = JSON.parse(body.federated_attributes as string);
				} catch {
					// Leave as-is if not valid JSON
				}
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers`,
				method: 'POST',
				body,
			};
		}

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
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers/${getParam('providerId')}`,
				method: 'PUT',
				body: { workflow_state: 'active' },
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {
				...updateFields,
			};

			// Parse federated_attributes from JSON string if present
			if (body.federated_attributes && typeof body.federated_attributes === 'string') {
				try {
					body.federated_attributes = JSON.parse(body.federated_attributes as string);
				} catch {
					// Leave as-is if not valid JSON
				}
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/authentication_providers/${getParam('providerId')}`,
				method: 'PUT',
				body,
			};
		}

		case 'updateSsoSettings': {
			const ssoSettings = getParamObject('ssoSettings');

			return {
				endpoint: `/api/v1/accounts/${accountId}/sso_settings`,
				method: 'PUT',
				body: ssoSettings,
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

	if (options.start_time) {
		qs.start_time = options.start_time;
	}
	if (options.end_time) {
		qs.end_time = options.end_time;
	}

	switch (operation) {
		case 'getAllByAccount':
			return {
				endpoint: `/api/v1/audit/authentication/accounts/${getParam('accountId')}`,
				method: 'GET',
				qs,
			};

		case 'getAllByLogin':
			return {
				endpoint: `/api/v1/audit/authentication/logins/${getParam('loginId')}`,
				method: 'GET',
				qs,
			};

		case 'getAllByUser':
			return {
				endpoint: `/api/v1/audit/authentication/users/${getParam('userId')}`,
				method: 'GET',
				qs,
			};

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for authenticationsLog`,
			);
	}
}

// ============================================
// DEVELOPER KEY
// ============================================

export function buildDeveloperKeyRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const accountId = getParam('accountId');
			const additionalFields = getParamObject('additionalFields');
			const developerKey: Record<string, unknown> = {};

			if (additionalFields.name) {
				developerKey.name = additionalFields.name;
			}
			if (additionalFields.email) {
				developerKey.email = additionalFields.email;
			}
			if (additionalFields.notes) {
				developerKey.notes = additionalFields.notes;
			}
			if (additionalFields.icon_url) {
				developerKey.icon_url = additionalFields.icon_url;
			}
			if (additionalFields.redirect_uris) {
				developerKey.redirect_uris = additionalFields.redirect_uris;
			}
			if (additionalFields.vendor_code) {
				developerKey.vendor_code = additionalFields.vendor_code;
			}
			if (additionalFields.visible !== undefined) {
				developerKey.visible = additionalFields.visible;
			}
			if (additionalFields.auto_expire_tokens !== undefined) {
				developerKey.auto_expire_tokens = additionalFields.auto_expire_tokens;
			}
			if (additionalFields.scopes) {
				developerKey.scopes = (additionalFields.scopes as string)
					.split(',')
					.map((s: string) => s.trim());
			}
			if (additionalFields.require_scopes !== undefined) {
				developerKey.require_scopes = additionalFields.require_scopes;
			}
			if (additionalFields.allow_includes !== undefined) {
				developerKey.allow_includes = additionalFields.allow_includes;
			}
			if (additionalFields.test_cluster_only !== undefined) {
				developerKey.test_cluster_only = additionalFields.test_cluster_only;
			}
			if (additionalFields.client_credentials_audience) {
				developerKey.client_credentials_audience = additionalFields.client_credentials_audience;
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

			if (options.inherited !== undefined) {
				qs.inherited = options.inherited;
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/developer_keys`,
				method: 'GET',
				qs,
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const developerKey: Record<string, unknown> = {};

			if (updateFields.name) {
				developerKey.name = updateFields.name;
			}
			if (updateFields.email) {
				developerKey.email = updateFields.email;
			}
			if (updateFields.notes) {
				developerKey.notes = updateFields.notes;
			}
			if (updateFields.icon_url) {
				developerKey.icon_url = updateFields.icon_url;
			}
			if (updateFields.redirect_uris) {
				developerKey.redirect_uris = updateFields.redirect_uris;
			}
			if (updateFields.vendor_code) {
				developerKey.vendor_code = updateFields.vendor_code;
			}
			if (updateFields.visible !== undefined) {
				developerKey.visible = updateFields.visible;
			}
			if (updateFields.auto_expire_tokens !== undefined) {
				developerKey.auto_expire_tokens = updateFields.auto_expire_tokens;
			}
			if (updateFields.scopes) {
				developerKey.scopes = (updateFields.scopes as string)
					.split(',')
					.map((s: string) => s.trim());
			}
			if (updateFields.require_scopes !== undefined) {
				developerKey.require_scopes = updateFields.require_scopes;
			}
			if (updateFields.allow_includes !== undefined) {
				developerKey.allow_includes = updateFields.allow_includes;
			}
			if (updateFields.test_cluster_only !== undefined) {
				developerKey.test_cluster_only = updateFields.test_cluster_only;
			}
			if (updateFields.client_credentials_audience) {
				developerKey.client_credentials_audience = updateFields.client_credentials_audience;
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
