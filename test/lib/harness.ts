import { randomUUID } from 'node:crypto';
import { CANVAS_NODE_TYPE, N8nClient } from './n8n';
import type { ExecutionResult, Json, N8nNode, N8nWorkflow } from './n8n';
import { loadState } from './state';

export interface RunNodeOptions {
	resource: string;
	operation: string;
	/** Node parameters other than resource/operation/authentication. */
	params?: Json;
	/** Input items (json). Defaults to a single empty item. */
	items?: Json[];
	/** Which seeded persona's credential to use. Default: admin. */
	persona?: string;
	/** 'accessToken' (default) or 'oAuth2'. */
	authentication?: 'accessToken' | 'oAuth2';
	/** Node-level settings from the n8n node settings tab. */
	nodeSettings?: Pick<N8nNode, 'onError' | 'continueOnFail' | 'retryOnFail' | 'alwaysOutputData'>;
	/** Keep the workflow in n8n after the run (for debugging in the editor). */
	keep?: boolean;
}

export interface RunNodeResult {
	/** True when the whole execution finished without a workflow error. */
	ok: boolean;
	/** Items on the Success output (json). */
	success: Json[];
	/** Items on the Error output (json). */
	error: Json[];
	/** Items on the Debug output (json), when debug mode is on. */
	debug: Json[];
	/** Raw success items including pairedItem. */
	rawSuccess: Array<{ json: Json; pairedItem?: unknown; binary?: Json }>;
	/** Node/workflow level failure, when the node threw. */
	failure?: { message: string; description?: string; httpCode?: string; raw: Json };
	execution: ExecutionResult;
	webhookStatus: number;
}

const NODE_NAME = 'Canvas';

let client: N8nClient | undefined;
export function n8n(): N8nClient {
	client ??= new N8nClient();
	return client;
}

export function canvasNode(opts: RunNodeOptions, name = NODE_NAME, position: [number, number] = [440, 0]): N8nNode {
	const state = loadState();
	const authentication = opts.authentication ?? 'accessToken';
	const persona = opts.persona ?? 'admin';
	const credKey = authentication === 'oAuth2' ? `${persona}OAuth2` : persona;
	const cred = state.n8n.credentials[credKey];
	if (!cred) {
		throw new Error(`No n8n credential for persona "${credKey}" in test state`);
	}
	return {
		id: randomUUID(),
		name,
		type: CANVAS_NODE_TYPE,
		typeVersion: 1,
		position,
		parameters: {
			authentication,
			resource: opts.resource,
			operation: opts.operation,
			...(opts.params ?? {}),
		},
		credentials: { [cred.type]: { id: cred.id, name: cred.name } },
		...(opts.nodeSettings ?? {}),
	};
}

/**
 * Wrap a Canvas node in the smallest workflow that lets the battery drive it:
 * Webhook (POST, wait for last node) -> Split Out body.items -> Canvas.
 */
export function wrapInWebhookWorkflow(node: N8nNode, label: string): { workflow: N8nWorkflow; path: string } {
	const path = `canvas-battery-${randomUUID()}`;
	const workflow: N8nWorkflow = {
		name: `[battery] ${label}`,
		settings: { executionOrder: 'v1' },
		nodes: [
			{
				id: randomUUID(),
				name: 'Webhook',
				type: 'n8n-nodes-base.webhook',
				typeVersion: 2,
				position: [0, 0],
				webhookId: path,
				parameters: { httpMethod: 'POST', path, responseMode: 'lastNode', options: {} },
			},
			{
				id: randomUUID(),
				name: 'Items',
				type: 'n8n-nodes-base.splitOut',
				typeVersion: 1,
				position: [220, 0],
				parameters: { fieldToSplitOut: 'body.items', options: {} },
			},
			node,
		],
		connections: {
			Webhook: { main: [[{ node: 'Items', type: 'main', index: 0 }]] },
			Items: { main: [[{ node: node.name, type: 'main', index: 0 }]] },
		},
	};
	return { workflow, path };
}

/** Execute one Canvas node operation on the real n8n instance and collect its outputs. */
export async function runNode(opts: RunNodeOptions): Promise<RunNodeResult> {
	const api = n8n();
	const node = canvasNode(opts);
	const { workflow, path } = wrapInWebhookWorkflow(node, `${opts.resource}.${opts.operation}`);
	const workflowId = await api.createWorkflow(workflow);
	try {
		await api.activate(workflowId);
		const items = opts.items ?? [{ _item: 0 }];
		const hook = await api.callWebhook(path, { items });
		const execution = await api.lastExecution(workflowId);
		const run = execution.nodes[NODE_NAME]?.[0];
		const nodeError = run?.error ?? execution.error;
		return {
			ok: execution.status === 'success',
			success: run?.outputs[0] ?? [],
			error: run?.outputs[1] ?? [],
			debug: run?.outputs[2] ?? [],
			rawSuccess: run?.rawOutputs[0] ?? [],
			failure: nodeError
				? {
						message: String(nodeError.message ?? ''),
						description: nodeError.description as string | undefined,
						httpCode: nodeError.httpCode as string | undefined,
						raw: nodeError,
					}
				: undefined,
			execution,
			webhookStatus: hook.status,
		};
	} finally {
		if (!opts.keep) {
			await api.deleteWorkflow(workflowId).catch(() => undefined);
		}
	}
}

/** Run and require success; returns the Success output items. Throws with full context otherwise. */
export async function runOk(opts: RunNodeOptions): Promise<Json[]> {
	const result = await runNode(opts);
	if (!result.ok || result.error.length > 0) {
		throw new Error(
			`${opts.resource}.${opts.operation} failed: ` +
				JSON.stringify(result.failure ?? result.error, null, 2).slice(0, 2000) +
				`\nparams: ${JSON.stringify(opts.params ?? {})}`,
		);
	}
	return result.success;
}
