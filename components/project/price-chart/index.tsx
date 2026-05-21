"use client";

import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import type { HydratedProject } from "@/lib/projects";
import { ChartFrame, type Timeframe, type ViewStyle } from "./chart-frame";
import { PlaceholderChart } from "./placeholder-chart";
import { LiveCanvas } from "./live-canvas";
import { useChartData } from "./use-chart-data";
import {
  changeOverWindow,
  formatDelta,
  formatPrice,
  formatTimeFull,
} from "./format";

/**
 * Top-level price-chart section for the project detail page.
 *
 * Three states share the same `<ChartFrame>` so the section never reflows:
 *
 *   - !liquiditySeeded             → placeholder, phase `awaiting-seed`
 *   - state === 'no-trades'        → placeholder, phase `awaiting-trade`
 *   - state === 'live'             → <LiveCanvas> (Area or Candles)
 *
 * Timeframe and view-style live in localStorage so the chart remembers a
 * user's preference across navigations. The owner-only "Seed Cetus pool"
 * CTA on the placeholder reads the connected wallet and compares to
 * `project.creator` — it's informational only; the actual seed entry fn
 * gates on holding the ProjectAdminCap.
 */
export function PriceChart({ project }: { project: HydratedProject }) {
  const account = useCurrentAccount();
  const isOwner = Boolean(
    account?.address &&
      project.creator &&
      account.address.toLowerCase() === project.creator.toLowerCase(),
  );

  const ticker = resolveTicker(project);

  const [timeframe, setTimeframe] = usePersistedState<Timeframe>(
    "pandabox:chart:timeframe",
    "1h",
    isTimeframe,
  );
  const [viewStyle, setViewStyle] = usePersistedState<ViewStyle>(
    "pandabox:chart:view",
    "area",
    isViewStyle,
  );

  // GeckoTerminal is keyed on pool address — we can only fetch once the
  // creator has paired liquidity and pinned the pool ID. Pre-seed projects
  // never hit the network; they render the placeholder instead.
  const { candles, state, fetchedAt, error } = useChartData({
    poolId: project.poolId,
    timeframe,
    enabled: project.liquiditySeeded && Boolean(project.poolId),
  });

  const phase: "awaiting-seed" | "awaiting-trade" = project.liquiditySeeded
    ? "awaiting-trade"
    : "awaiting-seed";

  const showLive = project.liquiditySeeded && state === "live" && candles.length > 0;
  const lastPrice = showLive ? candles[candles.length - 1].c : null;
  const delta = showLive ? changeOverWindow(candles) : null;

  return (
    <ChartFrame
      ticker={ticker}
      timeframe={timeframe}
      onTimeframe={setTimeframe}
      viewStyle={viewStyle}
      onViewStyle={setViewStyle}
      priceLabel={
        lastPrice != null ? (
          formatPrice(lastPrice)
        ) : (
          <span className="text-ink/35">—</span>
        )
      }
      deltaLabel={
        delta ? (
          formatDelta(delta.pct)
        ) : (
          <span className="text-ink/35">—</span>
        )
      }
      deltaTone={delta?.direction === "up" ? "up" : delta?.direction === "down" ? "down" : "muted"}
      poolLabel={
        project.liquiditySeeded ? (
          <PoolLink poolId={project.poolId} dex={project.dex} />
        ) : (
          <span className="text-ink/55">no pool yet</span>
        )
      }
      updatedLabel={<UpdatedLabel state={state} phase={phase} fetchedAt={fetchedAt} error={error} />}
    >
      {showLive ? (
        <LiveCanvas
          candles={candles}
          timeframe={timeframe}
          viewStyle={viewStyle}
        />
      ) : (
        <PlaceholderChart
          phase={phase}
          ticker={ticker}
          isOwner={isOwner}
          seedHref={isOwner ? "/dashboard" : undefined}
        />
      )}
    </ChartFrame>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function UpdatedLabel({
  state,
  phase,
  fetchedAt,
  error,
}: {
  state: "live" | "no-trades";
  phase: "awaiting-seed" | "awaiting-trade";
  fetchedAt: number | null;
  error: string | null;
}) {
  if (error) return <span className="text-poppy">source offline</span>;
  if (phase === "awaiting-seed") return <>—</>;
  if (state === "no-trades") return <>waiting for first trade</>;
  if (!fetchedAt) return <>—</>;
  return <>updated {formatTimeFull(fetchedAt)}</>;
}

function resolveTicker(p: HydratedProject): string {
  const fromDetails = p.details?.ticker?.trim();
  if (fromDetails) return fromDetails;
  if (!p.tokenType) return "TOK";
  const segments = p.tokenType.split("::");
  return (segments[segments.length - 1] ?? "TOK").toUpperCase();
}

function PoolLink({
  poolId,
  dex,
}: {
  poolId?: string;
  dex?: "cetus";
}) {
  if (!poolId) return <span className="text-ink/55">pending</span>;
  const label = `${poolId.slice(0, 6)}…${poolId.slice(-4)}`;
  if (dex === "cetus") {
    return (
      <a
        href={`https://app.cetus.zone/liquidity/deposit?poolAddress=${poolId}`}
        target="_blank"
        rel="noreferrer"
        className="text-ink/65 underline-offset-2 hover:underline"
      >
        {label}
      </a>
    );
  }
  return <span className="text-ink/65">{label}</span>;
}

/**
 * useState-shaped hook that persists to localStorage. Reads on mount via an
 * effect (not lazy init) so SSR and the first client render see the same
 * value — avoids hydration mismatch warnings. A bad value in storage falls
 * back silently to the default.
 */
function usePersistedState<T extends string>(
  key: string,
  initial: T,
  validate: (v: string) => v is T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw && validate(raw)) setValue(raw);
    } catch {
      // localStorage can throw in private modes — silently fall through.
    }
  }, [key, validate]);

  const set = (v: T) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {
      // ignore
    }
  };

  return [value, set];
}

function isTimeframe(v: string): v is Timeframe {
  return v === "5m" || v === "1h" || v === "4h" || v === "1D" || v === "1W";
}

function isViewStyle(v: string): v is ViewStyle {
  return v === "area" || v === "candles";
}
