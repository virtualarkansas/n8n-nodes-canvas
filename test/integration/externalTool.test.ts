import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { deleteLtiTool, registerLtiTool } from './lti-advantage.helper';
import type { LtiTool } from './lti-advantage.helper';

/**
 * Resource: externalTool. Everything destructive happens in a sub-account and
 * a course created for this file; the seeded tools are only read.
 */
describe('externalTool', () => {
	let accountId = '';
	let courseId = '';
	let secondCourseId = '';
	let groupId = '';
	let toolId = '';
	let accountToolId = '';
	let ltiTool: LtiTool | undefined;
	const name = unique('Battery Tool Ünïcødé 工具 "quoted" & <b>tags</b>');
	const xmlName = unique('Battery XML tool');

	beforeAll(async () => {
		const account = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, {
			account: { name: unique('External tool battery account') },
		});
		accountId = String(account.id);
		const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('External tool battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const second = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('External tool battery course 2') },
			offer: true,
		});
		secondCourseId = String(second.id);
		const category = await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, {
			name: unique('Tool groups'),
		});
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, {
			name: unique('Tool group'),
		});
		groupId = String(group.id);
	});

	afterAll(async () => {
		await deleteLtiTool(ltiTool);
		for (const id of [courseId, secondCourseId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		if (accountId) {
			const tools = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/external_tools`);
			for (const tool of tools) {
				await canvas().request('DELETE', `/api/v1/accounts/${accountId}/external_tools/${String(tool.id)}`);
			}
			await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/sub_accounts/${accountId}`);
		}
	});

	it('create (course, LTI 1.1): every optional field reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'externalTool',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId,
				authType: 'lti11',
				name,
				privacyLevel: 'name_only',
				consumerKey: 'battery-key',
				sharedSecret: 'battery-secret',
				additionalFields: {
					url: 'https://tool.battery.example.com/launch?a=1&b=2',
					description: 'Described with emoji 🧰 and <i>markup</i>',
					icon_url: 'https://tool.battery.example.com/icon.png',
					text: 'Default text',
					custom_fields: '{"course_code": "$Canvas.course.sisSourceId", "plain": "värde"}',
					is_rce_favorite: true,
					not_selectable: true,
					oauth_compliant: true,
					unified_tool_id: 'battery-utid-1',
					placements: JSON.stringify({
						course_navigation: { enabled: true, text: 'Nav label', visibility: 'admins', default: 'disabled' },
						editor_button: {
							enabled: true,
							url: 'https://tool.battery.example.com/editor',
							icon_url: 'https://tool.battery.example.com/editor.png',
							selection_width: 500,
							selection_height: 300,
						},
					}),
				},
			},
		});
		toolId = String(created.id);

		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/external_tools/${toolId}`);
		expect(actual).toMatchObject({
			name,
			privacy_level: 'name_only',
			consumer_key: 'battery-key',
			url: 'https://tool.battery.example.com/launch?a=1&b=2',
			description: 'Described with emoji 🧰 and <i>markup</i>',
			icon_url: 'https://tool.battery.example.com/icon.png',
			custom_fields: { course_code: '$Canvas.course.sisSourceId', plain: 'värde' },
			is_rce_favorite: true,
			not_selectable: true,
			unified_tool_id: 'battery-utid-1',
			version: '1.1',
		});
		expect(actual.course_navigation).toMatchObject({
			enabled: true,
			text: 'Nav label',
			visibility: 'admins',
			default: 'disabled',
		});
		expect(actual.editor_button).toMatchObject({
			enabled: true,
			url: 'https://tool.battery.example.com/editor',
			icon_url: 'https://tool.battery.example.com/editor.png',
			selection_width: 500,
			selection_height: 300,
			// The tool-level "text" is the label of placements without their own text.
			label: 'Default text',
		});
		// The shared secret is write-only: it must never come back.
		expect(JSON.stringify(actual)).not.toContain('battery-secret');
	});

	it('create (account): configuration by XML, matching by domain', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cartridge_basiclti_link xmlns="http://www.imsglobal.org/xsd/imslticc_v1p0"
    xmlns:blti="http://www.imsglobal.org/xsd/imsbasiclti_v1p0"
    xmlns:lticm="http://www.imsglobal.org/xsd/imslticm_v1p0"
    xmlns:lticp="http://www.imsglobal.org/xsd/imslticp_v1p0">
  <blti:title>Title from XML</blti:title>
  <blti:description>Description from XML</blti:description>
  <blti:launch_url>https://xml.battery.example.com/launch</blti:launch_url>
  <blti:extensions platform="canvas.instructure.com">
    <lticm:property name="privacy_level">public</lticm:property>
    <lticm:property name="domain">xml.battery.example.com</lticm:property>
    <lticm:options name="top_navigation">
      <lticm:property name="enabled">true</lticm:property>
      <lticm:property name="text">Top nav from XML</lticm:property>
    </lticm:options>
    <lticm:options name="editor_button">
      <lticm:property name="enabled">true</lticm:property>
      <lticm:property name="icon_url">https://xml.battery.example.com/icon.png</lticm:property>
      <lticm:property name="selection_width">400</lticm:property>
      <lticm:property name="selection_height">300</lticm:property>
    </lticm:options>
  </blti:extensions>
</cartridge_basiclti_link>`;
		const [created] = await runOk({
			resource: 'externalTool',
			operation: 'create',
			params: {
				contextType: 'account',
				accountId,
				authType: 'lti11',
				name: xmlName,
				privacyLevel: 'anonymous',
				consumerKey: 'xml-key',
				sharedSecret: 'xml-secret',
				additionalFields: { config_type: 'by_xml', config_xml: xml },
			},
		});
		accountToolId = String(created.id);

		const actual = await canvas().get<Json>(`/api/v1/accounts/${accountId}/external_tools/${accountToolId}`);
		expect(actual).toMatchObject({
			// "The name parameter overrides the tool name provided in the XML."
			name: xmlName,
			description: 'Description from XML',
			url: 'https://xml.battery.example.com/launch',
			domain: 'xml.battery.example.com',
			consumer_key: 'xml-key',
		});
		expect(actual.top_navigation).toMatchObject({ enabled: true, text: 'Top nav from XML' });
		expect(actual.editor_button).toMatchObject({ enabled: true });
	});

	it('create: a configuration URL Canvas cannot fetch is reported with Canvas\' message', async () => {
		const result = await runNode({
			resource: 'externalTool',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId,
				authType: 'lti11',
				name: unique('By URL'),
				privacyLevel: 'public',
				consumerKey: 'k',
				sharedSecret: 's',
				additionalFields: { config_type: 'by_url', config_url: 'https://config.battery.invalid/tool.xml' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'create' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('config_url');
	});

	it('create: without a URL, domain or configuration Canvas says what is missing', async () => {
		const result = await runNode({
			resource: 'externalTool',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId,
				authType: 'lti11',
				name: unique('No URL'),
				privacyLevel: 'public',
				consumerKey: 'k',
				sharedSecret: 's',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		// The text is in the language of the token's user; the fields are not.
		expect(String(result.error[0].errorMessage)).toMatch(/^url: .+; domain: .+/);
		expect(Object.keys(result.error[0].canvasErrors as Json)).toEqual(expect.arrayContaining(['url', 'domain']));
	});

	it('create (LTI 1.3): installs the tool of a client ID in a course and in an account', async () => {
		ltiTool = await registerLtiTool('exttool');
		const [inCourse] = await runOk({
			resource: 'externalTool',
			operation: 'create',
			params: { contextType: 'course', courseId: secondCourseId, authType: 'lti13', clientId: ltiTool.clientId },
		});
		const actual = await canvas().get<Json>(
			`/api/v1/courses/${secondCourseId}/external_tools/${String(inCourse.id)}`,
		);
		expect(actual).toMatchObject({ version: '1.3', url: ltiTool.launchUrl });
		// The registration reports the global ID of its developer key, the tool the local one.
		expect(BigInt(ltiTool.clientId) % 10_000_000_000_000n).toBe(BigInt(String(actual.developer_key_id)));

		const [inAccount] = await runOk({
			resource: 'externalTool',
			operation: 'create',
			params: { contextType: 'account', accountId, authType: 'lti13', clientId: ltiTool.clientId },
		});
		const accountTool = await canvas().get<Json>(
			`/api/v1/accounts/${accountId}/external_tools/${String(inAccount.id)}`,
		);
		expect(accountTool).toMatchObject({ version: '1.3' });
		await canvas().delete(`/api/v1/accounts/${accountId}/external_tools/${String(inAccount.id)}`);
	});

	it('create (LTI 1.3): an unknown client ID is a clear error', async () => {
		const result = await runNode({
			resource: 'externalTool',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId,
				authType: 'lti13',
				clientId: '99999999',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('get: in the course and in the account context, with IDs arriving as numbers', async () => {
		const [tool] = await runOk({
			resource: 'externalTool',
			operation: 'get',
			items: [{ course: Number(courseId), tool: Number(toolId) }],
			params: { contextType: 'course', courseId: '={{ $json.course }}', externalToolId: '={{ $json.tool }}' },
		});
		expect(tool).toMatchObject({ id: Number(toolId), name });

		const [accountTool] = await runOk({
			resource: 'externalTool',
			operation: 'get',
			params: { contextType: 'account', accountId, externalToolId: accountToolId },
		});
		expect(accountTool).toMatchObject({ id: Number(accountToolId), name: xmlName });

		const [seeded] = await runOk({
			resource: 'externalTool',
			operation: 'get',
			params: { contextType: 'account', accountId: fx('accountId'), externalToolId: fx('externalToolId') },
		});
		expect(seeded).toMatchObject({ id: Number(fx('externalToolId')), url: fx('externalToolUrl') });
	});

	it('get: a tool inherited from a parent account is not "in" the course', async () => {
		const result = await runNode({
			resource: 'externalTool',
			operation: 'get',
			items: [{ tool: toolId }, { tool: fx('externalToolId') }, { tool: '99999999' }],
			params: {
				contextType: 'course',
				courseId,
				externalToolId: '={{ $json.tool }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success.map((t) => t.id)).toEqual([Number(toolId)]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'externalTool', operation: 'get' });
		}
	});

	it('getAll: filters by search term, placement, selectable and parents', async () => {
		const own = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'course', courseId },
		});
		expect(own.map((t) => t.id)).toEqual([Number(toolId)]);

		const expectedWithParents = await canvas().getAll<Json>(
			`/api/v1/courses/${courseId}/external_tools?include_parents=true`,
		);
		expect(expectedWithParents.length).toBeGreaterThan(2);
		const withParents = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'course', courseId, options: { include_parents: true }, pagination: { returnAll: true } },
		});
		expect(withParents.map((t) => t.id).sort()).toEqual(expectedWithParents.map((t) => t.id).sort());
		expect(withParents.map((t) => t.id)).toEqual(
			expect.arrayContaining([Number(toolId), Number(accountToolId), Number(fx('externalToolId'))]),
		);

		const searched = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'course', courseId, options: { include_parents: true, search_term: 'Battery XML' } },
		});
		expect(searched.map((t) => t.id)).toEqual([Number(accountToolId)]);

		const topNav = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'course', courseId, options: { include_parents: true, placement: 'top_navigation' } },
		});
		expect(topNav.map((t) => t.id)).toContain(Number(accountToolId));
		expect(topNav.map((t) => t.id)).not.toContain(Number(toolId));

		// The course tool was created "not selectable".
		const selectable = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'course', courseId, options: { selectable: true } },
		});
		expect(selectable).toEqual([]);
		const explicitlyOff = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'course', courseId, options: { selectable: false, include_parents: false } },
		});
		expect(explicitlyOff.map((t) => t.id)).toEqual([Number(toolId)]);
	});

	it('getAll: account and group contexts', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${fx('accountId')}/external_tools`);
		const inAccount = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'account', accountId: fx('accountId'), pagination: { returnAll: true } },
		});
		expect(inAccount.map((t) => t.id).sort()).toEqual(expected.map((t) => t.id).sort());
		expect(inAccount.map((t) => t.id)).toContain(Number(fx('externalToolId')));

		// A group has no tools of its own...
		const inGroup = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'group', groupId },
		});
		expect(inGroup).toEqual([]);
		// ...but sees those of its course and accounts.
		const expectedForGroup = await canvas().getAll<Json>(
			`/api/v1/groups/${groupId}/external_tools?include_parents=true`,
		);
		const groupWithParents = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			params: { contextType: 'group', groupId, options: { include_parents: true }, pagination: { returnAll: true } },
		});
		expect(groupWithParents.map((t) => t.id).sort()).toEqual(expectedForGroup.map((t) => t.id).sort());
		expect(groupWithParents.map((t) => t.id)).toEqual(expect.arrayContaining([Number(toolId), Number(accountToolId)]));
	});

	it('getAll: pages through more tools than one page holds', async () => {
		const bulkCourse = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('Many tools') },
		});
		const bulkCourseId = String(bulkCourse.id);
		try {
			await Promise.all(
				Array.from({ length: 23 }, (_, i) =>
					canvas().post(`/api/v1/courses/${bulkCourseId}/external_tools`, {
						name: `Bulk tool ${String(i).padStart(2, '0')}`,
						privacy_level: 'anonymous',
						consumer_key: 'k',
						shared_secret: 's',
						url: `https://bulk${i}.battery.example.com/launch`,
					}),
				),
			);
			const expected = await canvas().getAll<Json>(`/api/v1/courses/${bulkCourseId}/external_tools`);
			expect(expected).toHaveLength(23);

			const defaults = await runOk({
				resource: 'externalTool',
				operation: 'getAll',
				params: { contextType: 'course', courseId: bulkCourseId },
			});
			expect(defaults.map((t) => t.id).sort()).toEqual(expected.map((t) => t.id).sort());

			const all = await runOk({
				resource: 'externalTool',
				operation: 'getAll',
				params: { contextType: 'course', courseId: bulkCourseId, pagination: { returnAll: true } },
			});
			expect(all.map((t) => t.id).sort()).toEqual(expected.map((t) => t.id).sort());

			const twoPages = await runOk({
				resource: 'externalTool',
				operation: 'getAll',
				params: { contextType: 'course', courseId: bulkCourseId, pagination: { perPage: 4, maxPages: 2 } },
			});
			expect(twoPages).toHaveLength(8);
			expect(new Set(twoPages.map((t) => t.id)).size).toBe(8);

			const onePage = await runOk({
				resource: 'externalTool',
				operation: 'getAll',
				params: { contextType: 'course', courseId: bulkCourseId, pagination: { perPage: 10, maxPages: 1 } },
			});
			expect(onePage).toHaveLength(10);
		} finally {
			await canvas().request('DELETE', `/api/v1/courses/${bulkCourseId}?event=delete`);
		}
	});

	it('update: every optional field reaches Canvas, and a placement set to null is removed', async () => {
		const renamed = `${name} (renamed)`;
		const [updated] = await runOk({
			resource: 'externalTool',
			operation: 'update',
			params: {
				contextType: 'course',
				courseId,
				externalToolId: toolId,
				updateFields: {
					name: renamed,
					privacy_level: 'public',
					consumer_key: 'battery-key-2',
					shared_secret: 'battery-secret-2',
					url: 'https://tool2.battery.example.com/launch',
					description: 'Second description',
					icon_url: 'https://tool2.battery.example.com/icon.png',
					text: 'Second text',
					custom_fields: '{"only": "this one"}',
					is_rce_favorite: false,
					not_selectable: false,
					oauth_compliant: false,
					unified_tool_id: 'battery-utid-2',
					placements: '{"course_navigation": null, "editor_button": {"enabled": false}, "user_navigation": {"enabled": true, "text": "Profile tool"}}',
				},
			},
		});
		expect(updated.name).toBe(renamed);

		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/external_tools/${toolId}`);
		expect(actual).toMatchObject({
			name: renamed,
			privacy_level: 'public',
			consumer_key: 'battery-key-2',
			url: 'https://tool2.battery.example.com/launch',
			description: 'Second description',
			icon_url: 'https://tool2.battery.example.com/icon.png',
			custom_fields: { only: 'this one' },
			is_rce_favorite: false,
			not_selectable: false,
			unified_tool_id: 'battery-utid-2',
			course_navigation: null,
		});
		expect(actual.editor_button).toMatchObject({ enabled: false });
		expect(actual.user_navigation).toMatchObject({ enabled: true, text: 'Profile tool' });
	});

	it('update: switching from URL to domain matching in the account context', async () => {
		await runOk({
			resource: 'externalTool',
			operation: 'update',
			params: {
				contextType: 'account',
				accountId,
				externalToolId: accountToolId,
				updateFields: { domain: 'domain.battery.example.com', description: 'Updated in the account' },
			},
		});
		const actual = await canvas().get<Json>(`/api/v1/accounts/${accountId}/external_tools/${accountToolId}`);
		expect(actual).toMatchObject({ domain: 'domain.battery.example.com', description: 'Updated in the account' });
	});

	it('update: invalid JSON in Custom Fields is rejected before anything is sent', async () => {
		const result = await runNode({
			resource: 'externalTool',
			operation: 'update',
			params: {
				contextType: 'course',
				courseId,
				externalToolId: toolId,
				updateFields: { custom_fields: '{not json' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/Invalid JSON in Custom Fields/);
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/external_tools/${toolId}`);
		expect(actual.custom_fields).toEqual({ only: 'this one' });
	});

	it('getSessionlessLaunchUrl: by tool ID, by URL and for one placement', async () => {
		const [byId] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: { contextType: 'course', courseId, externalToolId: toolId },
		});
		// (The launch page itself cannot be rendered by the local Canvas, which has no compiled
		// front-end assets, so the launch URL is checked but not followed.)
		expect(byId).toMatchObject({ id: Number(toolId), name: `${name} (renamed)` });
		expect(String(byId.url)).toMatch(
			new RegExp(`/courses/${courseId}/external_tools/sessionless_launch\\?.*verifier=[0-9a-f]{32,}`),
		);

		const [byUrl] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: {
				contextType: 'course',
				courseId,
				options: { url: 'https://tool2.battery.example.com/launch?from=url' },
			},
		});
		expect(byUrl).toMatchObject({ id: Number(toolId) });
		expect(String(byUrl.url)).toContain('verifier=');
		expect(byUrl.url).not.toBe(byId.url);

		// A URL no installed tool matches: Canvas answers 200 with an "errors" object instead of
		// a launch URL, so the item arrives on the Success output without a "url".
		const [unmatched] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: { contextType: 'course', courseId, options: { url: 'https://nobody.battery.example.org/launch' } },
		});
		expect(unmatched).toEqual({ errors: { external_tool: 'Unable to find a matching external tool' } });

		const [byPlacement] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: { contextType: 'course', courseId, externalToolId: toolId, options: { launch_type: 'user_navigation' } },
		});
		expect(byPlacement).toMatchObject({ id: Number(toolId) });
		expect(String(byPlacement.url)).toContain('verifier=');
	});

	it('getSessionlessLaunchUrl: account context', async () => {
		const [launch] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: { contextType: 'account', accountId, externalToolId: accountToolId },
		});
		expect(launch).toMatchObject({ id: Number(accountToolId) });
		expect(String(launch.url)).toMatch(
			new RegExp(`/accounts/${accountId}/external_tools/sessionless_launch\\?.*verifier=`),
		);
	});

	it('getSessionlessLaunchUrl: an external tool assignment and a module item', async () => {
		const toolUrl = 'https://tool2.battery.example.com/launch?assignment=1';
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: {
				name: unique('Tool assignment'),
				submission_types: ['external_tool'],
				external_tool_tag_attributes: { url: toolUrl, new_tab: false },
				points_possible: 10,
				published: true,
			},
		});
		const [assessment] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: {
				contextType: 'course',
				courseId,
				options: { launch_type: 'assessment', assignment_id: String(assignment.id) },
			},
		});
		expect(assessment).toMatchObject({ id: Number(toolId) });
		expect(String(assessment.url)).toContain(`/courses/${courseId}/external_tools/sessionless_launch`);
		expect(String(assessment.url)).toContain('verifier=');

		const module = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules`, { module: { name: 'Tools' } });
		const item = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules/${String(module.id)}/items`, {
			module_item: {
				type: 'ExternalTool',
				title: 'Module tool',
				external_url: 'https://tool2.battery.example.com/launch?module=1',
				content_id: toolId,
			},
		});
		const [moduleItem] = await runOk({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: {
				contextType: 'course',
				courseId,
				options: { launch_type: 'module_item', module_item_id: String(item.id) },
			},
		});
		expect(moduleItem).toMatchObject({ id: Number(toolId) });
		expect(String(moduleItem.url)).toContain('verifier=');

		const wrongItem = await runNode({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: {
				contextType: 'course',
				courseId,
				options: { launch_type: 'module_item', module_item_id: '99999999' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongItem.success).toEqual([]);
		expect([400, 404]).toContain(wrongItem.error[0].errorCode);
	});

	it('getSessionlessLaunchUrl: nothing to identify the tool is a clear error', async () => {
		const result = await runNode({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: { contextType: 'course', courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		const noAssignment = await runNode({
			resource: 'externalTool',
			operation: 'getSessionlessLaunchUrl',
			params: {
				contextType: 'course',
				courseId,
				options: { launch_type: 'assessment' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(noAssignment.error[0]).toMatchObject({ errorCode: 400 });
		expect(String(noAssignment.error[0].errorMessage)).toMatch(/assignment_id/);
	});

	it('getVisibleCourseNavTools: one course, several courses', async () => {
		await canvas().post(`/api/v1/courses/${secondCourseId}/external_tools`, {
			name: 'Visible nav tool',
			privacy_level: 'anonymous',
			consumer_key: 'k',
			shared_secret: 's',
			url: 'https://nav.battery.example.com/launch',
			course_navigation: { enabled: true, text: 'Visible nav' },
		});
		const expectedOne = await canvas().get<Json[]>(
			`/api/v1/courses/${secondCourseId}/external_tools/visible_course_nav_tools`,
		);
		expect(expectedOne.map((t) => t.name)).toContain('Visible nav tool');

		const one = await runOk({
			resource: 'externalTool',
			operation: 'getVisibleCourseNavTools',
			params: { courseIds: secondCourseId },
		});
		expect(one.map((t) => t.id)).toEqual(expectedOne.map((t) => t.id));
		expect(one.every((t) => t.context_id === Number(secondCourseId))).toBe(true);

		await canvas().post(`/api/v1/courses/${courseId}/external_tools`, {
			name: 'Another visible nav tool',
			privacy_level: 'anonymous',
			consumer_key: 'k',
			shared_secret: 's',
			url: 'https://nav2.battery.example.com/launch',
			course_navigation: { enabled: true, text: 'Visible nav 2' },
		});
		const expectedMany = await canvas().get<Json[]>(
			`/api/v1/external_tools/visible_course_nav_tools?context_codes[]=course_${secondCourseId}&context_codes[]=course_${courseId}`,
		);
		const many = await runOk({
			resource: 'externalTool',
			operation: 'getVisibleCourseNavTools',
			params: { courseIds: ` ${secondCourseId}, ${courseId} ` },
		});
		expect(many.map((t) => `${String(t.context_id)}:${String(t.id)}`)).toEqual(
			expectedMany.map((t) => `${String(t.context_id)}:${String(t.id)}`),
		);
		expect(new Set(many.map((t) => t.context_id))).toEqual(new Set([Number(secondCourseId), Number(courseId)]));
		expect(many.map((t) => t.name)).toEqual(expect.arrayContaining(['Visible nav tool', 'Another visible nav tool']));

		// The tools a student sees in the navigation, not the ones the admin sees.
		const student = new CanvasClient('student');
		const expectedStudent = await student.get<Json[]>(
			`/api/v1/courses/${fx('courseId')}/external_tools/visible_course_nav_tools`,
		);
		const asStudent = await runOk({
			resource: 'externalTool',
			operation: 'getVisibleCourseNavTools',
			persona: 'student',
			params: { courseIds: `sis_course_id:${fx('courseSisId')}` },
		});
		expect(asStudent.map((t) => t.id)).toEqual(expectedStudent.map((t) => t.id));
	});

	it('favorites: RCE and top navigation favorites of an account', async () => {
		const [added] = await runOk({
			resource: 'externalTool',
			operation: 'addRceFavorite',
			params: { accountId, externalToolId: accountToolId },
		});
		expect(added).toEqual({ rce_favorite_tool_ids: [Number(accountToolId)] });
		expect(
			(await canvas().get<Json>(`/api/v1/accounts/${accountId}/external_tools/${accountToolId}`)).is_rce_favorite,
		).toBe(true);

		const [removed] = await runOk({
			resource: 'externalTool',
			operation: 'removeRceFavorite',
			params: { accountId, externalToolId: accountToolId },
		});
		expect(removed).toEqual({ rce_favorite_tool_ids: [] });
		expect(
			(await canvas().get<Json>(`/api/v1/accounts/${accountId}/external_tools/${accountToolId}`)).is_rce_favorite,
		).toBe(false);

		const [topAdded] = await runOk({
			resource: 'externalTool',
			operation: 'addTopNavFavorite',
			params: { accountId, externalToolId: accountToolId },
		});
		expect(topAdded).toEqual({ top_nav_favorite_tool_ids: [Number(accountToolId)] });
		const [topRemoved] = await runOk({
			resource: 'externalTool',
			operation: 'removeTopNavFavorite',
			params: { accountId, externalToolId: accountToolId },
		});
		expect(topRemoved).toEqual({ top_nav_favorite_tool_ids: [] });
	});

	it('favorites: a tool without the placement is refused with Canvas\' reason', async () => {
		const plain = await canvas().post<Json>(`/api/v1/accounts/${accountId}/external_tools`, {
			name: 'No placements',
			privacy_level: 'anonymous',
			consumer_key: 'k',
			shared_secret: 's',
			url: 'https://plain.battery.example.com/launch',
		});
		for (const operation of ['addRceFavorite', 'addTopNavFavorite']) {
			const result = await runNode({
				resource: 'externalTool',
				operation,
				params: { accountId, externalToolId: String(plain.id), errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation });
			expect(String(result.error[0].errorMessage)).toMatch(/placement/);
		}
	});

	it('errors: a student may list course tools but not install, change or delete them', async () => {
		const listed = await runOk({
			resource: 'externalTool',
			operation: 'getAll',
			persona: 'student',
			params: { contextType: 'course', courseId: fx('courseId'), options: { include_parents: true } },
		});
		expect(listed.map((t) => t.id)).toContain(Number(fx('externalToolId')));

		const created = await runNode({
			resource: 'externalTool',
			operation: 'create',
			persona: 'student',
			params: {
				contextType: 'course',
				courseId: fx('courseId'),
				authType: 'lti11',
				name: unique('Forbidden tool'),
				privacyLevel: 'anonymous',
				consumerKey: 'k',
				sharedSecret: 's',
				additionalFields: { url: 'https://forbidden.battery.example.com' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(created.success).toEqual([]);
		expect(created.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(created.error[0].errorCode);
	});

	it('delete: removes the tool in both contexts; a second delete is a 404', async () => {
		const [deleted] = await runOk({
			resource: 'externalTool',
			operation: 'delete',
			params: { contextType: 'course', courseId, externalToolId: toolId },
		});
		expect(deleted).toMatchObject({ id: Number(toolId), workflow_state: 'deleted' });
		expect((await canvas().request('GET', `/api/v1/courses/${courseId}/external_tools/${toolId}`)).status).toBe(404);

		await runOk({
			resource: 'externalTool',
			operation: 'delete',
			params: { contextType: 'account', accountId, externalToolId: accountToolId },
		});
		expect(
			(await canvas().request('GET', `/api/v1/accounts/${accountId}/external_tools/${accountToolId}`)).status,
		).toBe(404);

		const again = await runNode({
			resource: 'externalTool',
			operation: 'delete',
			params: {
				contextType: 'course',
				courseId,
				externalToolId: toolId,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
	});
});
