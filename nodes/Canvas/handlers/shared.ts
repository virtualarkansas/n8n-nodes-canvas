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

/**
 * Reshape the records of one page with that page's whole response at hand (the
 * `pageTransform` hint: lists under `dataKey` whose page carries more than the list).
 */
export type PageTransform = NonNullable<IRequestConfig['pageTransform']>;

/**
 * The `pageTransform` of the audit logs (authentication, grade change, course): Canvas
 * answers each page with `{ events: [...], linked: { users: [...], courses: [...] } }`,
 * where every event names the records it refers to in `links` (`{ user: 5, course: "3" }`)
 * and `linked` holds those records for that page only. Gives every event a `linked`
 * object with, for each of its links, the record (or null when Canvas sent none, e.g.
 * a page view that is not kept). `collections` maps a link name to the collection of
 * `linked` that holds it (`student` → `users`); links not named there are left alone.
 */
export function attachLinkedRecords(collections: Record<string, string>): PageTransform {
	return (records, page) => {
		const linked = isPlainObject(page.linked) ? page.linked : {};
		const lookup = (collection: string, id: unknown): IDataObject | null => {
			const list = linked[collection];
			if (!Array.isArray(list) || id === undefined || id === null || id === '') {
				return null;
			}
			const found = list.find((entry) => isPlainObject(entry) && String(entry.id) === String(id));
			return (found as IDataObject | undefined) ?? null;
		};
		return records.map((record) => {
			const links = isPlainObject(record?.links) ? record.links : undefined;
			if (!links) {
				return record;
			}
			const resolved: IDataObject = {};
			for (const [name, id] of Object.entries(links)) {
				const collection = collections[name];
				if (collection) {
					resolved[name] = lookup(collection, id);
				}
			}
			return { ...record, linked: resolved };
		});
	};
}

/**
 * `attachLinkedRecords` unless the user switched "Include Linked Records" (`includeLinked`,
 * on by default) off.
 */
export function linkedIfAsked(
	getParam: GetParam,
	collections: Record<string, string>,
): PageTransform | undefined {
	return getParam('includeLinked', 'true') === 'false' ? undefined : attachLinkedRecords(collections);
}

/**
 * The ID in a value that may also be the URL Canvas hands out for the record: an ID
 * (`123`, `sis_course_id:x`) is returned as it is; a URL or path with `/<segment>/<id>`
 * (`https://canvas.example.com/api/v1/progress/123`, as in a `progress_url`) gives the ID
 * after the last such segment. Query string and fragment are ignored. Any other value
 * with a slash throws an ApplicationError naming `label`.
 */
