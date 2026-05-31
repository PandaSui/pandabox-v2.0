import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { ToolCard, hydrateTools, type ToolMessages } from "@/components/tools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools");
  return {
    title: t("metaTitle"),
    description: t("subtitle"),
  };
}

export default async function ToolsPage() {
  const t = await getTranslations("tools");
  const tItems = await getTranslations("tools.items");
  const tShared = await getTranslations("tools.shared");

  const messages: ToolMessages = {
    airdrop: {
      name: tItems("airdrop.name"),
      tagline: tItems("airdrop.tagline"),
      description: tItems("airdrop.description"),
      capabilities: [
        tItems("airdrop.cap1"),
        tItems("airdrop.cap2"),
        tItems("airdrop.cap3"),
      ],
    },
    redeem: {
      name: tItems("redeem.name"),
      tagline: tItems("redeem.tagline"),
      description: tItems("redeem.description"),
      capabilities: [
        tItems("redeem.cap1"),
        tItems("redeem.cap2"),
        tItems("redeem.cap3"),
      ],
    },
  };

  const tools = hydrateTools(messages);
  const liveCount = tools.filter((tool) => tool.status === "available").length;
  const soonCount = tools.length - liveCount;

  const labels = {
    available: tShared("statusAvailable"),
    soon: tShared("statusSoon"),
    open: tShared("ctaOpen"),
    notify: tShared("ctaNotify"),
    capabilities: tShared("capabilities"),
    onchainHint: tShared("onchainHint"),
  };

  return (
    <>
      <Nav />
      <main id="main">
        {/* ── Header ─────────────────────────────────────────── */}
        <section className="relative border-b border-ink/15">
          <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between md:py-16">
            <div className="max-w-3xl">
              <AccentRule color="sun">
                <MonoLabel>{t("eyebrow")}</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 text-balance font-display text-[clamp(2rem,4.4vw,3.75rem)] leading-[0.98] tracking-tight">
                {t("headline")}
              </h1>
              <p className="mt-4 max-w-prose text-pretty text-base text-ink/65 md:text-[15.5px]">
                {t("subtitle")}
              </p>
            </div>

            {/* Counts strip — mirrors the /explore tone */}
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:gap-x-5 md:gap-y-2">
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-jade" />
                {t("liveCount", { count: liveCount })}
              </li>
              <li className="text-ink/20">·</li>
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-sun" />
                {t("soonCount", { count: soonCount })}
              </li>
              <li className="text-ink/20">·</li>
              <li>{t("totalCount", { count: tools.length })}</li>
            </ul>
          </Container>
        </section>

        {/* ── Tools grid ─────────────────────────────────────── */}
        <section className="relative">
          <Container className="py-10 md:py-14">
            {/* Sub-eyebrow — the same pattern as /explore's filter band */}
            <div className="mb-8 flex flex-wrap items-center gap-3 md:mb-10">
              <MonoLabel className="text-ink/55">
                {t("sectionAvailable")}
              </MonoLabel>
              <span aria-hidden className="h-px flex-1 bg-ink/10" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-ink/40">
                {t("sectionAvailableSpec")}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} labels={labels} />
              ))}
            </div>
          </Container>
        </section>

        {/* ── Roadmap strip ──────────────────────────────────── */}
        <section className="relative border-t border-ink/15 bg-ink/[0.015]">
          <Container className="py-14 md:py-20">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
              <div className="md:col-span-5">
                <AccentRule color="plum">
                  <MonoLabel>{t("roadmapEyebrow")}</MonoLabel>
                </AccentRule>
                <h2 className="mt-3 text-balance text-[1.75rem] leading-[1.05] md:text-3xl">
                  {t("roadmapTitle")}
                </h2>
                <p className="mt-3 max-w-prose text-[14.5px] text-ink/65">
                  {t("roadmapBody")}
                </p>
              </div>

              <ul className="grid grid-cols-1 gap-4 md:col-span-7 md:grid-cols-2">
                {(["sniper", "vesting", "splits", "merkle"] as const).map(
                  (slug, i) => (
                    <RoadmapItem
                      key={slug}
                      index={i}
                      eyebrow={t(`roadmapItems.${slug}.tag`)}
                      title={t(`roadmapItems.${slug}.title`)}
                      body={t(`roadmapItems.${slug}.body`)}
                      lockedLabel={t("roadmapLocked")}
                      ariaLabel={t("roadmapLockedAria")}
                    />
                  ),
                )}
              </ul>
            </div>
          </Container>
        </section>

        {/* ── Submit a tool ──────────────────────────────────── */}
        <section className="relative border-t border-ink/15">
          <Container className="flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between md:py-20">
            <div className="max-w-2xl">
              <AccentRule color="saffron">
                <MonoLabel>{t("suggestEyebrow")}</MonoLabel>
              </AccentRule>
              <h2 className="mt-3 text-balance text-[1.5rem] leading-[1.1] md:text-[1.75rem]">
                {t("suggestTitle")}
              </h2>
              <p className="mt-3 max-w-prose text-[14.5px] text-ink/65">
                {t("suggestBody")}
              </p>
            </div>
            <a
              href="https://discord.gg/P6J99uXnnp"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-saffron px-6 font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
            >
              <span>{t("suggestCta")}</span>
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-[2px]"
              >
                ↗
              </span>
            </a>
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}

/**
 * A "classified" roadmap card. The card's content is rendered but heavily
 * blurred so the user perceives the *shape* of an upcoming tool — eyebrow,
 * title, two lines of body — without being able to read it. A small lock
 * pill sits crisp over the center as the affordance that this is intentional,
 * not a render bug. Pure CSS, server-rendered, no client JS.
 */
function RoadmapItem({
  index,
  eyebrow,
  title,
  body,
  lockedLabel,
  ariaLabel,
}: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  lockedLabel: string;
  ariaLabel: string;
}) {
  return (
    <li
      aria-label={ariaLabel}
      className="group relative overflow-hidden border border-ink/15 bg-bone px-5 py-5 transition-colors duration-300 ease-atelier hover:border-ink/40"
    >
      {/* Numeric watermark in the corner so each card still has a quiet
          identifier. Crisp, not blurred. */}
      <span
        aria-hidden
        className="absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-ink/30"
      >
        {String(index + 1).padStart(2, "0")} / 04
      </span>

      {/* The classified content. We render the real eyebrow + title + body
          but blur them so users see content silhouettes only. `select-none`
          and aria-hidden so screen readers and copy-paste don't leak the
          unreleased copy. */}
      <div
        aria-hidden
        className="pointer-events-none select-none"
        style={{ filter: "blur(7px)", opacity: 0.6 }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
          {eyebrow}
        </span>
        <h3 className="mt-1.5 text-[1.05rem] leading-snug text-ink">{title}</h3>
        <p className="mt-2 text-pretty text-[13px] leading-relaxed text-ink/60">
          {body}
        </p>
      </div>

      {/* Lock overlay — centered pill, crisp against the blurred shapes
          underneath. Bone background gives it just enough contrast without
          fighting the rest of the surface. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 border border-ink/35 bg-bone px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/85 shadow-offset-sm">
          <LockGlyph />
          {lockedLabel}
        </span>
      </div>
    </li>
  );
}

function LockGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="6" width="9" height="6.5" />
      <path d="M4.5 6 V4.25 a2.5 2.5 0 0 1 5 0 V6" />
    </svg>
  );
}
