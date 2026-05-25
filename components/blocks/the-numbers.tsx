import { getTranslations } from "next-intl/server";
import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SplitFlapCounter } from "@/components/data";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { RelativeTime } from "@/components/identity/relative-time";
import { getOnchainAggregate, type OnChainAggregate } from "@/lib/stats";

export async function TheNumbers() {
  const agg = await getOnchainAggregate();
  const t = await getTranslations("home.theNumbers");

  return (
    <section className="border-t border-ink/15 bg-paper/40">
      <Container className="py-20 lg:py-24">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <AccentRule color="saffron" className="mb-3">
              <MonoLabel>{t("eyebrow")}</MonoLabel>
            </AccentRule>
            <h2 className="text-3xl md:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-3 max-w-prose text-base text-ink/60">
              {t("subtitle")}
            </p>
          </div>
          <LiveBadge updatedMs={agg.computedAtMs} liveLabel={t("liveLabel")} />
        </header>

        <div className="grid grid-cols-1 border border-ink bg-bone shadow-offset-sm md:grid-cols-2 lg:grid-cols-5">
          <HeroCell agg={agg} t={t} />
          <ActiveCell agg={agg} t={t} />
          <BackersCell agg={agg} t={t} />
          <LatestCell agg={agg} t={t} />
        </div>

        {/* Technical footnote — the "real builders" tell */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
          <span>
            {t("sourceFootnote")}
          </span>
          <span>
            {t("computedAt")}{" "}
            <span className="text-ink/60">
              {new Date(agg.computedAtMs)
                .toISOString()
                .replace("T", " ")
                .slice(0, 16)}{" "}
              UTC
            </span>
          </span>
        </div>
      </Container>
    </section>
  );
}

/* ─────────────────────────── Cells ─────────────────────────── */

// Translation function shape returned by next-intl's getTranslations. We pass
// it down so each server-rendered cell can pull its own labels without re-
// awaiting getTranslations per cell.
type TFn = (key: string, values?: Record<string, string | number>) => string;

function HeroCell({ agg, t }: { agg: OnChainAggregate; t: TFn }) {
  const raisedSui = Number(agg.totalRaisedMist) / 1e9;
  const raised24Sui = Number(agg.raised24hMist) / 1e9;

  return (
    <div className="relative border-b border-ink/15 bg-saffron/[0.05] p-6 md:col-span-2 md:border-b-0 md:border-r lg:col-span-2 lg:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span
              className="block h-1.5 w-1.5 rounded-full bg-saffron"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            <MonoLabel className="text-[10px]">{t("totalRaised")}</MonoLabel>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            {t("totalRaisedHint")}
          </p>
        </div>
        <DeltaPill
          label={t("delta24h")}
          value={raised24Sui > 0 ? `+${raised24Sui.toFixed(2)}` : "0.00"}
          unit="SUI"
        />
      </div>

      <div className="mt-6 flex items-baseline gap-3">
        <SuiGlyph size={26} className="text-ink/55" />
        <span className="font-mono text-5xl leading-none tabular-nums text-ink md:text-6xl">
          {formatSuiCompact(raisedSui)}
        </span>
        <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/40">
          SUI
        </span>
      </div>

      <Sparkline data={agg.hourlyBuckets} />

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-ink/15 pt-4">
        <SubStat
          label={t("substat.across")}
          value={
            <>
              <SplitFlapCounter
                value={agg.totalProjects}
                className="text-lg"
                grouping={false}
              />
              <span className="ml-1 text-ink/50">{t("substat.projects")}</span>
            </>
          }
        />
        <SubStat
          label={t("substat.tokensMinted")}
          value={formatToken(agg.totalTokensMintedRaw)}
        />
        <SubStat
          label={t("substat.platformFees")}
          value={`${formatSuiCompact(Number(agg.totalFeesMist) / 1e9)} SUI`}
        />
        <SubStat
          label={t("substat.feeRate")}
          value={`${(agg.feeBps / 100).toFixed(2)}%`}
        />
      </div>
    </div>
  );
}

function ActiveCell({ agg, t }: { agg: OnChainAggregate; t: TFn }) {
  const total = agg.activeProjects + agg.closedProjects;
  const safeTotal = total || 1;
  const liveRatio = agg.activeProjects / safeTotal;
  return (
    <Cell label={t("activeProjects")} border>
      <div className="mt-3 flex items-baseline gap-2">
        <SplitFlapCounter
          value={agg.activeProjects}
          className="text-4xl"
          grouping={false}
        />
        <span className="font-mono text-sm tabular-nums text-ink/35">
          / {agg.totalProjects}
        </span>
      </div>

      <div className="mt-4 flex h-[4px] overflow-hidden">
        <div
          className="bg-jade transition-[width] duration-500"
          style={{ width: `${liveRatio * 100}%` }}
          aria-hidden
        />
        <div
          className="flex-1 bg-plum/40"
          aria-hidden
          style={{ width: `${(1 - liveRatio) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
        <span>
          <span className="text-jade">●</span>{" "}
          {t("liveCount", { count: agg.activeProjects })}
        </span>
        <span>
          {t("closedCount", { count: agg.closedProjects })}{" "}
          <span className="text-plum/60">●</span>
        </span>
      </div>

      <Footer>{t("deployedAllTime")}</Footer>
    </Cell>
  );
}

function BackersCell({ agg, t }: { agg: OnChainAggregate; t: TFn }) {
  const perBacker =
    agg.uniqueBackers > 0
      ? (agg.contributionCount / agg.uniqueBackers).toFixed(2)
      : "—";
  return (
    <Cell label={t("uniqueBackers")} border>
      <div className="mt-3 flex items-baseline gap-2">
        <SplitFlapCounter
          value={agg.uniqueBackers}
          className="text-4xl"
          grouping={false}
        />
        <span className="font-mono text-sm tabular-nums text-ink/35">
          {t("addr")}
        </span>
      </div>

      <DotGrid count={agg.uniqueBackers} max={25} t={t} />

      <Footer>
        <span className="font-mono tabular-nums text-ink/70">{perBacker}</span>{" "}
        {t("contribsPerBacker")}
      </Footer>
    </Cell>
  );
}

function LatestCell({ agg, t }: { agg: OnChainAggregate; t: TFn }) {
  const largestSui = Number(agg.largestContributionMist) / 1e9;
  return (
    <Cell label={t("latestActivity")} border>
      <div className="mt-3 flex items-center gap-2">
        <span className="relative inline-flex h-2 w-2">
          <span
            className="absolute inset-0 rounded-full bg-saffron"
            style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
          />
          <span
            className="absolute inset-0 rounded-full bg-saffron opacity-40"
            style={{ animation: "stat-ping 2.4s ease-out infinite" }}
          />
        </span>
        {agg.latestContributionMs ? (
          <RelativeTime
            value={agg.latestContributionMs}
            className="text-2xl text-ink md:text-3xl"
            intervalMs={30_000}
          />
        ) : (
          <span className="font-mono text-2xl text-ink/30">—</span>
        )}
      </div>

      <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
        {t("lastContribution")}
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-ink/15 pt-3 font-mono text-[11px] text-ink/55">
        <span className="uppercase tracking-[0.14em] text-ink/40">
          {t("largest")}
        </span>
        <span className="inline-flex items-baseline gap-1 tabular-nums text-ink">
          <SuiGlyph size={10} className="text-ink/55" />
          {formatSuiCompact(largestSui)}
          <span className="text-[9px] uppercase tracking-[0.14em] text-ink/40">
            SUI
          </span>
        </span>
      </div>

      <Footer>{t("paymentsWindow", { count: agg.contributionCount24h })}</Footer>
    </Cell>
  );
}

/* ─────────────────────────── Primitives ─────────────────────────── */

function Cell({
  label,
  children,
  border = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  border?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col p-6 lg:p-7",
        border &&
          "border-b border-ink/15 md:border-b md:border-r-0 lg:border-b-0 lg:border-l lg:border-r-0",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="block h-1.5 w-1.5 rounded-full bg-ink/30"
          aria-hidden
        />
        <MonoLabel className="text-[10px]">{label}</MonoLabel>
      </div>
      <div className="mt-1 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
      {children}
    </div>
  );
}

function SubStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <MonoLabel className="block text-[9px]">{label}</MonoLabel>
      <div className="mt-1 flex items-baseline font-mono text-base tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

function DeltaPill({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 border border-ink/20 bg-bone/85 px-2.5 py-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
        {label}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-ink">
        {value}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
        {unit}
      </span>
    </span>
  );
}

function LiveBadge({
  updatedMs,
  liveLabel,
}: {
  updatedMs: number;
  liveLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 border border-ink bg-bone px-3 py-1.5 shadow-offset-sm">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span
          className="absolute inset-0 rounded-full bg-jade"
          style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
        />
        <span
          className="absolute inset-0 rounded-full bg-jade/40 blur-[2px]"
        />
      </span>
      <MonoLabel className="text-[10px]">{liveLabel}</MonoLabel>
      <span className="h-3 w-px bg-ink/15" aria-hidden />
      <span className="font-mono text-[10px] tabular-nums text-ink/60">
        <RelativeTime value={updatedMs} intervalMs={15_000} />
      </span>
    </span>
  );
}

/* ─────────────────────────── Mini-viz ─────────────────────────── */

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const barW = 0.7;
  const gap = (1 - barW) / 2;
  return (
    <svg
      width="100%"
      height="44"
      viewBox={`0 0 ${data.length} 44`}
      preserveAspectRatio="none"
      className="mt-5 block"
      aria-hidden
    >
      <line
        x1="0"
        x2={data.length}
        y1="44"
        y2="44"
        stroke="rgba(22,19,16,0.18)"
        strokeWidth="0.04"
      />
      {data.map((v, i) => {
        const h = Math.max(1, (v / max) * 40);
        return (
          <rect
            key={i}
            x={i + gap}
            y={44 - h}
            width={barW}
            height={h}
            fill="#B8C45E"
            opacity={0.35 + (i / data.length) * 0.55}
          />
        );
      })}
      {/* Latest-bar accent line */}
      <line
        x1={data.length - 0.5}
        x2={data.length - 0.5}
        y1="0"
        y2="44"
        stroke="#161310"
        strokeWidth="0.05"
        opacity="0.25"
      />
    </svg>
  );
}

function DotGrid({
  count,
  max = 25,
  t,
}: {
  count: number;
  max?: number;
  t: TFn;
}) {
  const filled = Math.min(max, count);
  return (
    <div className="mt-4">
      <div className="grid w-fit grid-cols-5 gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              i < filled ? "bg-jade" : "bg-ink/10",
            )}
          />
        ))}
      </div>
      {count > max && (
        <span className="mt-2 inline-block font-mono text-[10px] text-ink/45">
          {t("moreOverflow", { count: count - max })}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function formatSuiCompact(sui: number): string {
  if (!isFinite(sui)) return "—";
  if (sui >= 1_000_000) return (sui / 1e6).toFixed(2) + "M";
  if (sui >= 1_000) return (sui / 1e3).toFixed(2) + "K";
  if (sui >= 1) return sui.toFixed(2);
  if (sui === 0) return "0.00";
  return sui.toFixed(2);
}

function formatToken(raw: bigint, decimals = 9): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(1) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}
