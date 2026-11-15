import { describe, expect, it } from 'vitest';
import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { Canvas } from '../../nodes/Canvas/Canvas.node.js';
import { withMasquerade } from '../../nodes/Canvas/GenericFunctions';
import { PAGED_LIST_OPERATIONS } from '../../nodes/Canvas/listOperations';
import { buildRequestFor, listOperations, paramVariants } from '../lib/catalog';

/**
 * The node itself (`execute`), run against a fake n8n context that records every request
 * instead of sending it. This is where what an input value can do to a request is pinned:
 * the request layer is covered by genericFunctions.test.ts, real behaviour by the battery.
 */
interface Sent {
	method: string;
	url: string;
	body?: unknown;
	authenticated: boolean;
}

interface Answer {
	status?: number;
	headers?: IDataObject;
	body?: unknown;
}

function run(
	params: Record<string, unknown>,
	options: { items?: IDataObject[]; answer?: (request: Sent, index: number) => Answer; nodeType?: string } = {},
): Promise<{ outputs: INodeExecutionData[][]; sent: Sent[]; hints: unknown[] }> {
	const sent: Sent[] = [];
	const hints: unknown[] = [];
	const respond = (authenticated: boolean) =>
		async function (...args: unknown[]) {
			const given = (authenticated ? args[1] : args[0]) as IDataObject;
			const request: Sent = { method: String(given.method), url: String(given.url), body: given.body, authenticated };
			sent.push(request);
			const answer = options.answer?.(request, sent.length - 1) ?? {};
			return { statusCode: answer.status ?? 200, headers: answer.headers ?? {}, body: answer.body ?? { id: 1 } };
		};
	const items = (options.items ?? [{}]).map((json) => ({ json }));
	const context = {
		getInputData: () => items,
		getNodeParameter: (name: string, index: number, fallback?: unknown) => {
			const value = params[name];
			if (typeof value === 'function') return (value as (i: number) => unknown)(index);
			return value === undefined ? fallback : value;
		},
		getNode: () => ({
			name: 'Canvas',
			type: options.nodeType ?? '@kyancey-va/n8n-nodes-canvas.canvas',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
			id: '1',
		}),
		getCredentials: async () => ({ canvasUrl: 'https://canvas.test', accessToken: 'secret-token' }),
		continueOnFail: () => false,
		addExecutionHints: (...given: unknown[]) => hints.push(...given),
		getExecutionCancelSignal: () => undefined,
		helpers: {
			httpRequestWithAuthentication: respond(true),
			httpRequest: respond(false),
		},
	};
	return new Canvas().execute
		.call(context as unknown as IExecuteFunctions)
		.then((outputs) => ({ outputs, sent, hints }));
}

/** Parameters every run here shares: no quota probe, failed items on the Error output. */
const quiet = { rateLimiting: { enabled: false }, errorHandling: { onError: 'continueWithError' } };

