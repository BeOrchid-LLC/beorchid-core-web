import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,

  // The SDK is its own separate repository (BeOrchid-LLC/core-sdk), vendored
  // in as a git submodule at packages/core-sdk and linked in as an npm
  // workspace, and is transpiled by Next rather than pre-built, so a change
  // to the contract is visible immediately.
  transpilePackages: ['@beorchid/core-sdk'],

  // Historical note: this was required while the SDK resolved to a symlink
  // outside this repo's directory tree (a sibling checkout at ../core-sdk).
  // Now that it's a submodule under packages/core-sdk, the symlink resolves
  // inside the project root and this flag is no longer load-bearing — left
  // enabled since it's harmless and avoids re-breaking the build if the SDK
  // ever moves back outside the tree.
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
