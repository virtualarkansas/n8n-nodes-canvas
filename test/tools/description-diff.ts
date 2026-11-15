/**
 * What changes for workflows saved with a released version of the package?
 *
 * Downloads that version from npm, loads its node description next to the one
 * of the working tree (build first: `npm run build`) and prints, per resource,
 * the operations, fields, collection options and dropdown values that were
 * removed or changed, and what is new. The input for the changelog.
 *
 * Usage: npx tsx test/tools/description-diff.ts [version]   (default: latest on npm)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { INodeProperties, INodePropertyCollection, INodePropertyOptions } from 'n8n-workflow';

const root = resolve(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { name: string };
const version = process.argv[2] ?? execFileSync('npm', ['view', pkg.name, 'version'], { encoding: 'utf8' }).trim();

// Inside node_modules so the released code finds n8n-workflow the same way the working tree does.
const cache = resolve(root, 'node_modules', '.cache', 'released', version);
if (!existsSync(resolve(cache, 'package'))) {
	mkdirSync(cache, { recursive: true });
	const tarball = execFileSync('npm', ['pack', `${pkg.name}@${version}`, '--silent'], { cwd: cache, encoding: 'utf8' }).trim();
	execFileSync('tar', ['xzf', tarball], { cwd: cache });
}

const load = (dist: string): INodeProperties[] => {
	const file = resolve(dist, 'nodes', 'Canvas', 'Canvas.node.js');
	if (!existsSync(file)) throw new Error(`${file} not found (run "npm run build" first)`);
	const mod = createRequire(file)(file) as { Canvas: new () => { description: { properties: INodeProperties[] } } };
	return new mod.Canvas().description.properties;
};

interface Field {
	type: string;
	required: boolean;
	fallback: unknown;
	/** Options of a collection, `group.value` names of a fixed collection. */
	sub: Set<string>;
	/** Values of a dropdown. */
	values: Set<string>;
	/** Shown only for certain values of other fields (a context choice, a source choice ...). */
	conditional: boolean;
}
interface Resource {
	label: string;
	operations: Record<string, Record<string, Field>>;
}

function index(properties: INodeProperties[]): Record<string, Resource> {
	const out: Record<string, Resource> = {};
	const resourceProperty = properties.find((p) => p.name === 'resource');
	const labels = Object.fromEntries(((resourceProperty?.options ?? []) as INodePropertyOptions[]).map((o) => [String(o.value), o.name]));
	const shownFor = (property: INodeProperties, key: string): string[] | undefined =>
		property.displayOptions?.show?.[key] as string[] | undefined;

	for (const property of properties) {
		if (property.name !== 'operation') continue;
		for (const resource of shownFor(property, 'resource') ?? []) {
			out[resource] ??= { label: labels[resource] ?? resource, operations: {} };
			for (const option of (property.options ?? []) as INodePropertyOptions[]) {
				out[resource].operations[String(option.value)] = {};
			}
		}
	}
	for (const property of properties) {
		if (property.name === 'operation' || property.name === 'resource') continue;
		for (const resource of shownFor(property, 'resource') ?? []) {
			if (!out[resource]) continue;
			for (const operation of shownFor(property, 'operation') ?? Object.keys(out[resource].operations)) {
				const fields = out[resource].operations[operation];
				if (!fields) continue;
				const field = (fields[property.name] ??= {
					type: property.type,
					required: false,
					fallback: property.default,
					sub: new Set(),
					values: new Set(),
					conditional: true,
				});
				const conditions = [
					...Object.keys(property.displayOptions?.show ?? {}),
					...Object.keys(property.displayOptions?.hide ?? {}),
				].filter((key) => key !== 'resource' && key !== 'operation');
				if (conditions.length === 0) field.conditional = false;
				if (property.required) field.required = true;
				if (property.type === 'collection') {
					for (const option of (property.options ?? []) as INodeProperties[]) field.sub.add(option.name);
				}
				if (property.type === 'fixedCollection') {
					for (const group of (property.options ?? []) as INodePropertyCollection[]) {
						for (const value of group.values) field.sub.add(`${group.name}.${value.name}`);
					}
				}
				if (property.type === 'options' || property.type === 'multiOptions') {
					for (const option of (property.options ?? []) as INodePropertyOptions[]) field.values.add(String(option.value));
				}
			}
		}
	}
	return out;
}

const before = index(load(resolve(cache, 'package', 'dist')));
const after = index(load(resolve(root, 'dist')));
const operationCount = (all: Record<string, Resource>): number =>
	Object.values(all).reduce((n, resource) => n + Object.keys(resource.operations).length, 0);
const quote = (value: unknown): string => (value === '' ? '""' : String(value));

const lines: string[] = [
	`# ${pkg.name}: ${version} → working tree`,
	'',
	`${version}: ${Object.keys(before).length} resources, ${operationCount(before)} operations. ` +
		`Now: ${Object.keys(after).length} resources, ${operationCount(after)} operations.`,
	'',
	'## Removed resources',
	'',
	...Object.keys(before)
		.filter((r) => !after[r])
		.map((r) => `- ${before[r].label} (\`${r}\`): ${Object.keys(before[r].operations).join(', ')}`),
	'',
	'## New resources',
	'',
	...Object.keys(after)
		.filter((r) => !before[r])
		.map((r) => `- ${after[r].label} (\`${r}\`): ${Object.keys(after[r].operations).join(', ')}`),
	'',
	'## Existing resources',
	'',
];

for (const name of Object.keys(before).sort()) {
	if (!after[name]) continue;
	const was = before[name].operations;
	const is = after[name].operations;
	const section: string[] = [];
	const removed = Object.keys(was).filter((o) => !is[o]);
	const added = Object.keys(is).filter((o) => !was[o]);
	if (removed.length) section.push(`  - **removed operations:** ${removed.join(', ')}`);
	if (added.length) section.push(`  - new operations: ${added.join(', ')}`);

	for (const operation of Object.keys(was)) {
		if (!is[operation]) continue;
		const notes: string[] = [];
		for (const [field, old] of Object.entries(was[operation])) {
			const current = is[operation][field];
			if (!current) {
				notes.push(`field removed: \`${field}\``);
				continue;
			}
			const lostOptions = [...old.sub].filter((s) => !current.sub.has(s));
			if (lostOptions.length) notes.push(`\`${field}\`: options removed: ${lostOptions.join(', ')}`);
			const lostValues = [...old.values].filter((v) => !current.values.has(v));
			if (lostValues.length) notes.push(`\`${field}\`: values removed: ${lostValues.map(quote).join(', ')}`);
			if (old.type !== current.type) notes.push(`\`${field}\`: ${old.type} → ${current.type}`);
			if (typeof old.fallback !== 'object' && JSON.stringify(old.fallback) !== JSON.stringify(current.fallback)) {
				notes.push(`\`${field}\`: default ${JSON.stringify(old.fallback)} → ${JSON.stringify(current.fallback)}`);
			}
		}
		for (const [field, current] of Object.entries(is[operation])) {
			const empty = current.fallback === '' || current.fallback === undefined;
			if (!was[operation][field] && current.required && empty && !current.conditional) {
				notes.push(`new required field without a default: \`${field}\``);
			}
		}
		if (notes.length) section.push(`  - ${operation}: ${notes.join('; ')}`);
	}
	if (section.length) lines.push(`- ${after[name].label} (\`${name}\`)`, ...section);
}

console.log(lines.join('\n'));
