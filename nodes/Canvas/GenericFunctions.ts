import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, ApplicationError } from 'n8n-workflow';

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

	// Convert array query params to Canvas bracket notation (e.g., include[] = [...])
	const convertedQuery = query ? convertArrayParams(query) : undefined;

	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${canvasUrl}${endpoint}`,
		body,
		qs: convertedQuery,
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

	// Add per_page to query (array conversion happens inside canvasApiRequest)
	const paginatedQuery: IDataObject = {
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
 * Convert array query parameters to Canvas bracket notation.
 * Canvas API requires: include[]=val1&include[]=val2
 * n8n sends arrays as: include=val1,val2 (wrong)
 * This converts { include: ['val1', 'val2'] } to { 'include[]': ['val1', 'val2'] }
 */
export function convertArrayParams(query: IDataObject): IDataObject {
	const converted: IDataObject = {};
	for (const [key, value] of Object.entries(query)) {
		if (Array.isArray(value) && value.length > 0 && !key.endsWith('[]')) {
			converted[`${key}[]`] = value;
		} else {
			converted[key] = value;
		}
	}
	return converted;
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

/**
 * Perform the complete Canvas three-step file upload (binary data).
 *
 * Step 1: POST to Canvas API endpoint to notify and get upload token
 * Step 2: POST multipart/form-data to upload_url with upload_params + file
 * Step 3: GET the redirect Location with auth to confirm upload
 */
export async function canvasFileUpload(
	this: IExecuteFunctions,
	step1Endpoint: string,
	step1Body: IDataObject,
	itemIndex: number,
	binaryPropertyName: string,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
): Promise<IDataObject> {
	// --- Step 1: Notify Canvas ---
	const step1Response = await canvasApiRequest.call(
		this,
		'POST',
		step1Endpoint,
		step1Body,
		undefined,
		rateLimitOptions,
	);

	const step1Data = step1Response.data as IDataObject;
	const uploadUrl = step1Data.upload_url as string;
	const uploadParams = step1Data.upload_params as IDataObject;

	if (!uploadUrl || !uploadParams) {
		throw new ApplicationError(
			'Canvas Step 1 response missing upload_url or upload_params',
		);
	}

	// --- Step 2: Multipart upload to upload_url ---
	const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const FormData = require('form-data');
	const formData = new FormData();

	// Add all upload_params first (order matters - file must be last)
	for (const [key, value] of Object.entries(uploadParams)) {
		formData.append(key, String(value));
	}

	// Add file last
	formData.append('file', binaryDataBuffer, {
		filename: binaryData.fileName || 'file',
		contentType: binaryData.mimeType || 'application/octet-stream',
	});

	const step2Options: IHttpRequestOptions = {
		method: 'POST',
		url: uploadUrl,
		body: formData,
		headers: formData.getHeaders(),
		returnFullResponse: true,
		json: false,
		ignoreHttpStatusErrors: true,
	};

	const step2Response = await this.helpers.httpRequest(step2Options);
	const step2Headers = (step2Response.headers || {}) as IDataObject;
	const step2StatusCode = step2Response.statusCode as number;

	// Some 2xx responses return the file object directly in the body
	if (step2StatusCode >= 200 && step2StatusCode < 300) {
		try {
			const bodyData = typeof step2Response.body === 'string'
				? JSON.parse(step2Response.body as string) as IDataObject
				: step2Response.body as IDataObject;
			if (bodyData && bodyData.id) {
				return bodyData;
			}
		} catch {
			// Not JSON, continue to check Location
		}
	}

	// Extract Location header from response (handles both 2xx and 3xx)
	const locationUrl = (step2Headers.location || step2Headers.Location) as string | undefined;

	if (!locationUrl) {
		throw new ApplicationError(
			`Canvas Step 2 response missing Location header for upload confirmation (status: ${step2StatusCode})`,
		);
	}

	// --- Step 3: Confirm upload with Canvas auth ---
	const canvasUrl = await getCanvasUrl.call(this);
	const confirmUrl = locationUrl.startsWith('http')
		? locationUrl
		: `${canvasUrl}${locationUrl}`;

	const authType = this.getNodeParameter('authentication', 0) as string;
	const credentialType = authType === 'oAuth2' ? 'canvasOAuth2Api' : 'canvasApi';

	const step3Options: IHttpRequestOptions = {
		method: 'GET',
		url: confirmUrl,
		returnFullResponse: true,
		json: true,
	};

	const step3Response = await this.helpers.httpRequestWithAuthentication.call(
		this,
		credentialType,
		step3Options,
	);

	return step3Response.body as IDataObject;
}

/**
 * Perform Canvas file upload from a public URL.
 *
 * Step 1: POST to Canvas API endpoint with file metadata
 * Step 1b: POST to upload_url with upload_params + target_url
 * Step 2: Optionally poll progress until completion
 * Step 3: Return final file object or progress object
 */
export async function canvasFileUploadFromUrl(
	this: IExecuteFunctions,
	step1Endpoint: string,
	step1Body: IDataObject,
	fileUrl: string,
	waitForCompletion: boolean,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
): Promise<IDataObject> {
	// --- Step 1: Notify Canvas ---
	const step1BodyWithUrl = { ...step1Body, url: fileUrl };
	const step1Response = await canvasApiRequest.call(
		this,
		'POST',
		step1Endpoint,
		step1BodyWithUrl,
		undefined,
		rateLimitOptions,
	);

	const responseData = step1Response.data as IDataObject;
	const uploadUrl = responseData.upload_url as string | undefined;
	const uploadParams = responseData.upload_params as IDataObject | undefined;
	const progress = responseData.progress as IDataObject | undefined;

	// --- Step 1b: POST to upload_url if present ---
	if (uploadUrl && uploadParams) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const FormData = require('form-data');
		const formData = new FormData();

		for (const [key, value] of Object.entries(uploadParams)) {
			formData.append(key, String(value));
		}
		formData.append('target_url', fileUrl);

		const uploadOptions: IHttpRequestOptions = {
			method: 'POST',
			url: uploadUrl,
			body: formData,
			headers: formData.getHeaders(),
			returnFullResponse: true,
			json: false,
			ignoreHttpStatusErrors: true,
		};

		await this.helpers.httpRequest(uploadOptions);
	}

	// --- Step 2: Poll progress if requested ---
	if (!waitForCompletion || !progress?.url) {
		return responseData;
	}

	return pollCanvasProgress.call(
		this,
		progress.url as string,
		rateLimitOptions,
	);
}

/**
 * Poll a Canvas progress URL until completion.
 * Returns the final file object when available.
 */
export async function pollCanvasProgress(
	this: IExecuteFunctions,
	progressUrl: string,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
	maxAttempts: number = 60,
	intervalMs: number = 2000,
): Promise<IDataObject> {
	const canvasUrl = await getCanvasUrl.call(this);
	const authType = this.getNodeParameter('authentication', 0) as string;
	const credentialType = authType === 'oAuth2' ? 'canvasOAuth2Api' : 'canvasApi';

	const fullUrl = progressUrl.startsWith('http')
		? progressUrl
		: `${canvasUrl}${progressUrl}`;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const pollOptions: IHttpRequestOptions = {
			method: 'GET',
			url: fullUrl,
			returnFullResponse: true,
			json: true,
		};

		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			credentialType,
			pollOptions,
		);

		const progressData = response.body as IDataObject;
		const state = progressData.workflow_state as string;

		if (state === 'completed') {
			const results = progressData.results as IDataObject | undefined;
			if (results?.id) {
				// Fetch the full file object
				const fileResponse = await canvasApiRequest.call(
					this,
					'GET',
					`/api/v1/files/${results.id as string}`,
					undefined,
					undefined,
					rateLimitOptions,
				);
				return fileResponse.data as IDataObject;
			}
			return progressData;
		}

		if (state === 'failed') {
			throw new ApplicationError(
				`Canvas URL upload failed: ${(progressData.message as string) || 'Unknown error'}`,
			);
		}

		// Still running - wait and retry
		await sleep(intervalMs);
	}

	throw new ApplicationError(
		`Canvas URL upload timed out after ${(maxAttempts * intervalMs) / 1000} seconds`,
	);
}
