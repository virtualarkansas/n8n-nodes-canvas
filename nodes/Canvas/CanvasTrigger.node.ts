import { createPublicKey, timingSafeEqual, verify as verifySignature } from 'crypto';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'zlib';
import type {
	IHookFunctions,
	IWebhookFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { canvasLiveEvents } from './CanvasTriggerEvents';

/** Where Instructure publishes the keys that sign Live Events (see the Data Services docs). */
const INSTRUCTURE_JWKS_URL = 'https://8axpcl50e4.execute-api.us-east-1.amazonaws.com/main/jwks';

/** Global IDs are (shard * 10^13) + local ID. */
const SHARD_FACTOR = BigInt('10000000000000');

const JWT_ALGORITHMS: Record<string, { hash: string; ec?: boolean }> = {
	RS256: { hash: 'sha256' },
	RS384: { hash: 'sha384' },
	RS512: { hash: 'sha512' },
	ES256: { hash: 'sha256', ec: true },
	ES384: { hash: 'sha384', ec: true },
	ES512: { hash: 'sha512', ec: true },
};

interface IJwk extends IDataObject {
	kid?: string;
}

/** JWKS documents by URL. Instructure rotates keys monthly; an unknown kid forces a refetch. */
const jwksCache = new Map<string, { keys: IJwk[]; fetchedAt: number }>();
const JWKS_TTL_MS = 60 * 60 * 1000;
/** An unknown key ID refetches the keys, but not more often than this: anyone can send one. */
const JWKS_MIN_REFRESH_MS = 60 * 1000;

interface ICanvasEvent {
	name?: string;
	time?: string;
	metadata: IDataObject;
	body: IDataObject;
	/** Present for Caliper-format deliveries, which carry no Canvas event name. */
	caliper?: IDataObject;
}

/**
 * The local part of a Canvas ID. Live Events metadata carries global IDs
 * ("21070000000000565") while people know their course as "565".
 */
export function toLocalId(id: unknown): string {
	const text = String(id ?? '').trim();
	if (!/^\d+$/.test(text)) {
		return text;
	}
	try {
		return (BigInt(text) % SHARD_FACTOR).toString();
	} catch {
		return text;
	}
}

export function idsMatch(filter: string, candidate: unknown): boolean {
	if (candidate === undefined || candidate === null || candidate === '') {
		return false;
	}
	const wanted = filter.trim();
	const actual = String(candidate).trim();
	return wanted === actual || toLocalId(wanted) === toLocalId(actual);
}

function decodeBase64Url(value: string): Buffer {
	return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function looksLikeJwt(text: string): boolean {
	return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text.trim());
}

/** Largest request body the trigger accepts. Live Events are a few KB. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

interface IRawRequest {
	rawBody?: Buffer;
	headers: Record<string, string | string[] | undefined>;
	on(event: string, listener: (...args: never[]) => void): unknown;
	[Symbol.asyncIterator]?: () => AsyncIterator<Buffer>;
}

/**
 * Read the request body ourselves when n8n left it unread (see the hidden
 * `options` parameter). Returns undefined when the body is too large.
 */
async function readRequestBody(request: IRawRequest): Promise<Buffer | undefined> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of request as unknown as AsyncIterable<Buffer | string>) {
		const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
		size += buffer.length;
		if (size > MAX_BODY_BYTES) {
			return undefined;
		}
		chunks.push(buffer);
	}
	const body = Buffer.concat(chunks);
	const encoding = String(request.headers['content-encoding'] ?? '').toLowerCase();
	// The limit applies to the decompressed size as well: a few KB can unpack to gigabytes.
	const limit = { maxOutputLength: MAX_BODY_BYTES };
	try {
		if (encoding === 'gzip' || encoding === 'x-gzip') {
			return gunzipSync(body, limit);
		}
		if (encoding === 'deflate') {
			return inflateSync(body, limit);
		}
		if (encoding === 'br') {
			return brotliDecompressSync(body, limit);
		}
	} catch (error) {
		if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
			return undefined;
		}
		throw error;
	}
	return body;
}

