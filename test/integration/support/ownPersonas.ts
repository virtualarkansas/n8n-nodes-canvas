import { execFileSync } from 'node:child_process';
import { canvas, createUserWithToken, fx } from '../../lib/canvas';
import type { CanvasClient, TestUser } from '../../lib/canvas';
import { createCredential, n8n } from '../../lib/harness';
import type { Json } from '../../lib/n8n';

/**
 * Users of a test file's own that the node can act as: a Canvas user with an API
 * token and an n8n credential for it. For operations that only work on, or change
 * the personal data of, "the current user" (activity stream, to-do list, course
 * invitations, ...), which must never happen to the seeded personas.
 */
export interface OwnPersona extends TestUser {
	/** Pass as `credential` to runNode / runOk. */
	credential: { id: string; name: string; type: string };
}

export async function ownPersona(label: string): Promise<OwnPersona> {
	const user = await createUserWithToken(label);
	const credential = await createCredential(user.token, label.toLowerCase());
	return { ...user, credential };
}

/** Remove the users from Canvas and their credentials from n8n (best effort, for afterAll). */
export async function removePersonas(personas: Array<OwnPersona | undefined>): Promise<void> {
	for (const persona of personas) {
		if (!persona) continue;
		await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${persona.id}`);
		await n8n()
			.api('DELETE', `/credentials/${persona.credential.id}`)
			.catch(() => undefined);
	}
}

/**
 * Run Ruby inside Canvas and return what it printed. Only for what the Canvas API
 * cannot do or show (records of hosted features, preferences without a GET).
 */
export function rails(script: string): string {
	return execFileSync('docker', ['exec', 'canvas-web', 'bundle', 'exec', 'rails', 'runner', script], {
		encoding: 'utf8',
	});
}

/** The JSON a Ruby script printed on a line starting with `JSON=`. */
export function railsJson<T = Json>(script: string): T {
	const out = rails(script);
	const line = out.split('\n').find((entry) => entry.startsWith('JSON='));
	if (!line) throw new Error(`The Ruby script printed no JSON= line: ${out.slice(0, 400)}`);
	return JSON.parse(line.slice(5)) as T;
}

/** Poll until `probe` returns something (Canvas does much of its work in background jobs). */
export async function waitFor<T>(
	what: string,
	probe: () => Promise<T | undefined | null | false>,
	timeoutMs = 120_000,
): Promise<T> {
	const started = Date.now();
	for (;;) {
		const value = await probe();
		if (value !== undefined && value !== null && value !== false) return value;
		if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
}

/** Wait for a Canvas background job and return its final Progress object. */
export function waitForProgress(progressId: unknown): Promise<Json> {
	return waitFor(`progress ${String(progressId)}`, async () => {
		const progress = await canvas().get<Json>(`/api/v1/progress/${String(progressId)}`);
		return ['completed', 'failed'].includes(String(progress.workflow_state)) ? progress : undefined;
	});
}

/**
 * Read a list from Canvas by following its Link headers: all of it, or (to keep
 * long lists cheap) only its first `limit` records.
 */
export async function readList(client: CanvasClient, path: string, limit?: number): Promise<Json[]> {
	const out: Json[] = [];
	let next: string | undefined = `${path}${path.includes('?') ? '&' : '?'}per_page=${Math.min(100, limit ?? 100)}`;
	while (next && (limit === undefined || out.length < limit)) {
		const res = await client.request('GET', next);
		if (res.status >= 400) {
			throw new Error(`Canvas GET ${next} -> ${res.status}: ${JSON.stringify(res.data).slice(0, 400)}`);
		}
		out.push(...(res.data as Json[]));
		next = /<([^>]+)>\s*;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1];
	}
	return limit === undefined ? out : out.slice(0, limit);
}

export interface ListComparison {
	/** What identifies a record. Default: its `id`. */
	key?: (record: Json) => string;
	/** The node was asked for the first `take` records only (page size x pages). */
	take?: number;
	/**
	 * The endpoint pages by page number. When records are added while such a list is
	 * read, later pages repeat records of earlier ones; that is Canvas, not the node.
	 */
	numberedPages?: boolean;
	/**
	 * Records also disappear from the list while it is read (other test files delete
	 * what they posted): a record the node saw may be gone again a moment later.
	 */
	volatile?: boolean;
}

/**
 * Compare what the node listed with what Canvas lists, for lists other test files
 * may be adding to at this very moment (activity streams, to-do lists, submissions
 * of the seeded personas).
 *
 * `direct` reads the list from Canvas (all of it, or the first `limit` records); it
 * is read before and after the node ran. When nothing changed in between, the node's
 * output must be exactly that list (or its first `take` entries), in Canvas' order,
 * without duplicates. When it did change, every listed entry must exist at one of
 * the two moments (unless the list is `volatile`), and a complete listing must hold
 * everything that existed at both.
 */
export async function expectListedLikeCanvas(
	run: () => Promise<Json[]>,
	direct: (limit?: number) => Promise<Json[]>,
	options: ListComparison = {},
): Promise<{ listed: Json[]; all: Json[] }> {
	const key = options.key ?? ((record: Json): string => String(record.id));
	const take = options.take;
	const before = (await direct(take)).map(key);
	const listedRecords = await run();
	const allAfter = await direct(take);
	const after = allAfter.map(key);
	let listed = listedRecords.map(key);
	const changed = JSON.stringify(before) !== JSON.stringify(after);

	const duplicates = listed.filter((entry, index) => listed.indexOf(entry) !== index);
	if (duplicates.length > 0) {
		if (!(changed && options.numberedPages)) {
			throw new Error(`Duplicates in the node output: ${duplicates.slice(0, 5).join(', ')}`);
		}
		listed = Array.from(new Set(listed));
	}

	if (!changed) {
		const expected = take === undefined ? before : before.slice(0, take);
		if (JSON.stringify(listed) !== JSON.stringify(expected)) {
			throw new Error(
				`The node listed ${listed.length} records, Canvas ${expected.length}` +
					`${take === undefined ? '' : ` (first ${take} of ${before.length})`}.\n` +
					`node:   ${listed.slice(0, 12).join(', ')}\ncanvas: ${expected.slice(0, 12).join(', ')}`,
			);
		}
	} else {
		const known = new Set([...before, ...after]);
		const unknown = listed.filter((entry) => !known.has(entry));
		if (unknown.length > 0 && !options.volatile) {
			throw new Error(`Records Canvas does not list: ${unknown.slice(0, 5).join(', ')}`);
		}
		if (take === undefined) {
			// A record that moved towards the head meanwhile (e.g. graded again in a list sorted
			// by grading time) can be passed over by any reader; everything else must be there.
			const listedSet = new Set(listed);
			const missing = before.filter(
				(entry, index) => after.includes(entry) && !listedSet.has(entry) && after.indexOf(entry) >= index,
			);
			if (missing.length > 0) throw new Error(`Records missing from the node output: ${missing.slice(0, 5).join(', ')}`);
		} else {
			const expectedLength = Math.min(take, Math.min(before.length, after.length));
			if (listedRecords.length < expectedLength || listedRecords.length > take) {
				throw new Error(`The node listed ${listedRecords.length} records where ${expectedLength} to ${take} were expected`);
			}
		}
	}
	return { listed: listedRecords, all: allAfter };
}

/** An ISO timestamp some hours from now (negative: in the past). */
export function hoursFromNow(hours: number): string {
	return new Date(Date.now() + hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
