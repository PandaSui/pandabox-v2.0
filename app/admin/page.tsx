import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { AdminProvider } from "@/components/admin/admin-context";
import { AdminConsole } from "@/components/admin/admin-console";
import { getAdminOverview, buildDeckCards } from "@/lib/admin/overview";
import { getOnchainProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Admin console — Pandabox",
  description:
    "Platform-admin controls for Pandabox, Redeem, and Airdrop. Pause, set fees, moderate, withdraw, transfer admin.",
  // Don't index — operator-only surface.
  robots: { index: false, follow: false },
};

// Re-render on every request so the deck + panels reflect freshly-mutated
// state. Each reader stays server-cached (`unstable_cache`, 60s); the dynamic
// route just bypasses Next's own static cache so we pick up revalidations.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Live platform state for all three protocols + Pandabox's project list, in
  // parallel. Everything is server-cached; failures degrade per-protocol.
  const [overview, projects] = await Promise.all([
    getAdminOverview(),
    getOnchainProjects(),
  ]);
  const cards = buildDeckCards(overview);
  const liveCount = cards.filter((c) => c.available && !c.paused).length;
  const pausedCount = cards.filter((c) => c.available && c.paused).length;

  return (
    <>
      <Nav />
      <main id="main">
        <section className="border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-3xl">
              <AccentRule color="sky">
                <MonoLabel accent="sky">Operator</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-5xl">
                Admin console.
              </h1>
              <p className="mt-4 max-w-prose text-[15px] text-ink/65">
                One console for the three protocols you operate — Pandabox,
                Redeem, and Airdrop. Each panel is gated by ownership of its
                on-chain admin cap.
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              <li>{cards.length} protocols</li>
              <li className="text-ink/20">·</li>
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-jade" />
                {liveCount} live
              </li>
              {pausedCount > 0 && (
                <>
                  <li className="text-ink/20">·</li>
                  <li className="inline-flex items-center gap-1.5">
                    <span className="block h-1 w-1 rounded-full bg-poppy" />
                    {pausedCount} paused
                  </li>
                </>
              )}
            </ul>
          </Container>
        </section>

        <AdminProvider>
          <Suspense fallback={null}>
            <AdminConsole
              cards={cards}
              platform={overview.pandabox}
              redeem={overview.redeem}
              airdrop={overview.airdrop}
              projects={projects}
            />
          </Suspense>
        </AdminProvider>

        <Footer />
      </main>
    </>
  );
}
