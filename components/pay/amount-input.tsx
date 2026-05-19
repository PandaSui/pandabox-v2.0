"use client";

import { useId } from "react";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { useSuiUsdPrice } from "@/lib/hooks/use-sui-usd-price";

export type Currency = "SUI" | "USD";

/**
 * SUI → USD. Returns null when `price` is unavailable so callers can show
 * a placeholder instead of a fake $0.00.
 */
export function suiUsd(
  suiAmount: BigNumber,
  price: BigNumber | null | undefined,
): BigNumber | null {
  if (!price || !price.isFinite() || price.lte(0)) return null;
  return suiAmount.multipliedBy(price);
}

/** USD → SUI. Returns null when `price` is unavailable. */
export function usdSui(
  usdAmount: BigNumber,
  price: BigNumber | null | undefined,
): BigNumber | null {
  if (!price || !price.isFinite() || price.lte(0)) return null;
  return usdAmount.dividedBy(price);
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
  const { price, isLoading } = useSuiUsdPrice();

  const hasPrice = price !== null;
  const bn = new BigNumber(value || "0");
  const validNumber = value && Number.isFinite(Number(value));
  const counterpart =
    validNumber && hasPrice
      ? currency === "SUI"
        ? suiUsd(bn, price)
        : usdSui(bn, price)
      : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-mono-label text-ink/60">
          Amount
        </label>
        <div className="inline-flex border border-ink/25">
          {(["SUI", "USD"] as Currency[]).map((c) => {
            const active = c === currency;
            const disabled = c === "USD" && !hasPrice;
            return (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onCurrencyChange(c)}
                className={cn(
                  "px-2.5 py-0.5 font-mono-label transition-colors",
                  active
                    ? "bg-ink text-bone"
                    : "text-ink/60 hover:text-ink",
                  disabled && "cursor-not-allowed opacity-40 hover:text-ink/60",
                )}
                aria-pressed={active}
                aria-disabled={disabled}
                title={
                  disabled
                    ? isLoading
                      ? "Loading SUI/USD price…"
                      : "SUI/USD price unavailable"
                    : undefined
                }
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
        {counterpart === null ? (
          <span title={isLoading ? "Loading price…" : "Price unavailable"}>
            ≈ {currency === "SUI" ? "$—" : "— SUI"}
          </span>
        ) : currency === "SUI" ? (
          <>≈ ${counterpart.toFormat(2, BigNumber.ROUND_DOWN)}</>
        ) : (
          <>≈ {counterpart.toFormat(4, BigNumber.ROUND_DOWN)} SUI</>
        )}
      </div>
    </div>
  );
}