function constantTimeEquals(a: string, b: string): boolean {
	const left = Buffer.from(a, 'utf8');
	const right = Buffer.from(b, 'utf8');
	return left.length === right.length && timingSafeEqual(left, right);
}

/** Normalise the envelopes Canvas uses into one shape. */
export function parseCanvasEvent(payload: IDataObject): ICanvasEvent | undefined {
	// Data Services (Canvas format): { metadata: {...}, body: {...} }
	// Raw Live Events stream (Kinesis forwarders): { attributes: {...}, body: {...} }
	const metadata = (payload.metadata ?? payload.attributes) as IDataObject | undefined;
	if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
		const body = payload.body;
		return {
			name: metadata.event_name as string | undefined,
			time: metadata.event_time as string | undefined,
			metadata,
			body: body && typeof body === 'object' && !Array.isArray(body) ? (body as IDataObject) : {},
		};
	}

	// Data Services (Caliper 1.1 format): { sensor, sendTime, dataVersion, data: [event] }
	if (Array.isArray(payload.data) && typeof payload.dataVersion === 'string') {
		const event = (payload.data[0] ?? {}) as IDataObject;
		return {
			time: (event.eventTime ?? payload.sendTime) as string | undefined,
			metadata: {},
			body: {},
			caliper: payload,
		};
	}

	return undefined;
}

