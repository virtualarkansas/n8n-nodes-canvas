import { describe, expect, it, vi } from 'vitest';
import type { IDataObject, IExecuteFunctions, JsonObject } from 'n8n-workflow';
import {
	buildCanvasQueryString,
	buildCanvasUrl,
	buildCurlCommand,
	buildMultipartBody,
	calculateBackoff,
	canvasApiRequest,
	canvasApiRequestAllItems,
	categorizeError,
	encodePathValues,
	isThrottleResponse,
	createErrorOutput,
	executeWithErrorHandling,
	extractHttpStatus,
	getCanvasErrorDetails,
	isRateLimitError,
	isRetryableError,
	parseLinkHeader,
	parseRateLimitHeaders,
	resolveCanvasUrl,
} from '../../nodes/Canvas/GenericFunctions';
import type { IRateLimitOptions } from '../../nodes/Canvas/types/Canvas.types';

const FAST_RATE_LIMIT: IRateLimitOptions = {
	enabled: true,
	threshold: 300,
	maxRetries: 3,
	baseDelayMs: 1,
	maxDelayMs: 2,
};
const NO_RATE_LIMIT: IRateLimitOptions = { ...FAST_RATE_LIMIT, enabled: false };

interface FakeResponse {
	/** HTTP status Canvas answers with (default 200). */
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
	/** Fail without any HTTP response (network error). */
	throw?: unknown;
}

/** Canvas' default throttle answer: plain text, quota at zero. */
const THROTTLED: FakeResponse = {
	status: 403,
	body: '403 Forbidden (Rate Limit Exceeded)\n',
	headers: { 'x-rate-limit-remaining': '0.0', 'content-type': 'text/plain; charset=utf-8' },
};

/** What n8n's httpRequestWithAuthentication throws for a non-2xx response. */
function apiError(status: number, data: unknown, message = `Request failed with status code ${status}`): JsonObject {
	return {
		name: 'NodeApiError',
		message,
		description: `Request failed with status code ${status}`,
		httpCode: String(status),
		context: { data },
	} as unknown as JsonObject;
}

function fakeContext(responder: (options: IDataObject, callIndex: number) => FakeResponse, continueOnFail = false) {
	const calls: IDataObject[] = [];
	const context = {
		getNodeParameter: (name: string) => (name === 'authentication' ? 'accessToken' : undefined),
		getCredentials: async () => ({ canvasUrl: 'https://canvas.test/', accessToken: 't' }),
		getNode: () => ({ name: 'Canvas', type: 'canvas', typeVersion: 1, position: [0, 0], parameters: {}, id: '1' }),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: vi.fn(async function (_cred: string, options: IDataObject) {
				calls.push(options);
				const response = responder(options, calls.length - 1);
				if (response.throw) throw response.throw;
				const status = response.status ?? 200;
				// Like n8n: a non-2xx answer is only returned when the caller asked to see it.
				if (status >= 400 && options.ignoreHttpStatusErrors !== true) {
					throw apiError(status, typeof response.body === 'string' ? undefined : response.body);
				}
				return { body: response.body, headers: response.headers ?? {}, statusCode: status };
			}),
		},
	};
	return { context: context as unknown as IExecuteFunctions, calls };
}

describe('query string serialization', () => {
	it('serializes arrays as key[]=value, with or without [] in the key', () => {
		expect(buildCanvasQueryString({ include: ['term', 'teachers'] })).toBe('include[]=term&include[]=teachers');
		expect(buildCanvasQueryString({ 'include[]': ['term', 'teachers'] })).toBe('include[]=term&include[]=teachers');
		expect(buildCanvasQueryString({ 'state[]': 'active' })).toBe('state[]=active');
	});

	it('serializes nested objects and arrays inside them', () => {
		expect(buildCanvasQueryString({ enrollment: { user_id: 5, type: 'StudentEnrollment' } })).toBe(
			'enrollment[user_id]=5&enrollment[type]=StudentEnrollment',
		);
		expect(buildCanvasQueryString({ 'enrollment[user_id]': 5 })).toBe('enrollment[user_id]=5');
		expect(buildCanvasQueryString({ course: { event: 'offer', ids: [1, 2] } })).toBe(
			'course[event]=offer&course[ids][]=1&course[ids][]=2',
		);
	});

	it('drops null and undefined, keeps false, zero and empty strings', () => {
		expect(buildCanvasQueryString({ a: undefined, b: null, c: false, d: 0, e: '' })).toBe('c=false&d=0&e=');
	});

	it('encodes values and unusual keys', () => {
		expect(buildCanvasQueryString({ search_term: 'O\'Brien & Søn #1', 'sis id': 'a/b' })).toBe(
			"search_term=O'Brien%20%26%20S%C3%B8n%20%231&sis%20id=a%2Fb",
		);
	});

	it('builds full URLs and appends to an existing query', () => {
		expect(buildCanvasUrl('https://c.test', '/api/v1/courses', { per_page: 10 })).toBe(
			'https://c.test/api/v1/courses?per_page=10',
		);
		expect(buildCanvasUrl('https://c.test', '/api/v1/courses?x=1', { per_page: 10 })).toBe(
			'https://c.test/api/v1/courses?x=1&per_page=10',
		);
		expect(buildCanvasUrl('https://c.test', '/api/v1/courses', {})).toBe('https://c.test/api/v1/courses');
	});
});

