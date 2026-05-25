/**
 * Pure quote math for the Redeem tool. No I/O, no React, no Sui SDK —
 * everything here is unit-testable by inspection.
 *
 * The on-chain formula (paraphrasing pool::redeem):
 *
 *   sui_gross = coin_in * price_mist_per_token
 *   fee       = sui_gross * fee_bps / 10_000
 *   sui_out   = sui_gross - fee
 *
 * `sui_gross` is bounded by the pool's reserve — if it would exceed
 * `sui_reserve`, the on-chain call aborts. The UI clamps below that
 * threshold so the user can never sign a doomed transaction.
 *
 * `coin_in` is in base units (`u64`). For a 9-decimal coin, 1 whole token
 * is 1e9 base units. All quote inputs/outputs in this module are bigints
 * in base units / mist, exactly as they exist on chain. Decimal formatting
 * is the UI layer's job.
 */

import { extractCoinTypeFromObjectType } from "./parse";

export const BPS_DENOMINATOR = 10_000n;

export type Quote = {
  /** SUI received before platform fee, in mist. */
  suiGrossMist: bigint;
  /** Platform fee taken from `suiGrossMist`, in mist. */
  feeMist: bigint;
  /** Net SUI received by the user, in mist. */
  suiOutMist: bigint;
  /** Was the requested amount clamped by the reserve? */
  clamped: boolean;
};

export type QuoteArgs = {
  /** Amount the user wants to redeem, in base coin units (NOT decimal-formatted). */
  coinIn: bigint;
  /** Mist of SUI per base unit of the project coin — `pool.price_mist_per_token`. */
  priceMistPerToken: bigint;
  /** Current SUI reserve of the pool, in mist. */
  reserveMist: bigint;
  /** Platform fee in basis points — `platform.fee_bps`. */
  feeBps: number;
};

/**
 * Compute the quote for a redeem at current pool/platform state. Returns
 * zeros (and `clamped: false`) for a zero-input request rather than
 * throwing — easier on UI components driving this off keystrokes.
 */
export function quoteRedeem({
  coinIn,
  priceMistPerToken,
  reserveMist,
  feeBps,
}: QuoteArgs): Quote {
  if (coinIn <= 0n || priceMistPerToken <= 0n) {
    return { suiGrossMist: 0n, feeMist: 0n, suiOutMist: 0n, clamped: false };
  }
  const requestedGross = coinIn * priceMistPerToken;
  const clamped = requestedGross > reserveMist;
  const suiGrossMist = clamped ? reserveMist : requestedGross;

  const bps = BigInt(feeBps);
  const feeMist = (suiGrossMist * bps) / BPS_DENOMINATOR;
  const suiOutMist = suiGrossMist - feeMist;

  return { suiGrossMist, feeMist, suiOutMist, clamped };
}

/**
 * Largest `coin_in` (base units) the pool can currently honour. Mirrors the
 * on-chain `pool::max_redeemable_coin` getter so the UI can pre-validate
 * inputs without a roundtrip.
 *
 * Floored to the nearest base unit: `reserve / price`. When `price` is 0
 * (defensive), returns 0 rather than dividing by zero.
 */
export function maxRedeemableCoin(args: {
  reserveMist: bigint;
  priceMistPerToken: bigint;
}): bigint {
  if (args.priceMistPerToken <= 0n) return 0n;
  return args.reserveMist / args.priceMistPerToken;
}

/**
 * Pretty exchange-rate string: "1 TOKEN ≈ X SUI" using the coin's decimals.
 * Returned as a BigNumber-printable string so the caller can hand it to
 * `tabular-nums` rendering.
 *
 * Example: a 9-decimal coin with `priceMistPerToken = 1n` →
 *   1 whole token (1e9 base units) ⇒ 1e9 mist ⇒ 1 SUI per token.
 */
export function rateAsSuiPerToken(args: {
  priceMistPerToken: bigint;
  coinDecimals: number;
}): { numerator: bigint; denominator: bigint } {
  // 1 whole token = 10^decimals base units.
  // sui_per_token (in mist) = price_mist_per_token * 10^decimals
  // sui_per_token (in SUI)  = sui_per_token (mist) / 1e9
  // We return a (numerator, denominator) pair in mist/mist so the caller
  // can format precisely with their preferred big-decimal library.
  const tokenBaseUnits = 10n ** BigInt(args.coinDecimals);
  const suiPerTokenMist = args.priceMistPerToken * tokenBaseUnits;
  const MIST_PER_SUI = 10n ** 9n;
  return { numerator: suiPerTokenMist, denominator: MIST_PER_SUI };
}

/**
 * Re-export of the type-string parser used to pull `T` out of
 * `RedeemPool<T>`. Lives next to the other parsers so this module stays
 * focused on math but callers can still pull both from one place.
 */
export { extractCoinTypeFromObjectType };
