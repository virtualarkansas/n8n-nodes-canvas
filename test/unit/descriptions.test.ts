import { describe, expect, it } from 'vitest';
import type { INodeProperties, INodePropertyCollection, INodePropertyOptions } from 'n8n-workflow';
import { listOperations } from '../lib/catalog';

/**
 * Static integrity of the UI definitions. These are the mistakes that do not
 * fail a build but make a field silently unusable in n8n:
 *   - a field shown "when X is ..." where X does not exist for that operation,
 *     or is compared with a value X can never have (e.g. the text 'false'
 *     against a boolean) — n8n then drops the field's value before execution;
 *   - defaults of the wrong type, or not among the offered values;
 *   - the same option offered twice.
 */
const operations = listOperations();

function optionValues(field: INodeProperties): unknown[] {
	return ((field.options ?? []) as INodePropertyOptions[]).map((o) => o.value);
}

function checkDefault(field: INodeProperties, where: string, problems: string[]): void {
	const value = field.default as unknown;
	const isExpression = typeof value === 'string' && value.startsWith('=');
	if (isExpression) return;
	switch (field.type) {
		case 'boolean':
			if (typeof value !== 'boolean') problems.push(`${where}: boolean default is ${JSON.stringify(value)}`);
			break;
		case 'number':
			if (typeof value !== 'number' && value !== '') problems.push(`${where}: number default is ${JSON.stringify(value)}`);
			break;
		case 'options':
			if (value !== '' && !optionValues(field).includes(value)) {
				problems.push(`${where}: default ${JSON.stringify(value)} is not one of its options`);
			}
			break;
		case 'multiOptions':
			if (!Array.isArray(value)) {
				problems.push(`${where}: multiOptions default must be an array`);
			} else {
				for (const entry of value) {
					if (!optionValues(field).includes(entry)) problems.push(`${where}: default entry ${JSON.stringify(entry)} is not one of its options`);
				}
			}
			break;
		case 'collection':
		case 'fixedCollection':
			if (value === null || typeof value !== 'object' || Array.isArray(value)) {
				problems.push(`${where}: ${field.type} default must be an object`);
			}
			break;
		default:
			break;
	}
}

function checkOptions(field: INodeProperties, where: string, problems: string[]): void {
	if (field.type === 'options' || field.type === 'multiOptions') {
		const values = optionValues(field);
		const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
		if (duplicates.length) problems.push(`${where}: duplicate option values ${JSON.stringify(duplicates)}`);
		if (values.length === 0) problems.push(`${where}: has no options`);
	}
	if (field.type === 'collection') {
		const names = ((field.options ?? []) as INodeProperties[]).map((o) => o.name);
		const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
		if (duplicates.length) problems.push(`${where}: duplicate fields ${JSON.stringify(duplicates)}`);
		for (const sub of (field.options ?? []) as INodeProperties[]) {
			checkDefault(sub, `${where}.${sub.name}`, problems);
			checkOptions(sub, `${where}.${sub.name}`, problems);
		}
	}
	if (field.type === 'fixedCollection') {
		for (const group of (field.options ?? []) as INodePropertyCollection[]) {
			for (const sub of group.values) {
				checkDefault(sub, `${where}.${group.name}.${sub.name}`, problems);
				checkOptions(sub, `${where}.${group.name}.${sub.name}`, problems);
			}
		}
	}
}

const byResource = new Map<string, typeof operations>();
for (const op of operations) byResource.set(op.resource, [...(byResource.get(op.resource) ?? []), op]);

for (const [resource, ops] of byResource) {
	describe(`descriptions: ${resource}`, () => {
		for (const op of ops) {
			it(`${op.operation}: conditions, defaults and options are consistent`, () => {
				const problems: string[] = [];
				for (const field of op.fields) {
					const where = `${field.name}`;
					checkDefault(field, where, problems);
					checkOptions(field, where, problems);

					for (const [kind, conditions] of [
						['shown', field.displayOptions?.show ?? {}],
						['hidden', field.displayOptions?.hide ?? {}],
					] as Array<[string, Record<string, unknown[] | undefined>]>) {
						for (const [key, values] of Object.entries(conditions)) {
							if (key === 'resource' || key === 'operation' || key.startsWith('@') || key.startsWith('/')) continue;
							const controllers = op.fields.filter((f) => f.name === key);
							if (controllers.length === 0) {
								problems.push(`${where}: ${kind} depending on "${key}", which does not exist for this operation`);
								continue;
							}
							for (const value of values ?? []) {
								const possible = controllers.some((controller) => {
									if (controller.type === 'boolean') return typeof value === 'boolean';
									if (controller.type === 'options') return optionValues(controller).includes(value);
									if (controller.type === 'number') return typeof value === 'number';
									return typeof value === 'string';
								});
								if (!possible) {
									problems.push(`${where}: ${kind} when ${key} is ${JSON.stringify(value)}, a value "${key}" (${controllers[0].type}) can never have`);
								}
							}
						}
					}
				}

				// Two fields with the same name and identical conditions shadow each other.
				const seen = new Map<string, number>();
				for (const field of op.fields) {
					const key = `${field.name}|${JSON.stringify(field.displayOptions ?? {})}`;
					seen.set(key, (seen.get(key) ?? 0) + 1);
				}
				for (const [key, count] of seen) {
					if (count > 1) problems.push(`${key.split('|')[0]}: defined ${count} times with identical conditions`);
				}

				expect(problems, problems.join('\n')).toEqual([]);
			});
		}
	});
}
