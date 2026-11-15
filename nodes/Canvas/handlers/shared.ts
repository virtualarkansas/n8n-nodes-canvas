import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { GetParam, IRequestConfig } from '../types/Canvas.types';

// ============================================
// Request hints
// ============================================

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

/**
 * The `download` hint for operations that offer "Download File" (see `downloadFields`
 * in descriptions/shared.ts): undefined unless the user switched it on.
 */
export function downloadIfAsked(
	getParam: GetParam,
	fields: { urlField: string; fileNameField?: string; contentTypeField?: string; optional?: boolean },
): IRequestConfig['download'] {
	if (getParam('downloadFile', 'false') !== 'true') {
		return undefined;
	}
	return { ...fields, binaryPropertyName: getParam('binaryPropertyName', 'data') || 'data' };
}

// ============================================
// Lists
// ============================================

/**
 * A list field as an array of trimmed, non-empty strings.
 *
 * Accepts what the UI and expressions produce: separated text (`"1, 2 ,3"`), an array
 * (every entry is turned into text and trimmed, but not split again), or a single
 * number or boolean. undefined and null give `[]`.
 *
 * `separator` is a comma unless given, e.g. `/[\n,]/` for "one entry per line or commas".
 */
export function toList(value: unknown, separator: string | RegExp = ','): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const entries = Array.isArray(value) ? value : String(value).split(separator);
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

// ============================================
// Blank values
// ============================================

/**
 * True for a value that was left empty: undefined, null or `''`.
 * Everything else is a value, including `0`, `false` and text of only spaces.
 */
export function isBlank(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/**
 * Like `isBlank`, but looks at the text form of the value: also true for text of only
 * whitespace (and for anything else whose text is empty, such as `[]`).
 */
export function isBlankOrWhitespace(value: unknown): boolean {
	return value === undefined || value === null || String(value).trim() === '';
}

/**
 * A copy of a collection without the options that were added in the UI but left empty:
 * undefined, null, `''` and empty arrays are dropped; everything else is kept as it is.
 */
export function withoutBlanks(fields: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		if (isBlank(value)) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		result[key] = value;
	}
	return result;
}

// ============================================
// Collections
// ============================================

/**
 * Remove the listed keys from a collection and return them as a new object.
 * `fields` is changed. Keys that are undefined are neither removed nor returned;
 * every other value (null, `''` ...) is.
 */
export function takeKeys(fields: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const taken: Record<string, unknown> = {};
	for (const key of keys) {
		if (fields[key] !== undefined) {
			taken[key] = fields[key];
			delete fields[key];
		}
	}
	return taken;
}

/**
 * A new object with the listed keys of a collection that are not undefined.
 * Blank values (null, `''`) are copied; `fields` is not changed.
 */
export function pickDefined(
	fields: Record<string, unknown>,
	keys: string[],
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of keys) {
		if (fields[key] !== undefined) {
			out[key] = fields[key];
		}
	}
	return out;
}

/**
 * A new object with the listed keys of a collection that were filled in: undefined,
 * null and `''` (see `isBlank`) are left out; `source` is not changed.
 */
export function pickFilled(
	source: Record<string, unknown>,
	keys: string[],
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of keys) {
		if (!isBlank(source[key])) {
			out[key] = source[key];
		}
	}
	return out;
}

/**
 * Copy the fields of a UI collection into a new object under Canvas' own names
 * (`names` maps UI name to Canvas name; the result follows the order of `names`).
 * undefined, null and empty arrays are never copied. `''` is copied only with
 * `keepBlank`, which is how Canvas clears a value on update.
 */
export function mapFields(
	source: Record<string, unknown>,
	names: Record<string, string>,
	keepBlank = false,
): Record<string, unknown> {
	const target: Record<string, unknown> = {};
	for (const [uiName, canvasName] of Object.entries(names)) {
		const value = source[uiName];
		if (value === undefined || value === null) continue;
		if (value === '' && !keepBlank) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		target[canvasName] = value;
	}
	return target;
}

/**
 * The rows of a fixedCollection with multiple values (`{ <group>: [ {...}, ... ] }`).
 * Returns the array stored under `group` itself (not a copy), or `[]` when the
 * collection is not an object or has no array there.
 */
export function collectionRows(collection: unknown, group: string): IDataObject[] {
	if (collection === null || typeof collection !== 'object') {
		return [];
	}
	const rows = (collection as Record<string, unknown>)[group];
	return Array.isArray(rows) ? (rows as IDataObject[]) : [];
}

