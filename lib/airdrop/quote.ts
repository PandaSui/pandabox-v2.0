/**
 * Pure quote math for the Airdrop tool. No chain reads, no React — just
 * given a list of validated `RecipientRow`s plus a snapshot of the
 * Platform's `fee_per_recipient_mist` / `max_recipients`, produce the
 * totals the UI displays and the PTB builder consumes.
 */

import { liveRows } from "./parse-recipients";
import type { AirdropQuote, RecipientRow } from "./types";

/**
 * Per-batch base gas cost in MIST. Calibrated against a Phantom-signed
 * 1-recipient airdrop on mainnet, which reported `network_fee = 4.72M
 * MIST` (≈ 0.00472 SUI). That figure covers: PTB skeleton, two
 * `splitCoins` calls, the `airdrop::airdrop` move call, and the
 * `transferObjects` that drains the leftovers. Per-recipient marginal
 * cost is small but non-zero — recipients add a BCS vector entry plus a
 * transfer effect.
 *
 * Heuristic: `base + recipientCount × perRecipient`. Each batch is its
 * own PTB so the base is paid once per batch.
 */
const GAS_BASE_PER_PTB_MIST = 5_000_000n; // ≈ 0.005 SUI
const GAS_PER_RECIPIENT_MIST = 100_000n; // ≈ 0.0001 SUI

/**
 * Estimate the network gas (mist) the wallet will spend across all
 * batches. Used purely for UI pre-flight display — the wallet computes
 * its own real budget at sign time, and the chain settles against
 * `effects.gasUsed` afterwards. Both can drift from this estimate by
 * tens of percent depending on PTB shape; the goal here is an
 * order-of-magnitude-correct ceiling, not a perfect prediction.
 */
export function estimateGasMist(
  recipientCount: number,
  batchCount: number,
): bigint {
  if (recipientCount === 0 || batchCount === 0) return 0n;
  return (
    BigInt(batchCount) * GAS_BASE_PER_PTB_MIST +
    BigInt(recipientCount) * GAS_PER_RECIPIENT_MIST
  );
}

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
  const cap = Math.max(1, inputs.maxRecipients);
  const batchCount =
    recipientCount === 0 ? 0 : Math.ceil(recipientCount / cap);
  const gasEstimateMist = estimateGasMist(recipientCount, batchCount);
  const totalSuiBudgetMist = feeMist + gasEstimateMist;
  const overRecipientLimit = recipientCount > cap;
  return {
    recipientCount,
    totalAmountRaw,
    feeMist,
    gasEstimateMist,
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
