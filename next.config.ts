import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pandasui/ui"],
  experimental: {
    optimizePackageImports: ["gsap"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "*.ipfs.dweb.link" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
    ],
  },
  async redirects() {
    return [
      // Legacy project URL — keep old shares and OG cards resolvable.
      {
        source: "/p/:projectId",
        destination: "/projects/:projectId",
        permanent: true,
      },
    ];
  },
};

export default config;
