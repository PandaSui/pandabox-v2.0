import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { DashboardShell } from "@/components/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <main id="main">
        <Suspense fallback={null}>
          <DashboardShell />
        </Suspense>
        <Footer />
      </main>
    </>
  );
}
