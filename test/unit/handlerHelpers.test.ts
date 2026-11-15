import { ApplicationError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	collectionRows,
	isBlank,
	isBlankOrWhitespace,
	isPlainObject,
	mapFields,
	parseJson,
	parseJsonObject,
	parseJsonObjectFor,
	parseJsonObjectOrEmpty,
	pickDefined,
	pickFilled,
	takeKeys,
	toList,
	withoutBlanks,
} from '../../nodes/Canvas/handlers/shared';

/**
 * The helpers every handler shares. Handlers rely on the exact behaviour pinned down
 * here (what counts as empty, what is trimmed, which message an error carries), so a
 * change to one of these tests is a change to what operations send.
 */

/** The message of the ApplicationError `run` throws (exact text: integration tests assert these messages). */
function messageOf(run: () => unknown): string {
	try {
		run();
	} catch (error) {
		expect(error).toBeInstanceOf(ApplicationError);
		return (error as Error).message;
	}
	throw new Error('Expected an error, but nothing was thrown');
}

/** JSON does not accept these around a document; `String.prototype.trim` removes them. */
const NBSP = String.fromCharCode(0x00a0);
const BOM = String.fromCharCode(0xfeff);

const NOT_A_LIST = 'A list of single values (text or numbers) was expected, but';

