import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep build tracing and module resolution inside this project.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;
