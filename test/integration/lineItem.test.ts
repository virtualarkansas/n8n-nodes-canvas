import { generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import {
	createLtiPersona,
	createTokenPersona,
	deleteLtiTool,
	deployLtiTool,
	ltiAdvantageToken,
	ltiRequest,
	registerLtiTool,
	storeSessionToken,
} from './lti-advantage.helper';
import type { LtiTool } from './lti-advantage.helper';

/**
 * Resource: lineItem (LTI Advantage Assignment and Grade Services).
 *
 * Canvas serves line items under /api/lti and only to an LTI 1.3 tool that
 * authenticates with an LTI Advantage access token; a user's API token is
 * refused. To exercise the operations for real, the battery acts as such a
 * tool: it registers one, installs it in its own course and stores its key in
 * an n8n "Canvas LTI Advantage API" credential (persona `ltiLineItem`), with
 * which the node obtains the token itself.
 */
describe('lineItem', () => {
	const persona = 'ltiLineItem';
	let courseId = '';
	let tool: LtiTool | undefined;
	let token = '';
	let removePersona: (() => Promise<void>) | undefined;
	let lineItemId = '';
	let lineItemUrl = '';
	let assignmentId = '';
	let resourceLinkUuid = '';
	const label = unique('Battery line item Ünïcødé 行 "quoted" & <b>tags</b>');
	const path = (): string => `/api/lti/courses/${courseId}/line_items`;
	const numericId = (item: Json): string => String(item.id).split('/').pop() as string;

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Line item battery course') },
			offer: true,
		});
		courseId = String(course.id);
		tool = await registerLtiTool('lineitem');
		await deployLtiTool(tool, courseId);
		// For the battery's own checks; the node gets its token through the credential.
		token = await ltiAdvantageToken(tool);
		removePersona = await createLtiPersona(persona, tool);
	});

	afterAll(async () => {
		await removePersona?.();
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		await deleteLtiTool(tool);
	});

	it('credential: a stale token is renewed, a token pasted into a Canvas API credential works too', async () => {
		const removeStale = await createLtiPersona('ltiStaleToken', tool as LtiTool);
		const removePasted = await createTokenPersona('ltiPastedToken', token);
		try {
			// As after an hour: the stored token is no longer accepted. Canvas answers 401, n8n fetches a new one.
			await storeSessionToken('ltiStaleToken', tool as LtiTool, 'no-longer-valid');
			for (const credential of ['ltiStaleToken', 'ltiPastedToken']) {
				const result = await runNode({ resource: 'lineItem', operation: 'getAll', persona: credential, params: { courseId } });
				expect(result.failure, credential).toBeUndefined();
				expect(result.error, credential).toEqual([]);
			}
			// The same credential reaches any /api/lti path through Custom API Request.
			const custom = await runNode({
				resource: 'apiRequest',
				operation: 'request',
				persona,
				params: { method: 'GET', path: `/api/lti/courses/${courseId}/line_items` },
			});
			expect(custom.failure).toBeUndefined();
			expect(custom.error).toEqual([]);
		} finally {
			await removeStale();
			await removePasted();
		}
	});

	it('credential: a key Canvas does not know and a scope the developer key lacks are refused with Canvas\' reason', async () => {
		const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
		const cases: Array<[string, Json]> = [
			['ltiWrongKey', { privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string }],
			['ltiWrongScope', { scopes: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly' }],
			['ltiNoKey', { privateKey: 'not a key' }],
		];
		for (const [credential, overrides] of cases) {
			const remove = await createLtiPersona(credential, tool as LtiTool, overrides);
			try {
				const result = await runNode({
					resource: 'lineItem',
					operation: 'getAll',
					persona: credential,
					params: { courseId, errorHandling: { onError: 'continueWithError' } },
				});
				expect(result.success, credential).toEqual([]);
				const text = JSON.stringify(result.error[0] ?? result.failure ?? {});
				expect(text, credential).toMatch(
					credential === 'ltiNoKey' ? /private key/i : credential === 'ltiWrongScope' ? /scope/i : /JWS|signature|invalid/i,
				);
			} finally {
				await remove();
			}
		}
	});

	it('a personal API token is refused by the LTI services (401), whatever its permissions', async () => {
		const result = await runNode({
			resource: 'lineItem',
			operation: 'getAll',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 401,
			errorType: 'UNAUTHORIZED',
			resource: 'lineItem',
			operation: 'getAll',
			endpoint: `/api/lti/courses/${courseId}/line_items`,
		});
		expect(String(result.error[0].errorMessage)).toContain('Invalid access token format');
	});

	it('create: every optional field reaches Canvas, including the assignment behind the line item', async () => {
		const [created] = await runOk({
			resource: 'lineItem',
			operation: 'create',
			persona,
			params: {
				courseId,
				label,
				scoreMaximum: 42.5,
				additionalFields: {
					resourceId: 'resource-1',
					tag: 'battery tag',
					startDateTime: '2030-01-10T08:00:00Z',
					endDateTime: '2030-02-10T23:59:00Z',
					submissionType: 'external_tool',
					submissionExternalToolUrl: `https://${tool!.host}/launch/graded?item=1`,
				},
			},
		});
		lineItemUrl = String(created.id);
		lineItemId = numericId(created);
		expect(lineItemUrl).toBe(`${canvas().url}${path()}/${lineItemId}`);

		const actual = await ltiRequest(token, 'GET', `${path()}/${lineItemId}`);
		expect(actual.status).toBe(200);
		expect(actual.data).toMatchObject({
			id: lineItemUrl,
			label,
			scoreMaximum: 42.5,
			resourceId: 'resource-1',
			tag: 'battery tag',
			startDateTime: '2030-01-10T08:00:00Z',
			endDateTime: '2030-02-10T23:59:00Z',
		});
		resourceLinkUuid = String((actual.data as Json).resourceLinkId);
		expect(resourceLinkUuid).toMatch(/^[0-9a-f-]{36}$/);

		const assignments = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments`);
		expect(assignments).toHaveLength(1);
		assignmentId = String(assignments[0].id);
		expect(assignments[0]).toMatchObject({
			name: label,
			points_possible: 42.5,
			unlock_at: '2030-01-10T08:00:00Z',
			due_at: '2030-02-10T23:59:00Z',
			submission_types: ['external_tool'],
			external_tool_tag_attributes: { url: `https://${tool!.host}/launch/graded?item=1` },
		});
	});

	it('create: only label and score; and a second line item attached to an existing resource link', async () => {
		const [plain] = await runOk({
			resource: 'lineItem',
			operation: 'create',
			persona,
			// Numbers arriving from an expression.
			items: [{ course: Number(courseId), max: 0 }],
			params: { courseId: '={{ $json.course }}', label: 'Plain line item', scoreMaximum: '={{ $json.max }}' },
		});
		const plainActual = await ltiRequest(token, 'GET', `${path()}/${numericId(plain)}`);
		expect(plainActual.data).toMatchObject({ label: 'Plain line item', scoreMaximum: 0 });
		const plainAssignment = (await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments`)).find(
			(a) => a.name === 'Plain line item',
		);
		// Without the submission type extension the assignment takes no submissions.
		expect(plainAssignment).toMatchObject({ points_possible: 0, submission_types: ['none'] });

		const [attached] = await runOk({
			resource: 'lineItem',
			operation: 'create',
			persona,
			params: {
				courseId,
				label: 'Extra column of the same assignment',
				scoreMaximum: 10,
				additionalFields: { resourceLinkId: resourceLinkUuid, tag: 'extra' },
			},
		});
		const attachedActual = await ltiRequest(token, 'GET', `${path()}/${numericId(attached)}`);
		expect(attachedActual.data).toMatchObject({
			label: 'Extra column of the same assignment',
			scoreMaximum: 10,
			tag: 'extra',
			resourceLinkId: resourceLinkUuid,
		});
		// No further assignment was created for it.
		expect(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments`)).toHaveLength(2);
	});

	it('create: an unknown resource link is a 404', async () => {
		const result = await runNode({
			resource: 'lineItem',
			operation: 'create',
			persona,
			params: {
				courseId,
				label: 'Nowhere',
				scoreMaximum: 5,
				additionalFields: { resourceLinkId: '00000000-0000-0000-0000-000000000000' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'create' });
	});

	it('get: by number and by the URL Canvas returns as "id", with the launch URL', async () => {
		const result = await runNode({
			resource: 'lineItem',
			operation: 'get',
			persona,
			items: [{ id: Number(lineItemId) }, { id: lineItemUrl }, { id: '99999999' }],
			params: {
				courseId,
				lineItemId: '={{ $json.id }}',
				options: { include: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toHaveLength(2);
		for (const item of result.success) {
			expect(item).toMatchObject({ id: lineItemUrl, label, scoreMaximum: 42.5 });
			expect(item['https://canvas.instructure.com/lti/launch_url']).toBe(
				`https://${tool!.host}/launch/graded?item=1`,
			);
		}
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });

		const [withoutLaunchUrl] = await runOk({
			resource: 'lineItem',
			operation: 'get',
			persona,
			params: { courseId, lineItemId, options: { include: false } },
		});
		expect(withoutLaunchUrl['https://canvas.instructure.com/lti/launch_url']).toBeUndefined();
	});

	it('update: every optional field reaches Canvas and the assignment follows', async () => {
		const renamed = `${label} (renamed)`;
		const [updated] = await runOk({
			resource: 'lineItem',
			operation: 'update',
			persona,
			params: {
				courseId,
				lineItemId: lineItemUrl,
				updateFields: {
					label: renamed,
					scoreMaximum: 77,
					resourceId: 'resource-2',
					tag: 'second tag',
					startDateTime: '2031-03-01T09:00:00Z',
					endDateTime: '2031-04-01T22:00:00Z',
				},
			},
		});
		expect(updated).toMatchObject({ id: lineItemUrl, label: renamed });

		const actual = await ltiRequest(token, 'GET', `${path()}/${lineItemId}`);
		expect(actual.data).toMatchObject({
			label: renamed,
			scoreMaximum: 77,
			resourceId: 'resource-2',
			tag: 'second tag',
			startDateTime: '2031-03-01T09:00:00Z',
			endDateTime: '2031-04-01T22:00:00Z',
		});
		const assignment = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
		expect(assignment).toMatchObject({
			name: renamed,
			points_possible: 77,
			unlock_at: '2031-03-01T09:00:00Z',
			due_at: '2031-04-01T22:00:00Z',
		});
	});

	it('getAll: pages through the line items of the tool and filters them', async () => {
		for (let i = 0; i < 24; i++) {
			const created = await ltiRequest(token, 'POST', path(), {
				label: `Bulk line item ${String(i).padStart(2, '0')}`,
				scoreMaximum: i,
				tag: i % 2 === 0 ? 'even' : 'odd',
				resourceId: `bulk-${i % 3}`,
			});
			expect(created.status).toBe(201);
		}
		const expected: Json[] = [];
		for (let page = 1; ; page++) {
			const res = await ltiRequest(token, 'GET', `${path()}?per_page=50&page=${page}`);
			const items = res.data as Json[];
			expected.push(...items);
			if (items.length < 50) break;
		}
		expect(expected).toHaveLength(27);

		const defaults = await runOk({ resource: 'lineItem', operation: 'getAll', persona, params: { courseId } });
		expect(defaults.map((l) => l.id).sort()).toEqual(expected.map((l) => l.id).sort());

		const all = await runOk({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId, pagination: { returnAll: true } },
		});
		expect(all.map((l) => l.id).sort()).toEqual(expected.map((l) => l.id).sort());
		expect(new Set(all.map((l) => l.id)).size).toBe(27);

		const twoPages = await runOk({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(10);
		expect(new Set(twoPages.map((l) => l.id)).size).toBe(10);

		const even = await runOk({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId, options: { tag: 'even' }, pagination: { returnAll: true } },
		});
		expect(even).toHaveLength(12);
		expect(even.every((l) => l.tag === 'even')).toBe(true);

		const byResource = await runOk({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId, options: { resource_id: 'bulk-0', tag: 'odd' }, pagination: { returnAll: true } },
		});
		expect(byResource).toHaveLength(4);
		expect(byResource.every((l) => l.resourceId === 'bulk-0' && l.tag === 'odd')).toBe(true);

		const byLink = await runOk({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId, options: { resource_link_id: resourceLinkUuid, include: true } },
		});
		expect(byLink.map((l) => l.label).sort()).toEqual(['Extra column of the same assignment', `${label} (renamed)`].sort());
		expect(byLink.every((l) => typeof l['https://canvas.instructure.com/lti/launch_url'] === 'string')).toBe(true);

		const none = await runOk({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId, options: { tag: 'no such tag', include: false } },
		});
		expect(none).toEqual([]);
	});

	it('delete: removes the line item (and its assignment)', async () => {
		const [deleted] = await runOk({
			resource: 'lineItem',
			operation: 'delete',
			persona,
			params: { courseId, lineItemId: lineItemUrl },
		});
		expect(deleted).toEqual({ success: true });
		expect((await ltiRequest(token, 'GET', `${path()}/${lineItemId}`)).status).toBe(404);
		const assignment = await canvas().request('GET', `/api/v1/courses/${courseId}/assignments/${assignmentId}`);
		expect((assignment.data as Json).workflow_state ?? assignment.status).toSatisfy(
			(value: unknown) => value === 'deleted' || value === 404,
		);

		const again = await runNode({
			resource: 'lineItem',
			operation: 'delete',
			persona,
			params: { courseId, lineItemId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'delete' });
	});

	it('errors: a course where the tool is not installed is off limits for its token', async () => {
		const result = await runNode({
			resource: 'lineItem',
			operation: 'getAll',
			persona,
			params: { courseId: fx('courseId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 401, errorType: 'UNAUTHORIZED' });
		expect(String(result.error[0].errorMessage)).toContain('Access Token not linked to a Tool associated with this Context');
	});

	it('debug mode: shows the LTI endpoint and the AGS body the node would send', async () => {
		const result = await runNode({
			resource: 'lineItem',
			operation: 'create',
			params: {
				debugMode: true,
				courseId: '77',
				label: 'Debug',
				scoreMaximum: 5,
				additionalFields: { submissionType: 'none', tag: 't' },
			},
		});
		expect(result.debug[0]).toMatchObject({
			method: 'POST',
			url: `${canvas().url}/api/lti/courses/77/line_items`,
			body: {
				label: 'Debug',
				scoreMaximum: 5,
				tag: 't',
				'https://canvas.instructure.com/lti/submission_type': { type: 'none' },
			},
		});
	});
});
