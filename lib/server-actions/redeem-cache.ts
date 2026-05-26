"use server";

import { revalidatePath, updateTag } from "next/cache";

/**
 * Bust every cache layer that holds redeem pool state so a freshly
 * mutated pool surfaces correctly on the next read.
 *
 * Two layers — both required, neither sufficient alone:
 *
 *   1. **Data cache** (`unstable_cache` tagged `"redeem-pool"`). The
 *      `getRedeemPool` reader (`lib/redeem/reader.ts`) wraps fullnode
 *      reads with `{ revalidate: 30, tags: ["redeem-pool"] }`. Without a
 *      tag bust, the next read returns the cached pre-tx snapshot for
 *      up to 30s. `updateTag` (Next 16) marks the tag dirty with
 *      read-your-own-writes semantics so the next reader sees fresh
 *      chain state.
 *
 *   2. **Route segment cache** for `/redeem/[poolId]`. `router.refresh()`
 *      alone re-requests the RSC payload, but Next's segment cache can
 *      still hand back a previously-rendered tree if it hasn't been
 *      explicitly invalidated. `revalidatePath` flushes that cache so
 *      the next render really does run the server components fresh.
 *
 * Both call sites (the deposit panel + the redeem panel) pass the
 * specific `poolId` so we revalidate just the affected page rather than
 * every pool detail page on the platform. Called immediately after
 * `signAndExecute` settles, before `router.refresh()`.
 */
export async function bustRedeemPoolCache(poolId?: string): Promise<void> {
  updateTag("redeem-pool");
  if (poolId) {
    revalidatePath(`/redeem/${poolId}`, "page");
  } else {
    // Caller didn't have a specific pool in hand — fall back to the
    // dynamic-segment form, which busts every `/redeem/[poolId]` page.
    // Cheap enough for now; tighten when pool count grows.
    revalidatePath("/redeem/[poolId]", "page");
  }
}
