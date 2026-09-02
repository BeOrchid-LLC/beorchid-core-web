import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,

  // The SDK lives in its own sibling repository (../core-sdk), linked in via
  // a file: dependency, and is transpiled by Next rather than pre-built, so a
  // change to the contract is visible immediately.
  transpilePackages: ['@beorchid/core-sdk'],

  /**
   * Required because the SDK now resolves to a symlink OUTSIDE this repo's
   * own directory tree (../core-sdk, its own separate repository). Next
   * refuses to bundle a symlinked module that resolves outside the project
   * root unless this is set — without it the build fails with "Module not
   * found: Can't resolve '@beorchid/core-sdk'" despite node_modules
   * resolving it correctly.
   *
   * Turbopack (Next 16's default builder) does not honour this flag as of
   * 16.3.4 — the build still fails under Turbopack with this set. Webpack
   * does honour it. This is why package.json's build script passes
   * --webpack explicitly rather than using next build's default.
   */
  experimental: {
    externalDir: true,
  },

  /**
   * Standalone output bundles only the files actually reached at runtime, which
   * keeps the deployed image small. Without it the image carries the whole
   * node_modules tree, most of which is build-time only.
   */
  output: 'standalone',

  /**
   * Tracing root must be THIS repository's own root, not a level above it.
   *
   * A level above was correct only while this app lived inside a bigger
   * monorepo with a shared node_modules. Standalone, this repo IS the root: get
   * this wrong and the build succeeds but Next nests the compiled output one
   * directory deeper than the Dockerfile expects, so `node server.js` fails at
   * startup with "Cannot find module '/app/server.js'" — a working build that
   * crashes on boot.
   */
  outputFileTracingRoot: here,
};

export default config;
