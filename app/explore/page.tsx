import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { OnchainExploreGrid } from "@/components/project/onchain-explore-grid";
import { getHydratedOnchainProjects } from "@/lib/projects";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

// Re-fetch from chain at most once a minute. The reader inside
// `getOnchainProjects` is itself unstable_cached, so this is mostly a hint to
// Next that the static prerender is fine for ~60s windows.
export const revalidate = 60;

export default async function ExplorePage() {
  const projects = await getHydratedOnchainProjects();
  // endTimeMs === 0 means no time cap (Option::none on chain) — such a sale is
  // live purely by status, so guard the clock check with `> 0` or open-ended
  // projects are wrongly dropped from the live count.
  const now = Date.now();
  const liveNow = projects.filter(
    (p) => p.status === "live" && (p.endTimeMs === 0 || now < p.endTimeMs),
  ).length;
  const t = await getTranslations("explore");

  return (
    <>
      <Nav />
      <main id="main">
        <section className="border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-7 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-3xl">
              <AccentRule color="saffron">
                <MonoLabel>{t("title")}</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 font-display text-[1.65rem] leading-[1.05] sm:text-3xl md:text-5xl">
                {t("headline")}
              </h1>
              <p className="mt-3 max-w-prose text-sm text-ink/65 md:mt-4 md:text-[15px]">
                {t("subtitle")}
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:gap-x-5 md:gap-y-2">
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-jade" />
                {t("liveCount", { count: liveNow })}
              </li>
              <li className="text-ink/20">·</li>
              <li>{t("totalCount", { count: projects.length })}</li>
              <li className="text-ink/20">·</li>
              <li>{t("cachedHint")}</li>
            </ul>
          </Container>
        </section>

        <OnchainExploreGrid projects={projects} />
      </main>
    </>
  );
}
