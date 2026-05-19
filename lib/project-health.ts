/**
 * Sanity check for project parameters stored on-chain.
 *
 * `base_rate` and `funding_allocation` are stored as u64s pre-scaled to
 * `PROJECT_COIN_DECIMALS` (9). Old testnet projects were deployed before
 * the wizard applied that scaling, so they hold raw human numbers like
 * `1000` instead of `1000 * 1e9`. That breaks every downstream calculation
 * (target SUI, displayed rate, holders, etc.) and there's no on-chain way
 * to repair them.
 *
 * `hasValidParams` lets every surface flag those projects with a
 * `LEGACY · BAD PARAMS` badge instead of silently rendering nonsense.
 */

/**
 * Any base_rate below this threshold (= 0.001 tokens per SUI after scaling)
 * means the value was never multiplied by 1e9. Real projects always scale,
 * so anything in this range is legacy/broken data.
 */
const MIN_SCALED_BASE_RATE = 1_000_000n;

export function hasValidParams(project: {
  baseRate: bigint | string | number;
}): boolean {
  try {
    const r = BigInt(project.baseRate ?? 0);
    return r >= MIN_SCALED_BASE_RATE;
  } catch {
    return false;
  }
}
