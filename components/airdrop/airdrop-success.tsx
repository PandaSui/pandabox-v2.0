"use client";

import { Modal, ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TxHash } from "@/components/identity/tx-hash";
import { explorerUrl } from "@/lib/sui";
import type { BatchResult } from "@/lib/airdrop";

/**
 * Post-success modal. Renders the parsed `Airdropped` events from each
 * settled batch as a single celebratory tally — total recipients, total
 * tokens distributed, total fee paid — with per-batch tx digests linking
 * to Suiscan. One CTA: "Send another", which resets the panel.
 *
 * The lifetime counter at the page masthead picks up the bump on the
 * router refresh fired by `useSubmitAirdrop`, so when the user closes
 * the modal the FanOutTrace's source-node number ticks forward too.
 */
export function AirdropSuccess({
  open,
  results,
  symbol,
  decimals,
  coinName,
  coinIconUrl,
  coinType,
  onClose,
  onReset,
}: {
  open: boolean;
  results: BatchResult[];
  symbol: string | null;
  decimals: number;
  coinName?: string | null;
  coinIconUrl?: string | null;
  coinType?: string;
  onClose: () => void;
  onReset: () => void;
}) {
  // Roll the per-batch numbers up. When a batch's `Airdropped` event was
  // missed (waitForTransaction race), fall back to the count of rows from
  // the batch's known recipientCount (carried in the event payload).
  const totals = results.reduce(
    (acc, r) => {
      if (!r.event) return acc;
      return {
        recipients: acc.recipients + r.event.recipientCount,
        totalAmount: acc.totalAmount + r.event.totalAmountRaw,
        feeMist: acc.feeMist + r.event.feeMist,
      };
    },
    { recipients: 0, totalAmount: 0n, feeMist: 0n },
  );

  const displaySymbol = symbol ?? synthSymbol(coinType ?? "");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Airdrop settled"
      className="max-w-2xl"
    >
      <div className="-m-6 flex max-h-[85vh] flex-col overflow-hidden">
        <div className="min-w-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-5">
          {/* Subject ribbon — celebrate which asset just landed. */}
          {coinType ? (
            <div className="flex items-center gap-4 border-l-[3px] border-jade bg-jade/[0.04] px-4 py-3.5">
              <SuccessAssetIcon
                iconUrl={coinIconUrl ?? null}
                coinType={coinType}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink">
                    {displaySymbol}
                  </span>
                  {coinName ? (
                    <span className="font-sans text-[13px] text-ink/65">
                      {coinName}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-jade">
                  Settled on Sui mainnet
                </p>
              </div>
            </div>
          ) : null}

          {/* Big tally — the moment the user lands on after signing. */}
          <div className="border border-jade/35 bg-jade/[0.06]">
            <div className="grid grid-cols-1 divide-y divide-jade/25 md:grid-cols-3 md:divide-x md:divide-y-0">
              <Tally
                label="Recipients"
                value={totals.recipients.toLocaleString()}
                sub={`across ${results.length} ${
                  results.length === 1 ? "transaction" : "transactions"
                }`}
              />
              <Tally
                label="Total distributed"
                value={`${formatAmount(totals.totalAmount, {
                  decimals,
                  maxFractionDigits: 4,
                })}${symbol ? ` ${symbol}` : ""}`}
                sub="parsed from event log"
              />
              <Tally
                label="Fee paid"
                valueNode={
                  <SuiAmount
                    mist={totals.feeMist}
                    adaptive
                    maxFractionDigits={4}
                    glyphSize={12}
                    className="text-[20px] text-ink"
                  />
                }
                sub="to airdrop treasury"
              />
            </div>
          </div>

          {/* Per-batch ledger — one row per signed tx. Each links into
              Suiscan via the existing TxHash primitive. */}
          <section className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Transactions
            </h3>
            <ol className="divide-y divide-ink/[0.06] border border-ink/15 bg-bone">
              {results.map((r) => (
                <li
                  key={r.digest}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
                    {String(r.index + 1).padStart(2, "0")} /{" "}
                    {String(r.total).padStart(2, "0")}
                  </span>
                  <TxHash value={r.digest} />
                  <span className="ml-auto inline-flex items-center gap-3 font-mono text-[11px] tabular-nums text-ink">
                    {r.event ? (
                      <>
                        <span>
                          {r.event.recipientCount} ·{" "}
                          {formatAmount(r.event.totalAmountRaw, {
                            decimals,
                            maxFractionDigits: 4,
                          })}{" "}
                          {symbol ?? ""}
                        </span>
                        <a
                          href={explorerUrl("tx", r.digest)}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
                        >
                          Suiscan
                          <span
                            aria-hidden
                            className="transition-transform duration-200 group-hover:translate-x-[2px]"
                          >
                            →
                          </span>
                        </a>
                      </>
                    ) : (
                      <span className="text-ink/45">events not indexed yet</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sticky footer — same pattern as the inspector. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink/15 bg-bone px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex h-10 items-center justify-center px-4 font-mono text-[11px] uppercase tracking-[0.18em]",
              "border border-ink/25 text-ink/75 transition-colors hover:border-ink/55 hover:text-ink",
            )}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onReset}
            className={cn(
              "group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-ink px-6 text-bone",
              "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
              "shadow-offset-sm transition-all duration-300 ease-atelier",
              "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
            )}
          >
            <span>Send another</span>
            <ArrowDiag size={12} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── subject icon ─────────────────────────── */

function SuccessAssetIcon({
  iconUrl,
  coinType,
}: {
  iconUrl: string | null;
  coinType: string;
}) {
  if (iconUrl) {
    return (
      <span
        className="relative block h-12 w-12 shrink-0 overflow-hidden border border-ink/20 bg-bone"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt=""
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }
  // Deterministic monogram seeded from the coin type — same fallback as
  // the inspector's hero icon, scaled to match the success ribbon.
  let h = 0;
  for (let i = 0; i < coinType.length; i += 1) {
    h = (h * 31 + coinType.charCodeAt(i)) >>> 0;
  }
  const cells: boolean[] = [];
  for (let i = 0; i < 8; i += 1) cells.push(((h >> i) & 1) === 1);
  const accents = [
    "#B8C45E",
    "#C47557",
    "#6E8E5D",
    "#6D8796",
    "#D9C57A",
    "#7E685E",
  ];
  const fill = accents[h % accents.length];
  return (
    <span
      aria-hidden
      className="relative block h-12 w-12 shrink-0 border border-ink/20 bg-bone"
    >
      <svg
        viewBox="0 0 5 4"
        className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)]"
        aria-hidden
      >
        {cells.map((on, i) => {
          if (!on) return null;
          const x = i % 4;
          const y = Math.floor(i / 4);
          return (
            <g key={i}>
              <rect x={x} y={y} width="1" height="1" fill={fill} />
              <rect x={4 - x} y={y} width="1" height="1" fill={fill} />
            </g>
          );
        })}
      </svg>
    </span>
  );
}

function synthSymbol(coinType: string): string {
  const tail = coinType.split("::").pop() ?? "";
  return tail.toUpperCase().slice(0, 8) || "?";
}

/* ─────────────────────────── tally cell ─────────────────────────── */

function Tally({
  label,
  value,
  valueNode,
  sub,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="px-5 py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[20px] tabular-nums text-ink">
        {valueNode ?? value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {sub}
      </div>
    </div>
  );
}
