"use client";

import Link from "next/link";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { ProjectAvatar } from "@/components/identity/project-avatar";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import { explorerUrl } from "@/lib/sui";
import {
  getProjectState,
  getStateVisuals,
  getTimeLabel,
} from "./state";
import { formatSui, formatToken, lastSegment, shortMid } from "./format";
import { MiniSparkline } from "./mini-sparkline";
import type { DashboardOwnedRow } from "@/app/api/dashboard/[address]/route";

/**
 * Owned-project card — the headline surface of the dashboard. Redesigned
 * around three goals:
 *
 *   1. State-driven visual hierarchy. Live cards get a saffron accent
 *      bar + soft tint so a creator can triage at a glance. Closed cards
 *      recede. "Ending soon" gets a poppy nudge; "needs finalize" gets a
 *      sky cue (action available).
 *
 *   2. Treasury as the hero metric. The number a creator opens this page
 *      to see is "how much can I withdraw right now." Renders in display
 *      font + tabular-nums, with `withdrawable` as the only mono label
 *      beneath. Everything else is supporting context.
 *
 *   3. Time-awareness. Live cards announce "ends in 2d 14h"; ended-
 *      awaiting cards push toward finalize; closed cards say how long
 *      since wrap. Mono, ink/60, never louder than treasury.
 *
 * The `<MiniSparkline>` in the header right-side only renders when the
 * project has a paired Cetus pool (`details.liquidity.seeded`) — fetches
 * `/api/chart/{poolId}` for a 24h slice. No network call on pre-seed
 * cards.
 */
export function OwnedCard({
  row,
  onManage,
}: {
  row: DashboardOwnedRow;
  onManage: () => void;
}) {
  const p = row.project;
  const ticker = lastSegment(p.tokenType).toUpperCase() || "TOK";
  const state = getProjectState(p);
  const visuals = getStateVisuals(state);

  const pct =
    BigInt(p.fundingAllocation) > 0n
      ? Math.min(
          100,
          Math.max(
            0,
            Number((BigInt(p.sold) * 10_000n) / BigInt(p.fundingAllocation)) /
              100,
          ),
        )
      : 0;

  const treasuryMist = BigInt(p.suiBalance);
  const treasuryDisplay = formatSui(treasuryMist);

  // Liquidity flag rides on IPFS details (pinned by the seed-liquidity
  // admin flow). Sparkline only fires when both flag and pool address are
  // present — both gates avoid wasted network calls.
  const seeded = Boolean(p.details?.liquidity?.seeded);
  const poolId = p.details?.liquidity?.poolId;
  const showSparkline = seeded && Boolean(poolId);

  const timeLabel = getTimeLabel(p, state);

  return (
    <article
      className={cn(
        "relative overflow-hidden border bg-bone shadow-offset-sm transition-all duration-200 ease-atelier",
        "hover:-translate-y-[2px] hover:shadow-offset",
        visuals.borderClass,
      )}
      style={visuals.bgTint ? { background: visuals.bgTint } : undefined}
    >
      {/* ── State accent rule — 3px colored bar across the top ─── */}
      <span
        aria-hidden
        className={cn("absolute inset-x-0 top-0 h-[3px]", visuals.accentBar)}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 pb-3 pt-4">
        <ProjectAvatar src={p.iconUrl} name={p.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/p/${p.id}`}
              className="block truncate font-display text-lg leading-tight hover:underline hover:underline-offset-4"
              title={p.name}
            >
              {p.name || "Untitled project"}
            </Link>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className="font-mono uppercase tracking-[0.14em] text-ink/45">
              {ticker}
            </span>
            <span className="text-ink/20">·</span>
            <a
              href={explorerUrl("object", p.id)}
              target="_blank"
              rel="noreferrer"
              className="font-mono tabular-nums text-ink/55 hover:text-ink"
              onClick={(e) => e.stopPropagation()}
            >
              {shortMid(p.id)}
            </a>
          </div>
        </div>

        {/* Header right — sparkline (if seeded) + state pill */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {showSparkline && poolId ? (
            <MiniSparkline poolId={poolId} />
          ) : null}
          <StatePill visuals={visuals} />
        </div>
      </header>

      {/* ── Hero treasury metric ───────────────────────────────── */}
      <div className="border-t border-ink/10 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <MonoLabel className="text-[10px]">Treasury</MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            withdrawable
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-3xl leading-none tabular-nums text-ink md:text-[2.25rem]">
            {treasuryDisplay}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
            SUI
          </span>
        </div>
      </div>

      {/* ── Meter — raised pct + supporting facts on one line ──── */}
      <div className="border-t border-ink/10 px-5 py-3">
        <div className="flex items-baseline justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">
          <span>raised {pct.toFixed(2)}%</span>
          <span className="text-ink/40">
            {formatToken(BigInt(p.sold), PROJECT_COIN_DECIMALS)} {ticker} sold
          </span>
        </div>
        <div className="relative mt-2 h-[3px] overflow-hidden bg-ink/10">
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-[width] duration-500",
              state === "closed" ? "bg-plum" : "bg-saffron",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Time-aware row + Manage CTA ────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/60">
          {timeLabel}
        </span>
        <button
          type="button"
          onClick={onManage}
          className={cn(
            "group inline-flex h-10 shrink-0 items-center gap-2 px-4 font-sans font-medium uppercase tracking-[0.12em] text-[0.74rem]",
            "border border-ink shadow-offset-sm bg-saffron text-ink",
            "transition-all duration-300 ease-atelier",
            "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
            "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
          )}
        >
          Manage
          <ArrowDiag size={12} />
        </button>
      </div>

      {/* ── Bottom mono spec line — cap id + creator hint ──────── */}
      <div className="border-t border-ink/10 px-5 py-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/40">
        cap {shortMid(row.capId)}
      </div>
    </article>
  );
}

function StatePill({
  visuals,
}: {
  visuals: ReturnType<typeof getStateVisuals>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border bg-bone px-2 py-[3px]",
        "font-mono text-[9.5px] uppercase tracking-[0.16em]",
        visuals.pillBorderClass,
        visuals.pillTextClass,
      )}
    >
      <span
        aria-hidden
        className={cn("block h-1.5 w-1.5 rounded-full", visuals.dotClass)}
        style={
          visuals.pillLabel === "live"
            ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
            : undefined
        }
      />
      {visuals.pillLabel}
    </span>
  );
}
