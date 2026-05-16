import { NextResponse } from "next/server";
import { getGlobalStats, getRecentPaymentsGlobal } from "@/lib/indexer";
import type { PulseSnapshot } from "@/components/pulse/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(64, Number(url.searchParams.get("limit") ?? "24")),
  );

  const [events, stats] = await Promise.all([
    getRecentPaymentsGlobal(limit),
    getGlobalStats(),
  ]);

  const payload: PulseSnapshot = {
    events: events.map((e) => ({
      txHash: e.txHash,
      projectId: e.projectId,
      projectName: e.projectName,
      projectAccent: e.projectAccent,
      payer: e.payer,
      amountMist: e.amountMist.toString(),
      timestamp: e.timestamp,
    })),
    tvlMist: stats.tvlMist.toString(),
    fetchedAt: Date.now(),
  };

  return NextResponse.json(payload);
}
