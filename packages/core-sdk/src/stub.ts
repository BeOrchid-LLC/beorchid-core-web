import type { CoreClient } from './client';
import type {
  CoreMembership,
  CoreOrganization,
  CoreUser,
  EffectivePermissions,
  ResolvedContext,
} from './types';

/**
 * DEVELOPMENT ONLY. Stands in for the Core API until one is running.
 *
 * This class fabricates identity. If it ever ran in a deployed environment it
 * would be an authentication bypass, so the constructor refuses to build unless
 * NODE_ENV is development or test. That guard is the whole reason this is safe
 * to have in the repository at all.
 *
 * It implements CoreClient exactly, so replacing it with HttpCoreClient is a
 * one-line change at the composition root and nothing that consumes the client
 * changes at all.
 */
export class StubCoreClient implements CoreClient {
  constructor(private readonly fixture: StubFixture = defaultFixture()) {
    const env = process.env['NODE_ENV'];
    if (env !== 'development' && env !== 'test') {
      throw new Error(
        `StubCoreClient must never run with NODE_ENV="${env}". ` +
          'It fabricates identity and would bypass authentication. ' +
          'Configure a real Core API base URL and use HttpCoreClient.',
      );
    }
  }

  async resolveContext(
    clerkUserId: string,
    appKey: string,
    _clerkOrgId?: string,
  ): Promise<ResolvedContext | null> {
    const user = this.fixture.users.find((u) => u.clerkUserId === clerkUserId) ?? null;
    // Matches the real client: an unknown user has no Core identity yet.
    if (!user) return null;

    const membership = this.fixture.membership;
    const perApp = this.fixture.permissionsByApp[appKey];

    return {
      user,
      organization: this.fixture.organization,
      membership,
      permissions: perApp
        ? {
            membershipId: membership.id,
            appId: appKey,
            orgWide: this.fixture.orgWidePermissions,
            appScoped: perApp,
            effective: [...new Set([...this.fixture.orgWidePermissions, ...perApp])].sort(),
          }
        : null, // no assignment for this app means no access (Section 6.1a)
    };
  }

  async getUsers(ids: string[]): Promise<CoreUser[]> {
    return this.fixture.users.filter((u) => ids.includes(u.id));
  }

  async getOrganizations(ids: string[]): Promise<CoreOrganization[]> {
    return ids.includes(this.fixture.organization.id) ? [this.fixture.organization] : [];
  }

  async resolvePermissions(membershipId: string, appId: string): Promise<EffectivePermissions> {
    const perApp = this.fixture.permissionsByApp[appId] ?? [];
    return {
      membershipId,
      appId,
      orgWide: this.fixture.orgWidePermissions,
      appScoped: perApp,
      effective: [...new Set([...this.fixture.orgWidePermissions, ...perApp])].sort(),
    };
  }
}

export interface StubFixture {
  users: CoreUser[];
  organization: CoreOrganization;
  membership: CoreMembership;
  orgWidePermissions: string[];
  /** Keyed by app key. A missing key means no access to that app. */
  permissionsByApp: Record<string, string[]>;
}

/**
 * Mirrors the fixture the database tests use, so what the UI shows in
 * development matches what the schema actually resolves. Alice is admin in one
 * app and viewer in another, which is the Section 6.4 demonstration: the same
 * person, the same organization, a different effective permission set per app.
 */
export function defaultFixture(): StubFixture {
  return {
    users: [
      {
        id: 'a1f00000-0000-4000-8000-000000000001',
        clerkUserId: 'user_2ab9k1',
        email: 'alice@beorchid.com',
        fullName: 'Alice Example',
        status: 'active',
      },
    ],
    organization: {
      id: 'ac000000-0000-4000-8000-000000000001',
      clerkOrgId: 'org_acme',
      name: 'Acme',
      slug: 'acme',
      status: 'active',
    },
    membership: {
      id: 'be000000-0000-4000-8000-000000000001',
      userId: 'a1f00000-0000-4000-8000-000000000001',
      orgId: 'ac000000-0000-4000-8000-000000000001',
      roleKey: 'admin',
      status: 'active',
    },
    orgWidePermissions: ['members:invite'],
    permissionsByApp: {
      core_web: ['leads:read', 'leads:create', 'leads:delete'],
      // The same person, deliberately weaker in a second app. Section 6.4 asks
      // for exactly this contrast to be demonstrable. It is asserted in the
      // tests today; showing it in a running UI needs a second app, which is
      // pending a scope decision now that core-mobile is out.
      second_app: ['leads:read'],
    },
  };
}
