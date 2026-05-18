import { NextResponse } from "next/server";
import { getUserHoldings } from "@/lib/holdings";
import { getOnchainProjects, type OnChainProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export type OnChainProjectJSON = Omit<
  OnChainProject,
  "fundingAllocation" | "sold" | "suiBalance"
> & {
  fundingAllocation: string;
  sold: string;
  suiBalance: string;
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

  // Both reads are short-cached server-side. Joining client-side would require
  // (N+1) RPC calls so we do it here once instead.
  const [holdings, allProjects] = await Promise.all([
    getUserHoldings(address),
    getOnchainProjects(),
  ]);

  const byId = new Map(allProjects.map((p) => [p.id, p]));

  const owned: DashboardOwnedRow[] = [];
  for (const cap of holdings.adminCaps) {
    const p = byId.get(cap.projectId);
    if (!p) continue;
    owned.push({ project: toJSON(p), capId: cap.capId });
  }

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
  };
}
