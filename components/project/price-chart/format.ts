import type { Timeframe } from "./chart-frame";

/**
 * Price formatter tuned for the long tail of token prices on Sui. Newly
 * launched coins routinely trade at sub-cent prices, so we adapt precision
 * to the magnitude rather than picking a single fixed decimal count.
 *
 *   >= 1        →  1,234.56
 *   >= 0.01     →  0.1234
 *   >= 0.0001   →  0.001234
 *   < 0.0001    →  scientific notation (e.g. 1.23e-7)
 */
export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1000) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  if (abs >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

/** Short-form axis tick. Days/hours collapse based on the active timeframe. */
export function formatTimeShort(ms: number, timeframe: Timeframe): string {
  const d = new Date(ms);
  if (timeframe === "5m" || timeframe === "1h") {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (timeframe === "4h") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Long-form tooltip timestamp — always shows date + UTC-ish time. */
export function formatTimeFull(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Signed percentage with two decimals: `+2.41%` / `-0.83%`. */
export function formatDelta(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Percentage change between the most-recent close and the first close in
 * the visible window. Returns null when we can't compute it (≤1 candle).
 */
export function changeOverWindow(
  candles: Array<{ c: number }>,
): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (candles.length < 2) return null;
  const first = candles[0].c;
  const last = candles[candles.length - 1].c;
  if (!first || !Number.isFinite(first)) return null;
  const pct = ((last - first) / first) * 100;
  if (!Number.isFinite(pct)) return null;
  const direction = pct > 0.001 ? "up" : pct < -0.001 ? "down" : "flat";
  return { pct, direction };
}
