import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { canvas, fx, unique } from '../lib/canvas';
import { n8n } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { renameSync, writeFileSync } from 'node:fs';
import { loadState, STATE_PATH } from '../lib/state';

/**
 * Helpers for the LTI resources of the battery (not a test file).
 *
 * The LTI Advantage services of Canvas (`/api/lti/...`: line items, LTI progress)
 * do not accept a user's API token. They need an access token that an LTI 1.3
 * tool obtains with the OAuth2 client-credentials grant, authenticating with a
 * JWT signed by its own private key. These helpers play the part of such a
 * tool: register it in Canvas with a key pair generated here, install it in a
 * course, and fetch a token.
 */

export const AGS_SCOPES = [
	'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
	'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
	'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
	'https://purl.imsglobal.org/spec/lti-ags/scope/score',
	'https://canvas.instructure.com/lti-ags/progress/scope/show',
];

export interface LtiTool {
	/** ID of the LTI registration in the root account. */
	registrationId: string;
	/** Client ID: the (global) ID of the developer key of the registration. */
	clientId: string;
	/** Host name the tool pretends to live on; unique per tool. */
	host: string;
	launchUrl: string;
	name: string;
	privateKey: KeyObject;
	keyId: string;
}

/** The LTI 1.3 configuration of a tool living on `host`, signed with `jwk`. */
export function toolConfiguration(host: string, extra: Json = {}): Json {
	return {
		title: `Battery tool ${host}`,
		description: 'LTI 1.3 tool registered by the test battery',
		target_link_uri: `https://${host}/launch`,
		// Lets Canvas match any URL on the tool's host to the tool (resource links, assignments).
		domain: host,
		oidc_initiation_url: `https://${host}/oidc`,
		redirect_uris: [`https://${host}/redirect`],
		scopes: AGS_SCOPES,
		// Only a placement nobody sees by accident: the tool is installed in the battery's own courses.
		placements: [{ placement: 'link_selection', enabled: true, message_type: 'LtiDeepLinkingRequest' }],
		launch_settings: {},
		...extra,
	};
}

/**
 * Register an LTI 1.3 tool (registration + developer key, turned on) in the
 * root account. Delete it again with `deleteLtiTool`.
 */
export async function registerLtiTool(label: string): Promise<LtiTool> {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const keyId = randomUUID();
	const jwk = { ...publicKey.export({ format: 'jwk' }), kid: keyId, alg: 'RS256', use: 'sig' };
	const host = `${label}-${randomUUID().slice(0, 8)}.lti.example.com`.toLowerCase();
	const name = unique(`Battery ${label}`);
	const registration = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/lti_registrations`, {
		name,
		workflow_state: 'on',
		configuration: toolConfiguration(host, { public_jwk: jwk }),
	});
	return {
		registrationId: String(registration.id),
		clientId: String(registration.developer_key_id),
		host,
		launchUrl: `https://${host}/launch`,
		name,
		privateKey,
		keyId,
	};
}

export async function deleteLtiTool(tool: LtiTool | undefined): Promise<void> {
	if (!tool) return;
	await canvas().request(
		'DELETE',
		`/api/v1/accounts/${fx('accountId')}/lti_registrations/${tool.registrationId}`,
	);
}

/** Install a registered tool in a course (what "Create external tool" with a client ID does). */
export async function deployLtiTool(tool: LtiTool, courseId: string): Promise<Json> {
	return canvas().post<Json>(`/api/v1/courses/${courseId}/external_tools`, { client_id: tool.clientId });
}

function base64Url(input: string): string {
	return Buffer.from(input).toString('base64url');
}

/** An LTI Advantage access token for the tool (client-credentials grant, valid for one hour). */
export async function ltiAdvantageToken(tool: LtiTool, scopes: string[] = AGS_SCOPES): Promise<string> {
	const tokenUrl = `${canvas().url}/login/oauth2/token`;
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'RS256', typ: 'JWT', kid: tool.keyId };
	const claims = { iss: tool.clientId, sub: tool.clientId, aud: tokenUrl, iat: now, exp: now + 300, jti: randomUUID() };
	const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(tool.privateKey).toString('base64url');
	const res = await fetch(tokenUrl, {
		method: 'POST',
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
			client_assertion: `${unsigned}.${signature}`,
			scope: scopes.join(' '),
		}),
	});
	const body = (await res.json()) as Json;
	if (res.status !== 200 || typeof body.access_token !== 'string') {
		throw new Error(`Canvas refused the LTI client-credentials grant: ${res.status} ${JSON.stringify(body)}`);
	}
	return body.access_token;
}

/** Call Canvas with an LTI Advantage token (independent verification, never through the node). */
export async function ltiRequest(
	token: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<{ status: number; data: unknown }> {
	const res = await fetch(`${canvas().url}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			...(body === undefined ? {} : { 'content-type': 'application/json' }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let data: unknown = text;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		// keep text
	}
	return { status: res.status, data };
}

/**
 * Make `token` available to `runNode({ persona })`: an n8n "Canvas API"
 * credential whose Access Token is the LTI Advantage token. This is the only
 * way the node's credentials can reach the LTI services.
 * Returns a function that deletes the credential again.
 */
export async function createTokenPersona(persona: string, token: string): Promise<() => Promise<void>> {
	const name = `Canvas battery (${persona})`;
	const created = await n8n().api<{ id: string }>('POST', '/credentials', {
		name,
		type: 'canvasApi',
		data: { canvasUrl: canvas().url, accessToken: token, allowedHttpRequestDomains: 'all' },
	});
	// Register it in the (git-ignored) test state. Test files run in parallel and read the
	// state all the time: replace the file atomically, and repeat until the entry sticks in
	// case another file registered its own persona at the same moment.
	for (let attempt = 0; attempt < 10; attempt++) {
		const state = loadState();
		state.n8n.credentials[persona] = { id: String(created.id), name, type: 'canvasApi' };
		const temporary = `${STATE_PATH}.${process.pid}.tmp`;
		writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
		renameSync(temporary, STATE_PATH);
		await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 60));
		if (loadState().n8n.credentials[persona]?.id === String(created.id)) break;
	}
	return async () => {
		await n8n()
			.api('DELETE', `/credentials/${created.id}`)
			.catch(() => undefined);
	};
}
