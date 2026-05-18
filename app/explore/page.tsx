import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { OnchainExploreGrid } from "@/components/project/onchain-explore-grid";
import { getOnchainProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover projects raising on Pandabox.",
};

// Re-fetch from chain at most once a minute. The reader inside
// `getOnchainProjects` is itself unstable_cached, so this is mostly a hint to
// Next that the static prerender is fine for ~60s windows.
export const revalidate = 60;

export default async function ExplorePage() {
  const projects = await getOnchainProjects();
  const liveNow = projects.filter(
    (p) => p.status === "live" && Date.now() < p.endTimeMs,
  ).length;

  return (
    <>
      <Nav />
      <main id="main">
        <section className="border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-3xl">
              <AccentRule color="saffron">
                <MonoLabel>Explore</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-5xl">
                Funded right now.
              </h1>
              <p className="mt-4 max-w-prose text-[15px] text-ink/65">
                Every active token sale on Pandabox, read directly from the
                Sui mainnet package — no indexer in between.
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-jade" />
                {liveNow} live
              </li>
              <li className="text-ink/20">·</li>
              <li>{projects.length} total</li>
              <li className="text-ink/20">·</li>
              <li>cached 60s</li>
            </ul>
          </Container>
        </section>

        <OnchainExploreGrid projects={projects} />
      </main>
    </>
  );
}
