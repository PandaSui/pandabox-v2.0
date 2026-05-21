import { NextResponse } from "next/server";
import { getUserHoldings } from "@/lib/holdings";
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

export type DashboardSupportedRow = {
  project: OnChainProjectJSON;
  receipts: Array<{
    receiptId: string;
    suiAmount: string;
    tokenShare: string;
    createdAtMs: number;
  }>;
  totalSui: string;
  totalTokens: string;
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

  // Bulk-fetch the project list + holdings in parallel. The owned rows get
  // a second hydration pass (per-id cached) so the dashboard can see IPFS
  // details — required for the seeded-pool sparkline and any future
  // off-chain-flag UI on owner cards. Supported rows stay on the lighter
  // on-chain-only shape.
  const [holdings, allProjects] = await Promise.all([
    getUserHoldings(address),
    getOnchainProjects(),
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

  const supported: DashboardSupportedRow[] = [];
  for (const [projectId, receipts] of Object.entries(
    holdings.receiptsByProject,
  )) {
    const p = byId.get(projectId);
    if (!p) continue;
    const totalSui = receipts.reduce((acc, r) => acc + r.suiAmount, 0n);
    const totalTokens = receipts.reduce((acc, r) => acc + r.tokenShare, 0n);
    supported.push({
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

  // Owned newest-first by project number; supported newest-first by latest receipt.
  owned.sort((a, b) => b.project.createdAtMs - a.project.createdAtMs);
  supported.sort((a, b) => {
    const aMax = Math.max(0, ...a.receipts.map((r) => r.createdAtMs));
    const bMax = Math.max(0, ...b.receipts.map((r) => r.createdAtMs));
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
