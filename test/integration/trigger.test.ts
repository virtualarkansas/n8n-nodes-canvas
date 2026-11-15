import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { n8n } from '../lib/harness';
import { CANVAS_TRIGGER_TYPE } from '../lib/n8n';
import type { Json } from '../lib/n8n';

/**
 * Canvas Trigger on a real n8n: events are POSTed the way Canvas Data Services
 * delivers them (HTTPS, Canvas message format, optionally as a signed JWT).
 */

const gradeChange = {
	metadata: {
		job_id: '1020020528469291',
		producer: 'canvas',
		root_account_id: '21070000000000001',
		root_account_uuid: 'VicYj3cu5BIFpoZhDVU4DZumnlBrWi1grgJEzADs',
		context_type: 'Course',
		context_id: '21070000000000565',
		context_account_id: '21070000000000079',
		event_name: 'grade_change',
		event_time: '2019-11-01T00:07:59.125Z',
	},
	body: {
		submission_id: '21070000000001234',
		assignment_id: '21070000000000371',
		grade: '7',
		score: 7,
		student_id: '21070000000000048',
		student_sis_id: 'Test2',
	},
};

interface TriggerHandle {
	workflowId: string;
	url: string;
}

const created: string[] = [];

async function deployTrigger(parameters: Json): Promise<TriggerHandle> {
	const webhookId = randomUUID();
	const workflowId = await n8n().createWorkflow({
		name: `[battery] trigger ${webhookId}`,
		settings: { executionOrder: 'v1' },
		nodes: [
			{
				id: randomUUID(),
				name: 'Canvas Trigger',
				type: CANVAS_TRIGGER_TYPE,
				typeVersion: 1,
				position: [0, 0],
				webhookId,
				parameters,
			},
			{
				id: randomUUID(),
				name: 'Done',
				type: 'n8n-nodes-base.noOp',
				typeVersion: 1,
				position: [220, 0],
				parameters: {},
			},
		],
		connections: { 'Canvas Trigger': { main: [[{ node: 'Done', type: 'main', index: 0 }]] } },
	});
	created.push(workflowId);
	await n8n().activate(workflowId);
	return { workflowId, url: `${n8n().url}/webhook/${webhookId}/webhook` };
}

async function post(url: string, body: string | object, contentType = 'application/json') {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': contentType },
		body: typeof body === 'string' ? body : JSON.stringify(body),
		signal: AbortSignal.timeout(20_000),
	});
	const text = await res.text();
	let json: Json | undefined;
	try {
		json = JSON.parse(text) as Json;
	} catch {
		json = undefined;
	}
	return { status: res.status, text, json };
}

/**
 * Number of executions of a workflow. The trigger answers before the execution is
 * stored, so wait until the expected number shows up (or, for 0, give it a moment).
 */
async function executionCount(workflowId: string, expected = 0): Promise<number> {
	let count = 0;
	for (let attempt = 0; attempt < 25; attempt++) {
		const list = await n8n().api<{ data: Json[] }>('GET', `/executions?workflowId=${workflowId}&limit=50`);
		count = list.data.length;
		if (expected > 0 ? count >= expected : attempt >= 2) break;
		await new Promise((resolve) => setTimeout(resolve, 120));
	}
	return count;
}

async function triggerOutput(workflowId: string): Promise<Json> {
	const execution = await n8n().lastExecution(workflowId);
	expect(execution.status).toBe('success');
	return execution.nodes['Canvas Trigger'][0].outputs[0][0];
}

// --- Signing material: a local key pair and a JWKS endpoint standing in for Instructure's ---
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'battery-key-1';
let jwksServer: Server;
let jwksUrl = '';
let jwksHits = 0;

function b64url(input: Buffer | string): string {
	return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(claims: object, key = privateKey, kid = KID): string {
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
	const payload = b64url(JSON.stringify(claims));
	const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key);
	return `${header}.${payload}.${b64url(signature)}`;
}

