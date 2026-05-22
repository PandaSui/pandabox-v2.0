import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { DashboardShell } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your owned and supported Pandabox projects.",
};

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
