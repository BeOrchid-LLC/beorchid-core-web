import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,

  // The SDK ships as a workspace sibling and is transpiled by Next rather than
  // pre-built into the app, so a change to the contract is visible immediately.
  transpilePackages: ['@beorchid/core-sdk'],

  /**
   * Standalone output bundles only the files actually reached at runtime, which
   * keeps the deployed image small. Without it the image carries the whole
   * node_modules tree, most of which is build-time only.
   */
  output: 'standalone',

  /**
   * Tracing must cover wherever the SDK actually resolves.
   *
   * While this app sits inside the monorepo, node_modules is hoisted to the
   * repository root, so tracing has to reach one level above. Once this
   * repository stands alone, `here` is the root and the parent is harmless.
   */
  outputFileTracingRoot: join(here, '..'),
};

export default config;
