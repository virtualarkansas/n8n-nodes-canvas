import { inflateRawSync } from 'node:zlib';
import { canvas } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { loadState } from '../lib/state';

/**
 * Helpers for the content resources of the battery (not a test file):
 * waiting for background jobs through the node, uploading files to Canvas and
 * looking into the archives Canvas exports.
 */

/**
 * Follow a background job the way a workflow would: poll the node's
 * Progress > Get until Canvas reports the job as finished.
 * `progress` is a progress ID or a `progress_url`.
 */
export async function waitForProgress(
	progress: unknown,
	options: { persona?: string; timeoutMs?: number; allowFailure?: boolean } = {},
): Promise<Json> {
	const progressId = String(progress).split('/').pop() as string;
	const deadline = Date.now() + (options.timeoutMs ?? 150_000);
	for (;;) {
		const [state] = await runOk({
			resource: 'progress',
			operation: 'get',
			persona: options.persona,
			params: { progressId },
		});
		if (state.workflow_state === 'completed') return state;
		if (state.workflow_state === 'failed') {
			if (options.allowFailure) return state;
			throw new Error(`Background job ${progressId} failed: ${JSON.stringify(state)}`);
		}
		if (Date.now() > deadline) {
			throw new Error(`Background job ${progressId} did not finish in time: ${JSON.stringify(state)}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
}

/** Wait (directly against Canvas) until a condition holds; for outcomes that follow a finished job. */
export async function eventually<T>(
	check: () => Promise<T | undefined | false>,
	what: string,
	timeoutMs = 60_000,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const result = await check();
		if (result) return result;
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
}

/**
 * Upload a file with Canvas' three-step upload.
 * `target` is the files endpoint of a context or folder, e.g. `/api/v1/courses/5/files`.
 */
export async function uploadFile(
	target: string,
	name: string,
	content: string | Uint8Array,
	options: { contentType?: string; folderPath?: string; client?: CanvasClient; token?: string } = {},
): Promise<Json> {
	const contentType = options.contentType ?? 'text/plain';
	const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
	const authorization = options.token ? `Bearer ${options.token}` : undefined;
	const request = async (method: string, url: string, body?: unknown): Promise<Json> => {
		if (!authorization) {
			const client = options.client ?? canvas();
			const res = await client.request(method, url, body);
			if (res.status >= 400) throw new Error(`Canvas ${method} ${url} -> ${res.status}: ${JSON.stringify(res.data)}`);
			return res.data as Json;
		}
		const res = await fetch(/^https?:/.test(url) ? url : `${canvas().url}${url}`, {
			method,
			headers: { authorization, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (res.status >= 400) throw new Error(`Canvas ${method} ${url} -> ${res.status}: ${await res.text()}`);
		return (await res.json()) as Json;
	};

	const slot = await request('POST', target, {
		name,
		size: data.byteLength,
		content_type: contentType,
		...(options.folderPath ? { parent_folder_path: options.folderPath } : {}),
		on_duplicate: 'rename',
	});
	return postToUploadSlot(slot, name, data, contentType, request);
}

/** Steps two and three of the upload: post the bytes to the slot and confirm. */
export async function postToUploadSlot(
	slot: Json,
	name: string,
	data: Uint8Array,
	contentType: string,
	request: (method: string, url: string) => Promise<Json> = (method, url) =>
		canvas().request(method, url).then((res) => res.data as Json),
): Promise<Json> {
	const form = new FormData();
	for (const [key, value] of Object.entries((slot.upload_params ?? {}) as Record<string, string>)) {
		form.append(key, value);
	}
	form.append('file', new Blob([new Uint8Array(data)], { type: contentType }), name);
	const uploaded = await fetch(String(slot.upload_url), { method: 'POST', body: form, redirect: 'manual' });
	if (uploaded.status >= 300 && uploaded.status < 400) {
		return request('GET', uploaded.headers.get('location') as string);
	}
	if (uploaded.status >= 400) {
		throw new Error(`File upload failed: ${uploaded.status} ${(await uploaded.text()).slice(0, 300)}`);
	}
	return (await uploaded.json()) as Json;
}

/**
 * Download a file Canvas links to (e.g. the attachment of a finished export),
 * as the admin unless another user's API token is given.
 */
export async function download(url: unknown, token?: string): Promise<Buffer> {
	const res = await fetch(String(url), {
		headers: { authorization: `Bearer ${token ?? loadState().canvas.tokens.admin}` },
	});
	if (res.status !== 200) throw new Error(`Download of ${String(url)} failed: ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

interface ZipEntry {
	name: string;
	method: number;
	compressedSize: number;
	localHeaderOffset: number;
}

function zipDirectory(zip: Buffer): ZipEntry[] {
	const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (end < 0) throw new Error('Not a zip archive');
	const count = zip.readUInt16LE(end + 10);
	let offset = zip.readUInt32LE(end + 16);
	const entries: ZipEntry[] = [];
	for (let i = 0; i < count; i++) {
		if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt zip central directory');
		const nameLength = zip.readUInt16LE(offset + 28);
		const extraLength = zip.readUInt16LE(offset + 30);
		const commentLength = zip.readUInt16LE(offset + 32);
		entries.push({
			name: zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
			method: zip.readUInt16LE(offset + 10),
			compressedSize: zip.readUInt32LE(offset + 20),
			localHeaderOffset: zip.readUInt32LE(offset + 42),
		});
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

/** Names of the files in a zip archive. */
export function zipNames(zip: Buffer): string[] {
	return zipDirectory(zip).map((entry) => entry.name);
}

/** Content of one file of a zip archive, as text. */
export function zipRead(zip: Buffer, name: string): string {
	const entry = zipDirectory(zip).find((candidate) => candidate.name === name);
	if (!entry) throw new Error(`"${name}" is not in the archive (${zipNames(zip).join(', ')})`);
	const header = entry.localHeaderOffset;
	const start = header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28);
	const data = zip.subarray(start, start + entry.compressedSize);
	return (entry.method === 8 ? inflateRawSync(data) : data).toString('utf8');
}

/** A zip archive with stored (uncompressed) text files; enough for Canvas' zip importer. */
export function makeZip(files: Record<string, string>): Buffer {
	const crcTable = Array.from({ length: 256 }, (_, n) => {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		return c >>> 0;
	});
	const crc32 = (data: Buffer): number => {
		let crc = 0xffffffff;
		for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
		return (crc ^ 0xffffffff) >>> 0;
	};
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const [name, text] of Object.entries(files)) {
		const nameBytes = Buffer.from(name, 'utf8');
		const data = Buffer.from(text, 'utf8');
		const crc = crc32(data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6); // UTF-8 names
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBytes.length, 26);
		locals.push(local, nameBytes, data);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBytes.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, nameBytes);
		offset += 30 + nameBytes.length + data.length;
	}
	const directory = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(Object.keys(files).length, 8);
	end.writeUInt16LE(Object.keys(files).length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, directory, end]);
}
