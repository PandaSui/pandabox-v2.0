"use client";

import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import { SuiAmount } from "@/components/identity/sui-amount";
import type { AirdropQuote } from "@/lib/airdrop";

/**
 * The four-cell pre-flight strip the user reads before signing. Renders
 * live off the `AirdropQuote` from Phase 2's `quote()` helper, plus the
 * picked coin's metadata so the token total has a symbol.
 *
 * Cells (left → right):
 *
 *   1. RECIPIENTS    — count + batch warning chip if over cap
 *   2. TOTAL TOKENS  — sum of `amounts`, formatted to coin decimals
 *   3. FEE           — `recipients × fee_per_recipient_mist`, in SUI
 *   4. SUI BUDGET    — fee + gas headroom; what the wallet must hold
 *
 * Layout: hairline-divided cells; no diecut. Each cell carries a tiny
 * 6px accent square on the left so the row reads as four labelled sub-
 * panels rather than as one fused strip.
 */
export function FeeBreakdown({
  quote,
  decimals,
  symbol,
  maxRecipients,
}: {
  quote: AirdropQuote;
  decimals: number;
  symbol: string | null;
  maxRecipients: number;
}) {
  return (
    <div className="border border-ink/15 bg-bone shadow-offset-sm">
      <div className="grid grid-cols-2 divide-x divide-ink/10 md:grid-cols-4">
        <Cell
          label="Recipients"
          accentClass="bg-poppy"
          valueNode={
            <span className="inline-flex items-baseline gap-2 font-mono text-[16px] tabular-nums text-ink">
              {quote.recipientCount.toLocaleString()}
              {quote.overRecipientLimit ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-poppy">
                  · {quote.batchCount} batches
                </span>
              ) : null}
            </span>
          }
          subtitle={
            quote.overRecipientLimit
              ? `Over the ${maxRecipients}-cap — will sign ${quote.batchCount}× PTBs`
              : `Within the ${maxRecipients}-cap`
          }
        />
        <Cell
          label="Total tokens"
          accentClass="bg-jade"
          valueNode={
            <span className="font-mono text-[16px] tabular-nums text-ink">
              {formatAmount(quote.totalAmountRaw, {
                decimals,
                maxFractionDigits: 4,
              })}{" "}
              <span className="text-ink/55">{symbol ?? ""}</span>
            </span>
          }
          subtitle="Sum of all live rows"
        />
        <Cell
          label="Platform fee"
          accentClass="bg-sky"
          valueNode={
            <SuiAmount
              mist={quote.feeMist}
              adaptive
              maxFractionDigits={4}
              glyphSize={11}
              className="text-[16px] text-ink"
            />
          }
          subtitle="Paid to the airdrop treasury"
        />
        <Cell
          label="SUI budget"
          accentClass="bg-ink/45"
          valueNode={
            <SuiAmount
              mist={quote.totalSuiBudgetMist}
              adaptive
              maxFractionDigits={4}
              glyphSize={11}
              className="text-[16px] text-ink"
            />
          }
          subtitle="Fee + gas headroom"
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  valueNode,
  subtitle,
  accentClass,
}: {
  label: string;
  valueNode: React.ReactNode;
  subtitle: string;
  accentClass: string;
}) {
  return (
    <div className="relative px-5 py-5">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-5 block h-[10px] w-[3px]",
          accentClass,
        )}
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </div>
      <div className="mt-1.5">{valueNode}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
        {subtitle}
      </div>
    </div>
  );
}
