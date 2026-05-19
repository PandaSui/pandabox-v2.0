/**
 * Project parameter sanity check.
 *
 * The Move contract uses `tokens_raw = mist × base_rate`, so `base_rate` is
 * "raw token units per mist of SUI" and any positive value is technically
 * valid. There's no scaling-based heuristic we can apply to flag broken
 * projects from the frontend — `hasValidParams` therefore returns `true`
 * for any project with a non-zero `base_rate` and `funding_allocation`.
 *
 * Kept as a single entry point so we can re-introduce broader health checks
 * later (e.g. mismatched coin metadata, blocked creators) without touching
 * every consumer surface.
 */

export function hasValidParams(project: {
  baseRate: bigint | string | number;
  fundingAllocation?: bigint | string | number;
}): boolean {
  try {
    const r = BigInt(project.baseRate ?? 0);
    const a = BigInt(project.fundingAllocation ?? 0);
    return r > 0n && a > 0n;
  } catch {
    return false;
  }
}
