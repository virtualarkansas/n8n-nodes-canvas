import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { collectionRows, mapFields, parseJson, toList } from './shared';

// ============================================
// USER
// ============================================

/** The settings Canvas documents for PUT /users/:id/settings, under their UI names. */
const USER_SETTINGS: Record<string, string> = {
	collapseCourseNav: 'collapse_course_nav',
	collapseGlobalNav: 'collapse_global_nav',
	commentLibrarySuggestionsEnabled: 'comment_library_suggestions_enabled',
	elementaryDashboardDisabled: 'elementary_dashboard_disabled',
	hideDashcardColorOverlays: 'hide_dashcard_color_overlays',
	manualMarkAsRead: 'manual_mark_as_read',
	releaseNotesBadgeDisabled: 'release_notes_badge_disabled',
	widgetDashboardDarkMode: 'widget_dashboard_dark_mode',
	widgetDashboardUserPreference: 'widget_dashboard_user_preference',
};

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

		case 'expireMobileSessions':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/mobile_sessions`,
				method: 'DELETE',
				qs: mapFields(getParamObject('additionalFields'), { skipAdmins: 'skip_admins' }),
			};

		// ---- Preferences ----

		case 'getSettings':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/settings`,
				method: 'GET',
			};

		case 'updateSettings':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/settings`,
				method: 'PUT',
				body: mapFields(getParamObject('updateFields'), USER_SETTINGS),
			};

		case 'getColors':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/colors`,
				method: 'GET',
				// Canvas wraps the map: { "custom_colors": { "course_42": "#abc123" } }
				dataKey: 'custom_colors',
			};

		case 'getColor':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/colors/${getParam('assetString').trim()}`,
				method: 'GET',
			};

		case 'setColor':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/colors/${getParam('assetString').trim()}`,
				method: 'PUT',
				// In the body, so a leading "#" needs no escaping.
				body: { hexcode: getParam('hexcode').trim() },
			};

		case 'getDashboardPositions':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/dashboard_positions`,
				method: 'GET',
				// Canvas wraps the map: { "dashboard_positions": { "course_42": 1 } }
				dataKey: 'dashboard_positions',
			};

		case 'updateDashboardPositions': {
			const positions: Record<string, number> = {};
			for (const entry of collectionRows(getParamObject('positions'), 'position', 'Positions')) {
				const asset = String(entry.assetString ?? '').trim();
				if (asset === '') continue;
				const position = Number(entry.position);
				if (!Number.isInteger(position)) {
					throw new ApplicationError(
						`The dashboard position of "${asset}" must be a whole number, got "${String(entry.position)}"`,
					);
				}
				positions[asset] = position;
			}
			// Canvas answers a request without positions with a server error.
			if (Object.keys(positions).length === 0) {
				throw new ApplicationError('Add at least one dashboard position (asset and position)');
			}
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/dashboard_positions`,
				method: 'PUT',
				body: { dashboard_positions: positions },
				dataKey: 'dashboard_positions',
			};
		}

		case 'setTextEditorPreference':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/text_editor_preference`,
				method: 'PUT',
				// An empty value is meaningful: it clears the preference.
				body: { text_editor_preference: getParam('textEditorPreference') },
			};

		case 'setFilesUiVersion':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/files_ui_version_preference`,
				method: 'PUT',
				body: { files_ui_version: getParam('filesUiVersion', 'v2') },
			};

		case 'getAvatars':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/avatars`,
				method: 'GET',
			};

		// ---- Activity of a user ----

		case 'getPageViews':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/page_views`,
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), {
					endTime: 'end_time',
					startTime: 'start_time',
				}),
			};

		case 'getMissingSubmissions': {
			const fields = getParamObject('additionalFields');
			const qs = mapFields(fields, {
				filter: 'filter',
				include: 'include',
				observedUserId: 'observed_user_id',
			});
			const courseIds = toList(fields.courseIds);
			if (courseIds.length > 0) {
				qs.course_ids = courseIds;
			}
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/missing_submissions`,
				method: 'GET',
				qs,
			};
		}

		case 'getGradedSubmissions':
			return {
				endpoint: `/api/v1/users/${getParam('userId')}/graded_submissions`,
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), {
					include: 'include',
					onlyCurrentEnrollments: 'only_current_enrollments',
					onlyPublishedAssignments: 'only_published_assignments',
				}),
			};

		// ---- The current user's dashboard (Canvas offers these for the token's user only) ----

		case 'getActivityStream':
			return {
				endpoint: '/api/v1/users/self/activity_stream',
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { onlyActiveCourses: 'only_active_courses' }),
			};

		case 'getActivityStreamSummary':
			return {
				endpoint: '/api/v1/users/self/activity_stream/summary',
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { onlyActiveCourses: 'only_active_courses' }),
			};

		case 'hideStreamItem':
			return {
				endpoint: `/api/v1/users/self/activity_stream/${getParam('streamItemId')}`,
				method: 'DELETE',
			};

		case 'hideAllStreamItems':
			return {
				endpoint: '/api/v1/users/self/activity_stream',
				method: 'DELETE',
			};

		case 'getTodoItems':
			return {
				endpoint: '/api/v1/users/self/todo',
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { include: 'include' }),
			};

		case 'getTodoItemCount':
			return {
				endpoint: '/api/v1/users/self/todo_item_count',
				method: 'GET',
				qs: mapFields(getParamObject('additionalFields'), { include: 'include' }),
			};

		case 'getUpcomingEvents':
			return {
				endpoint: '/api/v1/users/self/upcoming_events',
				method: 'GET',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for user`);
	}
}

// ============================================
// USER CUSTOM DATA
// ============================================

/**
 * The scope is a path into the stored JSON ("body/measurements/chest"). Each of its
 * parts is one path segment for Canvas, so the slashes between them are sent as they
 * are and only the parts themselves are encoded.
 */
function customDataScopePath(scope: unknown): string {
	const parts = String(scope ?? '')
		.split('/')
		.map((part) => part.trim())
		.filter((part) => part !== '');
	return parts.map((part) => `/${encodeURIComponent(part)}`).join('');
}

/** The value of the "Data (JSON)" field: any JSON value, as text from the editor. */
function parseCustomData(text: string): unknown {
	const data = parseJson(
		text,
		'Data is not valid JSON. Put plain text in double quotes ("like this"); ' +
			'pass a value from an expression as JSON text: {{ JSON.stringify($json.value) }}',
	);
	if (data === undefined) {
		throw new ApplicationError('Enter the data to store (any JSON value)');
	}
	return data;
}

export function buildUserCustomDataRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const userId = getParam('userId');
	const namespace = getParam('namespace');
	// Read from the options collection on purpose: a top-level parameter value is
	// percent-encoded as ONE path segment by the node ("a/b" would become "a%2Fb").
	const endpoint = `/api/v1/users/${userId}/custom_data${customDataScopePath(getParamObject('options').scope)}`;

	switch (operation) {
		case 'get':
			return { endpoint, method: 'GET', qs: { ns: namespace } };

		case 'set':
			return {
				endpoint,
				method: 'PUT',
				body: { ns: namespace, data: parseCustomData(getParam('data')) },
			};

		case 'delete':
			return { endpoint, method: 'DELETE', qs: { ns: namespace } };

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for userCustomData`);
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
