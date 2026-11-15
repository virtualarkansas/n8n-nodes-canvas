import { describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resources: apiRequest (any path, with the node's pagination, rate limiting and
 * error handling) and graphql.
 */
describe('apiRequest', () => {
	let courseId = '';

	it('GET: a documented list is paginated like any other operation', async () => {
		const path = `/api/v1/courses/${fx('largeCourseId')}/users`;
		const expected = await canvas().getAll<Json>(`${path}?enrollment_type[]=student`);
		expect(expected.length).toBeGreaterThan(100);

		const defaults = await runOk({ resource: 'apiRequest', operation: 'request', params: { method: 'GET', path, query: '{"enrollment_type": ["student"]}' } });
		expect(defaults).toHaveLength(50);

		const all = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'GET', path, query: { enrollment_type: ['student'] }, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id).sort()).toEqual(expected.map((u) => u.id).sort());
	});

	it('GET: a single record comes back as one item', async () => {
		const [course] = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'GET', path: `/api/v1/courses/${fx('courseId')}`, query: '{"include": ["term", "total_students"]}' },
		});
		expect(course).toMatchObject({ id: Number(fx('courseId')) });
		expect(course.term).toBeTypeOf('object');
		expect(course.total_students).toBeTypeOf('number');
	});

	it('GET: an endpoint Instructure does not document works too', async () => {
		// The gradebook's saved filters: used by the Canvas web interface, absent from the API docs.
		const path = `/api/v1/courses/${fx('courseId')}/gradebook_filters`;
		const expected = await canvas().request('GET', path);
		expect(expected.status).toBe(200);
		const filters = await runOk({ resource: 'apiRequest', operation: 'request', params: { method: 'GET', path } });
		expect(filters).toEqual(expected.data);
	});

	it('GET: a wrapped list is unwrapped with Unwrap Key', async () => {
		const path = `/api/v1/audit/course/accounts/${fx('accountId')}`;
		const events = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'GET', path, options: { dataKey: 'events' }, pagination: { perPage: 5, maxPages: 3 } },
		});
		expect(events).toHaveLength(15);
		expect(events[0]).toHaveProperty('event_type');
		expect(new Set(events.map((e) => e.id)).size).toBe(15);

		// Without the key the wrapper object is returned as it is.
		const [wrapped] = await runOk({ resource: 'apiRequest', operation: 'request', params: { method: 'GET', path, pagination: { perPage: 5 } } });
		expect(wrapped.events).toBeInstanceOf(Array);
	});

	it('POST, PUT, DELETE: create, change and remove a record through raw requests', async () => {
		const name = unique('Raw request course ✔');
		const [created] = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'POST', path: `/api/v1/accounts/${fx('accountId')}/courses`, body: JSON.stringify({ course: { name, course_code: 'RAW-1' } }) },
		});
		courseId = String(created.id);
		expect(created).toMatchObject({ name, course_code: 'RAW-1' });

		const [updated] = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'PUT', path: `/api/v1/courses/${courseId}`, body: { course: { course_code: 'RAW-2' } } },
		});
		expect(updated.course_code).toBe('RAW-2');
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}`)).course_code).toBe('RAW-2');

		const [deleted] = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'DELETE', path: `/api/v1/courses/${courseId}`, query: '{"event": "delete"}' },
		});
		expect(deleted).toEqual({ delete: true });
	});

	it('a full URL is reduced to its path, so the token only ever goes to the configured Canvas', async () => {
		const result = await runNode({
			resource: 'apiRequest',
			operation: 'request',
			params: { debugMode: true, method: 'GET', path: `https://evil.example.com/api/v1/courses/${fx('courseId')}?include[]=term` },
		});
		const debug = result.debug[0];
		expect(String(debug.url)).toMatch(new RegExp(`^http://localhost:3000/api/v1/courses/${fx('courseId')}\\?include\\[\\]=term&per_page=50$`));
		expect(String(debug.curl)).not.toContain('evil.example.com');

		const [course] = await runOk({
			resource: 'apiRequest',
			operation: 'request',
			params: { method: 'GET', path: `https://evil.example.com/api/v1/courses/${fx('courseId')}` },
		});
		expect(course.id).toBe(Number(fx('courseId')));
	});

	it('errors: bad input is rejected before sending; Canvas errors are reported', async () => {
		const eh = { errorHandling: { onError: 'continueWithError' } };
		for (const [params, pattern] of [
			[{ method: 'GET', path: 'api/v1/courses' }, /start with a single slash/i],
			[{ method: 'GET', path: '//evil.example.com/x' }, /start with a single slash/i],
			[{ method: 'GET', path: '/api/v1/courses', query: '[1,2]' }, /JSON object/i],
			[{ method: 'POST', path: '/api/v1/courses', body: '{broken' }, /valid JSON/i],
		] as Array<[Json, RegExp]>) {
			const result = await runNode({ resource: 'apiRequest', operation: 'request', params: { ...params, ...eh } });
			expect(result.success, JSON.stringify(params)).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
			expect(String(result.error[0].errorMessage)).toMatch(pattern);
		}

		const missing = await runNode({ resource: 'apiRequest', operation: 'request', params: { method: 'GET', path: '/api/v1/no_such_thing', ...eh } });
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const forbidden = await runNode({
			resource: 'apiRequest',
			operation: 'request',
			persona: 'student',
			params: { method: 'POST', path: `/api/v1/accounts/${fx('accountId')}/courses`, body: '{"course": {"name": "no"}}', ...eh },
		});
		expect([401, 403]).toContain(forbidden.error[0].errorCode);
	});
});

