/**
 * Print what the node offers for one or more resources: every operation, its
 * fields (with nested options), the request the handler builds for sample
 * parameters, and whether Canvas has a matching route.
 *
 * Usage: npx tsx test/tools/describe.ts <resource> [operation]
 *        npx tsx test/tools/describe.ts --list
 */
import type { INodeProperties, INodePropertyCollection, INodePropertyOptions } from 'n8n-workflow';
import { buildRequestFor, listOperations, listResources, paramVariants } from '../lib/catalog';
import { findRoute, routesForPath } from '../lib/routes';

const [resourceArg, operationArg] = process.argv.slice(2);

if (!resourceArg || resourceArg === '--list') {
	const ops = listOperations();
	for (const resource of listResources()) {
		const names = ops.filter((o) => o.resource === resource).map((o) => o.operation);
		console.log(`${resource} (${names.length}): ${names.join(', ')}`);
	}
	process.exit(0);
}

function describeField(field: INodeProperties, indent: string): string[] {
	const extra: string[] = [];
	if (field.required) extra.push('required');
	if (field.default !== undefined && field.default !== '' && typeof field.default !== 'object') {
		extra.push(`default=${JSON.stringify(field.default)}`);
	}
	const show = { ...(field.displayOptions?.show ?? {}) } as Record<string, unknown>;
	delete show.resource;
	delete show.operation;
	if (Object.keys(show).length > 0) extra.push(`when ${JSON.stringify(show)}`);
	const lines = [`${indent}${field.name}: ${field.type}${extra.length ? ` (${extra.join(', ')})` : ''}`];
	if (field.type === 'options' || field.type === 'multiOptions') {
		const values = ((field.options ?? []) as INodePropertyOptions[]).map((o) => String(o.value));
		lines.push(`${indent}  values: ${values.join(' | ')}`);
	}
	if (field.type === 'collection') {
		for (const option of (field.options ?? []) as INodeProperties[]) {
			lines.push(...describeField(option, `${indent}  `));
		}
	}
	if (field.type === 'fixedCollection') {
		for (const group of (field.options ?? []) as INodePropertyCollection[]) {
			lines.push(`${indent}  [${group.name}]${field.typeOptions?.multipleValues ? ' (multiple)' : ''}`);
			for (const value of group.values) {
				lines.push(...describeField(value, `${indent}    `));
			}
		}
	}
	return lines;
}

for (const op of listOperations()) {
	if (op.resource !== resourceArg) continue;
	if (operationArg && op.operation !== operationArg) continue;
	console.log(`\n=== ${op.resource}.${op.operation}  ("${op.displayName}")`);
	for (const field of op.fields) {
		console.log(describeField(field, '  ').join('\n'));
	}
	for (const variant of paramVariants(op)) {
		try {
			const request = buildRequestFor(op.resource, op.operation, variant.params);
			const path = request.endpoint.split('?')[0];
			const route = findRoute(request.method, path);
			const verbs = routesForPath(path).map((r) => r.verb);
			const verdict = route
				? `OK -> ${route.to}`
				: verbs.length
					? `NO ROUTE (Canvas accepts ${verbs.join('|')} on this path)`
					: 'NO ROUTE (path unknown to Canvas)';
			console.log(`  -> ${variant.label}: ${request.method} ${request.endpoint}  ${verdict}`);
			if (variant.label.startsWith('full')) {
				if (request.qs && Object.keys(request.qs).length) console.log(`       qs:   ${JSON.stringify(request.qs)}`);
				if (request.body && Object.keys(request.body).length) console.log(`       body: ${JSON.stringify(request.body)}`);
				if (request.dataKey) console.log(`       dataKey: ${request.dataKey}`);
			}
		} catch (error) {
			console.log(`  -> ${variant.label}: handler threw: ${(error as Error).message}`);
		}
	}
}
