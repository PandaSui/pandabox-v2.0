"use client";

import { useEffect, useState } from "react";
import { cn } from "@pandasui/ui/lib";

/**
 * 24h price sparkline that lives in the corner of an owned card once the
 * creator has paired liquidity on Cetus. Fetches the same `/api/chart`
 * proxy the full project chart uses — server-side this hits GeckoTerminal,
 * client-side it's a single small JSON over the edge cache, so dropping a
 * sparkline on every seeded card costs almost nothing.
 *
 * Three states, all reusing the same width so the card layout never
 * shifts:
 *
 *   - loading       — bone background, a single hairline baseline
 *   - no-trades     — flat hairline (pool exists but GT hasn't indexed
 *                     any trades yet)
 *   - live          — ink stroke + saffron fill area chart + signed delta
 *
 * Deliberately uses a raw SVG instead of Recharts — Recharts pulls in
 * ~80kb and we're rendering ≤24 points in a 76×24px box. Hand-rolled is
 * smaller, faster, and the line drawing is trivial.
 */

type Point = { t: number; c: number };

type State =
  | { kind: "loading" }
  | { kind: "live"; points: Point[]; deltaPct: number }
  | { kind: "no-trades" }
  | { kind: "error" };

export function MiniSparkline({
  poolId,
  width = 76,
  height = 24,
}: {
  poolId: string;
  width?: number;
  height?: number;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    fetch(`/api/chart/${encodeURIComponent(poolId)}?tf=1h&limit=24`, {
      signal: ctrl.signal,
      // Hit the route's edge cache rather than no-store; 30s freshness is
      // plenty for a 24h sparkline.
      cache: "default",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then(
        (json: {
          state: "live" | "no-trades";
          candles: Array<{ t: number; c: number }>;
        }) => {
          if (cancelled) return;
          if (json.state !== "live" || json.candles.length < 2) {
            setState({ kind: "no-trades" });
            return;
          }
          const points = json.candles.map((k) => ({ t: k.t, c: k.c }));
          const first = points[0].c;
          const last = points[points.length - 1].c;
          const deltaPct = first > 0 ? ((last - first) / first) * 100 : 0;
          setState({ kind: "live", points, deltaPct });
        },
      )
      .catch((err) => {
        if (cancelled || ctrl.signal.aborted) return;
        // Silent failure — a missing sparkline shouldn't break the card.
        console.warn("[mini-sparkline] fetch failed", err);
        setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [poolId]);

  if (state.kind === "error") return null;

  return (
    <div className="inline-flex items-center gap-2 shrink-0">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        className="overflow-visible"
      >
        {/* Hairline baseline — present in every state for a stable look. */}
        <line
          x1="0"
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke="#161310"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
        {state.kind === "loading" && (
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="#161310"
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="2 3"
            className="animate-pulse"
          />
        )}
        {state.kind === "live" && (
          <Path points={state.points} width={width} height={height} />
        )}
      </svg>
      <span
        className={cn(
          "font-mono tabular-nums text-[10px]",
          state.kind === "live"
            ? state.deltaPct > 0
              ? "text-jade"
              : state.deltaPct < 0
                ? "text-poppy"
                : "text-ink/50"
            : "text-ink/30",
        )}
      >
        {state.kind === "live" ? formatDelta(state.deltaPct) : "24h"}
      </span>
    </div>
  );
}

function Path({
  points,
  width,
  height,
}: {
  points: Point[];
  width: number;
  height: number;
}) {
  if (points.length < 2) return null;
  // Normalize closes into a path. Y inverted because SVG origin is top-left.
  const closes = points.map((p) => p.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const last = points.length - 1;
  const sx = (i: number) => (i / last) * width;
  const sy = (v: number) => height - 2 - ((v - min) / range) * (height - 4);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(i).toFixed(2)} ${sy(p.c).toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <>
      <path
        d={areaPath}
        fill="#B8C45E"
        fillOpacity="0.22"
      />
      <path
        d={linePath}
        fill="none"
        stroke="#161310"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </>
  );
}

function formatDelta(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
