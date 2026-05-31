import "server-only";
import { getPlatformStats, type PlatformStats } from "@/lib/platform";
import { getRedeemPlatform } from "@/lib/redeem/reader";
import { getAirdropPlatform } from "@/lib/airdrop/reader";
import type { RedeemPlatformState } from "@/lib/redeem/types";
import type { AirdropPlatformState } from "@/lib/airdrop/types";

export type AdminOverview = {
  pandabox: PlatformStats | null;
  redeem: RedeemPlatformState | null;
  airdrop: AirdropPlatformState | null;
};

/**
 * Read the live platform state for all three protocols at once. Each reader is
 * independently server-cached (`unstable_cache`, 60s) and returns null on a
 * transient fullnode hiccup, so a single protocol failing never blocks the
 * console — the deck simply shows that protocol as unavailable.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [pandabox, redeem, airdrop] = await Promise.all([
    getPlatformStats(),
    getRedeemPlatform(),
    getAirdropPlatform(),
  ]);
  return { pandabox, redeem, airdrop };
}
