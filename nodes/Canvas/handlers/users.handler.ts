import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// USER
// ============================================

export function buildUserRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			// Build the user object from name + user-related additional fields
			const userObj: Record<string, unknown> = {
				name: getParam('name'),
			};
			if (additionalFields.shortName) {
				userObj.short_name = additionalFields.shortName;
			}
			if (additionalFields.sortableName) {
				userObj.sortable_name = additionalFields.sortableName;
			}
			if (additionalFields.email) {
				userObj.email = additionalFields.email;
			}
			if (additionalFields.locale) {
				userObj.locale = additionalFields.locale;
			}
			if (additionalFields.timeZone) {
				userObj.time_zone = additionalFields.timeZone;
			}
			if (additionalFields.termsOfUse !== undefined) {
				userObj.terms_of_use = additionalFields.termsOfUse;
			}

			// Build pseudonym from uniqueId + password-related additional fields
			const pseudonym: Record<string, unknown> = {
				unique_id: getParam('uniqueId'),
			};
			if (additionalFields.password) {
				pseudonym.password = additionalFields.password;
			}
			if (additionalFields.sisUserId) {
				pseudonym.sis_user_id = additionalFields.sisUserId;
			}
			if (additionalFields.sendConfirmation !== undefined) {
				pseudonym.send_confirmation = additionalFields.sendConfirmation;
			}
			if (additionalFields.forceSelfRegistration !== undefined) {
				pseudonym.force_self_registration = additionalFields.forceSelfRegistration;
			}

			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users`,
				method: 'POST',
				body: {
					user: userObj,
					pseudonym,
				},
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users/${getParam('userId')}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}`,
				method: 'GET',
				qs: getParamObject('additionalFields'),
			};

		case 'getSelf':
			return {
				endpoint: '/api/v1/users/self',
				method: 'GET',
				qs: getParamObject('additionalFields'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users`,
				method: 'GET',
				qs: getParamObject('additionalFields'),
			};

		case 'update':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}`,
				method: 'PUT',
				body: { user: getParamObject('updateFields') },
			};

		case 'merge':
			return {
				endpoint: `/api/v1/users/${getParam('sourceUserId')}/merge_into/${getParam('destinationUserId')}`,
				method: 'PUT',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for user`);
	}
}

// ============================================
// LOGIN
// ============================================

export function buildLoginRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const listBy = getParam('listBy');
			if (listBy === 'user') {
				return {
					endpoint: `/api/v1/users/${getParam('userId')}/logins`,
					method: 'GET',
				};
			}
			// listBy === 'account'
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/logins`,
				method: 'GET',
			};
		}

		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const loginBody: Record<string, unknown> = {
				unique_id: getParam('uniqueId'),
			};
			if (additionalFields.password) {
				loginBody.password = additionalFields.password;
			}
			if (additionalFields.sisUserId) {
				loginBody.sis_user_id = additionalFields.sisUserId;
			}
			if (additionalFields.integrationId) {
				loginBody.integration_id = additionalFields.integrationId;
			}
			if (additionalFields.authenticationProviderId) {
				loginBody.authentication_provider_id = additionalFields.authenticationProviderId;
			}
			if (additionalFields.declaredUserType) {
				loginBody.declared_user_type = additionalFields.declaredUserType;
			}

			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/logins`,
				method: 'POST',
				body: {
					user: { id: getParam('userId') },
					login: loginBody,
				},
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/logins/${getParam('loginId')}`,
				method: 'DELETE',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const loginUpdate: Record<string, unknown> = {};

			if (updateFields.uniqueId) {
				loginUpdate.unique_id = updateFields.uniqueId;
			}
			if (updateFields.password) {
				loginUpdate.password = updateFields.password;
			}
			if (updateFields.oldPassword) {
				loginUpdate.old_password = updateFields.oldPassword;
			}
			if (updateFields.sisUserId) {
				loginUpdate.sis_user_id = updateFields.sisUserId;
			}
			if (updateFields.integrationId) {
				loginUpdate.integration_id = updateFields.integrationId;
			}
			if (updateFields.authenticationProviderId) {
				loginUpdate.authentication_provider_id = updateFields.authenticationProviderId;
			}
			if (updateFields.declaredUserType) {
				loginUpdate.declared_user_type = updateFields.declaredUserType;
			}
			if (updateFields.workflowState) {
				loginUpdate.workflow_state = updateFields.workflowState;
			}
			if (updateFields.overrideSisStickiness !== undefined) {
				loginUpdate.override_sis_stickiness = updateFields.overrideSisStickiness;
			}

			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/logins/${getParam('loginId')}`,
				method: 'PUT',
				body: { login: loginUpdate },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for login`);
	}
}

