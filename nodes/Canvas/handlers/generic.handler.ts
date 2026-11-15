import { ApplicationError } from 'n8n-workflow';
import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/** A `json` field arrives as text from the editor and as an object from an expression. */
function parseJsonObject(raw: string, label: string): Record<string, unknown> {
	const text = raw.trim();
	if (text === '') {
		return {};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new ApplicationError(`${label} must be valid JSON`);
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new ApplicationError(`${label} must be a JSON object, e.g. {"key": "value"}`);
	}
	return parsed as Record<string, unknown>;
}

// ============================================
// Custom API Request
// ============================================

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function buildApiRequestRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	if (operation !== 'request') {
		throw new ApplicationError(`Operation ${operation} not implemented for apiRequest`);
	}

	const method = getParam('method', 'GET').toUpperCase();
	if (!METHODS.includes(method)) {
		throw new ApplicationError(`Unsupported method "${method}"`);
	}

	// A full URL is reduced to its path and query: requests only ever go to the credential's Canvas URL.
	let path = getParam('path').trim();
	if (/^https?:\/\//i.test(path)) {
		try {
			const url = new URL(path);
			path = `${url.pathname}${url.search}`;
		} catch {
			throw new ApplicationError(`"${path}" is not a valid URL`);
		}
	}
	if (!path.startsWith('/') || path.startsWith('//')) {
		throw new ApplicationError('The path must start with a single slash, e.g. /api/v1/courses');
	}

	const request: IRequestConfig = {
		method: method as IHttpRequestMethods,
		endpoint: path,
		qs: parseJsonObject(getParam('query', '{}'), 'Query Parameters'),
	};
	if (method !== 'GET') {
		request.body = parseJsonObject(getParam('body', '{}'), 'Body');
	}
	const dataKey = String(getParamObject('options').dataKey ?? '').trim();
	if (dataKey) {
		request.dataKey = dataKey;
	}
	return request;
}

// ============================================
// GraphQL
// ============================================

export function buildGraphqlRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	if (operation !== 'query') {
		throw new ApplicationError(`Operation ${operation} not implemented for graphql`);
	}

	const query = getParam('query');
	if (query.trim() === '') {
		throw new ApplicationError('The GraphQL query is empty');
	}
	const options = getParamObject('options');
	const body: IDataObject = {
		query,
		variables: parseJsonObject(getParam('variables', '{}'), 'Variables') as IDataObject,
	};

	return {
		method: 'POST',
		endpoint: '/api/graphql',
		body,
		// GraphQL reports failures in a 200 response.
		checkResponse:
			options.continueOnGraphqlErrors === true
				? undefined
				: (data) => {
						const errors = (data?.errors ?? []) as IDataObject[];
						if (Array.isArray(errors) && errors.length > 0) {
							const messages = errors.map((error) => String(error.message ?? 'Unknown GraphQL error'));
							throw new ApplicationError(`Canvas reported GraphQL errors: ${messages.join('; ')}`);
						}
					},
	};
}
