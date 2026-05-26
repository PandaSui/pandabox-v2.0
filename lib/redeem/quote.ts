/**
 * Pure quote math for the Redeem tool. No I/O, no React, no Sui SDK —
 * everything here is unit-testable by inspection.
 *
 * The on-chain formula (paraphrasing pool::redeem):
 *
 *   sui_gross = coin_in * price_mist_per_token / 10^coin_decimals
 *   fee       = sui_gross * fee_bps / 10_000
 *   sui_out   = sui_gross - fee
 *
 * The division by `10^coin_decimals` is the key — verified against three
 * real mainnet redeems on the FOMO pool, e.g. `coin_in = 100 × 10⁹`,
 * `price_mist_per_token = 1`, `coin_decimals = 9` → `sui_gross = 100`
 * mist (not 100 SUI). The contract stores `price_mist_per_token` as
 * **mist of SUI per WHOLE token**, despite the name — the field is the
 * price tag a creator picks when deploying the pool ("each FOMO token
 * is worth N mist of SUI"), and the contract handles the decimal scaling
 * internally.
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
  /** Mist of SUI per WHOLE token — `pool.price_mist_per_token`. The
   *  contract divides by `10^coin_decimals` internally when computing
   *  `sui_gross`, so this is effectively the price tag on one displayed
   *  token (e.g. 500_000_000 = 0.5 SUI per token). */
  priceMistPerToken: bigint;
  /** Decimals of the project coin — pulled from the pool snapshot. */
  coinDecimals: number;
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
  coinDecimals,
  reserveMist,
  feeBps,
}: QuoteArgs): Quote {
  if (coinIn <= 0n || priceMistPerToken <= 0n) {
    return { suiGrossMist: 0n, feeMist: 0n, suiOutMist: 0n, clamped: false };
  }
  const tokenBaseUnits = 10n ** BigInt(coinDecimals);
  // Matches the on-chain formula: sui_gross = coin_in * price / 10^decimals.
  // Bigint division floors — same as the Move contract's u64 arithmetic.
  const requestedGross = (coinIn * priceMistPerToken) / tokenBaseUnits;
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
 * Floored to the nearest base unit:
 *   `max_coin_in = reserve * 10^decimals / price_mist_per_token`
 *
 * Derivation: solve `coin_in * price / 10^decimals ≤ reserve` for
 * `coin_in`. When `price` is 0 (defensive), returns 0 rather than
 * dividing by zero.
 */
export function maxRedeemableCoin(args: {
  reserveMist: bigint;
  priceMistPerToken: bigint;
  coinDecimals: number;
}): bigint {
  if (args.priceMistPerToken <= 0n) return 0n;
  const tokenBaseUnits = 10n ** BigInt(args.coinDecimals);
  return (args.reserveMist * tokenBaseUnits) / args.priceMistPerToken;
}

/**
 * Pretty exchange-rate ratio: 1 whole token ⇒ X SUI. Returned as a
 * (numerator, denominator) pair in mist so the caller can format
 * precisely with their preferred big-decimal library.
 *
 * Example: a pool with `priceMistPerToken = 1_000_000_000n` (1 SUI per
 * token) → returns `{ numerator: 1_000_000_000n, denominator: 1_000_000_000n }`
 * = 1 SUI per token.
 */
export function rateAsSuiPerToken(args: {
  priceMistPerToken: bigint;
  coinDecimals: number;
}): { numerator: bigint; denominator: bigint } {
  // `priceMistPerToken` is already mist-per-whole-token, so the numerator
  // is just the price. `coinDecimals` no longer participates — kept in
  // the signature for back-compat and in case callers want to surface it
  // alongside the rate.
  void args.coinDecimals;
  const MIST_PER_SUI = 10n ** 9n;
  return { numerator: args.priceMistPerToken, denominator: MIST_PER_SUI };
}

/**
 * Re-export of the type-string parser used to pull `T` out of
 * `RedeemPool<T>`. Lives next to the other parsers so this module stays
 * focused on math but callers can still pull both from one place.
 */
export { extractCoinTypeFromObjectType };
