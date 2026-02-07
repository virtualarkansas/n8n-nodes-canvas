import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import type {
	IRateLimitOptions,
	IPaginationOptions,
	IRateLimitStatus,
	IParsedLinkHeader,
	ICanvasResponse,
	IPaginatedResult,
	ICanvasErrorOutput,
	CanvasErrorType,
	IErrorHandlingOptions,
} from './types/Canvas.types';

/**
 * Default rate limit options
 */
export const DEFAULT_RATE_LIMIT_OPTIONS: IRateLimitOptions = {
	enabled: true,
	threshold: 300,
	maxRetries: 5,
	baseDelayMs: 2000,
	maxDelayMs: 60000,
};

/**
 * Default pagination options
 */
export const DEFAULT_PAGINATION_OPTIONS: IPaginationOptions = {
	enabled: true,
	perPage: 10,
	maxPages: 5,
};

/**
 * Default error handling options
 */
export const DEFAULT_ERROR_HANDLING_OPTIONS: IErrorHandlingOptions = {
	onError: 'stop',
	maxRetries: 3,
};

/**
 * Sleep utility for backoff delays
 * Uses global.setTimeout to avoid ESLint restriction on setTimeout
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		global.setTimeout(resolve, ms);
	});
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
	attempt: number,
	baseDelayMs: number,
	maxDelayMs: number,
): number {
	const delay = baseDelayMs * Math.pow(2, attempt);
	return Math.min(delay, maxDelayMs);
}

/**
 * Parse rate limit headers from Canvas API response
 */
export function parseRateLimitHeaders(headers: IDataObject): IRateLimitStatus {
	return {
		remaining: parseFloat((headers['x-rate-limit-remaining'] as string) || '1000'),
		cost: headers['x-request-cost']
			? parseFloat(headers['x-request-cost'] as string)
			: undefined,
	};
}

/**
 * Parse Link header for pagination
 * Canvas uses RFC 5988 Web Linking format
 */
export function parseLinkHeader(linkHeader: string | undefined): IParsedLinkHeader {
	const result: IParsedLinkHeader = {};

	if (!linkHeader) {
		return result;
	}

	// Parse links like: <url>; rel="next", <url>; rel="prev"
	const links = linkHeader.split(',');

	for (const link of links) {
		const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
		if (match) {
			const [, url, rel] = match;
			switch (rel) {
				case 'current':
					result.current = url;
					break;
				case 'next':
					result.next = url;
					break;
				case 'prev':
					result.prev = url;
					break;
				case 'first':
					result.first = url;
					break;
				case 'last':
					result.last = url;
					break;
			}
		}
	}

	return result;
}

/**
 * Categorize HTTP error codes into Canvas error types
 */
export function categorizeError(statusCode: number): CanvasErrorType {
	switch (statusCode) {
		case 401:
			return 'UNAUTHORIZED';
		case 403:
			return 'FORBIDDEN';
		case 404:
			return 'NOT_FOUND';
		case 422:
			return 'VALIDATION_ERROR';
		case 429:
			return 'RATE_LIMITED';
		default:
			if (statusCode >= 500) {
				return 'SERVER_ERROR';
			}
			return 'UNKNOWN';
	}
}

/**
 * Create structured error output for error branch
 */
