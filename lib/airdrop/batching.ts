/**
 * Slice a recipient list into sequential `AirdropBatch`es when the row
 * count exceeds the platform's `max_recipients` cap. Each batch becomes
 * its own PTB; the submit UI walks them in order and shows a stepped
 * progress strip.
 *
 * The cap is a contract assertion, not just UI styling — sending more
 * than `max_recipients` rows in one Move call aborts the transaction.
 * Splitting ahead of time keeps the on-chain cost predictable per batch
 * and gives the user a natural retry boundary when a single batch fails.
 */

import type { AirdropBatch, RecipientRow } from "./types";

export type BatchInputs = {
  rows: RecipientRow[];
  /** Live cap from the Platform object. */
  maxRecipients: number;
  /** Live per-recipient fee, in MIST. */
  feePerRecipientMist: bigint;
};

/**
 * Pure split into batches of `≤ maxRecipients` rows. The input is
 * expected to already be filtered to live rows (positive amount, valid
 * address) — see `liveRows` in `parse-recipients.ts`.
 *
 * Returns `[]` when `rows` is empty rather than a single empty batch:
 * the submit UI tests `batches.length === 0` to know there's nothing to
 * do, and an empty batch would falsely promise one transaction.
 */
export function splitIntoBatches(inputs: BatchInputs): AirdropBatch[] {
  const cap = Math.max(1, inputs.maxRecipients);
  const rows = inputs.rows;
  if (rows.length === 0) return [];

  const total = Math.ceil(rows.length / cap);
  const batches: AirdropBatch[] = [];
  for (let i = 0; i < total; i += 1) {
    const slice = rows.slice(i * cap, (i + 1) * cap);
    const totalAmountRaw = slice.reduce<bigint>(
      (acc, r) => acc + r.amountRaw,
      0n,
    );
    const feeMist = BigInt(slice.length) * inputs.feePerRecipientMist;
    batches.push({
      index: i,
      total,
      rows: slice,
      totalAmountRaw,
      feeMist,
    });
  }
  return batches;
}
