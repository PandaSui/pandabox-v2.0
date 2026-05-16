"use client";

import { useMemo, useState } from "react";
import BigNumber from "bignumber.js";
import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { TokenAmount } from "@/components/identity/token-amount";

const MIST = 1_000_000_000n;

export function CycleSimulator({
  weight,
  reservedRate,
  cashOutTax,
  payoutLimitMist,
  ticker,
  className,
}: {
  weight: string;
  reservedRate: number;
  cashOutTax: number;
  payoutLimitMist: string;
  ticker: string;
  className?: string;
}) {
  const [inflowSui, setInflowSui] = useState(100);

  const sim = useMemo(() => {
    const inflowMist = BigInt(Math.round(inflowSui * 1e9));
    const w = BigInt(weight || "0");

    const mintedRaw = (inflowMist * w) / MIST;
    const reservedRaw = (mintedRaw * BigInt(reservedRate)) / 100n;
    const supporterRaw = mintedRaw - reservedRaw;

    const limit = BigInt(payoutLimitMist || "0");
    const payouts = inflowMist > limit ? limit : inflowMist;
    const surplus = inflowMist - payouts;

    // One token cash-out: (surplus * (1 - tax/100)) / total_supply
    let oneTokenCashOutMist = 0n;
    if (mintedRaw > 0n && surplus > 0n) {
      const grossPerToken = (surplus * 1_000_000_000_000n) / mintedRaw; // scaled
      const net =
        (grossPerToken * BigInt(100 - cashOutTax)) / 100n;
      oneTokenCashOutMist = net / 1000n; // de-scale (scaled by 1e3 above relative to mist)
    }

    return {
      inflowMist,
      mintedRaw,
      reservedRaw,
      supporterRaw,
      payouts,
      surplus,
      oneTokenCashOutMist,
    };
  }, [inflowSui, weight, reservedRate, cashOutTax, payoutLimitMist]);

  return (
    <div className={cn("border border-ink/15 bg-paper/40 p-5", className)}>
      <div className="flex items-baseline justify-between">
        <MonoLabel>Cycle Simulator</MonoLabel>
        <span className="font-mono-label text-[10px] text-ink/40">
          live math
        </span>
      </div>
      <p className="mt-1 text-xs text-ink/55">
        See how a hypothetical payment flows through your parameters.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono-label text-[10px]">If this much flows in</span>
          <span className="flex items-baseline gap-1 font-mono tabular-nums text-2xl">
            <SuiGlyph size={14} className="text-ink/60" />
            {inflowSui.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={1000}
          step={1}
          value={inflowSui}
          onChange={(e) => setInflowSui(Number(e.target.value))}
          aria-label="Hypothetical inflow in SUI"
          className="w-full accent-saffron"
        />
        <div className="flex justify-between font-mono-label text-[10px] text-ink/40">
          <span>1 SUI</span>
          <span>1,000 SUI</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Cell label="Supporters get">
          <TokenAmount
            raw={sim.supporterRaw}
            decimals={9}
            ticker={ticker || "TOK"}
            compact
            className="text-base"
          />
        </Cell>
        <Cell label="Team / reserved">
          <TokenAmount
            raw={sim.reservedRaw}
            decimals={9}
            ticker={ticker || "TOK"}
            compact
            className="text-base"
          />
        </Cell>
        <Cell label="Payouts capped at">
          <SuiAmount mist={sim.payouts} compact className="text-base" />
        </Cell>
        <Cell label="Surplus (cash-out pool)">
          <SuiAmount mist={sim.surplus} compact className="text-base" />
        </Cell>
      </div>

      <div className="mt-4 border-t border-ink/15 pt-3">
        <Cell label="Today, one token cashes out at">
          <SuiAmount
            mist={sim.oneTokenCashOutMist}
            maxFractionDigits={6}
            className="text-lg"
          />
        </Cell>
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-mono-label text-[10px] text-ink/50 block">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function bigNumberFromSui(s: string): BigNumber {
  return new BigNumber(s || "0");
}
