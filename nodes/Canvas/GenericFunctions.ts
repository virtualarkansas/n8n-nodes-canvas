import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

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

type CanvasContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

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

/** Canvas never returns more than 100 records per page. */
export const CANVAS_MAX_PER_PAGE = 100;

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
 * Parse rate limit headers from Canvas API response.
 * `remaining` is undefined-safe: when Canvas sends no header (throttling disabled
 * on self-hosted instances) the bucket is treated as full.
 */
export function parseRateLimitHeaders(headers: IDataObject | undefined): IRateLimitStatus {
	const remainingHeader = headers?.['x-rate-limit-remaining'];
	const costHeader = headers?.['x-request-cost'];
	const remaining = parseFloat(String(remainingHeader ?? ''));
	const cost = parseFloat(String(costHeader ?? ''));
	return {
		remaining: Number.isFinite(remaining) ? remaining : 1000,
		cost: Number.isFinite(cost) ? cost : undefined,
	};
}

/**
 * Parse Link header for pagination
 * Canvas uses RFC 5988 Web Linking format
 */
export function parseLinkHeader(linkHeader: string | undefined): IParsedLinkHeader {
	const result: IParsedLinkHeader = {};

	if (!linkHeader || typeof linkHeader !== 'string') {
		return result;
	}

	// Parse links like: <url>; rel="next", <url>; rel="prev"
	// URLs may themselves contain commas, so match whole <...>; rel="..." groups.
	const pattern = /<([^>]+)>\s*;\s*rel="?([a-zA-Z]+)"?/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(linkHeader)) !== null) {
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

	return result;
}

// ============================================
// Query string serialization
// ============================================

function appendQueryPair(parts: string[], key: string, value: unknown): void {
	if (value === undefined || value === null) {
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
				// Array of objects, e.g. quiz_extensions[][user_id]=1
				for (const [subKey, subValue] of Object.entries(entry as Record<string, unknown>)) {
					appendQueryPair(parts, `${key}[][${encodeURIComponent(subKey)}]`, subValue);
				}
			} else {
				appendQueryPair(parts, `${key}[]`, entry);
			}
		}
		return;
	}
	if (typeof value === 'object') {
		for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
			appendQueryPair(parts, `${key}[${encodeURIComponent(subKey)}]`, subValue);
		}
		return;
	}
	// Scalars: a key that already ends in [] (e.g. `key[]` reached through recursion) is kept.
	parts.push(`${key}=${encodeURIComponent(String(value))}`);
}

/**
 * Serialize query parameters the way Canvas (Rails) expects them:
 *   - arrays become repeated `key[]=value` pairs,
 *   - nested objects become `key[sub]=value`,
 *   - `undefined` / `null` are dropped.
 *
 * A key may be given with or without a trailing `[]`; both produce `key[]=...`.
 * The node builds the query string itself instead of delegating to the HTTP
 * client so the request is identical on every n8n version and matches the
 * curl command shown in debug mode.
 */
export function buildCanvasQueryString(query?: Record<string, unknown>): string {
	if (!query) {
		return '';
	}
	const parts: string[] = [];
	for (const [rawKey, rawValue] of Object.entries(query)) {
		if (rawValue === undefined || rawValue === null) {
			continue;
		}
		let key = rawKey;
		let value = rawValue;
		if (key.endsWith('[]')) {
			key = key.slice(0, -2);
			if (!Array.isArray(value)) {
				value = [value];
			}
		}
		// Keep bracket syntax in keys readable (`enrollment[user_id]`), encode everything else.
		const encodedKey = key
			.split(/([[\]])/)
			.map((piece) => (piece === '[' || piece === ']' ? piece : encodeURIComponent(piece)))
			.join('');
		appendQueryPair(parts, encodedKey, value);
	}
	return parts.join('&');
}

/**
 * Build the absolute request URL for an endpoint (`/api/v1/...`) plus query.
 */
export function buildCanvasUrl(
	canvasUrl: string,
	endpoint: string,
	query?: Record<string, unknown>,
): string {
	const queryString = buildCanvasQueryString(query);
	if (!queryString) {
		return `${canvasUrl}${endpoint}`;
	}
	const separator = endpoint.includes('?') ? '&' : '?';
	return `${canvasUrl}${endpoint}${separator}${queryString}`;
}

/**
 * SIS IDs may contain characters that mean something in a URL
 * (`sis_user_id:A/B #1`). Handlers put parameter values into the path as they
 * are, so encode every value that needs it wherever it forms a path segment.
 * A value that already looks encoded (%2F) is left alone.
 */
export function encodePathValues(endpoint: string, values: Iterable<string>): string {
	if (/^https?:\/\//i.test(endpoint)) {
		return endpoint;
	}

	const candidates = Array.from(new Set(values))
		.filter(
			(value) =>
				value.length > 0 &&
				/[^A-Za-z0-9_.~:,@!*'()$-]/.test(value) &&
				!/%[0-9A-Fa-f]{2}/.test(value),
		)
		.sort((a, b) => b.length - a.length);
	if (candidates.length === 0) {
		return endpoint;
	}

	// The value may itself contain "?" or "/", so look for it as a whole before
	// deciding where the path ends.
	let result = endpoint;
	for (const value of candidates) {
		const encoded = encodeURIComponent(value)
			.replace(/%3A/gi, ':')
			.replace(/%2C/gi, ',')
			.replace(/%40/g, '@');
		const marker = `/${value}`;
		let from = 0;
		for (;;) {
			const at = result.indexOf(marker, from);
			if (at === -1) {
				break;
			}
			// Only where the value is a whole path segment, before any query string.
			const after = result[at + marker.length];
			const inQuery = result.slice(0, at).includes('?');
			if (!inQuery && (after === undefined || after === '/' || after === '?')) {
				result = `${result.slice(0, at)}/${encoded}${result.slice(at + marker.length)}`;
				from = at + encoded.length + 1;
			} else {
				from = at + marker.length;
			}
		}
	}
	return result;
}

/**
 * Canvas returns absolute URLs in Link and Location headers. Requests carrying
 * the user's token must only ever go to the configured Canvas host, so keep
 * the path and query of such a URL and re-anchor it on the configured base URL.
 * (This also keeps pagination working when Canvas sits behind a proxy that
 * reports a different scheme or host name.)
 */
export function resolveCanvasUrl(canvasUrl: string, url: string): string {
	if (!/^https?:\/\//i.test(url)) {
		return `${canvasUrl}${url.startsWith('/') ? '' : '/'}${url}`;
	}
	const parsed = new URL(url);
	return `${canvasUrl}${parsed.pathname}${parsed.search}`;
}

// ============================================
// Errors
// ============================================

function toStatus(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) {
		return parseInt(value, 10);
	}
	return undefined;
}

