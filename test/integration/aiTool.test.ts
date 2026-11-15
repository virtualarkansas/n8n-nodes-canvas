import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { canvasNode, n8n } from '../lib/harness';
import type { Json, N8nNode, N8nWorkflow } from '../lib/n8n';

/**
 * The node as a tool of an AI agent ("Canvas LMS Tool").
 *
 * n8n's own Tool Executor node calls a connected tool the way an agent does, without a
 * language model: the arguments a model would supply for `$fromAI(...)` come from the test.
 * What the agent would receive is the `response` n8n records for the tool node.
 */
const TOOL_TYPE = '@kyancey-va/n8n-nodes-canvas.canvasTool';
const TOOL_NAME = 'Canvas LMS Tool';

interface ToolCall {
	status: string;
	/** What n8n hands to the agent: the items of the tool's single output. */
	response: Json[] | undefined;
	/** Message of the error that stopped the execution, if any. */
	failure?: string;
}

async function callTool(resource: string, operation: string, params: Json, query: Json): Promise<ToolCall> {
	const path = `canvas-battery-tool-${randomUUID()}`;
	const tool: N8nNode = { ...canvasNode({ resource, operation, params }, TOOL_NAME, [440, 220]), type: TOOL_TYPE };
	const workflow: N8nWorkflow = {
		name: `[battery] tool ${resource}.${operation}`,
		settings: { executionOrder: 'v1' },
		nodes: [
			{
				id: randomUUID(),
				name: 'Webhook',
				type: 'n8n-nodes-base.webhook',
				typeVersion: 2,
				position: [0, 0],
				webhookId: path,
				parameters: { httpMethod: 'POST', path, responseMode: 'onReceived', options: {} },
			},
			{
				id: randomUUID(),
				name: 'Tool Executor',
				type: '@n8n/n8n-nodes-langchain.toolExecutor',
				typeVersion: 1,
				position: [440, 0],
				parameters: { query: '={{ $json.body.query }}', toolName: '' },
			},
			tool,
		],
		connections: {
			Webhook: { main: [[{ node: 'Tool Executor', type: 'main', index: 0 }]] },
			[TOOL_NAME]: { ai_tool: [[{ node: 'Tool Executor', type: 'ai_tool', index: 0 }]] },
		},
	};

	const api = n8n();
	const workflowId = await api.createWorkflow(workflow);
	try {
		await api.activate(workflowId);
		await api.callWebhook(path, { query });
		const execution = await api.lastExecution(workflowId, 400);
		const runData = (((execution.raw.data as Json | undefined)?.resultData as Json | undefined)?.runData ?? {}) as Record<
			string,
			Array<{ data?: { ai_tool?: Array<Array<{ json: Json }>> }; error?: Json }>
		>;
		const toolRun = runData[TOOL_NAME]?.[0];
		const error = execution.error ?? runData['Tool Executor']?.[0]?.error ?? toolRun?.error;
		return {
			status: execution.status,
			response: toolRun?.data?.ai_tool?.[0]?.[0]?.json.response as Json[] | undefined,
			failure: error ? String(error.message ?? JSON.stringify(error)) : undefined,
		};
	} finally {
		await api.deleteWorkflow(workflowId).catch(() => undefined);
	}
}

describe('the node as an AI agent tool', () => {
	const COURSE = "={{ $fromAI('courseId', 'ID of the course', 'string') }}";

	it('takes its parameters from the agent and returns the record', async () => {
		const courseId = String(fx('largeCourseId'));
		const expected = await canvas().get<Json>(`/api/v1/courses/${courseId}`);

		const call = await callTool('course', 'get', { courseId: COURSE }, { courseId });
		expect(call.failure).toBeUndefined();
		expect(call.status).toBe('success');
		expect(call.response).toHaveLength(1);
		expect(call.response![0]).toMatchObject({ id: expected.id, name: expected.name, course_code: expected.course_code });
	});

	it('returns every item of a list', async () => {
		const courseId = String(fx('largeCourseId'));
		const sections = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		expect(sections.length).toBeGreaterThan(1);

		const call = await callTool(
			'section',
			'getAll',
			{ courseId: COURSE, pagination: { returnAll: true } },
			{ courseId },
		);
		expect(call.failure).toBeUndefined();
		expect((call.response ?? []).map((s) => s.id).sort()).toEqual(sections.map((s) => s.id).sort());
	});

	it('a failure stops the tool call with Canvas’ message (error mode Stop, the default)', async () => {
		const call = await callTool('course', 'get', { courseId: COURSE }, { courseId: '999999999' });
		expect(call.status).toBe('error');
		expect(call.response).toBeUndefined();
		expect(call.failure).toContain('The specified resource does not exist');
	});

	it('with Continue (With Error Output) the agent receives the failed item instead of nothing', async () => {
		const call = await callTool(
			'course',
			'get',
			{ courseId: COURSE, errorHandling: { onError: 'continueWithError' } },
			{ courseId: '999999999' },
		);
		expect(call.failure).toBeUndefined();
		expect(call.status).toBe('success');
		expect(call.response).toHaveLength(1);
		expect(call.response![0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'course',
			operation: 'get',
			endpoint: '/api/v1/courses/999999999',
		});
	});

	it('debug mode shows the agent the request instead of sending it', async () => {
		const call = await callTool('course', 'get', { courseId: COURSE, debugMode: true }, { courseId: '424242' });
		expect(call.failure).toBeUndefined();
		expect(call.response).toHaveLength(1);
		expect(String(call.response![0].curl)).toContain('/api/v1/courses/424242');
	});
});
