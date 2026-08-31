import Link from 'next/link';
import { getSession, isClerkConfigured, isDevAuthAllowed } from '@/lib/session';
import { isCoreApiConfigured } from '@/lib/core';

/**
 * Sign-out follows whichever provider issued the session.
 *
 * Clerk's own sign-out clears its session cookie and server-side session. The
 * development route cannot do that, and it does not exist once Clerk is
 * configured: /api/dev-session returns 404 whenever real auth is available,
 * because a route that can forge a session must not be reachable then.
 *
 * Rendering the development form unconditionally is what broke this: signed in
 * through Clerk, the only sign-out button posted to a route that was correctly
 * refusing to answer.
 */
async function SignOutControl() {
  if (isClerkConfigured()) {
    const { SignOutButton } = await import('@clerk/nextjs');
    return (
      <SignOutButton redirectUrl="/">
        <button className="btn secondary" type="button">
          Sign out
        </button>
      </SignOutButton>
    );
  }

  return (
    <form action="/api/dev-session" method="post">
      <input type="hidden" name="action" value="signout" />
      <button className="btn secondary" type="submit">
        Sign out
      </button>
    </form>
  );
}

export default async function Home() {
  const session = await getSession();
  const clerk = isClerkConfigured();
  const coreApi = isCoreApiConfigured();

  return (
    <>
      <h1>Web reference app</h1>
      <p className="lede">
        Proves login and database access end to end, and demonstrates that permissions
        determine what a user can reach (Sections 3.1 and 6.4).
      </p>

      <div className={clerk && coreApi ? 'banner live' : 'banner dev'}>
        {clerk && coreApi
          ? 'Running against Clerk and the Core API.'
          : clerk
            ? 'Authentication is live against Clerk. Identity and permissions still come from a fixture, not the Core API.'
            : 'Running in development mode. Neither authentication nor permissions come from a real service.'}
      </div>

      <h2>Integration status</h2>
      <div className="card">
        <dl className="kv">
          <dt>Authentication</dt>
          <dd>{clerk ? 'Clerk (live)' : 'Development stand-in'}</dd>
          <dt>Identity &amp; permissions</dt>
          <dd>{coreApi ? 'Core API (live)' : 'StubCoreClient (fixture)'}</dd>
          <dt>Own-schema database</dt>
          <dd>core_web, via core_web_rw</dd>
          <dt>Signed in as</dt>
          <dd>{session ? session.clerkUserId : 'nobody'}</dd>
        </dl>
      </div>
      <p className="muted">
        Both switches are environment variables. No code above <code>src/lib/session.ts</code> and{' '}
        <code>src/lib/core.ts</code> is aware of which side either one is on.
      </p>

      <h2>{session ? 'You are signed in' : 'Sign in'}</h2>
      {session ? (
        <div className="row">
          <Link className="btn" href="/dashboard">
            View identity and permissions
          </Link>
          <SignOutControl />
        </div>
      ) : (
        <div className="row">
          <Link className="btn" href="/sign-in">
            Go to sign in
          </Link>
          {!isDevAuthAllowed() && (
            <Link className="btn secondary" href="/sign-up">
              Create an account
            </Link>
          )}
        </div>
      )}
    </>
  );
}