describe('path encoding', () => {
	it('encodes SIS IDs with URL characters where they are path segments', () => {
		const sis = 'sis_user_id:S/SLASH #1?x%';
		expect(encodePathValues(`/api/v1/users/${sis}/profile`, [sis])).toBe('/api/v1/users/sis_user_id:S%2FSLASH%20%231%3Fx%25/profile');
		expect(encodePathValues(`/api/v1/users/${sis}`, [sis, '7'])).toBe('/api/v1/users/sis_user_id:S%2FSLASH%20%231%3Fx%25');
	});

	it('leaves ordinary IDs, already encoded values, the query and absolute URLs alone', () => {
		expect(encodePathValues('/api/v1/courses/sis_course_id:ABC-1.2/users', ['sis_course_id:ABC-1.2'])).toBe('/api/v1/courses/sis_course_id:ABC-1.2/users');
		expect(encodePathValues('/api/v1/courses/sis_course_id:A%2FB', ['sis_course_id:A%2FB'])).toBe('/api/v1/courses/sis_course_id:A%2FB');
		expect(encodePathValues('/api/v1/search?q=a b', ['a b'])).toBe('/api/v1/search?q=a b');
		expect(encodePathValues('https://c.test/api/v1/x y', ['x y'])).toBe('https://c.test/api/v1/x y');
	});

	it('only touches whole segments and handles page titles with spaces and Unicode', () => {
		expect(encodePathValues('/api/v1/courses/1/pages/Wöchentlicher Plan', ['Wöchentlicher Plan', '1'])).toBe('/api/v1/courses/1/pages/W%C3%B6chentlicher%20Plan');
		expect(encodePathValues('/api/v1/courses/a b c/x', ['a b'])).toBe('/api/v1/courses/a b c/x');
	});
});

describe('throttle detection', () => {
	it('recognises Canvas\' answers and nothing else', () => {
		expect(isThrottleResponse(403, '403 Forbidden (Rate Limit Exceeded)\n', { 'x-rate-limit-remaining': '0.0' })).toBe(true);
		expect(isThrottleResponse(403, '', { 'x-rate-limit-remaining': '0.0' })).toBe(true);
		expect(isThrottleResponse(429, 'Too Many Requests', {})).toBe(true);
		expect(isThrottleResponse(403, { errors: [{ message: 'user not authorized' }] }, { 'x-rate-limit-remaining': '0.0' })).toBe(false);
		expect(isThrottleResponse(403, '', { 'x-rate-limit-remaining': '512.3' })).toBe(false);
		expect(isThrottleResponse(404, 'Rate Limit Exceeded', {})).toBe(false);
	});
});

describe('URL re-anchoring', () => {
	it('keeps path and query but always uses the configured Canvas host', () => {
		expect(resolveCanvasUrl('https://canvas.test', 'https://canvas.test/api/v1/courses?page=2&per_page=10')).toBe(
			'https://canvas.test/api/v1/courses?page=2&per_page=10',
		);
		expect(resolveCanvasUrl('https://canvas.test', 'http://evil.example/api/v1/courses?page=bookmark:abc')).toBe(
			'https://canvas.test/api/v1/courses?page=bookmark:abc',
		);
		expect(resolveCanvasUrl('https://canvas.test', '/api/v1/files/1/create_success?uuid=x')).toBe(
			'https://canvas.test/api/v1/files/1/create_success?uuid=x',
		);
	});
});

