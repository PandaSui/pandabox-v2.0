import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import { SUI_DECIMALS } from "@/lib/sui";
import { SuiGlyph } from "./sui-glyph";

const MIST_PER_SUI = 1_000_000_000n;

export function SuiAmount({
  mist,
  compact = false,
  maxFractionDigits = 2,
  adaptive = false,
  showGlyph = true,
  glyphSize = 12,
  className,
}: {
  mist: bigint | string | number;
  compact?: boolean;
  maxFractionDigits?: number;
  /**
   * When true, auto-expand precision so sub-cent values don't round to
   * "0.00". Tiers mirror the policy on the pool-hero rate display:
   *
   *   · ≥ 0.01 SUI  → use `maxFractionDigits` (default 2)
   *   · ≥ 1e-6 SUI  → 6 fraction digits
   *   · < 1e-6 SUI  → 9 fraction digits (full nano-SUI granularity)
   *
   * Also disables `compact` for sub-1-SUI values because compact mode
   * internally caps fraction digits to 2 — which is the bug this
   * setting fixes for stat cells like Reserve and Paid Out on dust-
   * grade pools (e.g. 0.0001 SUI would otherwise display as "0.00").
   */
  adaptive?: boolean;
  showGlyph?: boolean;
  glyphSize?: number;
  className?: string;
}) {
  // Convert the input to a comparable bigint of mist so we can pick a
  // precision tier without re-parsing through BigNumber. Treats numeric
  // / string input as a base mist value (same contract formatAmount uses).
  let mistAbs = 0n;
  try {
    const asBig =
      typeof mist === "bigint" ? mist : BigInt(Math.trunc(Number(mist)));
    mistAbs = asBig < 0n ? -asBig : asBig;
  } catch {
    mistAbs = 0n;
  }

  let effectiveDigits = maxFractionDigits;
  let effectiveCompact = compact;

  if (adaptive && mistAbs > 0n) {
    // 0.01 SUI = 1e7 mist; 1e-6 SUI = 1e3 mist.
    if (mistAbs >= 10_000_000n) {
      effectiveDigits = Math.max(2, maxFractionDigits);
    } else if (mistAbs >= 1_000n) {
      effectiveDigits = 6;
      if (mistAbs < MIST_PER_SUI) effectiveCompact = false;
    } else {
      effectiveDigits = 9;
      if (mistAbs < MIST_PER_SUI) effectiveCompact = false;
    }
  }

  const text = formatAmount(mist, {
    decimals: SUI_DECIMALS,
    compact: effectiveCompact,
    maxFractionDigits: effectiveDigits,
  });
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono tabular-nums",
        className,
      )}
    >
      {showGlyph && <SuiGlyph size={glyphSize} className="text-ink/70" />}
      <span>{text}</span>
    </span>
  );
}
