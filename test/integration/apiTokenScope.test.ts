import { describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { runNode, runOk } from './support/adminGroup';
import type { Json } from '../lib/n8n';

/**
 * Resource: apiTokenScope (the scopes that can be put on developer keys and
 * access tokens). Read-only.
 */
describe('apiTokenScope', () => {
	const root = fx('accountId');

	it('getAll: Return All lists every scope Canvas knows, one item per scope', async () => {
		const expected = await canvas().get<Json[]>(`/api/v1/accounts/${root}/scopes`);
		expect(expected.length, 'Canvas has well over a thousand scopes').toBeGreaterThan(500);

		const all = await runOk({
			resource: 'apiTokenScope',
			operation: 'getAll',
			params: { accountId: root, returnAll: true },
		});
		expect(all).toHaveLength(expected.length);
		expect(all.map((s) => s.scope)).toEqual(expected.map((s) => s.scope));
		expect(new Set(all.map((s) => s.scope)).size).toBe(all.length);
		const courses = all.find((s) => s.scope === 'url:GET|/api/v1/courses')!;
		expect(courses).toMatchObject({ verb: 'GET', path: '/api/v1/courses', controller: 'courses', action: 'index' });
	});

	it('getAll: Limit is honoured (default 50), also with the account given as "self" or a number', async () => {
		const expected = await canvas().get<Json[]>(`/api/v1/accounts/${root}/scopes`);

		const defaults = await runOk({ resource: 'apiTokenScope', operation: 'getAll', params: { accountId: 'self' } });
		expect(defaults).toHaveLength(50);
		expect(defaults.map((s) => s.scope)).toEqual(expected.slice(0, 50).map((s) => s.scope));

		const limited = await runOk({
			resource: 'apiTokenScope',
			operation: 'getAll',
			items: [{ account: Number(root) }],
			params: { accountId: '={{ $json.account }}', returnAll: false, limit: 7 },
		});
		expect(limited).toHaveLength(7);

		const many = await runOk({
			resource: 'apiTokenScope',
			operation: 'getAll',
			params: { accountId: root, returnAll: false, limit: 250 },
		});
		expect(many).toHaveLength(250);
	});

	it('getAll: grouped by resource the result is one item with a list of scopes per resource', async () => {
		const expected = await canvas().get<Json>(`/api/v1/accounts/${root}/scopes?group_by=resource_name`);
		const result = await runOk({
			resource: 'apiTokenScope',
			operation: 'getAll',
			params: { accountId: root, returnAll: true, options: { group_by: 'resource_name' } },
		});
		expect(result).toHaveLength(1);
		expect(Object.keys(result[0]).sort()).toEqual(Object.keys(expected).sort());
		expect(Object.keys(result[0]).length).toBeGreaterThan(50);
		const courses = result[0].courses as Json[];
		expect(courses).toBeInstanceOf(Array);
		expect(courses.every((s) => s.resource_name === 'courses')).toBe(true);
		expect((result[0].courses as Json[]).length).toBe((expected.courses as Json[]).length);
	});

	it('getAll: an unknown account and a teacher are errors', async () => {
		const unknown = await runNode({
			resource: 'apiTokenScope',
			operation: 'getAll',
			params: { accountId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'apiTokenScope',
			operation: 'getAll',
		});

		const asTeacher = await runNode({
			resource: 'apiTokenScope',
			operation: 'getAll',
			persona: 'teacher',
			params: { accountId: root, errorHandling: { onError: 'continueWithError' } },
		});
		expect(asTeacher.success).toEqual([]);
		expect(asTeacher.error[0].errorType).toBe('FORBIDDEN');
	});
});