describe('header parsing', () => {
	it('parses Canvas Link headers, including bookmark pagination', () => {
		const link =
			'<https://c.test/api/v1/courses?page=bookmark:WyJhIiwxXQ&per_page=10>; rel="current",' +
			'<https://c.test/api/v1/courses?page=bookmark:WyJiIiwyXQ&per_page=10>; rel="next",' +
			'<https://c.test/api/v1/courses?page=first&per_page=10>; rel="first"';
		const parsed = parseLinkHeader(link);
		expect(parsed.next).toBe('https://c.test/api/v1/courses?page=bookmark:WyJiIiwyXQ&per_page=10');
		expect(parsed.first).toContain('page=first');
		expect(parsed.last).toBeUndefined();
	});

	it('survives commas inside URLs and missing headers', () => {
		const parsed = parseLinkHeader('<https://c.test/x?ids=1,2,3&page=2>; rel="next", <https://c.test/x?ids=1,2,3&page=1>; rel="prev"');
		expect(parsed.next).toBe('https://c.test/x?ids=1,2,3&page=2');
		expect(parsed.prev).toBe('https://c.test/x?ids=1,2,3&page=1');
		expect(parseLinkHeader(undefined)).toEqual({});
		expect(parseLinkHeader('')).toEqual({});
	});

	it('reads the quota headers and treats a missing header as a full bucket', () => {
		expect(parseRateLimitHeaders({ 'x-rate-limit-remaining': '512.25', 'x-request-cost': '0.5' })).toEqual({
			remaining: 512.25,
			cost: 0.5,
		});
		expect(parseRateLimitHeaders({})).toEqual({ remaining: 1000, cost: undefined });
		expect(parseRateLimitHeaders({ 'x-rate-limit-remaining': '0.0' }).remaining).toBe(0);
	});
});

describe('error classification', () => {
	it('finds the HTTP status in every shape n8n produces', () => {
		expect(extractHttpStatus({ httpCode: '404' })).toBe(404);
		expect(extractHttpStatus({ statusCode: 422 })).toBe(422);
		expect(extractHttpStatus({ response: { status: 500 } })).toBe(500);
		expect(extractHttpStatus({ cause: { response: { status: 403 } } })).toBe(403);
		expect(extractHttpStatus({ message: 'socket hang up' })).toBeUndefined();
		expect(extractHttpStatus(undefined)).toBeUndefined();
	});

	it('maps statuses to error types', () => {
		expect(categorizeError(400)).toBe('VALIDATION_ERROR');
		expect(categorizeError(401)).toBe('UNAUTHORIZED');
		expect(categorizeError(403)).toBe('FORBIDDEN');
		expect(categorizeError(404)).toBe('NOT_FOUND');
		expect(categorizeError(409)).toBe('CONFLICT');
		expect(categorizeError(422)).toBe('VALIDATION_ERROR');
		expect(categorizeError(429)).toBe('RATE_LIMITED');
		expect(categorizeError(503)).toBe('SERVER_ERROR');
		expect(categorizeError(undefined)).toBe('UNKNOWN');
	});

	it('recognises both of Canvas\' throttling responses', () => {
		expect(isRateLimitError(apiError(429, 'Too Many Requests'))).toBe(true);
		expect(isRateLimitError(apiError(403, '403 Forbidden (Rate Limit Exceeded)\n'))).toBe(true);
		expect(isRateLimitError(apiError(403, { errors: [{ message: 'user not authorized to perform that action' }] }))).toBe(false);
		expect(isRateLimitError(apiError(404, {}))).toBe(false);
	});

	it('retries only what can succeed on retry', () => {
		expect(isRetryableError(apiError(503, {}))).toBe(true);
		expect(isRetryableError(apiError(403, '403 Forbidden (Rate Limit Exceeded)'))).toBe(true);
		expect(isRetryableError({ message: 'connect ECONNREFUSED', code: 'ECONNREFUSED' })).toBe(true);
		expect(isRetryableError(apiError(400, {}))).toBe(false);
		expect(isRetryableError(apiError(401, {}))).toBe(false);
		expect(isRetryableError(apiError(404, {}))).toBe(false);
		expect(isRetryableError(apiError(422, {}))).toBe(false);
		expect(isRetryableError({ name: 'NodeOperationError', message: 'A required parameter is empty' })).toBe(false);
	});

	it('extracts Canvas error messages from each payload shape', () => {
		expect(getCanvasErrorDetails(apiError(404, { errors: [{ message: 'The specified resource does not exist.' }] })).messages).toEqual([
			'The specified resource does not exist.',
		]);
		const validation = getCanvasErrorDetails(
			apiError(400, { errors: { name: [{ attribute: 'name', type: 'blank', message: 'blank' }], sis_course_id: [{ message: 'is already in use' }] } }),
		);
		expect(validation.messages).toEqual(['name: blank', 'sis_course_id: is already in use']);
		expect(getCanvasErrorDetails(apiError(401, { errors: [{ message: 'Invalid access token.' }], status: 'unauthenticated' })).messages).toEqual([
			'Invalid access token.',
		]);
		expect(getCanvasErrorDetails(apiError(400, { message: 'invalid parameter' })).messages).toEqual(['invalid parameter']);
		expect(getCanvasErrorDetails(apiError(403, '403 Forbidden (Rate Limit Exceeded)\n')).messages).toEqual([
			'403 Forbidden (Rate Limit Exceeded)',
		]);
		expect(getCanvasErrorDetails(apiError(500, '<html><body>Internal Server Error</body></html>')).messages).toEqual([]);
		expect(getCanvasErrorDetails(apiError(400, { errors: [{ message: 'bad', error_code: 'invalid_thing' }] })).code).toBe('invalid_thing');
	});

	it('builds the Error-output record with numeric code and Canvas detail', () => {
		const output = createErrorOutput(
			apiError(404, { errors: [{ message: 'The specified resource does not exist.' }] }, 'The resource you are requesting could not be found'),
			{ id: 9 },
			'course',
			'get',
			'/api/v1/courses/9',
		);
		expect(output).toMatchObject({
			error: true,
			errorCode: 404,
			errorType: 'NOT_FOUND',
			errorMessage: 'The specified resource does not exist.',
			originalItem: { id: 9 },
			resource: 'course',
			operation: 'get',
			endpoint: '/api/v1/courses/9',
			canvasErrors: [{ message: 'The specified resource does not exist.' }],
		});
		expect(typeof output.timestamp).toBe('string');
	});

	it('labels throttling, node-side and network errors', () => {
		expect(createErrorOutput(apiError(403, '403 Forbidden (Rate Limit Exceeded)'), {}, 'r', 'o', '/e').errorType).toBe('RATE_LIMITED');
		const nodeSide = createErrorOutput({ name: 'NodeOperationError', message: 'A required parameter is empty' } as JsonObject, {}, 'r', 'o', '');
		expect(nodeSide).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', errorMessage: 'A required parameter is empty' });
		expect(createErrorOutput({ message: 'connect ECONNREFUSED 127.0.0.1:1', code: 'ECONNREFUSED' } as JsonObject, {}, 'r', 'o', '/e')).toMatchObject({
			errorCode: 0,
			errorType: 'NETWORK_ERROR',
		});
	});
});

