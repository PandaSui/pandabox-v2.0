import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import { PoolGrid } from "@/components/redeem/pool-grid";
import { getRedeemDiscovery } from "@/lib/redeem/server";

// Re-fetch from chain every 30s. The reader inside is already cached, so
// this is mostly a hint to Next that the prerender is fine for ~30s
// windows. Redeems happen in real time, but stale-by-30s is acceptable
// for the discovery surface — the per-pool detail page is where freshness
// actually matters.
export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("redeem");
  return {
    title: t("metaTitle"),
    description: t("subtitle"),
  };
}

export default async function RedeemPage() {
  const t = await getTranslations("redeem");
  const { platform, pools, totals } = await getRedeemDiscovery(30);
  const feeBps = platform?.feeBps ?? 500;

  return (
    <>
      <Nav />
      <main id="main">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative border-b border-ink/15">
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-12 lg:gap-12 lg:py-20">
            <div className="lg:col-span-7">
              <AccentRule color="sun">
                <MonoLabel>{t("eyebrow")}</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 text-balance font-display text-[clamp(2.25rem,4.8vw,4rem)] leading-[0.96] tracking-tight">
                {t("headline")}
              </h1>
              <p className="mt-4 max-w-prose text-pretty text-base text-ink/65 md:text-[16px]">
                {t("subtitle")}
              </p>

              {/* CTAs — primary (deploy) ink-on-bone, secondary outlined */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/redeem/create"
                  className={cn(
                    "group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-ink px-6 text-bone",
                    "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
                    "shadow-offset-sm transition-all duration-300 ease-atelier",
                    "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  )}
                >
                  <span>{t("ctaDeploy")}</span>
                  <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
                    <ArrowDiag size={12} />
                  </span>
                </Link>
                <Link
                  href="#pools"
                  className={cn(
                    "group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-bone px-6",
                    "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink",
                    "shadow-offset-sm transition-all duration-300 ease-atelier",
                    "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  )}
                >
                  <span>{t("ctaBrowse")}</span>
                  <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-y-[2px]">
                    <ArrowDiag size={12} />
                  </span>
                </Link>
              </div>
            </div>

            {/* Stat strip — right rail. Each stat is a hairline-divided cell. */}
            <div className="relative lg:col-span-5">
              <div className="grid grid-cols-3 divide-x divide-ink/15 border border-ink/15 bg-bone">
                <Stat label={t("statPools")} value={String(totals.poolCount)} />
                <Stat
                  label={t("statReserve")}
                  valueNode={
                    <SuiAmount
                      mist={totals.reserveMist}
                      compact
                      maxFractionDigits={2}
                      glyphSize={11}
                      className="text-[16px] text-ink"
                    />
                  }
                />
                <Stat
                  label={t("statPaidOut")}
                  valueNode={
                    <SuiAmount
                      mist={totals.paidOutMist}
                      compact
                      maxFractionDigits={2}
                      glyphSize={11}
                      className="text-[16px] text-ink"
                    />
                  }
                />
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                <span>{t("statSource")}</span>
                <span>{t("statRevalidate")}</span>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Permanence band ────────────────────────────────────────── */}
        <section className="relative border-b border-ink/15 bg-ink/[0.015]">
          <Container className="flex flex-wrap items-center justify-between gap-4 py-4 md:py-5">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/65">
              <Trait label={t("traitPermanent")} dotClass="bg-sun" />
              <Trait label={t("traitNoReversal")} dotClass="bg-jade" />
              <Trait label={t("traitTwoModes")} dotClass="bg-poppy" />
              <Trait
                label={t("traitFee", {
                  fee: (feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2),
                })}
                dotClass="bg-ink/40"
              />
            </ul>
            <Link
              href="/docs"
              className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
            >
              <span>{t("traitLearn")}</span>
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-[2px]">
                →
              </span>
            </Link>
          </Container>
        </section>

        {/* ── Pool grid ──────────────────────────────────────────────── */}
        <section id="pools" className="relative scroll-mt-20">
          <Container className="py-12 md:py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3 md:mb-10">
              <div>
                <AccentRule color="plum">
                  <MonoLabel>{t("listEyebrow")}</MonoLabel>
                </AccentRule>
                <h2 className="mt-2 text-balance text-[1.75rem] leading-[1.05] md:text-3xl">
                  {t("listTitle")}
                </h2>
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:gap-x-5">
                <li className="inline-flex items-center gap-1.5">
                  <span className="block h-1 w-1 rounded-full bg-sun" />
                  {t("liveCount", { count: pools.length })}
                </li>
                <li className="text-ink/20">·</li>
                <li>{t("sortedNewest")}</li>
              </ul>
            </div>

            <PoolGrid pools={pools} feeBps={feeBps} />
          </Container>
        </section>

        {/* ── How it works (compact 3-up) ───────────────────────────── */}
        <section className="relative border-t border-ink/15">
          <Container className="py-14 md:py-20">
            <div className="mb-10 max-w-2xl">
              <AccentRule color="sun">
                <MonoLabel>{t("howEyebrow")}</MonoLabel>
              </AccentRule>
              <h2 className="mt-3 text-balance text-2xl leading-[1.1] md:text-3xl">
                {t("howTitle")}
              </h2>
            </div>
            <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Step
                num="01"
                title={t("howStep1Title")}
                body={t("howStep1Body")}
                accent="sun"
              />
              <Step
                num="02"
                title={t("howStep2Title")}
                body={t("howStep2Body")}
                accent="poppy"
              />
              <Step
                num="03"
                title={t("howStep3Title")}
                body={t("howStep3Body")}
                accent="jade"
              />
            </ol>
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}

/* ─────────────────────────── Subviews ─────────────────────────── */

function Stat({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[16px] tabular-nums text-ink">
        {valueNode ?? value}
      </div>
    </div>
  );
}

function Trait({
  label,
  dotClass,
}: {
  label: string;
  dotClass: string;
}) {
  return (
    <li className="inline-flex items-center gap-2">
      <span aria-hidden className={cn("block h-1.5 w-1.5", dotClass)} />
      {label}
    </li>
  );
}

type StepAccent = "sun" | "poppy" | "jade";

const STEP_BAR: Record<StepAccent, string> = {
  sun: "bg-sun",
  poppy: "bg-poppy",
  jade: "bg-jade",
};

const STEP_NUM_COLOR: Record<StepAccent, string> = {
  sun: "text-sun",
  poppy: "text-poppy",
  jade: "text-jade",
};

function Step({
  num,
  title,
  body,
  accent,
}: {
  num: string;
  title: string;
  body: string;
  accent: StepAccent;
}) {
  return (
    <li className="relative border border-ink/15 bg-bone p-6 transition-colors duration-300 hover:border-ink/45">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[2px]", STEP_BAR[accent])} />
      <span
        className={cn(
          "block font-mono text-[10px] uppercase tracking-[0.18em]",
          STEP_NUM_COLOR[accent],
        )}
      >
        Step {num}
      </span>
      <h3 className="mt-2 font-display text-[1.4rem] leading-[1.1]">{title}</h3>
      <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-ink/65">
        {body}
      </p>
    </li>
  );
}
