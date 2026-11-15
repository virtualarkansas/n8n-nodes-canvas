import { expect } from 'vitest';
import { runNode as baseRunNode } from '../../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../../lib/harness';
import type { Json } from '../../lib/n8n';

/**
 * Helpers shared by the tests of the account / auth / SIS resources.
 * (Runs the node abandoned on the rate-limit quota before sending anything are
 * repeated by the harness itself.)
 */
export const runNode = (opts: RunNodeOptions): Promise<RunNodeResult> => baseRunNode(opts);

/** Run and require success; returns the Success output items. Throws with full context otherwise. */
export async function runOk(opts: RunNodeOptions): Promise<Json[]> {
	const result = await runNode(opts);
	if (!result.ok || result.error.length > 0) {
		throw new Error(
			`${opts.resource}.${opts.operation} failed: ` +
				JSON.stringify(result.failure ?? result.error, null, 2).slice(0, 2000) +
				`\nparams: ${JSON.stringify(opts.params ?? {})}`,
		);
	}
	return result.success;
}

/** Numeric IDs of records, sorted. */
export const ids = (items: Json[]): number[] => items.map((item) => Number(item.id)).sort((a, b) => a - b);

/**
 * Other workers create and delete records on the shared Canvas while a test
 * runs. A listing is correct when it holds everything that existed both before
 * and after the node ran, nothing that existed at neither moment, and no
 * duplicates.
 */
export function expectSameIds(listed: Json[], before: Json[], after: Json[]): void {
	const listedIds = new Set(ids(listed));
	const beforeIds = new Set(ids(before));
	const afterIds = new Set(ids(after));
	const stable = [...beforeIds].filter((id) => afterIds.has(id));
	expect(
		stable.filter((id) => !listedIds.has(id)),
		'records missing from the node output',
	).toEqual([]);
	expect(
		[...listedIds].filter((id) => !beforeIds.has(id) && !afterIds.has(id)),
		'records the node returned that Canvas does not list',
	).toEqual([]);
	expect(listedIds.size, 'duplicates in the node output').toBe(listed.length);
}

/**
 * Repeat a comparison that depends on lists other workers are changing right now
 * (for example: every course of the root account). A real defect fails every time;
 * a record that was created or deleted between two requests does not.
 */
export async function settled<T>(compare: () => Promise<T>, tries = 3): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < tries; attempt++) {
		try {
			return await compare();
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}
	throw lastError;
}

/** The input item index each Success item is paired with. */
export const pairedItems = (result: RunNodeResult): number[] =>
	result.rawSuccess.map((item) => Number((item.pairedItem as Json | undefined)?.item));

/** Message of a failed run, wherever it surfaced (Error output or node failure). */
export const failureText = (result: RunNodeResult): string =>
	String(result.error[0]?.errorMessage ?? result.failure?.message ?? '');
