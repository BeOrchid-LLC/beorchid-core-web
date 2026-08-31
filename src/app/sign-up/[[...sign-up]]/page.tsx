import Link from 'next/link';
import { isClerkConfigured } from '@/lib/session';

/**
 * Sign-up (Section 4.2).
 *
 * Exactly three fields, or one-click OAuth. No card field anywhere in the flow.
 * The field list is enforced in the Clerk dashboard rather than here, so it
 * cannot drift as Clerk adds optional attributes.
 */
export default async function SignUpPage() {
  if (isClerkConfigured()) {
    const { SignUp } = await import('@clerk/nextjs');
    return (
      <>
        <h1>Create an account</h1>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </>
    );
  }

  return (
    <>
      <h1>Create an account</h1>
      <div className="banner dev">
        Clerk is not configured. Sign-up is a Clerk-hosted flow and has no development stand-in,
        since creating an account is exactly the operation that must not be faked.
      </div>
      <h2>The form, once connected</h2>
      <div className="card">
        <div className="row">
          <span className="chip">Full name</span>
          <span className="chip">Work email</span>
          <span className="chip">Password</span>
        </div>
        <p className="muted" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
          Three fields, or one click with Google or Microsoft. Password strength uses Clerk&apos;s
          breach detection against HaveIBeenPwned.
        </p>
      </div>
      <p>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </>
  );
}