/**
 * Find the HTTP status code on an error thrown by n8n's request helpers.
 * `NodeApiError.httpCode` is a string ("404"); other shapes carry numbers.
 */
export function extractHttpStatus(error: unknown): number | undefined {
	const seen = new Set<unknown>();
	let current = error as JsonObject | undefined;
	for (let depth = 0; current && typeof current === 'object' && depth < 4; depth++) {
		if (seen.has(current)) {
			break;
		}
		seen.add(current);
		const response = current.response as JsonObject | undefined;
		const status =
			toStatus(current.httpCode) ??
			toStatus(current.statusCode) ??
			toStatus(current.status) ??
			toStatus(response?.status) ??
			toStatus(response?.statusCode);
		if (status !== undefined) {
			return status;
		}
		current = current.cause as JsonObject | undefined;
	}
	return undefined;
}

/**
 * The response body Canvas sent with an error, when n8n kept it.
 */
function getErrorResponseBody(error: unknown): unknown {
	const seen = new Set<unknown>();
	let current = error as JsonObject | undefined;
	for (let depth = 0; current && typeof current === 'object' && depth < 4; depth++) {
		if (seen.has(current)) {
			break;
		}
		seen.add(current);
		const context = current.context as JsonObject | undefined;
		if (context?.data !== undefined && context.data !== null) {
			return context.data;
		}
		const response = current.response as JsonObject | undefined;
		const body = response?.data ?? response?.body;
		if (body !== undefined && body !== null) {
			return body;
		}
		current = current.cause as JsonObject | undefined;
	}
	return undefined;
}

function collectMessages(value: unknown, out: string[], depth = 0): void {
	if (value === undefined || value === null || depth > 4 || out.length >= 10) {
		return;
	}
	if (typeof value === 'string') {
		if (value.trim()) {
			out.push(value.trim());
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			collectMessages(entry, out, depth + 1);
		}
		return;
	}
	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		if (typeof obj.message === 'string') {
			out.push(obj.message.trim());
			return;
		}
		for (const [key, entry] of Object.entries(obj)) {
			// Validation errors: { "name": [{ "attribute": "name", "type": "blank", "message": "blank" }] }
			const before = out.length;
			collectMessages(entry, out, depth + 1);
			if (depth === 0 && out.length > before && !/^\d+$/.test(key)) {
				for (let i = before; i < out.length; i++) {
					out[i] = `${key}: ${out[i]}`;
				}
			}
		}
	}
}

/**
 * Canvas reports errors in several shapes:
 *   { "errors": [{ "message": "..." , "error_code": "..." }] }
 *   { "errors": { "field": [{ "type": "blank", "message": "..." }] } }
 *   [{ "attribute": "recipients", "message": "invalid" }]
 *   { "message": "..." } / { "error": "..." } / plain text
 */
export function getCanvasErrorDetails(error: unknown): {
	messages: string[];
	code?: string;
	errors?: unknown;
} {
	return describeCanvasErrorBody(getErrorResponseBody(error));
}

function describeCanvasErrorBody(body: unknown): {
	messages: string[];
	code?: string;
	errors?: unknown;
} {
	const messages: string[] = [];
	let code: string | undefined;
	let errors: unknown;

	if (typeof body === 'string') {
		const text = body.trim();
		// Skip HTML error pages; keep short plain-text bodies such as "403 Forbidden (Rate Limit Exceeded)".
		if (text && !text.startsWith('<') && text.length <= 500) {
			messages.push(text);
		}
	} else if (Array.isArray(body)) {
		// Conversations and reservations: [{ "attribute": "recipients", "message": "invalid" }]
		errors = body;
		for (const entry of body) {
			const before = messages.length;
			collectMessages(entry, messages, 1);
			const attribute =
				entry && typeof entry === 'object' ? (entry as Record<string, unknown>).attribute : undefined;
			if (typeof attribute === 'string' && attribute && messages.length > before) {
				messages[before] = `${attribute}: ${messages[before]}`;
			}
		}
	} else if (body && typeof body === 'object') {
		const obj = body as Record<string, unknown>;
		errors = obj.errors ?? obj.error ?? obj.message;
		collectMessages(obj.errors, messages);
		if (messages.length === 0) {
			collectMessages(obj.message ?? obj.error, messages);
		}
		const first = Array.isArray(obj.errors)
			? (obj.errors[0] as Record<string, unknown> | undefined)
			: undefined;
		if (first && typeof first === 'object') {
			code = (first.error_code ?? first.type) as string | undefined;
		}
		if (!code && typeof obj.error_code === 'string') {
			code = obj.error_code;
		}
	}

	return { messages: Array.from(new Set(messages)), code, errors };
}

/**
 * Is this response Canvas' throttle answer? By default that is
 * `403 Forbidden (Rate Limit Exceeded)` as plain text with
 * `X-Rate-Limit-Remaining: 0.0`; instances can opt in to 429 instead.
 */
export function isThrottleResponse(status: number, body: unknown, headers?: IDataObject): boolean {
	if (status === 429) {
		return true;
	}
	if (status !== 403) {
		return false;
	}
	const text = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body.toString('utf8') : JSON.stringify(body ?? '');
	if (/rate limit exceeded/i.test(text)) {
		return true;
	}
	// An ordinary "forbidden" answer is JSON with an errors payload; the throttle answer is not.
	const remaining = parseFloat(String(headers?.['x-rate-limit-remaining'] ?? ''));
	return Number.isFinite(remaining) && remaining <= 0 && (body === undefined || body === null || typeof body === 'string');
}

