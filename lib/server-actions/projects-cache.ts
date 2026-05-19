"use server";

import { revalidatePath, updateTag } from "next/cache";

/**
 * Bust every cache layer that holds the list of on-chain projects so a newly
 * deployed token shows up on the next page load instead of waiting out the
 * 60s revalidate window.
 *
 * Two layers to invalidate:
 *
 *   1. `unstable_cache` data cache, keyed by the `"projects"` tag in
 *      `lib/projects.ts`. `updateTag` (Next 16) marks the tag dirty with
 *      read-your-own-writes semantics — the *very next* read sees fresh
 *      chain data instead of the now-stale entry.
 *
 *   2. Statically prerendered routes that read that data. /explore, the
 *      landing's <FeaturedProjects>, and /dashboard all hold their own
 *      cached HTML thanks to `export const revalidate`. `revalidatePath`
 *      forces regeneration on next request.
 *
 * Called from the client right after `signAndExecute` succeeds in the deploy
 * step — the user typically reaches /explore or /p/[id] a beat later, and
 * by then the fullnode has indexed the new shared Project object.
 */
export async function bustProjectsCache(): Promise<void> {
  updateTag("projects");
  revalidatePath("/", "page");
  revalidatePath("/explore", "page");
  revalidatePath("/dashboard", "page");
}
