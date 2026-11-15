import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildClientAssertion, CanvasLtiAdvantageApi, readPrivateKey } from '../../credentials/CanvasLtiAdvantageApi.credentials';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const decode = (part: string): Record<string, unknown> => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

describe('LTI Advantage credential: private key', () => {
	it('reads PEM (PKCS#8 and PKCS#1) and JWK', () => {
		expect(readPrivateKey(pem).asymmetricKeyType).toBe('rsa');
		expect(readPrivateKey(rsa.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string).asymmetricKeyType).toBe('rsa');
		expect(readPrivateKey(JSON.stringify(rsa.privateKey.export({ format: 'jwk' }))).asymmetricKeyType).toBe('rsa');
	});

	it('repairs a PEM whose line breaks were lost in a single-line field', () => {
		for (const mangled of [pem.replace(/\n/g, ' '), pem.replace(/\n/g, '\\n'), pem.replace(/\n/g, ''), `  ${pem}\n\n`]) {
			expect(readPrivateKey(mangled).export({ type: 'pkcs8', format: 'pem' })).toBe(pem);
		}
	});

	it('refuses anything else with a clear message', () => {
		expect(() => readPrivateKey('not a key')).toThrow(/neither a PEM block .* nor a JWK/);
	});
});

describe('LTI Advantage credential: client assertion', () => {
	it('is a JWT signed with the key, addressed to the token endpoint, valid for five minutes', () => {
		const tokenUrl = 'https://canvas.test/login/oauth2/token';
		const jwt = buildClientAssertion({ clientId: '10000000000042', tokenUrl, privateKey: pem, keyId: 'key-1', now: 1_800_000_000 });
		const [header, claims, signature] = jwt.split('.');
		expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'key-1' });
		expect(decode(claims)).toMatchObject({
			iss: '10000000000042',
			sub: '10000000000042',
			aud: tokenUrl,
			iat: 1_800_000_000,
			exp: 1_800_000_300,
		});
		expect(String(decode(claims).jti)).toMatch(/^[0-9a-f-]{36}$/);
		const verified = createVerify('SHA256')
			.update(`${header}.${claims}`)
			.verify(createPublicKey(rsa.privateKey), Buffer.from(signature, 'base64url'));
		expect(verified).toBe(true);
	});

	it('leaves out the key ID when none is given, uses a new jti every time, and signs EC keys as ES256', () => {
		const options = { clientId: '7', tokenUrl: 'https://canvas.test/login/oauth2/token', privateKey: pem };
		const first = buildClientAssertion(options);
		const second = buildClientAssertion(options);
		expect(decode(first.split('.')[0])).toEqual({ alg: 'RS256', typ: 'JWT' });
		expect(decode(first.split('.')[1]).jti).not.toBe(decode(second.split('.')[1]).jti);

		const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
		const jwt = buildClientAssertion({ ...options, privateKey: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string });
		const [header, claims, signature] = jwt.split('.');
		expect(decode(header).alg).toBe('ES256');
		const verified = createVerify('SHA256')
			.update(`${header}.${claims}`)
			.verify({ key: createPublicKey(ec.privateKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
		expect(verified).toBe(true);
	});
});

describe('LTI Advantage credential: token request', () => {
	it('asks Canvas for a token with the client-credentials grant and stores it as the session token', async () => {
		const requests: Array<Record<string, unknown>> = [];
		const helper = {
			helpers: {
				httpRequest: async (options: Record<string, unknown>) => {
					requests.push(options);
					return { access_token: 'lti-token', token_type: 'Bearer', expires_in: 3600 };
				},
			},
		};
		const credential = new CanvasLtiAdvantageApi();
		const result = await credential.preAuthentication.call(helper as never, {
			canvasUrl: ' https://canvas.test/ ',
			clientId: ' 10000000000042 ',
			privateKey: pem,
			keyId: '',
			scopes: 'scope:a,\n scope:b',
		});
		expect(result).toEqual({ sessionToken: 'lti-token' });
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({
			method: 'POST',
			url: 'https://canvas.test/login/oauth2/token',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		});
		const body = requests[0].body as Record<string, string>;
		expect(body).toMatchObject({
			grant_type: 'client_credentials',
			client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
			scope: 'scope:a scope:b',
		});
		expect(decode(body.client_assertion.split('.')[1])).toMatchObject({
			iss: '10000000000042',
			aud: 'https://canvas.test/login/oauth2/token',
		});
	});

	it('has exactly one expirable hidden field, which n8n uses to know when to fetch a token', () => {
		const expirable = new CanvasLtiAdvantageApi().properties.filter((p) => p.type === 'hidden' && p.typeOptions?.expirable === true);
		expect(expirable.map((p) => p.name)).toEqual(['sessionToken']);
	});
});
