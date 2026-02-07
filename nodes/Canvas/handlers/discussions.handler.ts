import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Helper: resolve context base path for course/group
// ============================================

function getDiscussionBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	if (contextType === 'group') {
		return `/api/v1/groups/${getParam('groupId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

// ============================================
// Discussion Topic
// ============================================

export function buildDiscussionTopicRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getDiscussionBasePath(getParam);
	const topicId = getParam('topicId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `${basePath}/discussion_topics`,
				body: { title: getParam('title'), ...getParamObject('additionalFields') },
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/discussion_topics/${topicId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/discussion_topics/${topicId}`,
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/discussion_topics`,
				qs: getParamObject('options'),
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/discussion_topics/${topicId}`,
				body: getParamObject('updateFields'),
			};

		case 'duplicate':
			return {
				method: 'POST',
				endpoint: `${basePath}/discussion_topics/${topicId}/duplicate`,
			};

		case 'reorderPinned': {
			const orderStr = getParam('order');
			const order = orderStr.split(',').map((id) => id.trim());
			return {
				method: 'POST',
				endpoint: `${basePath}/discussion_topics/reorder`,
				body: { order },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for discussionTopic`);
	}
}

// ============================================
// Announcement
// ============================================

function getAnnouncementBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	if (contextType === 'group') {
		return `/api/v1/groups/${getParam('groupId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

export function buildAnnouncementRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const basePath = getAnnouncementBasePath(getParam);
			return {
				method: 'POST',
				endpoint: `${basePath}/discussion_topics`,
				body: {
					title: getParam('title'),
					message: getParam('message'),
					is_announcement: true,
					...getParamObject('additionalFields'),
				},
			};
		}

		case 'delete': {
			const basePath = getAnnouncementBasePath(getParam);
			return {
				method: 'DELETE',
				endpoint: `${basePath}/discussion_topics/${getParam('announcementId')}`,
			};
		}

		case 'get': {
			const basePath = getAnnouncementBasePath(getParam);
			return {
				method: 'GET',
				endpoint: `${basePath}/discussion_topics/${getParam('announcementId')}`,
				qs: getParamObject('options'),
			};
		}

		case 'getAll': {
			const contextCodesStr = getParam('contextCodes');
			const contextCodes = contextCodesStr.split(',').map((code) => code.trim());
			return {
				method: 'GET',
				endpoint: '/api/v1/announcements',
				qs: { context_codes: contextCodes, ...getParamObject('options') },
			};
		}

		case 'update': {
			const basePath = getAnnouncementBasePath(getParam);
			return {
				method: 'PUT',
				endpoint: `${basePath}/discussion_topics/${getParam('announcementId')}`,
				body: getParamObject('updateFields'),
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for announcement`);
	}
}

// ============================================
// Announcement External Feed
// ============================================

function getExternalFeedBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	if (contextType === 'group') {
		return `/api/v1/groups/${getParam('groupId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

export function buildAnnouncementExternalFeedRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getExternalFeedBasePath(getParam);

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `${basePath}/external_feeds`,
				body: { url: getParam('url'), ...getParamObject('additionalFields') },
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/external_feeds/${getParam('externalFeedId')}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/external_feeds`,
			};

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for announcementExternalFeed`,
			);
	}
}
