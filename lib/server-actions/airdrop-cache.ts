"use server";

import { revalidatePath, updateTag } from "next/cache";

/**
 * Bust every cache layer that holds Airdrop platform state and the
 * /airdrop route so a freshly mutated chain state surfaces correctly on
 * the next read.
 *
 * Two layers — both required, neither sufficient alone:
 *
 *   1. **Data cache** (`unstable_cache` tagged `"airdrop-platform"`). The
 *      `getAirdropPlatform` reader (`lib/airdrop/reader.ts`) wraps the
 *      fullnode read with `{ revalidate: 60, tags: ["airdrop-platform"] }`.
 *      Without a tag bust, the next read returns the cached pre-mutation
 *      snapshot for up to 60s. `updateTag` (Next 16) marks the tag dirty
 *      with read-your-own-writes semantics so the next reader sees fresh
 *      chain state.
 *
 *   2. **Route segment cache** for `/airdrop`. `router.refresh()` alone
 *      re-requests the RSC payload, but Next's segment cache can still
 *      hand back a previously-rendered tree if it hasn't been explicitly
 *      invalidated. `revalidatePath` flushes that cache so the next
 *      render runs the server components fresh.
 *
 * Called immediately after a successful airdrop tx settles, before
 * `router.refresh()` — the lifetime-counter and accrued-fee numbers in
 * the masthead should reflect the just-submitted action without making
 * the user wait out the 60s revalidation window.
 */
export async function bustAirdropCache(): Promise<void> {
  updateTag("airdrop-platform");
  revalidatePath("/airdrop", "page");
}
