import { expect } from 'vitest';
import type { RunNodeOptions } from '../../lib/harness';
import type { Json } from '../../lib/n8n';
import { runNode } from './run';

export interface BuiltRequest {
	method: string;
	/** Path of the request URL (without host). */
	path: string;
	/** Query string of the request URL, decoded. */
	query: string;
	body: unknown;
	curl: string;
}

/**
 * Run an operation in the node's debug mode: n8n resolves every parameter and the
 * node builds the request, but nothing is sent to Canvas. Returns the request per
 * input item, as reported on the Debug output.
 *
 * Used for operations of hosted Instructure services (New Quizzes) that a local
 * Canvas does not have: the request is compared with the published API documentation.
 */
/**
 * A Debug output item without the page size the node adds to every GET, so a test can
 * compare the operation's own parameters with the documentation. That the page size is
 * there is asserted here.
 */
export function withoutPaging(item: Json): Json {
	if (item.method !== 'GET') return item;
	const { per_page: perPage, ...queryString } = (item.queryString ?? {}) as Json;
	expect(perPage, 'every GET carries per_page').toBe(10);
	const url = String(item.url);
	expect(url).toMatch(/[?&]per_page=10(&|$)/);
	return {
		...item,
		queryString,
		url: url.replace(/([?&])per_page=10(&|$)/, (_match, lead: string, tail: string) => (tail === '&' ? lead : '')),
		curl: String(item.curl ?? '').replace(/([?&])per_page=10(&|')/, (_match, lead: string, tail: string) => (tail === '&' ? lead : tail)),
	};
}

export async function buildRequests(opts: RunNodeOptions): Promise<BuiltRequest[]> {
	const result = await runNode({ ...opts, params: { ...(opts.params ?? {}), debugMode: true } });
	if (!result.ok) {
		throw new Error(
			`${opts.resource}.${opts.operation} (debug) failed: ${JSON.stringify(result.failure).slice(0, 1500)}`,
		);
	}
	expect(result.success, 'debug mode sends nothing, so there is no Success output').toEqual([]);
	expect(result.error).toEqual([]);
	return result.debug.map((raw: Json) => {
		expect(raw).toMatchObject({ resource: opts.resource, operation: opts.operation });
		const item = withoutPaging(raw);
		const url = new URL(String(item.url));
		return {
			method: String(item.method),
			path: url.pathname,
			query: decodeURIComponent(url.search.replace(/^\?/, '')),
			body: item.body,
			curl: String(item.curl),
		};
	});
}

export async function buildRequest(opts: RunNodeOptions): Promise<BuiltRequest> {
	const requests = await buildRequests(opts);
	expect(requests).toHaveLength(1);
	return requests[0];
}

export const NEW_QUIZZES_SKIP_REASON =
	'New Quizzes is a hosted Instructure service; not available on a local Canvas';