describe('what an input value can do to the request', () => {
	it('an ID with "?" and "#" stays one path segment: it cannot add a query or cut the path short', async () => {
		const { outputs, sent } = await run({
			...quiet,
			resource: 'assignment',
			operation: 'delete',
			courseId: '5?event=delete#%20',
			assignmentId: 9,
			requestOptions: { asUserId: '42' },
		});
		expect(outputs[1]).toEqual([]);
		expect(sent.map((r) => `${r.method} ${r.url}`)).toEqual([
			'DELETE https://canvas.test/api/v1/courses/5%3Fevent%3Ddelete%23%20/assignments/9?as_user_id=42',
		]);
	});

	it('a list or an object from an expression is held to the same rule as text', async () => {
		// `{{ $json.course_id }}` hands over whatever the input holds, also a list or an object.
		const inputs: unknown[] = [['5?event=delete#'], ['5', '6?x=1'], { a: '?#' }, [' 5?event=delete# ']];
		for (const courseId of inputs) {
			const { outputs, sent } = await run({
				...quiet,
				resource: 'assignment',
				operation: 'delete',
				courseId,
				assignmentId: 9,
				requestOptions: { asUserId: '42' },
			});
			const label = JSON.stringify(courseId);
			expect(outputs[1], label).toEqual([]);
			expect(sent, label).toHaveLength(1);
			const url = new URL(sent[0].url);
			// One request, to the assignment of whatever course that text names: nothing but the node's own query.
			expect(url.pathname.endsWith('/assignments/9'), label).toBe(true);
			expect(url.pathname.split('/').length, label).toBe('/api/v1/courses/x/assignments/9'.split('/').length);
			expect(url.search, label).toBe('?as_user_id=42');
			expect(url.hash, label).toBe('');
		}
	});

	it('a "?" or "#" that reaches a path in any other way is refused: no handler builds a path with a query', async () => {
		// Late Policy > Update reads the policy again after the write: that second path is checked like the first.
		const { outputs, sent } = await run({
			...quiet,
			resource: 'latePolicy',
			operation: 'update',
			courseId: ['7?x=1#'],
			updateFields: { missing_submission_deduction_enabled: true },
		});
		for (const request of sent) {
			expect(request.url).not.toMatch(/courses\/7\?/);
			expect(new URL(request.url).hash).toBe('');
		}
		expect(outputs[0].length + outputs[1].length).toBe(1);
	});

	it('an ID taken out of a URL stays as it is written there: escapes in it are never resolved', async () => {
		const progress = (progressId: string, operation = 'get') => run({ ...quiet, resource: 'progress', operation, progressId });

		const plain = await progress('https://canvas.test/api/v1/progress/123');
		expect(plain.sent.map((r) => r.url.replace(/\?.*/, ''))).toEqual(['https://canvas.test/api/v1/progress/123']);

		// An escaped "?" or "/" in the URL must not become a query or another path segment.
		const query = await progress('https://canvas.example/api/v1/progress/5%3Fas_user_id%3D42%23', 'cancel');
		expect(query.sent.map((r) => `${r.method} ${r.url}`)).toEqual(['POST https://canvas.test/api/v1/progress/5%3Fas_user_id%3D42%23/cancel']);
		const slash = await progress('https://canvas.example/api/v1/progress/5%2Fcancel');
		expect(slash.sent.map((r) => new URL(r.url).pathname)).toEqual(['/api/v1/progress/5%2Fcancel']);

		// A URL that goes on after the ID is not a progress URL.
		const longer = await progress('/api/v1/progress/7/extra');
		expect(longer.sent).toEqual([]);
		expect(longer.outputs[1][0].json).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
	});

	it('relative path segments are refused however they are written, and nothing is sent', async () => {
		for (const assignmentId of ['..', '%2e%2e', '%2E%2e/%2e%2e/%2e%2e/users/3', '../../users/3', '..\\..\\users\\3', '.', 'a/../../b']) {
			const { outputs, sent } = await run({ ...quiet, resource: 'assignment', operation: 'delete', courseId: '5', assignmentId });
			expect(sent, assignmentId).toEqual([]);
			expect(outputs[0], assignmentId).toEqual([]);
			expect(outputs[1][0].json, assignmentId).toMatchObject({
				errorType: 'INVALID_PARAMETERS',
				resource: 'assignment',
				operation: 'delete',
			});
			expect(String(outputs[1][0].json.errorMessage), assignmentId).toContain('would change the path of the request');
		}
	});

	it('an ID that only contains dots or slashes as data is one encoded segment', async () => {
		const { sent } = await run({
			...quiet,
			resource: 'user',
			operation: 'get',
			userId: (index: number) => ['sis_user_id:A/B', 'sis_user_id:A%2FB', 'sis_user_id:v1.2..3', 'sis_user_id:50%'][index],
		}, { items: [{}, {}, {}, {}] });
		expect(sent.map((r) => r.url.replace(/\?.*/, '')).sort()).toEqual([
			'https://canvas.test/api/v1/users/sis_user_id:50%25',
			'https://canvas.test/api/v1/users/sis_user_id:A%2FB',
			'https://canvas.test/api/v1/users/sis_user_id:A%2FB',
			'https://canvas.test/api/v1/users/sis_user_id:v1.2..3',
		]);
	});

	it('Act as User ID is the only thing that decides who is impersonated', async () => {
		const fromId = await run({
			...quiet,
			resource: 'assignment',
			operation: 'get',
			courseId: '5',
			assignmentId: '9?as_user_id=1&%20',
			requestOptions: { asUserId: '42' },
		});
		expect(fromId.sent).toHaveLength(1);
		const url = new URL(fromId.sent[0].url);
		expect(url.pathname).toBe('/api/v1/courses/5/assignments/9%3Fas_user_id%3D1%26%20');
		expect(url.searchParams.getAll('as_user_id')).toEqual(['42']);

		// Also in a Custom API Request, where the path is free text: the option wins, a fragment is dropped.
		const custom = await run({
			...quiet,
			resource: 'apiRequest',
			operation: 'request',
			method: 'GET',
			path: '/api/v1/courses/5?as_user_id=7&AS_USER_ID=8&as%5Fuser%5Fid=9&x=1#frag',
			requestOptions: { asUserId: '42' },
		});
		const customUrl = new URL(custom.sent[0].url);
		expect(customUrl.hash).toBe('');
		expect(customUrl.searchParams.get('x')).toBe('1');
		expect([...customUrl.searchParams.keys()].filter((key) => key.toLowerCase() === 'as_user_id')).toEqual(['as_user_id']);
		expect(customUrl.searchParams.get('as_user_id')).toBe('42');
	});

	it('withMasquerade replaces whatever the URL says and keeps the rest of the query as it is', () => {
		expect(withMasquerade('https://c.test/api/v1/courses', '42')).toBe('https://c.test/api/v1/courses?as_user_id=42');
		expect(withMasquerade('https://c.test/api/v1/courses?page=2&as_user_id=42&per_page=10', '42')).toBe(
			'https://c.test/api/v1/courses?page=2&per_page=10&as_user_id=42',
		);
		expect(withMasquerade('https://c.test/x?include[]=a&as_user_id=1&q=a%20b#f', 'sis_user_id:A B')).toBe(
			'https://c.test/x?include[]=a&q=a%20b&as_user_id=sis_user_id%3AA%20B',
		);
	});
});

