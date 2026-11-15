import type { INodeProperties, INodePropertyCollection, INodePropertyOptions } from 'n8n-workflow';
// With the extension: next to Canvas.node.ts lives Canvas.node.json (the codex file), and
// some loaders pick that one for an extension-less import.
import { Canvas } from '../../nodes/Canvas/Canvas.node.js';
import { resourceHandlers } from '../../nodes/Canvas/handlers';
import type { IRequestConfig } from '../../nodes/Canvas/types/Canvas.types';

/**
 * Everything the tests need to know about what the node offers, read from the
 * node description itself so the tests can never drift from the UI.
 */

export interface OperationInfo {
	resource: string;
	operation: string;
	displayName: string;
	/** Top-level fields shown for this resource/operation (any extra conditions included). */
	fields: INodeProperties[];
}

const GLOBAL_FIELDS = new Set([
	'authentication',
	'debugMode',
	'resource',
	'operation',
	'errorHandling',
	'pagination',
	'rateLimiting',
	'batchProcessing',
	'requestOptions',
]);

let cachedProperties: INodeProperties[] | undefined;
export function nodeProperties(): INodeProperties[] {
	cachedProperties ??= new Canvas().description.properties;
	return cachedProperties;
}

export function listResources(): string[] {
	const resource = nodeProperties().find((p) => p.name === 'resource');
	return ((resource?.options ?? []) as INodePropertyOptions[]).map((o) => String(o.value));
}

export function listOperations(): OperationInfo[] {
	const props = nodeProperties();
	const result: OperationInfo[] = [];
	for (const prop of props) {
		if (prop.name !== 'operation') continue;
		const resources = (prop.displayOptions?.show?.resource ?? []) as string[];
		for (const resource of resources) {
			for (const option of (prop.options ?? []) as INodePropertyOptions[]) {
				const operation = String(option.value);
				result.push({
					resource,
					operation,
					displayName: option.name,
					fields: props.filter((field) => {
						if (GLOBAL_FIELDS.has(field.name)) return false;
						const show = field.displayOptions?.show;
						if (!show) return false;
						const forResource = (show.resource as string[] | undefined)?.includes(resource);
						const forOperation =
							show.operation === undefined || (show.operation as string[]).includes(operation);
						return Boolean(forResource && forOperation);
					}),
				});
			}
		}
	}
	return result;
}

/** A plausible value for one field, by type and name. */
export function sampleValue(field: INodeProperties, variant: 'minimal' | 'full'): unknown {
	const name = field.name;
	switch (field.type) {
		case 'boolean':
			return true;
		case 'number':
			// Mutually exclusive with extend_from_now; a sample must not set both.
			if (name === 'extend_from_end_at') return 0;
			return 7;
		case 'dateTime':
			return '2026-01-15T12:00:00Z';
		case 'options': {
			const options = (field.options ?? []) as INodePropertyOptions[];
			return options.length > 0 ? options[0].value : '';
		}
		case 'multiOptions':
			return ((field.options ?? []) as INodePropertyOptions[]).map((o) => o.value);
		case 'json': {
			const fallback = typeof field.default === 'string' ? field.default.trim() : '';
			if (fallback.startsWith('[')) return '[{"id": 7}]';
			return '{"key": "value"}';
		}
		case 'collection': {
			if (variant === 'minimal') return {};
			const out: Record<string, unknown> = {};
			for (const option of (field.options ?? []) as INodeProperties[]) {
				out[option.name] = sampleValue(option, variant);
			}
			return out;
		}
		case 'fixedCollection': {
			if (variant === 'minimal') return {};
			const out: Record<string, unknown> = {};
			const multiple = field.typeOptions?.multipleValues === true;
			for (const group of (field.options ?? []) as INodePropertyCollection[]) {
				const entry: Record<string, unknown> = {};
				for (const value of group.values) {
					entry[value.name] = sampleValue(value, variant);
				}
				out[group.name] = multiple ? [entry, entry] : entry;
			}
			return out;
		}
		default: {
			if (name === 'path') return '/api/v1/courses';
			if (/ids$/i.test(name)) return '7,8';
			if (/id$/i.test(name)) return '7';
			if (/url$/i.test(name) && !/page/i.test(name)) return 'https://example.com/file.txt';
			if (/email/i.test(name)) return 'person@example.com';
			if (/(date|_at|At)$/.test(name)) return '2026-01-15T12:00:00Z';
			return 'sample';
		}
	}
}

