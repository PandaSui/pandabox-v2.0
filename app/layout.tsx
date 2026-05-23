import type { Metadata, Viewport } from "next";
import { fontDisplay, fontSans, fontMono } from "./fonts";
import { Providers } from "./providers";
import { PageTransition } from "@/components/motion";
import "./globals.css";

const SITE_URL = "https://pandabox.money";
const SITE_NAME = "Pandabox";
const TITLE = "Pandabox — Fund what's worth funding. On Sui.";
const DESCRIPTION =
  "A programmable funding launchpad on Sui. Launch a project, set the rate, run an on-chain sale — every parameter, every transaction, on-chain.";
const OG_IMAGE = {
  url: "/og-image.png",
  width: 1568,
  height: 1003,
  alt: "Pandabox — programmable funding launchpad for Sui.",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Pandabox",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Pandabox",
    "Pandasui",
    "Sui Network",
    "Sui",
    "funding launchpad",
    "IDO",
    "token sale",
    "on-chain funding",
    "Move",
  ],
  authors: [{ name: "Pandasui", url: SITE_URL }],
  creator: "Pandasui",
  publisher: "Pandasui",
  category: "technology",
  alternates: { canonical: "/" },
  formatDetection: { email: false, address: false, telephone: false },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    site: "0xPandaSui",
    creator: "0xPandaSui",
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F1E3" },
    { media: "(prefers-color-scheme: dark)", color: "#161310" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-ink focus:text-bone focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>
          <PageTransition>{children}</PageTransition>
        </Providers>
      </body>
    </html>
  );
}
