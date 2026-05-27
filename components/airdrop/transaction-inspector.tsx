"use client";

import { Modal, ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import { SuiAmount } from "@/components/identity/sui-amount";
import { Address } from "@/components/identity/address";
import { Spinner } from "@/components/primitives/spinner";
import {
  AIRDROP_PACKAGE_ID,
  AIRDROP_PLATFORM_ID,
} from "@/lib/contracts/airdrop";
import type { AirdropBatch, AirdropQuote, SubmitState } from "@/lib/airdrop";

/**
 * Pre-sign + in-flight audit modal. Has two looks driven by `state`:
 *
 *   - **idle / inspecting** — full audit view: recipient summary, fee
 *     destination, exact Move target, per-batch breakdown, optional
 *     memo, big "Confirm & sign" CTA.
 *   - **signing / confirming** — the same chrome, but the CTA is
 *     replaced with a batched progress strip showing which batch is
 *     in-flight and which have settled.
 *
 * Why one modal for both: the user doesn't want to lose context of what
 * they're about to send when the wallet prompts. Keeping the audit
 * visible behind the wallet sheet is the right read.
 */
export function TransactionInspector({
  open,
  state,
  onClose,
  onConfirm,
  onRestart,
  coinType,
  symbol,
  decimals,
  coinName,
  coinIconUrl,
  quote,
  batches,
  treasuryAddress,
  memo,
}: {
  open: boolean;
  state: SubmitState;
  onClose: () => void;
  onConfirm: () => void;
  /** Discard partial completion and re-run from batch 1. */
  onRestart: () => void;
  coinType: string;
  symbol: string | null;
  decimals: number;
  /** Display name resolved from CoinMetadata (e.g. "Energies"). */
  coinName?: string | null;
  /** Asset icon from CoinMetadata, when available. */
  coinIconUrl?: string | null;
  quote: AirdropQuote;
  batches: AirdropBatch[];
  treasuryAddress: string;
  memo: string;
}) {
  const isInFlight =
    state.kind === "dry-running" ||
    state.kind === "signing" ||
    state.kind === "confirming";
  const isInspecting = state.kind === "inspecting";
  // When the previous run errored mid-flight, surface the partial-completion
  // affordance — "Resume — 2 batches left" + a secondary "Start over"
  // option. Empty partial means a fresh retry from batch 1 is the only
  // sensible path; we just relabel the primary button accordingly.
  const partialCount =
    state.kind === "error" ? state.partial.length : 0;
  const hasPartial = partialCount > 0;
  const remainingBatches = batches.length - partialCount;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transaction inspector"
      className="max-w-2xl"
    >
      <div className="-m-6 flex max-h-[85vh] flex-col overflow-hidden">
        <div className="min-w-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-5">
          {/* ── Subject hero — what you're sending ───────────────── */}
          <SubjectHero
            symbol={symbol}
            coinName={coinName ?? null}
            coinIconUrl={coinIconUrl ?? null}
            coinType={coinType}
            quote={quote}
            decimals={decimals}
          />

          {/* ── Summary grid ─────────────────────────────────────── */}
          <SummaryGrid
            quote={quote}
            batchCount={batches.length}
            decimals={decimals}
            symbol={symbol}
          />

          {/* ── Move call audit ──────────────────────────────────── */}
          <Section title="Move call">
            <KvBlock>
              <KvRow
                label="function"
                value="airdrop::airdrop"
                mono
                hint="generic over coin type T"
              />
              <KvRow
                label="package"
                value={AIRDROP_PACKAGE_ID}
                mono
                truncate="middle"
                hint="Sui mainnet"
              />
              <KvRow
                label="platform"
                value={AIRDROP_PLATFORM_ID}
                mono
                truncate="middle"
                hint="shared · mutable ref"
              />
              <KvRow
                label="coin"
                value={coinType}
                mono
                truncate="middle"
              />
              <KvRow
                label="memo"
                value={memo ? `"${memo}"` : "—"}
                hint={memo ? "recorded on-chain" : "optional"}
                wrap
              />
            </KvBlock>
          </Section>

          {/* ── Fee destination ──────────────────────────────────── */}
          <Section title="Fee destination">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border border-ink/15 bg-bone px-3 py-2.5">
              <Address value={treasuryAddress} link />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
                Airdrop treasury
              </span>
            </div>
          </Section>

        {/* ── Batch breakdown ───────────────────────────────────── */}
        <Section title={`Batches · ${batches.length}`}>
          {batches.length > 1 ? (
            <BatchProgress
              batches={batches}
              state={state}
              symbol={symbol}
              decimals={decimals}
            />
          ) : (
            <div className="border border-ink/15 bg-bone px-3 py-2.5">
              <div className="flex items-center justify-between font-mono text-[11px] text-ink">
                <span>
                  {batches[0]?.rows.length ?? 0} recipients · one signed PTB
                </span>
                {state.kind === "dry-running" ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
                    <Spinner size={10} className="text-ink/55" />
                    pre-flight check
                  </span>
                ) : state.kind === "signing" ? (
                  <Spinner size={12} className="text-poppy" />
                ) : state.kind === "confirming" ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-sky">
                    awaiting confirmation
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </Section>

          {/* ── Error banner ───────────────────────────────────── */}
          {state.kind === "error" ? (
            <div className="break-words border border-poppy/45 bg-poppy/10 px-3 py-2.5 font-mono text-[11px] text-poppy">
              {state.message}
            </div>
          ) : null}
        </div>

        {/* ── Footer CTA (sticky outside the scroll container) ────
            Stacks vertically below sm — primary action on top, cancel
            below — so the affordances stay full-width and tappable on
            phones. On sm+ they sit on a single row with cancel left
            and primary right. */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-ink/15 bg-bone px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isInFlight}
            className={cn(
              "inline-flex h-10 w-full items-center justify-center px-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:w-auto",
              "border border-ink/25 text-ink/75 transition-colors hover:border-ink/55 hover:text-ink",
              isInFlight && "cursor-not-allowed opacity-40",
            )}
          >
            {isInFlight ? "Working…" : "Cancel"}
          </button>

          {isInFlight ? (
            <InFlightLabel state={state} />
          ) : (
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
              {/* Secondary "Start over" — only shown when there's partial
                  completion to discard. Mid-flight errors after one or
                  two settled batches are the common case; we want the
                  user to know they can re-sign every batch if they
                  prefer (e.g. they want to change the memo or list). */}
              {state.kind === "error" && hasPartial ? (
                <button
                  type="button"
                  onClick={onRestart}
                  className={cn(
                    "inline-flex h-10 w-full items-center justify-center px-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:w-auto",
                    "border border-ink/25 text-ink/75 transition-colors hover:border-ink/55 hover:text-ink",
                  )}
                  title="Discards partial completion and re-runs the whole list"
                >
                  Start over
                </button>
              ) : null}
              <button
                type="button"
                onClick={onConfirm}
                disabled={!isInspecting && state.kind !== "error"}
                className={cn(
                  "group inline-flex h-12 w-full items-center justify-center gap-2 border border-ink bg-ink px-6 text-bone sm:w-auto",
                  "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
                  "shadow-offset-sm transition-all duration-300 ease-atelier",
                  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm",
                )}
              >
                <span className="truncate">
                  {primaryLabel(state, hasPartial, remainingBatches, batches.length)}
                </span>
                <ArrowDiag size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── subviews ─────────────────────────── */

function SummaryGrid({
  quote,
  batchCount,
  decimals,
  symbol,
}: {
  quote: AirdropQuote;
  batchCount: number;
  decimals: number;
  symbol: string | null;
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-ink/10 border border-ink/15 bg-bone md:grid-cols-4 md:divide-y-0">
      <Cell
        label="Recipients"
        value={`${quote.recipientCount.toLocaleString()}`}
        sub={batchCount > 1 ? `${batchCount} batches` : "1 batch"}
        accent="bg-poppy"
      />
      <Cell
        label="Total tokens"
        value={`${formatAmount(quote.totalAmountRaw, {
          decimals,
          maxFractionDigits: 4,
        })}${symbol ? ` ${symbol}` : ""}`}
        sub="distributed"
        accent="bg-jade"
      />
      <Cell
        label="Platform fee"
        valueNode={
          <SuiAmount
            mist={quote.feeMist}
            adaptive
            maxFractionDigits={4}
            glyphSize={11}
            className="text-[15px] text-ink"
          />
        }
        sub="to treasury"
        accent="bg-sky"
      />
      <Cell
        label="SUI budget"
        valueNode={
          <SuiAmount
            mist={quote.totalSuiBudgetMist}
            adaptive
            maxFractionDigits={4}
            glyphSize={11}
            className="text-[15px] text-ink"
          />
        }
        sub="fee + est. gas"
        accent="bg-ink/45"
      />
    </div>
  );
}

function Cell({
  label,
  value,
  valueNode,
  sub,
  accent,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  sub: string;
  accent: string;
}) {
  return (
    <div className="relative px-4 py-4">
      <span
        aria-hidden
        className={cn("absolute left-0 top-4 block h-[10px] w-[3px]", accent)}
      />
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </div>
      <div className="mt-1 font-mono text-[15px] tabular-nums text-ink">
        {valueNode ?? value}
      </div>
      <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/40">
        {sub}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Subject hero — the modal's identity moment. Shows the airdropped asset
 * (icon + symbol + name) alongside a one-line summary of what's about
 * to be sent. Replaces the redundant "TOTAL TOKENS" cell in the summary
 * grid as the user's first visual anchor.
 */
function SubjectHero({
  symbol,
  coinName,
  coinIconUrl,
  coinType,
  quote,
  decimals,
}: {
  symbol: string | null;
  coinName: string | null;
  coinIconUrl: string | null;
  coinType: string;
  quote: AirdropQuote;
  decimals: number;
}) {
  const totalDisplay = formatAmount(quote.totalAmountRaw, {
    decimals,
    maxFractionDigits: 4,
  });
  const displaySymbol = symbol ?? synthSymbol(coinType);
  const displayName = coinName ?? "Asset";
  return (
    <div className="flex items-start gap-4 border-l-[3px] border-poppy bg-ink/[0.02] px-4 py-4">
      <AssetIcon iconUrl={coinIconUrl} coinType={coinType} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink">
            {displaySymbol}
          </span>
          <span className="font-sans text-[13px] text-ink/65">
            {displayName}
          </span>
        </div>
        <p className="mt-1.5 font-mono text-[12.5px] tabular-nums text-ink/85">
          Sending{" "}
          <span className="text-ink">
            {totalDisplay} {displaySymbol}
          </span>{" "}
          to{" "}
          <span className="text-ink">
            {quote.recipientCount.toLocaleString()}{" "}
            {quote.recipientCount === 1 ? "wallet" : "wallets"}
          </span>
          {quote.batchCount > 1 ? (
            <span className="text-ink/55">
              {" · "}
              {quote.batchCount} signed PTBs
            </span>
          ) : null}
        </p>
        <p
          className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45"
          title={coinType}
        >
          {coinType}
        </p>
      </div>
    </div>
  );
}

function AssetIcon({
  iconUrl,
  coinType,
}: {
  iconUrl: string | null;
  coinType: string;
}) {
  if (iconUrl) {
    return (
      <span
        className="relative block h-11 w-11 shrink-0 overflow-hidden border border-ink/20 bg-bone"
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
  // Deterministic pixel monogram seeded from the coin type. Same fallback
  // pattern as the picker, scaled up for the hero.
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
      className="relative block h-11 w-11 shrink-0 border border-ink/20 bg-bone"
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

/**
 * Key/value rows for the Move-call audit. Built to never overflow the
 * modal:
 *
 *   · `label` is fixed-width on wide viewports, stacks above the value
 *     on narrow ones (grid auto-flow handles the breakpoint).
 *   · `value` uses `break-all` so long mono strings wrap inside the
 *     allocated column instead of pushing the layout sideways.
 *   · `truncate: "middle"` middle-truncates very long values (package
 *     IDs, coin types) to a single line and exposes the full string via
 *     a `title` attribute for hover/copy.
 */
function KvBlock({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-ink/[0.06] border border-ink/15 bg-bone">
      {children}
    </ul>
  );
}

function KvRow({
  label,
  value,
  hint,
  mono = false,
  truncate,
  wrap = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  truncate?: "middle";
  wrap?: boolean;
}) {
  const displayValue =
    truncate === "middle" ? truncMiddle(value, 14) : value;
  return (
    <li className="grid grid-cols-1 items-baseline gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[88px_1fr]">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
        {label}
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span
          title={truncate ? value : undefined}
          className={cn(
            "min-w-0 text-ink",
            mono && "font-mono text-[11.5px] tabular-nums",
            // `break-all` is the right choice for hex addresses + Move
            // type tags — they have no natural break opportunities, so
            // `break-words` leaves them as one giant atom. `wrap` opts
            // out for memo content where mid-word breaks would be ugly.
            wrap ? "whitespace-pre-wrap break-words" : "break-all",
          )}
        >
          {displayValue}
        </span>
        {hint ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {hint}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function synthSymbol(coinType: string): string {
  const tail = coinType.split("::").pop() ?? "";
  return tail.toUpperCase().slice(0, 8) || "?";
}

function BatchProgress({
  batches,
  state,
  symbol,
  decimals,
}: {
  batches: AirdropBatch[];
  state: SubmitState;
  symbol: string | null;
  decimals: number;
}) {
  const completedIndices = new Set<number>(
    state.kind === "dry-running" ||
      state.kind === "signing" ||
      state.kind === "confirming"
      ? state.completed.map((r) => r.index)
      : state.kind === "success"
        ? state.results.map((r) => r.index)
        : state.kind === "error"
          ? state.partial.map((r) => r.index)
          : [],
  );
  const inflightIndex =
    state.kind === "dry-running" ||
    state.kind === "signing" ||
    state.kind === "confirming"
      ? state.batchIndex
      : -1;

  return (
    <ol className="divide-y divide-ink/[0.06] border border-ink/15 bg-bone">
      {batches.map((b) => {
        const isDone = completedIndices.has(b.index);
        const isCurrent = b.index === inflightIndex;
        return (
          <li
            key={b.index}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 transition-colors",
              isCurrent && "bg-poppy/[0.06]",
              isDone && "opacity-65",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "block h-1.5 w-1.5 rounded-full",
                isDone ? "bg-jade" : isCurrent ? "bg-poppy" : "bg-ink/30",
              )}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
              {String(b.index + 1).padStart(2, "0")} / {String(b.total).padStart(2, "0")}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-ink">
              {b.rows.length} recipients ·{" "}
              {formatAmount(b.totalAmountRaw, {
                decimals,
                maxFractionDigits: 4,
              })}{" "}
              {symbol ?? ""}
            </span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em]">
              {isDone ? (
                <span className="text-jade">settled</span>
              ) : isCurrent ? (
                <span className="text-poppy">
                  {state.kind === "dry-running"
                    ? "pre-flight…"
                    : state.kind === "signing"
                      ? "signing…"
                      : state.kind === "confirming"
                        ? "confirming…"
                        : "—"}
                </span>
              ) : (
                <span className="text-ink/40">queued</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function InFlightLabel({ state }: { state: SubmitState }) {
  if (
    state.kind !== "dry-running" &&
    state.kind !== "signing" &&
    state.kind !== "confirming"
  )
    return null;
  if (state.kind === "dry-running") {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70">
        <Spinner size={12} className="text-ink/55" />
        {state.totalBatches > 1
          ? `Pre-flight ${state.batchIndex + 1} / ${state.totalBatches}`
          : "Pre-flight check"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70">
      <Spinner size={12} className="text-poppy" />
      {state.kind === "signing"
        ? state.totalBatches > 1
          ? `Signing batch ${state.batchIndex + 1} / ${state.totalBatches}`
          : "Sign in wallet"
        : state.totalBatches > 1
          ? `Confirming ${state.batchIndex + 1} / ${state.totalBatches}`
          : "Confirming on-chain"}
    </span>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function primaryLabel(
  state: SubmitState,
  hasPartial: boolean,
  remaining: number,
  total: number,
): string {
  if (state.kind === "error") {
    if (hasPartial) {
      return remaining === 1
        ? "Resume — 1 batch left"
        : `Resume — ${remaining} batches left`;
    }
    return total > 1 ? `Retry — ${total}× batches` : "Retry";
  }
  if (total > 1) return `Sign ${total}× batches`;
  return "Sign & send";
}

function truncMiddle(s: string, keep: number): string {
  if (s.length <= keep * 2 + 1) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}
