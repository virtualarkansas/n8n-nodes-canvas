import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { resolve } from 'node:path';

/**
 * Canvas throttles API clients with a leaky bucket per client (app/middleware/request_throttle.rb):
 * every request adds its cost (CPU + database time) to the bucket, the bucket leaks
 * `outflow` (10) units per second, `X-Rate-Limit-Remaining` is `hwm` (600) minus the level,
 * and at or above `hwm` requests are answered with `403 Forbidden (Rate Limit Exceeded)`.
 *
 * The limits themselves (hwm / maximum / outflow) can be overridden per client through the
 * `request_throttle.custom_settings` setting, but Canvas caches settings in each process until
 * it receives SIGHUP, which the development server (puma started by `rails server`) treats as
 * "stop". So on the shared test instance a per-client override of the limits cannot be applied
 * without endangering everyone else. What can be done safely is to set the *level* of one
 * client's bucket: the bucket of a token lives in Redis under
 * `request_throttling:token:<HMAC-SHA1(token, encryption key)>`, and nobody else uses the
 * bucket of a token this battery created for itself. The middleware, its headers and its 403
 * responses are then the real thing.
 */
export const THROTTLE = { hwm: 600, maximum: 800, outflow: 10, upFrontCost: 50 } as const;

function encryptionKey(): string {
	if (process.env.CANVAS_ENCRYPTION_KEY) return process.env.CANVAS_ENCRYPTION_KEY;
	const env = readFileSync(resolve(__dirname, '..', '..', 'env', 'canvas', 'canvas.env'), 'utf8');
	const match = /^ENCRYPTION_KEY=(.+)$/m.exec(env);
	if (!match) throw new Error('ENCRYPTION_KEY not found in test/env/canvas/canvas.env');
	return match[1].trim();
}

/** Redis key of the throttle bucket Canvas keeps for an access token. */
export function bucketKey(token: string): string {
	return `request_throttling:token:${createHmac('sha1', encryptionKey()).update(token).digest('hex')}`;
}

/** One Redis command over a short-lived connection (RESP), returning the raw reply text. */
function redis(args: string[]): Promise<string> {
	const host = process.env.CANVAS_REDIS_HOST ?? '127.0.0.1';
	const port = Number(process.env.CANVAS_REDIS_PORT ?? 6379);
	return new Promise((resolvePromise, reject) => {
		const socket = connect(port, host);
		let buffer = '';
		socket.setTimeout(5000, () => {
			socket.destroy();
			reject(new Error(`Redis at ${host}:${port} did not answer`));
		});
		socket.on('connect', () => {
			socket.write(`*${args.length}\r\n${args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join('')}`);
		});
		socket.on('data', (chunk: Buffer) => {
			buffer += chunk.toString('utf8');
			if (buffer.endsWith('\r\n')) {
				socket.end();
				resolvePromise(buffer);
			}
		});
		socket.on('error', reject);
	});
}

/** Current level of a token's bucket as stored (not yet leaked), or undefined when Canvas has none. */
export async function bucketLevel(token: string): Promise<number | undefined> {
	const reply = await redis(['HGET', bucketKey(token), 'count']);
	const match = /^\$\d+\r\n([^\r]+)\r\n/.exec(reply);
	return match ? Number(match[1]) : undefined;
}

/**
 * Set the level of a token's bucket, as of now. `remaining` is what Canvas will report in
 * X-Rate-Limit-Remaining right afterwards: negative values mean the bucket is over its high
 * water mark, i.e. requests are refused until it has leaked back (10 units per second).
 */
export async function setRemaining(token: string, remaining: number): Promise<void> {
	const count = Math.min(THROTTLE.maximum, Math.max(0, THROTTLE.hwm - remaining));
	const reply = await redis(['HSET', bucketKey(token), 'count', String(count), 'last_touched', String(Date.now() / 1000)]);
	if (!reply.startsWith(':')) throw new Error(`Unexpected Redis reply: ${reply}`);
	await redis(['EXPIRE', bucketKey(token), '3600']);
}

/** Keep a token's bucket at a fixed level until the returned function is called. */
export function holdRemaining(token: string, remaining: number, everyMs = 250): () => Promise<void> {
	let stopped = false;
	const tick = async (): Promise<void> => {
		while (!stopped) {
			await setRemaining(token, remaining).catch(() => undefined);
			await new Promise((r) => setTimeout(r, everyMs));
		}
	};
	const loop = tick();
	return async () => {
		stopped = true;
		await loop;
		// Leave the bucket empty so nothing lingers.
		await setRemaining(token, THROTTLE.hwm).catch(() => undefined);
	};
}
