import { describe, expect, it } from 'vitest';
import { buildRequestFor, listOperations, listResources, paramVariants } from '../lib/catalog';
import { findRoute, parameterSegments, routesForPath } from '../lib/routes';
import { resourceHandlers } from '../../nodes/Canvas/handlers';

/**
 * Every operation offered in the UI must build a request for a route that
 * really exists in Canvas, for every context/selector value it offers and
 * with both no optional fields and all optional fields set.
 */
const operations = listOperations();

/** Resources whose path is whatever the user types; there is nothing to audit. */
const FREE_FORM = new Set(['apiRequest']);

describe('resource wiring', () => {
	it('every resource in the dropdown has a handler and operations, and vice versa', () => {
		const dropdown = listResources().sort();
		const withOperations = Array.from(new Set(operations.map((o) => o.resource))).sort();
		expect(withOperations).toEqual(dropdown);
		expect(Object.keys(resourceHandlers).sort()).toEqual(dropdown);
	});
});

const byResource = new Map<string, typeof operations>();
for (const op of operations) {
	byResource.set(op.resource, [...(byResource.get(op.resource) ?? []), op]);
}

for (const [resource, ops] of byResource) {
	describe(`routes: ${resource}`, () => {
		for (const op of ops) {
			it(`${op.operation} targets an existing Canvas route`, () => {
				const variants = paramVariants(op);
				const problems: string[] = [];
				let built = 0;

				for (const variant of variants) {
					let request;
					try {
						request = buildRequestFor(op.resource, op.operation, variant.params);
					} catch (error) {
						// Operations that need at least one entry reject the empty variant by design.
						if (variant.label.startsWith('minimal') && /at least one/i.test((error as Error).message)) {
							continue;
						}
						problems.push(`${variant.label}: handler threw "${(error as Error).message}"`);
						continue;
					}
					built++;
					const path = request.endpoint.split('?')[0];
					if (/\/\/|\/$|undefined|null|\[object/.test(path)) {
						problems.push(`${variant.label}: malformed path ${path}`);
						continue;
					}
					if (!FREE_FORM.has(op.resource) && !findRoute(request.method, path)) {
						const verbs = routesForPath(path).map((r) => r.verb);
						problems.push(
							`${variant.label}: ${request.method} ${path} ` +
								(verbs.length > 0 ? `(Canvas only accepts ${verbs.join('|')} here)` : '(no such path in Canvas)'),
						);
					}
				}

				expect(built, 'no parameter variant produced a request').toBeGreaterThan(0);
				expect(problems, problems.join('\n')).toEqual([]);
			});
		}
	});
}

describe('findRoute', () => {
	it('attributes a literal segment to the literal route, not to the :id route next to it', () => {
		expect(findRoute('GET', '/api/v1/accounts/1/sis_imports/importing')?.to).toBe('sis_imports_api#importing');
		expect(findRoute('GET', '/api/v1/accounts/1/sis_imports/42')?.to).toBe('sis_imports_api#show');
		expect(findRoute('GET', '/api/v1/courses/1/files/quota')?.to).toBe('files#api_quota');
		expect(findRoute('GET', '/api/v1/courses/1/files/42')?.to).not.toBe('files#api_quota');
	});

	it('prefers the route with the fewest parameter segments', () => {
		const path = '/api/v1/accounts/1/sis_imports/importing';
		const candidates = routesForPath(path).filter((route) => route.verb === 'GET');
		expect(candidates.length).toBeGreaterThan(1);
		const best = findRoute('GET', path);
		for (const route of candidates) {
			expect(parameterSegments(best?.path ?? '')).toBeLessThanOrEqual(parameterSegments(route.path));
		}
		expect(parameterSegments('/api/v1/courses/:course_id/files(/:id)')).toBe(2);
		expect(parameterSegments('/api/v1/files/quota')).toBe(0);
	});
});
