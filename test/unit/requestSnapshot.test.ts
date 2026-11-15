import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRequestSnapshot } from '../lib/snapshot';
import type { RequestSnapshot } from '../lib/snapshot';

/**
 * Every operation's request (method, path, query, body, hints) against the committed snapshot.
 * A difference is not necessarily a bug, but it is always a change in what the node sends:
 * if it is intended, run `npx tsx test/tools/request-snapshot.ts` and commit the diff.
 */
describe('request snapshot', () => {
	const committed = JSON.parse(
		readFileSync(resolve(__dirname, '..', 'fixtures', 'request-snapshot.json'), 'utf8'),
	) as RequestSnapshot;
	const current = JSON.parse(JSON.stringify(buildRequestSnapshot())) as RequestSnapshot;

	it('covers exactly the operations the node offers', () => {
		expect(Object.keys(current).sort()).toEqual(Object.keys(committed).sort());
	});

	it('every operation builds the request it built when the snapshot was taken', () => {
		const changed = Object.keys(current).filter(
			(operation) => JSON.stringify(current[operation]) !== JSON.stringify(committed[operation]),
		);
		// Show the first differences in full; the list alone for the rest.
		for (const operation of changed.slice(0, 5)) {
			expect(current[operation], `${operation} (intended? run: npx tsx test/tools/request-snapshot.ts)`).toEqual(committed[operation]);
		}
		expect(changed, 'operations whose request changed').toEqual([]);
	});
});
