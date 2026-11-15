import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/**
 * The polling APIs wrap every response, single records included:
 * { "poll_choices": [{ ... }] }. `dataKey` turns each record into an item.
 */

// ============================================
// Poll Choice
// ============================================

export function buildPollChoiceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = `/api/v1/polls/${getParam('pollId')}/poll_choices`;
	const one = `${base}/${getParam('pollChoiceId')}`;
	const dataKey = 'poll_choices';

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: base,
				body: { poll_choices: [{ text: getParam('text'), ...getParamObject('additionalFields') }] },
				dataKey,
			};
		case 'delete':
			return { method: 'DELETE', endpoint: one };
		case 'get':
			return { method: 'GET', endpoint: one, dataKey };
		case 'getAll':
			return { method: 'GET', endpoint: base, dataKey };
		case 'update':
			return {
				method: 'PUT',
				endpoint: one,
				body: { poll_choices: [getParamObject('updateFields')] },
				dataKey,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for pollChoice`);
	}
}

// ============================================
// Poll Session
// ============================================

export function buildPollSessionRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = `/api/v1/polls/${getParam('pollId')}/poll_sessions`;
	const one = `${base}/${getParam('pollSessionId')}`;
	const dataKey = 'poll_sessions';

	switch (operation) {
		case 'close':
			// Canvas really uses GET for opening and closing a session.
			return { method: 'GET', endpoint: `${one}/close`, dataKey };
		case 'create':
			return {
				method: 'POST',
				endpoint: base,
				body: {
					poll_sessions: [{ course_id: getParam('courseId'), ...getParamObject('additionalFields') }],
				},
				dataKey,
			};
		case 'delete':
			return { method: 'DELETE', endpoint: one };
		case 'get':
			return { method: 'GET', endpoint: one, dataKey };
		case 'getAll':
			return { method: 'GET', endpoint: base, dataKey };
		case 'getClosed':
			return { method: 'GET', endpoint: '/api/v1/poll_sessions/closed', dataKey };
		case 'getOpened':
			return { method: 'GET', endpoint: '/api/v1/poll_sessions/opened', dataKey };
		case 'open':
			return { method: 'GET', endpoint: `${one}/open`, dataKey };
		case 'update':
			return {
				method: 'PUT',
				endpoint: one,
				body: { poll_sessions: [getParamObject('updateFields')] },
				dataKey,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for pollSession`);
	}
}

// ============================================
// Poll Submission
// ============================================

export function buildPollSubmissionRequest(
	operation: string,
	getParam: GetParam,
): IRequestConfig {
	const base = `/api/v1/polls/${getParam('pollId')}/poll_sessions/${getParam('pollSessionId')}/poll_submissions`;
	const dataKey = 'poll_submissions';

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: base,
				body: { poll_submissions: [{ poll_choice_id: getParam('pollChoiceId') }] },
				dataKey,
			};
		case 'get':
			return { method: 'GET', endpoint: `${base}/${getParam('pollSubmissionId')}`, dataKey };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for pollSubmission`);
	}
}
