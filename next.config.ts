import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pandasui/ui"],
  experimental: {
    optimizePackageImports: ["gsap"],
  },
  images: {
    // next/image only loads from hosts listed here. Keep this in sync with
    // any gateway used by NEXT_PUBLIC_IPFS_GATEWAY (and the OG fallbacks) —
    // switching the gateway to a host that isn't allowlisted silently blanks
    // every project image.
    remotePatterns: [
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "nftstorage.link" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "*.ipfs.dweb.link" },
      { protocol: "https", hostname: "dweb.link" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "*.mypinata.cloud" },
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

export default withNextIntl(config);
