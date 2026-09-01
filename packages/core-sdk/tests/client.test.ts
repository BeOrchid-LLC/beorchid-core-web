/**
 * The Core API client (Section 5.6).
 *
 * Exercised against a real HTTP server rather than a mocked fetch, so the
 * request actually built — headers, query encoding, timeout — is the thing
 * under test. A mock would assert what the test author believed the client
 * sends; this asserts what it sends.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { HttpCoreClient } from '../src/client.ts';
import { StubCoreClient, defaultFixture } from '../src/stub.ts';
import { CoreApiError } from '../src/types.ts';

interface Received {
  path: string;
  headers: Record<string, string | string[] | undefined>;
}

describe('HttpCoreClient', () => {
  let server: Server;
  let baseUrl: string;
  let received: Received[] = [];
  let respond: (path: string) => { status: number; body: unknown };

  before(async () => {
    server = createServer((req, res) => {
      received.push({ path: req.url ?? '', headers: req.headers });
      const { status, body } = respond(req.url ?? '');
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (typeof address === 'string' || address === null) throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const client = () =>
    new HttpCoreClient({ baseUrl, appKey: 'core_web', apiKey: 'secret-key', timeoutMs: 2000 });

  it('identifies the calling app on every request', async () => {
    // Section 6.5: every access-log entry is tagged with the app that made the
    // call. Without these headers Core cannot attribute anything.
    received = [];
    respond = () => ({ status: 200, body: [] });
    await client().getUsers(['a1f00000-0000-4000-8000-000000000001']);

    const sent = received[0]!;
    assert.equal(sent.headers['authorization'], 'Bearer secret-key');
    assert.equal(sent.headers['x-beorchid-app'], 'core_web');
  });

  it('sends batch ids as one request, not one per id', async () => {
    // The whole point of the batch-first design (Section 5.6): fifty rows must
    // not become fifty round trips.
    received = [];
    respond = () => ({ status: 200, body: [] });
    await client().getUsers(['id-a', 'id-b', 'id-c']);

    assert.equal(received.length, 1, 'client made more than one request for a batch');
    assert.match(received[0]!.path, /ids=id-a%2Cid-b%2Cid-c|ids=id-a,id-b,id-c/);
  });

  it('makes no request at all for an empty batch', async () => {
    received = [];
    respond = () => ({ status: 200, body: [] });
    const users = await client().getUsers([]);
    assert.deepEqual(users, []);
    assert.equal(received.length, 0, 'empty batch still hit the network');
  });

  it('treats 404 on /v1/me as "no Core identity yet", not an error', async () => {
    // Clerk creates the account and the webhook projects it into core.users
    // moments later (Section 4.6). A person can land on a page in between, and
    // that is an ordinary state rather than a failure.
    respond = () => ({ status: 404, body: { error: 'user not found' } });
    const context = await client().resolveContext('user_unknown', 'core_web');
    assert.equal(context, null);
  });

  it('throws CoreApiError on other failures, carrying the status', async () => {
    respond = () => ({ status: 500, body: { error: 'boom' } });
    await assert.rejects(
      () => client().getUsers(['x']),
      (error: unknown) => {
        assert.ok(error instanceof CoreApiError);
        assert.equal(error.status, 500);
        return true;
      },
    );
  });

  it('does NOT swallow a 404 on a batch lookup', async () => {
    // The null-on-404 behaviour is scoped to /v1/me. Elsewhere a 404 is a real
    // failure and must not be quietly turned into an empty result.
    respond = () => ({ status: 404, body: { error: 'nope' } });
    await assert.rejects(() => client().getUsers(['x']), CoreApiError);
  });

  it('passes organization context through when the session carries one', async () => {
    received = [];
    respond = () => ({ status: 200, body: { user: null } });
    await client().resolveContext('user_1', 'core_web', 'org_acme');
    assert.match(received[0]!.path, /clerk_org_id=org_acme/);
  });

  it('omits organization context when the session has none', async () => {
    received = [];
    respond = () => ({ status: 200, body: { user: null } });
    await client().resolveContext('user_1', 'core_web');
    assert.ok(!received[0]!.path.includes('clerk_org_id'));
  });
});

describe('StubCoreClient', () => {
  it('refuses to construct outside development', () => {
    // It fabricates identity. Running in a deployment would be an
    // authentication bypass, so the guard is the reason it is safe to ship.
    const original = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      assert.throws(() => new StubCoreClient(), /must never run/i);
    } finally {
      process.env['NODE_ENV'] = original;
    }
  });

  it('returns null for an unknown user, matching the real client', () => {
    // The stub and HttpCoreClient must agree on the case most likely to be hit
    // first. They disagreed once, and the mismatch surfaced as a crash.
    process.env['NODE_ENV'] = 'test';
    const stub = new StubCoreClient();
    return stub.resolveContext('user_nobody', 'core_web').then((context) => {
      assert.equal(context, null);
    });
  });

  it('resolves a different effective set per app (Section 6.4)', async () => {
    process.env['NODE_ENV'] = 'test';
    const stub = new StubCoreClient();
    const fixture = defaultFixture();
    const [first, second] = Object.keys(fixture.permissionsByApp);

    const a = await stub.resolvePermissions('m1', first!);
    const b = await stub.resolvePermissions('m1', second!);
    assert.notDeepEqual(a.effective, b.effective, 'both apps resolved the same set');
  });

  it('merges org-wide and app-scoped into effective, without duplicates', async () => {
    process.env['NODE_ENV'] = 'test';
    const stub = new StubCoreClient();
    const resolved = await stub.resolvePermissions('m1', 'core_web');
    const expected = [...new Set([...resolved.orgWide, ...resolved.appScoped])].sort();
    assert.deepEqual(resolved.effective, expected);
  });

  it('resolves nothing for an app with no assignment', async () => {
    process.env['NODE_ENV'] = 'test';
    const stub = new StubCoreClient();
    const resolved = await stub.resolvePermissions('m1', 'app_that_does_not_exist');
    assert.deepEqual(resolved.appScoped, []);
  });
});
