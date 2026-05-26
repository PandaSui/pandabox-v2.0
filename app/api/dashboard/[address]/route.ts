import { NextResponse } from "next/server";
import { getUserHoldings } from "@/lib/holdings";
import { getClaimHistoryByProject } from "@/lib/dashboard/claim-history";
import {
  getOnchainProject,
  getOnchainProjects,
  type HydratedProject,
  type OnChainProject,
  type ProjectDetails,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

/**
 * Wire-shape for a project on the dashboard. Carries the on-chain core
 * plus optional `details` (IPFS-pinned project_details.json) so the card
 * can render state-aware UI — sparklines for seeded pools, ticker from
 * details, etc. — without the client having to do a second round-trip.
 * BigInts are serialized to strings since JSON can't carry them.
 */
export type OnChainProjectJSON = Omit<
  OnChainProject,
  "fundingAllocation" | "sold" | "suiBalance"
> & {
  fundingAllocation: string;
  sold: string;
  suiBalance: string;
  details: ProjectDetails | null;
};

export type DashboardOwnedRow = {
  project: OnChainProjectJSON;
  capId: string;
};

/**
 * Optional aggregate of past claim events for this project + wallet.
 * Present when the wallet has at least one `project::Claimed` event,
 * absent otherwise. Lets the UI distinguish:
 *   · receipts.length > 0 ∧ !claimed  → "supporting" (active row)
 *   · receipts.length > 0 ∧ claimed   → "partially claimed" (active row
 *                                         with historical badge)
 *   · receipts.length = 0 ∧ claimed   → "claimed" (archive row, no CTA)
 */
export type ClaimedHistoryJSON = {
  totalSui: string;
  totalTokens: string;
  latestClaimAtMs: number;
  txDigests: string[];
};

export type DashboardSupportedRow = {
  project: OnChainProjectJSON;
  receipts: Array<{
    receiptId: string;
    suiAmount: string;
    tokenShare: string;
    createdAtMs: number;
  }>;
  /** Sum across `receipts` — pending side. */
  totalSui: string;
  totalTokens: string;
  /** Aggregate of past `Claimed` events, if any. */
  claimed?: ClaimedHistoryJSON;
};

export type DashboardPayload = {
  address: string;
  owned: DashboardOwnedRow[];
  supported: DashboardSupportedRow[];
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  const { address } = await context.params;

  // Bulk-fetch the project list + holdings + claim history in parallel.
  // The owned rows get a second hydration pass (per-id cached) so the
  // dashboard can see IPFS details — required for the seeded-pool
  // sparkline and any future off-chain-flag UI on owner cards. Supported
  // rows stay on the lighter on-chain-only shape.
  //
  // `claimHistory` adds projects the wallet has fully claimed — those
  // wouldn't surface from `getUserHoldings` because the contract burns
  // the receipt on claim, dropping the only on-chain artifact tying the
  // claimer to the project. We rebuild that history from the `Claimed`
  // event stream so a supporter who has already claimed still sees the
  // project on their dashboard as a historical "claimed" row.
  const [holdings, allProjects, claimHistory] = await Promise.all([
    getUserHoldings(address),
    getOnchainProjects(),
    getClaimHistoryByProject(address),
  ]);

  const byId = new Map(allProjects.map((p) => [p.id, p]));

  // ── Owned: hydrate each project so we get IPFS `details` (incl.
  //    liquidity flag). `getOnchainProject` is unstable_cache'd per-id
  //    with a 30s revalidate, so repeat hits during a session are free.
  const ownedHydrated = await Promise.all(
    holdings.adminCaps.map(async (cap) => {
      const p = await getOnchainProject(cap.projectId);
      if (!p) return null;
      return { project: toHydratedJSON(p), capId: cap.capId };
    }),
  );
  const owned: DashboardOwnedRow[] = ownedHydrated.filter(
    (row): row is DashboardOwnedRow => row !== null,
  );

  // ── Supported: union of "still has receipts" + "has past claims",
  //    keyed by project so a wallet that holds some receipts AND has
  //    claimed others on the same project gets one merged row with
  //    both totals attached.
  const supportedById = new Map<string, DashboardSupportedRow>();

  // Pass 1 — projects with currently-held receipts (the original list).
  for (const [projectId, receipts] of Object.entries(
    holdings.receiptsByProject,
  )) {
    const p = byId.get(projectId);
    if (!p) continue;
    const totalSui = receipts.reduce((acc, r) => acc + r.suiAmount, 0n);
    const totalTokens = receipts.reduce((acc, r) => acc + r.tokenShare, 0n);
    supportedById.set(projectId, {
      project: toJSON(p),
      receipts: receipts.map((r) => ({
        receiptId: r.receiptId,
        suiAmount: r.suiAmount.toString(),
        tokenShare: r.tokenShare.toString(),
        createdAtMs: r.createdAtMs,
      })),
      totalSui: totalSui.toString(),
      totalTokens: totalTokens.toString(),
    });
  }

  // Pass 2 — fold in claim history. Either attaches a `claimed`
  // aggregate to an existing row (partial-claim case) or creates a
  // brand-new row with `receipts: []` (fully-claimed historical case).
  for (const [projectId, agg] of claimHistory) {
    const claimedJSON: ClaimedHistoryJSON = {
      totalSui: agg.totalSui.toString(),
      totalTokens: agg.totalTokens.toString(),
      latestClaimAtMs: agg.latestClaimAtMs,
      txDigests: agg.txDigests,
    };
    const existing = supportedById.get(projectId);
    if (existing) {
      existing.claimed = claimedJSON;
      continue;
    }
    const p = byId.get(projectId);
    if (!p) continue;
    supportedById.set(projectId, {
      project: toJSON(p),
      receipts: [],
      totalSui: "0",
      totalTokens: "0",
      claimed: claimedJSON,
    });
  }

  const supported = Array.from(supportedById.values());

  // Owned newest-first by project number; supported newest-first by
  // latest activity (latest receipt OR latest claim, whichever is
  // newer) so partial-claim and historical rows stay chronological.
  owned.sort((a, b) => b.project.createdAtMs - a.project.createdAtMs);
  supported.sort((a, b) => {
    const aMax = Math.max(
      a.claimed?.latestClaimAtMs ?? 0,
      ...a.receipts.map((r) => r.createdAtMs),
    );
    const bMax = Math.max(
      b.claimed?.latestClaimAtMs ?? 0,
      ...b.receipts.map((r) => r.createdAtMs),
    );
    return bMax - aMax;
  });

  const payload: DashboardPayload = { address, owned, supported };
  return NextResponse.json(payload);
}

function toJSON(p: OnChainProject): OnChainProjectJSON {
  return {
    ...p,
    fundingAllocation: p.fundingAllocation.toString(),
    sold: p.sold.toString(),
    suiBalance: p.suiBalance.toString(),
    details: null,
  };
}

function toHydratedJSON(p: HydratedProject): OnChainProjectJSON {
  return {
    ...p,
    fundingAllocation: p.fundingAllocation.toString(),
    sold: p.sold.toString(),
    suiBalance: p.suiBalance.toString(),
    details: p.details,
  };
}