/** How the node classified an error it raised itself (overrides what the status suggests). */
function taggedErrorType(error: unknown): CanvasErrorType | undefined {
	const seen = new Set<unknown>();
	let current = error as JsonObject | undefined;
	for (let depth = 0; current && typeof current === 'object' && depth < 4; depth++) {
		if (seen.has(current)) {
			break;
		}
		seen.add(current);
		const tag = (current.context as JsonObject | undefined)?.canvasErrorType ?? current.canvasErrorType;
		if (typeof tag === 'string') {
			return tag as CanvasErrorType;
		}
		current = current.cause as JsonObject | undefined;
	}
	return undefined;
}

function tagError<T extends Error>(error: T, type: CanvasErrorType, data?: unknown): T {
	const target = error as unknown as { context?: IDataObject };
	target.context = { ...(target.context ?? {}), canvasErrorType: type };
	if (data !== undefined) {
		target.context.data = data as IDataObject;
	}
	return error;
}

/** Remember on the error that the failed request was a write (anything but GET). */
function markWrite<T extends Error>(error: T): T {
	const target = error as unknown as { context?: IDataObject };
	target.context = { ...(target.context ?? {}), canvasWrite: true };
	return error;
}

function isWriteFailure(error: unknown): boolean {
	return ((error as JsonObject)?.context as JsonObject | undefined)?.canvasWrite === true;
}

/** A network failure that happened before the request could leave: nothing reached Canvas. */
function neverSent(error: unknown): boolean {
	const parts: string[] = [];
	let current = error as JsonObject | undefined;
	for (let depth = 0; current && typeof current === 'object' && depth < 4; depth++) {
		parts.push(
			String(current.code ?? ''),
			String(current.httpCode ?? ''),
			String(current.message ?? ''),
			String(current.description ?? ''),
		);
		if (Array.isArray(current.messages)) {
			parts.push(current.messages.map(String).join(' '));
		}
		current = current.cause as JsonObject | undefined;
	}
	return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH/.test(parts.join(' '));
}

/**
 * Canvas answers throttled requests with `403 Forbidden (Rate Limit Exceeded)`
 * by default, and with 429 only when the instance opts in.
 */
export function isRateLimitError(error: unknown): boolean {
	if (taggedErrorType(error) === 'RATE_LIMITED') {
		return true;
	}
	const status = extractHttpStatus(error);
	if (status === 429) {
		return true;
	}
	if (status !== 403) {
		return false;
	}
	const body = getErrorResponseBody(error);
	const haystack = [
		typeof body === 'string' ? body : JSON.stringify(body ?? ''),
		String((error as JsonObject)?.message ?? ''),
		String((error as JsonObject)?.description ?? ''),
	].join(' ');
	return /rate limit exceeded/i.test(haystack);
}

/**
 * Errors worth retrying: throttling, server-side failures and network failures.
 * Client errors (400, 401, 403, 404, 422, ...) will not succeed on a retry.
 *
 * A write is only repeated when Canvas cannot have carried it out: it was throttled,
 * the connection was never established, or Canvas answered 503 (not available).
 * After a 500/502/504 or a connection that broke mid-way the write may have been
 * applied, and repeating it could create a second record.
 */
export function isRetryableError(error: unknown): boolean {
	if (isRateLimitError(error)) {
		return true;
	}
	const write = isWriteFailure(error);
	const tag = taggedErrorType(error);
	if (tag === 'NETWORK_ERROR') {
		return write ? neverSent(error) : true;
	}
	if (tag === 'INVALID_PARAMETERS') {
		return false;
	}
	const status = extractHttpStatus(error);
	if (status === undefined) {
		// No HTTP response at all. Errors raised by the node itself are not retryable.
		const name = String((error as JsonObject)?.name ?? '');
		if (name === 'NodeOperationError' || name === 'ApplicationError') {
			return false;
		}
		return write ? neverSent(error) : true;
	}
	return write ? status === 503 : status >= 500;
}

/**
 * Categorize HTTP error codes into Canvas error types
 */