describe('lists: Return All, Limit and the node-level Pagination options', () => {
	/** A Canvas list of `total` records that hands out pages of whatever size is asked for. */
	const list = (total: number) => (request: Sent): Answer => {
		const url = new URL(request.url);
		const perPage = Number(url.searchParams.get('per_page') ?? 10);
		const page = Number(url.searchParams.get('page') ?? 1);
		const records = Array.from({ length: total }, (_unused, index) => ({ id: index + 1 })).slice((page - 1) * perPage, page * perPage);
		const next = page * perPage < total ? `<https://canvas.test${url.pathname}?page=${page + 1}&per_page=${perPage}>; rel="next"` : undefined;
		return { body: records, headers: next ? { link: next } : {} };
	};
	const enrollments = { ...quiet, resource: 'enrollment', operation: 'getAll', contextType: 'course', courseId: '5' };
	const read = async (params: Record<string, unknown>, total = 480) => {
		const { outputs, sent, hints } = await run({ ...enrollments, ...params }, { answer: list(total) });
		return {
			count: outputs[0].length,
			requests: sent.map((r) => Number(new URL(r.url).searchParams.get('per_page'))),
			hints: hints as Array<{ message: string }>,
		};
	};

	const properties = new Canvas().description.properties;
	const shownFor = (name: string, resource: string, operation: string): boolean =>
		properties.some(
			(property) =>
				property.name === name &&
				(property.displayOptions?.show?.resource as string[] | undefined)?.includes(resource) &&
				((property.displayOptions?.show?.operation as string[] | undefined)?.includes(operation) ?? true),
		);

	it('every paged list operation offers Return All and Limit', () => {
		for (const [resource, operation] of [
			['enrollment', 'getAll'],
			['user', 'getAll'],
			['course', 'listUsers'],
			['account', 'getCourses'],
			['submission', 'getAllForStudents'],
			['courseAuditLog', 'getByCourse'],
			['conversation', 'getAll'],
			['apiRequest', 'request'],
		]) {
			expect(shownFor('returnAll', resource, operation), `${resource}.${operation} Return All`).toBe(true);
			expect(shownFor('limit', resource, operation), `${resource}.${operation} Limit`).toBe(true);
		}
		// Not on operations that return one record, that always read everything, or whose list
		// Canvas returns whole (a Limit there would cut what was never cut before).
		expect(shownFor('returnAll', 'course', 'get')).toBe(false);
		expect(shownFor('returnAll', 'course', 'listStudents')).toBe(false);
		expect(shownFor('returnAll', 'apiTokenScope', 'getAll')).toBe(false);
		expect(shownFor('returnAll', 'authenticationProvider', 'getAll')).toBe(false);
		expect(shownFor('returnAll', 'notificationPreference', 'getAll')).toBe(false);
	});

	it('every entry of the list of paged operations names an operation of the node that reads with GET', () => {
		const known = new Map(listOperations().map((op) => [`${op.resource}.${op.operation}`, op]));
		const problems: string[] = [];
		for (const [resource, operations] of Object.entries(PAGED_LIST_OPERATIONS)) {
			for (const operation of operations) {
				const op = known.get(`${resource}.${operation}`);
				if (!op) {
					problems.push(`${resource}.${operation} does not exist`);
					continue;
				}
				// A typo here would silently leave an operation without its Return All / Limit fields.
				if (!shownFor('returnAll', resource, operation) || !shownFor('limit', resource, operation)) {
					problems.push(`${resource}.${operation} has no Return All / Limit`);
				}
				// The Custom API Request offers every method; its fields are shown for GET only.
				if (resource === 'apiRequest') continue;
				for (const variant of paramVariants(op)) {
					try {
						const request = buildRequestFor(resource, operation, variant.params);
						if (request.method !== 'GET') problems.push(`${resource}.${operation} [${variant.label}] sends ${request.method}`);
					} catch {
						// a parameter set the operation refuses as a whole
					}
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it('by default the Limit of 50 is read in one request, and the output says that the list goes on', async () => {
		const byDefault = await read({ returnAll: false, limit: 50 });
		expect(byDefault.count).toBe(50);
		expect(byDefault.requests).toEqual([50]);
		expect(byDefault.hints).toHaveLength(1);
		expect(byDefault.hints[0].message).toContain('incomplete');
		expect(byDefault.hints[0].message).toContain('Return All');

		// A Limit the user chose is no surprise: no warning for it.
		const larger = await read({ returnAll: false, limit: 250 });
		expect(larger.count).toBe(250);
		expect(larger.requests).toEqual([100, 100, 100]);
		expect(larger.hints).toEqual([]);

		// A list that fits needs no hint, also when it ends exactly at the limit.
		expect((await read({ returnAll: false, limit: 50 }, 50)).hints).toEqual([]);
		expect((await read({ returnAll: false, limit: 50 }, 7)).hints).toEqual([]);
	});

	it('Return All reads everything in full pages, from the operation or from the node-level option', async () => {
		const own = await read({ returnAll: true });
		expect(own.count).toBe(480);
		expect(own.requests).toEqual([100, 100, 100, 100, 100]);
		expect(own.hints).toEqual([]);

		const nodeLevel = await read({ returnAll: false, limit: 50, pagination: { returnAll: true } });
		expect(nodeLevel.count).toBe(480);
		expect(nodeLevel.hints).toEqual([]);

		const smallPages = await read({ returnAll: true, pagination: { perPage: 20 } });
		expect(smallPages.count).toBe(480);
		expect(new Set(smallPages.requests)).toEqual(new Set([20]));
	});

	it('a Limit the user changed always wins; Items Per Page then only sets the page size', async () => {
		const small = await read({ returnAll: false, limit: 9, pagination: { perPage: 4 } });
		expect(small.count).toBe(9);
		expect(small.requests).toEqual([4, 4, 4]);
		const capped = await read({ returnAll: false, limit: 120, pagination: { perPage: 100, maxPages: 1 } });
		expect(capped.count).toBe(120);
		expect(capped.requests).toEqual([100, 100]);
	});

	it('with the Limit left at 50, Items Per Page or Max Pages set on the node decide (as in workflows saved before 0.2.0)', async () => {
		const pages = await read({ returnAll: false, limit: 50, pagination: { perPage: 100, maxPages: 3 } });
		expect(pages.count).toBe(300);
		expect(pages.requests).toEqual([100, 100, 100]);
		expect(pages.hints).toHaveLength(1);

		const onlyPerPage = await read({ returnAll: false, limit: 50, pagination: { perPage: 30 } });
		expect(onlyPerPage.count).toBe(150); // 5 pages, the default page budget
		const onlyMaxPages = await read({ returnAll: false, limit: 50, pagination: { maxPages: 2 } });
		expect(onlyMaxPages.count).toBe(20); // 2 pages of the default size
	});

	it('an operation without a Limit field keeps the node-level paging, and still says when it stopped early', async () => {
		// The Custom API Request offers the fields for GET only; here they are absent (as for a saved workflow).
		const custom = await run(
			{ ...quiet, resource: 'apiRequest', operation: 'request', method: 'GET', path: '/api/v1/courses/5/enrollments' },
			{ answer: list(480) },
		);
		expect(custom.outputs[0]).toHaveLength(50);
		expect(custom.sent).toHaveLength(5);
		expect((custom.hints as Array<{ message: string }>)[0].message).toContain('Pagination > Return All');
	});
});
