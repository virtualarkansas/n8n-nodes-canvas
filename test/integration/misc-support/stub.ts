import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A tiny stand-in for Canvas that records every request it receives and answers
 * from a script. It is used where the real Canvas cannot be made to behave on
 * demand (429 responses, a quota that follows a script) and to see exactly what
 * the node puts on the wire (debug mode comparisons). n8n runs on the same host,
 * so a credential whose Canvas URL is the stub's URL reaches it.
 */
export interface StubRequest {
	method: string;
	/** Path and query string exactly as received. */
	url: string;
	path: string;
	headers: IncomingHttpHeaders;
	body: string;
	/** Milliseconds since the stub was started or reset. */
	at: number;
	/** True for the node's quota probe (GET /api/v1/users/self). */
	probe: boolean;
}

export interface StubResponse {
	status?: number;
	headers?: Record<string, string>;
	/** Objects are sent as JSON, strings as text/plain. */
	body?: unknown;
	delayMs?: number;
}

export type StubHandler = (request: StubRequest, stub: CanvasStub) => StubResponse | undefined;

export class CanvasStub {
	requests: StubRequest[] = [];
	private server: Server | undefined;
	private started = Date.now();
	private handler: StubHandler = () => undefined;
	url = '';

	async start(): Promise<void> {
		this.server = createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk: Buffer) => chunks.push(chunk));
			req.on('end', () => {
				const url = req.url ?? '';
				const path = url.split('?')[0];
				const request: StubRequest = {
					method: req.method ?? '',
					url,
					path,
					headers: req.headers,
					body: Buffer.concat(chunks).toString('utf8'),
					at: Date.now() - this.started,
					probe: req.method === 'GET' && path === '/api/v1/users/self',
				};
				this.requests.push(request);
				const answer = this.handler(request, this) ?? {};
				const body = answer.body === undefined ? { id: 1, stub: true } : answer.body;
				const text = typeof body === 'string' ? body : JSON.stringify(body);
				const send = (): void => {
					res.writeHead(answer.status ?? 200, {
						'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
						'x-rate-limit-remaining': '600.0',
						'x-request-cost': '0.05',
						...(answer.headers ?? {}),
					});
					res.end(text);
				};
				if (answer.delayMs) setTimeout(send, answer.delayMs);
				else send();
			});
		});
		await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
		this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
	}

	/** Forget recorded requests and install the script for the next scenario. */
	reset(handler: StubHandler = () => undefined): void {
		this.requests = [];
		this.started = Date.now();
		this.handler = handler;
	}

	/** Requests other than the node's quota probe. */
	get calls(): StubRequest[] {
		return this.requests.filter((r) => !r.probe);
	}

	get probes(): StubRequest[] {
		return this.requests.filter((r) => r.probe);
	}

	async stop(): Promise<void> {
		if (!this.server) return;
		await new Promise<void>((resolve) => this.server!.close(() => resolve()));
		this.server = undefined;
	}
}
