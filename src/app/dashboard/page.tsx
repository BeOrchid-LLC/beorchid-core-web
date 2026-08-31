import Link from 'next/link';
import { currentContext, APP_KEY } from '@/lib/core';

export default async function Dashboard() {
  const result = await currentContext();

  if (result.state === 'signed-out') {
    return (
      <>
        <h1>Dashboard</h1>
        <p>Not signed in.</p>
        <Link className="btn" href="/sign-in">
          Go to sign in
        </Link>
      </>
    );
  }

  /**
   * Signed in to Clerk, but no core.users row yet.
   *
   * In production this is a brief window while the user.created webhook is in
   * flight (Section 4.6). Locally it lasts until reconciliation runs, because
   * Clerk cannot deliver webhooks to localhost at all.
   */
  if (result.state === 'unlinked') {
    return (
      <>
        <h1>Dashboard</h1>
        <div className="banner dev">
          You are signed in, but this account is not yet known to Core.
        </div>
        <div className="card">
          <dl className="kv">
            <dt>Clerk user id</dt>
            <dd>{result.clerkUserId}</dd>
            <dt>Core identity</dt>
            <dd>not yet created</dd>
          </dl>
        </div>
        <p>
          Identity reaches Core through Clerk&apos;s <code>user.created</code> webhook. Clerk cannot
          deliver webhooks to <code>localhost</code>, so in local development the reconciliation job
          bridges the gap instead.
        </p>
        <pre>
          <code>
            {`cd core-api
npm run db:reconcile
npm run db:grant-dev-access -- ${result.clerkUserId}`}
          </code>
        </pre>
        <p className="muted">
          The second command exists because Clerk owns organizations and knows nothing about app
          roles, so a new account arrives with an identity and nothing else. Without an
          organization there is no membership, and permissions are never a property of a user alone.
        </p>
      </>
    );
  }

  const { user, organization, membership, permissions } = result.context;

  return (
    <>
      <h1>Dashboard</h1>
      <p className="lede">
        Everything below came from Core, not from this app&apos;s database. This app holds no
        identity data and has no read access to the <code>core</code> schema (Section 5.5).
      </p>

      <h2>Identity</h2>
      <div className="card">
        <dl className="kv">
          <dt>Core user id</dt>
          <dd>{user.id}</dd>
          <dt>Clerk user id</dt>
          <dd>{user.clerkUserId}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Name</dt>
          <dd>{user.fullName ?? '—'}</dd>
        </dl>
      </div>
      <p className="muted">
        The Core user id stays the same across every BeOrchid app this person signs into
        (Section 4.1a).
      </p>

      <h2>Organization</h2>
      <div className="card">
        {organization ? (
          <dl className="kv">
            <dt>Name</dt>
            <dd>{organization.name}</dd>
            <dt>Slug</dt>
            <dd>{organization.slug}</dd>
            <dt>Role in org</dt>
            <dd>{membership?.roleKey ?? '—'}</dd>
          </dl>
        ) : (
          <>
            <p>No organization context on this session.</p>
            <p className="muted">
              Permissions are always evaluated within an organization (Section 6.1), so without one
              there is nothing to resolve. Create an organization in Clerk, or use the switcher in
              the header.
            </p>
          </>
        )}
      </div>

      <h2>Effective permissions in {APP_KEY}</h2>
      <div className="card">
        {permissions ? (
          <>
            <p className="muted">Core-wide, from the organization role:</p>
            <div className="row" style={{ marginBottom: '1rem' }}>
              {permissions.orgWide.length ? (
                permissions.orgWide.map((p) => (
                  <span className="chip granted" key={p}>
                    {p}
                  </span>
                ))
              ) : (
                <span className="muted">none</span>
              )}
            </div>
            <p className="muted">Scoped to this app only:</p>
            <div className="row">
              {permissions.appScoped.length ? (
                permissions.appScoped.map((p) => (
                  <span className="chip granted" key={p}>
                    {p}
                  </span>
                ))
              ) : (
                <span className="muted">none</span>
              )}
            </div>
          </>
        ) : (
          <p>
            No app role assignment for <code>{APP_KEY}</code>, which means no access to it at all.
            Absence is the default deny (Section 6.1a).
          </p>
        )}
      </div>
      <p className="muted">
        The same person can hold a different set in another app. That is resolved per app rather
        than tied to identity, which is what Section 6.4 asks the reference apps to demonstrate.
      </p>
    </>
  );
}
