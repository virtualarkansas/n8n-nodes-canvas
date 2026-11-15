/**
 * Regenerate test/fixtures/request-snapshot.json: the request every operation builds for the
 * sample values of the test catalog. `npm test` compares the handlers with this file, so run
 * this after changing a handler or a description on purpose and review the diff before
 * committing it: every changed line is a request that now looks different.
 *
 * Usage: npx tsx test/tools/request-snapshot.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRequestSnapshot } from '../lib/snapshot';

const file = resolve(__dirname, '..', 'fixtures', 'request-snapshot.json');
const snapshot = buildRequestSnapshot();
writeFileSync(file, JSON.stringify(snapshot, null, 1) + '\n');
const variants = Object.values(snapshot).reduce((sum, entry) => sum + Object.keys(entry).length, 0);
console.log(`${Object.keys(snapshot).length} operations, ${variants} requests written to ${file}`);