beforeAll(async () => {
	jwksServer = createServer((_req, res) => {
		jwksHits++;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] }));
	});
	await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
	jwksUrl = `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/jwks`;
});

afterAll(async () => {
	await new Promise((resolve) => jwksServer.close(resolve));
	for (const id of created) {
		await n8n().deleteWorkflow(id).catch(() => undefined);
	}
});

describe('Canvas Trigger: event selection', () => {
	it('starts the workflow for a selected event and outputs body, event type and metadata', async () => {
		const trigger = await deployTrigger({ events: ['grade_change', 'submission_created'] });
		const res = await post(trigger.url, gradeChange);
		expect(res.status).toBe(200);
		const output = await triggerOutput(trigger.workflowId);
		expect(output).toMatchObject({
			eventType: 'grade_change',
			timestamp: '2019-11-01T00:07:59.125Z',
			submission_id: '21070000000001234',
			grade: '7',
			score: 7,
			student_sis_id: 'Test2',
			metadata: { context_id: '21070000000000565', event_name: 'grade_change' },
		});
	});

	it('acknowledges but ignores events that are not selected (Canvas retries non-2xx)', async () => {
		const trigger = await deployTrigger({ events: ['course_created'] });
		const res = await post(trigger.url, gradeChange);
		expect(res.status).toBe(200);
		expect(res.json).toMatchObject({ status: 'ignored' });
		expect(await executionCount(trigger.workflowId)).toBe(0);
	});

	it('All Events accepts anything Canvas sends, including events unknown to the node', async () => {
		const trigger = await deployTrigger({ events: ['*'] });
		const res = await post(trigger.url, { metadata: { event_name: 'some_future_event', event_time: 't' }, body: { x: 1 } });
		expect(res.status).toBe(200);
		expect(await triggerOutput(trigger.workflowId)).toMatchObject({ eventType: 'some_future_event', x: 1 });
	});

	it('leaves metadata out when asked to', async () => {
		const trigger = await deployTrigger({ events: ['grade_change'], triggerOptions: { includeMetadata: false } });
		await post(trigger.url, gradeChange);
		const output = await triggerOutput(trigger.workflowId);
		expect(output.metadata).toBeUndefined();
		expect(output.eventType).toBe('grade_change');
	});

	it('answers malformed requests with 400 instead of hanging', async () => {
		const trigger = await deployTrigger({ events: ['*'] });
		expect((await post(trigger.url, { hello: 'world' })).status).toBe(400);
		expect((await post(trigger.url, 'not json at all', 'text/plain')).status).toBe(400);
		expect(await executionCount(trigger.workflowId)).toBe(0);
	});
});

describe('Canvas Trigger: request handling', () => {
	it('works when n8n has already parsed the body (workflows saved by earlier versions)', async () => {
		// Earlier versions stored a collection under "options"; n8n then parses the body itself.
		const trigger = await deployTrigger({ events: ['grade_change'], options: {} });
		expect((await post(trigger.url, gradeChange)).status).toBe(200);
		expect(await triggerOutput(trigger.workflowId)).toMatchObject({ eventType: 'grade_change', grade: '7' });
	});

	it('accepts form-encoded or charset-suffixed JSON content types', async () => {
		const trigger = await deployTrigger({ events: ['grade_change'] });
		expect((await post(trigger.url, gradeChange, 'application/json; charset=utf-8')).status).toBe(200);
		expect(await executionCount(trigger.workflowId, 1)).toBe(1);
	});

	it('refuses oversized bodies', async () => {
		const trigger = await deployTrigger({ events: ['*'] });
		const huge = { metadata: { event_name: 'x' }, body: { blob: 'a'.repeat(6 * 1024 * 1024) } };
		const res = await post(trigger.url, huge).catch((error: Error) => ({ status: 0, text: error.message, json: undefined }));
		expect([413, 0]).toContain(res.status);
		expect(await executionCount(trigger.workflowId)).toBe(0);
		// The node keeps serving afterwards.
		expect((await post(trigger.url, gradeChange)).status).toBe(200);
	});
});

