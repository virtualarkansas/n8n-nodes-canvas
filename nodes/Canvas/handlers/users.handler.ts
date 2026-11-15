import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Helpers
// ============================================

/**
 * Copy the fields of a UI collection into a Canvas object under Canvas' own names.
 * Only fields the user actually added are copied. With `keepBlank` an empty string
 * is sent as well, which is how Canvas clears a value on update.
 */
function mapFields(
	source: Record<string, unknown>,
	names: Record<string, string>,
	keepBlank = false,
): Record<string, unknown> {
	const target: Record<string, unknown> = {};
	for (const [uiName, canvasName] of Object.entries(names)) {
		const value = source[uiName];
		if (value === undefined || value === null) continue;
		if (value === '' && !keepBlank) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		target[canvasName] = value;
	}
	return target;
}

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
			const fields = getParamObject('additionalFields');

			const user = {
				name: getParam('name'),
				...mapFields(fields, {
					shortName: 'short_name',
					sortableName: 'sortable_name',
					locale: 'locale',
					timeZone: 'time_zone',
					termsOfUse: 'terms_of_use',
					skipRegistration: 'skip_registration',
				}),
			};

			const pseudonym = {
				unique_id: getParam('uniqueId'),
				...mapFields(fields, {
					password: 'password',
					sisUserId: 'sis_user_id',
					integrationId: 'integration_id',
					sendConfirmation: 'send_confirmation',
					forceSelfRegistration: 'force_self_registration',
					authenticationProviderId: 'authentication_provider_id',
				}),
			};

			// Canvas has no user[email]: the address is the user's first communication channel.
			const channel = mapFields(fields, {
				email: 'address',
				skipConfirmation: 'skip_confirmation',
				confirmationUrl: 'confirmation_url',
			});
			if (channel.address !== undefined) {
				channel.type = 'email';
			}

			const body: Record<string, unknown> = {
				user,
				pseudonym,
				...mapFields(fields, {
					enableSisReactivation: 'enable_sis_reactivation',
					forceValidations: 'force_validations',
					destination: 'destination',
				}),
			};
			if (Object.keys(channel).length > 0) {
				body.communication_channel = channel;
			}

			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users`,
				method: 'POST',
				body,
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users/${getParam('userId')}`,
				method: 'DELETE',
			};

		case 'restore':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users/${getParam('userId')}/restore`,
				method: 'PUT',
			};

		case 'get':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}`,
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { include: 'include' }),
			};

		case 'getSelf':
			return {
				endpoint: '/api/v1/users/self',
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { include: 'include' }),
			};

		case 'getProfile':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/profile`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/users`,
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), {
					enrollmentType: 'enrollment_type',
					include: 'include',
					includeDeletedUsers: 'include_deleted_users',
					searchTerm: 'search_term',
					sort: 'sort',
					order: 'order',
				}),
			};

		case 'update': {
			const fields = getParamObject('updateFields');
			// A field that was added but left empty is not sent (an empty name or email must never
			// reach Canvas by accident). The profile texts are the exception: empty clears them.
			const user: Record<string, unknown> = {
				...mapFields(fields, {
					email: 'email',
					event: 'event',
					locale: 'locale',
					name: 'name',
					shortName: 'short_name',
					sortableName: 'sortable_name',
					timeZone: 'time_zone',
				}),
				...mapFields(fields, { bio: 'bio', pronouns: 'pronouns', title: 'title' }, true),
			};
			const avatar = mapFields(fields, { avatarToken: 'token', avatarUrl: 'url' });
			if (Object.keys(avatar).length > 0) {
				user.avatar = avatar;
			}
			// Query string, not body: Canvas reads a JSON `false` in the body as "not given".
			const qs = mapFields(fields, { overrideSisStickiness: 'override_sis_stickiness' });
			return {
				endpoint: `/api/v1/users/${getParam('userId')}`,
				method: 'PUT',
				body: { user },
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'merge': {
			const source = getParam('sourceUserId');
			const destination = getParam('destinationUserId');
			const destinationAccountId = getParam('destinationAccountId');
			return {
				endpoint: destinationAccountId
					? `/api/v1/users/${source}/merge_into/accounts/${destinationAccountId}/users/${destination}`
					: `/api/v1/users/${source}/merge_into/${destination}`,
				method: 'PUT',
			};
		}

		case 'split':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/split`,
				method: 'POST',
			};

		case 'terminateSessions':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/sessions`,
				method: 'DELETE',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for user`);
	}
}

// ============================================
// LOGIN
// ============================================

const LOGIN_FIELDS: Record<string, string> = {
	uniqueId: 'unique_id',
	password: 'password',
	oldPassword: 'old_password',
	sisUserId: 'sis_user_id',
	integrationId: 'integration_id',
	authenticationProviderId: 'authentication_provider_id',
	declaredUserType: 'declared_user_type',
	workflowState: 'workflow_state',
};

/** Workflows saved before the dropdown was corrected carry "admin"; Canvas only knows "administrative". */
function fixDeclaredUserType(login: Record<string, unknown>): Record<string, unknown> {
	if (login.declared_user_type === 'admin') {
		login.declared_user_type = 'administrative';
	}
	return login;
}

export function buildLoginRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const listBy = getParam('listBy', 'user');
			if (listBy === 'user') {
				return {
					endpoint: `/api/v1/users/${getParam('userId')}/logins`,
					method: 'GET',
				};
			}
			// By account: Canvas lists the logins of one user within a root account.
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/logins`,
				method: 'GET',
				qs: { user: { id: getParam('userId') } },
			};
		}

		case 'create':
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/logins`,
				method: 'POST',
				body: {
					user: { id: getParam('userId') },
					login: fixDeclaredUserType({
						unique_id: getParam('uniqueId'),
						...mapFields(getParamObject('additionalFields'), LOGIN_FIELDS),
					}),
				},
			};

		case 'delete':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/logins/${getParam('loginId')}`,
				method: 'DELETE',
			};

		case 'update': {
			const fields = getParamObject('updateFields');
			// An empty SIS ID, integration ID or provider is sent as such: that is how Canvas
			// clears them. Any other field left empty is not sent at all.
			const login = fixDeclaredUserType({
				...mapFields(fields, LOGIN_FIELDS),
				...mapFields(
					fields,
					{
						sisUserId: 'sis_user_id',
						integrationId: 'integration_id',
						authenticationProviderId: 'authentication_provider_id',
					},
					true,
				),
			});
			// Query string, not body: Canvas reads a JSON `false` in the body as "not given".
			const qs = mapFields(fields, { overrideSisStickiness: 'override_sis_stickiness' });
			return {
				endpoint: `/api/v1/accounts/${getParam('accountId')}/logins/${getParam('loginId')}`,
				method: 'PUT',
				body: { login },
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'resetPassword':
			return {
				endpoint: '/api/v1/users/reset_password',
				method: 'POST',
				body: { email: getParam('email') },
			};

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
			const fields = getParamObject('additionalFields');
			return {
				endpoint: `/api/v1/users/${userId}/communication_channels`,
				method: 'POST',
				body: {
					communication_channel: {
						type: getParam('channelType'),
						address: getParam('address'),
						...mapFields(fields, { token: 'token' }),
					},
					...mapFields(fields, { skipConfirmation: 'skip_confirmation' }),
				},
			};
		}

		case 'delete': {
			if (getParam('deleteBy', 'id') === 'id') {
				return {
					endpoint: `/api/v1/users/${userId}/communication_channels/${getParam('channelId')}`,
					method: 'DELETE',
				};
			}
			return {
				endpoint: `/api/v1/users/${userId}/communication_channels/${getParam('channelType')}/${encodeURIComponent(getParam('address'))}`,
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
	const rootAccount = (): Record<string, unknown> =>
		mapFields(getParamObject('additionalFields'), { rootAccountId: 'root_account_id' });

	switch (operation) {
		case 'getAll':
			return {
				endpoint: `/api/v1/users/${userId}/observees`,
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { include: 'include' }),
			};

		case 'get':
			return {
				endpoint: `/api/v1/users/${userId}/observees/${getParam('observeeId')}`,
				method: 'GET',
			};

		case 'getObserver':
			return {
				endpoint: `/api/v1/users/${userId}/observers/${getParam('observerId')}`,
				method: 'GET',
			};

		case 'add':
			return {
				endpoint: `/api/v1/users/${userId}/observees/${getParam('observeeId')}`,
				method: 'PUT',
				qs: rootAccount(),
			};

		case 'addWithCredentials': {
			const addMethod = getParam('addMethod', 'pairingCode');
			const body: Record<string, unknown> = {};

			if (addMethod === 'credentials') {
				body.observee = {
					unique_id: getParam('uniqueId'),
					password: getParam('password'),
				};
			} else if (addMethod === 'pairingCode') {
				body.pairing_code = getParam('pairingCode');
			} else if (addMethod === 'accessToken') {
				// In the body, never in the URL: query strings end up in access logs.
				body.access_token = getParam('accessToken');
			}

			return {
				endpoint: `/api/v1/users/${userId}/observees`,
				method: 'POST',
				body,
				qs: rootAccount(),
			};
		}

		case 'remove':
			return {
				endpoint: `/api/v1/users/${userId}/observees/${getParam('observeeId')}`,
				method: 'DELETE',
				qs: rootAccount(),
			};

		case 'listObservers':
			return {
				endpoint: `/api/v1/users/${userId}/observers`,
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { include: 'include' }),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for userObservee`);
	}
}
