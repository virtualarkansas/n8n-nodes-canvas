import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { canvas, CanvasClient, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../lib/harness';
import type { Json } from '../lib/n8n';
import {
	createDedicatedAdmin,
	createDedicatedUser,
	registerCredential,
	removeCredential,
	removeDedicatedAdmin,
	removeDedicatedUser,
} from './misc-support/dedicated';
import type { DedicatedUser } from './misc-support/dedicated';
import { CanvasStub } from './misc-support/stub';
import type { StubResponse } from './misc-support/stub';
import { bucketLevel, holdRemaining, setRemaining } from './misc-support/throttle';
import { createCourse, deleteCourses, uniqueSisId } from './misc-support/world';
import type { OwnCourse } from './misc-support/world';

vi.mock('../lib/state', async (original) =>
	(await import('./misc-support/state-overlay')).overlayState(await original()),
);

/**
 * Behaviour of the node itself, whatever the resource: item processing, n8n's node
 * settings, pagination, rate limiting, odd inputs, debug mode, personas and broken
 * credentials. Runs on the real n8n against the real Canvas; a small stub server
 * stands in for Canvas only where Canvas cannot be made to misbehave on demand or
 * where the exact request on the wire matters.
 *
 */
describe('cross-cutting', () => {
	let admin: DedicatedUser; // account admin of this file's own: own token, own rate-limit quota
	let api: CanvasClient;
	let course: OwnCourse;
	const stub = new CanvasStub();
	const STUB_TOKEN = 'stub-secret-token-9f8e7d6c5b4a';

	const run = (opts: RunNodeOptions): Promise<RunNodeResult> => runNode({ persona: admin.persona, ...opts });
	const ok = (opts: RunNodeOptions): Promise<Json[]> => runOk({ persona: admin.persona, ...opts });
	const viaStub = (opts: RunNodeOptions): Promise<RunNodeResult> => runNode({ persona: 'stub', ...opts });
	/** Raw items (with pairedItem) of one output of the Canvas node. */
	const raw = (result: RunNodeResult, output: number): Array<{ json: Json; pairedItem?: unknown }> =>
		result.execution.nodes.Canvas?.[0]?.rawOutputs[output] ?? [];
	const paired = (result: RunNodeResult, output: number): number[] =>
		raw(result, output).map((item) => Number((item.pairedItem as Json | undefined)?.item));
	const outputSizes = (result: RunNodeResult): number[] =>
		(result.execution.nodes.Canvas?.[0]?.rawOutputs ?? []).map((items) => items.length);

	beforeAll(async () => {
		admin = await createDedicatedAdmin('crosscutting');
		api = new CanvasClient(admin.persona);
		course = await createCourse('Crosscutting', { sisId: uniqueSisId('XC-COURSE') });
		await stub.start();
		await registerCredential('stub', { canvasUrl: stub.url, accessToken: STUB_TOKEN });
	});

	afterAll(async () => {
		await removeCredential('stub');
		await stub.stop();
		await deleteCourses([course]);
		await removeDedicatedAdmin(admin);
	});

	// =====================================================================
	// a. Batch and individual processing
	// =====================================================================
	describe('a. item processing', () => {
		const MISSING = 999999999;
		const FAIL_AT = 13;
		let userIds: number[] = [];
		let items: Json[] = [];
		let goodIndexes: number[] = [];

		beforeAll(async () => {
			const users = await api.get<Json[]>(`/api/v1/courses/${fx('largeCourseId')}/users?per_page=26`);
			userIds = users.map((u) => Number(u.id));
			expect(userIds).toHaveLength(26);
			// 27 input items; the one in the middle points at a user that does not exist.
			const ids = [...userIds.slice(0, FAIL_AT), MISSING, ...userIds.slice(FAIL_AT)];
			items = ids.map((id, n) => ({ id, n }));
			goodIndexes = items.map((_, index) => index).filter((index) => index !== FAIL_AT);
		});

		const getUsers = (params: Json, more: Partial<RunNodeOptions> = {}): Promise<RunNodeResult> =>
			run({ resource: 'user', operation: 'get', items, params: { userId: '={{ $json.id }}', ...params }, ...more });

		const expectOneToOne = (result: RunNodeResult): void => {
			// One output item per successful input item, in input order, each pointing at its input item.
			expect(result.success.map((u) => u.id)).toEqual(goodIndexes.map((index) => items[index].id));
			expect(paired(result, 0)).toEqual(goodIndexes);
		};

		it('batch mode (default): 27 items, the failing one goes to Error, the rest succeed in order', async () => {
			const result = await getUsers({ errorHandling: { onError: 'continueWithError' } });
			expect(result.ok).toBe(true);
			expectOneToOne(result);
			expect(result.error).toHaveLength(1);
			expect(paired(result, 1)).toEqual([FAIL_AT]);
			expect(result.error[0]).toMatchObject({
				error: true,
				errorCode: 404,
				errorType: 'NOT_FOUND',
				resource: 'user',
				operation: 'get',
				endpoint: `/api/v1/users/${MISSING}`,
				originalItem: { id: MISSING, n: FAIL_AT },
			});
			expect(String(result.error[0].errorMessage)).toMatch(/\S/);
			expect(Date.parse(String(result.error[0].timestamp))).not.toBeNaN();
		});

		it('individual mode: same mapping, one request after the other', async () => {
			const result = await getUsers({ errorHandling: { onError: 'continueWithError' }, batchProcessing: { mode: 'individual' } });
			expect(result.ok).toBe(true);
			expectOneToOne(result);
			expect(paired(result, 1)).toEqual([FAIL_AT]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, originalItem: { id: MISSING, n: FAIL_AT } });
		});

		it('batch size and delay: items are sent in groups, with the pause between groups', async () => {
			stub.reset((request) => ({ body: { id: Number(request.path.split('/').pop()) } }));
			const started = Date.now();
			const result = await viaStub({
				resource: 'user',
				operation: 'get',
				items,
				params: { userId: '={{ $json.id }}', batchProcessing: { mode: 'batch', batchSize: 9, batchDelay: 1200 } },
			});
			const elapsed = Date.now() - started;
			expect(result.error).toEqual([]);
			expect(result.success.map((u) => u.id)).toEqual(items.map((i) => i.id));
			expect(paired(result, 0)).toEqual(items.map((_, index) => index));
			// 27 items in batches of 9: three groups, two pauses, never a pause after the last group.
			const times = stub.calls.map((c) => c.at);
			expect(stub.calls).toHaveLength(27);
			const gaps = [times[9] - times[8], times[18] - times[17]];
			for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(1100);
			expect(times[8] - times[0]).toBeLessThan(1000);
			expect(times[26] - times[18]).toBeLessThan(1000);
			expect(elapsed).toBeGreaterThanOrEqual(2400);
			// Every group really is sent together: the stub sees the requests of a group before answering.
			expect(new Set(stub.calls.slice(0, 9).map((c) => c.path)).size).toBe(9);

			// A delay of 0 and a batch larger than the input: one group, no pause.
			stub.reset((request) => ({ body: { id: Number(request.path.split('/').pop()) } }));
			const quick = await viaStub({
				resource: 'user',
				operation: 'get',
				items,
				params: { userId: '={{ $json.id }}', batchProcessing: { mode: 'batch', batchSize: 100, batchDelay: 0 } },
			});
			expect(quick.success).toHaveLength(27);
			expect(stub.calls[26].at - stub.calls[0].at).toBeLessThan(1000);
		});

		it('individual mode really is sequential: a request starts only after the previous answer', async () => {
			stub.reset((request) => ({ body: { id: Number(request.path.split('/').pop()) }, delayMs: 60 }));
			const result = await viaStub({
				resource: 'user',
				operation: 'get',
				items: items.slice(0, 8),
				params: { userId: '={{ $json.id }}', batchProcessing: { mode: 'individual' } },
			});
			expect(result.success).toHaveLength(8);
			const times = stub.calls.map((c) => c.at);
			for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(55);
			expect(stub.calls.map((c) => c.path)).toEqual(items.slice(0, 8).map((i) => `/api/v1/users/${String(i.id)}`));
		});

		it('ignoreAndContinue: the failing item disappears, nothing reaches the Error output', async () => {
			const result = await getUsers({ errorHandling: { onError: 'ignoreAndContinue' } });
			expect(result.ok).toBe(true);
			expectOneToOne(result);
			expect(result.error).toEqual([]);
		});

		it('retryThenError: a 404 is not retried and ends on the Error output', async () => {
			const started = Date.now();
			const result = await getUsers({ errorHandling: { onError: 'retryThenError', maxRetries: 3 } });
			const elapsed = Date.now() - started;
			expectOneToOne(result);
			expect(paired(result, 1)).toEqual([FAIL_AT]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

			// The same through the stub, where the attempts can be counted: client errors once, server errors retried.
			const attempts: Record<string, number> = {};
			stub.reset((request) => {
				attempts[request.path] = (attempts[request.path] ?? 0) + 1;
				if (request.path.endsWith('/404')) return { status: 404, body: { errors: [{ message: 'The specified resource does not exist.' }] } };
				if (request.path.endsWith('/500')) return attempts[request.path] < 3 ? { status: 500, body: { errors: [{ message: 'boom' }] } } : { body: { id: 500 } };
				if (request.path.endsWith('/503')) return { status: 503, body: 'Service Unavailable' };
				return { body: { id: Number(request.path.split('/').pop()) } };
			});
			const retried = await viaStub({
				resource: 'user',
				operation: 'get',
				items: [{ id: 1 }, { id: 404 }, { id: 500 }, { id: 503 }, { id: 2 }],
				params: { userId: '={{ $json.id }}', errorHandling: { onError: 'retryThenError', maxRetries: 2 }, rateLimiting: { enabled: false } },
			});
			expect(retried.success.map((u) => u.id)).toEqual([1, 500, 2]);
			expect(paired(retried, 0)).toEqual([0, 2, 4]);
			expect(paired(retried, 1)).toEqual([1, 3]);
			expect(retried.error.map((e) => [e.errorCode, e.errorType])).toEqual([
				[404, 'NOT_FOUND'],
				[503, 'SERVER_ERROR'],
			]);
			// 404: one attempt. 500: two failures then success (backoff 2 s + 4 s). 503: first try + 2 retries.
			expect(attempts).toMatchObject({ '/api/v1/users/404': 1, '/api/v1/users/500': 3, '/api/v1/users/503': 3 });
			expect(elapsed).toBeLessThan(60_000);
		}, 240_000);

		it('retryThenError: a write is only repeated when Canvas cannot have carried it out', async () => {
			const attempts: Record<string, number> = {};
			stub.reset((request): StubResponse | undefined => {
				const id = request.path.split('/').pop() ?? '';
				attempts[id] = (attempts[id] ?? 0) + 1;
				switch (id) {
					case '500': // Canvas failed somewhere: the delete may have happened
						return { status: 500, body: { errors: [{ message: 'boom' }] } };
					case '504': // a gateway gave up waiting: Canvas may still have finished
						return { status: 504, body: 'Gateway Timeout' };
					case '503': // not available: nothing was done
						return attempts[id] < 3 ? { status: 503, body: 'Service Unavailable' } : { body: { delete: true } };
					case '403': // throttled: nothing was done
						return attempts[id] < 2
							? { status: 403, headers: { 'x-rate-limit-remaining': '0.0' }, body: '403 Forbidden (Rate Limit Exceeded)\n' }
							: { body: { delete: true } };
					default:
						return undefined;
				}
			});
			const result = await viaStub({
				resource: 'course',
				operation: 'delete',
				items: [{ id: 500 }, { id: 504 }, { id: 503 }, { id: 403 }],
				params: {
					courseId: '={{ $json.id }}',
					errorHandling: { onError: 'retryThenError', maxRetries: 3 },
					rateLimiting: { enabled: false, maxRetries: 0 },
					batchProcessing: { mode: 'individual' },
				},
			});
			expect(attempts).toEqual({ '500': 1, '504': 1, '503': 3, '403': 2 });
			expect(paired(result, 0)).toEqual([2, 3]);
			expect(result.error.map((e) => [e.errorCode, e.errorType])).toEqual([
				[500, 'SERVER_ERROR'],
				[504, 'SERVER_ERROR'],
			]);

			// The same failures on a read are all retried.
			for (const key of Object.keys(attempts)) delete attempts[key];
			await viaStub({
				resource: 'course',
				operation: 'get',
				items: [{ id: 500 }, { id: 504 }],
				params: {
					courseId: '={{ $json.id }}',
					errorHandling: { onError: 'retryThenError', maxRetries: 1 },
					rateLimiting: { enabled: false },
				},
			});
			expect(attempts).toEqual({ '500': 2, '504': 2 });
		}, 240_000);

		it('Wait for Completion: polls until the job reports its end, and gives up with TIMEOUT', async () => {
			const states = ['queued', 'running', 'running', 'completed'];
			let looks = 0;
			stub.reset(() => ({ body: { id: 7, workflow_state: states[Math.min(looks++, states.length - 1)], completion: looks * 25 } }));
			const started = Date.now();
			const done = await viaStub({
				resource: 'progress',
				operation: 'waitForCompletion',
				params: { progressId: '7', pollInterval: 1, timeout: 30, rateLimiting: { enabled: false } },
			});
			expect(done.error).toEqual([]);
			expect(done.success).toEqual([{ id: 7, workflow_state: 'completed', completion: 100 }]);
			expect(stub.calls.map((c) => `${c.method} ${c.url}`)).toEqual(Array(4).fill('GET /api/v1/progress/7'));
			expect(Date.now() - started).toBeGreaterThanOrEqual(2900); // three pauses of a second

			// A failed job is a result, not an error of the operation.
			stub.reset(() => ({ body: { id: 8, workflow_state: 'failed', message: 'cancelled' } }));
			const failed = await viaStub({
				resource: 'progress',
				operation: 'waitForCompletion',
				params: { progressId: '8', rateLimiting: { enabled: false } },
			});
			expect(failed.success).toEqual([{ id: 8, workflow_state: 'failed', message: 'cancelled' }]);

			// Never finishing: the item ends on the Error output as TIMEOUT after about the time allowed.
			stub.reset(() => ({ body: { id: 9, workflow_state: 'running' } }));
			const startedWaiting = Date.now();
			const gaveUp = await viaStub({
				resource: 'progress',
				operation: 'waitForCompletion',
				params: {
					progressId: '9',
					pollInterval: 1,
					timeout: 3,
					rateLimiting: { enabled: false },
					errorHandling: { onError: 'retryThenError', maxRetries: 3 },
				},
			});
			expect(gaveUp.success).toEqual([]);
			expect(gaveUp.error[0]).toMatchObject({
				errorCode: 0,
				errorType: 'TIMEOUT',
				errorMessage: 'Still not finished after 3 seconds',
				resource: 'progress',
				operation: 'waitForCompletion',
				endpoint: '/api/v1/progress/9',
			});
			// Not retried (that would wait all over again), and no longer than allowed.
			expect(Date.now() - startedWaiting).toBeLessThan(8000);
			expect(stub.calls.length).toBeGreaterThanOrEqual(3);
			expect(stub.calls.length).toBeLessThanOrEqual(4);
		}, 120_000);

		it('stop (default): the execution fails with Canvas\' message and says which item and request', async () => {
			const result = await getUsers({});
			expect(result.ok).toBe(false);
			expect(result.success).toEqual([]);
			expect(result.error).toEqual([]);
			const direct = await api.request('GET', `/api/v1/users/${MISSING}`);
			const canvasMessage = String(((direct.data as Json).errors as Json[])[0].message);
			expect(result.failure).toMatchObject({
				message: canvasMessage,
				description: `NOT_FOUND error (HTTP 404) on user/get (/api/v1/users/${MISSING})`,
				httpCode: '404',
			});
			expect(result.failure?.raw.name).toBe('NodeApiError');
			expect((result.failure?.raw.context as Json).itemIndex).toBe(FAIL_AT);
			expect(result.execution.lastNodeExecuted).toBe('Canvas');

			// In individual mode nothing after the failing item is requested.
			stub.reset((request) =>
				request.path.endsWith(`/${MISSING}`) ? { status: 404, body: { errors: [{ message: 'The specified resource does not exist.' }] } } : undefined,
			);
			const sequential = await viaStub({
				resource: 'user',
				operation: 'get',
				items,
				params: { userId: '={{ $json.id }}', batchProcessing: { mode: 'individual' } },
			});
			expect(sequential.ok).toBe(false);
			expect(sequential.failure?.message).toBe('The specified resource does not exist.');
			expect(stub.calls).toHaveLength(FAIL_AT + 1);
			// In batch mode the whole group of the failing item has already been sent, later groups are not.
			stub.reset((request) =>
				request.path.endsWith(`/${MISSING}`) ? { status: 404, body: { errors: [{ message: 'The specified resource does not exist.' }] } } : undefined,
			);
			const batched = await viaStub({
				resource: 'user',
				operation: 'get',
				items,
				params: { userId: '={{ $json.id }}', batchProcessing: { mode: 'batch', batchSize: 10, batchDelay: 0 } },
			});
			expect(batched.ok).toBe(false);
			expect(stub.calls).toHaveLength(20);
		});

		it('list operations keep the link to their input item: several lists in one run', async () => {
			const sections = fx('largeCourseId');
			const result = await run({
				resource: 'section',
				operation: 'getAll',
				items: [{ course: sections }, { course: MISSING }, { course: fx('emptyCourseId') }, { course: course.id }],
				params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' }, pagination: { returnAll: true } },
			});
			const expectedLarge = await api.getAll<Json>(`/api/v1/courses/${sections}/sections`);
			const expectedEmpty = await api.getAll<Json>(`/api/v1/courses/${fx('emptyCourseId')}/sections`);
			const expectedOwn = await api.getAll<Json>(`/api/v1/courses/${course.id}/sections`);
			// Every record of a list is its own item, paired with the input item the list was fetched for.
			expect(paired(result, 0)).toEqual([
				...expectedLarge.map(() => 0),
				...expectedEmpty.map(() => 2),
				...expectedOwn.map(() => 3),
			]);
			expect(result.success.map((s) => s.id)).toEqual([...expectedLarge, ...expectedEmpty, ...expectedOwn].map((s) => s.id));
			expect(paired(result, 1)).toEqual([1]);
		});
	});

	// =====================================================================
	// b. n8n's own node settings
	// =====================================================================
	describe('b. n8n node settings', () => {
		const three = [{ id: 1 }, { id: 404 }, { id: 3 }];
		const script = (): void =>
			stub.reset((request) =>
				request.path.endsWith('/404')
					? { status: 404, body: { errors: [{ message: 'The specified resource does not exist.' }] } }
					: { body: { id: Number(request.path.split('/').pop()) } },
			);

		it('every combination of n8n\'s "On Error" with the node\'s own error modes', async () => {
			const settings: Array<[string, Json]> = [
				['(default: stop workflow)', {}],
				['onError: stopWorkflow', { onError: 'stopWorkflow' }],
				['continueOnFail: true (legacy setting)', { continueOnFail: true }],
				['onError: continueRegularOutput', { onError: 'continueRegularOutput' }],
				['onError: continueErrorOutput', { onError: 'continueErrorOutput' }],
			];
			const modes = ['stop', 'continueWithError', 'ignoreAndContinue', 'retryThenError'];
			const observed: Record<string, Record<string, string>> = {};
			for (const [label, nodeSettings] of settings) {
				observed[label] = {};
				for (const mode of modes) {
					script();
					const result = await viaStub({
						resource: 'user',
						operation: 'get',
						items: three,
						params: { userId: '={{ $json.id }}', errorHandling: { onError: mode } },
						nodeSettings: nodeSettings as RunNodeOptions['nodeSettings'],
					});
					observed[label][mode] = result.ok ? `ok ${JSON.stringify(outputSizes(result))}` : `FAILED: ${result.failure?.message}`;
					if (result.ok && outputSizes(result)[1] === 1) {
						// Whatever the combination, the structured error item is the same and is paired with its input.
						expect(raw(result, 1)[0].json).toMatchObject({ error: true, errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: 404 } });
						expect(paired(result, 1)).toEqual([1]);
						expect(paired(result, 0)).toEqual([0, 2]);
					}
				}
			}

			const failed = 'FAILED: The specified resource does not exist.';
			const toErrorOutput = 'ok [2,1]'; // two items on Success, the failing one on the node's Error output
			const dropped = 'ok [2,0]';
			expect(observed).toEqual({
				// Without an n8n setting the node's own mode decides.
				'(default: stop workflow)': { stop: failed, continueWithError: toErrorOutput, ignoreAndContinue: dropped, retryThenError: toErrorOutput },
				'onError: stopWorkflow': { stop: failed, continueWithError: toErrorOutput, ignoreAndContinue: dropped, retryThenError: toErrorOutput },
				// n8n's "continue" settings only matter when the node's own mode is Stop: the node then behaves as
				// "Continue & Output Error". Failed items go to the node's Error output, never to the regular output.
				'continueOnFail: true (legacy setting)': { stop: toErrorOutput, continueWithError: toErrorOutput, ignoreAndContinue: dropped, retryThenError: toErrorOutput },
				'onError: continueRegularOutput': { stop: toErrorOutput, continueWithError: toErrorOutput, ignoreAndContinue: dropped, retryThenError: toErrorOutput },
				// "Continue (using error output)" makes n8n add a third output of its own. It stays empty in every
				// mode: failed items are already on the node's own Error output (n8n only moves items shaped
				// { error } there, and the node's error items are richer). The README says to use the node's output.
				'onError: continueErrorOutput': { stop: 'ok [2,1,0]', continueWithError: 'ok [2,1,0]', ignoreAndContinue: 'ok [2,0,0]', retryThenError: 'ok [2,1,0]' },
			});
		});

		it('the same on the real Canvas for the combinations that differ', async () => {
			const realItems = [{ id: course.id }, { id: 999999999 }, { id: course.id }];
			const attempt = (mode: string, nodeSettings: Json): Promise<RunNodeResult> =>
				run({
					resource: 'course',
					operation: 'get',
					items: realItems,
					params: { courseId: '={{ $json.id }}', errorHandling: { onError: mode } },
					nodeSettings: nodeSettings as RunNodeOptions['nodeSettings'],
				});
			const [plainStop, continued, errorOutput] = await Promise.all([
				attempt('stop', {}),
				attempt('stop', { onError: 'continueRegularOutput' }),
				attempt('stop', { onError: 'continueErrorOutput' }),
			]);
			expect(plainStop.ok).toBe(false);
			expect(plainStop.failure?.httpCode).toBe('404');
			expect(continued.ok).toBe(true);
			expect(outputSizes(continued)).toEqual([2, 1]);
			expect(continued.success.map((c) => c.id)).toEqual([Number(course.id), Number(course.id)]);
			expect(continued.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/courses/999999999' });
			expect(outputSizes(errorOutput)).toEqual([2, 1, 0]);
		});

		it('n8n\'s "Retry On Fail" repeats the whole node: items that already succeeded are sent again', async () => {
			script();
			const result = await viaStub({
				resource: 'user',
				operation: 'get',
				items: three,
				params: { userId: '={{ $json.id }}', batchProcessing: { mode: 'individual' } },
				nodeSettings: { retryOnFail: true, maxTries: 3, waitBetweenTries: 100 } as RunNodeOptions['nodeSettings'],
			});
			expect(result.ok).toBe(false);
			// Three tries; each one starts again at the first item and stops at the failing one.
			expect(stub.calls.map((c) => c.path)).toEqual([
				'/api/v1/users/1',
				'/api/v1/users/404',
				'/api/v1/users/1',
				'/api/v1/users/404',
				'/api/v1/users/1',
				'/api/v1/users/404',
			]);
		});

		it('"Always Output Data" does not invent items on the node\'s outputs when a list is empty', async () => {
			const result = await run({
				resource: 'section',
				operation: 'getAll',
				params: { courseId: fx('emptyCourseId'), options: { search_term: 'no-such-section-zzz' } },
				nodeSettings: { alwaysOutputData: true },
			});
			expect(result.ok).toBe(true);
			expect(result.error).toEqual([]);
			// n8n itself adds one empty item to the first output so the workflow goes on.
			expect(result.success).toEqual([{}]);
		});
	});

	// =====================================================================
	// c. Pagination
	// =====================================================================
	describe('c. pagination', () => {
		const large = (): string => fx('largeCourseId');
		const listEnrollments = (pagination?: Json, persona?: string): Promise<Json[]> =>
			runOk({
				resource: 'enrollment',
				operation: 'getAll',
				persona: persona ?? admin.persona,
				params: { listBy: 'course', courseId: large(), ...(pagination ? { pagination } : {}) },
			});
		const ids = (list: Json[]): number[] => list.map((e) => Number(e.id));
		/** The list as Canvas has it, before and after a node run (other files enrol users meanwhile). */
		const snapshot = async (): Promise<number[]> => ids(await api.getAll<Json>(`/api/v1/courses/${large()}/enrollments`));
		const expectSameList = (got: number[], before: number[], after: number[]): void => {
			expect(new Set(got).size, 'no duplicates').toBe(got.length);
			for (const id of before.filter((x) => after.includes(x))) expect(got, `missing ${id}`).toContain(id);
			for (const id of got) expect(before.includes(id) || after.includes(id), `unexpected ${id}`).toBe(true);
		};

		it('the enrollments of a large course are a bookmark-paginated list of more than 200 records', async () => {
			const first = await api.request('GET', `/api/v1/courses/${large()}/enrollments?per_page=10`);
			expect(first.headers.get('link')).toMatch(/page=bookmark:[^&>]+[^>]*>; rel="next"/);
			expect((await snapshot()).length).toBeGreaterThan(200);
		});

		it('defaults: 10 per page, 5 pages, so exactly the first 50', async () => {
			const before = await snapshot();
			const listed = await listEnrollments();
			expect(listed).toHaveLength(50);
			expect(new Set(ids(listed)).size).toBe(50);
			const after = await snapshot();
			for (const id of ids(listed)) expect(before.includes(id) || after.includes(id)).toBe(true);
		});

		it('perPage 100 with the default page cap, maxPages 0, and returnAll each return the whole list', async () => {
			const before = await snapshot();
			const [hundred, unlimited, all] = await Promise.all([
				listEnrollments({ perPage: 100 }),
				listEnrollments({ perPage: 40, maxPages: 0 }),
				listEnrollments({ returnAll: true }),
			]);
			const after = await snapshot();
			expectSameList(ids(hundred), before, after);
			expectSameList(ids(unlimited), before, after);
			expectSameList(ids(all), before, after);
			expect(all.length).toBeGreaterThan(200);
		});

		it('returnAll wins over maxPages; a page size above 100 is capped at Canvas\' maximum', async () => {
			const before = await snapshot();
			const all = await listEnrollments({ returnAll: true, perPage: 60, maxPages: 1 });
			const after = await snapshot();
			expectSameList(ids(all), before, after);

			const capped = await listEnrollments({ perPage: 250, maxPages: 1 });
			expect(capped).toHaveLength(100);
			const tiny = await listEnrollments({ perPage: 3, maxPages: 2 });
			expect(tiny).toHaveLength(6);
			// Page size below 1 falls back to one record per page.
			const zero = await listEnrollments({ perPage: 0, maxPages: 2 });
			expect(zero).toHaveLength(2);
		});

		it('the request the node sends: per_page from the options, later pages from Canvas\' own next link', async () => {
			let page = 0;
			stub.reset((request): StubResponse | undefined => {
				if (!request.path.endsWith('/enrollments')) return undefined;
				page++;
				const headers: Record<string, string> = {};
				if (page < 3) {
					headers.link = `<https://canvas.example.invalid${request.path}?page=bookmark:OPAQUE,${page}&per_page=2&state[]=active>; rel="next"`;
				}
				return { body: [{ id: page * 10 + 1 }, { id: page * 10 + 2 }], headers };
			});
			const result = await viaStub({
				resource: 'enrollment',
				operation: 'getAll',
				params: { listBy: 'course', courseId: '5', pagination: { perPage: 2, maxPages: 0 } },
			});
			expect(result.success.map((e) => e.id)).toEqual([11, 12, 21, 22, 31, 32]);
			expect(stub.calls.map((c) => c.url)).toEqual([
				'/api/v1/courses/5/enrollments?per_page=2',
				// The next link is followed as given (bookmark, commas, brackets), but on the configured host:
				// the token is never sent to the host named in a Link header.
				'/api/v1/courses/5/enrollments?page=bookmark:OPAQUE,1&per_page=2&state[]=active',
				'/api/v1/courses/5/enrollments?page=bookmark:OPAQUE,2&per_page=2&state[]=active',
			]);
			expect(stub.calls.every((c) => c.headers.authorization === `Bearer ${STUB_TOKEN}`)).toBe(true);
		});

		it('a page-number list (the teacher\'s courses) pages the same way', async () => {
			const asTeacher = new CanvasClient('teacher');
			const first = await asTeacher.request('GET', '/api/v1/courses?per_page=5');
			expect(first.headers.get('link')).toMatch(/[?&]page=2[^>]*>; rel="next"/);
			const expected = (await asTeacher.getAll<Json>('/api/v1/courses')).map((c) => Number(c.id));
			expect(expected.length).toBeGreaterThan(20);

			const threePages = await runOk({ resource: 'course', operation: 'getAll', persona: 'teacher', params: { pagination: { perPage: 5, maxPages: 3 } } });
			expect(threePages).toHaveLength(15);
			expect(new Set(threePages.map((c) => c.id)).size).toBe(15);
			const all = await runOk({ resource: 'course', operation: 'getAll', persona: 'teacher', params: { pagination: { returnAll: true, perPage: 8 } } });
			// Other files enrol the shared teacher in courses of their own while this runs: everything that
			// was there before and after must be listed, once, and nothing that was there at neither time.
			const after = (await asTeacher.getAll<Json>('/api/v1/courses')).map((c) => Number(c.id));
			const listed = all.map((c) => Number(c.id));
			expect(new Set(listed).size).toBe(listed.length);
			expect(expected.filter((id) => after.includes(id) && !listed.includes(id))).toEqual([]);
			expect(listed.filter((id) => !expected.includes(id) && !after.includes(id))).toEqual([]);
		});

		it('a list of exactly one page, an empty list, and a list Canvas does not paginate at all', async () => {
			const sections = await api.getAll<Json>(`/api/v1/courses/${large()}/sections`);
			expect(sections.length).toBeGreaterThan(1);
			expect(sections.length).toBeLessThanOrEqual(10);
			const onePage = await ok({ resource: 'section', operation: 'getAll', params: { courseId: large() } });
			expect(onePage.map((s) => s.id)).toEqual(sections.map((s) => s.id));
			// Page size equal to the number of records: still one request's worth, no duplicates, nothing lost.
			const exact = await ok({ resource: 'section', operation: 'getAll', params: { courseId: large(), pagination: { perPage: sections.length } } });
			expect(exact.map((s) => s.id)).toEqual(sections.map((s) => s.id));

			const empty = await run({ resource: 'enrollment', operation: 'getAll', params: { listBy: 'course', courseId: fx('emptyCourseId') } });
			expect(empty.ok).toBe(true);
			expect(empty.success).toEqual([]);
			expect(empty.error).toEqual([]);

			// /courses/:id/students ignores per_page and has no Link header: the options cannot cut it short.
			const students = await api.get<Json[]>(`/api/v1/courses/${large()}/students`);
			expect(students.length).toBeGreaterThan(100);
			const listed = await ok({ resource: 'course', operation: 'listStudents', params: { courseId: large(), pagination: { perPage: 5, maxPages: 1 } } });
			expect(listed.length).toBeGreaterThan(100);
		});
	});

	// =====================================================================
	// d. Rate limiting
	// =====================================================================
	describe('d. rate limiting', () => {
		/**
		 * The real Canvas throttle, on a token nobody else uses. Canvas' per-client limit overrides
		 * need a reload of its settings cache (SIGHUP), which would stop the shared development
		 * server, so the limits stay as they are and the *level* of this one token's bucket is set
		 * instead (see misc-support/throttle.ts): 600 = empty, below 0 = Canvas refuses requests until the
		 * bucket has leaked back at 10 units per second.
		 */
		let burst: DedicatedUser;
		const items = Array.from({ length: 12 }, (_, n) => ({ n }));
		const whoAmI = (params: Json, more: Partial<RunNodeOptions> = {}): Promise<RunNodeResult> =>
			runNode({ resource: 'user', operation: 'getSelf', persona: burst.persona, items, params, ...more });
		const directStatus = async (): Promise<{ status: number; text: string; remaining: number }> => {
			const res = await fetch(`${api.url}/api/v1/users/self`, { headers: { authorization: `Bearer ${burst.token}` } });
			return { status: res.status, text: await res.text(), remaining: Number(res.headers.get('x-rate-limit-remaining')) };
		};

		beforeAll(async () => {
			burst = await createDedicatedUser('throttle');
			// The bucket of this token exists once the token has been used.
			expect((await directStatus()).status).toBe(200);
			expect(await bucketLevel(burst.token)).toBeTypeOf('number');
		});

		afterAll(async () => {
			await setRemaining(burst.token, 600).catch(() => undefined);
			await removeDedicatedUser(burst);
		});

		it('Canvas reports the quota of a token and refuses requests once it is used up', async () => {
			await setRemaining(burst.token, 400);
			const fine = await directStatus();
			expect(fine.status).toBe(200);
			expect(fine.remaining).toBeGreaterThan(380);
			expect(fine.remaining).toBeLessThan(460);

			await setRemaining(burst.token, -100);
			const refused = await directStatus();
			expect(refused.status).toBe(403);
			expect(refused.text.trim()).toBe('403 Forbidden (Rate Limit Exceeded)');
			await setRemaining(burst.token, 600);
		});

		it('(1) waits while X-Rate-Limit-Remaining is below the threshold, then processes every item', async () => {
			// 180 left: 120 short of the default threshold of 300, i.e. about 12 seconds of leaking.
			await setRemaining(burst.token, 180);
			const started = Date.now();
			const waited = await whoAmI({});
			const waitedMs = Date.now() - started;
			expect(waited.ok).toBe(true);
			expect(waited.error).toEqual([]);
			expect(waited.success).toHaveLength(12);
			expect(waited.success.every((u) => u.id === Number(burst.id))).toBe(true);
			expect(paired(waited, 0)).toEqual(items.map((_, index) => index));
			expect(waitedMs).toBeGreaterThanOrEqual(11_000);

			// Same quota, threshold below it: no waiting.
			await setRemaining(burst.token, 180);
			const startedLow = Date.now();
			const direct = await whoAmI({ rateLimiting: { threshold: 100 } });
			const directMs = Date.now() - startedLow;
			expect(direct.success).toHaveLength(12);
			expect(directMs).toBeLessThan(waitedMs - 4000);
		}, 240_000);

		it('(2) a burst into a used-up quota: Canvas\' "403 Forbidden (Rate Limit Exceeded)" is retried until it passes', async () => {
			// 150 over the high water mark: Canvas refuses this token for about fifteen seconds.
			await setRemaining(burst.token, -150);
			expect((await directStatus()).status).toBe(403);
			const started = Date.now();
			const result = await whoAmI({
				rateLimiting: { threshold: 0 },
				errorHandling: { onError: 'continueWithError' },
				batchProcessing: { mode: 'batch', batchSize: 12, batchDelay: 0 },
			});
			const elapsed = Date.now() - started;
			await setRemaining(burst.token, 600);
			expect(result.ok).toBe(true);
			expect(result.success.length + result.error.length).toBe(12);

			// Canvas refuses with text/plain "403 Forbidden (Rate Limit Exceeded)". The node recognises it,
			// backs off (2 s, 4 s, 8 s, ...) and every item succeeds once the quota has recovered.
			expect(result.error).toEqual([]);
			expect(result.success).toHaveLength(12);
			expect(result.success.every((u) => u.id === Number(burst.id))).toBe(true);
			expect(paired(result, 0)).toEqual(items.map((_, index) => index));
			expect(elapsed).toBeGreaterThanOrEqual(13_000); // at least 2 s + 4 s + 8 s of backoff
		}, 240_000);

		it('(3) with the rate limit check disabled, throttled responses are still retried', async () => {
			const release = holdRemaining(burst.token, -150);
			try {
				const started = Date.now();
				const result = await whoAmI(
					{ rateLimiting: { enabled: false, maxRetries: 2 }, errorHandling: { onError: 'continueWithError' }, batchProcessing: { mode: 'individual' } },
					{ items: items.slice(0, 4) },
				);
				const elapsed = Date.now() - started;
				expect(result.success).toEqual([]);
				expect(paired(result, 1)).toEqual([0, 1, 2, 3]);
				// The quota stays used up for the whole run: every item ends as RATE_LIMITED, with Canvas'
				// own text, after two retries each (2 s + 4 s per item).
				for (const error of result.error) {
					expect(error).toMatchObject({ errorCode: 403, errorType: 'RATE_LIMITED', endpoint: '/api/v1/users/self' });
					expect(String(error.errorMessage)).toContain('Rate Limit Exceeded');
				}
				expect(elapsed).toBeGreaterThanOrEqual(4 * 6000);

				// "Retry Then Error" treats the refusal as worth retrying too (2 s + 4 s), then reports it.
				const retryStarted = Date.now();
				const retryMode = await whoAmI(
					{ rateLimiting: { enabled: false, maxRetries: 0 }, errorHandling: { onError: 'retryThenError', maxRetries: 2 } },
					{ items: items.slice(0, 1) },
				);
				expect(retryMode.error[0]).toMatchObject({ errorCode: 403, errorType: 'RATE_LIMITED' });
				expect(Date.now() - retryStarted).toBeGreaterThanOrEqual(6000);
			} finally {
				await release();
			}
			expect((await directStatus()).status).toBe(200);
		}, 240_000);

		it('(4) fails with a clear message when the quota does not recover within the retries', async () => {
			// Quota low but not used up (Canvas still answers): the pre-flight check waits, gives up, and says so.
			let release = holdRemaining(burst.token, 100);
			try {
				const started = Date.now();
				const stopped = await whoAmI({ rateLimiting: { maxRetries: 2 } });
				expect(stopped.ok).toBe(false);
				expect(stopped.success).toEqual([]);
				expect(stopped.failure?.message).toBe('Canvas rate limit quota is still below the threshold (300) after 2 retries');
				expect(stopped.failure?.description).toContain('Lower the Threshold under Rate Limiting, reduce the Batch Size, or try again later.');
				const last = Number(/Last X-Rate-Limit-Remaining: ([\d.]+)/.exec(String(stopped.failure?.description))?.[1]);
				expect(last).toBeGreaterThan(40);
				expect(last).toBeLessThan(160);
				expect(Date.now() - started).toBeGreaterThanOrEqual(6000); // waited 2 s + 4 s before giving up

				// As an Error output item when the node is told to continue.
				const perItem = await whoAmI(
					{ rateLimiting: { maxRetries: 0 }, errorHandling: { onError: 'continueWithError' } },
					{ items: items.slice(0, 3) },
				);
				expect(perItem.success).toEqual([]);
				expect(paired(perItem, 1)).toEqual([0, 1, 2]);
				for (const error of perItem.error) {
					expect(error).toMatchObject({
						errorCode: 0,
						errorType: 'RATE_LIMITED',
						errorMessage: 'Canvas rate limit quota is still below the threshold (300) after 0 retries',
						resource: 'user',
						operation: 'getSelf',
					});
				}
			} finally {
				await release();
			}

			// Quota used up (Canvas refuses): the message should be just as clear.
			release = holdRemaining(burst.token, -150);
			try {
				const stopped = await whoAmI({ rateLimiting: { maxRetries: 1 } });
				expect(stopped.ok).toBe(false);
				// The refused probe counts as "nothing left": the node waits, then gives the same clear message.
				expect(stopped.failure?.message).toBe('Canvas rate limit quota is still below the threshold (300) after 1 retries');
				expect(String(stopped.failure?.description)).toMatch(/Last X-Rate-Limit-Remaining: 0(\.0)?\b/);
			} finally {
				await release();
			}
			expect((await directStatus()).status).toBe(200);
		}, 240_000);

		it('probes: the quota is read from each response; Canvas is asked only when nothing is known or it was low', async () => {
			const quotas = [600, 250, 600, 600]; // X-Rate-Limit-Remaining on the answers to the four items
			const probeAnswers = [600, 200, 200, 500];
			let item = 0;
			let probe = 0;
			stub.reset((request): StubResponse => {
				if (request.probe) return { headers: { 'x-rate-limit-remaining': String(probeAnswers[probe++] ?? 600) }, body: { id: 1 } };
				return { headers: { 'x-rate-limit-remaining': String(quotas[item++]) }, body: { id: item } };
			});
			const result = await viaStub({
				resource: 'course',
				operation: 'delete',
				items: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
				params: { courseId: '={{ $json.id }}', batchProcessing: { mode: 'individual' } },
			});
			expect(result.error).toEqual([]);
			expect(result.success).toHaveLength(4);
			expect(stub.requests.map((r) => (r.probe ? 'probe' : r.path.split('/').pop()))).toEqual([
				'probe', // nothing known yet
				'1',
				'2', // answer says 250 left: below the threshold of 300
				'probe', // check before item 3: 200 -> sleep 2 s
				'probe', // still 200 -> sleep 4 s
				'probe', // 500 -> go on
				'3',
				'4', // 600 again: no probe
			]);
			const [lowAt, stillLowAt, recoveredAt] = [stub.requests[3].at, stub.requests[4].at, stub.requests[5].at];
			expect(stillLowAt - lowAt).toBeGreaterThanOrEqual(1900);
			expect(stillLowAt - lowAt).toBeLessThan(3500);
			expect(recoveredAt - stillLowAt).toBeGreaterThanOrEqual(3900);
			expect(recoveredAt - stillLowAt).toBeLessThan(5500);
		});

		it('throttle responses seen on the wire: 429, 403 with a JSON body, 403 as plain text; a plain 403 is no rate limit', async () => {
			const attempts: Record<string, number> = {};
			const refusal = '403 Forbidden (Rate Limit Exceeded)\n';
			stub.reset((request): StubResponse | undefined => {
				const id = request.path.split('/').pop() ?? '';
				attempts[id] = (attempts[id] ?? 0) + 1;
				const first = attempts[id] <= 2;
				switch (id) {
					case '429': // Canvas with `request_throttle.send_429_response`
						return first ? { status: 429, headers: { 'x-rate-limit-remaining': '0.0' }, body: '429 Too Many Requests (Rate Limit Exceeded)\n' } : { body: { id: 429 } };
					case '4031': // the refusal relayed as JSON (e.g. by a gateway in front of Canvas)
						return first ? { status: 403, body: { errors: [{ message: refusal.trim() }] } } : { body: { id: 4031 } };
					case '4032': // Canvas' own refusal: text/plain
						return first ? { status: 403, headers: { 'x-rate-limit-remaining': '0.0' }, body: refusal } : { body: { id: 4032 } };
					case '403':
						return { status: 403, body: { status: 'unauthorized', errors: [{ message: 'user not authorized to perform that action' }] } };
					default:
						return undefined;
				}
			});
			const result = await viaStub({
				resource: 'user',
				operation: 'get',
				items: [{ id: 429 }, { id: 4031 }, { id: 4032 }, { id: 403 }],
				params: { userId: '={{ $json.id }}', rateLimiting: { enabled: false }, errorHandling: { onError: 'continueWithError' } },
			});
			// 429 and the JSON-bodied 403 are retried (2 s, then 4 s) until they succeed.
			expect(attempts['429']).toBe(3);
			expect(attempts['4031']).toBe(3);
			const times = stub.calls.filter((c) => c.path.endsWith('/429')).map((c) => c.at);
			expect(times[1] - times[0]).toBeGreaterThanOrEqual(1900);
			expect(times[2] - times[1]).toBeGreaterThanOrEqual(3900);
			// A 403 that is about permissions is reported at once, with Canvas' message.
			expect(attempts['403']).toBe(1);
			expect(result.error.find((e) => (e.originalItem as Json).id === 403)).toMatchObject({
				errorCode: 403,
				errorType: 'FORBIDDEN',
				errorMessage: 'user not authorized to perform that action',
			});
			// The plain-text refusal, which is what Canvas sends by default, is retried exactly like the two above.
			expect(attempts['4032']).toBe(3);
			expect(result.success.map((u) => u.id)).toEqual([429, 4031, 4032]);
			expect(result.error).toHaveLength(1);

			// Retries used up on 429: reported as rate limited, with the status Canvas sent.
			stub.reset(() => ({ status: 429, body: '429 Too Many Requests (Rate Limit Exceeded)\n' }));
			const exhausted = await viaStub({
				resource: 'user',
				operation: 'get',
				params: { userId: '7', rateLimiting: { enabled: false, maxRetries: 1 }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(stub.calls).toHaveLength(2);
			expect(exhausted.error[0]).toMatchObject({ errorCode: 429, errorType: 'RATE_LIMITED' });
			expect(String(exhausted.error[0].errorMessage)).toContain('429 Too Many Requests (Rate Limit Exceeded)');
		}, 120_000);
	});

	// =====================================================================
	// e. Expressions and odd inputs
	// =====================================================================
	describe('e. expressions and odd inputs', () => {
		it('IDs as numbers, with stray whitespace, and as SIS IDs all reach the same record', async () => {
			const courses = await run({
				resource: 'course',
				operation: 'get',
				items: [
					{ id: Number(course.id) },
					{ id: `  ${course.id}\t\n` },
					{ id: `sis_course_id:${course.sisId}` },
					{ id: ` sis_course_id:${course.sisId} ` },
					{ id: `sis_course_id:${fx('courseSisId')}` },
				],
				params: { courseId: '={{ $json.id }}' },
			});
			expect(courses.error).toEqual([]);
			expect(courses.success.map((c) => c.id)).toEqual([...Array<number>(4).fill(Number(course.id)), Number(fx('courseId'))]);

			const users = await run({
				resource: 'user',
				operation: 'get',
				items: [
					{ id: Number(fx('studentUserId')) },
					{ id: `sis_user_id:${fx('studentSisUserId')}` },
					{ id: `sis_login_id:${fx('studentLoginId')}` },
					{ id: 'self' },
				],
				params: { userId: '={{ $json.id }}' },
			});
			expect(users.error).toEqual([]);
			expect(users.success.map((u) => u.id)).toEqual([
				Number(fx('studentUserId')),
				Number(fx('studentUserId')),
				Number(fx('studentUserId')),
				Number(admin.id),
			]);
		});

		it('SIS IDs with characters that need URL encoding', async () => {
			const odd: Array<{ label: string; sis: string; id?: number }> = [
				{ label: 'space', sis: uniqueSisId('XC A').replace('_', ' ') },
				{ label: 'plus and ampersand', sis: uniqueSisId('XC+B&C') },
				{ label: 'colon and semicolon', sis: uniqueSisId('XC:D;E') },
				{ label: 'slash', sis: uniqueSisId('XC/F') },
				{ label: 'hash', sis: uniqueSisId('XC#G') },
				{ label: 'question mark', sis: uniqueSisId('XC?H') },
				{ label: 'percent', sis: uniqueSisId('XC%I') },
				{ label: 'percent that looks like an escape', sis: uniqueSisId('XC%41J') },
			];
			for (const entry of odd) {
				const user = await api.post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
					user: { name: `Odd SIS ${entry.label}`, skip_registration: true },
					pseudonym: { unique_id: `xc.odd.${entry.sis.replace(/[^a-z0-9]/gi, '').toLowerCase()}@example.edu`, sis_user_id: entry.sis, send_confirmation: false },
				});
				entry.id = Number(user.id);
			}
			try {
				// The seeded user with slash, colon and semicolon in its SIS ID is one of them.
				odd.push({ label: 'seeded odd user', sis: fx('oddSisUserSisId'), id: Number(fx('oddSisUserId')) });

				const asGiven = await run({
					resource: 'user',
					operation: 'get',
					items: odd.map((o) => ({ label: o.label, user: `sis_user_id:${o.sis}` })),
					params: { userId: '={{ $json.user }}', errorHandling: { onError: 'continueWithError' } },
				});
				const outcome = Object.fromEntries(odd.map((o) => [o.label, 'missing']));
				for (const [index, item] of raw(asGiven, 0).entries()) {
					const label = odd[paired(asGiven, 0)[index]].label;
					outcome[label] = item.json.id === odd[paired(asGiven, 0)[index]].id ? 'found' : `WRONG USER ${String(item.json.id)}`;
				}
				for (const error of asGiven.error) outcome[String((error.originalItem as Json).label)] = `error ${String(error.errorCode)}`;
				expect(outcome).toEqual({
					space: 'found',
					'plus and ampersand': 'found',
					'colon and semicolon': 'found',
					// IDs are percent-encoded where they form a path segment.
					percent: 'found',
					slash: 'found',
					hash: 'found',
					'question mark': 'found',
					'seeded odd user': 'found',
					// A value that already looks percent-encoded is passed on as it is (so IDs encoded by hand
					// keep working); an ID that really contains "%41" therefore has to be written as "%2541".
					'percent that looks like an escape': 'error 404',
				});

				// IDs encoded by hand are not encoded a second time: every one of them is found.
				const encoded = await run({
					resource: 'user',
					operation: 'get',
					items: odd.map((o) => ({ user: `sis_user_id:${encodeURIComponent(o.sis)}` })),
					params: { userId: '={{ $json.user }}', errorHandling: { onError: 'continueWithError' } },
				});
				expect(encoded.error).toEqual([]);
				expect(encoded.success.map((u) => u.id)).toEqual(odd.map((o) => o.id));

				// In query parameters such text is safe: the node encodes those itself.
				const tricky = 'A B/C#D?E%F&G=H+I[]"\'é';
				stub.reset(() => ({ body: [] }));
				await viaStub({ resource: 'course', operation: 'listStudents', params: { courseId: '5', options: { search_term: tricky } } });
				const query = new URL(`${stub.url}${stub.calls[0].url}`).searchParams;
				expect(query.get('search_term')).toBe(tricky);
				expect(stub.calls[0].path).toBe('/api/v1/courses/5/users');
			} finally {
				for (const entry of odd.slice(0, 8)) {
					if (entry.id) await api.request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${entry.id}`).catch(() => undefined);
				}
			}
		}, 300_000);

		it('an expression that is empty for one item fails that item only, with a clear message', async () => {
			const items = [{ id: course.id }, { id: '' }, { id: null }, { other: 1 }, { id: '   ' }, { id: course.id }];
			const result = await run({
				resource: 'course',
				operation: 'get',
				items,
				params: { courseId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.ok).toBe(true);
			expect(result.success.map((c) => c.id)).toEqual([Number(course.id), Number(course.id)]);
			expect(paired(result, 0)).toEqual([0, 5]);
			expect(paired(result, 1)).toEqual([1, 2, 3, 4]);
			for (const error of result.error) {
				expect(error).toMatchObject({
					errorCode: 0,
					errorType: 'INVALID_PARAMETERS',
					errorMessage: 'A required parameter is empty for course/get',
					resource: 'course',
					operation: 'get',
				});
			}

			// In Stop mode the workflow fails on that item, naming the parameter to look at.
			const stopped = await run({ resource: 'course', operation: 'get', items, params: { courseId: '={{ $json.id }}', batchProcessing: { mode: 'individual' } } });
			expect(stopped.ok).toBe(false);
			expect(stopped.failure?.message).toBe('A required parameter is empty for course/get');
			expect(stopped.failure?.description).toContain('The request path "/api/v1/courses/" has an empty segment.');
			expect(stopped.failure?.description).toContain('Check these parameters: courseId.');
			expect((stopped.failure?.raw.context as Json).itemIndex).toBe(1);

			// "." and ".." would move the request to another path: refused before anything is sent.
			stub.reset();
			const relative = await viaStub({
				resource: 'course',
				operation: 'delete',
				items: [{ id: '..' }, { id: '.' }, { id: '../accounts/1' }],
				params: { courseId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
			});
			expect(relative.error.map((e) => e.errorType)).toEqual(['INVALID_PARAMETERS', 'INVALID_PARAMETERS']);
			expect(String(relative.error[0].errorMessage)).toContain('not a valid ID');
			// A value with a slash is one (encoded) path segment, so it cannot leave its place either.
			expect(stub.calls.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE /api/v1/courses/..%2Faccounts%2F1?event=delete']);

			// Nothing was sent for the empty items: no request ever goes to a path with an empty segment.
			stub.reset();
			await viaStub({
				resource: 'course',
				operation: 'delete',
				items: [{ id: '' }, { id: 5 }],
				params: { courseId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
			});
			expect(stub.calls.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE /api/v1/courses/5?event=delete']);
		});

		it('a validation error raised by a handler is reported once, as a parameter problem', async () => {
			const started = Date.now();
			const result = await run({
				resource: 'bookmark',
				operation: 'create',
				params: { name: 'x', url: '/x', additionalFields: { data: '{broken' }, errorHandling: { onError: 'retryThenError', maxRetries: 1 } },
			});
			const elapsed = Date.now() - started;
			expect(result.success).toEqual([]);
			expect(String(result.error[0].errorMessage)).toContain('must be valid JSON');
			// Nothing was sent and nothing can change: not retried, although the mode is Retry Then Error.
			expect(result.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
			expect(elapsed).toBeLessThan(2000);
		});

		it('Unicode, emoji, right-to-left text and markup survive the round trip', async () => {
			const names = [
				'Ünïcødé — naïve café ½ ß ẞ',
				'课程 日本語 한국어 ภาษาไทย',
				'مرحبا بالعالم — שלום עולם',
				'🎓📚 👩🏽‍🏫 🇸🇪 emoji with modifiers and joiners',
				'e\u0301 combining + zero\u200bwidth + \u202eRLO',
				'"double" \'single\' `back` & <b>tags</b> \\ back/slash %41 %',
			];
			const result = await run({
				resource: 'course',
				operation: 'update',
				items: names.map((name) => ({ name })),
				params: { courseId: course.id, updateFields: { name: '={{ $json.name }}', public_description: '={{ $json.name }}' }, batchProcessing: { mode: 'individual' } },
			});
			expect(result.error).toEqual([]);
			expect(result.success.map((c) => c.name)).toEqual(names);
			const actual = await api.get<Json>(`/api/v1/courses/${course.id}?include[]=public_description`);
			expect(actual.name).toBe(names[names.length - 1]);
			expect(actual.public_description).toBe(names[names.length - 1]);
		});

		it('a 100 KB body is sent and stored intact', async () => {
			const paragraph = '<p>Syllabus paragraph with ünïcødé, 数字 and an &amp; entity. Lorem ipsum dolor sit amet.</p>\n';
			const body = paragraph.repeat(Math.ceil(100_000 / Buffer.byteLength(paragraph)));
			expect(Buffer.byteLength(body)).toBeGreaterThanOrEqual(100_000);
			const [updated] = await ok({
				resource: 'course',
				operation: 'update',
				params: { courseId: course.id, updateFields: { syllabus_body: body } },
			});
			expect(updated.id).toBe(Number(course.id));
			const stored = String((await api.get<Json>(`/api/v1/courses/${course.id}?include[]=syllabus_body`)).syllabus_body);
			const digest = (text: string): string => createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
			expect(stored.length).toBeGreaterThanOrEqual(body.length - paragraph.length);
			expect(digest(stored)).toBe(digest(body));
		});

		it('date-times keep their instant: Z, offsets, and values without a zone', async () => {
			// The acting user's time zone decides what a value without a zone means.
			await api.put(`/api/v1/users/${admin.id}`, { user: { time_zone: 'Asia/Kolkata' } });
			// Canvas only stores a course end date while the course restricts enrollments to its dates.
			await api.put(`/api/v1/courses/${course.id}`, { course: { restrict_enrollments_to_course_dates: true } });
			const result = await run({
				resource: 'course',
				operation: 'update',
				items: [
					{ start: '2031-01-15T08:00:00Z', end: '2031-06-30T23:59:00Z', expected: ['2031-01-15T08:00:00Z', '2031-06-30T23:59:00Z'] },
					{ start: '2031-01-15T08:00:00+05:30', end: '2031-06-30T23:59:00-07:00', expected: ['2031-01-15T02:30:00Z', '2031-07-01T06:59:00Z'] },
					{ start: '2031-01-15T08:00:00.000+02:00', end: '2031-06-30T12:00:00.000-04:00', expected: ['2031-01-15T06:00:00Z', '2031-06-30T16:00:00Z'] },
					// As produced by n8n's date picker: no zone. Canvas reads it in the user's zone (UTC+5:30).
					{ start: '2031-01-15T08:00:00', end: '2031-06-30T23:59:00', expected: ['2031-01-15T02:30:00Z', '2031-06-30T18:29:00Z'] },
				],
				params: { courseId: course.id, updateFields: { start_at: '={{ $json.start }}', end_at: '={{ $json.end }}' }, batchProcessing: { mode: 'individual' } },
			});
			expect(result.error).toEqual([]);
			expect(result.success.map((c) => [c.start_at, c.end_at])).toEqual([
				['2031-01-15T08:00:00Z', '2031-06-30T23:59:00Z'],
				['2031-01-15T02:30:00Z', '2031-07-01T06:59:00Z'],
				['2031-01-15T06:00:00Z', '2031-06-30T16:00:00Z'],
				['2031-01-15T02:30:00Z', '2031-06-30T18:29:00Z'],
			]);
			expect(await api.get<Json>(`/api/v1/courses/${course.id}`)).toMatchObject({ start_at: '2031-01-15T02:30:00Z', end_at: '2031-06-30T18:29:00Z' });

			// A Luxon DateTime from an expression is serialised with its offset.
			const [fromLuxon] = await ok({
				resource: 'course',
				operation: 'update',
				params: { courseId: course.id, updateFields: { start_at: '={{ DateTime.fromISO("2031-02-01T09:00:00", { zone: "America/Chicago" }) }}' } },
			});
			expect(fromLuxon.start_at).toBe('2031-02-01T15:00:00Z');
		});
	});

	// =====================================================================
	// f. Debug mode
	// =====================================================================
	describe('f. debug mode', () => {
		it('output goes to the third output only, one item per input item, and nothing is sent', async () => {
			stub.reset();
			const result = await viaStub({
				resource: 'course',
				operation: 'delete',
				items: [{ id: 11 }, { id: 12 }, { id: 13 }],
				params: { debugMode: true, courseId: '={{ $json.id }}' },
			});
			expect(result.ok).toBe(true);
			expect(outputSizes(result)).toEqual([0, 0, 3]);
			expect(paired(result, 2)).toEqual([0, 1, 2]);
			expect(result.debug.map((d) => d.url)).toEqual([11, 12, 13].map((id) => `${stub.url}/api/v1/courses/${id}?event=delete`));
			expect(result.debug[0]).toMatchObject({ resource: 'course', operation: 'delete', method: 'DELETE', queryString: { event: 'delete' }, body: {} });
			// Not even the quota probe.
			expect(stub.requests).toEqual([]);
		});

		it('on the real Canvas: a destructive operation in debug mode changes nothing', async () => {
			const before = await api.get<Json>(`/api/v1/courses/${course.id}`);
			const result = await run({
				resource: 'course',
				operation: 'delete',
				params: { debugMode: true, courseId: course.id },
			});
			expect(outputSizes(result)).toEqual([0, 0, 1]);
			expect(result.debug[0]).toMatchObject({ method: 'DELETE', url: `${api.url}/api/v1/courses/${course.id}?event=delete` });
			const after = await api.get<Json>(`/api/v1/courses/${course.id}`);
			expect(after.workflow_state).toBe(before.workflow_state);
			expect(after.workflow_state).not.toBe('deleted');
		});

		it('the URL, body and curl shown are what a real run sends', async () => {
			const cases: Array<{ resource: string; operation: string; params: Json; get?: boolean }> = [
				{ resource: 'course', operation: 'update', params: { courseId: 'sis_course_id:ABC', updateFields: { name: 'Näme "q" \'s\' & <b>', start_at: '2031-01-15T08:00:00+05:30', is_public: true } } },
				{ resource: 'bookmark', operation: 'create', params: { name: 'B', url: '/courses/1?x=1&y=2', additionalFields: { data: '{"a":[1,2]}', position: 2 } } },
				{ resource: 'planner', operation: 'createNote', params: { title: 'T', todoDate: '2027-03-10T09:30:00', additionalFields: { details: 'line 1\nline 2', course_id: '5' } } },
				{ resource: 'ePortfolio', operation: 'moderate', params: { ePortfolioId: '9', spamStatus: 'marked_as_spam' } },
				{ resource: 'favorite', operation: 'addCourse', params: { courseId: 'sis_course_id:A B/C#D?E%F' } },
				{ resource: 'bookmark', operation: 'delete', params: { bookmarkId: '5' } },
				{ resource: 'planner', operation: 'getAllItems', get: true, params: { options: { start_date: '2026-01-01', context_codes: 'course_1, course_2', include: ['concluded'], filter: 'incomplete_items' } } },
				{ resource: 'course', operation: 'get', get: true, params: { courseId: '7', options: { include: ['term', 'teachers'], teacher_limit: 3 } } },
			];
			for (const { resource, operation, params, get } of cases) {
				const label = `${resource}.${operation}`;
				stub.reset();
				const debug = await viaStub({ resource, operation, params: { ...params, debugMode: true } });
				expect(stub.requests, label).toEqual([]);
				const shown = debug.debug[0];
				expect(shown, label).toBeDefined();

				stub.reset();
				await viaStub({ resource, operation, params });
				expect(stub.calls, label).toHaveLength(1);
				const sent = stub.calls[0];

				expect(shown.method, label).toBe(sent.method);
				expect(sent.headers.authorization, label).toBe(`Bearer ${STUB_TOKEN}`);
				expect(sent.body ? JSON.parse(sent.body) : {}, label).toEqual(shown.body);
				const curl = String(shown.curl);
				expect(curl, label).toContain(`-X ${sent.method}`);
				expect(curl, label).toContain("-H 'Authorization: Bearer <ACCESS_TOKEN>'");
				if (sent.body) {
					expect(sent.headers['content-type'], label).toMatch(/^application\/json/);
					expect(curl, label).toContain("-H 'Content-Type: application/json'");
					// The -d argument, undone from its shell quoting, is the body that was sent.
					const data = /-d '((?:[^']|'\\'')*)'/.exec(curl)?.[1].replace(/'\\''/g, "'");
					expect(JSON.parse(String(data)), label).toEqual(JSON.parse(sent.body));
				} else {
					expect(curl, label).not.toContain('-d ');
				}
				// Including per_page on GET requests: the debug URL reproduces the real run exactly.
				expect(`${stub.url}${sent.url}`, label).toBe(shown.url);
				if (get) {
					expect(String(shown.url), label).toContain('per_page=10');
				}
				expect(curl.endsWith(`'${String(shown.url)}'`), label).toBe(true);
			}
		});

		it('tokens never appear in the debug output', async () => {
			stub.reset();
			const viaStubDebug = await viaStub({
				resource: 'bookmark',
				operation: 'create',
				params: { debugMode: true, name: 'B', url: '/x' },
			});
			expect(JSON.stringify(viaStubDebug.execution.raw)).not.toContain(STUB_TOKEN);

			const real = await run({ resource: 'user', operation: 'getSelf', params: { debugMode: true } });
			const everything = JSON.stringify(real.execution.raw);
			expect(everything).not.toContain(admin.token);
			expect(String(real.debug[0].curl)).toContain('Bearer <ACCESS_TOKEN>');
			// Nor in the data of a normal run or of a failed one.
			const normal = await run({ resource: 'user', operation: 'getSelf' });
			expect(JSON.stringify(normal.execution.raw)).not.toContain(admin.token);
			const failed = await run({ resource: 'course', operation: 'get', params: { courseId: '999999999' } });
			expect(failed.ok).toBe(false);
			expect(JSON.stringify(failed.execution.raw)).not.toContain(admin.token);
		});

		it('an item no request can be built for follows the error mode in debug mode too', async () => {
			const params = { debugMode: true, courseId: '={{ $json.id }}' };
			const items = [{ id: 1 }, { id: '' }, { id: 3 }];

			// Stop (default): the node fails and says which item.
			const stopped = await run({ resource: 'course', operation: 'get', items, params });
			expect(stopped.ok).toBe(false);
			expect(stopped.failure?.message).toBe('A required parameter is empty for course/get');
			expect((stopped.failure?.raw.context as Json).itemIndex).toBe(1);

			// Continue: the other items are shown, the unusable one arrives on the Error output.
			const continued = await run({
				resource: 'course',
				operation: 'get',
				items,
				params: { ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(continued.ok).toBe(true);
			expect(continued.success).toEqual([]);
			expect(continued.debug.map((d) => String(d.url).replace(/^.*\/api/, '/api'))).toEqual([
				'/api/v1/courses/1?per_page=10',
				'/api/v1/courses/3?per_page=10',
			]);
			expect(paired(continued, 2)).toEqual([0, 2]);
			expect(paired(continued, 1)).toEqual([1]);
			expect(continued.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'course', operation: 'get' });
		});
	});

	// =====================================================================
	// g. Personas and credentials
	// =====================================================================
	describe('g. personas and credentials', () => {
		it('the same operation returns what each persona is allowed to see', async () => {
			const personas = ['teacher', 'student', 'observer'];
			const includes = ['permissions', 'total_students', 'sections'];
			const query = `/api/v1/courses/${fx('courseId')}?${includes.map((i) => `include[]=${i}`).join('&')}`;
			const seen: Record<string, Json> = {};
			for (const persona of [admin.persona, ...personas]) {
				const [viaNode] = await runOk({
					resource: 'course',
					operation: 'get',
					persona,
					params: { courseId: fx('courseId'), options: { include: includes } },
				});
				const direct = await new CanvasClient(persona).get<Json>(query);
				// The node passes on exactly what Canvas gives this user.
				expect(Object.keys(viaNode).sort(), persona).toEqual(Object.keys(direct).sort());
				expect(viaNode.id, persona).toBe(Number(fx('courseId')));
				expect(viaNode.permissions, persona).toEqual(direct.permissions);
				seen[persona] = viaNode;
			}
			const enrollmentTypes = (persona: string): string[] => ((seen[persona].enrollments ?? []) as Json[]).map((e) => String(e.type));
			expect(enrollmentTypes('teacher')).toEqual(['teacher']);
			expect(enrollmentTypes('student')).toEqual(['student']);
			// One observer enrollment per observed student.
			expect(enrollmentTypes('observer').length).toBeGreaterThanOrEqual(1);
			expect(new Set(enrollmentTypes('observer'))).toEqual(new Set(['observer']));
			expect(enrollmentTypes(admin.persona)).toEqual([]);
			// SIS identifiers are for those who may read SIS data.
			expect(seen[admin.persona].sis_course_id).toBe(fx('courseSisId'));
			expect(seen.student).not.toHaveProperty('sis_course_id');
			expect(seen.observer).not.toHaveProperty('sis_course_id');
			// What each may do differs too.
			const permission = (persona: string, name: string): unknown => (seen[persona].permissions as Json)[name];
			expect(Object.keys(seen[admin.persona].permissions as Json).length).toBeGreaterThan(0);
			for (const persona of ['student', 'observer']) {
				for (const name of Object.keys(seen[persona].permissions as Json)) {
					if (permission(persona, name) === true) expect(permission(admin.persona, name), name).toBe(true);
				}
			}
		});

		it('what a persona may not see or do arrives as a clear error', async () => {
			// An unpublished course: staff see it, a student of it does not.
			const unpublished = fx('unpublishedCourseId');
			const outcomes: Record<string, string> = {};
			for (const persona of [admin.persona, 'student', 'observer']) {
				const direct = await new CanvasClient(persona).request('GET', `/api/v1/courses/${unpublished}`);
				const result = await runNode({
					resource: 'course',
					operation: 'get',
					persona,
					params: { courseId: unpublished, errorHandling: { onError: 'continueWithError' } },
				});
				outcomes[persona === admin.persona ? 'admin' : persona] = result.success.length ? 'ok' : `${String(result.error[0].errorCode)} ${String(result.error[0].errorType)}`;
				expect(result.success.length ? 200 : result.error[0].errorCode, persona).toBe(direct.status);
			}
			expect(outcomes.admin).toBe('ok');
			expect(outcomes.student).toMatch(/^(401 UNAUTHORIZED|403 FORBIDDEN|404 NOT_FOUND)$/);
			expect(outcomes.observer).toMatch(/^(401 UNAUTHORIZED|403 FORBIDDEN|404 NOT_FOUND)$/);

			// Writing: only the admin may rename the battery's own course; a student of another course may not.
			const denied = await runNode({
				resource: 'course',
				operation: 'update',
				persona: 'student',
				params: { courseId: course.id, updateFields: { course_code: 'HACKED' }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(denied.success).toEqual([]);
			expect(denied.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'course', operation: 'update' });
			expect(String(denied.error[0].errorMessage)).toMatch(/\S/);
			expect((await api.get<Json>(`/api/v1/courses/${course.id}`)).course_code).not.toBe('HACKED');
		});

		it('an invalid token is reported as UNAUTHORIZED with Canvas\' message', async () => {
			await registerCredential('invalid-token', { canvasUrl: canvas().url, accessToken: 'this-is-not-a-valid-canvas-token' });
			try {
				const result = await runNode({
					resource: 'user',
					operation: 'getSelf',
					persona: 'invalid-token',
					params: { errorHandling: { onError: 'continueWithError' } },
				});
				expect(result.success).toEqual([]);
				expect(result.error[0]).toMatchObject({
					errorCode: 401,
					errorType: 'UNAUTHORIZED',
					errorMessage: 'Invalid access token.',
					endpoint: '/api/v1/users/self',
				});
				expect(JSON.stringify(result.execution.raw)).not.toContain('this-is-not-a-valid-canvas-token');

				// Not retried by "Retry Then Error", and fatal with the same message in Stop mode.
				const started = Date.now();
				const retried = await runNode({
					resource: 'user',
					operation: 'getSelf',
					persona: 'invalid-token',
					params: { errorHandling: { onError: 'retryThenError', maxRetries: 3 } },
				});
				expect(retried.error[0]).toMatchObject({ errorCode: 401, errorType: 'UNAUTHORIZED' });
				expect(Date.now() - started).toBeLessThan(15_000);

				const stopped = await runNode({ resource: 'user', operation: 'getSelf', persona: 'invalid-token' });
				expect(stopped.ok).toBe(false);
				expect(stopped.failure).toMatchObject({
					message: 'Invalid access token.',
					description: 'UNAUTHORIZED error (HTTP 401) on user/getSelf (/api/v1/users/self)',
					httpCode: '401',
				});
			} finally {
				await removeCredential('invalid-token');
			}
		});

		it('a Canvas URL nothing listens on is a NETWORK_ERROR; one that is not Canvas a NOT_FOUND', async () => {
			await registerCredential('dead-host', { canvasUrl: 'http://127.0.0.1:9', accessToken: 'irrelevant' });
			try {
				const result = await runNode({
					resource: 'user',
					operation: 'getSelf',
					persona: 'dead-host',
					params: { errorHandling: { onError: 'continueWithError' } },
				});
				expect(result.success).toEqual([]);
				expect(result.error[0]).toMatchObject({ errorCode: 0, resource: 'user', operation: 'getSelf', endpoint: '/api/v1/users/self' });
				expect(String(result.error[0].errorMessage)).toMatch(/ECONNREFUSED|refused|offline/i);
				expect(result.error[0].errorType).toBe('NETWORK_ERROR');

				const stopped = await runNode({ resource: 'user', operation: 'getSelf', persona: 'dead-host' });
				expect(stopped.ok).toBe(false);
				expect(`${stopped.failure?.message} ${stopped.failure?.description}`).toMatch(/ECONNREFUSED|refused|offline/i);
				expect(stopped.failure?.description).toContain('error on user/getSelf (/api/v1/users/self)');

				// A connection failure is worth another try: "Retry Then Error" waits and tries again.
				const started = Date.now();
				const retried = await runNode({
					resource: 'user',
					operation: 'getSelf',
					persona: 'dead-host',
					params: { rateLimiting: { enabled: false }, errorHandling: { onError: 'retryThenError', maxRetries: 1 } },
				});
				expect(retried.error).toHaveLength(1);
				expect(Date.now() - started).toBeGreaterThanOrEqual(2000);

				// A write that never left (connection refused) is safe to repeat as well.
				const startedWrite = Date.now();
				const write = await runNode({
					resource: 'bookmark',
					operation: 'create',
					persona: 'dead-host',
					params: { name: 'x', url: '/x', rateLimiting: { enabled: false }, errorHandling: { onError: 'retryThenError', maxRetries: 1 } },
				});
				expect(write.error[0]).toMatchObject({ errorCode: 0, errorType: 'NETWORK_ERROR' });
				expect(Date.now() - startedWrite).toBeGreaterThanOrEqual(2000);
			} finally {
				await removeCredential('dead-host');
			}

			// Something answers, but it is not Canvas.
			stub.reset(() => ({ status: 404, body: '<html><body><h1>Not Found</h1></body></html>' }));
			const notCanvas = await viaStub({ resource: 'user', operation: 'getSelf', params: { errorHandling: { onError: 'continueWithError' } } });
			expect(notCanvas.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
			expect(String(notCanvas.error[0].errorMessage)).not.toContain('<html>');
		});

		it('a Canvas URL that is no URL is refused before any request', async () => {
			await registerCredential('no-scheme', { canvasUrl: 'localhost:3000', accessToken: 'irrelevant' });
			try {
				const result = await runNode({
					resource: 'user',
					operation: 'getSelf',
					persona: 'no-scheme',
					params: { errorHandling: { onError: 'continueWithError' } },
				});
				expect(result.success).toEqual([]);
				expect(result.error[0]).toMatchObject({
					errorCode: 0,
					errorType: 'INVALID_PARAMETERS',
					errorMessage: 'The Canvas URL in the credentials is not valid',
				});
			} finally {
				await removeCredential('no-scheme');
			}

			// A trailing slash or surrounding whitespace in the URL is tolerated.
			await registerCredential('sloppy-url', { canvasUrl: `  ${stub.url}//  `, accessToken: STUB_TOKEN });
			try {
				stub.reset();
				const result = await runNode({ resource: 'course', operation: 'delete', persona: 'sloppy-url', params: { courseId: '7', rateLimiting: { enabled: false } } });
				expect(result.ok).toBe(true);
				expect(stub.calls.map((c) => c.url)).toEqual(['/api/v1/courses/7?event=delete']);
			} finally {
				await removeCredential('sloppy-url');
			}
		});
	});
});
