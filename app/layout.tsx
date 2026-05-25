import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { fontDisplay, fontSans, fontMono } from "./fonts";
import { Providers } from "./providers";
import { PageTransition } from "@/components/motion";
import "./globals.css";

const SITE_URL = "https://test.pandabox.money";
const SITE_NAME = "Pandabox";
const OG_IMAGE_URL = "/og-image.png";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const title = t("title");
  const description = t("description");
  const ogImage = {
    url: OG_IMAGE_URL,
    width: 1568,
    height: 1003,
    alt: t("ogImageAlt"),
  };
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: "%s · Pandabox",
    },
    description,
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
      url: SITE_URL,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: "0xPandaSui",
      creator: "0xPandaSui",
      images: [OG_IMAGE_URL],
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
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F1E3" },
    { media: "(prefers-color-scheme: dark)", color: "#161310" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("common");
  return (
    <html
      lang={locale}
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-ink focus:text-bone focus:px-4 focus:py-2"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <PageTransition>{children}</PageTransition>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
