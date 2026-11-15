import { runNode as harnessRunNode } from '../../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../../lib/harness';
import type { Json } from '../../lib/n8n';

/** The harness itself repeats runs abandoned on the rate-limit quota and honours BATTERY_RATE_LIMIT_THRESHOLD. */
export const runNode = (opts: RunNodeOptions): Promise<RunNodeResult> => harnessRunNode(opts);

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
