import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Question Bank (classic quizzes; read-only in the Canvas API)
// ============================================

export function buildQuestionBankRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const bankPath = `/api/v1/question_banks/${getParam('questionBankId')}`;

	/** Canvas only looks whether the argument is there: "false" would switch the count on. */
	const countOption = (): Record<string, unknown> =>
		getParamObject('options').include_question_count === true ? { include_question_count: true } : {};

	switch (operation) {
		case 'get': {
			const qs = countOption();
			return {
				method: 'GET',
				endpoint: bankPath,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		// The course or account is an argument here, not part of the path.
		case 'getAll': {
			const account = getParam('context', 'course') === 'account';
			const contextId = account ? getParam('accountId') : getParam('courseId');
			if (contextId === '') {
				throw new ApplicationError(`Enter the ID of the ${account ? 'account' : 'course'} whose question banks to list`);
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/question_banks',
				qs: {
					context_type: account ? 'Account' : 'Course',
					context_id: contextId,
					...countOption(),
				},
			};
		}

		case 'listQuestions':
			return {
				method: 'GET',
				endpoint: `${bankPath}/questions`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for questionBank`);
	}
}
