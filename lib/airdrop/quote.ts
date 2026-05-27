/**
 * Pure quote math for the Airdrop tool. No chain reads, no React — just
 * given a list of validated `RecipientRow`s plus a snapshot of the
 * Platform's `fee_per_recipient_mist` / `max_recipients`, produce the
 * totals the UI displays and the PTB builder consumes.
 */

import { liveRows } from "./parse-recipients";
import type { AirdropQuote, RecipientRow } from "./types";

/**
 * Gas-budget buffer added on top of the strict fee total. The contract
 * doesn't charge the user for gas itself — that comes out of the same
 * SUI wallet — but the UI surfaces `totalSuiBudgetMist` so people can
 * preflight without "insufficient gas" surprises. 50_000_000 MIST
 * (≈ 0.05 SUI) is enough headroom for the heaviest 300-recipient PTB on
 * mainnet today; revisit when the live numbers prove otherwise.
 */
export const GAS_BUDGET_BUFFER_MIST = 50_000_000n;

export type QuoteInputs = {
  rows: RecipientRow[];
  feePerRecipientMist: bigint;
  /** Cap from the live Platform object (preferred over the default). */
  maxRecipients: number;
};

/**
 * Compute the quote off the *live* rows only — rows with parse errors or
 * that were zeroed by the dedupe merge are excluded from totals. This
 * matches the contract's view of the world: only positive-amount,
 * valid-address rows ever reach the Move call.
 *
 * `batchCount = ceil(recipientCount / maxRecipients)` because each PTB
 * can carry at most `maxRecipients` rows. When `recipientCount` is below
 * the cap, `batchCount === 1`. Returns `0` when there are no live rows
 * at all (nothing to quote).
 */
export function quote(inputs: QuoteInputs): AirdropQuote {
  const live = liveRows(inputs.rows);
  const recipientCount = live.length;
  const totalAmountRaw = live.reduce<bigint>(
    (acc, r) => acc + r.amountRaw,
    0n,
  );
  const feeMist = BigInt(recipientCount) * inputs.feePerRecipientMist;
  const totalSuiBudgetMist = feeMist + GAS_BUDGET_BUFFER_MIST;
  const cap = Math.max(1, inputs.maxRecipients);
  const batchCount =
    recipientCount === 0 ? 0 : Math.ceil(recipientCount / cap);
  const overRecipientLimit = recipientCount > cap;
  return {
    recipientCount,
    totalAmountRaw,
    feeMist,
    totalSuiBudgetMist,
    overRecipientLimit,
    batchCount,
  };
}

/**
 * Sub-quote for a single batch worth of rows. Used by the batched-send
 * step UI to display "Batch 2 of 4 · 150 recipients · 0.15 SUI fee".
 */
export function quoteBatch(
  rows: RecipientRow[],
  feePerRecipientMist: bigint,
): { recipientCount: number; totalAmountRaw: bigint; feeMist: bigint } {
  const recipientCount = rows.length;
  const totalAmountRaw = rows.reduce<bigint>((acc, r) => acc + r.amountRaw, 0n);
  const feeMist = BigInt(recipientCount) * feePerRecipientMist;
  return { recipientCount, totalAmountRaw, feeMist };
}
