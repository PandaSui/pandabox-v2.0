import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getGlobalStats, getRecentPaymentsGlobal } from "@/lib/indexer";
import { PROJECTS } from "@/lib/indexer/fixtures";
import type { PulseSnapshot } from "@/components/pulse/types";
import type { Payment, Project } from "@/types/pandabox";

export const dynamic = "force-dynamic";

const MIST = 1_000_000_000n;
const LIVE_PROJECTS = PROJECTS.filter((p) => p.status === "live");

function hex(bytes: number): string {
  return `0x${randomBytes(bytes).toString("hex")}`;
}

/** A genuinely fresh synthetic event — one is prepended per request so the
 *  hero console's pulse + stream animations fire on every poll. Removed once
 *  the indexer subscribes to real `pandabox::PaymentEvent`s on-chain. */
function freshEvent(): Payment | null {
  if (LIVE_PROJECTS.length === 0) return null;
  const p: Project =
    LIVE_PROJECTS[Math.floor(Math.random() * LIVE_PROJECTS.length)];

  // Bias: 65% small (0.3–4 SUI), 30% medium (4–30), 5% large (30–180).
  const r = Math.random();
  const sui =
    r < 0.65
      ? 0.3 + Math.random() * 3.7
      : r < 0.95
        ? 4 + Math.random() * 26
        : 30 + Math.random() * 150;

  const amount = BigInt(Math.round(sui * 1_000_000_000));
  const tokens = (amount * p.weight) / MIST;

  return {
    txHash: hex(32),
    projectId: p.id,
    projectName: p.name,
    projectAccent: p.accent,
    payer: hex(32),
    amountMist: amount,
    tokensRaw: tokens,
    memo: "",
    tierId: null,
    timestamp: Date.now(),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(64, Number(url.searchParams.get("limit") ?? "24")),
  );

  const [backfill, stats] = await Promise.all([
    getRecentPaymentsGlobal(limit),
    getGlobalStats(),
  ]);

  const live = freshEvent();
  const events = (live ? [live, ...backfill] : backfill).slice(0, limit);

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
