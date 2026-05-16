import BigNumber from "bignumber.js";

export type FormatAmountOpts = {
  decimals?: number;
  maxFractionDigits?: number;
  compact?: boolean;
  grouping?: boolean;
};

export function formatAmount(
  raw: bigint | string | number | BigNumber,
  opts: FormatAmountOpts = {},
): string {
  const {
    decimals = 0,
    maxFractionDigits = 2,
    compact = false,
    grouping = true,
  } = opts;

  const bn =
    raw instanceof BigNumber
      ? raw
      : new BigNumber(raw.toString()).shiftedBy(-decimals);

  if (!bn.isFinite()) return "—";

  if (compact) {
    const n = bn.abs();
    if (n.gte(1_000_000_000))
      return suffix(bn.dividedBy(1_000_000_000), "B", maxFractionDigits);
    if (n.gte(1_000_000))
      return suffix(bn.dividedBy(1_000_000), "M", maxFractionDigits);
    if (n.gte(1_000))
      return suffix(bn.dividedBy(1_000), "K", Math.min(maxFractionDigits, 1));
    return bn.toFormat(Math.min(maxFractionDigits, 2), BigNumber.ROUND_DOWN);
  }

  return bn.toFormat(
    bn.isInteger() ? 0 : maxFractionDigits,
    BigNumber.ROUND_DOWN,
    grouping
      ? { groupSeparator: ",", groupSize: 3, decimalSeparator: "." }
      : { groupSeparator: "", groupSize: 0, decimalSeparator: "." },
  );
}

function suffix(bn: BigNumber, s: string, digits: number) {
  return bn.toFormat(digits, BigNumber.ROUND_DOWN) + s;
}