// ============================================
// JSON fields
// ============================================

/** True for an object that is neither null nor an array. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** How the text of a `json` field is handed to the JSON parser. */
export interface ParseJsonOptions {
	/**
	 * Parse the text exactly as it was typed. By default it is trimmed first, which also
	 * removes what JSON itself does not accept around a document (a byte order mark,
	 * no-break spaces): with `asTyped` such text is invalid JSON.
	 */
	asTyped?: boolean;
}

function parseText(text: string, invalidJson: string, asTyped: boolean | undefined): unknown {
	try {
		return JSON.parse(asTyped ? text : text.trim()) as unknown;
	} catch {
		throw new ApplicationError(invalidJson);
	}
}

/**
 * The value of a `json` field that may hold any JSON value.
 *
 * Text (typed in the editor) is parsed; text that is empty or only whitespace gives
 * undefined; text that is not JSON throws an ApplicationError with `invalidJson` as its
 * message. Anything that is not text (an object, array or number from an expression,
 * but also null and undefined) is returned as it is.
 */
export function parseJson(
	value: unknown,
	invalidJson: string,
	options: ParseJsonOptions = {},
): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	if (value.trim() === '') {
		return undefined;
	}
	return parseText(value, invalidJson, options.asTyped);
}

/** Messages and rules of `parseJsonObject`. */
export interface JsonObjectRules extends ParseJsonOptions {
	/** Error message for text that is not JSON. */
	invalidJson: string;
	/** Error message for a value that is not an object: an array, a number, text, JSON `null`. */
	notAnObject: string;
	/** Text of only whitespace is invalid JSON. By default it counts as left empty. */
	whitespaceIsInvalid?: boolean;
	/** The JSON text `null` counts as left empty. By default it is not an object. */
	nullTextIsEmpty?: boolean;
}

/**
 * The value of a `json` field that has to hold an object.
 *
 * Accepts text from the editor (parsed) or an object from an expression (returned as it
 * is, not copied). Returns undefined when the field was left empty: undefined, null,
 * `''` or, unless `whitespaceIsInvalid`, text of only whitespace. Throws an
 * ApplicationError with `rules.invalidJson` for text that is not JSON and with
 * `rules.notAnObject` for anything that is not an object.
 */
export function parseJsonObject(
	value: unknown,
	rules: JsonObjectRules,
): Record<string, unknown> | undefined {
	if (isBlank(value)) {
		return undefined;
	}
	let parsed: unknown = value;
	if (typeof value === 'string') {
		if (!rules.whitespaceIsInvalid && value.trim() === '') {
			return undefined;
		}
		parsed = parseText(value, rules.invalidJson, rules.asTyped);
		if (parsed === null && rules.nullTextIsEmpty) {
			return undefined;
		}
	}
	if (!isPlainObject(parsed)) {
		throw new ApplicationError(rules.notAnObject);
	}
	return parsed;
}

/**
 * `parseJsonObject` for fields whose errors name the field only. Returns `{}` when the
 * field was left empty (undefined, null, empty or whitespace-only text); the text is
 * parsed as typed. Messages: `Invalid JSON in <fieldLabel>. Expected a JSON object.`
 * and `Invalid value in <fieldLabel>. Expected a JSON object.`
 */
export function parseJsonObjectOrEmpty(
	value: unknown,
	fieldLabel: string,
): Record<string, unknown> {
	return (
		parseJsonObject(value, {
			invalidJson: `Invalid JSON in ${fieldLabel}. Expected a JSON object.`,
			notAnObject: `Invalid value in ${fieldLabel}. Expected a JSON object.`,
			asTyped: true,
		}) ?? {}
	);
}

/**
 * `parseJsonObject` for fields whose errors name the field and the operation
 * (`context`, e.g. "externalTool create"). Returns undefined only for undefined, null
 * and `''`: whitespace-only text is invalid JSON here, and the text is parsed as typed.
 * Messages: `Invalid JSON in <fieldLabel> field for <context>` and
 * `<fieldLabel> must be a JSON object for <context>`.
 */
export function parseJsonObjectFor(
	value: unknown,
	fieldLabel: string,
	context: string,
): Record<string, unknown> | undefined {
	return parseJsonObject(value, {
		invalidJson: `Invalid JSON in ${fieldLabel} field for ${context}`,
		notAnObject: `${fieldLabel} must be a JSON object for ${context}`,
		asTyped: true,
		whitespaceIsInvalid: true,
	});
}