export function categorizeError(statusCode: number | undefined): CanvasErrorType {
	switch (statusCode) {
		case 400:
		case 422:
			return 'VALIDATION_ERROR';
		case 401:
			return 'UNAUTHORIZED';
		case 403:
			return 'FORBIDDEN';
		case 404:
			return 'NOT_FOUND';
		case 409:
			return 'CONFLICT';
		case 429:
			return 'RATE_LIMITED';
		default:
			if (statusCode !== undefined && statusCode >= 500) {
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
	const statusCode = extractHttpStatus(error);
	const details = getCanvasErrorDetails(error);
	const name = String(error?.name ?? '');

	const tag = taggedErrorType(error);
	let errorType: CanvasErrorType;
	if (tag) {
		errorType = tag;
	} else if (isRateLimitError(error)) {
		errorType = 'RATE_LIMITED';
	} else if (statusCode !== undefined) {
		errorType = categorizeError(statusCode);
	} else if (name === 'NodeOperationError' || name === 'ApplicationError') {
		errorType = 'INVALID_PARAMETERS';
	} else if (
		name === 'NodeApiError' ||
		error?.code ||
		/ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network/i.test(String(error?.message ?? ''))
	) {
		// n8n wraps connection failures in a NodeApiError that carries no HTTP status.
		errorType = 'NETWORK_ERROR';
	} else {
		errorType = 'UNKNOWN';
	}

	const fallbackMessage =
		(error?.message as string) || (error?.description as string) || 'Unknown error occurred';
	const message = details.messages.length > 0 ? details.messages.join('; ') : fallbackMessage;

	const output: ICanvasErrorOutput = {
		error: true,
		errorCode: statusCode ?? 0,
		errorType,
		errorMessage: message,
		originalItem,
		resource,
		operation,
		endpoint,
		timestamp: new Date().toISOString(),
	};
	if (details.code) {
		output.canvasErrorCode = details.code;
	}
	if (details.errors !== undefined) {
		output.canvasErrors = details.errors;
	} else {
		// Some refusals carry a record instead of an error list, e.g. the report that
		// is already running (409): hand it on so a workflow can use it.
		const body = getErrorResponseBody(error);
		if (body && typeof body === 'object') {
			output.responseBody = body;
		}
	}
	return output;
}

// ============================================
// Credentials / base URL
// ============================================

const LTI_CREDENTIAL = 'canvasLtiAdvantageApi';

function getCredentialType(context: CanvasContext): string {
	const authType = context.getNodeParameter('authentication', 0) as string;
	if (authType === 'oAuth2') {
		return 'canvasOAuth2Api';
	}
	return authType === 'ltiAdvantage' ? LTI_CREDENTIAL : 'canvasApi';
}

/**
 * Get Canvas API base URL from credentials
 */
export async function getCanvasUrl(this: CanvasContext): Promise<string> {
	const credentials = await this.getCredentials(getCredentialType(this));
	const canvasUrl = String(credentials.canvasUrl ?? '')
		.trim()
		.replace(/\/+$/, '');

	if (!/^https?:\/\/[^/]+/i.test(canvasUrl)) {
		throw new NodeOperationError(
			this.getNode(),
			'The Canvas URL in the credentials is not valid',
			{ description: 'Enter the full address of your Canvas instance, e.g. https://school.instructure.com' },
		);
	}

	return canvasUrl;
}

// ============================================
// Rate limiting
// ============================================

interface IRateLimitState {
	/** Last X-Rate-Limit-Remaining value seen in this execution */
	remaining?: number;
	/** In-flight probe shared by parallel requests */
	probe?: Promise<IRateLimitStatus>;
}

/** One state object per node execution (the context object lives exactly that long). */
const rateLimitStates = new WeakMap<object, IRateLimitState>();

function getRateLimitState(context: CanvasContext): IRateLimitState {
	let state = rateLimitStates.get(context);
	if (!state) {
		state = {};
		rateLimitStates.set(context, state);
	}
	return state;
}

/**
 * Check rate limit status by making a lightweight probe request
 */
export async function checkRateLimit(
	this: CanvasContext,
	options: IRateLimitOptions,
): Promise<IRateLimitStatus> {
	// An LTI Advantage token cannot call /api/v1/users/self: go by the responses alone.
	if (!options.enabled || getCredentialType(this) === LTI_CREDENTIAL) {
		return { remaining: 1000 };
	}

	const state = getRateLimitState(this);
	if (!state.probe) {
		const run = async (): Promise<IRateLimitStatus> => {
			const canvasUrl = await getCanvasUrl.call(this);
			const requestOptions: IHttpRequestOptions = {
				method: 'GET',
				url: `${canvasUrl}/api/v1/users/self`,
				returnFullResponse: true,
				json: true,
				// Read the status ourselves: n8n drops the plain-text body of Canvas' throttle answer.
				ignoreHttpStatusErrors: true,
			};
			try {
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					getCredentialType(this),
					requestOptions,
				);
				const status = Number(response.statusCode ?? 200);
				const headers = (response.headers ?? {}) as IDataObject;
				if (isThrottleResponse(status, response.body, headers)) {
					return { remaining: 0 };
				}
				if (status >= 400) {
					// The probe failed for another reason; let the real request report it.
					return { remaining: 1000 };
				}
				return parseRateLimitHeaders(headers);
			} catch {
				return { remaining: 1000 };
			}
		};
		state.probe = run().finally(() => {
			state.probe = undefined;
		});
	}
	const status = await state.probe;
	state.remaining = status.remaining;
	return status;
}

/**
 * Wait for rate limit to recover
 */
export async function waitForRateLimit(
	this: CanvasContext,
	options: IRateLimitOptions,
	lastKnown?: IRateLimitStatus,
): Promise<void> {
	let status = lastKnown ?? (await checkRateLimit.call(this, options));

	for (let attempt = 0; status.remaining < options.threshold; attempt++) {
		if (attempt >= options.maxRetries) {
			throw tagError(
				new NodeOperationError(
					this.getNode(),
					`Canvas rate limit quota is still below the threshold (${options.threshold}) after ${options.maxRetries} retries`,
					{
						description:
							'Lower the Threshold under Rate Limiting, reduce the Batch Size, or try again later. ' +
							`Last X-Rate-Limit-Remaining: ${status.remaining}`,
					},
				),
				'RATE_LIMITED',
			);
		}
		await sleep(calculateBackoff(attempt, options.baseDelayMs, options.maxDelayMs));
		status = await checkRateLimit.call(this, options);
	}
}

/**
 * Before a request: make sure the quota is above the threshold.
 * The quota is read from the previous response of this execution; Canvas is
 * only probed when nothing is known yet or when the last reading was low.
 */
async function ensureRateLimit(context: CanvasContext, options: IRateLimitOptions): Promise<void> {
	if (!options.enabled) {
		return;
	}
	const state = getRateLimitState(context);
	if (state.remaining !== undefined && state.remaining >= options.threshold) {
		return;
	}
	const status = await checkRateLimit.call(context, options);
	if (status.remaining < options.threshold) {
		await waitForRateLimit.call(context, options, status);
	}
}

// ============================================
// Requests
// ============================================

/**
 * Make a Canvas API request with rate limit handling.
 * `endpoint` is a path such as `/api/v1/courses`, or an absolute Canvas URL
 * taken from a Link/Location header.
 */
export async function canvasApiRequest(
	this: CanvasContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject | IDataObject[] | string | Buffer,
	query?: IDataObject,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
	contentType?: string,
): Promise<ICanvasResponse> {
	const canvasUrl = await getCanvasUrl.call(this);
	const credentialType = getCredentialType(this);

	const baseUrl = /^https?:\/\//i.test(endpoint)
		? resolveCanvasUrl(canvasUrl, endpoint)
		: `${canvasUrl}${endpoint}`;
	const queryString = buildCanvasQueryString(query);
	let url = queryString ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryString}` : baseUrl;
	// Masquerading applies to every request made for the item, follow-up pages included.
	if (rateLimitOptions.asUserId && !/[?&]as_user_id=/.test(url)) {
		url += `${url.includes('?') ? '&' : '?'}${buildCanvasQueryString({ as_user_id: rateLimitOptions.asUserId })}`;
	}

	const requestOptions: IHttpRequestOptions = {
		method,
		url,
		returnFullResponse: true,
		json: true,
		// The node reads the status itself: n8n drops plain-text error bodies, and Canvas'
		// throttle answer ("403 Forbidden (Rate Limit Exceeded)") is exactly that.
		ignoreHttpStatusErrors: true,
	};
	if (method !== 'GET') {
		// A write must never be replayed as a GET against wherever a redirect points.
		requestOptions.disableFollowRedirect = true;
	}
	// n8n drops an empty array body, but for Canvas "[]" means "replace the list with nothing".
	if (Array.isArray(body) && body.length === 0) {
		body = '[]';
		contentType = 'application/json';
	}
	const rawBody = typeof body === 'string' || Buffer.isBuffer(body);
	if (rawBody) {
		// Raw text or bytes (import files): send them untouched and parse the JSON answer ourselves.
		requestOptions.body = body;
		requestOptions.json = false;
		requestOptions.headers = {
			'Content-Type': contentType || (typeof body === 'string' ? 'text/plain' : 'application/octet-stream'),
			Accept: 'application/json',
		};
	} else if (body !== undefined && method !== 'GET' && (Array.isArray(body) || Object.keys(body).length > 0)) {
		requestOptions.body = body;
	}

	const state = getRateLimitState(this);
	let refreshTried = false;

	for (let attempt = 0; ; attempt++) {
		await ensureRateLimit(this, rateLimitOptions);

		let response: { statusCode?: number; headers?: IDataObject; body?: unknown };
		try {
			response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				credentialType,
				requestOptions,
			);
		} catch (error) {
			// No HTTP response at all: DNS failure, refused connection, timeout.
			const failure = extractHttpStatus(error) === undefined ? tagError(error as Error, 'NETWORK_ERROR') : error;
			throw method === 'GET' ? failure : markWrite(failure as Error);
		}

		// OAuth2 and LTI Advantage: n8n only renews an expired token when the request fails
		// with 401, so repeat it once the way n8n expects.
		const renewable = credentialType === 'canvasOAuth2Api' || credentialType === LTI_CREDENTIAL;
		if (Number(response.statusCode) === 401 && renewable && !refreshTried) {
			refreshTried = true;
			try {
				response = await this.helpers.httpRequestWithAuthentication.call(this, credentialType, {
					...requestOptions,
					ignoreHttpStatusErrors: false,
				});
			} catch (error) {
				// Still refused after the refresh attempt, or the refresh itself failed.
				throw extractHttpStatus(error) === undefined ? tagError(error as Error, 'UNAUTHORIZED') : error;
			}
		}

		const status = Number(response.statusCode ?? 200);
		const headers = (response.headers ?? {}) as IDataObject;
		const rateLimitStatus = parseRateLimitHeaders(headers);
		if (headers['x-rate-limit-remaining'] !== undefined) {
			state.remaining = rateLimitStatus.remaining;
		}

		let data = response.body;
		if (Buffer.isBuffer(data)) {
			data = data.toString('utf8');
		}
		if (rawBody && typeof data === 'string') {
			try {
				data = data.trim() === '' ? undefined : JSON.parse(data);
			} catch {
				// keep the text
			}
		}

		if (status >= 200 && status < 300) {
			return {
				data: (rawBody && typeof data === 'string' ? { data } : data) as IDataObject | IDataObject[],
				rateLimitStatus,
				linkHeader: parseLinkHeader(headers.link as string),
			};
		}

		const throttled = isThrottleResponse(status, data, headers);
		if (throttled) {
			state.remaining = 0;
			// Only throttling is retried here; other failures go to the error handling mode.
			if (attempt < rateLimitOptions.maxRetries) {
				await sleep(
					calculateBackoff(attempt, rateLimitOptions.baseDelayMs, rateLimitOptions.maxDelayMs),
				);
				continue;
			}
		}

		const failure = buildResponseError(this, status, data, headers, throttled);
		throw method === 'GET' ? failure : markWrite(failure);
	}
}

const STATUS_MESSAGES: Record<number, string> = {
	400: 'Canvas rejected the request as invalid',
	401: 'Canvas rejected the credentials',
	403: 'Canvas refused the request: the user of this token is not allowed to do this',
	404: 'Canvas could not find what was asked for, or the user of this token may not see it',
	409: 'Canvas reported a conflict',
	422: 'Canvas could not process the request',
};

/**
 * Turn a non-2xx Canvas response into the error the node reports, keeping
 * Canvas' own body (JSON or text) so its message reaches the user.
 */
function buildResponseError(
	context: CanvasContext,
	status: number,
	body: unknown,
	headers: IDataObject,
	throttled: boolean,
): NodeApiError {
	// Never carry a whole HTML error page around.
	const kept = typeof body === 'string' ? body.slice(0, 2000) : body;
	const details = describeCanvasErrorBody(kept);

	let message: string;
	if (throttled) {
		message = `Canvas rate limit exceeded (HTTP ${status})`;
	} else if (details.messages.length > 0) {
		message = details.messages.join('; ');
	} else if (status >= 300 && status < 400) {
		message = `Canvas answered with a redirect (HTTP ${status})${headers.location ? ` to ${String(headers.location)}` : ''} instead of carrying out the request`;
	} else if (status >= 500) {
		message = `Canvas failed with an internal error (HTTP ${status})`;
	} else {
		message = `${STATUS_MESSAGES[status] ?? 'Canvas refused the request'} (HTTP ${status})`;
	}

	const error = new NodeApiError(
		context.getNode(),
		{ message, httpCode: String(status) } as JsonObject,
		{ message, httpCode: String(status), description: `Canvas answered HTTP ${status}` },
	);
	const target = error as unknown as { context: IDataObject };
	target.context = { ...(target.context ?? {}), data: kept as IDataObject };
	if (throttled) {
		target.context.canvasErrorType = 'RATE_LIMITED';
	}
	return error;
}

/**
 * The record inside a response that wraps a single record: `{ "late_policy": {...} }`.
 * Returns the response itself when there is nothing to unwrap.
 */
export function unwrapRecord(data: unknown, dataKey?: string): unknown {
	if (dataKey && data && typeof data === 'object' && !Array.isArray(data)) {
		const inner = (data as IDataObject)[dataKey];
		if (inner && typeof inner === 'object') {
			return inner;
		}
	}
	return data;
}

/**
 * Pull the record list out of a list response.
 * Returns undefined when the response is not a list.
 */
function extractList(data: unknown, dataKey?: string): IDataObject[] | undefined {
	if (Array.isArray(data)) {
		return data as IDataObject[];
	}
	if (dataKey && data && typeof data === 'object') {
		const wrapped = (data as IDataObject)[dataKey];
		if (Array.isArray(wrapped)) {
			return wrapped as IDataObject[];
		}
	}
	return undefined;
}

/**
 * The per_page value a list request is sent with: the configured page size,
 * never more than Canvas allows and never more than the item limit.
 */
export function resolvePerPage(paginationOptions: IPaginationOptions): number {
	let perPage = Math.min(Math.max(1, paginationOptions.perPage), CANVAS_MAX_PER_PAGE);
	if (paginationOptions.limit !== undefined && paginationOptions.limit > 0) {
		perPage = Math.min(perPage, paginationOptions.limit);
	}
	return perPage;
}

/**
 * Make a Canvas API request and follow pagination to collect the items.
 *
 * Works for any GET: when the response is not a list (a single record) it is
 * returned as the only entry of `items` and no further pages are requested.
 */
export async function canvasApiRequestAllItems(
	this: CanvasContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	query?: IDataObject,
	paginationOptions: IPaginationOptions = DEFAULT_PAGINATION_OPTIONS,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
	dataKey?: string,
): Promise<IPaginatedResult & { isList: boolean }> {
	const limit =
		paginationOptions.limit !== undefined && paginationOptions.limit > 0
			? paginationOptions.limit
			: undefined;

	// A per_page set explicitly on the operation wins over the node-level option.
	const paginatedQuery: IDataObject = { per_page: resolvePerPage(paginationOptions), ...(query ?? {}) };

	let response = await canvasApiRequest.call(
		this,
		method,
		endpoint,
		body,
		paginatedQuery,
		rateLimitOptions,
	);

	const firstList = extractList(response.data, dataKey);
	if (firstList === undefined) {
		return {
			items: [response.data as IDataObject],
			totalPages: 1,
			rateLimitStatus: response.rateLimitStatus,
			isList: false,
		};
	}

	const allItems: IDataObject[] = [...firstList];
	let pageCount = 1;
	// A server that keeps pointing at a page already read must not loop forever.
	const visited = new Set<string>();

	while (paginationOptions.enabled && response.linkHeader.next) {
		if (paginationOptions.maxPages > 0 && pageCount >= paginationOptions.maxPages) {
			break;
		}
		if (limit !== undefined && allItems.length >= limit) {
			break;
		}
		if (visited.has(response.linkHeader.next)) {
			break;
		}
		visited.add(response.linkHeader.next);

		// The next URL is opaque (page numbers or bookmarks) and already carries every parameter.
		response = await canvasApiRequest.call(
			this,
			'GET',
			response.linkHeader.next,
			undefined,
			undefined,
			rateLimitOptions,
		);

		const pageItems = extractList(response.data, dataKey);
		if (pageItems === undefined) {
			break;
		}
		allItems.push(...pageItems);
		pageCount++;
	}

	return {
		items: limit !== undefined ? allItems.slice(0, limit) : allItems,
		totalPages: pageCount,
		rateLimitStatus: response.rateLimitStatus,
		isList: true,
	};
}

/**
 * GET one record whose embedded array is paginated (e.g. the overrides inside
 * a learning object's date details): read every page and return the record
 * with the complete array.
 */
export async function canvasApiRequestMergedRecord(
	this: CanvasContext,
	endpoint: string,
	query: IDataObject | undefined,
	arrayKey: string,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
): Promise<IDataObject> {
	let response = await canvasApiRequest.call(
		this,
		'GET',
		endpoint,
		undefined,
		{ per_page: CANVAS_MAX_PER_PAGE, ...(query ?? {}) },
		rateLimitOptions,
	);
	const record = response.data as IDataObject;
	if (!record || typeof record !== 'object' || !Array.isArray(record[arrayKey])) {
		return record;
	}
	const merged = [...(record[arrayKey] as IDataObject[])];
	const visited = new Set<string>();
	while (response.linkHeader.next && !visited.has(response.linkHeader.next)) {
		visited.add(response.linkHeader.next);
		response = await canvasApiRequest.call(
			this,
			'GET',
			response.linkHeader.next,
			undefined,
			undefined,
			rateLimitOptions,
		);
		const page = (response.data as IDataObject | undefined)?.[arrayKey];
		if (!Array.isArray(page) || page.length === 0) {
			break;
		}
		merged.push(...(page as IDataObject[]));
	}
	return { ...record, [arrayKey]: merged };
}

// ============================================
// Debug output
// ============================================

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Build a curl command string from request details for debug output
 */
export function buildCurlCommand(
	method: string,
	baseUrl: string,
	endpoint: string,
	qs?: Record<string, unknown>,
	body?: Record<string, unknown> | unknown[] | string | Buffer,
	authType?: string,
	contentType?: string,
): string {
	const url = buildCanvasUrl(baseUrl, endpoint, qs);

	const tokenLabel = authType === 'oAuth2' ? '<OAUTH2_TOKEN>' : '<ACCESS_TOKEN>';
	const parts: string[] = [
		'curl',
		`-X ${method}`,
		`-H 'Authorization: Bearer ${tokenLabel}'`,
	];

	if (Buffer.isBuffer(body)) {
		// Bytes cannot be shown on a command line: point curl at a file instead.
		parts.push(`-H ${shellQuote(`Content-Type: ${contentType || 'application/octet-stream'}`)}`);
		parts.push(`--data-binary ${shellQuote(`@<file with the ${body.length} bytes sent>`)}`);
	} else if (typeof body === 'string') {
		parts.push(`-H ${shellQuote(`Content-Type: ${contentType || 'text/plain'}`)}`);
		parts.push(`--data-binary ${shellQuote(body)}`);
	} else if (body && method !== 'GET' && (Array.isArray(body) || Object.keys(body).length > 0)) {
		parts.push("-H 'Content-Type: application/json'");
		parts.push(`-d ${shellQuote(JSON.stringify(body))}`);
	}

	parts.push(shellQuote(url));

	return parts.join(' \\\n  ');
}

// ============================================
// Error handling modes
// ============================================

/**
 * Execute with error handling based on options
 */
export async function executeWithErrorHandling<T>(
	this: IExecuteFunctions,
	operation: () => Promise<T>,
	errorOptions: IErrorHandlingOptions,
	originalItem: IDataObject,
	resource: string,
	operationName: string,
	getEndpoint: string | (() => string),
	itemIndex?: number,
): Promise<{ success: boolean; data?: T; error?: ICanvasErrorOutput }> {
	// n8n's own "On Error: Continue" node setting must not fail the workflow either.
	const mode =
		errorOptions.onError === 'stop' && this.continueOnFail()
			? 'continueWithError'
			: errorOptions.onError;
	const endpointOf = (): string => (typeof getEndpoint === 'function' ? getEndpoint() : getEndpoint);

	let attempt = 0;
	for (;;) {
		try {
			const data = await operation();
			return { success: true, data };
		} catch (error) {
			const jsonError = error as JsonObject;

			// Retry Then Error: only failures that can succeed on a second try.
			if (mode === 'retryThenError' && attempt < errorOptions.maxRetries && isRetryableError(error)) {
				await sleep(
					calculateBackoff(
						attempt,
						DEFAULT_RATE_LIMIT_OPTIONS.baseDelayMs,
						DEFAULT_RATE_LIMIT_OPTIONS.maxDelayMs,
					),
				);
				attempt++;
				continue;
			}

			const endpoint = endpointOf();
			const errorOutput = createErrorOutput(jsonError, originalItem, resource, operationName, endpoint);

			switch (mode) {
				case 'continueWithError':
				case 'retryThenError':
					return { success: false, error: errorOutput };

				case 'ignoreAndContinue':
					return { success: false };

				case 'stop':
				default: {
					const where = `${resource}/${operationName}${endpoint ? ` (${endpoint})` : ''}`;
					if (extractHttpStatus(error) === undefined) {
						// Not an HTTP failure: keep the original error (parameter problems, network errors).
						if (error instanceof NodeOperationError || (error as JsonObject)?.name === 'NodeOperationError') {
							throw error;
						}
						throw new NodeOperationError(this.getNode(), error as Error, {
							itemIndex,
							description: `${errorOutput.errorType} error on ${where}`,
						});
					}
					const description = `${errorOutput.errorType} error (HTTP ${errorOutput.errorCode}) on ${where}`;
					if (error instanceof NodeApiError) {
						// Built from Canvas' response by this node. n8n hands an existing NodeApiError
						// back unchanged from the constructor, so say where it happened on the error itself.
						error.description = description;
						error.context = { ...(error.context ?? {}), itemIndex };
						throw error;
					}
					throw new NodeApiError(this.getNode(), jsonError, {
						message: errorOutput.errorMessage,
						description,
						httpCode: String(errorOutput.errorCode),
						itemIndex,
					});
				}
			}
		}
	}
}

// ============================================
// File uploads
// ============================================

/**
 * Build a multipart/form-data body by hand (no runtime dependency).
 * Canvas requires the file to be the last part.
 */
export function buildMultipartBody(
	fields: Record<string, unknown>,
	file?: { fieldName: string; fileName: string; contentType: string; data: Buffer },
): { body: Buffer; contentType: string } {
	const boundary = `----n8nCanvasBoundary${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const chunks: Buffer[] = [];
	const clean = (value: string): string => value.replace(/[\r\n]/g, ' ').replace(/"/g, '%22');

	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) {
			continue;
		}
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${clean(key)}"\r\n\r\n${String(value)}\r\n`,
				'utf8',
			),
		);
	}

	if (file) {
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${clean(file.fieldName)}"; filename="${clean(file.fileName)}"\r\n` +
					`Content-Type: ${clean(file.contentType)}\r\n\r\n`,
				'utf8',
			),
		);
		chunks.push(file.data);
		chunks.push(Buffer.from('\r\n', 'utf8'));
	}

	chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