describe('toList', () => {
	it('splits comma-separated text into trimmed, non-empty entries', () => {
		expect(toList('1, 2 ,3')).toEqual(['1', '2', '3']);
		expect(toList('  12 , 13,,sis_user_id:a b ,  ')).toEqual(['12', '13', 'sis_user_id:a b']);
		expect(toList('single')).toEqual(['single']);
	});

	it('returns an empty list for nothing', () => {
		expect(toList(undefined)).toEqual([]);
		expect(toList(null)).toEqual([]);
		expect(toList('')).toEqual([]);
		expect(toList('   ')).toEqual([]);
		expect(toList(' , ,, ')).toEqual([]);
		expect(toList([])).toEqual([]);
	});

	it('takes the entries of an array as they are: text form, trimmed, not split again', () => {
		expect(toList([1, ' 2 ', ''])).toEqual(['1', '2']);
		expect(toList(['a,b', ' c '])).toEqual(['a,b', 'c']);
		expect(toList([true, 0, 12.5])).toEqual(['true', '0', '12.5']);
	});

	it('drops the null and undefined entries of an array', () => {
		expect(toList([1, null, ' 2 ', undefined])).toEqual(['1', '2']);
		expect(toList([null, undefined])).toEqual([]);
		// As text these are ordinary words.
		expect(toList('1, null, undefined')).toEqual(['1', 'null', 'undefined']);
	});

	it('refuses an array with an entry that is an object or an array, showing the entry', () => {
		expect(messageOf(() => toList([1, { id: 7 }]))).toBe(`${NOT_A_LIST} one entry is {"id":7}`);
		expect(messageOf(() => toList([{ id: 7 }, { id: '8' }]))).toBe(
			`${NOT_A_LIST} one entry is {"id":7}`,
		);
		expect(messageOf(() => toList([[1, 2], 'a,b', null]))).toBe(`${NOT_A_LIST} one entry is [1,2]`);
		expect(messageOf(() => toList(['a', []]))).toBe(`${NOT_A_LIST} one entry is []`);
	});

	it('refuses an object given instead of a list', () => {
		expect(messageOf(() => toList({ a: 1 }))).toBe(`${NOT_A_LIST} the value is {"a":1}`);
		expect(messageOf(() => toList({}))).toBe(`${NOT_A_LIST} the value is {}`);
	});

	it('shortens the value it shows to 60 characters', () => {
		const entry = { description: 'x'.repeat(100) };
		expect(messageOf(() => toList([entry]))).toBe(
			`${NOT_A_LIST} one entry is ${JSON.stringify(entry).slice(0, 60)}…`,
		);
	});

	it('accepts a single number or boolean', () => {
		expect(toList(0)).toEqual(['0']);
		expect(toList(12.5)).toEqual(['12.5']);
		expect(toList(false)).toEqual(['false']);
	});

	it('splits on the given separator instead of a comma', () => {
		expect(toList('https://a.example/x\nhttps://b.example/y, c d', /[\n,]/)).toEqual([
			'https://a.example/x',
			'https://b.example/y',
			'c d',
		]);
		expect(toList('a b\n c,d \r\n\te', /[\s,]+/)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(toList('a;b,c', ';')).toEqual(['a', 'b,c']);
		// The separator is for text only: array entries are never split.
		expect(toList(['a b', 'c'], /[\s,]+/)).toEqual(['a b', 'c']);
	});

	it('does not change the array it is given', () => {
		const input = [' 1 ', '', null];
		toList(input);
		expect(input).toEqual([' 1 ', '', null]);
	});
});

describe('isBlank', () => {
	it('is true for undefined, null and the empty string only', () => {
		expect(isBlank(undefined)).toBe(true);
		expect(isBlank(null)).toBe(true);
		expect(isBlank('')).toBe(true);
	});

	it('treats everything else as a value', () => {
		for (const value of [0, false, true, ' ', '   ', 'x', [], [''], {}, Number.NaN]) {
			expect(isBlank(value)).toBe(false);
		}
	});
});

describe('isBlankOrWhitespace', () => {
	it('is true for what isBlank accepts', () => {
		expect(isBlankOrWhitespace(undefined)).toBe(true);
		expect(isBlankOrWhitespace(null)).toBe(true);
		expect(isBlankOrWhitespace('')).toBe(true);
	});

	it('is also true for text of only whitespace', () => {
		expect(isBlankOrWhitespace(' ')).toBe(true);
		expect(isBlankOrWhitespace(' \t\n ')).toBe(true);
		expect(isBlankOrWhitespace(NBSP)).toBe(true);
	});

	it('looks at the text form of other values', () => {
		expect(isBlankOrWhitespace([])).toBe(true);
		expect(isBlankOrWhitespace([''])).toBe(true);
		expect(isBlankOrWhitespace([' '])).toBe(true);
		expect(isBlankOrWhitespace(0)).toBe(false);
		expect(isBlankOrWhitespace(false)).toBe(false);
		expect(isBlankOrWhitespace(' x ')).toBe(false);
		expect(isBlankOrWhitespace(['', ''])).toBe(false); // ","
		expect(isBlankOrWhitespace({})).toBe(false);
	});
});

describe('withoutBlanks', () => {
	it('drops undefined, null, empty text and empty arrays', () => {
		expect(
			withoutBlanks({
				a: undefined,
				b: null,
				c: '',
				d: [],
				e: 'kept',
				f: 0,
				g: false,
				h: ' ',
				i: [''],
				j: {},
			}),
		).toEqual({ e: 'kept', f: 0, g: false, h: ' ', i: [''], j: {} });
	});

	it('returns a new object in the order of the original and leaves the original alone', () => {
		const fields = { z: 1, a: '', m: 2 };
		const result = withoutBlanks(fields);
		expect(Object.keys(result)).toEqual(['z', 'm']);
		expect(result).not.toBe(fields);
		expect(fields).toEqual({ z: 1, a: '', m: 2 });
	});
});

describe('takeKeys', () => {
	it('moves the listed keys out of the collection', () => {
		const fields: Record<string, unknown> = { name: 'A', enroll_me: true, offer: false, other: 1 };
		expect(takeKeys(fields, ['offer', 'enroll_me', 'missing'])).toEqual({
			offer: false,
			enroll_me: true,
		});
		expect(fields).toEqual({ name: 'A', other: 1 });
	});

	it('takes blank values too, but not undefined ones', () => {
		const fields: Record<string, unknown> = { a: '', b: null, c: undefined };
		const taken = takeKeys(fields, ['a', 'b', 'c']);
		expect(taken).toEqual({ a: '', b: null });
		expect('c' in taken).toBe(false);
		expect('c' in fields).toBe(true);
		expect('a' in fields).toBe(false);
	});

	it('returns the keys in the order they were asked for', () => {
		expect(Object.keys(takeKeys({ a: 1, b: 2, c: 3 }, ['c', 'a']))).toEqual(['c', 'a']);
	});
});

describe('pickDefined', () => {
	it('copies the listed keys that are not undefined, blank ones included', () => {
		const fields = { a: 1, b: '', c: null, d: undefined, e: 'not asked for' };
		const picked = pickDefined(fields, ['c', 'a', 'b', 'd', 'missing']);
		expect(picked).toEqual({ c: null, a: 1, b: '' });
		expect(Object.keys(picked)).toEqual(['c', 'a', 'b']);
		expect(fields).toEqual({ a: 1, b: '', c: null, d: undefined, e: 'not asked for' });
	});
});

describe('pickFilled', () => {
	it('copies the listed keys that were filled in', () => {
		const source = {
			a: 1,
			b: '',
			c: null,
			d: undefined,
			e: 0,
			f: false,
			g: ' ',
			h: 'not asked for',
		};
		expect(pickFilled(source, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'missing'])).toEqual({
			a: 1,
			e: 0,
			f: false,
			g: ' ',
		});
	});
});

