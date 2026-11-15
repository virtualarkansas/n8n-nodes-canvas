import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { parseJsonObjectOrEmpty } from './shared';

// ============================================
// ERROR REPORT
// ============================================

export function buildErrorReportRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'create': {
			const fields = getParamObject('additionalFields');
			const error: Record<string, unknown> = { subject: getParam('subject') };
			for (const [uiName, canvasName] of [
				['comments', 'comments'],
				['email', 'email'],
				['url', 'url'],
				['userPerceivedSeverity', 'user_perceived_severity'],
			]) {
				const value = fields[uiName];
				if (value !== undefined && value !== null && value !== '') {
					error[canvasName] = value;
				}
			}
			const environment = parseJsonObjectOrEmpty(fields.httpEnv, 'Environment (JSON)');
			if (Object.keys(environment).length > 0) {
				error.http_env = environment;
			}
			return {
				endpoint: '/api/v1/error_reports',
				method: 'POST',
				body: { error },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for errorReport`);
	}
}
