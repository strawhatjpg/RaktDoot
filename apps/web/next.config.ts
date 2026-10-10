import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@raktdoot/shared", "@raktdoot/copilot", "@raktdoot/bot"],
  // Cline SDK pulls Node-only provider SDKs; load them at runtime instead of bundling.
  serverExternalPackages: ["@cline/sdk", "@cline/core", "@cline/agents", "@cline/llms", "@cline/shared"],
  poweredByHeader: false,
};
export default config;