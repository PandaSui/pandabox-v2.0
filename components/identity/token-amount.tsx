import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/amount";

export function TokenAmount({
  raw,
  decimals = 0,
  ticker,
  compact = false,
  maxFractionDigits = 2,
  className,
}: {
  raw: bigint | string | number;
  decimals?: number;
  ticker?: string;
  compact?: boolean;
  maxFractionDigits?: number;
  className?: string;
}) {
  const text = formatAmount(raw, { decimals, compact, maxFractionDigits });
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono tabular-nums",
        className,
      )}
    >
      <span>{text}</span>
      {ticker && (
        <span className="font-mono-label text-ink/50">{ticker}</span>
      )}
    </span>
  );
}
