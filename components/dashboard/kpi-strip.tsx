"use client";

import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { formatSui } from "./format";
import type {
  DashboardOwnedRow,
  DashboardSupportedRow,
} from "@/app/api/dashboard/[address]/route";

/**
 * Portfolio KPI strip — 4 mono cells anchored above the project lists.
 *
 *   - RAISED       sum of `sold` across every owned project, in SUI
 *                  equivalent (sold / baseRate, then mist → sui)
 *   - TREASURY     sum of `suiBalance` (i.e., withdrawable SUI right now)
 *                  across owned projects
 *   - LIVE         count of owned projects currently in `status === "live"`
 *                  and not past end-time
 *   - BACKING      count of supported projects
 *
 * Pulls everything from the same payload the cards do — no extra fetch.
 * Renders even while loading by showing — placeholders, so the page
 * doesn't reflow when data lands.
 */
export function KpiStrip({
  owned,
  supported,
  loading,
}: {
  owned: DashboardOwnedRow[] | undefined;
  supported: DashboardSupportedRow[] | undefined;
  loading: boolean;
}) {
  const t = useTranslations("dashboard.kpi");
  const totals = computeTotals(owned, supported);
  return (
    <div className="grid grid-cols-2 border border-ink/15 bg-bone shadow-offset-sm md:grid-cols-4">
      <Cell
        label={t("raised")}
        value={
          loading || !owned
            ? "—"
            : `${formatSui(totals.raisedMist)} SUI`
        }
      />
      <Cell
        label={t("treasury")}
        value={
          loading || !owned
            ? "—"
            : `${formatSui(totals.treasuryMist)} SUI`
        }
        border
      />
      <Cell
        label={t("live")}
        value={
          loading || !owned
            ? "—"
            : String(totals.liveCount)
        }
        suffix={
          owned && owned.length > 0
            ? ` / ${owned.length}`
            : undefined
        }
        border
      />
      <Cell
        label={t("backing")}
        value={loading || !supported ? "—" : String(supported.length)}
        border
      />
    </div>
  );
}

function Cell({
  label,
  value,
  suffix,
  border = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  border?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4",
        border && "md:border-l border-ink/10",
        "[&:nth-child(2)]:border-l [&:nth-child(2)]:border-ink/10",
      )}
    >
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1 font-display text-2xl leading-tight tabular-nums text-ink md:text-[1.65rem]">
        {value}
        {suffix && (
          <span className="ml-1 font-mono text-[12px] tabular-nums text-ink/40">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Aggregate portfolio numbers. Raised is computed by inverting the Move
 * contract's `tokens_raw = mist * base_rate` — divide `sold` by base_rate
 * to recover the SUI equivalent. Treasury is the literal sum of
 * `suiBalance` across owned projects.
 */
function computeTotals(
  owned: DashboardOwnedRow[] | undefined,
  supported: DashboardSupportedRow[] | undefined,
): {
  raisedMist: bigint;
  treasuryMist: bigint;
  liveCount: number;
} {
  const totals = { raisedMist: 0n, treasuryMist: 0n, liveCount: 0 };
  if (!owned) return totals;
  const now = Date.now();
  for (const row of owned) {
    const p = row.project;
    const baseRate = BigInt(p.baseRate || 1);
    if (baseRate > 0n) {
      totals.raisedMist += BigInt(p.sold) / baseRate;
    }
    totals.treasuryMist += BigInt(p.suiBalance);
    const ended = p.endTimeMs > 0 && now > p.endTimeMs;
    if (p.status === "live" && !ended) totals.liveCount++;
  }
  // supported is only used for the count; nothing to aggregate here yet.
  void supported;
  return totals;
}