export interface ParamVariant {
	label: string;
	params: Record<string, unknown>;
}

function conditionsMet(field: INodeProperties, params: Record<string, unknown>): boolean {
	const show = field.displayOptions?.show ?? {};
	for (const [key, allowed] of Object.entries(show)) {
		if (key === 'resource' || key === 'operation') continue;
		if (!(allowed as unknown[]).includes(params[key] as never)) return false;
	}
	const hide = field.displayOptions?.hide ?? {};
	for (const [key, hidden] of Object.entries(hide)) {
		if ((hidden as unknown[]).includes(params[key] as never)) return false;
	}
	return true;
}

/**
 * Parameter sets covering every value of every top-level dropdown of an operation
 * (context type, upload source, ...), each in a minimal form (optional collections
 * empty) and a full form (every optional field set).
 */
export function paramVariants(info: OperationInfo, max = 24): ParamVariant[] {
	// Dropdowns that switch which other fields are shown, or which endpoint is used.
	const selectors = info.fields.filter(
		(f) => f.type === 'options' && ((f.options ?? []) as INodePropertyOptions[]).length > 0,
	);

	let combos: Array<Record<string, unknown>> = [{}];
	for (const selector of selectors) {
		const values = ((selector.options ?? []) as INodePropertyOptions[]).map((o) => o.value);
		const next: Array<Record<string, unknown>> = [];
		for (const combo of combos) {
			for (const value of values) {
				next.push({ ...combo, [selector.name]: value });
			}
		}
		combos = next.slice(0, max);
	}

	const variants: ParamVariant[] = [];
	for (const combo of combos) {
		for (const variant of ['minimal', 'full'] as const) {
			const params: Record<string, unknown> = { ...combo };
			// Two passes so fields conditional on other non-dropdown fields settle.
			for (let pass = 0; pass < 2; pass++) {
				for (const field of info.fields) {
					if (field.name in combo) continue;
					if (!conditionsMet(field, params)) {
						delete params[field.name];
						continue;
					}
					params[field.name] = sampleValue(field, variant);
				}
			}
			// A selector whose own conditions are not met is not shown at all.
			for (const selector of selectors) {
				if (!conditionsMet(selector, params)) delete params[selector.name];
			}
			const selectorLabel = Object.entries(combo)
				.filter(([key]) => key in params)
				.map(([key, value]) => `${key}=${String(value)}`)
				.join(',');
			variants.push({ label: `${variant}${selectorLabel ? ` [${selectorLabel}]` : ''}`, params });
		}
	}

	// De-duplicate identical parameter sets.
	const seen = new Set<string>();
	return variants.filter((v) => {
		const key = JSON.stringify(v.params);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Call a resource handler the way the node does, with parameters from a plain object. */
export function buildRequestFor(
	resource: string,
	operation: string,
	params: Record<string, unknown>,
): IRequestConfig {
	const handler = resourceHandlers[resource];
	if (!handler) throw new Error(`No handler for resource ${resource}`);
	const getParam = (name: string, defaultValue = ''): string => {
		const value = params[name];
		if (value === undefined || value === null || value === '') return defaultValue;
		if (Array.isArray(value)) {
			const jsonField = nodeProperties().some(
				(p) => p.name === name && p.type === 'json' && ((p.displayOptions?.show?.resource ?? []) as string[]).includes(resource),
			);
			return jsonField || value.some((entry) => entry !== null && typeof entry === 'object')
				? JSON.stringify(value)
				: value.map(String).join(',');
		}
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	};
	const getParamObject = (name: string): Record<string, unknown> => {
		const value = params[name];
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
		return { ...(value as Record<string, unknown>) };
	};
	return handler(operation, getParam, getParamObject);
}