describe('mapFields', () => {
	const names = { loginId: 'unique_id', sisId: 'sis_user_id', roles: 'roles', active: 'active' };

	it('copies the fields that were added under their Canvas names, in the order of the map', () => {
		const result = mapFields(
			{ active: false, sisId: 'S1', loginId: 'ada', extra: 'ignored' },
			names,
		);
		expect(result).toEqual({ unique_id: 'ada', sis_user_id: 'S1', active: false });
		expect(Object.keys(result)).toEqual(['unique_id', 'sis_user_id', 'active']);
	});

	it('leaves out undefined, null, empty text and empty arrays', () => {
		expect(mapFields({ loginId: '', sisId: null, roles: [], active: undefined }, names)).toEqual(
			{},
		);
		expect(mapFields({ loginId: ' ', roles: ['a'], active: 0 }, names)).toEqual({
			unique_id: ' ',
			roles: ['a'],
			active: 0,
		});
	});

	it('keeps empty text with keepBlank (how Canvas clears a value), nothing else that is empty', () => {
		expect(
			mapFields({ loginId: '', sisId: null, roles: [], active: undefined }, names, true),
		).toEqual({
			unique_id: '',
		});
	});
});

describe('collectionRows', () => {
	it('returns the rows of the group', () => {
		const rows = [{ id: 1 }, { id: 2 }];
		expect(collectionRows({ rating: rows }, 'rating', 'Ratings')).toBe(rows);
		expect(collectionRows({ rating: [{}] }, 'rating', 'Ratings')).toEqual([{}]);
	});

	it('has no rows when the group is missing or was left empty', () => {
		expect(collectionRows({}, 'rating', 'Ratings')).toEqual([]);
		expect(collectionRows({ other: [{ id: 1 }] }, 'rating', 'Ratings')).toEqual([]);
		expect(collectionRows({ rating: [] }, 'rating', 'Ratings')).toEqual([]);
		for (const rows of [undefined, null, '']) {
			expect(collectionRows({ rating: rows }, 'rating', 'Ratings')).toEqual([]);
		}
	});

	it('has no rows when the collection itself is missing or was left empty', () => {
		for (const collection of [undefined, null, '']) {
			expect(collectionRows(collection, 'rating', 'Ratings')).toEqual([]);
		}
	});

	it('refuses a group that is not a list, naming the field', () => {
		const message = (rows: unknown): string =>
			messageOf(() => collectionRows({ gradeValues: rows }, 'gradeValues', 'Grades'));
		const expected = 'Grades must be a list of entries (one object per entry), got';
		expect(message('x')).toBe(`${expected} "x"`);
		expect(message('   ')).toBe(`${expected} "   "`);
		expect(message(0)).toBe(`${expected} 0`);
		expect(message(false)).toBe(`${expected} false`);
		expect(message({ student_id: 7 })).toBe(`${expected} {"student_id":7}`);
	});

	it('refuses a row that is not an object, naming the field and the row', () => {
		const message = (rows: unknown[]): string =>
			messageOf(() => collectionRows({ slots: rows }, 'slots', 'Time Slots'));
		const expected = 'must be an object with the fields of an entry, got';
		expect(message([null])).toBe(`Time Slots: entry 1 ${expected} null`);
		expect(message([{ start_at: 'a' }, 'text'])).toBe(`Time Slots: entry 2 ${expected} "text"`);
		expect(message([{}, {}, [1, 2]])).toBe(`Time Slots: entry 3 ${expected} [1,2]`);
		expect(message([7])).toBe(`Time Slots: entry 1 ${expected} 7`);
	});

	it('refuses a collection that is not an object, naming the field and the group', () => {
		const message = (collection: unknown): string =>
			messageOf(() => collectionRows(collection, 'rating', 'Ratings'));
		const expected = 'Ratings must be an object with its entries under "rating", got';
		expect(message('text')).toBe(`${expected} "text"`);
		expect(message([{ description: 'A' }])).toBe(`${expected} [{"description":"A"}]`);
		expect(message(0)).toBe(`${expected} 0`);
		expect(message(true)).toBe(`${expected} true`);
	});
});

