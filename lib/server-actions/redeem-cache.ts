"use server";

import { updateTag } from "next/cache";

/**
 * Bust the `unstable_cache` data cache for redeem pool state so a freshly
 * mutated pool surfaces correctly on the next read.
 *
 * The `getRedeemPool` reader (`lib/redeem/reader.ts`) wraps fullnode reads
 * in `unstable_cache({ revalidate: 30, tags: ["redeem-pool"] })`. Without
 * an explicit tag bust, a `router.refresh()` after a deposit / redeem only
 * re-renders the RSC tree — the cached pool snapshot still has the
 * pre-transaction reserve, so the hero stat strip looks unchanged until
 * the 30s revalidate window naturally elapses.
 *
 * `updateTag` (Next 16) marks the tag dirty with read-your-own-writes
 * semantics — the next read on any consumer fetches live chain state.
 * Call this from the client immediately after `signAndExecute` settles,
 * before kicking off `router.refresh()`.
 */
export async function bustRedeemPoolCache(): Promise<void> {
  updateTag("redeem-pool");
}
