/**
 * Owned-coin discovery + minimum-cover selection for the Airdrop PTB.
 *
 * Two concerns live here:
 *
 *   1. **Group** raw `Coin<T>` objects by their fully-qualified type so the
 *      picker UI can show one row per asset rather than 47 dust rows.
 *   2. **Select** a minimum-cover subset of `Coin<T>` objects whose summed
 *      balance covers the airdrop's total — that subset becomes the PTB's
 *      input coins (merged into one, then a single `splitCoins` extracts
 *      the exact amount to ship).
 *
 * Both are pure data manipulation; the actual chain queries
 * (`getCoins`, `getAllBalances`) live in the client-side hook that
 * consumes this module.
 */

import type { OwnedCoin, OwnedCoinGroup } from "./types";

export type CoinMetadataLookup = (coinType: string) => {
  symbol: string | null;
  name: string | null;
  iconUrl: string | null;
  decimals: number;
} | null;

/**
 * Roll up `OwnedCoin[]` into one `OwnedCoinGroup` per coin type, sorted by
 * descending total balance — the picker shows the heaviest holdings
 * first.
 *
 * `metadataLookup` is consulted per type to attach `symbol`, `name`,
 * `iconUrl`, and `decimals`. When the lookup returns `null` (no
 * `CoinMetadata<T>` published, common for one-off test coins) the group
 * falls back to a synthesized symbol from the type tail and `decimals: 0`
 * — the picker should mark these as "unverified" but still allow sending.
 */
export function groupOwnedCoins(
  coins: OwnedCoin[],
  metadataLookup: CoinMetadataLookup,
): OwnedCoinGroup[] {
  const byType = new Map<string, OwnedCoin[]>();
  for (const c of coins) {
    const list = byType.get(c.coinType);
    if (list) list.push(c);
    else byType.set(c.coinType, [c]);
  }

  const groups: OwnedCoinGroup[] = [];
  for (const [coinType, objects] of byType) {
    const meta = metadataLookup(coinType);
    objects.sort((a, b) => (a.balanceRaw < b.balanceRaw ? 1 : -1));
    const total = objects.reduce<bigint>((acc, c) => acc + c.balanceRaw, 0n);
    groups.push({
      coinType,
      symbol: meta?.symbol ?? symbolFromType(coinType),
      name: meta?.name ?? null,
      iconUrl: meta?.iconUrl ?? null,
      decimals: meta?.decimals ?? 0,
      totalBalanceRaw: total,
      objects,
    });
  }

  groups.sort((a, b) => {
    if (a.totalBalanceRaw === b.totalBalanceRaw) {
      return (a.symbol ?? "").localeCompare(b.symbol ?? "");
    }
    return a.totalBalanceRaw < b.totalBalanceRaw ? 1 : -1;
  });
  return groups;
}

/**
 * Pick the smallest set of `Coin<T>` objects from `objects` whose summed
 * balance is ≥ `target`. Greedy by descending balance: take the biggest
 * coin first, then the next biggest, etc., until the target is met. The
 * caller's PTB will `mergeCoins` the selection into the first id and
 * then `splitCoins` the exact amount.
 *
 * Returns `null` when even the full set is insufficient — the caller
 * surfaces a "not enough balance" error in that case.
 */
export function selectMinimumCover(
  objects: readonly OwnedCoin[],
  target: bigint,
): { selected: OwnedCoin[]; total: bigint } | null {
  if (target <= 0n) return { selected: [], total: 0n };
  const sorted = [...objects].sort((a, b) =>
    a.balanceRaw < b.balanceRaw ? 1 : -1,
  );
  const selected: OwnedCoin[] = [];
  let total = 0n;
  for (const c of sorted) {
    if (c.balanceRaw <= 0n) continue;
    selected.push(c);
    total += c.balanceRaw;
    if (total >= target) return { selected, total };
  }
  return null;
}

/* ─────────────────────────── helpers ─────────────────────────── */

/**
 * Fallback symbol when no `CoinMetadata<T>` is available — take the final
 * `::Type` segment of the type tag, upper-case it, and cap at 8 chars so
 * the picker doesn't sprout a 40-char pill from someone's verbose Move
 * type name.
 */
function symbolFromType(coinType: string): string {
  const tail = coinType.split("::").pop() ?? "";
  if (!tail) return "?";
  return tail.toUpperCase().slice(0, 8);
}
