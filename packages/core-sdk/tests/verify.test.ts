/**
 * Local token verification (Section 4.5).
 *
 * Real RSA keys, a real JWKS endpoint over HTTP, and real signed tokens. The
 * point of this class is that it rejects things, so mocking the crypto would
 * test nothing worth testing.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { SignJWT, exportJWK, generateKeyPair, type KeyLike } from 'jose';
import { TokenVerifier, extractBearerToken } from '../src/verify.ts';
import { TokenVerificationError } from '../src/types.ts';

const ISSUER = 'https://tough-deer-31.clerk.accounts.dev';

describe('TokenVerifier', () => {
  let server: Server;
  let jwksUrl: string;
  let privateKey: KeyLike;
  let otherPrivateKey: KeyLike;

  before(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

    // A second keypair never published to the JWKS, standing in for a forged
    // token signed by something other than the real issuer.
    otherPrivateKey = (await generateKeyPair('RS256')).privateKey;

    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (typeof address === 'string' || address === null) throw new Error('no port');
    jwksUrl = `http://127.0.0.1:${address.port}/.well-known/jwks.json`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const sign = async (
    claims: Record<string, unknown>,
    opts: { key?: KeyLike; expires?: string } = {},
  ) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setExpirationTime(opts.expires ?? '5m')
      .sign(opts.key ?? privateKey);

  const verifier = (authorizedParties?: string[]) =>
    new TokenVerifier({ jwksUrl, issuer: ISSUER, authorizedParties });

  it('verifies a genuine token and returns its claims', async () => {
    const token = await sign({ sub: 'user_2ab9k1', sid: 'sess_1' });
    const claims = await verifier().verify(token);
    assert.equal(claims.clerkUserId, 'user_2ab9k1');
    assert.equal(claims.sessionId, 'sess_1');
    assert.ok(claims.expiresAt > claims.issuedAt);
  });

  it('extracts organization context when the session carries it', async () => {
    // org_id is what lets Core resolve against the right membership (Section 6.1).
    const token = await sign({ sub: 'user_1', org_id: 'org_acme' });
    const claims = await verifier().verify(token);
    assert.equal(claims.clerkOrgId, 'org_acme');
  });

  it('leaves organization context undefined when absent', async () => {
    const claims = await verifier().verify(await sign({ sub: 'user_1' }));
    assert.equal(claims.clerkOrgId, undefined);
  });

  it('rejects a token signed by the wrong key', async () => {
    const forged = await sign({ sub: 'user_evil' }, { key: otherPrivateKey });
    await assert.rejects(() => verifier().verify(forged), TokenVerificationError);
  });

  it('rejects an expired token', async () => {
    const expired = await sign({ sub: 'user_1' }, { expires: '-1m' });
    await assert.rejects(() => verifier().verify(expired), TokenVerificationError);
  });

  it('rejects a token from the wrong issuer', async () => {
    const wrong = await new SignJWT({ sub: 'user_1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setIssuer('https://attacker.example')
      .setExpirationTime('5m')
      .sign(privateKey);
    await assert.rejects(() => verifier().verify(wrong), TokenVerificationError);
  });

  it('rejects a tampered payload', async () => {
    const token = await sign({ sub: 'user_1' });
    const [header, , signature] = token.split('.');
    const swapped = Buffer.from(JSON.stringify({ sub: 'user_admin' })).toString('base64url');
    await assert.rejects(
      () => verifier().verify(`${header}.${swapped}.${signature}`),
      TokenVerificationError,
    );
  });

  it('rejects a token with no sub claim', async () => {
    const noSub = await sign({});
    await assert.rejects(() => verifier().verify(noSub), TokenVerificationError);
  });

  it('rejects an unauthorised party', async () => {
    // Section 4.5 lists azp among the claims to validate. jwtVerify does not
    // check it, so skipping the explicit check would let a token minted for one
    // origin be replayed at another.
    const token = await sign({ sub: 'user_1', azp: 'https://evil.example' });
    await assert.rejects(
      () => verifier(['https://app.beorchid.com']).verify(token),
      /unauthorised party/i,
    );
  });

  it('accepts an authorised party', async () => {
    const token = await sign({ sub: 'user_1', azp: 'https://app.beorchid.com' });
    const claims = await verifier(['https://app.beorchid.com']).verify(token);
    assert.equal(claims.clerkUserId, 'user_1');
  });

  it('rejects a missing azp when authorised parties are configured', async () => {
    const token = await sign({ sub: 'user_1' });
    await assert.rejects(() => verifier(['https://app.beorchid.com']).verify(token), /party/i);
  });

  it('rejects a malformed token outright', async () => {
    await assert.rejects(() => verifier().verify('not.a.token'), TokenVerificationError);
  });
});

describe('extractBearerToken', () => {
  it('extracts a bearer token', () => {
    assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  });

  it('accepts any casing of the scheme', () => {
    assert.equal(extractBearerToken('bearer abc'), 'abc');
    assert.equal(extractBearerToken('BEARER abc'), 'abc');
  });

  it('returns null for a non-bearer scheme', () => {
    assert.equal(extractBearerToken('Basic dXNlcjpwYXNz'), null);
  });

  it('returns null for null, undefined and empty input', () => {
    assert.equal(extractBearerToken(null), null);
    assert.equal(extractBearerToken(undefined), null);
    assert.equal(extractBearerToken(''), null);
  });

  it('returns null when the scheme is present but the token is not', () => {
    assert.equal(extractBearerToken('Bearer'), null);
    assert.equal(extractBearerToken('Bearer '), null);
  });
});
