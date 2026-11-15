import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleepWithAbort } from 'n8n-workflow';

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

/** Wait for the given time. */
export function sleep(ms: number): Promise<void> {
	return sleepWithAbort(ms);
}

/**
 * Wait for the given time, but stop waiting at once when the execution is cancelled
 * (the wait then ends with n8n's cancellation error instead of polling on).
 */
export function pause(context: CanvasContext, ms: number): Promise<void> {
	return sleepWithAbort(ms, (context as Partial<IExecuteFunctions>).getExecutionCancelSignal?.());
}

/** n8n's error for an execution that was stopped by hand or timed out. */
function isCancellation(error: unknown): boolean {
	return /ExecutionCancelledError$/.test(String((error as JsonObject)?.name ?? (error as Error)?.constructor?.name ?? ''));
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
 * A parameter value as it was meant: percent-escapes written by hand (`A%2FB`) are
 * resolved once; text that is not validly escaped (`50%`) is taken as it is.
 */
export function decodePathValue(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/**
 * SIS IDs may contain characters that mean something in a URL
 * (`sis_user_id:A/B #1`). Handlers put parameter values into the path as they
 * are, so every value is encoded wherever it forms a path segment: whatever it
 * contains, it stays one segment and can never add a segment, a query string or
 * a fragment. A value that was encoded by hand (`A%2FB`) is decoded first, so it
 * is not encoded twice.
 */
export function encodePathValues(endpoint: string, values: Iterable<string>): string {
	if (/^https?:\/\//i.test(endpoint)) {
		return endpoint;
	}

	const candidates = Array.from(new Set(values))
		.filter((value) => value.length > 0 && /[^A-Za-z0-9_.~:,@!*'()$-]/.test(value))
		.sort((a, b) => b.length - a.length);
	if (candidates.length === 0) {
		return endpoint;
	}

	// The value may itself contain "?" or "/", so look for it as a whole before
	// deciding where the path ends.
	let result = endpoint;
	for (const value of candidates) {
		const encoded = encodeURIComponent(decodePathValue(value))
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
		// A record can carry `"message": null` (a report); that is not an error list.
		errors = obj.errors ?? obj.error ?? obj.message ?? undefined;
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

export function tagError<T extends Error>(error: T, type: CanvasErrorType, data?: unknown): T {
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

/**
 * Remember on the error that the work it belongs to must not be started again: part of
 * it has reached Canvas (a file was sent, an import is under way), and repeating the
 * whole item would do that part twice.
 */
function markFinal<T extends Error>(error: T, note: string): T {
	const target = error as unknown as { context?: IDataObject; description?: string | null };
	target.context = { ...(target.context ?? {}), canvasNoRetry: true };
	target.description = target.description ? `${target.description} ${note}` : note;
	return error;
}

function isFinalFailure(error: unknown): boolean {
	return ((error as JsonObject)?.context as JsonObject | undefined)?.canvasNoRetry === true;
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
	if (isFinalFailure(error) || isCancellation(error)) {
		return false;
	}
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
/** Keys of a plain Canvas error answer; a body with nothing else is fully described by `canvasErrors`. */
const ERROR_ENVELOPE_KEYS = new Set(['errors', 'error', 'message', 'status', 'error_report_id']);

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
	}
	// Some refusals carry more than an error list: the report that is already running (409),
	// or what exactly is in the way ({ message, conflict_scope, value_at_conflict }). Hand the
	// whole body on so a workflow can use it.
	const body = getErrorResponseBody(error);
	if (body && typeof body === 'object' && !Array.isArray(body)) {
		const extra = Object.keys(body).filter((key) => !ERROR_ENVELOPE_KEYS.has(key));
		if (extra.length > 0) {
			output.responseBody = body;
		}
	}
	return output;
}

// ============================================
// Credentials / base URL
// ============================================

const LTI_CREDENTIAL = 'canvasLtiAdvantageApi';

/** How many redirects of a read are followed before giving up. */
const MAX_REDIRECTS = 5;

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
		await pause(this, calculateBackoff(attempt, options.baseDelayMs, options.maxDelayMs));
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
 * The URL with `as_user_id` set to the user chosen under Request Options > Act as User ID.
 * Whatever the URL already says about `as_user_id` is removed first (a next-page link of
 * Canvas repeats it; text from an input item must never choose who is impersonated).
 */
export function withMasquerade(url: string, asUserId: string): string {
	const [base, query = ''] = url.split('#')[0].split(/\?(.*)/s);
	const kept = query.split('&').filter((part) => {
		if (part === '') return false;
		const key = part.split('=')[0];
		return decodePathValue(key.replace(/\+/g, ' ')).toLowerCase() !== 'as_user_id';
	});
	kept.push(buildCanvasQueryString({ as_user_id: asUserId }));
	return `${base}?${kept.join('&')}`;
}

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
	// A fragment is never sent to a server; one that slipped in would swallow what is added below.
	const withoutFragment = baseUrl.split('#')[0];
	let url = queryString
		? `${withoutFragment}${withoutFragment.includes('?') ? '&' : '?'}${queryString}`
		: withoutFragment;
	// Masquerading applies to every request made for the item, follow-up pages included.
	if (rateLimitOptions.asUserId) {
		url = withMasquerade(url, rateLimitOptions.asUserId);
	}

	const requestOptions: IHttpRequestOptions = {
		method,
		url,
		returnFullResponse: true,
		json: true,
		// The node reads the status itself: n8n drops plain-text error bodies, and Canvas'
		// throttle answer ("403 Forbidden (Rate Limit Exceeded)") is exactly that.
		ignoreHttpStatusErrors: true,
		// Redirects are handled here. A write must never be replayed against wherever a
		// redirect points; a read is followed, but n8n would put the Authorization header
		// back on every hop, also when Canvas redirects to another host (a CDN, file storage).
		disableFollowRedirect: true,
	};
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
	const canvasHost = new URL(canvasUrl).host;
	const canvasOrigin = new URL(canvasUrl).origin;
	let refreshTried = false;
	let redirects = 0;
	// Set once a redirect has led away from Canvas: from then on no credential is sent.
	let elsewhere: string | undefined;

	for (let attempt = 0; ; ) {
		if (!elsewhere) {
			await ensureRateLimit(this, rateLimitOptions);
		}

		// A fresh copy for every request: n8n writes the Authorization header into the options
		// it is given, and that must not travel on to a request that goes elsewhere.
		const options = (): IHttpRequestOptions => ({
			...requestOptions,
			...(requestOptions.headers ? { headers: { ...requestOptions.headers } } : {}),
		});

		let response: { statusCode?: number; headers?: IDataObject; body?: unknown };
		try {
			response = elsewhere
				? await this.helpers.httpRequest(options())
				: await this.helpers.httpRequestWithAuthentication.call(this, credentialType, options());
		} catch (error) {
			// No HTTP response at all: DNS failure, refused connection, timeout.
			const failure = extractHttpStatus(error) === undefined ? tagError(error as Error, 'NETWORK_ERROR') : error;
			throw method === 'GET' ? failure : markWrite(failure as Error);
		}

		// OAuth2 and LTI Advantage: n8n only renews an expired token when the request fails
		// with 401, so repeat it once the way n8n expects.
		const renewable = credentialType === 'canvasOAuth2Api' || credentialType === LTI_CREDENTIAL;
		if (Number(response.statusCode) === 401 && renewable && !refreshTried && !elsewhere) {
			refreshTried = true;
			try {
				response = await this.helpers.httpRequestWithAuthentication.call(this, credentialType, {
					...options(),
					ignoreHttpStatusErrors: false,
				});
			} catch (error) {
				const refusedWith = extractHttpStatus(error);
				if (refusedWith === undefined) {
					// The refresh itself failed, or there was no answer at all.
					const failure = tagError(error as Error, 'UNAUTHORIZED');
					throw method === 'GET' ? failure : markWrite(failure);
				}
				if (method !== 'GET' && refusedWith >= 500) {
					// The write may have been carried out: do not send it again.
					throw markWrite(error as Error);
				}
				// A read, or a write Canvas refused outright (4xx): send it once more the normal
				// way, so the answer is read like any other. n8n's error has lost a plain-text
				// body, which is how Canvas reports throttling.
				continue;
			}
		}

		const status = Number(response.statusCode ?? 200);
		const headers = (response.headers ?? {}) as IDataObject;
		const rateLimitStatus = parseRateLimitHeaders(headers);
		if (!elsewhere && headers['x-rate-limit-remaining'] !== undefined) {
			state.remaining = rateLimitStatus.remaining;
		}

		// A read that Canvas redirects: follow it, with the credential only while it stays on Canvas.
		if (method === 'GET' && status >= 300 && status < 400 && typeof headers.location === 'string' && redirects < MAX_REDIRECTS) {
			redirects++;
			const target = new URL(headers.location, requestOptions.url);
			if (!elsewhere && target.host === canvasHost) {
				// Still Canvas: keep the scheme of the credential's Canvas URL. A proxy that ends
				// TLS in front of Canvas may answer with http:// links, and the token must never
				// travel unencrypted because of that.
				requestOptions.url = `${canvasOrigin}${target.pathname}${target.search}`;
			} else {
				requestOptions.url = target.toString();
				elsewhere = target.host;
			}
			continue;
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

		const throttled = !elsewhere && isThrottleResponse(status, data, headers);
		if (throttled) {
			state.remaining = 0;
			// Only throttling is retried here; other failures go to the error handling mode.
			if (attempt < rateLimitOptions.maxRetries) {
				await pause(
					this,
					calculateBackoff(attempt, rateLimitOptions.baseDelayMs, rateLimitOptions.maxDelayMs),
				);
				attempt++;
				continue;
			}
		}

		const failure = buildResponseError(this, status, data, headers, throttled);
		if (elsewhere) {
			failure.description = `Canvas redirected the request to ${elsewhere}, which answered HTTP ${status}. The credential is only sent to the Canvas URL; if ${elsewhere} is your Canvas, use it as the Canvas URL of the credential.`;
		}
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
	pageTransform?: (records: IDataObject[], page: IDataObject) => IDataObject[],
): Promise<IPaginatedResult & { isList: boolean }> {
	// The records of one page, reshaped with the rest of that page's answer where asked for.
	const listOf = (data: unknown): IDataObject[] | undefined => {
		const list = extractList(data, dataKey);
		return list !== undefined && pageTransform && data !== null && typeof data === 'object' && !Array.isArray(data)
			? pageTransform(list, data as IDataObject)
			: list;
	};
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

	const firstList = listOf(response.data);
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

		const pageItems = listOf(response.data);
		if (pageItems === undefined) {
			break;
		}
		allItems.push(...pageItems);
		pageCount++;
	}

	// Did reading stop before the end of the list? Either records were cut off at the limit,
	// or Canvas still points to a page that was not read (and is not a page already seen).
	const cut = limit !== undefined && allItems.length > limit;
	const unread =
		paginationOptions.enabled && Boolean(response.linkHeader.next) && !visited.has(response.linkHeader.next as string);
	return {
		items: limit !== undefined ? allItems.slice(0, limit) : allItems,
		totalPages: pageCount,
		rateLimitStatus: response.rateLimitStatus,
		isList: true,
		more: cut || unread,
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

			// A cancelled execution is not a failed item: stop, whatever the error mode.
			if (isCancellation(error)) {
				throw error;
			}

			// Retry Then Error: only failures that can succeed on a second try.
			if (mode === 'retryThenError' && attempt < errorOptions.maxRetries && isRetryableError(error)) {
				await pause(
					this,
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
 * The answer to step 1 of an upload. Quiz submission files wrap it:
 * `{ "attachments": [ { "upload_url": ..., "upload_params": ... } ] }`.
 */
function unwrapUploadTicket(data: IDataObject | undefined): IDataObject {
	const wrapped = data?.attachments;
	if (Array.isArray(wrapped) && wrapped.length > 0 && wrapped[0] !== null && typeof wrapped[0] === 'object') {
		return wrapped[0] as IDataObject;
	}
	return data ?? {};
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

	const step1Data = unwrapUploadTicket(step1Response.data as IDataObject);
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

	// From here on the item counts as a write: it is only started again (Retry Then Error)
	// when the upload server cannot have stored the file.
	let step2Response: { statusCode?: number; headers?: IDataObject; body?: unknown };
	try {
		step2Response = await this.helpers.httpRequest(step2Options);
	} catch (error) {
		throw markWrite(extractHttpStatus(error) === undefined ? tagError(error as Error, 'NETWORK_ERROR') : (error as Error));
	}
	const step2Headers = (step2Response.headers || {}) as IDataObject;
	const step2StatusCode = step2Response.statusCode as number;
	const step2Body = parseJsonBody(step2Response.body);

	if (step2StatusCode >= 400) {
		throw markWrite(
			new NodeApiError(
				this.getNode(),
				{ ...(step2Body ?? {}), httpCode: String(step2StatusCode) } as JsonObject,
				{
					message: `The file upload was rejected by the upload server (HTTP ${step2StatusCode})`,
					httpCode: String(step2StatusCode),
					itemIndex,
				},
			),
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
	// The file has been sent. Whatever goes wrong now, the upload must not start again:
	// that would store the file a second time.
	try {
		const step3Response = await canvasApiRequest.call(
			this,
			'GET',
			locationUrl,
			undefined,
			undefined,
			rateLimitOptions,
		);
		return step3Response.data as IDataObject;
	} catch (error) {
		throw markFinal(
			error as Error,
			'The file itself was sent; only the confirmation failed, so the upload is not repeated. Look in Canvas before uploading it again.',
		);
	}
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

	const responseData = unwrapUploadTicket(step1Response.data as IDataObject);
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

		// A write: only started again when the upload server cannot have accepted it.
		let uploadResponse: { statusCode?: number; body?: unknown };
		try {
			uploadResponse = await this.helpers.httpRequest(uploadOptions);
		} catch (error) {
			throw markWrite(extractHttpStatus(error) === undefined ? tagError(error as Error, 'NETWORK_ERROR') : (error as Error));
		}
		const uploadStatus = uploadResponse.statusCode as number;
		const uploadBody = parseJsonBody(uploadResponse.body);

		if (uploadStatus >= 400) {
			throw markWrite(
				new NodeApiError(
					this.getNode(),
					{ ...(uploadBody ?? {}), httpCode: String(uploadStatus) } as JsonObject,
					{
						message: `The upload server rejected the URL upload (HTTP ${uploadStatus})`,
						httpCode: String(uploadStatus),
					},
				),
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

	// Canvas is fetching the file. A failure while watching it must not start a second import.
	try {
		return await pollCanvasProgress.call(this, progress.url as string, rateLimitOptions);
	} catch (error) {
		throw markFinal(
			error as Error,
			'Canvas had already accepted the URL, so the upload is not started again. Look in Canvas before uploading it again.',
		);
	}
}

/**
 * Download a file Canvas points to (the `url` of a file record or of a report's attachment).
 *
 * Canvas serves such a URL to the signed-in user and usually answers with a redirect to
 * a storage service on another host. The credential is therefore sent to the Canvas host
 * only: redirects are followed by hand, and a request to any other host goes out without it.
 */
export async function canvasDownload(
	this: IExecuteFunctions,
	fileUrl: string,
	rateLimitOptions: IRateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS,
	itemIndex?: number,
): Promise<{ data: Buffer; contentType?: string }> {
	const canvasUrl = await getCanvasUrl.call(this);
	const canvas = new URL(canvasUrl);
	const credentialType = getCredentialType(this);
	const renewable = credentialType === 'canvasOAuth2Api' || credentialType === LTI_CREDENTIAL;
	const state = getRateLimitState(this);
	let url = /^https?:\/\//i.test(fileUrl) ? fileUrl : `${canvasUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
	let refreshTried = false;
	// Once a redirect has left Canvas, no credential is sent any more, wherever it leads.
	let elsewhere = false;

	for (let hop = 0, attempt = 0; hop < 6; ) {
		const target = new URL(url);
		const onCanvas = !elsewhere && target.host === canvas.host;
		if (onCanvas) {
			// Same rules as for every other request to Canvas: the scheme of the credential's
			// Canvas URL, the user being acted as, and the quota.
			url = `${canvas.origin}${target.pathname}${target.search}`;
			if (rateLimitOptions.asUserId) {
				url = withMasquerade(url, rateLimitOptions.asUserId);
			}
			await ensureRateLimit(this, rateLimitOptions);
		} else {
			elsewhere = true;
		}
		const options = (): IHttpRequestOptions => ({
			method: 'GET',
			url,
			encoding: 'arraybuffer',
			returnFullResponse: true,
			json: false,
			ignoreHttpStatusErrors: true,
			disableFollowRedirect: true,
		});

		let response: { statusCode?: number; headers?: IDataObject; body?: unknown };
		try {
			response = onCanvas
				? await this.helpers.httpRequestWithAuthentication.call(this, credentialType, options())
				: await this.helpers.httpRequest(options());
			if (Number(response.statusCode) === 401 && onCanvas && renewable && !refreshTried) {
				// n8n renews an expired OAuth2 or LTI token only when the request fails with 401.
				refreshTried = true;
				try {
					await this.helpers.httpRequestWithAuthentication.call(this, credentialType, {
						...options(),
						ignoreHttpStatusErrors: false,
					});
				} catch {
					// Read the real answer below, the normal way.
				}
				continue;
			}
		} catch (error) {
			throw extractHttpStatus(error) === undefined ? tagError(error as Error, 'NETWORK_ERROR') : error;
		}
		const status = Number(response.statusCode);
		const headers = (response.headers ?? {}) as IDataObject;
		if (onCanvas && headers['x-rate-limit-remaining'] !== undefined) {
			state.remaining = parseRateLimitHeaders(headers).remaining;
		}

		if (status >= 300 && status < 400 && typeof headers.location === 'string') {
			url = new URL(headers.location, url).toString();
			hop++;
			continue;
		}
		const body = response.body as Buffer | ArrayBuffer | string | undefined;
		const data = Buffer.isBuffer(body) ? body : Buffer.from((body ?? '') as ArrayBuffer);
		if (status >= 200 && status < 300) {
			const contentType = headers['content-type'];
			return { data, contentType: typeof contentType === 'string' ? contentType.split(';')[0].trim() : undefined };
		}

		// A failure: read the answer like any other Canvas answer (throttling included).
		const text = data.toString('utf8');
		const answer = parseJsonBody(text) ?? text;
		const throttled = onCanvas && isThrottleResponse(status, answer, headers);
		if (throttled) {
			state.remaining = 0;
			if (attempt < rateLimitOptions.maxRetries) {
				await pause(this, calculateBackoff(attempt, rateLimitOptions.baseDelayMs, rateLimitOptions.maxDelayMs));
				attempt++;
				continue;
			}
		}
		const failure = buildResponseError(this, status, answer, headers, throttled);
		failure.message = `The file could not be downloaded (HTTP ${status})`;
		if (!onCanvas) {
			failure.description = `The download was redirected to ${target.host}, which answered HTTP ${status}.`;
		}
		if (itemIndex !== undefined) {
			failure.context = { ...(failure.context ?? {}), itemIndex };
		}
		throw failure;
	}
	throw new NodeOperationError(this.getNode(), 'The file could not be downloaded: too many redirects', { itemIndex });
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
		await pause(this, intervalMs);
	}

	throw new NodeOperationError(
		this.getNode(),
		`Canvas URL upload timed out after ${(maxAttempts * intervalMs) / 1000} seconds`,
	);
}
