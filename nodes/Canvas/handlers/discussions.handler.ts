import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { parseJsonObject, toList } from './shared';

// ============================================
// Helpers
// ============================================

/** Base path of the course or group the topic / announcement / feed lives in. */
function getContextBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	if (contextType === 'group') {
		return `/api/v1/groups/${getParam('groupId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

/**
 * Topic fields as Canvas wants them: everything flat, the assignment as a sub-object.
 *
 * `specific_sections` is a comma-separated list that Canvas splits without trimming;
 * "12, 13" (with a space) makes it fail with a server error, so the list is tidied up.
 */
function buildTopicBody(fields: Record<string, unknown>): Record<string, unknown> {
	const body = { ...fields };
	if (body.specific_sections !== undefined) {
		const sections = toList(body.specific_sections);
		if (sections.length > 0) {
			body.specific_sections = sections.join(',');
		} else {
			delete body.specific_sections;
		}
	}
	// An empty ID cannot be looked up (Canvas answers 404). "No group set" is null.
	if (body.position_after === '') {
		delete body.position_after;
	}
	if (body.group_category_id === '') {
		body.group_category_id = null;
	}
	if (body.assignment !== undefined) {
		const assignment = parseJsonObject(body.assignment, {
			invalidJson: 'Assignment must be valid JSON',
			notAnObject: 'Assignment must be a JSON object',
			nullTextIsEmpty: true,
		});
		if (assignment === undefined || Object.keys(assignment).length === 0) {
			delete body.assignment;
		} else {
			body.assignment = assignment;
		}
	}
	return body;
}

// ============================================
// Discussion Topic
// ============================================

export function buildDiscussionTopicRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getContextBasePath(getParam);
	const topics = `${basePath}/discussion_topics`;
	const topic = `${topics}/${getParam('topicId')}`;

	switch (operation) {
		// ---- topics ----

		case 'create':
			return {
				method: 'POST',
				endpoint: topics,
				body: buildTopicBody({ title: getParam('title'), ...getParamObject('additionalFields') }),
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: topic,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: topic,
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const qs = getParamObject('options');
			// Canvas takes several states as one comma-separated value.
			if (qs.scope !== undefined) {
				const scope = toList(qs.scope);
				if (scope.length > 0) {
					qs.scope = scope.join(',');
				} else {
					delete qs.scope;
				}
			}
			return {
				method: 'GET',
				endpoint: topics,
				qs,
			};
		}

		case 'update':
			return {
				method: 'PUT',
				endpoint: topic,
				body: buildTopicBody(getParamObject('updateFields')),
			};

		case 'duplicate':
			return {
				method: 'POST',
				endpoint: `${topic}/duplicate`,
			};

		case 'reorderPinned': {
			const order = toList(getParam('order'));
			if (order.length === 0) {
				throw new ApplicationError('At least one topic ID is required for discussionTopic reorderPinned');
			}
			return {
				method: 'POST',
				endpoint: `${topics}/reorder`,
				body: { order },
			};
		}

		case 'getFullTopic': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `${topic}/view`,
				qs: options.include_new_entries === true ? { include_new_entries: 1 } : {},
			};
		}

		case 'subscribe':
			return {
				method: 'PUT',
				endpoint: `${topic}/subscribed`,
			};

		case 'unsubscribe':
			return {
				method: 'DELETE',
				endpoint: `${topic}/subscribed`,
			};

		// ---- read state ----

		case 'markRead':
		case 'markUnread': {
			const target = getParam('target', 'topic');
			const options = getParamObject('readOptions');
			const qs: Record<string, unknown> = {};
			// The topic's own read state has no "forced" flag; entries do.
			if (target !== 'topic' && options.forced_read_state !== undefined) {
				qs.forced_read_state = options.forced_read_state;
			}
			let endpoint = `${topic}/read`;
			if (target === 'topicAndEntries') {
				endpoint = `${topic}/read_all`;
			} else if (target === 'entry') {
				endpoint = `${topic}/entries/${getParam('entryId')}/read`;
			}
			return {
				method: operation === 'markRead' ? 'PUT' : 'DELETE',
				endpoint,
				qs,
			};
		}

		case 'markAllTopicsRead': {
			const options = getParamObject('options');
			return {
				method: 'PUT',
				endpoint: `${topics}/read_all`,
				// Canvas compares this parameter with the text "true".
				qs: options.only_announcements === true ? { only_announcements: 'true' } : {},
			};
		}

		// ---- entries ----

		case 'getAllEntries':
			return {
				method: 'GET',
				endpoint: `${topic}/entries`,
			};

		case 'getAllReplies':
			return {
				method: 'GET',
				endpoint: `${topic}/entries/${getParam('entryId')}/replies`,
			};

		case 'getEntriesById': {
			const ids = toList(getParam('entryIds'));
			if (ids.length === 0) {
				throw new ApplicationError('At least one entry ID is required for discussionTopic getEntriesById');
			}
			return {
				method: 'GET',
				endpoint: `${topic}/entry_list`,
				qs: { ids },
			};
		}

		case 'createEntry':
			return {
				method: 'POST',
				endpoint: `${topic}/entries`,
				body: { message: getParam('message') },
			};

		case 'createReply':
			return {
				method: 'POST',
				endpoint: `${topic}/entries/${getParam('entryId')}/replies`,
				body: { message: getParam('message') },
			};

		case 'updateEntry':
			return {
				method: 'PUT',
				endpoint: `${topic}/entries/${getParam('entryId')}`,
				body: { message: getParam('message') },
			};

		case 'deleteEntry':
			return {
				method: 'DELETE',
				endpoint: `${topic}/entries/${getParam('entryId')}`,
			};

		case 'rateEntry':
			return {
				method: 'POST',
				endpoint: `${topic}/entries/${getParam('entryId')}/rating`,
				body: { rating: getParam('rating', '1') === '0' ? 0 : 1 },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for discussionTopic`);
	}
}

// ============================================
// Announcement
// ============================================

export function buildAnnouncementRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const topics = `${getContextBasePath(getParam)}/discussion_topics`;
	const announcement = `${topics}/${getParam('announcementId')}`;

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: topics,
				body: buildTopicBody({
					title: getParam('title'),
					message: getParam('message'),
					...getParamObject('additionalFields'),
					is_announcement: true,
				}),
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: announcement,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: announcement,
				qs: getParamObject('options'),
			};

		case 'getAll': {
			// Canvas wants context codes ("course_123"); a bare course ID is accepted too.
			const contextCodes = toList(getParam('contextCodes')).map((code) =>
				/^\d+$/.test(code) ? `course_${code}` : code,
			);
			if (contextCodes.length === 0) {
				throw new ApplicationError('At least one context code is required for announcement getAll');
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/announcements',
				qs: { ...getParamObject('options'), context_codes: contextCodes },
			};
		}

		case 'update':
			return {
				method: 'PUT',
				endpoint: announcement,
				body: buildTopicBody(getParamObject('updateFields')),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for announcement`);
	}
}

// ============================================
// Announcement External Feed
// ============================================

export function buildAnnouncementExternalFeedRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getContextBasePath(getParam);

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
