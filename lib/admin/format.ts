/**
 * Shared numeric/address formatters for the operator console. Mono,
 * spreadsheet-grade output (§5.8). Used by every protocol panel so a SUI
 * amount reads identically whether it's a Pandabox fee or a Redeem reserve.
 */

/** Largest fee a contract will accept, in basis points (= 100%). */
export const MAX_FEE_BPS = 10_000;

/** Mist per 1 SUI. */
export const MIST_PER_SUI = 1_000_000_000n;

/** Basis points → percent string with 2 decimals (250 → "2.50"). */
export function formatBps(bps: number): string {
  return (bps / 100).toFixed(2);
}

/** Mist → compact SUI string (K/M suffixed for large values). */
export function formatSui(mist: bigint): string {
  const n = Number(mist) / 1e9;
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(4);
  if (n === 0) return "0";
  return n.toFixed(6);
}

/** Coarse relative time for "last read" footers. */
export function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

/** Mid-truncate a long string (address) to `12…6` for tight contexts. */
export function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

/** Cap a bigint at `max`. */
export function clampBig(v: bigint, max: bigint): bigint {
  return v > max ? max : v;
}