describe('Canvas Trigger: compressed bodies', () => {
	const send = async (url: string, compressed: Buffer): Promise<number> => {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', connection: 'close' },
			body: compressed,
		}).catch(() => undefined);
		return res?.status ?? 0;
	};

	it('accepts a gzip-compressed event', async () => {
		const trigger = await deployTrigger({ events: ['grade_change'] });
		expect(await send(trigger.url, gzipSync(Buffer.from(JSON.stringify(gradeChange))))).toBe(200);
		expect(await executionCount(trigger.workflowId, 1)).toBe(1);
	});

	it('refuses a small body that unpacks to more than the limit', async () => {
		const trigger = await deployTrigger({ events: ['*'] });
		// 64 MB of zeros compress to about 64 KB.
		const bomb = gzipSync(Buffer.alloc(64 * 1024 * 1024));
		expect(bomb.length).toBeLessThan(200 * 1024);
		expect([413, 0]).toContain(await send(trigger.url, bomb));
		expect(await executionCount(trigger.workflowId)).toBe(0);
		expect((await post(trigger.url, gradeChange)).status).toBe(200);
	});
});

describe('Canvas Trigger: course and account filters', () => {
	it('matches a course by local ID although Canvas sends global IDs', async () => {
		const trigger = await deployTrigger({ events: ['grade_change'], courseId: '565' });
		expect((await post(trigger.url, gradeChange)).json).not.toMatchObject({ status: 'ignored' });
		expect(await executionCount(trigger.workflowId, 1)).toBe(1);

		const otherCourse = { ...gradeChange, metadata: { ...gradeChange.metadata, context_id: '21070000000000999' } };
		expect((await post(trigger.url, otherCourse)).json).toMatchObject({ status: 'ignored' });
		expect(await executionCount(trigger.workflowId, 1)).toBe(1);
	});

	it('uses body.course_id when the event context is not the course', async () => {
		const trigger = await deployTrigger({ events: ['enrollment_created'], courseId: '21070000000000565' });
		const enrollment = {
			metadata: { event_name: 'enrollment_created', event_time: 't', context_type: 'User', context_id: '21070000000000048', root_account_id: '21070000000000001' },
			body: { enrollment_id: '21070000000000900', course_id: '565', user_id: '48', type: 'StudentEnrollment' },
		};
		expect((await post(trigger.url, enrollment)).status).toBe(200);
		expect(await triggerOutput(trigger.workflowId)).toMatchObject({ eventType: 'enrollment_created', course_id: '565' });
	});

	it('filters by root account or context account', async () => {
		const byRoot = await deployTrigger({ events: ['*'], accountId: '1' });
		await post(byRoot.url, gradeChange);
		expect(await executionCount(byRoot.workflowId, 1)).toBe(1);

		const bySub = await deployTrigger({ events: ['*'], accountId: '79' });
		await post(bySub.url, gradeChange);
		expect(await executionCount(bySub.workflowId, 1)).toBe(1);

		const wrong = await deployTrigger({ events: ['*'], accountId: '5' });
		expect((await post(wrong.url, gradeChange)).json).toMatchObject({ status: 'ignored' });
		expect(await executionCount(wrong.workflowId)).toBe(0);
	});
});