describe('isPlainObject', () => {
	it('accepts objects and nothing else', () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject({ a: 1 })).toBe(true);
		for (const value of [null, undefined, [], [{}], 'text', 0, true]) {
			expect(isPlainObject(value)).toBe(false);
		}
	});
});

describe('parseJson', () => {
	const MESSAGE = 'Rules must be valid JSON';

	it('parses text into any JSON value', () => {
		expect(parseJson('{"a": [1, "2"]}', MESSAGE)).toEqual({ a: [1, '2'] });
		expect(parseJson('[{"id": 7}, {"id": "8"}]', MESSAGE)).toEqual([{ id: 7 }, { id: '8' }]);
		expect(parseJson('12', MESSAGE)).toBe(12);
		expect(parseJson('"text"', MESSAGE)).toBe('text');
		expect(parseJson('false', MESSAGE)).toBe(false);
		expect(parseJson(' \n{"a": 1}\t ', MESSAGE)).toEqual({ a: 1 });
	});

	it('gives undefined for a field that was left empty: undefined, null, empty or blank text', () => {
		for (const value of [undefined, null, '', '   ', ' \n\t', NBSP, BOM]) {
			expect(parseJson(value, MESSAGE)).toBeUndefined();
		}
	});

	it('gives JSON null for the typed text null', () => {
		expect(parseJson('null', MESSAGE)).toBeNull();
		expect(parseJson(' null ', MESSAGE)).toBeNull();
	});

	it('returns any other value from an expression as it is', () => {
		const object = { a: 1 };
		const array = [1, 2];
		expect(parseJson(object, MESSAGE)).toBe(object);
		expect(parseJson(array, MESSAGE)).toBe(array);
		expect(parseJson(0, MESSAGE)).toBe(0);
		expect(parseJson(false, MESSAGE)).toBe(false);
	});

	it('throws the given message for text that is not JSON', () => {
		expect(messageOf(() => parseJson('{broken', MESSAGE))).toBe(MESSAGE);
		const other = 'Invalid JSON in answers field for quizQuestion create';
		expect(messageOf(() => parseJson('sample', other))).toBe(other);
	});

	it('trims the text before parsing, which also removes a BOM and no-break spaces', () => {
		expect(parseJson(`${NBSP}{"a": 1}${NBSP}`, MESSAGE)).toEqual({ a: 1 });
		expect(parseJson(`${BOM}[1]`, MESSAGE)).toEqual([1]);
		expect(parseJson(`${BOM} 12 \n`, MESSAGE)).toBe(12);
	});
});

