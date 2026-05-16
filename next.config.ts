import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pandasui/ui"],
  experimental: {
    optimizePackageImports: ["gsap"],
  },
};

export default config;