function parseJsonBody(body: unknown): IDataObject | undefined {
	if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
		return body as IDataObject;
	}
	const text = Buffer.isBuffer(body) ? body.toString('utf8') : typeof body === 'string' ? body : '';
	if (!text.trim()) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(text) as unknown;
		return parsed && typeof parsed === 'object' ? (parsed as IDataObject) : undefined;
	} catch {
		return undefined;
	}
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
	file: { data: Buffer; fileName?: string; mimeType?: string },
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
	const uploadUrl = step1Data?.upload_url as string | undefined;
	const uploadParams = (step1Data?.upload_params ?? {}) as IDataObject;

	if (!uploadUrl) {
		throw new NodeOperationError(
			this.getNode(),
			'Canvas did not return an upload URL for this file',
			{
				itemIndex,
				description: `The response to POST ${step1Endpoint} had no upload_url. Check that the target accepts file uploads.`,
			},
		);
	}

	// --- Step 2: Multipart upload to upload_url (no Canvas token: the URL is pre-signed) ---
	const multipart = buildMultipartBody(uploadParams, {
		fieldName: (step1Data.file_param as string) || 'file',
		fileName: (step1Body.name as string) || file.fileName || 'file',
		contentType: file.mimeType || 'application/octet-stream',
		data: file.data,
	});

	const step2Options: IHttpRequestOptions = {
		method: 'POST',
		url: uploadUrl,
		body: multipart.body,
		headers: {
			'Content-Type': multipart.contentType,
			'Content-Length': String(multipart.body.length),
		},
		returnFullResponse: true,
		json: false,
		// The confirmation request needs the Canvas token, so follow the redirect ourselves.
		disableFollowRedirect: true,
		ignoreHttpStatusErrors: true,
	};

	const step2Response = await this.helpers.httpRequest(step2Options);
	const step2Headers = (step2Response.headers || {}) as IDataObject;
	const step2StatusCode = step2Response.statusCode as number;
	const step2Body = parseJsonBody(step2Response.body);

	if (step2StatusCode >= 400) {
		throw new NodeApiError(
			this.getNode(),
			{ ...(step2Body ?? {}), httpCode: String(step2StatusCode) } as JsonObject,
			{
				message: `The file upload was rejected by the upload server (HTTP ${step2StatusCode})`,
				httpCode: String(step2StatusCode),
				itemIndex,
			},
		);
	}

	// Some storage back ends answer 200/201 with the finished file object.
	if (step2StatusCode >= 200 && step2StatusCode < 300 && step2Body?.id !== undefined) {
		return step2Body;
	}

	// Otherwise confirm the upload: 3xx Location header, or `location` in a 201 body.
	const locationUrl = (step2Headers.location ?? step2Body?.location) as string | undefined;

	if (!locationUrl) {
		throw new NodeOperationError(
			this.getNode(),
			`The upload server did not say where to confirm the upload (HTTP ${step2StatusCode})`,
			{ itemIndex },
		);
	}

	// --- Step 3: Confirm upload with Canvas auth ---
	const step3Response = await canvasApiRequest.call(
		this,
		'GET',
		locationUrl,
		undefined,
		undefined,
		rateLimitOptions,
	);

	return step3Response.data as IDataObject;
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
	const uploadUrl = responseData?.upload_url as string | undefined;
	const uploadParams = responseData?.upload_params as IDataObject | undefined;
	let progress = responseData?.progress as IDataObject | undefined;

	// --- Step 1b: POST to upload_url if present ---
	if (uploadUrl && uploadParams) {
		const multipart = buildMultipartBody({ ...uploadParams, target_url: fileUrl });

		const uploadOptions: IHttpRequestOptions = {
			method: 'POST',
			url: uploadUrl,
			body: multipart.body,
			headers: {
				'Content-Type': multipart.contentType,
				'Content-Length': String(multipart.body.length),
			},
			returnFullResponse: true,
			json: false,
			disableFollowRedirect: true,
			ignoreHttpStatusErrors: true,
		};

		const uploadResponse = await this.helpers.httpRequest(uploadOptions);
		const uploadStatus = uploadResponse.statusCode as number;
		const uploadBody = parseJsonBody(uploadResponse.body);

		if (uploadStatus >= 400) {
			throw new NodeApiError(
				this.getNode(),
				{ ...(uploadBody ?? {}), httpCode: String(uploadStatus) } as JsonObject,
				{
					message: `The upload server rejected the URL upload (HTTP ${uploadStatus})`,
					httpCode: String(uploadStatus),
				},
			);
		}

		// The upload server may answer with the progress object (or the finished file).
		if (uploadBody?.progress && typeof uploadBody.progress === 'object') {
			progress = uploadBody.progress as IDataObject;
		} else if (uploadBody?.workflow_state !== undefined && uploadBody?.url !== undefined) {
			progress = uploadBody;
		} else if (uploadBody?.id !== undefined && uploadBody?.upload_url === undefined && !progress) {
			return uploadBody;
		}
	}

	// --- Step 2: Poll progress if requested ---
	if (!waitForCompletion || !progress?.url) {
		return progress ? { ...responseData, progress } : responseData;
	}

	return pollCanvasProgress.call(this, progress.url as string, rateLimitOptions);
}

