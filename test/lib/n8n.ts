import { randomUUID } from 'node:crypto';
import { loadState } from './state';

export type Json = Record<string, unknown>;

export const CANVAS_NODE_TYPE = '@kyancey-va/n8n-nodes-canvas.canvas';
export const CANVAS_TRIGGER_TYPE = '@kyancey-va/n8n-nodes-canvas.canvasTrigger';

export interface N8nNode {
	id: string;
	name: string;
	type: string;
	typeVersion: number;
	position: [number, number];
	parameters: Json;
	credentials?: Record<string, { id: string; name: string }>;
	webhookId?: string;
	onError?: string;
	continueOnFail?: boolean;
	retryOnFail?: boolean;
	alwaysOutputData?: boolean;
}

export interface N8nWorkflow {
	name: string;
	nodes: N8nNode[];
	connections: Json;
	settings: Json;
}

export interface NodeRun {
	/** Output items per output index (json only) */
	outputs: Json[][];
	/** Raw items including pairedItem / binary */
	rawOutputs: Array<Array<{ json: Json; pairedItem?: unknown; binary?: Json }>>;
	error?: Json;
	executionStatus?: string;
}

export interface ExecutionResult {
	id: string;
	status: string;
	finished: boolean;
	error?: Json;
	lastNodeExecuted?: string;
	nodes: Record<string, NodeRun[]>;
	raw: Json;
}

export class N8nClient {
	readonly url: string;
	private readonly apiKey: string;

	constructor(url?: string, apiKey?: string) {
		const state = url && apiKey ? undefined : loadState();
		this.url = (url ?? state!.n8n.url).replace(/\/$/, '');
		this.apiKey = apiKey ?? state!.n8n.apiKey;
	}

	async api<T = Json>(method: string, path: string, body?: unknown): Promise<T> {
		const res = await fetch(`${this.url}/api/v1${path}`, {
			method,
			headers: {
				'X-N8N-API-KEY': this.apiKey,
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error(`n8n API ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
		}
		return (text ? JSON.parse(text) : {}) as T;
	}

	async createWorkflow(workflow: N8nWorkflow): Promise<string> {
		const created = await this.api<{ id: string }>('POST', '/workflows', workflow);
		return created.id;
	}

	async activate(id: string): Promise<void> {
		await this.api('POST', `/workflows/${id}/activate`);
	}

	async deactivate(id: string): Promise<void> {
		await this.api('POST', `/workflows/${id}/deactivate`);
	}

	async deleteWorkflow(id: string): Promise<void> {
		await this.api('DELETE', `/workflows/${id}`);
	}

	/** Call a production webhook; returns status and parsed body (if JSON). */
	async callWebhook(
		path: string,
		body: unknown,
		init: { method?: string; headers?: Record<string, string>; timeoutMs?: number } = {},
	): Promise<{ status: number; body: unknown; text: string }> {
		const res = await fetch(`${this.url}/webhook/${path}`, {
			method: init.method ?? 'POST',
			headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
			body: init.method === 'GET' ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(init.timeoutMs ?? 600_000),
		});
		const text = await res.text();
		let parsed: unknown = text;
		try {
			parsed = JSON.parse(text);
		} catch {
			// not JSON
		}
		return { status: res.status, body: parsed, text };
	}

	/** Most recent execution of a workflow, with full run data. */
	async lastExecution(workflowId: string, attempts = 40): Promise<ExecutionResult> {
		for (let i = 0; i < attempts; i++) {
			const list = await this.api<{ data: Json[] }>(
				'GET',
				`/executions?workflowId=${workflowId}&includeData=true&limit=1`,
			);
			const exec = list.data[0];
			if (exec && exec.status !== 'running' && exec.status !== 'new' && exec.status !== 'waiting') {
				return toExecutionResult(exec);
			}
			await new Promise((r) => setTimeout(r, 150));
		}
		throw new Error(`No finished execution found for workflow ${workflowId}`);
	}
}

function toExecutionResult(exec: Json): ExecutionResult {
	const resultData = ((exec.data as Json | undefined)?.resultData ?? {}) as Json;
	const runData = (resultData.runData ?? {}) as Record<string, Json[]>;
	const nodes: Record<string, NodeRun[]> = {};
	for (const [name, runs] of Object.entries(runData)) {
		nodes[name] = runs.map((run) => {
			const main = (((run.data as Json | undefined)?.main ?? []) as unknown[]).map(
				(o) => (o ?? []) as Array<{ json: Json; pairedItem?: unknown; binary?: Json }>,
			);
			return {
				outputs: main.map((o) => o.map((item) => item.json)),
				rawOutputs: main,
				error: run.error as Json | undefined,
				executionStatus: run.executionStatus as string | undefined,
			};
		});
	}
	return {
		id: String(exec.id),
		status: String(exec.status),
		finished: Boolean(exec.finished),
		error: resultData.error as Json | undefined,
		lastNodeExecuted: resultData.lastNodeExecuted as string | undefined,
		nodes,
		raw: exec,
	};
}

export function uniquePath(prefix = 't'): string {
	return `${prefix}-${randomUUID()}`;
}
