"use client";

import { useMemo } from "react";
import Link from "next/link";

/**
 * Placeholder chart canvas. Two phases share this view:
 *
 *   1. `awaiting-seed` — no Cetus pool exists yet. Default for every project
 *      until the creator runs the seed-liquidity Move call.
 *   2. `awaiting-trade` — pool was seeded but GeckoTerminal hasn't
 *      observed a trade yet (or hasn't indexed the pool). Same visual;
 *      copy differs.
 *
 * Deliberately deterministic: ghost candles are computed from a seeded
 * pseudo-random so the placeholder doesn't jitter between renders or
 * across SSR/CSR. The chart frame above us controls the canvas size, so we
 * fill 100% and let the parent decide height.
 */

type Phase = "awaiting-seed" | "awaiting-trade";

export function PlaceholderChart({
  phase,
  ticker,
  isOwner,
  seedHref,
}: {
  phase: Phase;
  ticker: string;
  isOwner: boolean;
  /** Where the owner-only CTA points. Hidden when undefined or non-owner. */
  seedHref?: string;
}) {
  const ghosts = useMemo(() => buildGhostCandles(48, ticker), [ticker]);

  const headline =
    phase === "awaiting-seed" ? "Awaiting liquidity" : "Awaiting first trade";

  const body =
    phase === "awaiting-seed"
      ? isOwner
        ? `Pair SUI/${ticker} on Cetus to open the chart. Trading begins the moment your pool sees its first swap.`
        : `Trading opens once the creator pairs SUI/${ticker} on Cetus. The chart will go live on the first swap.`
      : isOwner
        ? `Your Cetus pool is live. The chart will populate the moment a swap settles.`
        : `Cetus pool is live for ${ticker}. The chart will populate the moment a swap settles.`;

  return (
    <div className="relative h-full w-full">
      {/* ── Ghost candles ──────────────────────────────────────── */}
      <svg
        viewBox="0 0 480 240"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Hairline gridlines */}
        <line
          x1="0"
          y1="60"
          x2="480"
          y2="60"
          stroke="#161310"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="120"
          x2="480"
          y2="120"
          stroke="#161310"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="180"
          x2="480"
          y2="180"
          stroke="#161310"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
        {/* Baseline */}
        <line
          x1="0"
          y1="239"
          x2="480"
          y2="239"
          stroke="#161310"
          strokeOpacity="0.18"
          strokeWidth="1"
        />

        {/* Ghost candles drawn faint plum */}
        {ghosts.map((g, i) => (
          <g key={i} opacity="0.12">
            {/* wick */}
            <line
              x1={g.x}
              y1={g.high}
              x2={g.x}
              y2={g.low}
              stroke="#7E685E"
              strokeWidth="1"
            />
            {/* body */}
            <rect
              x={g.x - 2.4}
              y={Math.min(g.open, g.close)}
              width="4.8"
              height={Math.max(1.5, Math.abs(g.close - g.open))}
              fill="#7E685E"
            />
          </g>
        ))}
      </svg>

      {/* ── Centered overlay ───────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="flex max-w-[44ch] flex-col items-center text-center">
          {/* Diecut pulse pip */}
          <div className="relative">
            <span
              aria-hidden
              className="absolute -inset-2 animate-ping rounded-full bg-saffron/30"
            />
            <span
              aria-hidden
              className="relative block h-3 w-3 rotate-45 border border-ink bg-saffron"
            />
          </div>

          <h3 className="mt-5 font-display text-2xl leading-tight tracking-tight text-ink md:text-3xl">
            {headline}
          </h3>

          <p className="mt-3 text-[14px] leading-relaxed text-ink/70">
            {body}
          </p>

          {isOwner && seedHref && phase === "awaiting-seed" && (
            <Link
              href={seedHref}
              className="mt-5 inline-flex h-10 items-center gap-2 border border-ink bg-saffron px-5 font-sans text-[12px] font-medium uppercase tracking-[0.12em] text-ink shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
            >
              <span>Seed Cetus pool</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </Link>
          )}

          {phase === "awaiting-trade" && (
            <span className="mt-5 inline-flex items-center gap-2 border border-ink/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-jade opacity-60" />
                <span className="relative block h-1.5 w-1.5 rounded-full bg-jade" />
              </span>
              Pool live · listening
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Ghost candle data ─────────────────────────── */

type Ghost = {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
};

/**
 * Seeded LCG so the same ticker always renders the same ghost pattern —
 * avoids SSR/CSR hydration jitter and gives each token a faint personality.
 */
function buildGhostCandles(count: number, seed: string): Ghost[] {
  const rng = seededRandom(seed);
  const minY = 40;
  const maxY = 200;
  const baseline = 130;
  const ghosts: Ghost[] = [];
  let lastClose = baseline;

  for (let i = 0; i < count; i++) {
    const x = 12 + (i * (480 - 24)) / Math.max(1, count - 1);
    const drift = (rng() - 0.5) * 18;
    const open = lastClose;
    const close = clamp(open + drift, minY, maxY);
    const wickHigh = clamp(Math.min(open, close) - rng() * 10, minY, maxY);
    const wickLow = clamp(Math.max(open, close) + rng() * 10, minY, maxY);
    ghosts.push({
      x,
      open,
      close,
      high: wickHigh,
      low: wickLow,
    });
    lastClose = close;
  }
  return ghosts;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
