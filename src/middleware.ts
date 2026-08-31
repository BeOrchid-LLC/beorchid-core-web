import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

/**
 * Route protection (Sections 4.3, 4.5).
 *
 * When Clerk is configured this delegates to clerkMiddleware, which verifies
 * the session token's signature locally against cached JWKS. That check is
 * networkless, so it costs no round trip and still correctly rejects an expired
 * or forged token even if Core API is unreachable.
 *
 * Authentication only. What a signed-in person may actually DO is a separate
 * question, resolved per app through the Core API and enforced in the route
 * itself (Section 6.3). Middleware never answers that.
 *
 * With no Clerk keys the middleware stands aside and the development sign-in
 * path applies. It cannot fall through to "authenticated": getSession() returns
 * null outside development when Clerk is absent.
 */

function clerkConfigured(): boolean {
  const key = process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'];
  return typeof key === 'string' && key.startsWith('pk_');
}

/** Reachable without a session. Everything else requires one. */
const PUBLIC_ROUTES = ['/', '/sign-in', '/sign-up', '/api/dev-session'];

type ClerkMiddleware = (req: NextRequest, event: NextFetchEvent) => Promise<Response> | Response;
let cached: ClerkMiddleware | null = null;

async function clerkHandler(): Promise<ClerkMiddleware> {
  if (cached) return cached;
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isPublic = createRouteMatcher(PUBLIC_ROUTES.map((r) => (r === '/' ? '/' : `${r}(.*)`)));

  cached = clerkMiddleware(async (auth, request) => {
    if (!isPublic(request)) await auth.protect();
  }) as ClerkMiddleware;
  return cached;
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!clerkConfigured()) return NextResponse.next();
  const handler = await clerkHandler();
  return handler(request, event);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
