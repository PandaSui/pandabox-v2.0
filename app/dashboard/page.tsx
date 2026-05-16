import type { Metadata } from "next";
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
        <DashboardShell />
        <Footer />
      </main>
    </>
  );
}
