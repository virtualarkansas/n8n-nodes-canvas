import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The API route table of a real Canvas instance (dumped from
 * `Rails.application.routes` of instructure/canvas-lms, see test/fixtures).
 * Lets the unit tests prove that every operation targets a route that exists.
 */
export interface CanvasRoute {
	verb: string;
	path: string;
	to: string;
}

interface CompiledRoute extends CanvasRoute {
	pattern: RegExp;
}

let compiled: CompiledRoute[] | undefined;

function compile(path: string): RegExp {
	// (/:optional) groups -> optional non-capturing groups; :param -> one segment; *glob -> rest.
	let source = '';
	for (let i = 0; i < path.length; i++) {
		const ch = path[i];
		if (ch === '(') {
			source += '(?:';
		} else if (ch === ')') {
			source += ')?';
		} else if (ch === ':' || ch === '*') {
			let j = i + 1;
			while (j < path.length && /[A-Za-z0-9_]/.test(path[j])) j++;
			source += ch === ':' ? '[^/]+' : '.+';
			i = j - 1;
		} else {
			source += ch.replace(/[.+?^${}|[\]\\]/g, '\\$&');
		}
	}
	return new RegExp(`^${source}$`);
}

export function canvasRoutes(): CompiledRoute[] {
	if (!compiled) {
		const routes: CanvasRoute[] = [];
		// canvas-routes.json: dumped from a running Canvas. extra-routes.json: services that are
		// not part of the open-source app (New Quizzes, the Analytics plugin), from the API docs.
		for (const name of ['canvas-routes.json', 'extra-routes.json']) {
			const file = resolve(__dirname, '..', 'fixtures', name);
			routes.push(...(JSON.parse(readFileSync(file, 'utf8')) as { routes: CanvasRoute[] }).routes);
		}
		compiled = routes.map((route) => ({ ...route, pattern: compile(route.path) }));
	}
	return compiled;
}

/** Routes matching a concrete request path, for any verb. */
export function routesForPath(path: string): CompiledRoute[] {
	const clean = path.split('?')[0];
	return canvasRoutes().filter((route) => route.pattern.test(clean));
}

/** Number of `:param` and `*glob` segments of a route path. */
export function parameterSegments(path: string): number {
	return path.split('/').filter((segment) => /^\(?[:*]/.test(segment)).length;
}

/**
 * The route Canvas would dispatch a request to: of the routes that match, the one with
 * the fewest parameter segments, so `/files/quota` is attributed to the literal
 * `/files/quota` route and not to `/files/:id`. Ties keep the order of the fixture.
 */
export function findRoute(method: string, path: string): CompiledRoute | undefined {
	const verb = method.toUpperCase();
	let best: CompiledRoute | undefined;
	for (const route of routesForPath(path)) {
		if (route.verb !== verb) continue;
		if (!best || parameterSegments(route.path) < parameterSegments(best.path)) best = route;
	}
	return best;
}
