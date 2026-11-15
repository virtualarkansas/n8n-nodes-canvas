import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam } from '../types/Canvas.types';

// ============================================
// Course Nickname
// ============================================

/** Canvas only offers nicknames of the user who owns the token ("self"). */
const BASE_PATH = '/api/v1/users/self/course_nicknames';

export function buildCourseNicknameRequest(operation: string, getParam: GetParam): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'clearAll':
			return {
				method: 'DELETE',
				endpoint: BASE_PATH,
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `${BASE_PATH}/${courseId}`,
			};
		case 'getAll':
			return {
				method: 'GET',
				endpoint: BASE_PATH,
			};
		case 'remove':
			return {
				method: 'DELETE',
				endpoint: `${BASE_PATH}/${courseId}`,
			};
		case 'set':
			return {
				method: 'PUT',
				endpoint: `${BASE_PATH}/${courseId}`,
				body: { nickname: getParam('nickname') },
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for courseNickname`);
	}
}
