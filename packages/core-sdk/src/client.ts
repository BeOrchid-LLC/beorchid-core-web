import {
  CoreApiError,
  type CoreOrganization,
  type CoreUser,
  type EffectivePermissions,
  type ResolvedContext,
} from './types';

/**
 * The Core API client interface (Section 5.6).
 *
 * Deliberately batch-first. A list view showing fifty records each with a
 * creator's name used to be one SQL join; over an API a naive one-lookup-per-row
 * pattern turns into fifty requests. Every read here takes a set of ids, and
 * there is no single-item variant to reach for by mistake.
 *
 * Two implementations exist: HttpCoreClient against a running Core API, and
 * StubCoreClient for development before one exists. Both satisfy this
 * interface, so swapping between them is configuration, not a rewrite.
 */
export interface CoreClient {
  /**
   * Resolves the current request's identity, org and permissions in one call.
   *
   * Returns null when the person has a valid session but no Core identity yet.
   * That is an ordinary state, not an error: Clerk creates the account and the
   * webhook that projects it into core.users arrives moments later, so a user
   * can legitimately reach a page in between. Callers must handle it.
   */
  resolveContext(
    clerkUserId: string,
    appKey: string,
    clerkOrgId?: string,
  ): Promise<ResolvedContext | null>;
  getUsers(ids: string[]): Promise<CoreUser[]>;
  getOrganizations(ids: string[]): Promise<CoreOrganization[]>;
  resolvePermissions(membershipId: string, appId: string): Promise<EffectivePermissions>;
}

export interface HttpCoreClientConfig {
  /** Base URL of the Core API, e.g. https://core-api.beorchid.com */
  baseUrl: string;
  /**
   * The calling app's API key. Core API tags every access-log entry with which
   * app made the call (Section 6.5), so this is what makes an entry attributable.
   */
  appKey: string;
  apiKey: string;
  timeoutMs?: number;
}

export class HttpCoreClient implements CoreClient {
  constructor(private readonly config: HttpCoreClientConfig) {}

  async #get<T>(path: string, params: Record<string, string>, notFoundAsNull = false): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    try {
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'x-beorchid-app': this.config.appKey,
          accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (res.status === 404 && notFoundAsNull) return null as T;
      if (!res.ok) {
        throw new CoreApiError(`Core API ${res.status} for ${path}`, res.status, await res.text());
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async resolveContext(clerkUserId: string, appKey: string, clerkOrgId?: string) {
    return this.#get<ResolvedContext | null>(
      '/v1/me',
      {
        clerk_user_id: clerkUserId,
        app: appKey,
        ...(clerkOrgId ? { clerk_org_id: clerkOrgId } : {}),
      },
      true,
    );
  }

  async getUsers(ids: string[]) {
    if (ids.length === 0) return [];
    return this.#get<CoreUser[]>('/v1/users', { ids: ids.join(',') });
  }

  async getOrganizations(ids: string[]) {
    if (ids.length === 0) return [];
    return this.#get<CoreOrganization[]>('/v1/organizations', { ids: ids.join(',') });
  }

  async resolvePermissions(membershipId: string, appId: string) {
    return this.#get<EffectivePermissions>('/v1/permissions/resolve', {
      membership_id: membershipId,
      app_id: appId,
    });
  }
}
