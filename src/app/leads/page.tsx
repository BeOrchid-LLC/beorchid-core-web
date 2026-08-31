import Link from 'next/link';
import { hasPermission } from '@beorchid/core-sdk';
import { currentContext } from '@/lib/core';
import { listLeads } from '@/lib/db';

/**
 * The Section 6.4 demonstration: a page gated on a specific permission.
 *
 * Read access requires `leads:read`. The create form appears only with
 * `leads:create`. Change the user's app role and what this page allows changes
 * with it, which is what "permissions are functional, not just stored" means.
 */
export default async function Leads() {
  const result = await currentContext();

  if (result.state === 'signed-out') {
    return (
      <>
        <h1>Leads</h1>
        <p>Not signed in.</p>
        <Link className="btn" href="/sign-in">Go to sign in</Link>
      </>
    );
  }

  if (result.state === 'unlinked') {
    return (
      <>
        <h1>Leads</h1>
        <div className="banner dev">
          This account is not yet known to Core, so it holds no permissions anywhere.
        </div>
        <Link className="btn" href="/dashboard">See how to link it</Link>
      </>
    );
  }

  const context = result.context;
  const canRead = hasPermission(context.permissions, 'leads:read');
  const canCreate = hasPermission(context.permissions, 'leads:create');
  const canDelete = hasPermission(context.permissions, 'leads:delete');

  if (!canRead) {
    return (
      <>
        <h1>Leads</h1>
        <div className="banner dev">
          Access denied. This page requires <code>leads:read</code>, which this user does not hold
          in this app.
        </div>
        <p className="muted">
          The check ran against the permission set Core resolved for this membership and this app.
          Holding the permission in a different app would not help here (Section 6.1a).
        </p>
      </>
    );
  }

  let leads: Awaited<ReturnType<typeof listLeads>> = [];
  let dbError: string | null = null;
  try {
    leads = await listLeads(context.organization?.id ?? '');
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  return (
    <>
      <h1>Leads</h1>
      <p className="lede">
        Rows below come from this app&apos;s own <code>core_web</code> schema, read with this
        app&apos;s own database role. Identity came from Core. The two never mix.
      </p>

      <div className="row" style={{ marginBottom: '1.5rem' }}>
        <span className="chip granted">leads:read</span>
        <span className={canCreate ? 'chip granted' : 'chip denied'}>leads:create</span>
        <span className={canDelete ? 'chip granted' : 'chip denied'}>leads:delete</span>
      </div>

      {canCreate && (
        <form action="/api/leads" method="post" className="row" style={{ marginBottom: '1.5rem' }}>
          <input type="text" name="name" placeholder="New lead name" aria-label="Lead name" required />
          <button type="submit">Create lead</button>
        </form>
      )}

      {dbError ? (
        <div className="banner dev">
          Could not read <code>core_web.leads</code>: {dbError}
          <div className="muted" style={{ marginTop: '0.5rem' }}>
            Run the app registration step in SETUP.md to create the schema and its role.
          </div>
        </div>
      ) : leads.length === 0 ? (
        <p>No leads yet{canCreate ? '. Create one above.' : '.'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Created by (core user id)</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.name}</td>
                <td>
                  <code>{lead.createdBy}</code>
                </td>
                <td>{new Date(lead.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="muted" style={{ marginTop: '1.5rem' }}>
        <code>created_by</code> is a foreign key into <code>core.users(id)</code>. This app can hold
        that reference while having no privilege to read the table it points at (Section 5.4).
      </p>
    </>
  );
}
