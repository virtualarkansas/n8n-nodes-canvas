import type { IDataObject } from 'n8n-workflow';
import type { GetParam, IRequestConfig } from '../types/Canvas.types';

/**
 * The `poll` hint of a "Wait for Completion" operation, from the two fields
 * every such operation offers (see `waitFields` in descriptions/shared.ts).
 */
export function pollUntil(
	getParam: GetParam,
	isFinished: (record: IDataObject) => boolean,
): NonNullable<IRequestConfig['poll']> {
	const seconds = (name: string, fallback: number, min: number): number => {
		const value = Number(getParam(name, String(fallback)));
		return Number.isFinite(value) ? Math.max(min, value) : fallback;
	};
	return {
		intervalSeconds: seconds('pollInterval', 5, 1),
		timeoutSeconds: seconds('timeout', 600, 0),
		isFinished,
	};
}

/** `record[field]` is one of the given states. */
export function stateIn(field: string, states: string[]): (record: IDataObject) => boolean {
	return (record) => states.includes(String(record?.[field] ?? ''));
}