describe('graphql', () => {
	it('query: returns data for a query with variables', async () => {
		const [result] = await runOk({
			resource: 'graphql',
			operation: 'query',
			params: {
				query: 'query ($id: ID!) { course(id: $id) { _id name courseCode state } }',
				variables: JSON.stringify({ id: fx('courseId') }),
			},
		});
		const expected = await canvas().get<Json>(`/api/v1/courses/${fx('courseId')}`);
		expect((result.data as Json).course).toMatchObject({ _id: fx('courseId'), name: expected.name, courseCode: expected.course_code });
		expect(result.errors).toBeUndefined();
	});

	it('query: reaches connection data with cursors, as the web interface does', async () => {
		const [result] = await runOk({
			resource: 'graphql',
			operation: 'query',
			params: {
				query: `query ($id: ID!, $first: Int) {
					course(id: $id) {
						enrollmentsConnection(first: $first) { nodes { _id type state user { _id name } } pageInfo { hasNextPage endCursor } }
					}
				}`,
				variables: { id: fx('largeCourseId'), first: 25 },
			},
		});
		const connection = ((result.data as Json).course as Json).enrollmentsConnection as Json;
		expect(connection.nodes as Json[]).toHaveLength(25);
		expect((connection.pageInfo as Json).hasNextPage).toBe(true);
		expect((connection.pageInfo as Json).endCursor).toBeTypeOf('string');
	});

	it('query: Canvas runs one operation per request and says so for a document with several', async () => {
		const result = await runNode({
			resource: 'graphql',
			operation: 'query',
			params: {
				query: 'query First { allCourses { _id } } query Second ($id: ID!) { course(id: $id) { name } }',
				variables: { id: fx('courseId') },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/operation name is required/i);
	});

	it('mutation: changes data', async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, { course: { name: unique('GraphQL course') } });
		const assignment = await canvas().post<Json>(`/api/v1/courses/${String(course.id)}/assignments`, { assignment: { name: 'Before', points_possible: 5 } });
		const [result] = await runOk({
			resource: 'graphql',
			operation: 'query',
			params: {
				query: 'mutation ($id: ID!, $name: String!) { updateAssignment(input: { id: $id, name: $name }) { assignment { _id name } errors { message } } }',
				variables: { id: String(assignment.id), name: 'After — renamed through GraphQL' },
			},
		});
		expect((((result.data as Json).updateAssignment as Json).assignment as Json).name).toBe('After — renamed through GraphQL');
		expect((await canvas().get<Json>(`/api/v1/courses/${String(course.id)}/assignments/${String(assignment.id)}`)).name).toBe('After — renamed through GraphQL');
		await canvas().delete(`/api/v1/courses/${String(course.id)}?event=delete`);
	});

	it('errors: a GraphQL error fails the item although Canvas answers 200', async () => {
		const result = await runNode({
			resource: 'graphql',
			operation: 'query',
			params: { query: '{ thisFieldDoesNotExist }', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/thisFieldDoesNotExist/);

		const stop = await runNode({ resource: 'graphql', operation: 'query', params: { query: '{ thisFieldDoesNotExist }' } });
		expect(stop.ok).toBe(false);
		expect(stop.failure?.message).toMatch(/GraphQL errors/);
	});

	it('errors: partial data can be kept on request', async () => {
		const [result] = await runOk({
			resource: 'graphql',
			operation: 'query',
			params: { query: '{ thisFieldDoesNotExist }', options: { continueOnGraphqlErrors: true } },
		});
		expect((result.errors as Json[])[0].message).toMatch(/thisFieldDoesNotExist/);
	});

	it('errors: unusable input and a student asking for what they may not see', async () => {
		const eh = { errorHandling: { onError: 'continueWithError' } };
		const badVariables = await runNode({ resource: 'graphql', operation: 'query', params: { query: '{ allCourses { _id } }', variables: '{nope', ...eh } });
		expect(badVariables.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });

		const [asStudent] = await runOk({
			resource: 'graphql',
			operation: 'query',
			persona: 'student',
			params: { query: 'query ($id: ID!) { course(id: $id) { _id name } }', variables: { id: fx('emptyCourseId') } },
		});
		// Canvas hides what the user may not see rather than raising an error.
		expect((asStudent.data as Json).course).toBeNull();
	});
});
