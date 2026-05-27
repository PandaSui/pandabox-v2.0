"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { ArrowDiag } from "@pandasui/ui";
import {
  parseRecipients,
  quote as computeQuote,
  splitIntoBatches,
  isSubmitInFlight,
} from "@/lib/airdrop";
import { useAirdropDraft } from "@/lib/store/airdrop-draft";
import { useOwnedCoinGroups } from "@/lib/airdrop/use-owned-coins";
import { useSubmitAirdrop } from "@/lib/airdrop/use-submit-airdrop";
import type { AirdropPlatformState } from "@/lib/airdrop";
import { CoinTypePicker } from "./coin-type-picker";
import { RecipientList } from "./recipient-list";
import { MemoInput } from "./memo-input";
import { FeeBreakdown } from "./fee-breakdown";
import { TransactionInspector } from "./transaction-inspector";
import { AirdropSuccess } from "./airdrop-success";

/**
 * The /airdrop composer. Three stacked sections separated by hairlines,
 * each labelled with a numbered mono eyebrow so the user reads it as a
 * sequence rather than a wall of controls:
 *
 *   01 · ASSET       → CoinTypePicker (wallet-owned coin types)
 *   02 · RECIPIENTS  → RecipientList  (paste / upload / live parse)
 *   03 · PRE-FLIGHT  → MemoInput + FeeBreakdown + Submit
 *
 * Submit opens the TransactionInspector modal, which sequentially signs
 * one PTB per batch via `useSubmitAirdrop` and lands on the
 * AirdropSuccess modal. The submit state is published to a shared store
 * so the hero `LiveFanOutTrace` can project `running` / `settled`.
 *
 * No diecut chrome — corner ticks + hairlines + offset shadows carry
 * structure.
 */
export function AirdropPanel({
  platform,
  feePerRecipientMist,
  maxRecipients,
  paused,
}: {
  platform: AirdropPlatformState | null;
  feePerRecipientMist: bigint;
  maxRecipients: number;
  paused: boolean;
}) {
  const t = useTranslations("airdrop");
  const { draft, setCoinType, setRawInput, setMemo, setDuplicatePolicy } =
    useAirdropDraft();
  const { groups, address } = useOwnedCoinGroups();

  const selectedGroup = useMemo(
    () => groups.find((g) => g.coinType === draft.coinType) ?? null,
    [groups, draft.coinType],
  );
  const decimals = selectedGroup?.decimals ?? 0;
  const symbol = selectedGroup?.symbol ?? null;
  const coinName = selectedGroup?.name ?? null;
  const coinIconUrl = selectedGroup?.iconUrl ?? null;
  const coinPicked = Boolean(selectedGroup);

  // Live parse + quote + batches. Pure, cheap, no chain reads.
  const parsed = useMemo(
    () =>
      parseRecipients(draft.rawInput, {
        decimals,
        duplicatePolicy: draft.duplicatePolicy,
      }),
    [draft.rawInput, decimals, draft.duplicatePolicy],
  );
  const quote = useMemo(
    () =>
      computeQuote({
        rows: parsed.rows,
        feePerRecipientMist,
        maxRecipients,
      }),
    [parsed.rows, feePerRecipientMist, maxRecipients],
  );
  // `splitIntoBatches` operates on *live* rows only — the parser may have
  // produced blocking / zeroed rows that should never reach the PTB.
  const batches = useMemo(() => {
    const live = parsed.rows.filter(
      (r) =>
        r.amountRaw > 0n &&
        !r.issues.some(
          (i) =>
            i.kind === "invalid-address" ||
            i.kind === "invalid-amount" ||
            i.kind === "zero-amount",
        ),
    );
    return splitIntoBatches({
      rows: live,
      maxRecipients,
      feePerRecipientMist,
    });
  }, [parsed.rows, maxRecipients, feePerRecipientMist]);

  // Submit lifecycle — owns the inspector + signing loop + success view.
  const submit = useSubmitAirdrop({
    platform,
    coinType: draft.coinType,
    batches,
    memo: draft.memo,
    feePerRecipientMist,
  });
  const inFlight = isSubmitInFlight(submit.state);
  const inspectorOpen =
    submit.state.kind === "inspecting" ||
    submit.state.kind === "dry-running" ||
    submit.state.kind === "signing" ||
    submit.state.kind === "confirming" ||
    submit.state.kind === "error";
  const successOpen = submit.state.kind === "success";

  // Submit gating — each "no" condition becomes the disabled-button copy
  // so the user knows exactly what's missing. Order matters: most
  // fundamental blocker first.
  const submitGate = useMemo(() => {
    if (paused) return "Platform is paused";
    if (!address) return "Connect a wallet to sign";
    if (!coinPicked) return "Pick an asset first";
    if (quote.recipientCount === 0) return "Add at least one recipient";
    if (selectedGroup && selectedGroup.totalBalanceRaw < quote.totalAmountRaw) {
      return "Your spendable balance is below the total";
    }
    return null;
  }, [
    paused,
    address,
    coinPicked,
    quote.recipientCount,
    quote.totalAmountRaw,
    selectedGroup,
  ]);

  const submitDisabled = submitGate !== null;

  return (
    <div className="relative border border-ink/15 bg-bone shadow-offset-sm">
      <CornerTick className="left-2 top-2" />
      <CornerTick className="right-2 top-2 rotate-90" />
      <CornerTick className="left-2 bottom-2 -rotate-90" />
      <CornerTick className="right-2 bottom-2 rotate-180" />

      <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-poppy">
            {t("panelEyebrow")}
          </span>
          <h2 className="font-display text-[1.4rem] leading-[1.1] text-ink">
            {t("panelTitle")}
          </h2>
        </div>
        {paused ? (
          <span className="inline-flex items-center gap-1.5 border border-poppy/55 bg-bone px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-poppy">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-poppy"
            />
            {t("statStatusPaused")}
          </span>
        ) : null}
      </header>

      {/* The form is fully editable until the user opens the inspector.
          From `signing`/`confirming` onward we visually freeze the bench
          via opacity + pointer-events so mid-flight edits can't desync
          the live quote from the signed batches. */}
      <fieldset
        disabled={inFlight}
        className={cn(
          "contents",
          inFlight && "pointer-events-none select-none opacity-80",
        )}
      >
        <SectionBand index="01" title="Asset">
          <CoinTypePicker
            selectedCoinType={draft.coinType}
            onSelect={setCoinType}
          />
        </SectionBand>

        <SectionBand index="02" title="Recipients">
          <RecipientList
            rawInput={draft.rawInput}
            onRawInputChange={setRawInput}
            duplicatePolicy={draft.duplicatePolicy}
            onDuplicatePolicyChange={setDuplicatePolicy}
            decimals={decimals}
            symbol={symbol}
            coinPicked={coinPicked}
          />
        </SectionBand>

        <SectionBand index="03" title="Pre-flight" last>
          <div className="space-y-5">
            <MemoInput value={draft.memo} onChange={setMemo} />
            <FeeBreakdown
              quote={quote}
              decimals={decimals}
              symbol={symbol}
              maxRecipients={maxRecipients}
            />
            <SubmitRow
              disabled={submitDisabled}
              gateMessage={submitGate}
              batchCount={quote.batchCount}
              recipientCount={quote.recipientCount}
              onClick={submit.openInspector}
            />
          </div>
        </SectionBand>
      </fieldset>

      <TransactionInspector
        open={inspectorOpen}
        state={submit.state}
        onClose={submit.closeInspector}
        onConfirm={() => {
          // From `inspecting` and from `error` with partial completion,
          // resume — the hook skips already-settled batches. Fresh sends
          // resume from index 0 since `partial[]` is empty either way.
          void submit.submit();
        }}
        onRestart={() => {
          // Force-restart from batch 1, discarding `partial[]`. Used by
          // the "Start over" CTA in the inspector's error state.
          void submit.restart();
        }}
        coinType={draft.coinType}
        symbol={symbol}
        decimals={decimals}
        coinName={coinName}
        coinIconUrl={coinIconUrl}
        quote={quote}
        batches={batches}
        treasuryAddress={platform?.treasuryAddress ?? ""}
        memo={draft.memo}
      />

      <AirdropSuccess
        open={successOpen}
        results={
          submit.state.kind === "success" ? submit.state.results : []
        }
        symbol={symbol}
        decimals={decimals}
        coinName={coinName}
        coinIconUrl={coinIconUrl}
        coinType={draft.coinType}
        onClose={submit.reset}
        onReset={() => {
          submit.reset();
          setRawInput("");
          setMemo("");
        }}
      />
    </div>
  );
}