describe('parseJsonObject', () => {
	const messages = {
		invalidJson: 'Assignment must be valid JSON',
		notAnObject: 'Assignment must be a JSON object',
	};

	it('parses text into an object', () => {
		expect(parseJsonObject('{"a": 1, "b": {"c": [2]}}', messages)).toEqual({ a: 1, b: { c: [2] } });
		expect(parseJsonObject(' {"a": 1} ', messages)).toEqual({ a: 1 });
		expect(parseJsonObject(`${BOM}{"a": 1}${NBSP}`, messages)).toEqual({ a: 1 });
		expect(parseJsonObject('{}', messages)).toEqual({});
	});

	it('returns an object from an expression as it is', () => {
		const object = { a: 1 };
		expect(parseJsonObject(object, messages)).toBe(object);
	});

	it('gives undefined for a field that was left empty', () => {
		for (const value of [undefined, null, '', '   ', ' \n\t', NBSP]) {
			expect(parseJsonObject(value, messages)).toBeUndefined();
		}
	});

	it('throws invalidJson for text that is not JSON', () => {
		for (const value of ['{broken', 'sample']) {
			expect(messageOf(() => parseJsonObject(value, messages))).toBe(messages.invalidJson);
		}
	});

	it('throws notAnObject for anything that is not an object, the typed text null included', () => {
		const values = [
			'[{"id": 7}]',
			'12',
			'"text"',
			'true',
			'null',
			' null ',
			[1],
			[],
			0,
			12.5,
			true,
		];
		for (const value of [...values, false]) {
			expect(messageOf(() => parseJsonObject(value, messages))).toBe(messages.notAnObject);
		}
	});
});

describe('parseJsonObjectOrEmpty', () => {
	it('parses text and passes objects through', () => {
		expect(parseJsonObjectOrEmpty('{"become_user": true}', 'Permissions')).toEqual({
			become_user: true,
		});
		expect(parseJsonObjectOrEmpty(`${NBSP}{"a": 1}`, 'Permissions')).toEqual({ a: 1 });
		const object = { a: 1 };
		expect(parseJsonObjectOrEmpty(object, 'Permissions')).toBe(object);
	});

	it('returns an empty object when the field was left empty', () => {
		for (const value of [undefined, null, '', '   ', ' \n']) {
			expect(parseJsonObjectOrEmpty(value, 'Permissions')).toEqual({});
		}
	});

	it('names the field in its errors', () => {
		expect(messageOf(() => parseJsonObjectOrEmpty('{broken', 'Settings (JSON)'))).toBe(
			'Invalid JSON in Settings (JSON). Expected a JSON object.',
		);
		for (const value of ['[1]', 'null', '12', [1], 0, false]) {
			expect(messageOf(() => parseJsonObjectOrEmpty(value, 'Settings (JSON)'))).toBe(
				'Invalid value in Settings (JSON). Expected a JSON object.',
			);
		}
	});
});

describe('parseJsonObjectFor', () => {
	const CONTEXT = 'externalTool create';

	it('parses text and passes objects through', () => {
		expect(parseJsonObjectFor('{"key": "value"}', 'Custom Fields', CONTEXT)).toEqual({
			key: 'value',
		});
		expect(parseJsonObjectFor(`${BOM}{"key": "value"}`, 'Custom Fields', CONTEXT)).toEqual({
			key: 'value',
		});
		expect(parseJsonObjectFor('{}', 'Custom Fields', CONTEXT)).toEqual({});
		const object = { a: 1 };
		expect(parseJsonObjectFor(object, 'Custom Fields', CONTEXT)).toBe(object);
	});

	it('returns undefined when the field was left empty', () => {
		for (const value of [undefined, null, '', '   ', ' \n']) {
			expect(parseJsonObjectFor(value, 'Custom Fields', CONTEXT)).toBeUndefined();
		}
	});

	it('names the field and the operation in its errors', () => {
		expect(messageOf(() => parseJsonObjectFor('{broken', 'Custom Fields', CONTEXT))).toBe(
			'Invalid JSON in Custom Fields field for externalTool create',
		);
		for (const value of ['[1]', 'null', '12', [1], 0, false]) {
			expect(messageOf(() => parseJsonObjectFor(value, 'Placements', CONTEXT))).toBe(
				'Placements must be a JSON object for externalTool create',
			);
		}
	});
});