export class CanvasTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Canvas Trigger',
		name: 'canvasTrigger',
		icon: 'file:../../icons/canvas.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].includes("*") ? "All events" : $parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Canvas LMS sends a Live Event',
		defaults: {
			name: 'Canvas Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Canvas does not register this webhook for you. In Canvas, open Admin → Data Services → Add, choose HTTPS delivery with the <b>Canvas</b> message format, and paste this node\'s Production URL. The URL is public: set a Secret Token or require signed payloads under Options so that only Canvas can start the workflow. <a href="https://developerdocs.instructure.com/services/canvas/data-services/live-events/overview/file.data_service_setup" target="_blank">Setup guide</a>.',
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				description:
					'The events that start the workflow. Events not selected here are acknowledged and ignored, so the Data Services subscription may send more than you use.',
				options: canvasLiveEvents,
			},
			{
				displayName: 'Filter by Course ID',
				name: 'courseId',
				type: 'string',
				default: '',
				description:
					'Only trigger for events in this course (leave empty for all courses). Use the ID from the course URL; global IDs are matched too.',
			},
			{
				displayName: 'Filter by Account ID',
				name: 'accountId',
				type: 'string',
				default: '',
				description:
					'Only trigger for events whose root account or context account is this account (leave empty for all accounts)',
			},
			{
				// n8n parses webhook bodies before the node runs and answers 422 when a body
				// labelled application/json is not JSON, which is what a signed (JWT) delivery
				// can look like. For version 1 webhook nodes n8n skips its parser when
				// options.binaryData is set, so the node can read the body itself and accept
				// JSON and JWT deliveries whatever their Content-Type. If n8n ever stops honouring
				// this, the node falls back to the body n8n parsed.
				displayName: 'Raw Body',
				name: 'options',
				type: 'hidden',
				default: { binaryData: true },
			},
			{
				displayName: 'Options',
				name: 'triggerOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: true,
						description: 'Whether to include the Canvas event metadata (who, where, when) in the output',
					},
					{
						displayName: 'JWKS URL',
						name: 'jwksUrl',
						type: 'string',
						default: INSTRUCTURE_JWKS_URL,
						description:
							'Where to fetch the public keys used to verify signed payloads. The default is the key set Instructure publishes for Canvas Data Services.',
					},
					{
						displayName: 'Require Signed Payload',
						name: 'requireSignedPayload',
						type: 'boolean',
						default: false,
						description:
							'Whether to reject events that are not signed. Turn this on together with "Sign Payload" in the Data Services subscription so that only Canvas can start this workflow.',
					},
					{
						displayName: 'Secret Token',
						name: 'secretToken',
						type: 'string',
						typeOptions: { password: true },
						default: '',
						description:
							'If set, requests must carry this value as a "token" query parameter. Add ?token=YOUR_VALUE to the URL you enter in Canvas Data Services.',
					},
					{
						displayName: 'Verify Signed Payloads',
						name: 'verifySignedPayloads',
						type: 'boolean',
						default: true,
						description:
							'Whether to check the signature of events delivered with the Data Services "Sign Payload" option, and reject them when it is not valid',
					},
				],
			},
		],
		// Required by the n8n community-node lint rules for every node class.
		usableAsTool: true,
	};

	webhookMethods = {
		default: {
			// Canvas subscriptions are created by an admin in Canvas (Admin → Data Services);
			// there is no API this node could call to register its URL.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const events = this.getNodeParameter('events', []) as string[];
		const courseIdFilter = String(this.getNodeParameter('courseId', '') ?? '').trim();
		const accountIdFilter = String(this.getNodeParameter('accountId', '') ?? '').trim();
		// Workflows saved with 0.1.0 keep "Include Metadata" in `options`.
		const legacyOptions = this.getNodeParameter('options', {}) as IDataObject;
		const options: IDataObject = {
			...(legacyOptions?.includeMetadata !== undefined ? { includeMetadata: legacyOptions.includeMetadata } : {}),
			...(this.getNodeParameter('triggerOptions', {}) as IDataObject),
		};

		const request = this.getRequestObject();
		const response = this.getResponseObject();

		const reject = (status: number, message: string): IWebhookResponseData => {
			response.status(status).json({ status: 'rejected', message });
			return { noWebhookResponse: true };
		};
		// Canvas retries anything that is not a 2xx, so events we do not want are acknowledged.
		const ignore = (reason: string): IWebhookResponseData => ({
			webhookResponse: { status: 'ignored', reason },
		});

		// --- Shared secret in the URL ---
		const secretToken = String(options.secretToken ?? '');
		if (secretToken) {
			const provided = String((request.query as IDataObject | undefined)?.token ?? '');
			if (!constantTimeEquals(provided, secretToken)) {
				return reject(403, 'Missing or wrong token');
			}
		}

		// --- Read the payload: JSON, or a signed JWT ---
		let payload: unknown;
		const rawRequest = request as unknown as IRawRequest;
		if (rawRequest.rawBody !== undefined) {
			// n8n already parsed the body.
			payload = this.getBodyData();
			const isEmpty =
				payload === undefined ||
				payload === null ||
				(typeof payload === 'object' && Object.keys(payload as object).length === 0);
			if (isEmpty && rawRequest.rawBody.length > 0) {
				payload = rawRequest.rawBody.toString('utf8');
			}
		} else {
			let raw: Buffer | undefined;
			try {
				raw = await readRequestBody(rawRequest);
			} catch {
				return reject(400, 'The request body could not be read');
			}
			if (raw === undefined) {
				// The rest of the body is left unread, so this connection cannot be reused.
				response.setHeader('Connection', 'close');
				return reject(413, 'The request body is too large');
			}
			payload = raw.toString('utf8');
		}

		// A JWT may also arrive as a JSON string ("eyJ...").
		if (typeof payload === 'string' && payload.trim().startsWith('"')) {
			try {
				const unquoted = JSON.parse(payload) as unknown;
				if (typeof unquoted === 'string') {
					payload = unquoted;
				}
			} catch {
				// handled below
			}
		}

		let signed = false;
		if (typeof payload === 'string') {
			const text = payload.trim();
			if (looksLikeJwt(text)) {
				signed = true;
				const [headerPart, claimsPart, signaturePart] = text.split('.');
				let header: IDataObject;
				let claims: IDataObject;
				try {
					header = JSON.parse(decodeBase64Url(headerPart).toString('utf8')) as IDataObject;
					claims = JSON.parse(decodeBase64Url(claimsPart).toString('utf8')) as IDataObject;
				} catch {
					return reject(400, 'The signed payload is not a valid JWT');
				}

				if (options.verifySignedPayloads !== false) {
					const algorithm = JWT_ALGORITHMS[String(header.alg ?? '')];
					if (!algorithm) {
						return reject(401, `Unsupported signature algorithm: ${String(header.alg ?? 'none')}`);
					}
					const jwksUrl = String(options.jwksUrl || INSTRUCTURE_JWKS_URL);
					const kid = String(header.kid ?? '');

					const findKey = async (forceRefresh: boolean): Promise<IJwk | undefined> => {
						let cached = jwksCache.get(jwksUrl);
						const age = cached ? Date.now() - cached.fetchedAt : Infinity;
						if (!cached || age > JWKS_TTL_MS || (forceRefresh && age > JWKS_MIN_REFRESH_MS)) {
							const document = (await this.helpers.httpRequest({
								method: 'GET',
								url: jwksUrl,
								json: true,
							})) as IDataObject;
							cached = { keys: ((document?.keys ?? []) as IJwk[]) || [], fetchedAt: Date.now() };
							jwksCache.set(jwksUrl, cached);
						}
						return cached.keys.find((key) => String(key.kid ?? '') === kid);
					};

					let jwk: IJwk | undefined;
					try {
						jwk = (await findKey(false)) ?? (await findKey(true));
					} catch {
						return reject(503, 'Could not fetch the signing keys to verify the payload');
					}
					if (!jwk) {
						return reject(401, 'The payload was signed with an unknown key');
					}

					// The key decides what kind of signature is acceptable, not the token's header alone.
					if (String(jwk.kty ?? '') !== (algorithm.ec ? 'EC' : 'RSA')) {
						return reject(401, 'The signature algorithm does not match the signing key');
					}

					let valid = false;
					try {
						const key = createPublicKey({ key: jwk as never, format: 'jwk' });
						valid = verifySignature(
							algorithm.hash,
							Buffer.from(`${headerPart}.${claimsPart}`, 'utf8'),
							algorithm.ec ? { key, dsaEncoding: 'ieee-p1363' } : key,
							decodeBase64Url(signaturePart),
						);
					} catch {
						valid = false;
					}
					if (!valid) {
						return reject(401, 'The payload signature is not valid');
					}
					if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
						return reject(401, 'The signed payload has expired');
					}
				}
				payload = claims;
			} else {
				try {
					payload = JSON.parse(text) as unknown;
				} catch {
					return reject(400, 'The request body is not JSON');
				}
			}
		}

		if (options.requireSignedPayload === true && !signed) {
			return reject(401, 'Only signed payloads are accepted');
		}

		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return reject(400, 'The request body is not a Canvas Live Event');
		}

		const event = parseCanvasEvent(payload as IDataObject);
		if (!event) {
			return reject(400, 'The request body is not a Canvas Live Event');
		}

		// --- Filters ---
		const allEvents = events.includes('*');
		if (!allEvents && (!event.name || !events.includes(event.name))) {
			return ignore(
				event.name
					? `event ${event.name} is not selected`
					: 'the payload has no Canvas event name (use the Canvas message format, or select All Events)',
			);
		}

		const { metadata, body } = event;

		if (courseIdFilter) {
			const candidates = [
				body.course_id,
				metadata.context_type === 'Course' ? metadata.context_id : undefined,
			];
			if (!candidates.some((candidate) => idsMatch(courseIdFilter, candidate))) {
				return ignore('event is for another course');
			}
		}

		if (accountIdFilter) {
			const candidates = [
				metadata.root_account_id,
				metadata.context_account_id,
				metadata.context_type === 'Account' ? metadata.context_id : undefined,
				body.account_id,
			];
			if (!candidates.some((candidate) => idsMatch(accountIdFilter, candidate))) {
				return ignore('event is for another account');
			}
		}

		// --- Output ---
		const output: IDataObject = event.caliper
			? {
					eventType: null,
					timestamp: event.time ?? new Date().toISOString(),
					format: 'caliper',
					...event.caliper,
				}
			: {
					...body,
					eventType: event.name ?? null,
					timestamp: event.time ?? new Date().toISOString(),
				};

		if (!event.caliper && options.includeMetadata !== false) {
			output.metadata = metadata;
		}

		const items: INodeExecutionData[] = [{ json: output }];
		return { workflowData: [items] };
	}
}
