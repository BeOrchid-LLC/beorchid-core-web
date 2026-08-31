import { isClerkConfigured, isDevAuthAllowed } from '@/lib/session';

/**
 * Sign-in (Section 4.2).
 *
 * Clerk's hosted component renders the three enabled strategies: email and
 * password, Google, and Microsoft. Which strategies appear is controlled in the
 * Clerk dashboard, not here, which is why this file has no provider buttons of
 * its own. Adding one would let the form drift from the three fields the
 * contract specifies.
 */
export default async function SignInPage() {
  if (isClerkConfigured()) {
    const { SignIn } = await import('@clerk/nextjs');
    return (
      <>
        <h1>Sign in</h1>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </>
    );
  }

  return (
    <>
      <h1>Sign in</h1>
      <div className="banner dev">
        Clerk is not configured, so this is the development stand-in. With keys present, Clerk
        renders email and password, Google and Microsoft here instead.
      </div>

      {isDevAuthAllowed() ? (
        <form action="/api/dev-session" method="post" className="row">
          <input type="hidden" name="action" value="signin" />
          <input
            type="text"
            name="clerkUserId"
            defaultValue="user_2ab9k1"
            aria-label="Clerk user id"
          />
          <button type="submit">Sign in as this user</button>
        </form>
      ) : (
        <p>No authentication provider is available in this environment.</p>
      )}

      <h2>What appears here once Clerk is connected</h2>
      <div className="card">
        <div className="row">
          <span className="chip">email + password</span>
          <span className="chip">Google</span>
          <span className="chip">Microsoft</span>
        </div>
        <p className="muted" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
          Google and Microsoft need OAuth credentials registered in the Clerk dashboard. They are
          held by Clerk, never by this app.
        </p>
      </div>
    </>
  );
}
