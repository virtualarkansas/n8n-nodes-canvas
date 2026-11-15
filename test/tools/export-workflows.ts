/**
 * Turn what the integration battery executed into importable n8n workflows:
 * one workflow per resource in test/workflows/, chaining the operations the
 * battery ran successfully (as the admin persona) in the order it ran them.
 *
 *   Manual Trigger -> Config (the Canvas IDs the steps refer to) -> step -> step -> ...
 *
 * IDs are not hard-coded: a value that matches a seeded fixture becomes a
 * reference to the Config node, and a value that an earlier step returned
 * (the ID of a record it created) becomes a reference to that step. To run a
 * workflow on another Canvas, import it, pick your credential on the Canvas
 * nodes and fill in the Config node.
 *
 * Usage: npx tsx test/tools/export-workflows.ts [--runs <runs.jsonl> ...]
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { CANVAS_NODE_TYPE } from '../lib/n8n';
import type { Json, N8nNode } from '../lib/n8n';
import { loadState } from '../lib/state';

interface RunRecord {
	session?: string;
	file?: string;
	name?: string;
	resource: string;
	operation: string;
	persona: string;
	params: Json;
	items?: Json[];
	/** The run's input items carried files, which the log does not contain. */
	binary?: boolean;
	outcome: string;
	outputCount: number;
	outputIds: Json[];
}

const args = process.argv.slice(2);
const sources: string[] = [];
for (let i = 0; i < args.length; i++) {
	if (args[i] === '--runs' && args[i + 1]) sources.push(resolve(args[++i]));
}
if (sources.length === 0) sources.push(resolve(__dirname, '..', '.results', 'runs.jsonl'));

const runs: RunRecord[] = [];
for (const file of sources) {
	if (!existsSync(file)) continue;
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		if (line.trim()) runs.push(JSON.parse(line) as RunRecord);
	}
}

// A test that ran several times (reruns while developing) contributes only its latest run.
const latestSession = new Map<string, number>();
for (const run of runs) {
	const key = `${run.file ?? ''}|${run.name ?? ''}`;
	latestSession.set(key, Math.max(latestSession.get(key) ?? 0, Number(run.session ?? 0)));
}
const latestRuns = runs.filter(
	(run) => Number(run.session ?? 0) === latestSession.get(`${run.file ?? ''}|${run.name ?? ''}`),
);

/**
 * Names made unique by the battery (`unique()`) would collide when a workflow is
 * run twice, so the changing part becomes the execution ID: stable within one
 * execution (later steps can still refer to the same name), new on every run.
 */
const UNIQUE_TOKEN = /[0-9a-z]{8}-[0-9a-z]{2,6}-(\d+)/g;
function freshen(value: unknown): unknown {
	if (typeof value === 'string') {
		if (!UNIQUE_TOKEN.test(value)) return value;
		UNIQUE_TOKEN.lastIndex = 0;
		const text = value.replace(UNIQUE_TOKEN, '{{ $execution.id }}-$1');
		return text.startsWith('=') ? text : `=${text}`;
	}
	if (Array.isArray(value)) return value.map(freshen);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value as Json).map(([key, entry]) => [key, freshen(entry)]));
	}
	return value;
}

const fixtures = Object.entries(loadState().canvas.fixtures).filter(
	([, value]) => typeof value === 'string' || typeof value === 'number',
) as Array<[string, string | number]>;

/** Never export secrets that happen to be among the fixtures. */
const SECRET_KEY = /secret|password|token/i;

function isExportable(run: RunRecord): boolean {
	if (run.outcome !== 'success' || run.persona !== 'admin') return false;
	if (run.params.debugMode === true || run.binary) return false;
	// Acting as a user the battery created for the test cannot be repeated elsewhere.
	if ((run.params.requestOptions as Json | undefined)?.asUserId) return false;
	if (run.items && run.items.length > 1) return false;
	return !JSON.stringify(run.params).includes('={{');
}