describe('backoff', () => {
	it('doubles and caps', () => {
		expect([0, 1, 2, 3, 4, 5].map((n) => calculateBackoff(n, 2000, 60000))).toEqual([2000, 4000, 8000, 16000, 32000, 60000]);
	});
});

describe('debug curl command', () => {
	it('matches the URL the node sends and quotes safely', () => {
		const curl = buildCurlCommand('POST', 'https://c.test', '/api/v1/courses/1/assignments', { include: ['overrides'] }, { assignment: { name: "Bob's essay" } }, 'accessToken');
		expect(curl).toContain("'https://c.test/api/v1/courses/1/assignments?include[]=overrides'");
		expect(curl).toContain(`-d '{"assignment":{"name":"Bob'\\''s essay"}}'`);
		expect(curl).toContain('<ACCESS_TOKEN>');
		expect(buildCurlCommand('GET', 'https://c.test', '/api/v1/x', undefined, { ignored: true }, 'oAuth2')).not.toContain('-d ');
	});
});

describe('multipart body', () => {
	it('puts the fields first and the file last', () => {
		const { body, contentType } = buildMultipartBody(
			{ key: 'uploads/1/file.txt', acl: 'private', skip: undefined },
			{ fieldName: 'file', fileName: 'ré"sumé\n.txt', contentType: 'text/plain', data: Buffer.from('hello') },
		);
		const boundary = contentType.split('boundary=')[1];
		const text = body.toString('utf8');
		expect(contentType.startsWith('multipart/form-data; boundary=')).toBe(true);
		expect(text.indexOf('name="key"')).toBeLessThan(text.indexOf('name="acl"'));
		expect(text.indexOf('name="acl"')).toBeLessThan(text.indexOf('name="file"'));
		expect(text).not.toContain('name="skip"');
		expect(text).toContain('filename="ré%22sumé .txt"');
		expect(text).toContain('Content-Type: text/plain\r\n\r\nhello\r\n');
		expect(text.endsWith(`--${boundary}--\r\n`)).toBe(true);
	});
});

