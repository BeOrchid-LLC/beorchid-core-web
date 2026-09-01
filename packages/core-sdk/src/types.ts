/**
 * The contract between every BeOrchid app and Core.
 *
 * Apps hold no identity data of their own (principle 2, Section 1.3) and have
 * no database access to `core` at all (Section 5.5). Everything here therefore
 * crosses the network to the Core API, or is derived from a locally verified
 * token. There is no third source.
 */

/** Claims carried by a Clerk session token, after local verification. */
export interface SessionClaims {
  /** Clerk's user id, the `sub` claim. Maps to core.users.clerk_user_id. */
  clerkUserId: string;
  /** Clerk's organization id, when the session carries org context. */
  clerkOrgId?: string;
  sessionId?: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Core's view of a person. Note there is no `permissions` field: permissions
 * are never a property of a user, only of a membership within an organization
 * and within one app (Section 6.1).
 */
export interface CoreUser {
  id: string;
  clerkUserId: string;
  email: string;
  fullName: string | null;
  status: string;
}

export interface CoreOrganization {
  id: string;
  clerkOrgId: string | null;
  name: string;
  slug: string;
  status: string;
}

/** A person's place in one organization. */
export interface CoreMembership {
  id: string;
  userId: string;
  orgId: string;
  roleKey: string;
  status: string;
}

/**
 * The resolved answer to "what may this membership do in this app".
 *
 * Already merged by Core (Section 5.6): org-wide role permissions unioned with
 * the app-scoped role's permissions. An app never fetches roles and
 * permissions separately and computes the merge itself.
 */
export interface EffectivePermissions {
  membershipId: string;
  appId: string;
  /** Core-wide permissions, from the org-wide role. */
  orgWide: string[];
  /** This app's permissions only. Never another app's (Section 6.1a). */
  appScoped: string[];
  /** The union, which is what enforcement checks against. */
  effective: string[];
}

/** Everything an app needs about the current request, resolved once. */
export interface ResolvedContext {
  user: CoreUser;
  organization: CoreOrganization | null;
  membership: CoreMembership | null;
  permissions: EffectivePermissions | null;
}

export class CoreApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'CoreApiError';
  }
}

export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}
