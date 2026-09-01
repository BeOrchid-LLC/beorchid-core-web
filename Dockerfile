# syntax=docker/dockerfile:1

# ═══════════════════════════════════════════════════════════════════════════
# core-web
#
# BUILD CONTEXT IS THE REPOSITORY ROOT, not this directory. core-web imports
# @beorchid/core-sdk, which is a workspace sibling rather than a published
# package, so a context scoped to core-web/ cannot see it. In Coolify set Base
# Directory to "/" and Dockerfile Location to "/core-web/Dockerfile".
#
#   docker build -f core-web/Dockerfile -t beorchid/core-web .
# ═══════════════════════════════════════════════════════════════════════════

FROM node:22-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /repo

# ── Dependencies ───────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY core-web/package.json ./core-web/

# core-sdk is copied WHOLE, before install, not just its manifest.
#
# npm runs a workspace package's `prepare` script during install even under
# --ignore-scripts, and core-sdk's prepare compiles its TypeScript. With only
# the manifest present that fails on a missing tsconfig. The SDK is small and
# changes rarely, so copying it here costs little cache and removes the
# ordering problem entirely.
#
# It lives inside core-web now rather than beside it, so that this repository
# can be split from core-api without the import losing its target.
COPY core-web/packages/core-sdk ./core-web/packages/core-sdk

# --ignore-scripts still applies to third-party packages, so no dependency's
# postinstall runs during the build.
# Scoped to this workspace and the SDK it depends on. A bare `npm ci` would
# also install core-api's driver, Redis client and webhook libraries, none of
# which this service loads.
RUN npm ci --workspace @beorchid/core-web --workspace @beorchid/core-sdk \
      --include-workspace-root --ignore-scripts

# ── Build ──────────────────────────────────────────────────────────────────
FROM deps AS build
COPY core-web ./core-web

# The SDK must be compiled before Next resolves it.
RUN npm run build --workspace @beorchid/core-sdk

# The publishable key is inlined into the client bundle at build time, so it
# has to be present now rather than at runtime. It is publishable by design and
# safe in an image; the secret key is NOT and is injected at runtime only.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @beorchid/core-web

# ── Runtime ────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Next's standalone output carries only the files actually reached at runtime,
# with its own minimal node_modules. Copying the workspace tree instead would
# multiply the image size for no benefit.
COPY --from=build --chown=nextjs:nodejs /repo/core-web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/core-web/.next/static ./core-web/.next/static

USER nextjs
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "core-web/server.js"]
