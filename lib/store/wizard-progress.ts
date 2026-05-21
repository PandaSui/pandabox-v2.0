import type { DraftV2 } from "./wizard-schema";

/**
 * Computes wizard completion based on filled required fields, NOT current
 * step. Step-based progress is misleading — jumping to step 2 without
 * filling step 1 used to show 33% even with a completely empty form.
 *
 * Required-field counts per step:
 *
 *   Step 1 (identity): name, ticker, tagline, category, description,
 *                      coverImage                                    → 6
 *   Step 2 (coin):     coinType, treasuryCapId, coinMetadataId,
 *                      verified (boolean must be true)               → 4
 *   Step 3 (sale):     tokensPerSui, allocationTokens, endTimeMs
 *                      (null = "no time cap" counts as decided),
 *                      unsoldAction                                  → 4
 *   Step 4 (deploy):   sourceCodeBlobId is optional — review/deploy
 *                      itself isn't a "field" to fill                → 0
 *
 * Total: 14 required fields. Optional social links (twitter / website /
 * discord) on Step 1 don't count — they're nice-to-haves, not blockers.
 *
 * Field weighting is implicit: each required field contributes 1/14 of
 * total progress, so heavier steps move the bar more (Step 1's 6 fields
 * are worth 43% of the bar; Step 2 and Step 3 are 29% each).
 */
export type WizardProgress = {
  /** Required fields the user has filled. */
  filled: number;
  /** Total required fields across the wizard. */
  total: number;
  /** Rounded percentage 0–100. */
  pct: number;
};

export function computeWizardProgress(draft: DraftV2): WizardProgress {
  let filled = 0;
  let total = 0;

  // Step 1 — identity (6 required fields).
  const identityRequired = [
    isFilledString(draft.identity.name),
    isFilledString(draft.identity.ticker),
    isFilledString(draft.identity.tagline),
    isFilledString(draft.identity.category),
    isFilledString(draft.identity.description),
    isFilledString(draft.identity.coverImage),
  ];
  total += identityRequired.length;
  filled += identityRequired.filter(Boolean).length;

  // Step 2 — coin (4 required: 3 strings + verified must be true).
  const coinRequired = [
    isFilledString(draft.coin.coinType),
    isFilledString(draft.coin.treasuryCapId),
    isFilledString(draft.coin.coinMetadataId),
    draft.coin.verified === true,
  ];
  total += coinRequired.length;
  filled += coinRequired.filter(Boolean).length;

  // Step 3 — sale. `endTimeMs` is special: `null` is a valid choice
  // ("no time cap"), so anything other than `undefined` counts as decided.
  const saleRequired = [
    isFilledString(draft.sale.tokensPerSui),
    isFilledString(draft.sale.allocationTokens),
    draft.sale.endTimeMs !== undefined,
    isFilledString(draft.sale.unsoldAction),
  ];
  total += saleRequired.length;
  filled += saleRequired.filter(Boolean).length;

  // Step 4 — deploy has no required fields; reaching it with all prior
  // fields filled naturally lands the bar at 100%.

  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, pct };
}

function isFilledString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
