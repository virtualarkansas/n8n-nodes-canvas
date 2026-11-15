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

/** JSON does not accept these around a document, `String.prototype.trim` removes them. */
const NBSP = ' ';
const BOM = '﻿';

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
		expect(toList([true, 0, null])).toEqual(['true', '0', 'null']);
		expect(toList([[1, 2], { id: 7 }])).toEqual(['1,2', '[object Object]']);
	});

	it('accepts a single number or boolean', () => {
		expect(toList(0)).toEqual(['0']);
		expect(toList(12.5)).toEqual(['12.5']);
		expect(toList(false)).toEqual(['false']);
	});

	it('reads any other value by its text form', () => {
		expect(toList({ a: 1 })).toEqual(['[object Object]']);
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
		const input = [' 1 ', ''];
		toList(input);
		expect(input).toEqual([' 1 ', '']);
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
		expect(collectionRows({ rating: rows }, 'rating')).toBe(rows);
	});

	it('returns an empty list when there are no rows', () => {
		expect(collectionRows({}, 'rating')).toEqual([]);
		expect(collectionRows({ other: [{ id: 1 }] }, 'rating')).toEqual([]);
		expect(collectionRows({ rating: [] }, 'rating')).toEqual([]);
	});

	it('returns an empty list when the group is not an array', () => {
		expect(collectionRows({ rating: { id: 1 } }, 'rating')).toEqual([]);
		expect(collectionRows({ rating: 'text' }, 'rating')).toEqual([]);
		expect(collectionRows({ rating: null }, 'rating')).toEqual([]);
	});

	it('returns an empty list when the collection is not an object', () => {
		for (const collection of [undefined, null, '', 'rating', 0, true]) {
			expect(collectionRows(collection, 'rating')).toEqual([]);
		}
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
		expect(parseJson('null', MESSAGE)).toBeNull();
		expect(parseJson(' \n{"a": 1}\t ', MESSAGE)).toEqual({ a: 1 });
	});

	it('returns undefined for empty and whitespace-only text', () => {
		expect(parseJson('', MESSAGE)).toBeUndefined();
		expect(parseJson('   ', MESSAGE)).toBeUndefined();
		expect(parseJson(' \n\t', MESSAGE, { asTyped: true })).toBeUndefined();
	});

	it('returns anything that is not text as it is', () => {
		const object = { a: 1 };
		const array = [1, 2];
		expect(parseJson(object, MESSAGE)).toBe(object);
		expect(parseJson(array, MESSAGE)).toBe(array);
		expect(parseJson(0, MESSAGE)).toBe(0);
		expect(parseJson(false, MESSAGE)).toBe(false);
		expect(parseJson(null, MESSAGE)).toBeNull();
		expect(parseJson(undefined, MESSAGE)).toBeUndefined();
	});

	it('throws the given message for text that is not JSON', () => {
		expect(messageOf(() => parseJson('{broken', MESSAGE))).toBe(MESSAGE);
		const other = 'Invalid JSON in answers field for quizQuestion create';
		expect(messageOf(() => parseJson('sample', other))).toBe(other);
	});

	it('trims the text before parsing, unless it is to be parsed as typed', () => {
		expect(parseJson(`${NBSP}{"a": 1}${NBSP}`, MESSAGE)).toEqual({ a: 1 });
		expect(parseJson(`${BOM}[1]`, MESSAGE)).toEqual([1]);
		expect(messageOf(() => parseJson(`${NBSP}{"a": 1}${NBSP}`, MESSAGE, { asTyped: true }))).toBe(
			MESSAGE,
		);
		expect(messageOf(() => parseJson(`${BOM}[1]`, MESSAGE, { asTyped: true }))).toBe(MESSAGE);
		// Ordinary whitespace is part of JSON and fine either way.
		expect(parseJson(' \n[1]\t ', MESSAGE, { asTyped: true })).toEqual([1]);
	});
});

