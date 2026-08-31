import type { ReactNode } from 'react';
import Link from 'next/link';
import { isClerkConfigured } from '@/lib/session';
import './globals.css';

export const metadata = {
  title: 'BeOrchid Core — Web Reference App',
  description: 'Proves login and database access end to end (Section 3.1)',
};

/**
 * ClerkProvider wraps the tree only once Clerk is configured. Before then it is
 * not mounted at all, since it throws without a publishable key.
 */
async function Providers({ children }: { children: ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;
  const { ClerkProvider } = await import('@clerk/nextjs');
  return <ClerkProvider>{children}</ClerkProvider>;
}

/**
 * Account and organization controls.
 *
 * OrganizationSwitcher is what puts an org into the session token, which is how
 * `org_id` reaches Core and lets permissions be resolved for the right
 * membership (Section 6.1). Clerk owns organization and membership records at
 * the point of creation (Section 3.1a); Core holds a synchronised projection.
 */
async function AccountControls() {
  if (!isClerkConfigured()) {
    return <span className="muted">development mode</span>;
  }
  const { OrganizationSwitcher, SignedIn, SignedOut, SignInButton, UserButton } = await import(
    '@clerk/nextjs'
  );
  return (
    <>
      <SignedIn>
        <OrganizationSwitcher hidePersonal />
        <UserButton />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="redirect">
          <button type="button">Sign in</button>
        </SignInButton>
      </SignedOut>
    </>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <nav className="top">
            <div className="inner">
              <strong>BeOrchid Core</strong>
              <Link href="/">Home</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/leads">Leads</Link>
              <span style={{ marginLeft: 'auto' }} />
              <AccountControls />
            </div>
          </nav>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
