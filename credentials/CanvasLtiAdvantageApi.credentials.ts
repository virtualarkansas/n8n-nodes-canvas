import { createPrivateKey, createSign, randomUUID } from 'crypto';
import type { JsonWebKey, KeyObject } from 'crypto';
import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	IHttpRequestHelper,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

/** Scopes of the Assignment and Grade Services the node's LTI operations use. */
export const LTI_DEFAULT_SCOPES = [
	'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
	'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
	'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
	'https://purl.imsglobal.org/spec/lti-ags/scope/score',
	'https://canvas.instructure.com/lti-ags/progress/scope/show',
].join(' ');

/**
 * Read a private key given as PEM or as a JWK (JSON).
 * A PEM pasted into a single-line field arrives with its line breaks turned into
 * spaces or literal "\n": put them back before parsing.
 */
export function readPrivateKey(value: string): KeyObject {
	const text = value.trim();
	if (text.startsWith('{')) {
		return createPrivateKey({ key: JSON.parse(text) as JsonWebKey, format: 'jwk' });
	}
	const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(text.replace(/\\n/g, '\n'));
	if (!match) {
		throw new Error('The private key is neither a PEM block (-----BEGIN ... PRIVATE KEY-----) nor a JWK');
	}
	const body = match[2].replace(/\s+/g, '');
	const lines = body.match(/.{1,64}/g) ?? [];
	return createPrivateKey(`-----BEGIN ${match[1]}-----\n${lines.join('\n')}\n-----END ${match[1]}-----\n`);
}

/**
 * The signed JWT an LTI 1.3 tool presents to Canvas' token endpoint
 * (client-credentials grant, RFC 7523).
 */
export function buildClientAssertion(options: {
	clientId: string;
	tokenUrl: string;
	privateKey: string;
	keyId?: string;
	now?: number;
}): string {
	const key = readPrivateKey(options.privateKey);
	const algorithm = key.asymmetricKeyType === 'ec' ? 'ES256' : 'RS256';
	const now = options.now ?? Math.floor(Date.now() / 1000);
	const header: IDataObject = { alg: algorithm, typ: 'JWT' };
	if (options.keyId) {
		header.kid = options.keyId;
	}
	const claims = {
		iss: options.clientId,
		sub: options.clientId,
		aud: options.tokenUrl,
		iat: now,
		exp: now + 300,
		jti: randomUUID(),
	};
	const encode = (part: object): string => Buffer.from(JSON.stringify(part)).toString('base64url');
	const unsigned = `${encode(header)}.${encode(claims)}`;
	const signature = createSign('SHA256')
		.update(unsigned)
		.sign(algorithm === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key)
		.toString('base64url');
	return `${unsigned}.${signature}`;
}

/**
 * Access to Canvas' LTI Advantage services (`/api/lti/...`: line items, scores,
 * results, names and roles) as an LTI 1.3 tool. Canvas only accepts tokens for
 * these that the tool obtains with its own key; they live for one hour, so the
 * credential fetches one when needed and again when Canvas answers 401.
 */
export class CanvasLtiAdvantageApi implements ICredentialType {
	name = 'canvasLtiAdvantageApi';

	displayName = 'Canvas LTI Advantage API';

	icon: Icon = 'file:../icons/canvas.svg';

	documentationUrl =
		'https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth#accessing-lti-advantage-services';

	properties: INodeProperties[] = [
		{
			displayName: 'Canvas URL',
			name: 'canvasUrl',
			type: 'string',
			default: '',
			placeholder: 'https://yourschool.instructure.com',
			description: 'The address of your Canvas instance, e.g. https://yourschool.instructure.com',
			required: true,
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			placeholder: '10000000000042',
			description: 'The ID of the LTI developer key (Admin → Developer Keys, the number shown under Details)',
			required: true,
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'The private key belonging to the public JWK registered in the developer key, as PEM (-----BEGIN PRIVATE KEY-----) or as a JWK in JSON',
			required: true,
		},
		{
			displayName: 'Key ID',
			name: 'keyId',
			type: 'string',
			default: '',
			description: 'The "kid" of that key, when the developer key\'s public JWK has one or its JWK URL lists several keys',
		},
		{
			displayName: 'Scopes',
			name: 'scopes',
			type: 'string',
			default: LTI_DEFAULT_SCOPES,
			description:
				'Space-separated LTI Advantage scopes to request. Each one must be enabled on the developer key; Canvas refuses the whole request otherwise.',
		},
		{
			displayName: 'Session Token',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: { expirable: true, password: true },
			default: '',
		},
	];

	async preAuthentication(
		this: IHttpRequestHelper,
		credentials: ICredentialDataDecryptedObject,
	): Promise<IDataObject> {
		const canvasUrl = String(credentials.canvasUrl ?? '')
			.trim()
			.replace(/\/+$/, '');
		const tokenUrl = `${canvasUrl}/login/oauth2/token`;
		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: tokenUrl,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: {
				grant_type: 'client_credentials',
				client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
				client_assertion: buildClientAssertion({
					clientId: String(credentials.clientId ?? '').trim(),
					tokenUrl,
					privateKey: String(credentials.privateKey ?? ''),
					keyId: String(credentials.keyId ?? '').trim() || undefined,
				}),
				scope: String(credentials.scopes ?? '')
					.split(/[\s,]+/)
					.filter(Boolean)
					.join(' '),
			},
		})) as IDataObject | string;
		const data = (typeof response === 'string' ? JSON.parse(response) : response) as IDataObject;
		return { sessionToken: data.access_token as string };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.sessionToken}}',
			},
		},
	};

	// Obtaining the token is the real test (it runs first and fails with Canvas' reason);
	// this request only has to exist and succeed.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{String($credentials?.canvasUrl ?? "").trim().replace(/\\/+$/, "")}}',
			url: '/api/lti/security/jwks',
			method: 'GET',
		},
	};
}
