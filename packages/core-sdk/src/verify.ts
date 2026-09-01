import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { type SessionClaims, TokenVerificationError } from './types';

/**
 * Local token verification (Section 4.5).
 *
 * This is the half of the flow that does NOT call Core API. Public keys are
 * fetched once and cached in memory, so verifying a signature costs no network
 * round trip. Two things follow from that:
 *
 *   - Latency. Every authenticated request would otherwise pay a hop.
 *   - Resilience. An app can still correctly reject an expired or forged token
 *     while Core API is briefly unreachable.
 *
 * What verification cannot tell the app is who this person is in BeOrchid's
 * terms, or what they may do. That requires the Core API (Section 5.6).
 */

export interface VerifierConfig {
  /**
   * JWKS endpoint. Clerk exposes one per instance.
   * In development, before a Clerk instance exists, this can point at a local
   * issuer producing tokens in the same shape — the verification path is then
   * identical and swapping to Clerk is a URL change.
   */
  jwksUrl: string;
  /** Expected `iss`. Clerk's instance issuer URL. */
  issuer: string;
  /**
   * Expected `azp` (authorised party) values: the origins permitted to use
   * this token. Section 4.5 lists azp among the claims that must be validated.
   * Leave empty only if the deployment genuinely has no origin restriction.
   */
  authorizedParties?: string[];
  /** Clock tolerance in seconds. Keep small. */
  clockToleranceSec?: number;
}

export class TokenVerifier {
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly #config: VerifierConfig;

  constructor(config: VerifierConfig) {
    this.#config = config;
    // Caches keys in memory and refetches only on rotation or unknown `kid`.
    this.#jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  }

  /**
   * Verifies a session token and returns its claims.
   * Throws TokenVerificationError on any failure. Never returns a partial result.
   */
  async verify(token: string): Promise<SessionClaims> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.#jwks, {
        issuer: this.#config.issuer,
        clockTolerance: this.#config.clockToleranceSec ?? 5,
      }));
    } catch (error) {
      throw new TokenVerificationError(
        error instanceof Error ? error.message : 'token verification failed',
      );
    }

    // `azp` is not checked by jwtVerify, so it is checked explicitly here.
    // Skipping it would let a token minted for one origin be replayed at another.
    const parties = this.#config.authorizedParties;
    if (parties && parties.length > 0) {
      const azp = payload['azp'];
      if (typeof azp !== 'string' || !parties.includes(azp)) {
        throw new TokenVerificationError(`unauthorised party: ${String(azp)}`);
      }
    }

    const sub = payload.sub;
    if (!sub) throw new TokenVerificationError('token has no sub claim');

    const orgId = payload['org_id'];

    return {
      clerkUserId: sub,
      clerkOrgId: typeof orgId === 'string' ? orgId : undefined,
      sessionId: typeof payload['sid'] === 'string' ? payload['sid'] : undefined,
      issuedAt: payload.iat ?? 0,
      expiresAt: payload.exp ?? 0,
    };
  }
}

/**
 * Extracts the raw token from either transport.
 *
 * Section 3.3: web and mobile differ ONLY in how the token is carried. Web uses
 * a cookie managed by Clerk's SDK, mobile an Authorization header. From here on
 * the code path is identical, which is why this lives in the SDK and is not
 * reimplemented per surface.
 */
export function extractBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