// ============================================
// COMMUNICATION CHANNEL
// ============================================

export function buildCommunicationChannelRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const userId = getParam('userId');

	switch (operation) {
		case 'getAll':
			return {
				endpoint: `/api/v1/users/${userId}/communication_channels`,
				method: 'GET',
			};

		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const channelBody: Record<string, unknown> = {
				type: getParam('channelType'),
				address: getParam('address'),
			};
			if (additionalFields.token) {
				channelBody.token = additionalFields.token;
			}

			const body: Record<string, unknown> = {
				communication_channel: channelBody,
			};
			if (additionalFields.skipConfirmation !== undefined) {
				body.skip_confirmation = additionalFields.skipConfirmation;
			}

			return {
				endpoint: `/api/v1/users/${userId}/communication_channels`,
				method: 'POST',
				body,
			};
		}

		case 'delete': {
			const deleteBy = getParam('deleteBy');
			if (deleteBy === 'id') {
				return {
					endpoint: `/api/v1/users/${userId}/communication_channels/${getParam('channelId')}`,
					method: 'DELETE',
				};
			}
			// deleteBy === 'typeAndAddress'
			const channelType = getParam('channelType');
			const address = encodeURIComponent(getParam('address'));
			return {
				endpoint: `/api/v1/users/${userId}/communication_channels/${channelType}/${address}`,
				method: 'DELETE',
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for communicationChannel`,
			);
	}
}

// ============================================
// USER OBSERVEE
// ============================================

export function buildUserObserveeRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const userId = getParam('userId');

	switch (operation) {
		case 'getAll': {
			const additionalFields = getParamObject('additionalFields');
			return {
				endpoint: `/api/v1/users/${userId}/observees`,
				method: 'GET',
				qs: additionalFields,
			};
		}

		case 'get':
			return {
				endpoint: `/api/v1/users/${userId}/observees/${getParam('observeeId')}`,
				method: 'GET',
			};

		case 'add': {
			const additionalFields = getParamObject('additionalFields');
			const qs: Record<string, unknown> = {};
			if (additionalFields.rootAccountId) {
				qs.root_account_id = additionalFields.rootAccountId;
			}
			return {
				endpoint: `/api/v1/users/${userId}/observees/${getParam('observeeId')}`,
				method: 'PUT',
				qs,
			};
		}

		case 'addWithCredentials': {
			const addMethod = getParam('addMethod');
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {};
			const qs: Record<string, unknown> = {};

			if (additionalFields.rootAccountId) {
				qs.root_account_id = additionalFields.rootAccountId;
			}

			if (addMethod === 'credentials') {
				body.observee = {
					unique_id: getParam('uniqueId'),
					password: getParam('password'),
				};
			} else if (addMethod === 'pairingCode') {
				body.pairing_code = getParam('pairingCode');
			} else if (addMethod === 'accessToken') {
				qs.access_token = getParam('accessToken');
			}

			return {
				endpoint: `/api/v1/users/${userId}/observees`,
				method: 'POST',
				body,
				qs,
			};
		}

		case 'remove': {
			const additionalFields = getParamObject('additionalFields');
			const qs: Record<string, unknown> = {};
			if (additionalFields.rootAccountId) {
				qs.root_account_id = additionalFields.rootAccountId;
			}
			return {
				endpoint: `/api/v1/users/${userId}/observees/${getParam('observeeId')}`,
				method: 'DELETE',
				qs,
			};
		}

		case 'listObservers': {
			const additionalFields = getParamObject('additionalFields');
			return {
				endpoint: `/api/v1/users/${userId}/observers`,
				method: 'GET',
				qs: additionalFields,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for userObservee`);
	}
}
