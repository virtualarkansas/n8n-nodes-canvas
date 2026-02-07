import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Account
// ============================================

export function buildAccountRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/accounts',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}`,
				body: { account: getParamObject('updateFields') },
			};

		case 'createSubAccount':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/sub_accounts`,
				body: { account: { name: getParam('name'), ...getParamObject('additionalFields') } },
			};

		case 'getSubAccounts':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sub_accounts`,
				qs: getParamObject('options'),
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
		case 'listAvailable':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/reports`,
				qs: getParamObject('options'),
			};

		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {};
			if (Object.keys(additionalFields).length > 0) {
				body.parameters = additionalFields;
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}`,
				body,
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}/${reportId}`,
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
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/reports/${reportType}/${reportId}`,
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
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/account_notifications`,
				qs: getParamObject('options'),
			};

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

			if (additionalFields.icon) {
				notification.icon = additionalFields.icon;
			}

			const body: Record<string, unknown> = {
				account_notification: notification,
			};

			if (additionalFields.roles) {
				const rolesStr = additionalFields.roles as string;
				body.account_notification_roles = rolesStr.split(',').map((r) => r.trim());
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

			if (updateFields.subject) {
				notification.subject = updateFields.subject;
			}
			if (updateFields.message) {
				notification.message = updateFields.message;
			}
			if (updateFields.start_at) {
				notification.start_at = updateFields.start_at;
			}
			if (updateFields.end_at) {
				notification.end_at = updateFields.end_at;
			}
			if (updateFields.icon) {
				notification.icon = updateFields.icon;
			}

			const body: Record<string, unknown> = {
				account_notification: notification,
			};

			if (updateFields.roles) {
				const rolesStr = updateFields.roles as string;
				body.account_notification_roles = rolesStr.split(',').map((r) => r.trim());
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
			if (options.remove !== undefined) {
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

		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/account_calendars',
				qs: getParamObject('options'),
			};

		case 'getAllForAccount':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/account_calendars`,
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/account_calendars/${accountId}`,
				body: getParamObject('updateFields'),
			};

		case 'countVisible':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/visible_calendars_count`,
			};

		case 'updateMany': {
			const calendarsJson = getParam('calendars');
			let calendars: unknown[];
			try {
				calendars = JSON.parse(calendarsJson) as unknown[];
			} catch {
				throw new ApplicationError(
					'Invalid JSON in calendars field. Expected a JSON array of calendar objects.',
				);
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/account_calendars`,
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
			if (additionalFields.role_id) {
				body.role_id = additionalFields.role_id;
			}
			if (additionalFields.send_confirmation !== undefined) {
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
				qs: { role_id: roleId },
			};
		}

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			if (options.include_deleted !== undefined) {
				qs.include_deleted = options.include_deleted;
			}
			if (options.search_term) {
				qs.search_term = options.search_term;
			}
			if (options.user_id) {
				const userIdStr = options.user_id as string;
				qs['user_id[]'] = userIdStr.split(',').map((id) => id.trim());
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/admins`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

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
			if (additionalFields.base_role_type) {
				body.base_role_type = additionalFields.base_role_type;
			}
			if (additionalFields.permissions) {
				let permissions: unknown;
				try {
					permissions =
						typeof additionalFields.permissions === 'string'
							? JSON.parse(additionalFields.permissions as string)
							: additionalFields.permissions;
				} catch {
					throw new ApplicationError(
						'Invalid JSON in permissions field. Expected a JSON object.',
					);
				}
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
			if (options.show_inherited !== undefined) {
				qs.show_inherited = options.show_inherited;
			}
			if (options.state && Array.isArray(options.state) && (options.state as string[]).length > 0) {
				qs['state[]'] = options.state;
			}
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/roles`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {};
			if (updateFields.label) {
				body.label = updateFields.label;
			}
			if (updateFields.permissions) {
				let permissions: unknown;
				try {
					permissions =
						typeof updateFields.permissions === 'string'
							? JSON.parse(updateFields.permissions as string)
							: updateFields.permissions;
				} catch {
					throw new ApplicationError(
						'Invalid JSON in permissions field. Expected a JSON object.',
					);
				}
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
