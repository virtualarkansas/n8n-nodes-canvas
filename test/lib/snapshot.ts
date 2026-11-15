import { createHash } from 'node:crypto';
import { buildRequestFor, listOperations, paramVariants } from './catalog';

/**
 * The request every operation builds, for the minimal and the full set of its parameters
 * (and every value of its context dropdowns), in a form that can be compared and reviewed.
 *
 * The route audit only looks at method and path. This is what protects query strings and
 * bodies where no Canvas is at hand (CI): a handler that starts sending `name` instead of
 * `course[name]` changes the snapshot, and the diff shows exactly what changed.
 */
export type RequestSnapshot = Record<string, Record<string, unknown>>;

/** Values that cannot be written as JSON, described instead. */
function describe(value: unknown): unknown {
	if (Buffer.isBuffer(value)) {
		return `<${value.length} bytes, sha256 ${createHash('sha256').update(value).digest('hex').slice(0, 16)}>`;
	}
	if (typeof value === 'function') {
		return '<function>';
	}
	if (Array.isArray(value)) {
		return value.map(describe);
	}
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, describe(entry)]));
	}
	return value === undefined ? '<undefined>' : value;
}

/** Run with a fixed clock and fixed randomness: a few handlers fall back to "now" or build multipart boundaries. */
function frozen<T>(run: () => T): T {
	const RealDate = Date;
	const realRandom = Math.random;
	const now = RealDate.UTC(2026, 0, 2, 3, 4, 5, 678);
	class FixedDate extends RealDate {
		constructor(...args: unknown[]) {
			if (args.length === 0) {
				super(now);
			} else {
				super(...(args as [number]));
			}
		}

		static now(): number {
			return now;
		}
	}
	globalThis.Date = FixedDate as unknown as DateConstructor;
	Math.random = (): number => 0.123456789;
	try {
		return run();
	} finally {
		globalThis.Date = RealDate;
		Math.random = realRandom;
	}
}

export function buildRequestSnapshot(): RequestSnapshot {
	return frozen(() => {
		const snapshot: RequestSnapshot = {};
		for (const op of listOperations()) {
			const variants: Record<string, unknown> = {};
			for (const variant of paramVariants(op)) {
				try {
					const { method, endpoint, qs, body, ...hints } = buildRequestFor(op.resource, op.operation, variant.params);
					variants[variant.label] = describe({ method, endpoint, qs, body, ...hints });
				} catch (error) {
					// Operations that need at least one entry refuse their minimal variant: that is part of the contract too.
					variants[variant.label] = { refused: (error as Error).message };
				}
			}
			snapshot[`${op.resource}.${op.operation}`] = variants;
		}
		return snapshot;
	});
}
