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
    <section aria-label={t("title")}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-ink/15 pb-3">
        <div className="flex items-baseline gap-2.5">
          <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
          {items.length > 0 && (
            <span className="font-mono text-[10.5px] tabular-nums text-ink/40">
              {items.length}
            </span>
          )}
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          {items.length === 0 ? t("noEventsYet") : t("newestFirst")}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
            {t("listening")}
          </p>
          <p className="mt-2 text-[13px] text-ink/55">{t("beTheFirst")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink/10">
          {items.map((ev) => (
            <ActivityRow
              key={`${ev.txDigest}-${ev.kind}`}
              ev={ev}
              symbol={symbol}
              coinDecimals={coinDecimals}
              labels={{
                redeem: t("kindRedeem"),
                deposit: t("kindDeposit"),
                created: t("kindCreated"),
                addReserve: t("addReserve"),
                initialDeposit: t("initialDeposit"),
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One activity row. Layout:
 *
 *   ┌─ kind pill ─┬─ actor + amounts (grows, wraps last) ──────────┬─ time + ↗ ─┐
 *   │ ● REDEEM    │ by 0xab…cd · 100.00 FOMO → ◆ 0.00 SUI (fee …) │ 10d ago ↗  │
 *
 * The 12-col grid used previously starved the time/hash column when the
 * pool detail page wraps the feed into a 5/12 lane, causing both the tx
 * hash text and the relative-time string to break across two lines. A
 * flex layout with fixed left/right cells and a flex-1 middle that wraps
 * its own children keeps each row to one line at the widths the page
 * actually serves, and degrades to two lines (kind+meta on top, content
 * below) only at narrow widths where stacking is the right call.
 */
function ActivityRow({
  ev,
  symbol,
  coinDecimals,
  labels,
}: {
  ev: PoolActivity;
  symbol: string;
  coinDecimals: number;
  labels: {
    redeem: string;
    deposit: string;
    created: string;
    addReserve: string;
    initialDeposit: string;
  };
}) {
  // Each kind picks the actor address the user cares about: redeems
  // show the redeemer, deposits show the depositor, creates show the
  // pool's creator (the dev who deployed it).
  const actor =
    ev.kind === "redeemed"
      ? ev.redeemer
      : ev.kind === "deposited"
        ? ev.depositor
        : ev.creator;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 transition-colors hover:bg-ink/[0.02]">
      <KindPill kind={ev.kind} labels={labels} />

      <Address value={actor} className="text-ink/65" copyable={false} />

      <div className="min-w-0 flex-1 font-mono text-[12px] tabular-nums">
        {ev.kind === "redeemed" && (
          <RedeemAmounts
            ev={ev}
            symbol={symbol}
            coinDecimals={coinDecimals}
          />
        )}
        {ev.kind === "deposited" && (
          <DepositAmounts ev={ev} addReserveLabel={labels.addReserve} />
        )}
        {ev.kind === "created" && (
          <CreatedAmounts ev={ev} initialDepositLabel={labels.initialDeposit} />
        )}
      </div>

      <div className="inline-flex shrink-0 items-center gap-2.5 font-mono text-[10.5px] text-ink/45">
        <RelativeTime value={ev.timestampMs} className="whitespace-nowrap" />
        <TxHash value={ev.txDigest} copyable={false} head={4} tail={4} />
      </div>
    </li>
  );
}

function KindPill({
  kind,
  labels,
}: {
  kind: PoolActivity["kind"];
  labels: { redeem: string; deposit: string; created: string };
}) {
  // Color map:
  //   · redeemed  → poppy (outflow from the pool's reserve)
  //   · deposited → jade  (inflow to the reserve from anyone)
  //   · created   → sun   (origin event — the pool itself starting)
  const tone =
    kind === "redeemed" ? "poppy" : kind === "deposited" ? "jade" : "sun";
  const label =
    kind === "redeemed"
      ? labels.redeem
      : kind === "deposited"
        ? labels.deposit
        : labels.created;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
        tone === "poppy" && "text-poppy",
        tone === "jade" && "text-jade",
        tone === "sun" && "text-ink/75",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block h-1.5 w-1.5",
          tone === "poppy" && "bg-poppy",
          tone === "jade" && "bg-jade",
          tone === "sun" && "bg-sun",
        )}
      />
      {label}
    </span>
  );
}

function RedeemAmounts({
  ev,
  symbol,
  coinDecimals,
}: {
  ev: Extract<PoolActivity, { kind: "redeemed" }>;
  symbol: string;
  coinDecimals: number;
}) {
  // Platform fee is already disclosed at the page level — surfacing
  // `fee 0.0000` on every row reads as noise rather than information.
  // Keep the row to the two amounts the user cares about: what was sold
  // in, what came out.
  return (
    <div className="inline-flex items-baseline gap-2">
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
    </div>
  );
}

function DepositAmounts({
  ev,
  addReserveLabel,
}: {
  ev: Extract<PoolActivity, { kind: "deposited" }>;
  addReserveLabel: string;
}) {
  return (
    <div className="inline-flex items-baseline gap-2">
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
  );
}

function CreatedAmounts({
  ev,
  initialDepositLabel,
}: {
  ev: Extract<PoolActivity, { kind: "created" }>;
  initialDepositLabel: string;
}) {
  return (
    <div className="inline-flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
        {initialDepositLabel}
      </span>
      <SuiAmount
        mist={ev.initialDepositMist}
        compact
        maxFractionDigits={4}
        glyphSize={10}
        className="text-ink"
      />
    </div>
  );
}
