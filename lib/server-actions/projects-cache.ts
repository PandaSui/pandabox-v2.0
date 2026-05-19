"use server";

import { revalidatePath, updateTag } from "next/cache";

/**
 * Bust every cache layer that holds the list of on-chain projects so a newly
 * deployed token shows up on the next page load instead of waiting out the
 * 60s revalidate window.
 *
 * Three layers to invalidate:
 *
 *   1. `unstable_cache` data cache for the project list (`"projects"` tag in
 *      `lib/projects.ts`). `updateTag` (Next 16) marks the tag dirty with
 *      read-your-own-writes semantics — the next read fetches fresh chain
 *      data instead of returning the stale entry.
 *
 *   2. `unstable_cache` data cache for per-wallet holdings (`"holdings"` tag
 *      in `lib/holdings.ts`). A new deploy mints a `ProjectAdminCap<T>` into
 *      the creator's wallet, which is a *holding* — without busting this
 *      tag the dashboard reads stale 20s data and the new project hides.
 *
 *   3. Statically prerendered routes that read that data. /explore, the
 *      landing's <FeaturedProjects>, and /dashboard all hold their own
 *      cached HTML. `revalidatePath` forces regeneration on next request.
 *
 * Called right after `signAndExecute` succeeds in the deploy step.
 */
export async function bustProjectsCache(): Promise<void> {
  updateTag("projects");
  updateTag("holdings");
  revalidatePath("/", "page");
  revalidatePath("/explore", "page");
  revalidatePath("/dashboard", "page");
}

/**
 * Narrower bust used after a single wallet's on-chain state changes — a
 * `contribute` mints a `ContributionReceipt<T>`, `claim` burns it, and
 * either should land on the dashboard immediately rather than after the
 * 20s `holdings` revalidate window. Doesn't touch the project list cache;
 * the project page calls `router.refresh()` on its own to repaint progress.
 */
export async function bustHoldingsCache(): Promise<void> {
  updateTag("holdings");
  revalidatePath("/dashboard", "page");
}