/* ─────────────────────────── section band ─────────────────────────── */

function SectionBand({
  index,
  title,
  last,
  children,
}: {
  index: string;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-6 px-6 py-7 md:grid-cols-12 md:gap-8",
        !last && "border-b border-ink/10",
      )}
    >
      <header className="md:col-span-3">
        <div className="flex items-center gap-3 md:flex-col md:items-start">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {index}
          </span>
          <h3 className="font-display text-[1.15rem] leading-[1.15] text-ink">
            {title}
          </h3>
        </div>
      </header>
      <div className="md:col-span-9">{children}</div>
    </section>
  );
}

/* ─────────────────────────── submit row ─────────────────────────── */

function SubmitRow({
  disabled,
  gateMessage,
  batchCount,
  recipientCount,
  onClick,
}: {
  disabled: boolean;
  gateMessage: string | null;
  batchCount: number;
  recipientCount: number;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          Submit
        </p>
        <p className="font-mono text-[11px] text-ink/70">
          {gateMessage ? (
            <span className="text-poppy">{gateMessage}</span>
          ) : batchCount > 1 ? (
            <>
              Ready · {recipientCount.toLocaleString()} recipients across{" "}
              {batchCount}× signed PTBs
            </>
          ) : (
            <>
              Ready · {recipientCount.toLocaleString()} recipients · one
              signed PTB
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={disabled ? "Resolve the issues above first." : undefined}
        className={cn(
          "group inline-flex h-12 items-center justify-center gap-2 border px-6",
          "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
          "shadow-offset-sm transition-all duration-300 ease-atelier",
          disabled
            ? "cursor-not-allowed border-ink/25 bg-ink/[0.04] text-ink/40"
            : "border-ink bg-ink text-bone hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
        )}
      >
        <span>Sign & execute</span>
        <span
          aria-hidden
          className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]"
        >
          <ArrowDiag size={12} />
        </span>
      </button>
    </div>
  );
}

/* ─────────────────────────── corner tick ─────────────────────────── */

function CornerTick({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn("absolute z-[1]", className)}
      aria-hidden
    >
      <path
        d="M0 0 L0 10 M0 0 L10 0"
        stroke="#161310"
        strokeOpacity="0.45"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  );
}