export function createErrorOutput(
	error: JsonObject,
	originalItem: IDataObject,
	resource: string,
	operation: string,
	endpoint: string,
): ICanvasErrorOutput {
	const statusCode = (error.httpCode as number) || (error.statusCode as number) || 500;
	const message =
		(error.message as string) ||
		(error.description as string) ||
		'Unknown error occurred';

	return {
		error: true,
		errorCode: statusCode,
		errorType: categorizeError(statusCode),
		errorMessage: message,
		canvasErrorCode: error.error as string | undefined,
		originalItem,
		resource,
		operation,
		endpoint,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Get Canvas API base URL from credentials
 */
export async function getCanvasUrl(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
): Promise<string> {
	const authType = this.getNodeParameter('authentication', 0) as string;
	const credentialType = authType === 'oAuth2' ? 'canvasOAuth2Api' : 'canvasApi';
	const credentials = await this.getCredentials(credentialType);
	let canvasUrl = credentials.canvasUrl as string;

	// Remove trailing slash if present
	if (canvasUrl.endsWith('/')) {
		canvasUrl = canvasUrl.slice(0, -1);
	}

	return canvasUrl;
}

/**
 * Check rate limit status by making a lightweight probe request
 */
export async function checkRateLimit(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	options: IRateLimitOptions,
): Promise<IRateLimitStatus> {
	if (!options.enabled) {
		return { remaining: 1000 };
	}

	const canvasUrl = await getCanvasUrl.call(this);
	const authType = this.getNodeParameter('authentication', 0) as string;
	const credentialType = authType === 'oAuth2' ? 'canvasOAuth2Api' : 'canvasApi';

	const requestOptions: IHttpRequestOptions = {
		method: 'GET',
		url: `${canvasUrl}/api/v1/users/self`,
		returnFullResponse: true,
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			credentialType,
			requestOptions,
		);
		return parseRateLimitHeaders(response.headers as IDataObject);
	} catch {
		// If probe fails, assume we have quota (don't block on probe errors)
		return { remaining: 1000 };
	}
}

/**
 * Wait for rate limit to recover
 */
export async function waitForRateLimit(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	options: IRateLimitOptions,
): Promise<void> {
	for (let attempt = 0; attempt < options.maxRetries; attempt++) {
		const status = await checkRateLimit.call(this, options);

		if (status.remaining >= options.threshold) {
			return;
		}

		const delay = calculateBackoff(attempt, options.baseDelayMs, options.maxDelayMs);
		await sleep(delay);
	}

	throw new Error(
		`Rate limit still below threshold (${options.threshold}) after ${options.maxRetries} retries`,
	);
}

/**
 * Make a Canvas API request with rate limit handling
 */
export async function canvasApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	query?: IDataObject,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
): Promise<ICanvasResponse> {
	const canvasUrl = await getCanvasUrl.call(this);
	const authType = this.getNodeParameter('authentication', 0) as string;
	const credentialType = authType === 'oAuth2' ? 'canvasOAuth2Api' : 'canvasApi';

	// Check rate limit before request
	if (rateLimitOptions.enabled) {
		const status = await checkRateLimit.call(this, rateLimitOptions);
		if (status.remaining < rateLimitOptions.threshold) {
			await waitForRateLimit.call(this, rateLimitOptions);
		}
	}

	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${canvasUrl}${endpoint}`,
		body,
		qs: query,
		returnFullResponse: true,
		json: true,
	};

	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= rateLimitOptions.maxRetries; attempt++) {
		try {
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				credentialType,
				requestOptions,
			);

			const headers = response.headers as IDataObject;
			return {
				data: response.body as IDataObject | IDataObject[],
				rateLimitStatus: parseRateLimitHeaders(headers),
				linkHeader: parseLinkHeader(headers.link as string),
			};
		} catch (error) {
			lastError = error as Error;
			const statusCode = (error as JsonObject).httpCode || (error as JsonObject).statusCode;

			// Only retry on rate limit errors
			if (statusCode === 429 && attempt < rateLimitOptions.maxRetries) {
				const delay = calculateBackoff(
					attempt,
					rateLimitOptions.baseDelayMs,
					rateLimitOptions.maxDelayMs,
				);
				await sleep(delay);

				// Re-check rate limit after delay
				const status = await checkRateLimit.call(this, rateLimitOptions);
				if (status.remaining < rateLimitOptions.threshold) {
					await waitForRateLimit.call(this, rateLimitOptions);
				}
				continue;
			}

			throw error;
		}
	}

	throw lastError || new Error('Max retries exceeded');
}

/**
 * Make a Canvas API request and follow pagination to get all items
 */
export async function canvasApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	query?: IDataObject,
	paginationOptions: IPaginationOptions = DEFAULT_PAGINATION_OPTIONS,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
): Promise<IPaginatedResult> {
	const allItems: IDataObject[] = [];
	let pageCount = 0;
	let lastRateLimitStatus: IRateLimitStatus = { remaining: 1000 };

	// Add per_page to query
	const paginatedQuery = {
		...query,
		per_page: paginationOptions.perPage,
	};

	// First request
	let response = await canvasApiRequest.call(
		this,
		method,
		endpoint,
		body,
		paginatedQuery,
		rateLimitOptions,
	);

	const data = response.data;
	if (Array.isArray(data)) {
		allItems.push(...data);
	} else {
		allItems.push(data);
	}
	pageCount++;
	lastRateLimitStatus = response.rateLimitStatus;

	// Follow pagination if enabled
	if (paginationOptions.enabled) {
		const canvasUrl = await getCanvasUrl.call(this);
		const authType = this.getNodeParameter('authentication', 0) as string;
		const credentialType = authType === 'oAuth2' ? 'canvasOAuth2Api' : 'canvasApi';

		while (response.linkHeader.next) {
			// Check max pages
			if (paginationOptions.maxPages > 0 && pageCount >= paginationOptions.maxPages) {
				break;
			}

			// Check rate limit before next request
			if (rateLimitOptions.enabled) {
				const status = await checkRateLimit.call(this, rateLimitOptions);
				if (status.remaining < rateLimitOptions.threshold) {
					await waitForRateLimit.call(this, rateLimitOptions);
				}
			}

			// Use the opaque next URL directly (it includes all necessary params)
			let nextUrl = response.linkHeader.next;

			// Ensure URL is absolute
			if (!nextUrl.startsWith('http')) {
				nextUrl = `${canvasUrl}${nextUrl}`;
			}

			const requestOptions: IHttpRequestOptions = {
				method: 'GET',
				url: nextUrl,
				returnFullResponse: true,
				json: true,
			};

			const nextResponse = await this.helpers.httpRequestWithAuthentication.call(
				this,
				credentialType,
				requestOptions,
			);

			const headers = nextResponse.headers as IDataObject;
			response = {
				data: nextResponse.body as IDataObject | IDataObject[],
				rateLimitStatus: parseRateLimitHeaders(headers),
				linkHeader: parseLinkHeader(headers.link as string),
			};

			const nextData = response.data;
			if (Array.isArray(nextData)) {
				allItems.push(...nextData);
			} else {
				allItems.push(nextData);
			}
			pageCount++;
			lastRateLimitStatus = response.rateLimitStatus;
		}
	}

	return {
		items: allItems,
		totalPages: pageCount,
		rateLimitStatus: lastRateLimitStatus,
	};
}

/**
 * Build include[] query parameters
 */
export function buildIncludeParams(includes: string[]): IDataObject {
	const query: IDataObject = {};
	for (const include of includes) {
		// Canvas uses array notation: include[]=term&include[]=teachers
		if (!query['include[]']) {
			query['include[]'] = [];
		}
		(query['include[]'] as string[]).push(include);
	}
	return query;
}

/**
 * Execute with error handling based on options
 */
/**
 * Build a curl command string from request details for debug output
 */
export function buildCurlCommand(
	method: string,
	baseUrl: string,
	endpoint: string,
	qs?: Record<string, unknown>,
	body?: Record<string, unknown>,
	authType?: string,
): string {
	const url = new URL(`${baseUrl}${endpoint}`);

	if (qs) {
		for (const [key, value] of Object.entries(qs)) {
			if (Array.isArray(value)) {
				for (const v of value) {
					url.searchParams.append(key, String(v));
				}
			} else if (value !== undefined && value !== null) {
				url.searchParams.append(key, String(value));
			}
		}
	}

	const tokenLabel = authType === 'oAuth2' ? '<OAUTH2_TOKEN>' : '<ACCESS_TOKEN>';
	const parts: string[] = [
		'curl',
		`-X ${method}`,
		`-H 'Authorization: Bearer ${tokenLabel}'`,
	];

	if (body && Object.keys(body).length > 0) {
		parts.push("-H 'Content-Type: application/json'");
		parts.push(`-d '${JSON.stringify(body)}'`);
	}

	parts.push(`'${url.toString()}'`);

	return parts.join(' \\\n  ');
}

export async function executeWithErrorHandling<T>(
	this: IExecuteFunctions,
	operation: () => Promise<T>,
	errorOptions: IErrorHandlingOptions,
	originalItem: IDataObject,
	resource: string,
	operationName: string,
	endpoint: string,
): Promise<{ success: boolean; data?: T; error?: ICanvasErrorOutput }> {
	const attemptOperation = async (retriesLeft: number): Promise<{ success: boolean; data?: T; error?: ICanvasErrorOutput }> => {
		try {
			const data = await operation();
			return { success: true, data };
		} catch (error) {
			const jsonError = error as JsonObject;

			// For retryThenError mode, retry before giving up
			if (errorOptions.onError === 'retryThenError' && retriesLeft > 0) {
				const delay = calculateBackoff(
					errorOptions.maxRetries - retriesLeft,
					DEFAULT_RATE_LIMIT_OPTIONS.baseDelayMs,
					DEFAULT_RATE_LIMIT_OPTIONS.maxDelayMs,
				);
				await sleep(delay);
				return attemptOperation(retriesLeft - 1);
			}

			const errorOutput = createErrorOutput(
				jsonError,
				originalItem,
				resource,
				operationName,
				endpoint,
			);

			switch (errorOptions.onError) {
				case 'stop':
					throw new NodeApiError(this.getNode(), jsonError, {
						message: errorOutput.errorMessage,
						description: `${errorOutput.errorType} error on ${resource}/${operationName}`,
					});

				case 'continueWithError':
				case 'retryThenError':
					return { success: false, error: errorOutput };

				case 'ignoreAndContinue':
					return { success: false };

				default:
					throw error;
			}
		}
	};

	const retries = errorOptions.onError === 'retryThenError' ? errorOptions.maxRetries : 0;
	return attemptOperation(retries);
}
