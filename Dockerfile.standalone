# syntax=docker/dockerfile:1

# ═══════════════════════════════════════════════════════════════════════════
# beorchid-web — Next.js reference app, with the Core SDK as a nested workspace
#
#   docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... -t beorchid/core-web .
#
# In Coolify: Base Directory "/", Dockerfile Location "/Dockerfile".
# ═══════════════════════════════════════════════════════════════════════════

FROM node:22-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# The SDK is copied WHOLE before install, not just its manifest. npm runs a
# workspace package's prepare script during install even under
# --ignore-scripts, and the SDK's prepare compiles its TypeScript; with only the
# manifest present that fails on a missing tsconfig.
COPY packages/core-sdk ./packages/core-sdk
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
# The SDK must be compiled before Next resolves it.
RUN npm run build --workspace @beorchid/core-sdk

# Next inlines public variables into the client bundle at BUILD time, so this
# has to be present now, not only at runtime. It is publishable by design and
# safe in an image; CLERK_SECRET_KEY is not and is injected at runtime only.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Standalone output carries only what is reached at runtime, with its own
# minimal node_modules.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