/**
 * Download a file Canvas points to (the `url` of a file record).
 *
 * Such URLs carry their own short-lived authorisation and usually redirect to a
 * storage service on another host, so the Canvas token is not sent. Only when Canvas
 * itself asks for it (401/403 from the Canvas host) is the request repeated with the
 * credential, and then without following redirects with it.
 */
export async function canvasDownload(
	this: IExecuteFunctions,
	fileUrl: string,
): Promise<{ data: Buffer; contentType?: string }> {
	const canvasUrl = await getCanvasUrl.call(this);
	const url = /^https?:\/\//i.test(fileUrl) ? fileUrl : `${canvasUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
	const options: IHttpRequestOptions = {
		method: 'GET',
		url,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		json: false,
		ignoreHttpStatusErrors: true,
	};

	let response = await this.helpers.httpRequest(options);
	let status = Number(response.statusCode);

	const sameHost = new URL(url).host === new URL(canvasUrl).host;
	if ((status === 401 || status === 403) && sameHost) {
		response = await this.helpers.httpRequestWithAuthentication.call(this, getCredentialType(this), {
			...options,
			disableFollowRedirect: true,
		});
		status = Number(response.statusCode);
		const location = (response.headers as IDataObject | undefined)?.location;
		if (status >= 300 && status < 400 && typeof location === 'string') {
			// Wherever the file is stored, that request goes out without the token.
			response = await this.helpers.httpRequest({ ...options, url: new URL(location, url).toString() });
			status = Number(response.statusCode);
		}
	}

	if (status < 200 || status >= 300) {
		throw new NodeApiError(
			this.getNode(),
			{ httpCode: String(status) } as JsonObject,
			{ message: `The file could not be downloaded (HTTP ${status})`, httpCode: String(status) },
		);
	}
	const body = response.body as Buffer | ArrayBuffer | string;
	const data = Buffer.isBuffer(body) ? body : Buffer.from(body as ArrayBuffer);
	const contentType = (response.headers as IDataObject | undefined)?.['content-type'];
	return { data, contentType: typeof contentType === 'string' ? contentType.split(';')[0].trim() : undefined };
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
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const response = await canvasApiRequest.call(
			this,
			'GET',
			progressUrl,
			undefined,
			undefined,
			rateLimitOptions,
		);

		const progressData = response.data as IDataObject;
		const state = progressData?.workflow_state as string;

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
			throw new NodeOperationError(
				this.getNode(),
				`Canvas URL upload failed: ${(progressData.message as string) || 'Unknown error'}`,
			);
		}

		// Still running - wait and retry
		await sleep(intervalMs);
	}

	throw new NodeOperationError(
		this.getNode(),
		`Canvas URL upload timed out after ${(maxAttempts * intervalMs) / 1000} seconds`,
	);
}