describe('canvasApiRequest', () => {
	it('sends the serialized query in the URL and JSON bodies only for writes', async () => {
		const { context, calls } = fakeContext(() => ({ body: { id: 1 }, headers: { 'x-rate-limit-remaining': '600' } }));
		await canvasApiRequest.call(context, 'GET', '/api/v1/courses', { ignored: true }, { include: ['term'] }, NO_RATE_LIMIT);
		await canvasApiRequest.call(context, 'POST', '/api/v1/courses', { course: { name: 'x' } }, undefined, NO_RATE_LIMIT);
		expect(calls[0].url).toBe('https://canvas.test/api/v1/courses?include[]=term');
		expect(calls[0].body).toBeUndefined();
		expect(calls[0].qs).toBeUndefined();
		expect(calls[1].body).toEqual({ course: { name: 'x' } });
	});

	it('retries Canvas\' 403 throttle response and then succeeds', async () => {
		const { context, calls } = fakeContext((_options, index) =>
			index < 2 ? THROTTLED : { body: { ok: true }, headers: { 'x-rate-limit-remaining': '600' } },
		);
		const response = await canvasApiRequest.call(context, 'GET', '/api/v1/courses/1', undefined, undefined, NO_RATE_LIMIT);
		expect(response.data).toEqual({ ok: true });
		expect(calls).toHaveLength(3);
	});

	it('gives up on throttling after maxRetries and does not retry other errors', async () => {
		const throttled = fakeContext(() => ({ status: 429, body: 'Too Many Requests' }));
		await expect(canvasApiRequest.call(throttled.context, 'GET', '/api/v1/x', undefined, undefined, NO_RATE_LIMIT)).rejects.toMatchObject({ httpCode: '429' });
		expect(throttled.calls).toHaveLength(NO_RATE_LIMIT.maxRetries + 1);

		const forever = fakeContext(() => THROTTLED);
		const error = await canvasApiRequest.call(forever.context, 'GET', '/api/v1/x', undefined, undefined, NO_RATE_LIMIT).catch((e: unknown) => e);
		expect(forever.calls).toHaveLength(NO_RATE_LIMIT.maxRetries + 1);
		expect(isRateLimitError(error)).toBe(true);
		expect(createErrorOutput(error as JsonObject, {}, 'r', 'o', '/e')).toMatchObject({ errorCode: 403, errorType: 'RATE_LIMITED' });

		const notFound = fakeContext(() => ({ status: 404, body: { errors: [{ message: 'The specified resource does not exist.' }] } }));
		const missing = await canvasApiRequest.call(notFound.context, 'GET', '/api/v1/x', undefined, undefined, NO_RATE_LIMIT).catch((e: unknown) => e);
		expect(missing).toMatchObject({ httpCode: '404', message: 'The specified resource does not exist.' });
		expect(notFound.calls).toHaveLength(1);

		// An ordinary "forbidden" is not mistaken for throttling, even when the quota header is low.
		const forbidden = fakeContext(() => ({
			status: 403,
			body: { status: 'unauthorized', errors: [{ message: 'user not authorized to perform that action' }] },
			headers: { 'x-rate-limit-remaining': '0.0' },
		}));
		const refused = await canvasApiRequest.call(forbidden.context, 'GET', '/api/v1/x', undefined, undefined, NO_RATE_LIMIT).catch((e: unknown) => e);
		expect(forbidden.calls).toHaveLength(1);
		expect(createErrorOutput(refused as JsonObject, {}, 'r', 'o', '/e')).toMatchObject({
			errorCode: 403,
			errorType: 'FORBIDDEN',
			errorMessage: 'user not authorized to perform that action',
		});
	});

	it('probes the quota once, then relies on response headers', async () => {
		const { context, calls } = fakeContext(() => ({ body: {}, headers: { 'x-rate-limit-remaining': '590' } }));
		await canvasApiRequest.call(context, 'GET', '/api/v1/a', undefined, undefined, FAST_RATE_LIMIT);
		await canvasApiRequest.call(context, 'GET', '/api/v1/b', undefined, undefined, FAST_RATE_LIMIT);
		await canvasApiRequest.call(context, 'GET', '/api/v1/c', undefined, undefined, FAST_RATE_LIMIT);
		expect(calls.map((c) => String(c.url).replace('https://canvas.test', ''))).toEqual([
			'/api/v1/users/self',
			'/api/v1/a',
			'/api/v1/b',
			'/api/v1/c',
		]);
	});

	it('waits for the quota to recover when it drops below the threshold', async () => {
		const quota = ['590', '120', '80', '450', '440', '430'];
		const { context, calls } = fakeContext((_options, index) => ({ body: {}, headers: { 'x-rate-limit-remaining': quota[Math.min(index, quota.length - 1)] } }));
		await canvasApiRequest.call(context, 'GET', '/api/v1/a', undefined, undefined, FAST_RATE_LIMIT); // probe 590, a -> 120
		await canvasApiRequest.call(context, 'GET', '/api/v1/b', undefined, undefined, FAST_RATE_LIMIT); // probe 80 (wait), probe 450, b
		const urls = calls.map((c) => String(c.url).replace('https://canvas.test/api/v1/', ''));
		expect(urls).toEqual(['users/self', 'a', 'users/self', 'users/self', 'b']);
	});

	it('fails with a clear message when the quota never recovers', async () => {
		const { context } = fakeContext(() => ({ body: {}, headers: { 'x-rate-limit-remaining': '5' } }));
		const error = await canvasApiRequest.call(context, 'GET', '/api/v1/a', undefined, undefined, FAST_RATE_LIMIT).catch((e: unknown) => e);
		expect((error as Error).message).toMatch(/rate limit quota is still below the threshold/i);
		// A quota problem, not a problem with the parameters.
		expect(createErrorOutput(error as JsonObject, {}, 'r', 'o', '/e')).toMatchObject({ errorType: 'RATE_LIMITED' });
	});

	it('probes once before waiting, not twice in a row', async () => {
		const quota = ['100', '100', '500', '500'];
		const { context, calls } = fakeContext((_options, index) => ({ body: {}, headers: { 'x-rate-limit-remaining': quota[Math.min(index, quota.length - 1)] } }));
		await canvasApiRequest.call(context, 'GET', '/api/v1/a', undefined, undefined, FAST_RATE_LIMIT);
		const urls = calls.map((c) => String(c.url).replace('https://canvas.test/api/v1/', ''));
		// probe (100) -> wait -> probe (100) -> wait -> probe (500) -> the request
		expect(urls).toEqual(['users/self', 'users/self', 'users/self', 'a']);
	});

	it('reports what Canvas said for every kind of error body', async () => {
		const outputOf = async (response: FakeResponse) => {
			const { context } = fakeContext(() => response);
			const error = await canvasApiRequest.call(context, 'POST', '/api/v1/x', { a: 1 }, undefined, NO_RATE_LIMIT).catch((e: unknown) => e);
			return createErrorOutput(error as JsonObject, {}, 'r', 'o', '/api/v1/x');
		};
		expect(await outputOf({ status: 400, body: { errors: { name: [{ type: 'blank', message: 'blank' }] } } })).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'name: blank',
		});
		expect(await outputOf({ status: 500, body: '<html><body>Internal Server Error</body></html>' })).toMatchObject({
			errorCode: 500,
			errorType: 'SERVER_ERROR',
			errorMessage: 'Canvas failed with an internal error (HTTP 500)',
		});
		expect(await outputOf({ status: 401, body: { errors: [{ message: 'Invalid access token.' }] } })).toMatchObject({
			errorCode: 401,
			errorType: 'UNAUTHORIZED',
			errorMessage: 'Invalid access token.',
		});
		expect(await outputOf({ status: 404, body: '' })).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('does not follow a redirect on a write, and says where Canvas pointed', async () => {
		const { context, calls } = fakeContext(() => ({ status: 302, body: '', headers: { location: 'https://canvas.test/accounts/1/terms' } }));
		const error = await canvasApiRequest.call(context, 'PUT', '/api/v1/accounts/5/terms/9', { a: 1 }, undefined, NO_RATE_LIMIT).catch((e: unknown) => e);
		expect(calls[0].disableFollowRedirect).toBe(true);
		expect((error as Error).message).toMatch(/redirect \(HTTP 302\) to https:\/\/canvas\.test\/accounts\/1\/terms/);

		const get = fakeContext(() => ({ body: {} }));
		await canvasApiRequest.call(get.context, 'GET', '/api/v1/x', undefined, undefined, NO_RATE_LIMIT);
		expect(get.calls[0].disableFollowRedirect).toBeUndefined();
	});

	it('labels a failure without any HTTP response as a network error and lets Retry Then Error retry it', async () => {
		const { context } = fakeContext(() => ({ throw: { name: 'NodeApiError', message: 'The connection cannot be established' } }));
		const error = await canvasApiRequest.call(context, 'GET', '/api/v1/x', undefined, undefined, NO_RATE_LIMIT).catch((e: unknown) => e);
		expect(createErrorOutput(error as JsonObject, {}, 'r', 'o', '/e')).toMatchObject({ errorCode: 0, errorType: 'NETWORK_ERROR' });
		expect(isRetryableError(error)).toBe(true);
	});

	it('sends raw text bodies with their content type and JSON arrays as they are', async () => {
		const { context, calls } = fakeContext(() => ({ body: '{"id": 7, "workflow_state": "created"}' }));
		const response = await canvasApiRequest.call(context, 'POST', '/api/v1/accounts/1/sis_imports', 'user_id,login_id\n1,a', { import_type: 'instructure_csv' }, NO_RATE_LIMIT, 'text/csv');
		expect(calls[0].body).toBe('user_id,login_id\n1,a');
		expect((calls[0].headers as IDataObject)['Content-Type']).toBe('text/csv');
		expect(calls[0].json).toBe(false);
		expect(response.data).toEqual({ id: 7, workflow_state: 'created' });

		const array = fakeContext(() => ({ body: [] }));
		await canvasApiRequest.call(array.context, 'POST', '/api/v1/x', [{ a: 1 }, { a: 2 }], undefined, NO_RATE_LIMIT);
		expect(array.calls[0].body).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it('OAuth2: a 401 is retried once the way n8n needs to refresh the token', async () => {
		const { context, calls } = fakeContext((options, index) => {
			if (index === 0) return { status: 401, body: { errors: [{ message: 'Invalid access token.' }] } };
			// The second attempt is sent without ignoreHttpStatusErrors; n8n refreshes and succeeds.
			return { body: { id: 1 } };
		});
		(context as unknown as { getNodeParameter: (name: string) => string }).getNodeParameter = () => 'oAuth2';
		const response = await canvasApiRequest.call(context, 'GET', '/api/v1/users/self', undefined, undefined, NO_RATE_LIMIT);
		expect(response.data).toEqual({ id: 1 });
		expect(calls).toHaveLength(2);
		expect(calls[0].ignoreHttpStatusErrors).toBe(true);
		expect(calls[1].ignoreHttpStatusErrors).toBe(false);

		// With an API token there is nothing to refresh: one request, one error.
		const token = fakeContext(() => ({ status: 401, body: { errors: [{ message: 'Invalid access token.' }] } }));
		await expect(canvasApiRequest.call(token.context, 'GET', '/api/v1/users/self', undefined, undefined, NO_RATE_LIMIT)).rejects.toMatchObject({ httpCode: '401' });
		expect(token.calls).toHaveLength(1);
	});

	it('rejects an invalid Canvas URL before sending anything', async () => {
		const { context, calls } = fakeContext(() => ({ body: {} }));
		(context as unknown as { getCredentials: () => Promise<IDataObject> }).getCredentials = async () => ({ canvasUrl: 'school.instructure.com' });
		await expect(canvasApiRequest.call(context, 'GET', '/api/v1/a', undefined, undefined, NO_RATE_LIMIT)).rejects.toThrow(/Canvas URL in the credentials is not valid/);
		expect(calls).toHaveLength(0);
	});
});

describe('canvasApiRequestAllItems', () => {
	const page = (items: unknown[], next?: string) => ({
		body: items,
		headers: { 'x-rate-limit-remaining': '600', ...(next ? { link: `<${next}>; rel="next"` } : {}) },
	});

	it('follows next links through the configured host until they run out', async () => {
		const { context, calls } = fakeContext((_o, index) =>
			[
				page([{ id: 1 }, { id: 2 }], 'http://other-host.internal/api/v1/courses?page=2&per_page=2'),
				page([{ id: 3 }, { id: 4 }], 'https://canvas.test/api/v1/courses?page=bookmark:abc&per_page=2'),
				page([{ id: 5 }]),
			][index],
		);
		const result = await canvasApiRequestAllItems.call(context, 'GET', '/api/v1/courses', undefined, { state: ['available'] }, { enabled: true, perPage: 2, maxPages: 0 }, NO_RATE_LIMIT);
		expect(result.items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
		expect(result.isList).toBe(true);
		expect(result.totalPages).toBe(3);
		expect(calls.map((c) => c.url)).toEqual([
			'https://canvas.test/api/v1/courses?per_page=2&state[]=available',
			'https://canvas.test/api/v1/courses?page=2&per_page=2',
			'https://canvas.test/api/v1/courses?page=bookmark:abc&per_page=2',
		]);
	});

	it('stops at maxPages and at the item limit', async () => {
		const endless = (_options: IDataObject, index: number) =>
			page([{ id: 1 }, { id: 2 }, { id: 3 }], `https://canvas.test/api/v1/x?page=${index + 2}`);
		const byPages = fakeContext(endless);
		const pages = await canvasApiRequestAllItems.call(byPages.context, 'GET', '/api/v1/x', undefined, undefined, { enabled: true, perPage: 3, maxPages: 2 }, NO_RATE_LIMIT);
		expect(pages.items).toHaveLength(6);
		expect(byPages.calls).toHaveLength(2);

		const byLimit = fakeContext(endless);
		const limited = await canvasApiRequestAllItems.call(byLimit.context, 'GET', '/api/v1/x', undefined, undefined, { enabled: true, perPage: 50, maxPages: 0, limit: 7 }, NO_RATE_LIMIT);
		expect(limited.items).toHaveLength(7);
		expect(byLimit.calls).toHaveLength(3);
		expect(String(byLimit.calls[0].url)).toContain('per_page=7');
	});

	it('caps per_page at 100 and lets an explicit per_page on the operation win', async () => {
		const big = fakeContext(() => page([]));
		await canvasApiRequestAllItems.call(big.context, 'GET', '/api/v1/x', undefined, undefined, { enabled: true, perPage: 500, maxPages: 0 }, NO_RATE_LIMIT);
		expect(String(big.calls[0].url)).toContain('per_page=100');

		const explicit = fakeContext(() => page([]));
		await canvasApiRequestAllItems.call(explicit.context, 'GET', '/api/v1/x', undefined, { per_page: 25 }, { enabled: true, perPage: 10, maxPages: 0 }, NO_RATE_LIMIT);
		expect(String(explicit.calls[0].url)).toBe('https://canvas.test/api/v1/x?per_page=25');
	});

	it('returns a single record untouched and never asks for a second page', async () => {
		const { context, calls } = fakeContext(() => ({ body: { id: 9, name: 'One course' }, headers: {} }));
		const result = await canvasApiRequestAllItems.call(context, 'GET', '/api/v1/courses/9', undefined, undefined, { enabled: true, perPage: 10, maxPages: 5 }, NO_RATE_LIMIT);
		expect(result.isList).toBe(false);
		expect(result.items).toEqual([{ id: 9, name: 'One course' }]);
		expect(calls).toHaveLength(1);
	});

	it('unwraps wrapped lists across pages when a dataKey is given', async () => {
		const { context } = fakeContext((_o, index) =>
			index === 0
				? { body: { quiz_submissions: [{ id: 1 }], meta: {} }, headers: { link: '<https://canvas.test/api/v1/q?page=2>; rel="next"' } }
				: { body: { quiz_submissions: [{ id: 2 }] }, headers: {} },
		);
		const result = await canvasApiRequestAllItems.call(context, 'GET', '/api/v1/q', undefined, undefined, { enabled: true, perPage: 1, maxPages: 0 }, NO_RATE_LIMIT, 'quiz_submissions');
		expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
		expect(result.isList).toBe(true);
	});

	it('stops when the server keeps pointing at the same next page', async () => {
		const { context, calls } = fakeContext(() => page([{ id: 1 }], 'https://canvas.test/api/v1/x?page=2'));
		const result = await canvasApiRequestAllItems.call(context, 'GET', '/api/v1/x', undefined, undefined, { enabled: true, perPage: 1, maxPages: 0 }, NO_RATE_LIMIT);
		// First page, then page=2 once; the repeated link is not followed again.
		expect(calls).toHaveLength(2);
		expect(result.items).toHaveLength(2);
	});

	it('retries a throttled later page instead of losing the run', async () => {
		const { context, calls } = fakeContext((_o, index) => {
			if (index === 0) return page([{ id: 1 }], 'https://canvas.test/api/v1/x?page=2');
			if (index === 1) return THROTTLED;
			return page([{ id: 2 }]);
		});
		const result = await canvasApiRequestAllItems.call(context, 'GET', '/api/v1/x', undefined, undefined, { enabled: true, perPage: 1, maxPages: 0 }, NO_RATE_LIMIT);
		expect(result.items.map((i) => i.id)).toEqual([1, 2]);
		expect(calls).toHaveLength(3);
	});
});

describe('executeWithErrorHandling', () => {
	const run = (mode: 'stop' | 'continueWithError' | 'ignoreAndContinue' | 'retryThenError', operation: () => Promise<unknown>, continueOnFail = false) => {
		const { context } = fakeContext(() => ({ body: {} }), continueOnFail);
		return executeWithErrorHandling.call(context, operation, { onError: mode, maxRetries: 2 }, { id: 1 }, 'course', 'get', '/api/v1/courses/1', 0);
	};
	const failWith = (error: unknown) => {
		const fn = vi.fn(async () => {
			throw error;
		});
		return fn;
	};

	it('passes results through', async () => {
		await expect(run('stop', async () => ({ id: 1 }))).resolves.toEqual({ success: true, data: { id: 1 } });
		await expect(run('stop', async () => undefined)).resolves.toEqual({ success: true, data: undefined });
	});

	it('stop: throws an API error carrying Canvas\' message', async () => {
		await expect(run('stop', failWith(apiError(404, { errors: [{ message: 'The specified resource does not exist.' }] })))).rejects.toMatchObject({
			message: 'The specified resource does not exist.',
			httpCode: '404',
		});
	});

	it('stop + n8n "continue on fail": routes to the Error output instead of throwing', async () => {
		const result = await run('stop', failWith(apiError(404, {})), true);
		expect(result.success).toBe(false);
		expect(result.error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('continueWithError: returns the error record', async () => {
		const result = await run('continueWithError', failWith(apiError(422, { errors: { name: [{ message: 'is too long' }] } })));
		expect(result).toMatchObject({ success: false, error: { errorCode: 422, errorType: 'VALIDATION_ERROR', errorMessage: 'name: is too long' } });
	});

	it('ignoreAndContinue: reports failure without an error record', async () => {
		await expect(run('ignoreAndContinue', failWith(apiError(404, {})))).resolves.toEqual({ success: false });
	});

	it('retryThenError: retries server errors, not client errors', async () => {
		const server = failWith(apiError(503, 'Service Unavailable'));
		const serverResult = await run('retryThenError', server);
		expect(server).toHaveBeenCalledTimes(3);
		expect(serverResult.error).toMatchObject({ errorCode: 503, errorType: 'SERVER_ERROR' });

		const client = failWith(apiError(404, {}));
		const clientResult = await run('retryThenError', client);
		expect(client).toHaveBeenCalledTimes(1);
		expect(clientResult.error).toMatchObject({ errorCode: 404 });
	}, 20_000);
});
