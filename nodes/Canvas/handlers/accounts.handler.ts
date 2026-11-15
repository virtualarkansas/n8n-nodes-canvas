import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { downloadIfAsked, pollUntil, stateIn } from './shared';

/** Where a report keeps its generated file. A report that is not complete has none. */
const REPORT_FILE = {
	urlField: 'attachment.url',
	fileNameField: 'attachment.filename',
	contentTypeField: 'attachment.content-type',
	optional: true,
};

// ============================================
// Shared helpers
// ============================================

/** "1, 2 ,3" (or an array from an expression) -> ['1', '2', '3']; empty entries are dropped. */
function toList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

/** A `json` field arrives as text from the editor and as an object from an expression. */
function parseJsonObject(value: unknown, fieldLabel: string): Record<string, unknown> {
	if (value === undefined || value === null) {
		return {};
	}
	let parsed: unknown = value;
	if (typeof value === 'string') {
		if (value.trim() === '') {
			return {};
		}
		try {
			parsed = JSON.parse(value);
		} catch {
			throw new ApplicationError(`Invalid JSON in ${fieldLabel}. Expected a JSON object.`);
		}
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new ApplicationError(`Invalid value in ${fieldLabel}. Expected a JSON object.`);
	}
	return parsed as Record<string, unknown>;
}

/** Text and date fields that were added to a collection but left empty are not sent. */
function isBlank(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

// ============================================
// Account
// ============================================

const ACCOUNT_LIST_ENDPOINTS: Record<string, string> = {
	all: '/api/v1/accounts',
	courseAdmin: '/api/v1/course_accounts',
	courseCreation: '/api/v1/course_creation_accounts',
	manageable: '/api/v1/manageable_accounts',
};

export function buildAccountRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'get': {
			const options = getParamObject('options');
			const includes = toList(options.includes);
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}`,
				// Canvas reads `includes[]` here (not `include[]` as on the list endpoints).
				...(includes.length > 0 ? { qs: { includes } } : {}),
			};
		}

		case 'getAll': {
			const scope = getParam('accountScope', 'all');
			const endpoint = ACCOUNT_LIST_ENDPOINTS[scope];
			if (!endpoint) {
				throw new ApplicationError(`Unknown value "${scope}" for Accounts to List`);
			}
			const include = scope === 'all' ? toList(getParamObject('options').include) : [];
			return {
				method: 'GET',
				endpoint,
				...(include.length > 0 ? { qs: { include } } : {}),
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const account: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(updateFields)) {
				if (key === 'settings' || key === 'services') {
					const parsed = parseJsonObject(value, key === 'settings' ? 'Settings (JSON)' : 'Services (JSON)');
					if (Object.keys(parsed).length > 0) {
						account[key] = parsed;
					}
				} else if (key === 'course_template_id' || key === 'sis_account_id') {
					// An empty value is meaningful: it clears the SIS ID / inherits the template.
					account[key] = value;
				} else if (!isBlank(value)) {
					account[key] = value;
				}
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}`,
				body: { account },
			};
		}

		case 'createSubAccount': {
			const additionalFields = getParamObject('additionalFields');
			const account: Record<string, unknown> = { name: getParam('name') };
			for (const [key, value] of Object.entries(additionalFields)) {
				if (!isBlank(value)) {
					account[key] = value;
				}
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/sub_accounts`,
				body: { account },
			};
		}

		case 'deleteSubAccount':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/sub_accounts/${getParam('subAccountId')}`,
			};

		case 'getSubAccounts': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			const include = toList(options.include);
			if (include.length > 0) {
				qs.include = include;
			}
			if (!isBlank(options.order)) {
				qs.order = options.order;
			}
			if (options.recursive !== undefined) {
				qs.recursive = options.recursive;
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sub_accounts`,
				qs,
			};
		}

		case 'getCourses': {
			const filters = getParamObject('filters');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			for (const key of [
				'blueprint',
				'blueprint_associated',
				'completed',
				'homeroom',
				'public',
				'published',
				'with_enrollments',
			]) {
				if (filters[key] !== undefined && filters[key] !== '') {
					qs[key] = filters[key];
				}
			}
			for (const key of ['ends_after', 'enrollment_term_id', 'search_term', 'starts_before']) {
				if (!isBlank(filters[key])) {
					qs[key] = filters[key];
				}
			}
			// The search mode only means something together with a search term.
			if (!isBlank(filters.search_term) && !isBlank(filters.search_by)) {
				qs.search_by = filters.search_by;
			}
			for (const key of [
				'by_subaccounts',
				'by_teachers',
				'enrollment_type',
				'enrollment_workflow_state',
				'state',
			]) {
				const list = toList(filters[key]);
				if (list.length > 0) {
					qs[key] = list;
				}
			}

			const include = toList(options.include);
			if (include.length > 0) {
				qs.include = include;
			}
			if (!isBlank(options.sort)) {
				qs.sort = options.sort;
				// Canvas only applies a direction when both are present.
				qs.order = isBlank(options.order) ? 'asc' : options.order;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/courses`,
				qs,
			};
		}

		case 'getSettings':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/settings`,
			};

		case 'getPermissions': {
			const permissions = toList(getParam('permissions'));
			if (permissions.length === 0) {
				throw new ApplicationError('Enter at least one permission name to check');
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/permissions`,
				qs: { permissions },
			};
		}

		case 'getHelpLinks':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/help_links`,
			};

		case 'getTermsOfService':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/terms_of_service`,
			};

		case 'restoreUser':
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/users/${getParam('userId')}/restore`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for account`);
	}
}

