"use client";

import { useId } from "react";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { SuiGlyph } from "@/components/identity/sui-glyph";

export type Currency = "SUI" | "USD";

// Placeholder oracle price — wired to a real oracle in step 13.11.
const SUI_USD_PRICE = new BigNumber("3.20");

export function suiUsd(suiAmount: BigNumber): BigNumber {
  return suiAmount.multipliedBy(SUI_USD_PRICE);
}

export function usdSui(usdAmount: BigNumber): BigNumber {
  return usdAmount.dividedBy(SUI_USD_PRICE);
}

export function AmountInput({
  value,
  currency,
  onChange,
  onCurrencyChange,
  className,
}: {
  value: string;
  currency: Currency;
  onChange: (next: string) => void;
  onCurrencyChange: (next: Currency) => void;
  className?: string;
}) {
  const id = useId();
  const counterpart =
    value && Number.isFinite(Number(value))
      ? currency === "SUI"
        ? suiUsd(new BigNumber(value || "0"))
        : usdSui(new BigNumber(value || "0"))
      : new BigNumber(0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-mono-label text-ink/60">
          Amount
        </label>
        <div className="inline-flex border border-ink/25">
          {(["SUI", "USD"] as Currency[]).map((c) => {
            const active = c === currency;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCurrencyChange(c)}
                className={cn(
                  "px-2.5 py-0.5 font-mono-label transition-colors",
                  active
                    ? "bg-ink text-bone"
                    : "text-ink/60 hover:text-ink",
                )}
                aria-pressed={active}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "flex h-14 items-center gap-2 border border-ink/25 bg-bone px-4 transition-colors",
          "focus-within:border-ink focus-within:shadow-offset-sm",
        )}
      >
        {currency === "SUI" ? (
          <SuiGlyph size={16} className="text-ink/60" />
        ) : (
          <span className="font-mono text-lg text-ink/60">$</span>
        )}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            // Allow only one dot.
            const parts = v.split(".");
            const clean =
              parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : v;
            onChange(clean);
          }}
          placeholder="0.00"
          className="flex-1 bg-transparent font-mono tabular-nums text-2xl outline-none placeholder:text-ink/25"
        />
        <span className="font-mono-label text-ink/50">{currency}</span>
      </div>

      <div className="text-right font-mono text-xs text-ink/45 tabular-nums">
        ≈{" "}
        {currency === "SUI"
          ? "$" + counterpart.toFormat(2, BigNumber.ROUND_DOWN)
          : counterpart.toFormat(4, BigNumber.ROUND_DOWN) + " SUI"}
      </div>
    </div>
  );
}
