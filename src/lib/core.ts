import {
  HttpCoreClient,
  StubCoreClient,
  type CoreClient,
  type ResolvedContext,
} from '@beorchid/core-sdk';
import { getSession } from './session';

/**
 * THE CORE API SEAM, and the composition root that picks an implementation.
 *
 * Section 5.5: this app has no database access to `core` of any kind, not even
 * read. Every fact about who the user is, which organization they are acting
 * in, and what they may do arrives through this client.
 *
 * When CORE_API_URL is set, calls go to the real Core API. Until then the stub
 * serves the same interface from a fixture. StubCoreClient refuses to
 * construct outside development, so the fallback cannot reach a deployment.
 */

/** This app's key in core.apps. Also its schema name and grant scope. */
export const APP_KEY = 'core_web';

let client: CoreClient | null = null;

export function coreClient(): CoreClient {
  if (client) return client;

  const baseUrl = process.env['CORE_API_URL'];
  const apiKey = process.env['CORE_API_KEY'];

  client =
    baseUrl && apiKey
      ? new HttpCoreClient({ baseUrl, apiKey, appKey: APP_KEY })
      : new StubCoreClient();

  return client;
}

export function isCoreApiConfigured(): boolean {
  return Boolean(process.env['CORE_API_URL'] && process.env['CORE_API_KEY']);
}

/**
 * Three states, not two, because "signed out" and "signed in but not yet known
 * to Core" need different handling and produce different pages.
 *
 * The third state is ordinary rather than exceptional: Clerk creates the
 * account, and the webhook that projects it into core.users arrives moments
 * later (Section 4.6). A person can legitimately land on a page in between.
 * Treating that as an error crashes the page on what is really a timing gap.
 */
export type CurrentContext =
  | { state: 'signed-out' }
  | { state: 'unlinked'; clerkUserId: string }
  | { state: 'resolved'; context: ResolvedContext };

/**
 * Resolves the current request to identity, organization and effective
 * permissions. One call, per Section 5.6, so a page never assembles this from
 * several round trips.
 */
export async function currentContext(): Promise<CurrentContext> {
  const session = await getSession();
  if (!session) return { state: 'signed-out' };

  const context = await coreClient().resolveContext(
    session.clerkUserId,
    APP_KEY,
    session.clerkOrgId,
  );
  if (!context) return { state: 'unlinked', clerkUserId: session.clerkUserId };

  return { state: 'resolved', context };
}