// ============================================
// Account Report
// ============================================

export function buildAccountReportRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');
	const reportType = getParam('reportType');
	const reportId = getParam('reportId');

	switch (operation) {
		case 'listAvailable': {
			const include = toList(getParamObject('options').include);
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/reports`,
				...(include.length > 0 ? { qs: { include } } : {}),
			};
		}

		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const parameters: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(additionalFields)) {
				if (key === 'extra_parameters') {
					continue;
				}
				if (Array.isArray(value)) {
					if (value.length > 0) {
						parameters[key] = value;
					}
				} else if (!isBlank(value)) {
					parameters[key] = value;
				}
			}
			// Reports added by plugins take parameters this node cannot know about.
			Object.assign(
				parameters,
				parseJsonObject(additionalFields.extra_parameters, 'Other Parameters (JSON)'),
			);

			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}`,
				...(Object.keys(parameters).length > 0 ? { body: { parameters } } : {}),
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}/${reportId}`,
				download: downloadIfAsked(getParam, REPORT_FILE),
			};

		case 'waitForCompletion':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}/${reportId}`,
				poll: pollUntil(getParam, stateIn('status', ['complete', 'error', 'aborted', 'deleted'])),
				download: downloadIfAsked(getParam, REPORT_FILE),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}`,
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}/${reportId}`,
			};

		case 'abort':
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}/${reportId}/abort`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for accountReport`);
	}
}

// ============================================
// Account Notification
// ============================================

export function buildAccountNotificationRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');
	const notificationId = getParam('notificationId');

	switch (operation) {
		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			for (const key of ['include_all', 'include_past', 'show_is_closed']) {
				if (options[key] !== undefined && options[key] !== '') {
					qs[key] = options[key];
				}
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/account_notifications`,
				qs,
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/account_notifications/${notificationId}`,
			};

		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const notification: Record<string, unknown> = {
				subject: getParam('subject'),
				message: getParam('message'),
				start_at: getParam('startAt'),
				end_at: getParam('endAt'),
			};

			if (!isBlank(additionalFields.icon)) {
				notification.icon = additionalFields.icon;
			}
			if (additionalFields.send_message !== undefined && additionalFields.send_message !== '') {
				notification.send_message = additionalFields.send_message;
			}

			const body: Record<string, unknown> = {
				account_notification: notification,
			};

			const roles = toList(additionalFields.roles);
			if (roles.length > 0) {
				body.account_notification_roles = roles;
			}

			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/account_notifications`,
				body,
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const notification: Record<string, unknown> = {};

			// Canvas blanks the message when an update does not carry it and then rejects the
			// update, so the message is a required field here.
			const message = getParam('message');
			if (isBlank(message)) {
				throw new ApplicationError(
					'Message is required: Canvas rejects an update of a notification that does not include the message text. Send the current text again to keep it.',
				);
			}
			notification.message = message;

			for (const key of ['subject', 'start_at', 'end_at', 'icon']) {
				if (!isBlank(updateFields[key])) {
					notification[key] = updateFields[key];
				}
			}
			if (updateFields.send_message !== undefined && updateFields.send_message !== '') {
				notification.send_message = updateFields.send_message;
			}

			const body: Record<string, unknown> = {
				account_notification: notification,
			};

			// Canvas replaces the role list on every update: leaving it out removes all roles.
			const roles = toList(updateFields.roles);
			if (roles.length > 0) {
				body.account_notification_roles = roles;
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/account_notifications/${notificationId}`,
				body,
			};
		}

		case 'close': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.remove !== undefined && options.remove !== '') {
				qs.remove = options.remove;
			}
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/account_notifications/${notificationId}`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for accountNotification`,
			);
	}
}

// ============================================
// Account Calendar
// ============================================

