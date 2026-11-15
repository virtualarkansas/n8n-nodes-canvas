import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCredential, n8n, runNode } from '../lib/harness';
import { CanvasStub } from './misc-support/stub';

/**
 * GET requests that Canvas answers with a redirect.
 *
 * Some Canvas endpoints redirect to a file instead of answering themselves: the
 * brand variables (`GET /api/v1/brand_variables` -> a JSON file on the CDN), file
 * downloads, report files. On a hosted Canvas the target is another host. n8n
 * follows such redirects for the node, and puts the Authorization header back on
 * every hop, so the Canvas token travels to that other host.
 *
 * Two stub servers stand in for Canvas and for the other host (the local Canvas
 * has no CDN, and its brand variables file does not exist because its assets were
 * never compiled).
 */
describe('GET redirects', () => {
	const canvasStub = new CanvasStub();
	const otherHost = new CanvasStub();
	const TOKEN = 'redirect-test-token-4b1d9e';
	let credential: { id: string; name: string; type: string };
	let otherUrl = '';
	const VARIABLES = { 'ic-brand-primary': '#0374B5', 'ic-link-color': '#0374B5' };

	const get = (path: string): ReturnType<typeof runNode> =>
		runNode({
			resource: 'apiRequest',
			operation: 'request',
			credential,
			params: { method: 'GET', path, errorHandling: { onError: 'continueWithError' } },
		});

	beforeAll(async () => {
		await canvasStub.start();
		await otherHost.start();
		// The stubs listen on 127.0.0.1; "localhost" is another host name for the same machine.
		otherUrl = otherHost.url.replace('127.0.0.1', 'localhost');
		credential = await createCredential(TOKEN, 'redirect stub', canvasStub.url);
	});

	afterAll(async () => {
		await n8n()
			.api('DELETE', `/credentials/${credential.id}`)
			.catch(() => undefined);
		await canvasStub.stop();
		await otherHost.stop();
	});

	it('a redirect within Canvas is followed with the token', async () => {
		canvasStub.reset((request) => {
			if (request.path === '/api/v1/courses/1/root_outcome_group') {
				return { status: 302, headers: { location: `${canvasStub.url}/api/v1/courses/1/outcome_groups/7` }, body: '' };
			}
			if (request.path === '/api/v1/courses/1/outcome_groups/7') return { body: { id: 7, title: 'Root group' } };
			return undefined;
		});
		const result = await get('/api/v1/courses/1/root_outcome_group');
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([{ id: 7, title: 'Root group' }]);
		const followed = canvasStub.calls.find((call) => call.path === '/api/v1/courses/1/outcome_groups/7');
		expect(followed?.headers.authorization).toBe(`Bearer ${TOKEN}`);
	});

	it('[needs shared change] a redirect to another host is followed without the token', async () => {
		canvasStub.reset((request) => {
			if (request.path === '/api/v1/brand_variables') {
				return { status: 302, headers: { location: `${otherUrl}/dist/brandable_css/default/variables-abc123.json` }, body: '' };
			}
			return undefined;
		});
		otherHost.reset(() => ({ body: VARIABLES }));

		const result = await get('/api/v1/brand_variables');
		// The file is fetched and becomes the item ...
		expect(result.error).toEqual([]);
		expect(result.success).toEqual([VARIABLES]);
		expect(otherHost.requests).toHaveLength(1);
		expect(otherHost.requests[0].path).toBe('/dist/brandable_css/default/variables-abc123.json');
		// ... but the other host never sees the Canvas token.
		expect(otherHost.requests[0].headers.authorization).toBeUndefined();
	});
});
