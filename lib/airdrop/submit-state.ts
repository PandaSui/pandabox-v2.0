/**
 * Submit lifecycle for the Airdrop tool. A small, explicit state machine
 * so the panel + the hero trace + the success view can all read the same
 * shape without inventing parallel booleans.
 *
 *   idle      → no action yet (or the user closed the success modal)
 *   inspecting→ inspector modal is open; user is reading the audit
 *   signing   → wallet is prompting; per-batch
 *   confirming→ tx submitted, awaiting `waitForTransaction`; per-batch
 *   success   → all batches landed
 *   error     → a batch failed; partial results retained so the user
 *               can choose to retry just the failed/remaining batches
 *
 * Each batch result captures the digest + the parsed `Airdropped` event
 * so the success view can render fee_paid, recipient_count, etc. directly
 * from the chain.
 */

import type { AirdroppedEvent } from "./types";

export type BatchResult = {
  /** 0-based batch index. */
  index: number;
  /** Total batches the draft was split into. */
  total: number;
  /** Sui transaction digest, suitable for Suiscan links. */
  digest: string;
  /** Parsed `Airdropped` event for this batch — null if events query failed. */
  event: AirdroppedEvent | null;
};

export type SubmitState =
  | { kind: "idle" }
  | { kind: "inspecting" }
  | {
      /**
       * Pre-flight `devInspect_transactionBlock` check on the next batch
       * before the wallet sheet opens. Surfaces contract aborts as an
       * error state without burning a wallet signature on a known-bad
       * tx. Usually < 100ms on mainnet — the UI shows a brief "Checking…"
       * label during this phase.
       */
      kind: "dry-running";
      batchIndex: number;
      totalBatches: number;
      completed: BatchResult[];
    }
  | {
      kind: "signing";
      batchIndex: number;
      totalBatches: number;
      completed: BatchResult[];
    }
  | {
      kind: "confirming";
      batchIndex: number;
      totalBatches: number;
      digest: string;
      completed: BatchResult[];
    }
  | { kind: "success"; results: BatchResult[] }
  | { kind: "error"; message: string; partial: BatchResult[] };

/**
 * `true` while the user can't (or shouldn't) edit the draft — chrome that
 * surfaces this disables the textarea / picker / dedupe toggle so a mid-
 * flight edit doesn't desync the live quote from the signed batches.
 */
export function isSubmitInFlight(s: SubmitState): boolean {
  return (
    s.kind === "dry-running" ||
    s.kind === "signing" ||
    s.kind === "confirming"
  );
}

/**
 * The state the FanOutTrace hero should render. `signing`/`confirming`
 * project to `running`; `success` projects to `settled`; everything else
 * collapses to the live preview projection (`idle`/`preview`) computed
 * by the wrapper.
 */
export function traceStateFor(
  s: SubmitState,
): "running" | "settled" | null {
  if (s.kind === "signing" || s.kind === "confirming") return "running";
  if (s.kind === "success") return "settled";
  return null;
}