export function buildAccountCalendarRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/account_calendars/${accountId}`,
			};

		case 'getAll': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: '/api/v1/account_calendars',
				...(isBlank(options.search_term) ? {} : { qs: { search_term: options.search_term } }),
				// Canvas answers { account_calendars: [...], total_results: n }.
				dataKey: 'account_calendars',
			};
		}

		case 'getAllForAccount': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (!isBlank(options.filter)) {
				qs.filter = options.filter;
			}
			if (!isBlank(options.search_term)) {
				qs.search_term = options.search_term;
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/account_calendars`,
				qs,
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};
			for (const key of ['auto_subscribe', 'visible']) {
				if (updateFields[key] !== undefined && updateFields[key] !== '') {
					body[key] = updateFields[key];
				}
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/account_calendars/${accountId}`,
				body,
			};
		}

		case 'countVisible':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/visible_calendars_count`,
			};

		case 'updateMany': {
			const calendarsJson = getParam('calendars');
			let calendars: unknown;
			try {
				calendars = JSON.parse(calendarsJson);
			} catch {
				if (calendarsJson.includes('[object Object]')) {
					// A list of objects from an expression reaches this point flattened to text.
					throw new ApplicationError(
						'Calendars received a list of objects instead of JSON text. Wrap the expression in JSON.stringify(), e.g. {{ JSON.stringify($json.calendars) }}.',
					);
				}
				throw new ApplicationError(
					'Invalid JSON in Calendars. Expected a JSON array of objects like [{"id": 1, "visible": true, "auto_subscribe": false}].',
				);
			}
			if (!Array.isArray(calendars) || calendars.length === 0) {
				throw new ApplicationError(
					'Calendars must be a JSON array with at least one object like {"id": 1, "visible": true}.',
				);
			}
			for (const calendar of calendars) {
				if (
					calendar === null ||
					typeof calendar !== 'object' ||
					isBlank((calendar as Record<string, unknown>).id)
				) {
					throw new ApplicationError('Every entry in Calendars needs an "id" (the account ID).');
				}
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/account_calendars`,
				// Canvas expects the JSON array itself as the request body.
				body: calendars as unknown as Record<string, unknown>,
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for accountCalendar`,
			);
	}
}

// ============================================
// Admin
// ============================================

export function buildAdminRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				user_id: getParam('userId'),
			};
			if (!isBlank(additionalFields.role_id)) {
				body.role_id = additionalFields.role_id;
			}
			if (additionalFields.send_confirmation !== undefined && additionalFields.send_confirmation !== '') {
				body.send_confirmation = additionalFields.send_confirmation;
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/admins`,
				body,
			};
		}

		case 'delete': {
			const userId = getParam('userId');
			const roleId = getParam('roleId');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/admins/${userId}`,
				// Without a role Canvas removes the built-in Account Admin role.
				...(roleId ? { qs: { role_id: roleId } } : {}),
			};
		}

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.include_deleted !== undefined && options.include_deleted !== '') {
				qs.include_deleted = options.include_deleted;
			}
			if (!isBlank(options.search_term)) {
				qs.search_term = options.search_term;
			}
			const userIds = toList(options.user_id);
			if (userIds.length > 0) {
				qs.user_id = userIds;
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/admins`,
				qs,
			};
		}

		case 'getSelfRoles':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/admins/self`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for admin`);
	}
}

// ============================================
// Role
// ============================================

export function buildRoleRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');
	const roleId = getParam('roleId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				label: getParam('label'),
			};
			if (!isBlank(additionalFields.base_role_type)) {
				body.base_role_type = additionalFields.base_role_type;
			}
			const permissions = parseJsonObject(additionalFields.permissions, 'Permissions');
			if (Object.keys(permissions).length > 0) {
				body.permissions = permissions;
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/roles`,
				body,
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/roles/${roleId}`,
			};

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.show_inherited !== undefined && options.show_inherited !== '') {
				qs.show_inherited = options.show_inherited;
			}
			const state = toList(options.state);
			if (state.length > 0) {
				qs.state = state;
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/roles`,
				qs,
			};
		}

		case 'getPermissions': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/roles/permissions`,
				...(isBlank(options.search_term) ? {} : { qs: { search_term: options.search_term } }),
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};
			if (!isBlank(updateFields.label)) {
				body.label = updateFields.label;
			}
			const permissions = parseJsonObject(updateFields.permissions, 'Permissions');
			if (Object.keys(permissions).length > 0) {
				body.permissions = permissions;
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/roles/${roleId}`,
				body,
			};
		}

		case 'activate':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/roles/${roleId}/activate`,
			};

		case 'deactivate':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/roles/${roleId}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for role`);
	}
}
