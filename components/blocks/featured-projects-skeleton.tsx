import { getTranslations } from "next-intl/server";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { ProjectCardSkeleton } from "@/components/project/project-card-skeleton";

/**
 * Suspense fallback for the landing's `<FeaturedProjects>` server block.
 * Mirrors the section's header + 3-up grid so the page doesn't reflow when
 * the real data resolves.
 */
export async function FeaturedProjectsSkeleton() {
  const t = await getTranslations("home.featured");
  return (
    <section
      className="relative border-t border-ink/15 bg-paper/40"
      role="status"
      aria-busy="true"
      aria-label={t("skeleton.ariaLoading")}
    >
      <Container className="py-20 lg:py-24">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <AccentRule color="saffron" className="mb-3">
              <MonoLabel>{t("eyebrow")}</MonoLabel>
            </AccentRule>
            <h2 className="text-3xl md:text-4xl">{t("headline")}</h2>
          </div>
          {/* Right-side stat strip placeholders */}
          <div
            className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]"
            aria-hidden
          >
            <span className="inline-flex items-baseline gap-2">
              <span className="text-ink/40">{t("statOnchain")}</span>
              <span className="inline-block h-2.5 w-6 animate-pulse bg-ink/10" />
              <span className="text-ink/40">{t("statProjects")}</span>
            </span>
            <span className="text-ink/20">·</span>
            <span className="inline-flex items-baseline gap-2">
              <span className="inline-block h-2.5 w-10 animate-pulse bg-ink/10" />
              <span className="text-ink/40">{t("statRaisedAcross")}</span>
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>

        <div className="mt-10 flex items-center justify-between">
          <span
            aria-hidden
            className="inline-block h-2.5 w-36 animate-pulse bg-ink/10"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/35">
            {t("dataMeta")}
          </span>
        </div>
        <span className="sr-only">{t("skeleton.srLoading")}</span>
      </Container>
    </section>
  );
}
