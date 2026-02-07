import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

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
			const body: IDataObject = {
				recipients: getParam('recipients').split(',').map((r) => r.trim()),
				body: getParam('body'),
				...additionalFields,
			};
			// Convert comma-separated attachment_ids to array
			if (body.attachment_ids && typeof body.attachment_ids === 'string') {
				body.attachment_ids = (body.attachment_ids as string).split(',').map((id) => id.trim());
			}
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

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/conversations/${conversationId}`,
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/conversations',
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/conversations/${conversationId}`,
				body: { conversation: getParamObject('updateFields') },
			};

		case 'addMessage': {
			const additionalFields = getParamObject('additionalFields');
			const body: IDataObject = {
				body: getParam('messageBody'),
				...additionalFields,
			};
			// Convert comma-separated attachment_ids to array
			if (body.attachment_ids && typeof body.attachment_ids === 'string') {
				body.attachment_ids = (body.attachment_ids as string).split(',').map((id) => id.trim());
			}
			// Convert comma-separated included_messages to array
			if (body.included_messages && typeof body.included_messages === 'string') {
				body.included_messages = (body.included_messages as string).split(',').map((id) => id.trim());
			}
			// Convert comma-separated recipients to array
			if (body.recipients && typeof body.recipients === 'string') {
				body.recipients = (body.recipients as string).split(',').map((r) => r.trim());
			}
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
					recipients: getParam('recipients').split(',').map((r) => r.trim()),
				},
			};

		case 'batchUpdate':
			return {
				method: 'PUT',
				endpoint: '/api/v1/conversations',
				body: {
					conversation_ids: getParam('conversationIds').split(',').map((id) => id.trim()),
					event: getParam('event'),
				},
			};

		case 'deleteMessages':
			return {
				method: 'POST',
				endpoint: `/api/v1/conversations/${conversationId}/remove_messages`,
				body: {
					remove: getParam('messageIds').split(',').map((id) => id.trim()),
				},
			};

		case 'getBatches':
			return {
				method: 'GET',
				endpoint: '/api/v1/conversations/batches',
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

export function buildNotificationPreferenceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const channelId = getParam('channelId');

	switch (operation) {
		case 'get': {
			const userId = getParam('userId');
			const notification = getParam('notification');
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/communication_channels/${channelId}/notification_preferences/${notification}`,
			};
		}

		case 'getAll': {
			const userId = getParam('userId');
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/communication_channels/${channelId}/notification_preferences`,
			};
		}

		case 'getCategories': {
			const userId = getParam('userId');
			return {
				method: 'GET',
				endpoint: `/api/v1/users/${userId}/communication_channels/${channelId}/notification_preference_categories`,
			};
		}

		case 'update': {
			const notification = getParam('notification');
			const frequency = getParam('frequency');
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/communication_channels/${channelId}/notification_preferences/${notification}`,
				body: {
					notification_preferences: { frequency },
				},
			};
		}

		case 'updateByCategory': {
			const category = getParam('category');
			const frequency = getParam('frequency');
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/communication_channels/${channelId}/notification_preference_categories/${category}`,
				body: {
					notification_preferences: { frequency },
				},
			};
		}

		case 'updateMultiple': {
			const preferences = getParamObject('preferences');
			const preferenceValues = (preferences.preferenceValues || []) as Array<{
				notification: string;
				frequency: string;
			}>;
			const notificationPreferences: Record<string, { frequency: string }> = {};
			for (const pref of preferenceValues) {
				notificationPreferences[pref.notification] = { frequency: pref.frequency };
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/users/self/communication_channels/${channelId}/notification_preferences`,
				body: {
					notification_preferences: notificationPreferences,
				},
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for notificationPreference`,
			);
	}
}