export function idFromUrl(value: string, segment: string, label: string): string {
	const text = value.trim();
	if (!text.includes('/')) {
		return text;
	}
	const path = text.split(/[?#]/)[0];
	const parts = path.split('/').filter((part) => part !== '');
	const index = parts.lastIndexOf(segment);
	if (index === -1 || index === parts.length - 1) {
		throw new ApplicationError(
			`${label}: expected an ID or a URL ending in /${segment}/<ID>, got ${shown(text)}`,
		);
	}
	return decodeURIComponent(parts[index + 1]);
}

/** A value as it is shown in an error message: its JSON text, cut off after 60 characters. */
function shown(value: unknown): string {
	let text: string;
	try {
		text = JSON.stringify(value) ?? String(value);
	} catch {
		text = String(value);
	}
	return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

// ============================================
// Lists
// ============================================

/**
 * A list field as an array of trimmed, non-empty strings.
 *
 * Accepts what the UI and expressions produce: separated text (`"1, 2 ,3"`), an array of
 * single values (every entry is turned into text and trimmed, but not split again), or a
 * single number or boolean. undefined and null give `[]`; entries of an array that are
 * undefined or null are dropped.
 *
 * Throws an ApplicationError for anything that is not a list of single values: an object,
 * or an array with an entry that is an object or another array.
 *
 * `separator` is a comma unless given, e.g. `/[\n,]/` for "one entry per line or commas".
 */
export function toList(value: unknown, separator: string | RegExp = ','): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (!Array.isArray(value) && typeof value === 'object') {
		throw new ApplicationError(
			`A list of single values (text or numbers) was expected, but the value is ${shown(value)}`,
		);
	}
	const entries: unknown[] = Array.isArray(value) ? value : String(value).split(separator);
	const list: string[] = [];
	for (const entry of entries) {
		if (entry === undefined || entry === null) {
			continue;
		}
		if (typeof entry === 'object') {
			throw new ApplicationError(
				`A list of single values (text or numbers) was expected, but one entry is ${shown(entry)}`,
			);
		}
		const text = String(entry).trim();
		if (text !== '') {
			list.push(text);
		}
	}
	return list;
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
 * The rows of a fixedCollection with multiple values (`{ <group>: [ {...}, ... ] }`),
 * checked. Returns the array stored under `group` itself (not a copy); a collection or a
 * group that is missing or left empty (undefined, null, `''`) has no rows.
 *
 * Throws an ApplicationError that names the field (`label`, its display name) when the
 * collection is not an object, the group is not an array, or a row is not an object.
 */
export function collectionRows(collection: unknown, group: string, label: string): IDataObject[] {
	if (isBlank(collection)) {
		return [];
	}
	if (!isPlainObject(collection)) {
		throw new ApplicationError(
			`${label} must be an object with its entries under "${group}", got ${shown(collection)}`,
		);
	}
	const rows = collection[group];
	if (isBlank(rows)) {
		return [];
	}
	if (!Array.isArray(rows)) {
		throw new ApplicationError(
			`${label} must be a list of entries (one object per entry), got ${shown(rows)}`,
		);
	}
	rows.forEach((row, index) => {
		if (!isPlainObject(row)) {
			throw new ApplicationError(
				`${label}: entry ${index + 1} must be an object with the fields of an entry, got ${shown(row)}`,
			);
		}
	});
	return rows as IDataObject[];
}

// ============================================
// JSON fields
// ============================================

/** True for an object that is neither null nor an array. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The value of a `json` field that may hold any JSON value.
 *
 * One rule for every such field: it was left empty, and the result is undefined, when the
 * value is undefined, null, `''` or text of only whitespace. Other text (typed in the
 * editor) is trimmed and parsed, so the text `null` gives null; text that is not JSON
 * throws an ApplicationError with `invalidJson` as its message. Anything else (an object,
 * array, number or boolean from an expression) is returned as it is.
 */
export function parseJson(value: unknown, invalidJson: string): unknown {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value !== 'string') {
		return value;
	}
	const text = value.trim();
	if (text === '') {
		return undefined;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new ApplicationError(invalidJson);
	}
}

/** The two error messages of `parseJsonObject`. */
export interface JsonObjectMessages {
	/** For text that is not JSON. */
	invalidJson: string;
	/** For a value that is not an object: an array, a number, text, the JSON text `null`. */
	notAnObject: string;
}

/**
 * The value of a `json` field that has to hold an object: `parseJson` (same rule for
 * "left empty", which gives undefined), plus an ApplicationError with
 * `messages.notAnObject` for anything that is not an object. An object from an
 * expression is returned as it is, not copied.
 */
export function parseJsonObject(
	value: unknown,
	messages: JsonObjectMessages,
): Record<string, unknown> | undefined {
	const parsed = parseJson(value, messages.invalidJson);
	if (parsed === undefined) {
		return undefined;
	}
	if (!isPlainObject(parsed)) {
		throw new ApplicationError(messages.notAnObject);
	}
	return parsed;
}

/**
 * `parseJsonObject` for fields whose errors name the field only; `{}` when the field was
 * left empty. Messages: `Invalid JSON in <fieldLabel>. Expected a JSON object.` and
 * `Invalid value in <fieldLabel>. Expected a JSON object.`
 */
export function parseJsonObjectOrEmpty(
	value: unknown,
	fieldLabel: string,
): Record<string, unknown> {
	return (
		parseJsonObject(value, {
			invalidJson: `Invalid JSON in ${fieldLabel}. Expected a JSON object.`,
			notAnObject: `Invalid value in ${fieldLabel}. Expected a JSON object.`,
		}) ?? {}
	);
}

/**
 * `parseJsonObject` for fields whose errors name the field and the operation (`context`,
 * e.g. "externalTool create"); undefined when the field was left empty. Messages:
 * `Invalid JSON in <fieldLabel> field for <context>` and
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
	});
}
