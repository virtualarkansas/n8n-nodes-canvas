import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { eventually } from './content.helper';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import {
	createLtiPersona,
	deleteLtiTool,
	deployLtiTool,
	ltiAdvantageToken,
	ltiRequest,
	registerLtiTool,
} from './lti-advantage.helper';
import type { LtiTool } from './lti-advantage.helper';

/**
 * Resource: progress. Progress records are produced by real background jobs
 * of courses created for this file (content exports, an LTI score upload).
 */
describe('progress', () => {
	let courseId = '';
	let userId = '';
	let tool: LtiTool | undefined;
	let removePersona: (() => Promise<void>) | undefined;
	const persona = 'ltiProgress';

	const startExport = async (): Promise<string> => {
		const contentExport = await canvas().post<Json>(`/api/v1/courses/${courseId}/content_exports`, {
			export_type: 'common_cartridge',
			skip_notifications: true,
		});
		return String(contentExport.progress_url).split('/').pop() as string;
	};

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Progress battery course') },
			offer: true,
		});
		courseId = String(course.id);
		await canvas().post(`/api/v1/courses/${courseId}/pages`, {
			wiki_page: { title: 'Exported page', body: '<p>Something to export</p>', published: true },
		});
	});

	afterAll(async () => {
		await removePersona?.();
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		if (userId) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${userId}`);
		await deleteLtiTool(tool);
	});

	it('get: follows a background job from queued to completed', async () => {
		const progressId = await startExport();

		const [first] = await runOk({ resource: 'progress', operation: 'get', params: { progressId } });
		expect(first).toMatchObject({
			id: Number(progressId),
			context_type: 'ContentExport',
			tag: 'content_export',
			user_id: Number(fx('adminUserId')),
		});
		expect(['queued', 'running', 'completed']).toContain(first.workflow_state);
		expect(String(first.url)).toBe(`${canvas().url}/api/v1/progress/${progressId}`);

		// Poll through the node, the way a workflow would, until the job has finished.
		let latest = first;
		for (let attempt = 0; attempt < 60 && latest.workflow_state !== 'completed'; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			// The ID arrives as a number from an expression.
			[latest] = await runOk({
				resource: 'progress',
				operation: 'get',
				items: [{ id: Number(progressId) }],
				params: { progressId: '={{ $json.id }}' },
			});
			expect(latest.workflow_state).not.toBe('failed');
		}
		expect(latest).toMatchObject({ workflow_state: 'completed', completion: 100 });
		const actual = await canvas().get<Json>(`/api/v1/progress/${progressId}`);
		expect(latest).toMatchObject({ id: actual.id, workflow_state: actual.workflow_state, completion: actual.completion });
	});

	it('cancel: marks the job as failed and stores the message', async () => {
		const progressId = await startExport();
		const message = 'Cancelled by the battery – "quoted" & <b>tags</b> 🛑';
		const [cancelled] = await runOk({
			resource: 'progress',
			operation: 'cancel',
			params: { progressId, options: { message } },
		});
		expect(cancelled).toMatchObject({ id: Number(progressId), workflow_state: 'failed', message });
		// Canvas only marks the record. A job that had already started is not interrupted and
		// reports its own state when it finishes, so the mark may or may not still be there.
		const actual = await canvas().get<Json>(`/api/v1/progress/${progressId}`);
		expect(['failed', 'running', 'completed']).toContain(actual.workflow_state);
		if (actual.workflow_state === 'failed') {
			expect(actual.message).toBe(message);
		}
	});

	it('cancel: without a message, on a job nothing touches any more', async () => {
		const progressId = await startExport();
		await eventually(
			async () => (await canvas().get<Json>(`/api/v1/progress/${progressId}`)).workflow_state === 'completed',
			'the export to finish',
			150_000,
		);
		const [cancelled] = await runOk({ resource: 'progress', operation: 'cancel', params: { progressId } });
		expect(cancelled).toMatchObject({ id: Number(progressId), workflow_state: 'failed', message: null });
		expect(await canvas().get<Json>(`/api/v1/progress/${progressId}`)).toMatchObject({
			workflow_state: 'failed',
			message: null,
		});

		// The message is stored exactly as given.
		const message = 'Second thoughts';
		const [again] = await runOk({
			resource: 'progress',
			operation: 'cancel',
			items: [{ id: Number(progressId), why: message }],
			params: { progressId: '={{ $json.id }}', options: { message: '={{ $json.why }}' } },
		});
		expect(again).toMatchObject({ workflow_state: 'failed', message });
		expect((await canvas().get<Json>(`/api/v1/progress/${progressId}`)).message).toBe(message);
	});

	it('errors: unknown IDs are 404; other people\'s jobs are off limits', async () => {
		const progressId = await startExport();
		const result = await runNode({
			resource: 'progress',
			operation: 'get',
			items: [{ id: progressId }, { id: '999999999' }],
			params: { progressId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((p) => p.id)).toEqual([Number(progressId)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'progress',
			operation: 'get',
			endpoint: '/api/v1/progress/999999999',
		});

		for (const operation of ['get', 'cancel']) {
			const asStudent = await runNode({
				resource: 'progress',
				operation,
				persona: 'student',
				params: { progressId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(asStudent.success).toEqual([]);
			expect(asStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation });
			expect([401, 403]).toContain(asStudent.error[0].errorCode);
		}
		// The student's attempt to cancel changed nothing.
		expect((await canvas().get<Json>(`/api/v1/progress/${progressId}`)).workflow_state).not.toBe('failed');
	});

	it('getLti: the progress of an LTI score upload, readable only with the LTI Advantage token of its tool', async () => {
		// An LTI 1.3 tool with a graded external tool assignment (line item) in the course ...
		tool = await registerLtiTool('progress');
		await deployLtiTool(tool, courseId);
		const token = await ltiAdvantageToken(tool);
		removePersona = await createLtiPersona(persona, tool);
		const student = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
			user: { name: unique('Progress battery student'), skip_registration: true },
			pseudonym: { unique_id: `${unique('progress').replace(/\s/g, '-')}@example.edu`, send_confirmation: false },
		});
		userId = String(student.id);
		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: userId, type: 'StudentEnrollment', enrollment_state: 'active' },
		});
		const lineItem = await ltiRequest(token, 'POST', `/api/lti/courses/${courseId}/line_items`, {
			label: 'Essay graded by the tool',
			scoreMaximum: 10,
			'https://canvas.instructure.com/lti/submission_type': {
				type: 'external_tool',
				external_tool_url: `https://${tool.host}/launch/essay`,
			},
		});
		expect(lineItem.status).toBe(201);
		const lineItemId = String((lineItem.data as Json).id).split('/').pop() as string;

		// ... posts a score with a file to fetch: Canvas answers with the URL of an LTI progress.
		const score = await fetch(`${canvas().url}/api/lti/courses/${courseId}/line_items/${lineItemId}/scores`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' },
			body: JSON.stringify({
				userId,
				activityProgress: 'Completed',
				gradingProgress: 'FullyGraded',
				timestamp: new Date().toISOString(),
				scoreGiven: 7,
				scoreMaximum: 10,
				'https://canvas.instructure.com/lti/submission': {
					new_submission: true,
					content_items: [{ type: 'file', url: `https://${tool.host}/files/essay.txt`, title: 'essay.txt' }],
				},
			}),
		});
		expect(score.status).toBe(200);
		const submission = ((await score.json()) as Json)['https://canvas.instructure.com/lti/submission'] as Json;
		const progressUrl = String((submission.content_items as Json[])[0].progress);
		const progressId = progressUrl.split('/').pop() as string;
		expect(progressUrl).toBe(`${canvas().url}/api/lti/courses/${courseId}/progress/${progressId}`);

		const [progress] = await runOk({
			resource: 'progress',
			operation: 'getLti',
			persona,
			params: { courseId, progressId },
		});
		expect(progress).toMatchObject({
			id: Number(progressId),
			context_type: 'Assignment',
			tag: 'upload_via_url',
			user_id: Number(userId),
			url: progressUrl,
		});
		const direct = await ltiRequest(token, 'GET', `/api/lti/courses/${courseId}/progress/${progressId}`);
		expect(progress).toMatchObject({ id: (direct.data as Json).id, context_id: (direct.data as Json).context_id });

		// A personal API token, even an admin's, is not accepted by the LTI services.
		const withApiToken = await runNode({
			resource: 'progress',
			operation: 'getLti',
			params: { courseId, progressId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(withApiToken.success).toEqual([]);
		expect(withApiToken.error[0]).toMatchObject({
			errorCode: 401,
			errorType: 'UNAUTHORIZED',
			operation: 'getLti',
			endpoint: `/api/lti/courses/${courseId}/progress/${progressId}`,
		});
		expect(String(withApiToken.error[0].errorMessage)).toContain('Invalid access token format');

		// The same record through the REST API, for the admin.
		const [rest] = await runOk({ resource: 'progress', operation: 'get', params: { progressId } });
		expect(rest).toMatchObject({ id: Number(progressId), tag: 'upload_via_url', context_type: 'Assignment' });
	});

	it('getLti: a progress that does not belong to an assignment of the tool is refused', async () => {
		const exportProgressId = await startExport();
		const result = await runNode({
			resource: 'progress',
			operation: 'getLti',
			persona,
			items: [{ id: exportProgressId }, { id: '999999999' }],
			params: { courseId, progressId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'getLti' });
		expect(String(result.error[0].errorMessage)).toContain('not associated with an Assignment');
		expect(result.error[1]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
