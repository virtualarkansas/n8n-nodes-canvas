import { describe, expect, it } from 'vitest';
import { buildRequestFor, listOperations, paramVariants } from '../lib/catalog';

/**
 * Whatever a text or number parameter holds, it must not change where the request goes.
 *
 * For every operation, every parameter set of the catalog and every text or number parameter
 * in it, the value is replaced by a series of hostile values (slashes, escapes, "?", "#",
 * relative segments, lists and objects as an expression would hand them over, URLs with
 * escaped payloads). The node's own request builder then has to refuse the value, or build
 * a path that
 *   - has no query string and no fragment (parameters travel in `qs`),
 *   - has no relative segment, however it is written, and
 *   - has exactly as many segments as with a harmless value.
 *
 * This holds for values handlers put into the path as they are (the node encodes them) and
 * guards the ones a handler changes first (trims, takes out of a URL): each of those needs
 * its own care, and this test is what notices when one is missed.
 */
const HOSTILE: unknown[] = [
	'a/b',
	'a%2Fb',
	'x?y=1',
	'x#y',
	'x%3Fy%3D1%23',
	'%2e%2e',
	'..',
	'../x',
	'a\\b',
	' 5/6 ',
	['5?x=1#'],
	['a/b', 'c'],
	{ a: '?#/' },
	'https://canvas.example/api/v1/progress/5%2Fcancel',
	'https://canvas.example/api/v1/progress/5%3Fas_user_id%3D42%23',
	'/api/v1/progress/7/extra',
];

/** The Custom API Request's path is the user's own text: it may carry a query and any number of segments. */
const FREE_FORM = new Set(['apiRequest.request.path']);

const segments = (endpoint: string): number => endpoint.split('/').length;
const relative = (endpoint: string): boolean =>
	endpoint.split(/[/\\]/).some((part) => {
		let decoded = part;
		try {
			decoded = decodeURIComponent(part);
		} catch {
			// not an escape sequence
		}
		return decoded.split(/[/\\]/).some((piece) => piece === '.' || piece === '..');
	});

describe('no parameter value changes where a request goes', () => {
	it('holds for every text and number parameter of every operation', () => {
		const violations: string[] = [];
		let checked = 0;
		for (const op of listOperations()) {
			const types = new Map(op.fields.map((field) => [field.name, field.type]));
			for (const variant of paramVariants(op)) {
				let baseline: { endpoint: string; encodedParams?: string[]; thenGet?: string };
				try {
					baseline = buildRequestFor(op.resource, op.operation, variant.params);
				} catch {
					continue; // a parameter set the operation refuses as a whole
				}
				for (const name of Object.keys(variant.params)) {
					const type = types.get(name);
					if (type !== 'string' && type !== 'number') continue;
					if (FREE_FORM.has(`${op.resource}.${op.operation}.${name}`)) continue;
					// What the path looks like with a harmless value of the same shape in this parameter
					// (an empty and a filled parameter, or one ID and several, may legitimately lead to
					// different routes).
					const harmless = (shape: unknown): { endpoint: string; encodedParams?: string[]; thenGet?: string } => {
						try {
							const value = Array.isArray(shape) && shape.length > 1 ? ['x7', 'x8'] : 'x7';
							return buildRequestFor(op.resource, op.operation, { ...variant.params, [name]: value });
						} catch {
							// the operation wants a particular kind of value here: compare with the catalog's own
							return baseline;
						}
					};
					for (const hostile of HOSTILE) {
						const reference = harmless(hostile);
						let built: { endpoint: string; encodedParams?: string[]; thenGet?: string };
						try {
							built = buildRequestFor(op.resource, op.operation, { ...variant.params, [name]: hostile });
						} catch {
							checked++;
							continue; // refused: nothing is sent
						}
						checked++;
						const where = `${op.resource}.${op.operation} [${variant.label}] ${name} = ${JSON.stringify(hostile)}`;
						for (const endpoint of [built.endpoint, built.thenGet].filter((e): e is string => typeof e === 'string')) {
							if (/[?#]/.test(endpoint)) violations.push(`${where}: query or fragment in ${endpoint}`);
							if (relative(endpoint)) violations.push(`${where}: relative segment in ${endpoint}`);
						}
						// A parameter that is a path of several segments by design is encoded by its handler.
						const multiSegment = (built.encodedParams ?? reference.encodedParams ?? []).includes(name);
						if (!multiSegment && segments(built.endpoint) !== segments(reference.endpoint)) {
							violations.push(`${where}: ${reference.endpoint} became ${built.endpoint}`);
						}
						// The same for the path that is read after a write.
						if (
							!multiSegment &&
							typeof built.thenGet === 'string' &&
							typeof reference.thenGet === 'string' &&
							segments(built.thenGet) !== segments(reference.thenGet)
						) {
							violations.push(`${where}: the read after the write, ${reference.thenGet}, became ${built.thenGet}`);
						}
					}
				}
			}
		}
		expect(checked).toBeGreaterThan(20_000);
		expect(violations.slice(0, 25), `${violations.length} violations`).toEqual([]);
	});
});
