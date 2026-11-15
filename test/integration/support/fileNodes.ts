import { randomUUID } from 'node:crypto';
import { canvasNode, n8n } from '../../lib/harness';
import type { RunNodeOptions } from '../../lib/harness';
import type { ExecutionResult, Json, N8nNode, N8nWorkflow } from '../../lib/n8n';

/**
 * Run the Canvas node together with n8n's own file nodes, the way a user combines
 * them: a CSV file made by "Convert to File" goes into an import operation, and
 * what an export operation returns goes on to "Convert to File" / "Extract From File".
 *
 * `runChain` puts the given nodes one after the other behind the battery's
 * webhook and returns what each of them put out.
 */

let position = 0;
function node(name: string, type: string, typeVersion: number, parameters: Json): N8nNode {
	position += 220;
	return { id: randomUUID(), name, type, typeVersion, position: [440 + position, 0], parameters };
}

/** n8n "Convert to File" > "Convert to Text File": the text in `sourceProperty` becomes a file. */
export function convertToTextFile(sourceProperty: string, fileName: string, binaryPropertyName = 'data'): N8nNode {
	return node('To Text File', 'n8n-nodes-base.convertToFile', 1.1, {
		operation: 'toText',
		sourceProperty,
		binaryPropertyName,
		options: { fileName },
	});
}

/** n8n "Convert to File" > "Convert to CSV": all incoming items become the rows of one CSV file. */
export function convertToCsvFile(fileName: string, binaryPropertyName = 'data'): N8nNode {
	return node('To CSV File', 'n8n-nodes-base.convertToFile', 1.1, {
		operation: 'csv',
		binaryPropertyName,
		options: { fileName },
	});
}

/** n8n "Extract From File" > "Extract From CSV": one item per row of the file. */
export function extractFromCsv(binaryPropertyName = 'data', options: Json = {}): N8nNode {
	return node('From CSV File', 'n8n-nodes-base.extractFromFile', 1.1, {
		operation: 'csv',
		binaryPropertyName,
		options,
	});
}

/** The Extract From File option that leaves out rows with fewer columns than the header instead of failing. */
export const SKIP_SHORT_ROWS: Json = { skipRecordsWithErrors: { value: { enabled: true, maxSkippedRecords: -1 } } };

/** Rows of CSV text (quoted fields, doubled quotes, line breaks inside quotes), for checking exports. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const source = text.replace(/^﻿/, '');
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		if (quoted) {
			if (ch === '"' && source[i + 1] === '"') {
				field += '"';
				i++;
			} else if (ch === '"') {
				quoted = false;
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			quoted = true;
		} else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && source[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += ch;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/** CSV rows as records keyed by the header row. */
export function csvRecords(text: string): Array<Record<string, string>> {
	const [header, ...rows] = parseCsv(text);
	return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ''])));
}

/** One CSV field, quoted when it has to be. */
export function csvField(value: unknown): string {
	const text = String(value ?? '');
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The Canvas node, for use in a chain. */
export function canvas(opts: RunNodeOptions): N8nNode {
	return canvasNode(opts, 'Canvas');
}

export interface ChainResult {
	ok: boolean;
	execution: ExecutionResult;
	/** Items (json) on the given output of a node; output 0 by default. */
	output(nodeName: string, index?: number): Json[];
	/** The same with binary data and pairedItem. */
	raw(nodeName: string, index?: number): Array<{ json: Json; pairedItem?: unknown; binary?: Json }>;
	/** Message of the error that stopped the workflow, if any. */
	failure?: string;
}

export async function runChain(nodes: N8nNode[], items: Json[] = [{ _item: 0 }]): Promise<ChainResult> {
	const path = `canvas-battery-${randomUUID()}`;
	const head: N8nNode[] = [
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
	];
	const all = [...head, ...nodes];
	const connections: Json = {};
	for (let i = 0; i < all.length - 1; i++) {
		connections[all[i].name] = { main: [[{ node: all[i + 1].name, type: 'main', index: 0 }]] };
	}
	const workflow: N8nWorkflow = {
		name: `[battery] ${nodes.map((n) => n.name).join(' > ')}`,
		settings: { executionOrder: 'v1' },
		nodes: all,
		connections,
	};

	const api = n8n();
	const workflowId = await api.createWorkflow(workflow);
	try {
		await api.activate(workflowId);
		await api.callWebhook(path, { items });
		const execution = await api.lastExecution(workflowId);
		const failed = Object.values(execution.nodes)
			.flat()
			.find((run) => run.error);
		const error = failed?.error ?? execution.error;
		return {
			ok: execution.status === 'success',
			execution,
			output: (name, index = 0) => execution.nodes[name]?.[0]?.outputs[index] ?? [],
			raw: (name, index = 0) => execution.nodes[name]?.[0]?.rawOutputs[index] ?? [],
			failure: error ? String(error.message ?? JSON.stringify(error)) : undefined,
		};
	} finally {
		await api.deleteWorkflow(workflowId).catch(() => undefined);
	}
}
