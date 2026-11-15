import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { deleteLtiTool, deployLtiTool, registerLtiTool } from './lti-advantage.helper';
import type { LtiTool } from './lti-advantage.helper';

/**
 * Resource: ltiResourceLink. Resource links belong to an LTI 1.3 tool, so the
 * file registers its own tool, installs it in its own course and works there.
 */
describe('ltiResourceLink', () => {
	let courseId = '';
	let tool: LtiTool | undefined;
	let externalToolId = '';
	let linkId = '';
	let link: Json = {};
	let assignmentLinkId = '';
	const base = (): string => `/api/v1/courses/${courseId}/lti_resource_links`;
	const launch = (path: string): string => `https://${tool!.host}/launch/${path}`;

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Resource link battery course') },
			offer: true,
		});
		courseId = String(course.id);
		tool = await registerLtiTool('reslink');
		externalToolId = String((await deployLtiTool(tool, courseId)).id);
	});

	afterAll(async () => {
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		await deleteLtiTool(tool);
	});

	it('create: URL, title and custom parameters reach Canvas', async () => {
		const [created] = await runOk({
			resource: 'ltiResourceLink',
			operation: 'create',
			params: {
				courseId,
				url: launch('chapter/1?lang=sv&mode=a b'),
				additionalFields: {
					title: 'Kapitel 1 – Ünïcødé "quoted" & <b>tags</b> 📚',
					custom: '{"chapter": "1", "note": "värde with spaces & symbols", "variable": "$Canvas.user.id"}',
				},
			},
		});
		linkId = String(created.id);
		expect(created.canvas_launch_url).toBeTypeOf('string');

		link = await canvas().get<Json>(`${base()}/${linkId}`);
		expect(link).toMatchObject({
			id: Number(linkId),
			context_id: Number(courseId),
			context_type: 'Course',
			context_external_tool_id: Number(externalToolId),
			resource_type: 'rich_content',
			url: launch('chapter/1?lang=sv&mode=a b'),
			title: 'Kapitel 1 – Ünïcødé "quoted" & <b>tags</b> 📚',
			custom: { chapter: '1', note: 'värde with spaces & symbols', variable: '$Canvas.user.id' },
			workflow_state: 'active',
		});
	});

	it('create: only a URL', async () => {
		const [created] = await runOk({
			resource: 'ltiResourceLink',
			operation: 'create',
			params: { courseId, url: launch('minimal'), additionalFields: { custom: '{}' } },
		});
		const actual = await canvas().get<Json>(`${base()}/${String(created.id)}`);
		expect(actual).toMatchObject({ url: launch('minimal'), title: null });
		expect(actual.custom ?? {}).toEqual({});
	});

	it('create: Canvas refuses a URL no LTI 1.3 tool of the course matches, and non-string custom values', async () => {
		const noTool = await runNode({
			resource: 'ltiResourceLink',
			operation: 'create',
			params: {
				courseId,
				url: 'https://unknown-tool.battery.example.org/launch',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(noTool.success).toEqual([]);
		expect(noTool.error[0]).toMatchObject({ errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(String(noTool.error[0].errorMessage)).toContain('No tool found for the provided URL');

		const badCustom = await runNode({
			resource: 'ltiResourceLink',
			operation: 'create',
			params: {
				courseId,
				url: launch('bad-custom'),
				additionalFields: { custom: '{"number": 5}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badCustom.success).toEqual([]);
		expect(String(badCustom.error[0].errorMessage)).toContain("'custom' param must contain key/value pairs");

		const notJson = await runNode({
			resource: 'ltiResourceLink',
			operation: 'create',
			params: {
				courseId,
				url: launch('not-json'),
				additionalFields: { custom: 'chapter=1' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(String(notJson.error[0].errorMessage)).toMatch(/Invalid JSON in Custom/);
	});

	it('bulkCreate: creates every link of the array, or none when one is invalid', async () => {
		const before = await canvas().getAll<Json>(base());
		const links = await runOk({
			resource: 'ltiResourceLink',
			operation: 'bulkCreate',
			params: {
				courseId,
				resourceLinks: JSON.stringify([
					{ url: launch('bulk/1'), title: 'Bulk 1', custom: { n: '1' } },
					{ url: launch('bulk/2'), title: 'Bulk 2 – 第二' },
					{ url: launch('bulk/3') },
				]),
			},
		});
		expect(links).toHaveLength(3);
		const after = await canvas().getAll<Json>(base());
		expect(after).toHaveLength(before.length + 3);
		const created = after.filter((l) => links.some((n) => n.id === l.id));
		expect(created.map((l) => l.url).sort()).toEqual([launch('bulk/1'), launch('bulk/2'), launch('bulk/3')]);
		expect(created.find((l) => l.url === launch('bulk/1'))).toMatchObject({ title: 'Bulk 1', custom: { n: '1' } });
		expect(created.find((l) => l.url === launch('bulk/2'))).toMatchObject({ title: 'Bulk 2 – 第二' });

		const invalid = await runNode({
			resource: 'ltiResourceLink',
			operation: 'bulkCreate',
			params: {
				courseId,
				resourceLinks: JSON.stringify([
					{ url: launch('bulk/4') },
					{ url: 'https://unknown-tool.battery.example.org/launch' },
				]),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', operation: 'bulkCreate' });
		expect(String(invalid.error[0].errorMessage)).toContain('No tool found for the provided URL');
		expect(await canvas().getAll<Json>(base())).toHaveLength(before.length + 3);
	});

	it('bulkCreate: an empty array, something that is not an array and more than 100 links', async () => {
		for (const [resourceLinks, message] of [
			['[]', /At least one resource link/],
			['{"url": "https://example.com"}', /must be a JSON array/],
			['[{"url": ', /Invalid JSON/],
		] as Array<[string, RegExp]>) {
			const result = await runNode({
				resource: 'ltiResourceLink',
				operation: 'bulkCreate',
				params: { courseId, resourceLinks, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(String(result.error[0].errorMessage)).toMatch(message);
		}

		const tooMany = await runNode({
			resource: 'ltiResourceLink',
			operation: 'bulkCreate',
			params: {
				courseId,
				resourceLinks: JSON.stringify(Array.from({ length: 101 }, (_, i) => ({ url: launch(`many/${i}`) }))),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(tooMany.success).toEqual([]);
		expect(String(tooMany.error[0].errorMessage)).toContain('Cannot create more than 100 resource links at once');
	});

	it('get: by ID, by lookup UUID and by resource link UUID', async () => {
		const result = await runNode({
			resource: 'ltiResourceLink',
			operation: 'get',
			items: [
				{ id: Number(linkId) },
				{ id: `lookup_uuid:${String(link.lookup_uuid)}` },
				{ id: `resource_link_uuid:${String(link.resource_link_uuid)}` },
				{ id: 'lookup_uuid:00000000-0000-0000-0000-000000000000' },
			],
			params: { courseId, resourceLinkId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((l) => l.id)).toEqual([Number(linkId), Number(linkId), Number(linkId)]);
		expect(result.success[0]).toMatchObject({ lookup_uuid: link.lookup_uuid, url: link.url });
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });
	});

	it('update: URL, custom parameters and tool', async () => {
		const [updated] = await runOk({
			resource: 'ltiResourceLink',
			operation: 'update',
			params: {
				courseId,
				resourceLinkId: `lookup_uuid:${String(link.lookup_uuid)}`,
				updateFields: {
					url: launch('chapter/2'),
					custom: '{"chapter": "2"}',
					context_external_tool_id: externalToolId,
				},
			},
		});
		expect(updated.id).toBe(Number(linkId));
		const actual = await canvas().get<Json>(`${base()}/${linkId}`);
		expect(actual).toMatchObject({
			url: launch('chapter/2'),
			custom: { chapter: '2' },
			context_external_tool_id: Number(externalToolId),
			title: link.title,
		});
	});

	it('update: Canvas refuses a URL that does not belong to the tool of the link', async () => {
		const result = await runNode({
			resource: 'ltiResourceLink',
			operation: 'update',
			params: {
				courseId,
				resourceLinkId: linkId,
				updateFields: { url: 'https://other-host.battery.example.org/launch' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect(String(result.error[0].errorMessage)).toMatch(/must match the tool/);
		expect((await canvas().get<Json>(`${base()}/${linkId}`)).url).toBe(launch('chapter/2'));
	});

	it('getAll: every link of a course with many links, exactly once', async () => {
		for (let batch = 0; batch < 2; batch++) {
			await canvas().post(
				`${base()}/bulk`,
				Array.from({ length: 30 }, (_, i) => ({ url: launch(`page/${batch}/${i}`), title: `Page ${batch}-${i}` })),
			);
		}
		// Links that belong to content: an external tool assignment and a module item.
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: {
				name: unique('LTI 1.3 assignment'),
				submission_types: ['external_tool'],
				external_tool_tag_attributes: { url: launch('assignment'), content_type: 'ContextExternalTool', content_id: externalToolId },
				points_possible: 10,
			},
		});
		expect(assignment.id).toBeTypeOf('number');

		const expected = await canvas().getAll<Json>(base());
		expect(expected.length).toBeGreaterThan(60);
		const assignmentLink = expected.find((l) => l.resource_type === 'assignment');
		expect(assignmentLink, 'the external tool assignment should own a resource link').toBeDefined();
		assignmentLinkId = String(assignmentLink!.id);

		const defaults = await runOk({ resource: 'ltiResourceLink', operation: 'getAll', params: { courseId } });
		expect(defaults.map((l) => l.id)).toEqual(expected.slice(0, 50).map((l) => l.id));

		const all = await runOk({
			resource: 'ltiResourceLink',
			operation: 'getAll',
			params: { courseId, pagination: { returnAll: true } },
		});
		expect(all.map((l) => l.id)).toEqual(expected.map((l) => l.id));
		expect(new Set(all.map((l) => l.id)).size).toBe(all.length);

		const twoPages = await runOk({
			resource: 'ltiResourceLink',
			operation: 'getAll',
			params: { courseId, pagination: { perPage: 7, maxPages: 3 } },
		});
		expect(twoPages.map((l) => l.id)).toEqual(expected.slice(0, 21).map((l) => l.id));
	});

	it('delete: only links that are not tied to content can be deleted', async () => {
		const [deleted] = await runOk({
			resource: 'ltiResourceLink',
			operation: 'delete',
			params: { courseId, resourceLinkId: `resource_link_uuid:${String(link.resource_link_uuid)}` },
		});
		expect(deleted).toMatchObject({ id: Number(linkId), workflow_state: 'deleted' });
		expect((await canvas().request('GET', `${base()}/${linkId}`)).status).toBe(404);

		const refused = await runNode({
			resource: 'ltiResourceLink',
			operation: 'delete',
			params: { courseId, resourceLinkId: assignmentLinkId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'VALIDATION_ERROR', operation: 'delete' });
		expect(String(refused.error[0].errorMessage)).toContain('Cannot delete resource links associated with');
		expect((await canvas().get<Json>(`${base()}/${assignmentLinkId}`)).workflow_state).toBe('active');
	});

	it('include deleted: off (even explicitly) hides deleted links, on finds, lists and updates them', async () => {
		const hidden = await runNode({
			resource: 'ltiResourceLink',
			operation: 'get',
			params: {
				courseId,
				resourceLinkId: linkId,
				options: { include_deleted: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(hidden.success).toEqual([]);
		expect(hidden.error[0]).toMatchObject({ errorCode: 404 });

		const [found] = await runOk({
			resource: 'ltiResourceLink',
			operation: 'get',
			params: { courseId, resourceLinkId: linkId, options: { include_deleted: true } },
		});
		expect(found).toMatchObject({ id: Number(linkId), workflow_state: 'deleted' });

		const active = await canvas().getAll<Json>(base());
		const withDeleted = await canvas().getAll<Json>(`${base()}?include_deleted=true`);
		expect(withDeleted.length).toBe(active.length + 1);

		const listedWithout = await runOk({
			resource: 'ltiResourceLink',
			operation: 'getAll',
			params: { courseId, options: { include_deleted: false }, pagination: { returnAll: true } },
		});
		expect(listedWithout.map((l) => l.id)).toEqual(active.map((l) => l.id));
		const listedWith = await runOk({
			resource: 'ltiResourceLink',
			operation: 'getAll',
			params: { courseId, options: { include_deleted: true }, pagination: { returnAll: true } },
		});
		expect(listedWith.map((l) => l.id)).toEqual(withDeleted.map((l) => l.id));
		expect(listedWith.find((l) => l.id === Number(linkId))).toMatchObject({ workflow_state: 'deleted' });

		const refused = await runNode({
			resource: 'ltiResourceLink',
			operation: 'update',
			params: {
				courseId,
				resourceLinkId: linkId,
				updateFields: { custom: '{"chapter": "3"}', include_deleted: false },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 404 });

		await runOk({
			resource: 'ltiResourceLink',
			operation: 'update',
			params: { courseId, resourceLinkId: linkId, updateFields: { custom: '{"chapter": "3"}', include_deleted: true } },
		});
		const actual = await canvas().get<Json>(`${base()}/${linkId}?include_deleted=true`);
		expect(actual).toMatchObject({ custom: { chapter: '3' }, workflow_state: 'deleted' });
	});

	it('errors: students may not read resource links; a course without the tool has none', async () => {
		const asStudent = await runNode({
			resource: 'ltiResourceLink',
			operation: 'getAll',
			persona: 'student',
			params: { courseId: fx('courseId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'ltiResourceLink' });
		expect([401, 403]).toContain(asStudent.error[0].errorCode);

		const empty = await runOk({
			resource: 'ltiResourceLink',
			operation: 'getAll',
			params: { courseId: fx('emptyCourseId') },
		});
		expect(empty).toEqual([]);
	});
});
