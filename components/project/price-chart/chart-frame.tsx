"use client";

import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";

/**
 * Shared frame for both the placeholder and the live price chart. Owns the
 * layout, header (eyebrow + price + delta + view toggle + timeframe pills),
 * canvas slot, and footer (source + pool + last update). Reusing the frame
 * across states means the section never shifts height when liquidity flips
 * on or a first candle lands — only the canvas swaps.
 */

export type Timeframe = "5m" | "1h" | "4h" | "1D" | "1W";
export const TIMEFRAMES: readonly Timeframe[] = ["5m", "1h", "4h", "1D", "1W"];

export type ViewStyle = "area" | "candles";
export const VIEW_STYLES: readonly ViewStyle[] = ["area", "candles"];

export function ChartFrame({
  ticker,
  timeframe,
  onTimeframe,
  viewStyle,
  onViewStyle,
  priceLabel,
  deltaLabel,
  deltaTone = "muted",
  poolLabel,
  updatedLabel,
  children,
}: {
  ticker: string;
  timeframe: Timeframe;
  onTimeframe?: (t: Timeframe) => void;
  viewStyle: ViewStyle;
  onViewStyle?: (v: ViewStyle) => void;
  /** Big mono price string, or "—" when no data. */
  priceLabel: React.ReactNode;
  /** "+2.4%" or "—" — formatted by the caller. */
  deltaLabel: React.ReactNode;
  deltaTone?: "up" | "down" | "muted";
  /** Right-rail footer pool descriptor — "no pool yet" or a linked id. */
  poolLabel: React.ReactNode;
  /** Right-rail footer "updated" descriptor. */
  updatedLabel: React.ReactNode;
  children: React.ReactNode;
}) {
  const deltaClass =
    deltaTone === "up"
      ? "text-jade"
      : deltaTone === "down"
        ? "text-poppy"
        : "text-ink/45";

  return (
    <section className="border-t border-b border-ink/15 bg-bone">
      <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-8 md:py-8">
        {/* ── Header row ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <MonoLabel className="text-[10px]">
              Price · {ticker}/SUI
            </MonoLabel>
            <div className="font-mono tabular-nums text-2xl text-ink">
              {priceLabel}
            </div>
            <div className={cn("font-mono tabular-nums text-sm", deltaClass)}>
              {deltaLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View-style toggle */}
            <div className="flex items-center gap-1 border border-ink/15 bg-bone p-[3px]">
              {VIEW_STYLES.map((v) => {
                const active = v === viewStyle;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onViewStyle?.(v)}
                    disabled={!onViewStyle}
                    aria-pressed={active}
                    className={cn(
                      "h-7 px-3 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors",
                      active
                        ? "bg-ink text-bone"
                        : "text-ink/55 hover:text-ink disabled:hover:text-ink/55",
                    )}
                  >
                    {v === "area" ? "Area" : "Candles"}
                  </button>
                );
              })}
            </div>

            {/* Timeframe pills */}
            <div className="flex items-center gap-1 border border-ink/15 bg-bone p-[3px]">
              {TIMEFRAMES.map((t) => {
                const active = t === timeframe;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTimeframe?.(t)}
                    disabled={!onTimeframe}
                    aria-pressed={active}
                    className={cn(
                      "h-7 px-3 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors",
                      active
                        ? "bg-ink text-bone"
                        : "text-ink/55 hover:text-ink disabled:hover:text-ink/55",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Canvas slot ────────────────────────────────────────── */}
        <div className="relative mt-5 h-[320px] w-full overflow-hidden border border-ink/12 bg-bone md:h-[380px]">
          {children}
        </div>

        {/* ── Footer row ─────────────────────────────────────────── */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="block h-1 w-1 rounded-full bg-saffron" />
            source · geckoterminal
          </span>
          <span className="inline-flex items-center gap-2">
            pool · {poolLabel}
          </span>
          <span>{updatedLabel}</span>
        </div>
      </div>
    </section>
  );
}
