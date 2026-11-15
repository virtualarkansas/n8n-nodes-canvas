import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { collectionRows, toList } from './shared';

/** Replace comma-separated fields of a collection by arrays (dropping the ones left empty). */
function listFields(fields: Record<string, unknown>, names: string[]): void {
	for (const name of names) {
		if (fields[name] === undefined) {
			continue;
		}
		const list = toList(fields[name]);
		if (list.length > 0) {
			fields[name] = list;
		} else {
			delete fields[name];
		}
	}
}

// ============================================
// Conversation
// ============================================

export function buildConversationRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const conversationId = getParam('conversationId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			listFields(additionalFields, ['attachment_ids']);
			const body: IDataObject = {
				recipients: toList(getParam('recipients')),
				body: getParam('body'),
				...additionalFields,
			};
			return {
				method: 'POST',
				endpoint: '/api/v1/conversations',
				body,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/conversations/${conversationId}`,
			};

		case 'deleteForAll':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/conversations/${conversationId}/delete_for_all`,
			};

		case 'get': {
			const qs = getParamObject('options');
			// Canvas does not split a comma-separated filter itself; it has to be a list.
			listFields(qs, ['filter']);
			return {
				method: 'GET',
				endpoint: `/api/v1/conversations/${conversationId}`,
				qs,
			};
		}

		case 'getAll': {
			const qs = getParamObject('options');
			listFields(qs, ['filter']);
			if (qs.include_all_conversation_ids !== true) {
				delete qs.include_all_conversation_ids;
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/conversations',
				qs,
			};
		}

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/conversations/${conversationId}`,
				body: { conversation: getParamObject('updateFields') },
			};

		case 'addMessage': {
			const additionalFields = getParamObject('additionalFields');
			listFields(additionalFields, ['attachment_ids', 'included_messages', 'recipients']);
			const body: IDataObject = {
				body: getParam('messageBody'),
				...additionalFields,
			};
			return {
				method: 'POST',
				endpoint: `/api/v1/conversations/${conversationId}/add_message`,
				body,
			};
		}

		case 'addRecipients':
			return {
				method: 'POST',
				endpoint: `/api/v1/conversations/${conversationId}/add_recipients`,
				body: {
					recipients: toList(getParam('recipients')),
				},
			};

		case 'batchUpdate':
			return {
				method: 'PUT',
				endpoint: '/api/v1/conversations',
				body: {
					conversation_ids: toList(getParam('conversationIds')),
					event: getParam('event'),
				},
			};

		case 'deleteMessages':
			return {
				method: 'POST',
				endpoint: `/api/v1/conversations/${conversationId}/remove_messages`,
				body: {
					remove: toList(getParam('messageIds')),
				},
			};

		case 'getBatches':
			return {
				method: 'GET',
				endpoint: '/api/v1/conversations/batches',
			};

		case 'getDeleted':
			return {
				method: 'GET',
				endpoint: '/api/v1/conversations/deleted',
				qs: {
					user_id: getParam('userId'),
					...getParamObject('options'),
				},
				// Canvas answers every "page" with the complete list while still announcing
				// further pages; following them would repeat every message.
				singlePage: true,
			};

		case 'getUnreadCount':
			return {
				method: 'GET',
				endpoint: '/api/v1/conversations/unread_count',
			};

		case 'markAllAsRead':
			return {
				method: 'POST',
				endpoint: '/api/v1/conversations/mark_all_as_read',
			};

		case 'restore':
			return {
				method: 'PUT',
				endpoint: '/api/v1/conversations/restore',
				body: {
					conversation_id: conversationId,
					message_id: getParam('messageId'),
					user_id: getParam('userId'),
				},
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for conversation`);
	}
}

// ============================================
// Comm Message
// ============================================

export function buildCommMessageRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll': {
			const qs = {
				user_id: getParam('userId'),
				...getParamObject('options'),
			};
			return {
				method: 'GET',
				endpoint: '/api/v1/comm_messages',
				qs,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for commMessage`);
	}
}

// ============================================
// Notification Preference
// ============================================

/**
 * The channel part of a notification preference path: by ID, or (where Canvas
 * offers it) by channel type and address.
 */
function channelPath(getParam: GetParam, addressable: boolean): string {
	if (addressable && getParam('channelBy', 'id') === 'address') {
		const address = encodeURIComponent(getParam('channelAddress').trim());
		return `communication_channels/${getParam('channelType', 'email')}/${address}`;
	}
	return `communication_channels/${getParam('channelId')}`;
}

/** Updates always go to the caller's own channels; admins can act for the owner. */
function masqueradeQuery(getParamObject: GetParamObject): Record<string, unknown> | undefined {
	const asUserId = String(getParamObject('options').as_user_id ?? '').trim();
	return asUserId ? { as_user_id: asUserId } : undefined;
}

export function buildNotificationPreferenceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'get': {
			const userId = getParam('userId', 'self');
			const notification = encodeURIComponent(getParam('notification').trim());
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/${channelPath(getParam, true)}/notification_preferences/${notification}`,
				dataKey: 'notification_preferences',
			};
		}

		case 'getAll': {
			const userId = getParam('userId', 'self');
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/${channelPath(getParam, true)}/notification_preferences`,
				dataKey: 'notification_preferences',
			};
		}

		case 'getCategories': {
			const userId = getParam('userId', 'self');
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/${channelPath(getParam, false)}/notification_preference_categories`,
			};
		}

		case 'update': {
			const notification = encodeURIComponent(getParam('notification').trim());
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/${channelPath(getParam, true)}/notification_preferences/${notification}`,
				qs: masqueradeQuery(getParamObject),
				body: {
					notification_preferences: { frequency: getParam('frequency') },
				},
				dataKey: 'notification_preferences',
			};
		}

		case 'updateByCategory': {
			const category = encodeURIComponent(getParam('category').trim());
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/${channelPath(getParam, false)}/notification_preference_categories/${category}`,
				qs: masqueradeQuery(getParamObject),
				body: {
					notification_preferences: { frequency: getParam('frequency') },
				},
				dataKey: 'notification_preferences',
			};
		}

		case 'updateMultiple': {
			const preferenceValues = collectionRows(
				getParamObject('preferences'),
				'preferenceValues',
				'Preferences',
			) as Array<{ notification?: string; frequency?: string }>;
			const notificationPreferences: Record<string, { frequency: string }> = {};
			for (const pref of preferenceValues) {
				const notification = String(pref.notification ?? '').trim();
				if (notification) {
					notificationPreferences[notification] = { frequency: pref.frequency || 'immediately' };
				}
			}
			if (Object.keys(notificationPreferences).length === 0) {
				throw new ApplicationError('Add at least one preference (notification and frequency) to update');
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/${channelPath(getParam, true)}/notification_preferences`,
				qs: masqueradeQuery(getParamObject),
				body: {
					notification_preferences: notificationPreferences,
				},
				dataKey: 'notification_preferences',
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for notificationPreference`,
			);
	}
}
