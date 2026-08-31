# core-web

Web reference app. Proves login and database access end to end, and
demonstrates that permissions determine what a user can reach (§3.1, §6.4).

## Running it

From the repository root:

```bash
npm install
npm run build:sdk
npm run dev:web          # http://localhost:3100
```

It runs today with no Clerk instance and no Core API, using development
stand-ins for both. Sign in on the home page with any Clerk user id; the
fixture recognises `user_2ab9k1`.

## The two seams

This app depends on two things that arrive later, and each sits behind exactly
one file. Nothing above those files knows which implementation is in use, which
is what makes integration a configuration change rather than a rewrite.

| Seam | File | Development | Live |
|---|---|---|---|
| Authentication | `src/lib/session.ts` | Cookie stand-in | Clerk |
| Identity and permissions | `src/lib/core.ts` | `StubCoreClient` | `HttpCoreClient` against Core API |

Both stand-ins refuse to run outside development. `StubCoreClient` throws in its
constructor when `NODE_ENV` is anything else, because it fabricates identity and
would otherwise be an authentication bypass. The dev sign-in route returns 404
whenever real auth is available.

The home page reports which side each seam is on, so the state is never a guess.

## Integrating Clerk

When the keys exist, add them to `.env`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Restart. That is the whole change. `isClerkConfigured()` sees a real
publishable key, `getSession()` switches to Clerk's `auth()`, and `ClerkProvider`
mounts. The dev sign-in route stops responding.

`@clerk/nextjs` is already installed and the provider is already wired, so
nothing needs adding. Configure the instance itself per
[`../core-api/docs/clerk-configuration.md`](../core-api/docs/clerk-configuration.md).

Two things still needed for production sign-in, neither of which Clerk can
supply: a Google Cloud OAuth client and a Microsoft Entra ID app registration
(§4.2).

## Integrating the Core API

When Core API is running:

```
CORE_API_URL=http://localhost:3000
CORE_API_KEY=...
```

Restart. `coreClient()` returns `HttpCoreClient` instead of the stub. Every call
site is unchanged, because both implement the same `CoreClient` interface.

The stub's fixture and the development database are kept deliberately in step:
`npm run db:seed-dev` in `core-api` inserts the same user, organization and
membership at the same UUIDs the stub returns. Without that, reads work and
writes fail on the foreign keys into `core`.

## What this app may and may not touch

It connects to PostgreSQL as `core_web_rw`, which has read and write on the
`core_web` schema and **no privilege of any kind on `core`** (§5.5). A query
against `core.users` from here does not return empty. It fails with `42501`.

`core_web.leads` holds foreign keys into `core.users(id)` and
`core.organizations(id)` for referential integrity. Those constraints were
created by the migration role, which holds `REFERENCES`; the runtime role never
does (§5.4). There is no users table in this schema, and adding one would be a
defect (principle 2, §1.3).

Everything about who the user is and what they may do arrives through the Core
SDK. Nothing is cached in this app's own tables.

## Pages

| Route | Shows |
|---|---|
| `/` | Integration status for both seams, and dev sign-in |
| `/dashboard` | Identity, organization and the effective permission set, all resolved through Core |
| `/leads` | Gated on `leads:read`. The create form appears only with `leads:create`. |
| `POST /api/leads` | Gated on `leads:create`, enforced server-side rather than by hiding the form |

To see enforcement work, sign in as a user the fixture does not know, such as
`user_no_access`, and open `/leads`.
