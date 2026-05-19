import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { AdminGate } from "@/components/admin/admin-gate";
import { PlatformStatePanel } from "@/components/admin/platform-state-panel";
import { ProjectModerationTable } from "@/components/admin/project-moderation-table";
import { TransferAdminCard } from "@/components/admin/transfer-admin-card";
import { getPlatformStats } from "@/lib/platform";
import { getOnchainProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Operator console — Pandabox",
  description:
    "Platform-admin controls for Pandabox. Pause, set fees, moderate projects, transfer admin.",
  // Don't index — operator-only surface.
  robots: { index: false, follow: false },
};

// Re-render on every request so action buttons reflect freshly-mutated state.
// Each individual reader is still server-cached (`unstable_cache`) and we
// call `revalidateTag`-style refreshes through `router.refresh()` in the
// client panels after a successful sign — so this is mostly a no-op for
// performance and a correctness win for accuracy.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Pull platform state + all on-chain projects in parallel. Both are cached
  // server-side; the dynamic route just bypasses Next's own static cache so
  // we always pick up the latest revalidation.
  const [platform, projects] = await Promise.all([
    getPlatformStats(),
    getOnchainProjects(),
  ]);

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
                Platform operator console.
              </h1>
              <p className="mt-4 max-w-prose text-[15px] text-ink/65">
                Pandabox-wide controls and per-project moderation, gated by
                ownership of the on-chain{" "}
                <code className="font-mono text-[13px]">PlatformAdminCap</code>.
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              <li className="inline-flex items-center gap-1.5">
                <span
                  className={
                    platform?.paused
                      ? "block h-1 w-1 rounded-full bg-poppy"
                      : "block h-1 w-1 rounded-full bg-jade"
                  }
                />
                {platform?.paused ? "paused" : "live"}
              </li>
              <li className="text-ink/20">·</li>
              <li>{projects.length} projects</li>
              <li className="text-ink/20">·</li>
              <li>
                {platform ? `${(platform.feeBps / 100).toFixed(2)}% fee` : "—"}
              </li>
            </ul>
          </Container>
        </section>

        <AdminGate>
          <Container className="space-y-8 py-10">
            {platform ? (
              <PlatformStatePanel stats={platform} />
            ) : (
              <PlatformReadFailure />
            )}

            <ProjectModerationTable projects={projects} />

            <TransferAdminCard />
          </Container>
        </AdminGate>

        <Footer />
      </main>
    </>
  );
}

function PlatformReadFailure() {
  return (
    <div className="border border-poppy/40 bg-poppy/[0.06] p-6 shadow-offset-sm">
      <MonoLabel accent="poppy">Platform read failed</MonoLabel>
      <p className="mt-2 text-sm text-ink/70">
        Couldn't read the Platform shared object. Either{" "}
        <code className="font-mono text-[12px]">
          NEXT_PUBLIC_PLATFORM_OBJECT_ID
        </code>{" "}
        isn't set, or the fullnode call failed. The moderation table below
        still works — it reads each project independently.
      </p>
    </div>
  );
}
