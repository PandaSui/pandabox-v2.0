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
  AIRDROP_TARGET,
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
    <Modal open={open} onClose={onClose} title="Transaction inspector">
      <div className="space-y-6 px-6 pb-6 pt-2">
        {/* ── Top summary ───────────────────────────────────────── */}
        <SummaryGrid
          quote={quote}
          batchCount={batches.length}
          decimals={decimals}
          symbol={symbol}
        />

        {/* ── Move call audit ───────────────────────────────────── */}
        <Section title="Move call">
          <ul className="space-y-2 font-mono text-[11.5px] text-ink">
            <KV label="target" value={AIRDROP_TARGET} mono />
            <KV
              label="package"
              value={truncMiddle(AIRDROP_PACKAGE_ID, 10)}
              mono
              hint="Sui mainnet"
            />
            <KV
              label="platform"
              value={truncMiddle(AIRDROP_PLATFORM_ID, 10)}
              mono
              hint="shared object · mutable ref"
            />
            <KV label="coin type" value={truncMiddle(coinType, 14)} mono />
            <KV
              label="memo"
              value={memo ? `"${memo}"` : "—"}
              hint={memo ? "stored on-chain in event log" : "optional"}
            />
          </ul>
        </Section>

        {/* ── Fee destination ───────────────────────────────────── */}
        <Section title="Fee destination">
          <div className="flex items-center justify-between border border-ink/15 bg-bone px-3 py-2.5">
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

        {/* ── Error banner ──────────────────────────────────────── */}
        {state.kind === "error" ? (
          <div className="border border-poppy/45 bg-poppy/10 px-3 py-2.5 font-mono text-[11px] text-poppy">
            {state.message}
          </div>
        ) : null}

        {/* ── Footer CTA ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-ink/10 pt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isInFlight}
            className={cn(
              "inline-flex h-10 items-center justify-center px-4 font-mono text-[11px] uppercase tracking-[0.18em]",
              "border border-ink/25 text-ink/75 transition-colors hover:border-ink/55 hover:text-ink",
              isInFlight && "cursor-not-allowed opacity-40",
            )}
          >
            {isInFlight ? "Working…" : "Cancel"}
          </button>

          {isInFlight ? (
            <InFlightLabel state={state} />
          ) : (
            <div className="flex items-center gap-2">
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
                    "inline-flex h-10 items-center justify-center px-4 font-mono text-[11px] uppercase tracking-[0.18em]",
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
                  "group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-ink px-6 text-bone",
                  "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
                  "shadow-offset-sm transition-all duration-300 ease-atelier",
                  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm",
                )}
              >
                <span>{primaryLabel(state, hasPartial, remainingBatches, batches.length)}</span>
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
    <div className="grid grid-cols-2 divide-x divide-ink/10 border border-ink/15 bg-bone md:grid-cols-4">
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
        sub="fee + gas"
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

function KV({
  label,
  value,
  hint,
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <li className="grid grid-cols-[80px_1fr] items-baseline gap-3 border-b border-ink/[0.06] pb-1.5 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className={cn("text-ink", mono && "font-mono tabular-nums")}>
          {value}
        </span>
        {hint ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {hint}
          </span>
        ) : null}
      </span>
    </li>
  );
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
