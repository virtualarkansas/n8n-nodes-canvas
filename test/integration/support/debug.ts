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
export async function buildRequests(opts: RunNodeOptions): Promise<BuiltRequest[]> {
	const result = await runNode({ ...opts, params: { ...(opts.params ?? {}), debugMode: true } });
	if (!result.ok) {
		throw new Error(
			`${opts.resource}.${opts.operation} (debug) failed: ${JSON.stringify(result.failure).slice(0, 1500)}`,
		);
	}
	expect(result.success, 'debug mode sends nothing, so there is no Success output').toEqual([]);
	expect(result.error).toEqual([]);
	return result.debug.map((item: Json) => {
		expect(item).toMatchObject({ resource: opts.resource, operation: opts.operation });
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
