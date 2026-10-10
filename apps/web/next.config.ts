import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@raktdoot/shared"],
  poweredByHeader: false,
};
export default config;