describe('parseJsonObject', () => {
	const rules = {
		invalidJson: 'Assignment must be valid JSON',
		notAnObject: 'Assignment must be a JSON object',
	};

	it('parses text into an object', () => {
		expect(parseJsonObject('{"a": 1, "b": {"c": [2]}}', rules)).toEqual({ a: 1, b: { c: [2] } });
		expect(parseJsonObject(' {"a": 1} ', rules)).toEqual({ a: 1 });
		expect(parseJsonObject('{}', rules)).toEqual({});
	});

	it('returns an object from an expression as it is', () => {
		const object = { a: 1 };
		expect(parseJsonObject(object, rules)).toBe(object);
	});

	it('returns undefined when the field was left empty', () => {
		expect(parseJsonObject(undefined, rules)).toBeUndefined();
		expect(parseJsonObject(null, rules)).toBeUndefined();
		expect(parseJsonObject('', rules)).toBeUndefined();
		expect(parseJsonObject('   ', rules)).toBeUndefined();
	});

	it('throws invalidJson for text that is not JSON', () => {
		expect(messageOf(() => parseJsonObject('{broken', rules))).toBe(
			'Assignment must be valid JSON',
		);
		expect(messageOf(() => parseJsonObject('sample', rules))).toBe('Assignment must be valid JSON');
	});

	it('throws notAnObject for anything that is not an object', () => {
		for (const value of [
			'[{"id": 7}]',
			'12',
			'"text"',
			'true',
			'null',
			[1],
			[],
			0,
			12.5,
			true,
			false,
		]) {
			expect(messageOf(() => parseJsonObject(value, rules))).toBe(
				'Assignment must be a JSON object',
			);
		}
	});

	it('whitespaceIsInvalid: only undefined, null and the empty string count as empty', () => {
		const strict = { ...rules, whitespaceIsInvalid: true };
		expect(parseJsonObject('', strict)).toBeUndefined();
		expect(parseJsonObject(null, strict)).toBeUndefined();
		expect(messageOf(() => parseJsonObject('   ', strict))).toBe('Assignment must be valid JSON');
		expect(messageOf(() => parseJsonObject('   ', { ...strict, asTyped: true }))).toBe(
			'Assignment must be valid JSON',
		);
	});

	it('nullTextIsEmpty: the JSON text null counts as empty', () => {
		expect(parseJsonObject('null', { ...rules, nullTextIsEmpty: true })).toBeUndefined();
		expect(parseJsonObject(' null ', { ...rules, nullTextIsEmpty: true })).toBeUndefined();
		// Other JSON that is not an object is still refused.
		expect(messageOf(() => parseJsonObject('[]', { ...rules, nullTextIsEmpty: true }))).toBe(
			'Assignment must be a JSON object',
		);
	});

	it('asTyped: parses the text without trimming it first', () => {
		expect(parseJsonObject(`${NBSP}{"a": 1}`, rules)).toEqual({ a: 1 });
		expect(messageOf(() => parseJsonObject(`${NBSP}{"a": 1}`, { ...rules, asTyped: true }))).toBe(
			'Assignment must be valid JSON',
		);
		expect(parseJsonObject(' {"a": 1} ', { ...rules, asTyped: true })).toEqual({ a: 1 });
	});
});

describe('parseJsonObjectOrEmpty', () => {
	it('parses text and passes objects through', () => {
		expect(parseJsonObjectOrEmpty('{"become_user": true}', 'Permissions')).toEqual({
			become_user: true,
		});
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

	it('parses the text as typed', () => {
		expect(messageOf(() => parseJsonObjectOrEmpty(`${NBSP}{"a": 1}`, 'Permissions'))).toBe(
			'Invalid JSON in Permissions. Expected a JSON object.',
		);
	});
});

describe('parseJsonObjectFor', () => {
	const CONTEXT = 'externalTool create';

	it('parses text and passes objects through', () => {
		expect(parseJsonObjectFor('{"key": "value"}', 'Custom Fields', CONTEXT)).toEqual({
			key: 'value',
		});
		expect(parseJsonObjectFor('{}', 'Custom Fields', CONTEXT)).toEqual({});
		const object = { a: 1 };
		expect(parseJsonObjectFor(object, 'Custom Fields', CONTEXT)).toBe(object);
	});

	it('returns undefined for undefined, null and the empty string', () => {
		for (const value of [undefined, null, '']) {
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

	it('treats whitespace-only text as invalid JSON and parses the text as typed', () => {
		expect(messageOf(() => parseJsonObjectFor('   ', 'Select', 'contentMigration create'))).toBe(
			'Invalid JSON in Select field for contentMigration create',
		);
		expect(
			messageOf(() => parseJsonObjectFor(`${NBSP}{"a": 1}`, 'Select', 'contentMigration create')),
		).toBe('Invalid JSON in Select field for contentMigration create');
	});
});
