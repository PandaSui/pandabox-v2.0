import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { Identicon } from "@/components/identity/identicon";
import { TokenAmount } from "@/components/identity/token-amount";
import type { HolderDTO } from "@/lib/api/project-dto";

export function HoldersTable({
  holders,
  ticker,
  topN = 25,
  decimals = 9,
  className,
}: {
  holders: HolderDTO[];
  ticker: string;
  topN?: number;
  decimals?: number;
  className?: string;
}) {
  const top = holders.slice(0, topN);
  const rest = holders.slice(topN);
  const restCount = rest.length;
  const restPct = rest.reduce((a, h) => a + h.pctSupply, 0);
  const restBalance = rest.reduce(
    (a, h) => a + BigInt(h.balanceRaw),
    0n,
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-[2.5rem_1fr_8rem_5rem] items-center gap-3 border-b border-ink/15 py-2 text-xs">
        <MonoLabel>#</MonoLabel>
        <MonoLabel>Address</MonoLabel>
        <MonoLabel className="text-right block">Balance</MonoLabel>
        <MonoLabel className="text-right block">%</MonoLabel>
      </div>

      {top.map((h, i) => (
        <div
          key={h.address}
          className="grid grid-cols-[2.5rem_1fr_8rem_5rem] items-center gap-3 border-b border-ink/10 py-2 text-xs"
        >
          <span className="font-mono tabular-nums text-ink/45">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <Identicon value={h.address} size={18} />
            <Address value={h.address} copyable={false} link />
          </span>
          <span className="text-right">
            <TokenAmount
              raw={h.balanceRaw}
              decimals={decimals}
              ticker={ticker}
              compact
              className="text-xs"
            />
          </span>
          <span className="text-right font-mono tabular-nums">
            {h.pctSupply.toFixed(2)}%
          </span>
        </div>
      ))}

      {restCount > 0 && (
        <div className="grid grid-cols-[2.5rem_1fr_8rem_5rem] items-center gap-3 border-b border-ink/10 bg-bone/40 py-2 text-xs">
          <span />
          <span className="text-ink/55">
            Others — {restCount.toLocaleString()} addresses
          </span>
          <span className="text-right">
            <TokenAmount
              raw={restBalance.toString()}
              decimals={decimals}
              ticker={ticker}
              compact
              className="text-xs text-ink/70"
            />
          </span>
          <span className="text-right font-mono tabular-nums text-ink/70">
            {restPct.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
