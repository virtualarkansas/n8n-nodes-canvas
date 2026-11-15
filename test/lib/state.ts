import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Local, git-ignored description of the test environment: where n8n and Canvas
 * live, which credentials exist, and the IDs of seeded fixtures.
 * Written by `test/env/n8n/bootstrap.ts` and `test/env/canvas/seed`.
 */
export interface TestState {
	n8n: {
		url: string;
		apiKey: string;
		/** n8n credential IDs keyed by persona (admin, teacher, student, ...) */
		credentials: Record<string, { id: string; name: string; type: string }>;
	};
	canvas: {
		url: string;
		/** Canvas API tokens keyed by persona */
		tokens: Record<string, string>;
		/** IDs of seeded records (accountId, courseId, ...) */
		fixtures: Record<string, string | number>;
	};
	/**
	 * Extra tokens and credentials of the seeded personas, one set per parallel test
	 * worker (keyed by VITEST_POOL_ID). Canvas throttles per token, so test files that
	 * run side by side must not share one. Written by `test/env/n8n/bootstrap.ts`.
	 */
	pool?: Record<string, PoolEntry>;
}

export interface PoolEntry {
	tokens: Record<string, string>;
	credentials: Record<string, { id: string; name: string; type: string }>;
}

/** This worker's own tokens and credentials, when the pool has a set for it. */
export function workerPool(state: TestState): PoolEntry | undefined {
	return state.pool?.[process.env.VITEST_POOL_ID ?? ''];
}

export const STATE_PATH = resolve(
	process.env.CANVAS_TEST_STATE ?? resolve(__dirname, '..', '.state.json'),
);

export function loadState(): TestState {
	if (!existsSync(STATE_PATH)) {
		throw new Error(
			`Test state not found at ${STATE_PATH}. Start the environment first (see test/env/README.md).`,
		);
	}
	return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as TestState;
}

export function saveState(state: TestState): void {
	writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

export function updateState(mutate: (state: TestState) => void): TestState {
	const state: TestState = existsSync(STATE_PATH)
		? loadState()
		: {
				n8n: { url: 'http://localhost:5678', apiKey: '', credentials: {} },
				canvas: { url: 'http://localhost:3000', tokens: {}, fixtures: {} },
			};
	mutate(state);
	saveState(state);
	return state;
}
