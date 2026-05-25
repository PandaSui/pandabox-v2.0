import { getTranslations } from "next-intl/server";
import { cn } from "@pandasui/ui/lib";
import { Address } from "@/components/identity/address";
import { RelativeTime } from "@/components/identity/relative-time";
import { TxHash } from "@/components/identity/tx-hash";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import { formatAmount } from "@/lib/amount";
import type { PoolActivity } from "@/lib/redeem/pool-activity";

/**
 * Pool-scoped activity stream. Renders Redeemed + ReserveDeposited events
 * for this specific pool in newest-first order, each row showing actor /
 * direction / amounts / tx link. Dense mono table aesthetic — same
 * vocabulary as the launchpad's project activity feed.
 *
 * Empty state acknowledges the pool exists but has no activity yet,
 * rather than reading as a broken fetch.
 */
export async function PoolActivityFeed({
  items,
  symbol,
  coinDecimals,
}: {
  items: PoolActivity[];
  symbol: string;
  coinDecimals: number;
}) {
  const t = await getTranslations("redeem.detail.activity");
  return (
    <section className="border border-ink/15 bg-bone">
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          {items.length === 0
            ? t("noEventsYet")
            : t("recentNewestFirst", { count: items.length })}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
            {t("listening")}
          </p>
          <p className="mt-2 text-[13px] text-ink/55">{t("beTheFirst")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink/10">
          {items.map((ev) => (
            <li
              key={`${ev.txDigest}-${ev.kind}`}
              className="grid grid-cols-12 items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/[0.015]"
            >
              <KindCell ev={ev} redeemLabel={t("kindRedeem")} depositLabel={t("kindDeposit")} />
              <ActorCell ev={ev} byLabel={t("by")} />
              <AmountsCell
                ev={ev}
                symbol={symbol}
                coinDecimals={coinDecimals}
                feeLabel={t("feeShort", { value: "" })}
                addReserveLabel={t("addReserve")}
              />
              <MetaCell ev={ev} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KindCell({
  ev,
  redeemLabel,
  depositLabel,
}: {
  ev: PoolActivity;
  redeemLabel: string;
  depositLabel: string;
}) {
  const isRedeem = ev.kind === "redeemed";
  return (
    <div className="col-span-3 sm:col-span-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
          isRedeem ? "text-poppy" : "text-jade",
        )}
      >
        <span
          aria-hidden
          className={cn("block h-1.5 w-1.5", isRedeem ? "bg-poppy" : "bg-jade")}
        />
        {isRedeem ? redeemLabel : depositLabel}
      </span>
    </div>
  );
}

function ActorCell({ ev, byLabel }: { ev: PoolActivity; byLabel: string }) {
  const actor = ev.kind === "redeemed" ? ev.redeemer : ev.depositor;
  return (
    <div className="col-span-9 min-w-0 font-mono text-[11.5px] text-ink/65 sm:col-span-3">
      <span className="mr-1 uppercase tracking-[0.14em] text-ink/40">{byLabel}</span>
      <Address value={actor} className="text-ink/85" copyable={false} />
    </div>
  );
}

function AmountsCell({
  ev,
  symbol,
  coinDecimals,
  feeLabel,
  addReserveLabel,
}: {
  ev: PoolActivity;
  symbol: string;
  coinDecimals: number;
  feeLabel: string;
  addReserveLabel: string;
}) {
  if (ev.kind === "redeemed") {
    const feeValue = formatAmount(ev.feeMist, {
      decimals: 9,
      compact: true,
      maxFractionDigits: 4,
    });
    return (
      <div className="col-span-7 sm:col-span-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] tabular-nums">
          <span className="text-ink/80">
            {formatAmount(ev.coinIn, {
              decimals: coinDecimals,
              compact: true,
              maxFractionDigits: 2,
            })}{" "}
            <span className="text-[10px] uppercase tracking-[0.06em] text-ink/55">
              {symbol}
            </span>
          </span>
          <span aria-hidden className="text-ink/25">→</span>
          <SuiAmount
            mist={ev.suiOutMist}
            compact
            maxFractionDigits={4}
            glyphSize={10}
            className="text-ink"
          />
          <span className="font-mono text-[10px] text-ink/40">
            ({feeLabel.trim()} {feeValue})
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="col-span-7 sm:col-span-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] tabular-nums">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
          {addReserveLabel}
        </span>
        <SuiAmount
          mist={ev.amountMist}
          compact
          maxFractionDigits={4}
          glyphSize={10}
          className="text-ink"
        />
      </div>
    </div>
  );
}

function MetaCell({ ev }: { ev: PoolActivity }) {
  return (
    <div className="col-span-5 flex items-center justify-end gap-3 font-mono text-[10.5px] text-ink/45 sm:col-span-2">
      <RelativeTime value={ev.timestampMs} />
      <TxHash value={ev.txDigest} copyable={false} />
    </div>
  );
}
