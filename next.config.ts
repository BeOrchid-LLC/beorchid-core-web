import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The SDK ships as TypeScript source and is transpiled by Next rather than
  // pre-built, so a change to the contract is visible here immediately.
  transpilePackages: ['@beorchid/core-sdk'],
};

export default config;
