import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';

export interface FileServer {
	/** Base URL Canvas can fetch from (no trailing slash); empty when this machine has no usable address. */
	url: string;
	port: number;
	/** Serve `body` under `path` (e.g. "/essay.txt"). */
	serve(path: string, body: Buffer | string, type?: string): void;
	close(): void;
}

/**
 * A small HTTP server for uploads "from a URL". Canvas refuses to fetch from
 * loopback and private addresses, so the files are served on an address of
 * this machine that is neither.
 */
export async function startFileServer(): Promise<FileServer> {
	const served = new Map<string, { body: Buffer; type: string }>();
	const blocked = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
	const address = Object.values(networkInterfaces())
		.flat()
		.find((entry) => entry && entry.family === 'IPv4' && !entry.internal && !blocked.test(entry.address))?.address;
	const server: Server = createServer((req, res) => {
		const file = served.get(decodeURIComponent((req.url ?? '').split('?')[0]));
		if (!file) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			res.end('not here');
			return;
		}
		res.writeHead(200, { 'content-type': file.type, 'content-length': file.body.length });
		res.end(file.body);
	});
	await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
	const port = (server.address() as { port: number }).port;
	return {
		url: address ? `http://${address}:${port}` : '',
		port,
		serve(path, body, type = 'text/plain') {
			served.set(path, { body: Buffer.isBuffer(body) ? body : Buffer.from(body), type });
		},
		close() {
			server.close();
		},
	};
}