describe('Canvas Trigger: authenticating the sender', () => {
	it('secret token: rejects requests without the right ?token=', async () => {
		const trigger = await deployTrigger({ events: ['*'], triggerOptions: { secretToken: 's3cret-Token' } });
		expect((await post(trigger.url, gradeChange)).status).toBe(403);
		expect((await post(`${trigger.url}?token=wrong`, gradeChange)).status).toBe(403);
		expect(await executionCount(trigger.workflowId)).toBe(0);
		expect((await post(`${trigger.url}?token=s3cret-Token`, gradeChange)).status).toBe(200);
		expect(await executionCount(trigger.workflowId, 1)).toBe(1);
	});

	for (const contentType of ['application/jwt', 'text/plain', 'application/json']) {
		it(`signed payload (${contentType}): verified against the JWKS and unpacked`, async () => {
			const trigger = await deployTrigger({ events: ['grade_change'], triggerOptions: { jwksUrl, requireSignedPayload: true } });
			const res = await post(trigger.url, signJwt(gradeChange), contentType);
			expect(res.status, res.text).toBe(200);
			expect(await triggerOutput(trigger.workflowId)).toMatchObject({ eventType: 'grade_change', grade: '7' });
		});
	}

	it('signed payload sent as a JSON string is accepted too', async () => {
		const trigger = await deployTrigger({ events: ['grade_change'], triggerOptions: { jwksUrl, requireSignedPayload: true } });
		const res = await post(trigger.url, JSON.stringify(signJwt(gradeChange)), 'application/json');
		expect(res.status, res.text).toBe(200);
		expect(await triggerOutput(trigger.workflowId)).toMatchObject({ eventType: 'grade_change' });
	});

	it('signed payload: rejects a tampered body, a foreign key and an unknown key id', async () => {
		const trigger = await deployTrigger({ events: ['*'], triggerOptions: { jwksUrl } });
		const good = signJwt(gradeChange);
		const [header, , signature] = good.split('.');
		const tampered = `${header}.${b64url(JSON.stringify({ ...gradeChange, body: { grade: '100' } }))}.${signature}`;
		expect((await post(trigger.url, tampered, 'application/jwt')).status).toBe(401);
		expect((await post(trigger.url, signJwt(gradeChange, other.privateKey), 'application/jwt')).status).toBe(401);
		expect((await post(trigger.url, signJwt(gradeChange, privateKey, 'unknown-kid'), 'application/jwt')).status).toBe(401);
		const unsignedAlg = `${b64url(JSON.stringify({ alg: 'none', kid: KID }))}.${b64url(JSON.stringify(gradeChange))}.AAAA`;
		expect((await post(trigger.url, unsignedAlg, 'application/jwt')).status).toBe(401);
		expect(await executionCount(trigger.workflowId)).toBe(0);
	});

	it('unknown key IDs do not make the node fetch the key set over and over', async () => {
		const trigger = await deployTrigger({ events: ['*'], triggerOptions: { jwksUrl } });
		expect((await post(trigger.url, signJwt(gradeChange), 'application/jwt')).status).toBe(200);
		const before = jwksHits;
		for (let i = 0; i < 5; i++) {
			expect((await post(trigger.url, signJwt(gradeChange, privateKey, `nobody-${i}`), 'application/jwt')).status).toBe(401);
		}
		expect(jwksHits - before).toBeLessThanOrEqual(1);
	});

	it('the algorithm has to fit the key: an EC algorithm with an RSA key is refused', async () => {
		const trigger = await deployTrigger({ events: ['*'], triggerOptions: { jwksUrl } });
		const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: KID }));
		const payload = b64url(JSON.stringify(gradeChange));
		const signature = b64url(createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey));
		const res = await post(trigger.url, `${header}.${payload}.${signature}`, 'application/jwt');
		expect(res.status).toBe(401);
		expect(await executionCount(trigger.workflowId)).toBe(0);
	});

	it('require signed payload: plain JSON is refused', async () => {
		const trigger = await deployTrigger({ events: ['*'], triggerOptions: { jwksUrl, requireSignedPayload: true } });
		expect((await post(trigger.url, gradeChange)).status).toBe(401);
		expect(await executionCount(trigger.workflowId)).toBe(0);
	});

	it('caches the key set instead of fetching it for every event', async () => {
		const trigger = await deployTrigger({ events: ['*'], triggerOptions: { jwksUrl } });
		const before = jwksHits;
		for (let i = 0; i < 4; i++) {
			expect((await post(trigger.url, signJwt(gradeChange), 'application/jwt')).status).toBe(200);
		}
		expect(jwksHits - before).toBeLessThanOrEqual(1);
	});
});
