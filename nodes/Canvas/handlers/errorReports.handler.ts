import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/** The "Environment (JSON)" field arrives as text from the editor and as an object from an expression. */
function parseEnvironment(value: unknown): Record<string, unknown> | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	let parsed: unknown = value;
	if (typeof value === 'string') {
		if (value.trim() === '') {
			return undefined;
		}
		try {
			parsed = JSON.parse(value);
		} catch {
			throw new ApplicationError('Invalid JSON in Environment (JSON). Expected a JSON object.');
		}
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new ApplicationError('Invalid value in Environment (JSON). Expected a JSON object.');
	}
	const environment = parsed as Record<string, unknown>;
	return Object.keys(environment).length > 0 ? environment : undefined;
}

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
			const environment = parseEnvironment(fields.httpEnv);
			if (environment) {
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