/** Words of an identifier: courseId -> [course, id], sis_course_id -> [sis, course, id]. */
function words(name: string): string[] {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

interface StepOutput {
	nodeName: string;
	resource: string;
	ids: Json;
}

function buildWorkflow(resource: string, list: RunRecord[]): { workflow: Json; steps: number } {
	const usedFixtures = new Map<string, string | number>();
	const earlier: StepOutput[] = [];
	const nodes: N8nNode[] = [];
	const connections: Json = {};
	const usedNames = new Set<string>();

	const reference = (paramName: string, value: unknown): unknown => {
		if (typeof value !== 'string' && typeof value !== 'number') return value;
		const text = String(value);
		if (text === '' || !/id$|url$|code$/i.test(paramName)) return value;
		const wanted = words(paramName).filter((w) => w !== 'id');

		// 1. The record itself, created by an earlier step of this workflow (most recent first).
		for (const step of [...earlier].reverse()) {
			if (String(step.ids.id ?? '') !== text) continue;
			if (wanted.length === 0 || wanted.some((w) => step.resource.toLowerCase().includes(w))) {
				return `={{ $('${step.nodeName}').first().json.id }}`;
			}
		}

		// 2. A seeded fixture; prefer the one whose name resembles the parameter.
		const candidates = fixtures.filter(([key, v]) => String(v) === text && !SECRET_KEY.test(key));
		if (candidates.length > 0) {
			const scored = candidates
				.map(([key]) => ({ key, score: wanted.filter((w) => words(key).includes(w)).length - words(key).length / 100 }))
				.sort((a, b) => b.score - a.score);
			if (wanted.length === 0 || scored[0].score > 0) {
				usedFixtures.set(scored[0].key, candidates.find(([key]) => key === scored[0].key)![1]);
				return `={{ $('Config').first().json.${scored[0].key} }}`;
			}
		}

		// 3. A related ID an earlier step returned (e.g. the quiz_id of a created question).
		for (const step of [...earlier].reverse()) {
			for (const [key, id] of Object.entries(step.ids)) {
				if (key !== 'id' && String(id) === text && wanted.some((w) => words(key).includes(w))) {
					return `={{ $('${step.nodeName}').first().json.${key} }}`;
				}
			}
		}
		return value;
	};

	const seen = new Set<string>();
	let index = 0;
	for (const run of list) {
		const signature = `${run.operation}|${JSON.stringify(run.params)}`;
		if (seen.has(signature)) continue;
		seen.add(signature);

		const parameters: Json = { authentication: 'accessToken', resource: run.resource, operation: run.operation };
		for (const [key, value] of Object.entries(run.params)) {
			parameters[key] = freshen(reference(key, value));
		}

		let nodeName = `${run.operation}${run.name ? ` — ${run.name.split(' > ').pop()!.slice(0, 60)}` : ''}`.replace(/['"`]/g, '');
		for (let n = 2; usedNames.has(nodeName); n++) nodeName = `${nodeName.replace(/ \(\d+\)$/, '')} (${n})`;
		usedNames.add(nodeName);

		nodes.push({
			id: randomUUID(),
			name: nodeName,
			type: CANVAS_NODE_TYPE,
			typeVersion: 1,
			position: [460 + (index % 6) * 260, Math.floor(index / 6) * 220],
			parameters,
			credentials: { canvasApi: { id: '', name: 'Canvas account' } },
			// A failed or empty step must not stop the rest of the tour, and list steps must not fan out.
			onError: 'continueRegularOutput',
			alwaysOutputData: true,
			...({ executeOnce: true } as object),
		});
		earlier.push({ nodeName, resource: run.resource, ids: run.outputIds[0] ?? {} });
		index++;
	}

	const config: N8nNode = {
		id: randomUUID(),
		name: 'Config',
		type: 'n8n-nodes-base.set',
		typeVersion: 3.4,
		position: [220, 0],
		parameters: {
			assignments: {
				assignments: [...usedFixtures].map(([name, value]) => ({
					id: randomUUID(),
					name,
					value: String(value),
					type: 'string',
				})),
			},
			options: {},
		},
	};
	const trigger: N8nNode = {
		id: randomUUID(),
		name: 'Run manually',
		type: 'n8n-nodes-base.manualTrigger',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	};

	const chain = [trigger, config, ...nodes];
	for (let i = 0; i < chain.length - 1; i++) {
		connections[chain[i].name] = { main: [[{ node: chain[i + 1].name, type: 'main', index: 0 }]] };
	}

	return {
		steps: nodes.length,
		workflow: {
			name: `Canvas battery — ${resource}`,
			nodes: chain,
			connections,
			settings: { executionOrder: 'v1' },
			pinData: {},
		},
	};
}

const outDir = resolve(__dirname, '..', 'workflows');
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
	if (file.endsWith('.json')) unlinkSync(resolve(outDir, file));
}

const byResource = new Map<string, RunRecord[]>();
for (const run of latestRuns.filter(isExportable)) {
	byResource.set(run.resource, [...(byResource.get(run.resource) ?? []), run]);
}

let total = 0;
for (const [resource, list] of [...byResource].sort(([a], [b]) => a.localeCompare(b))) {
	const { workflow, steps } = buildWorkflow(resource, list);
	if (steps === 0) continue;
	writeFileSync(resolve(outDir, `${resource}.json`), JSON.stringify(workflow, null, 2) + '\n');
	total += steps;
}
console.log(`${byResource.size} workflows, ${total} steps written to ${basename(outDir)}/`);
