import { cookies } from 'next/headers';
import type { SessionClaims } from '@beorchid/core-sdk';

/**
 * THE AUTH SEAM.
 *
 * Everything above this file asks `getSession()` and receives SessionClaims.
 * Nothing above this file knows whether those claims came from Clerk or from
 * the development stand-in, which is what makes the Clerk integration a
 * configuration change rather than a rewrite.
 *
 * To go live with Clerk: set the two publishable/secret keys in .env and
 * restart. No file above this one changes.
 */

/**
 * Clerk is considered configured when a real publishable key is present.
 * Absence is what selects the development path, so a missing key can never
 * silently fall through to "authenticated".
 */
export function isClerkConfigured(): boolean {
  const key = process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'];
  return typeof key === 'string' && key.startsWith('pk_');
}

export function isDevAuthAllowed(): boolean {
  return process.env.NODE_ENV === 'development' && !isClerkConfigured();
}

/**
 * The current session, or null when signed out.
 *
 * Section 4.5: on the real path Clerk's middleware has already verified the
 * token's signature locally against cached JWKS before this runs. No network
 * call happens here.
 */
export async function getSession(): Promise<SessionClaims | null> {
  if (isClerkConfigured()) {
    // Imported lazily so the development path never loads Clerk's server
    // runtime, which throws when no keys are present.
    const { auth } = await import('@clerk/nextjs/server');
    const { userId, orgId, sessionId } = await auth();
    if (!userId) return null;
    return {
      clerkUserId: userId,
      clerkOrgId: orgId ?? undefined,
      sessionId: sessionId ?? undefined,
      issuedAt: 0,
      expiresAt: 0,
    };
  }

  if (!isDevAuthAllowed()) {
    // Neither Clerk configured nor development. Refusing is the only safe
    // answer: a deployed app with no auth provider must not treat anyone as
    // signed in.
    return null;
  }

  const store = await cookies();
  const devUser = store.get('beorchid_dev_user')?.value;
  if (!devUser) return null;

  return {
    clerkUserId: devUser,
    clerkOrgId: 'org_acme',
    sessionId: 'dev_session',
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}
