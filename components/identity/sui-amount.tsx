import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import { SUI_DECIMALS } from "@/lib/sui";
import { SuiGlyph } from "./sui-glyph";

export function SuiAmount({
  mist,
  compact = false,
  maxFractionDigits = 2,
  showGlyph = true,
  glyphSize = 12,
  className,
}: {
  mist: bigint | string | number;
  compact?: boolean;
  maxFractionDigits?: number;
  showGlyph?: boolean;
  glyphSize?: number;
  className?: string;
}) {
  const text = formatAmount(mist, {
    decimals: SUI_DECIMALS,
    compact,
    maxFractionDigits,
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
