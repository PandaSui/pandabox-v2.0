import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import {
  LiveFanOutTrace,
  AirdropPanel,
  AirdropActivityFeed,
} from "@/components/airdrop";
import {
  getAirdropPlatform,
  listAirdrops,
  getCoinMetadataMap,
} from "@/lib/airdrop/server";
import {
  DEFAULT_FEE_PER_RECIPIENT_MIST,
  DEFAULT_MAX_RECIPIENTS,
} from "@/lib/contracts/airdrop";
import { cn } from "@pandasui/ui/lib";

// The reader behind getAirdropPlatform already caches for 60s. This
// `revalidate` is a Next hint that the prerender is fine for the same
// window — keeps the masthead numbers honest without hammering the
// fullnode.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("airdrop");
  return {
    title: t("metaTitle"),
    description: t("subtitle"),
  };
}

export default async function AirdropPage() {
  const t = await getTranslations("airdrop");
  // Server-fetch the platform state + the recent activity in parallel —
  // both reads share the same Sui client + cache machinery, but neither
  // depends on the other, so we can issue them concurrently.
  const [platform, activity] = await Promise.all([
    getAirdropPlatform(),
    listAirdrops({ limit: 30 }),
  ]);
  // Pull CoinMetadata for every coin type referenced in the activity
  // page so the feed can render "12.40 TURBOS" instead of raw u64. The
  // batcher dedupes + caches per type, so this is cheap on warm reads.
  const activityMetadata = await getCoinMetadataMap(
    activity.items.map((e) => e.coinType),
  );

  // Defensive fallbacks when the reader returns null (RPC hiccup, env
  // misconfigured, etc.). The contract constants are sane defaults so
  // the page still renders; the chrome will surface the live values
  // once the reader recovers.
  const feePerRecipientMist =
    platform?.feePerRecipientMist ?? DEFAULT_FEE_PER_RECIPIENT_MIST;
  const maxRecipients = platform?.maxRecipients ?? DEFAULT_MAX_RECIPIENTS;
  const totalAirdrops = platform?.totalAirdrops ?? 0;
  const paused = platform?.paused ?? false;

  return (
    <>
      <Nav />
      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────────
            Two-column band. Left: copy + accent rule + headline + status
            chip. Right: the FanOutTrace hero. The trace doubles as the
            page's identity moment and as a live preview surface in later
            phases. */}
        <section className="relative border-b border-ink/15">
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-12 lg:gap-12 lg:py-16">
            <div className="lg:col-span-5">
              <AccentRule color="poppy">
                <MonoLabel>{t("eyebrow")}</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 text-balance font-display text-[clamp(2.25rem,4.8vw,3.75rem)] leading-[0.98] tracking-tight">
                {t("headline")}
              </h1>
              <p className="mt-4 max-w-prose text-pretty text-base text-ink/65 md:text-[15.5px]">
                {t("subtitle")}
              </p>

              {/* Status chip — quiet, but explicit. Mirrors the redeem
                  status indicator without the diecut shape. */}
              <div className="mt-6 inline-flex items-center gap-2 border border-ink/20 bg-bone px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/70 shadow-offset-sm">
                <span
                  aria-hidden
                  className={cn(
                    "block h-1.5 w-1.5 rounded-full",
                    paused ? "bg-poppy" : "bg-jade",
                  )}
                />
                {paused
                  ? t("statStatusPaused")
                  : t("statStatusLive")}
              </div>
            </div>

            <div className="lg:col-span-7">
              <LiveFanOutTrace
                totalAirdrops={totalAirdrops}
                maxRecipients={maxRecipients}
                className="aspect-[800/280] w-full"
              />
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                <span>{t("statSource")}</span>
                <span>{t("statRevalidate")}</span>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Live metrics band ────────────────────────────────────────────
            Four hairline-divided cells. Each reads off the live Platform
            state. Sits between the hero and the panel so the eye lands on
            the numbers before it touches the composer. */}
        <section className="relative border-b border-ink/15 bg-ink/[0.015]">
          <Container className="py-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-ink/15 md:grid-cols-4 md:divide-y-0">
              <Stat
                label={t("statFee")}
                valueNode={
                  <SuiAmount
                    mist={feePerRecipientMist}
                    adaptive
                    maxFractionDigits={3}
                    glyphSize={11}
                    className="text-[16px] text-ink"
                  />
                }
              />
              <Stat label={t("statMax")} value={String(maxRecipients)} />
              <Stat
                label={t("statLifetime")}
                value={formatLifetime(totalAirdrops)}
              />
              <Stat
                label={t("statStatus")}
                valueNode={
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 font-mono text-[15px] tabular-nums",
                      paused ? "text-poppy" : "text-jade",
                    )}
                  >
                    <span
                      aria-hidden
                      className="block h-1.5 w-1.5 rounded-full bg-current"
                    />
                    {paused
                      ? t("statStatusPaused")
                      : t("statStatusLive")}
                  </span>
                }
              />
            </div>
          </Container>
        </section>

        {/* ── Trait strip ──────────────────────────────────────────────────
            Mirrors the redeem permanence band, but the traits speak to the
            airdrop guarantees: one signature, atomic, any coin, live fee. */}
        <section className="relative border-b border-ink/15">
          <Container className="flex flex-wrap items-center justify-between gap-4 py-4 md:py-5">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/65">
              <Trait label={t("traitOneSig")} dotClass="bg-poppy" />
              <Trait label={t("traitAtomic")} dotClass="bg-jade" />
              <Trait label={t("traitAnyCoin")} dotClass="bg-sky" />
              <Trait
                label={t("traitFee", {
                  fee: formatMistAsSuiLabel(feePerRecipientMist),
                })}
                dotClass="bg-ink/40"
              />
            </ul>
            <a
              href="/airdrop/docs"
              className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
            >
              <span>{t("traitLearn")}</span>
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-[2px]"
              >
                →
              </span>
            </a>
          </Container>
        </section>

        {/* ── Composer slot ────────────────────────────────────────────────
            The real work surface — currently a placeholder, replaced in
            Phase 5. Sits inside Container so it inherits the same gutter
            as the hero above. */}
        <section className="relative" id="compose">
          <Container className="py-12 md:py-16">
            <AirdropPanel
              platform={platform}
              feePerRecipientMist={feePerRecipientMist}
              maxRecipients={maxRecipients}
              paused={paused}
            />
          </Container>
        </section>

        {/* ── Activity feed ────────────────────────────────────────────────
            Cross-platform recent airdrops, server-fetched and handed to a
            client component that owns the All / Yours tab toggle. Lives
            between the composer and the "how it works" copy so social
            proof + reference both sit above the fold for return users. */}
        <section className="relative border-t border-ink/15 bg-ink/[0.015]">
          <Container className="py-12 md:py-16">
            <AirdropActivityFeed
              items={activity.items}
              metadata={activityMetadata}
              initialCursor={activity.nextCursor}
              initialHasNextPage={activity.hasNextPage}
            />
          </Container>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────
            Three short steps mirroring redeem's pattern but written for
            this tool. Accent rules cycle poppy → jade → sky to echo the
            trait strip above. */}
        <section className="relative border-t border-ink/15">
          <Container className="py-14 md:py-20">
            <div className="mb-10 max-w-2xl">
              <AccentRule color="poppy">
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
                accent="poppy"
              />
              <Step
                num="02"
                title={t("howStep2Title")}
                body={t("howStep2Body")}
                accent="jade"
              />
              <Step
                num="03"
                title={t("howStep3Title")}
                body={t("howStep3Body")}
                accent="sky"
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

function Trait({ label, dotClass }: { label: string; dotClass: string }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span aria-hidden className={cn("block h-1.5 w-1.5", dotClass)} />
      {label}
    </li>
  );
}

type StepAccent = "poppy" | "jade" | "sky";

const STEP_BAR: Record<StepAccent, string> = {
  poppy: "bg-poppy",
  jade: "bg-jade",
  sky: "bg-sky",
};

const STEP_NUM_COLOR: Record<StepAccent, string> = {
  poppy: "text-poppy",
  jade: "text-jade",
  sky: "text-sky",
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
      <span
        aria-hidden
        className={cn("absolute inset-x-0 top-0 h-[2px]", STEP_BAR[accent])}
      />
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

/* ─────────────────────────── helpers ─────────────────────────── */

function formatLifetime(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatMistAsSuiLabel(mist: bigint): string {
  if (mist === 0n) return "0";
  const ONE_SUI = 1_000_000_000n;
  const sui = Number(mist) / Number(ONE_SUI);
  if (sui >= 1) return sui.toFixed(2);
  if (sui >= 0.001) return sui.toFixed(3);
  return sui.toFixed(6);
}
