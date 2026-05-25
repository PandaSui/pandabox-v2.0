import { MonoLabel } from "@/components/primitives/mono-label";
import type { HydratedPool } from "@/lib/redeem/discovery";

/**
 * "About this pool" panel — the trust copy holders read before signing.
 * Three short blocks:
 *
 *   1. What the pool does (one sentence, mode-aware: burn vs buyback).
 *   2. Permanence callout (the contract-level invariant — no setter on
 *      `price_mist_per_token` or `recipient`).
 *   3. Fee disclosure (the platform takes a fixed bps from gross SUI).
 *
 * Plain prose, hairline-bordered. Sits in the center column below the
 * hero and above the activity feed.
 */
export function AboutPool({
  data,
  feeBps,
}: {
  data: HydratedPool;
  feeBps: number;
}) {
  const { pool, metadata } = data;
  const symbol = metadata.symbol;
  const feePct = (feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2);

  const summary =
    pool.recipientMode === "burn"
      ? `When a holder redeems, their ${symbol} is routed to a burn address — the supply drops by exactly that amount. The pool's SUI reserve pays out the corresponding value at the fixed exchange rate.`
      : `When a holder redeems, their ${symbol} is routed to the project's recipient address for a buyback — circulating supply shrinks for the project, and the holder receives SUI at the fixed rate from the pool's reserve.`;

  return (
    <section className="border border-ink/15 bg-bone">
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">About this pool</MonoLabel>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          permanent terms
        </span>
      </header>

      <div className="space-y-5 px-5 py-5">
        <Block heading="How it works">
          <p className="text-[14px] leading-relaxed text-ink/75">{summary}</p>
        </Block>

        <Block heading="Permanence">
          <p className="text-[14px] leading-relaxed text-ink/75">
            The exchange rate ({" "}
            <code className="font-mono text-[12.5px] text-ink">price_mist_per_token</code>{" "}
            ) and the recipient address were locked at deploy time. The
            contract has no setter for either — no admin can change them, no
            governance can override them. Only the depth of the SUI reserve
            changes as people redeem and deposit.
          </p>
        </Block>

        <Block heading="Fee">
          <p className="text-[14px] leading-relaxed text-ink/75">
            Pandabox takes a{" "}
            <span className="font-mono font-semibold text-ink">{feePct}%</span>{" "}
            platform fee from the gross SUI on every redeem. The net SUI
            shown in the redeem panel already accounts for it.
          </p>
        </Block>
      </div>
    </section>
  );
}

function Block({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink/65">
        {heading}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
