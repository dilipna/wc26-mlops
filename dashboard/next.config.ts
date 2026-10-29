import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep build tracing and module resolution inside this project.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // Preserve the repository instructions instead of rewriting them during dev.
  agentRules: false,
};

export default nextConfig;
