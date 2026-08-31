import pg from 'pg';

/**
 * This app's own database access (Section 5.4).
 *
 * Connects as `core_web_rw`, which holds read/write on the `core_web` schema
 * and no privilege whatsoever on `core`. A query against core.users from here
 * does not return empty, it fails with 42501, and that is deliberate.
 *
 * The tables below reference core.users(id) and core.organizations(id) by
 * foreign key for referential integrity. There is no users table in this
 * schema, and adding one would be a defect (principle 2, Section 1.3).
 */

let pool: pg.Pool | null = null;

export function db(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set. See .env.example.');
  pool = new pg.Pool({ connectionString, max: 5 });
  return pool;
}

export interface Lead {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export async function listLeads(orgId: string): Promise<Lead[]> {
  const { rows } = await db().query<Lead>(
    `SELECT id, name, created_by AS "createdBy", created_at AS "createdAt"
     FROM core_web.leads
     WHERE org_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [orgId],
  );
  return rows;
}

export async function createLead(orgId: string, userId: string, name: string): Promise<Lead> {
  const { rows } = await db().query<Lead>(
    `INSERT INTO core_web.leads (org_id, created_by, name)
     VALUES ($1, $2, $3)
     RETURNING id, name, created_by AS "createdBy", created_at AS "createdAt"`,
    [orgId, userId, name],
  );
  return rows[0]!;
}
