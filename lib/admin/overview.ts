import "server-only";
import { getPlatformStats, type PlatformStats } from "@/lib/platform";
import { getRedeemPlatform } from "@/lib/redeem/reader";
import { getAirdropPlatform } from "@/lib/airdrop/reader";
import type { RedeemPlatformState } from "@/lib/redeem/types";
import type { AirdropPlatformState } from "@/lib/airdrop/types";
import { PROTOCOLS, type ProtocolId } from "@/lib/admin/protocols";
import { formatBps, formatSui } from "@/lib/admin/format";

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

/**
 * A normalized, fully-serializable summary of one protocol's platform state,
 * shaped for the control deck. Computing it server-side keeps bigints off the
 * RSC boundary and gives every card an identical prop contract regardless of
 * which protocol it represents.
 */
export type DeckCard = {
  id: ProtocolId;
  label: string;
  tagline: string;
  /** Platform state read succeeded. */
  available: boolean;
  paused: boolean;
  /** Headline fee, e.g. "0.50%" or "0.0010 SUI". */
  feeLabel: string;
  /** Secondary fee detail, e.g. "50 bps" or "per recipient · max 300". */
  feeHint: string;
  /** Accrued, withdrawable fees as a compact SUI string. */
  accruedSui: string;
  accruedZero: boolean;
  treasury: string;
  /** Lifetime entity counter (projects / pools / airdrops). */
  count: number;
  countLabel: string;
};

export function buildDeckCards(o: AdminOverview): DeckCard[] {
  const p = o.pandabox;
  const r = o.redeem;
  const a = o.airdrop;
  return [
    {
      id: "pandabox",
      label: PROTOCOLS.pandabox.label,
      tagline: PROTOCOLS.pandabox.tagline,
      available: !!p,
      paused: p?.paused ?? false,
      feeLabel: p ? `${formatBps(p.feeBps)}%` : "—",
      feeHint: p ? `${p.feeBps} bps` : "",
      accruedSui: p ? formatSui(BigInt(p.feeTreasuryMist)) : "—",
      accruedZero: p ? BigInt(p.feeTreasuryMist) === 0n : true,
      treasury: p?.treasuryAddress ?? "",
      count: p?.totalProjects ?? 0,
      countLabel: "projects",
    },
    {
      id: "redeem",
      label: PROTOCOLS.redeem.label,
      tagline: PROTOCOLS.redeem.tagline,
      available: !!r,
      paused: r?.paused ?? false,
      feeLabel: r ? `${formatBps(r.feeBps)}%` : "—",
      feeHint: r ? `${r.feeBps} bps` : "",
      accruedSui: r ? formatSui(r.feeTreasuryMist) : "—",
      accruedZero: r ? r.feeTreasuryMist === 0n : true,
      treasury: r?.treasuryAddress ?? "",
      count: r?.totalPools ?? 0,
      countLabel: "pools",
    },
    {
      id: "airdrop",
      label: PROTOCOLS.airdrop.label,
      tagline: PROTOCOLS.airdrop.tagline,
      available: !!a,
      paused: a?.paused ?? false,
      feeLabel: a ? `${formatSui(a.feePerRecipientMist)} SUI` : "—",
      feeHint: a ? `per recipient · max ${a.maxRecipients}` : "",
      accruedSui: a ? formatSui(a.feeTreasuryMist) : "—",
      accruedZero: a ? a.feeTreasuryMist === 0n : true,
      treasury: a?.treasuryAddress ?? "",
      count: a?.totalAirdrops ?? 0,
      countLabel: "airdrops",
    },
  ];
}
