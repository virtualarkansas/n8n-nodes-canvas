import { runNode as harnessRunNode } from '../../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../../lib/harness';
import type { Json } from '../../lib/n8n';

/**
 * The Canvas instance and its persona tokens are shared with other test files and
 * people. When the shared quota of a token is drained, the node's pre-flight check
 * gives up ("rate limit quota is still below the threshold") before it sends the
 * request. That says nothing about the operation under test, so such a run is
 * repeated once the quota had time to recover. Nothing is repeated when any item
 * of the run went through.
 */
const QUOTA_EXHAUSTED = /rate limit quota is still below the threshold/i;

function blockedByQuota(result: RunNodeResult): boolean {
	if (result.success.length > 0) return false;
	if (result.failure && QUOTA_EXHAUSTED.test(`${result.failure.message} ${result.failure.description ?? ''}`)) {
		return true;
	}
	return result.error.length > 0 && result.error.every((e) => QUOTA_EXHAUSTED.test(String(e.errorMessage)));
}

export async function runNode(opts: RunNodeOptions): Promise<RunNodeResult> {
	for (let attempt = 1; ; attempt++) {
		const result = await harnessRunNode(opts);
		if (attempt >= 4 || !blockedByQuota(result)) return result;
		await new Promise((r) => setTimeout(r, 20_000));
	}
}

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
