"use client";

import {
  useCurrentAccount,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { OwnedCoin, OwnedCoinGroup } from "./types";
import { groupOwnedCoins } from "./coin-discovery";

/**
 * Hook layer over dapp-kit's owned-coin queries. Two surfaces:
 *
 *   - `useOwnedCoinGroups()`   → grouped + metadata-enriched list of every
 *                                coin type the connected wallet holds.
 *                                Drives the coin picker.
 *   - `useOwnedCoinObjects(t)` → flat list of individual `Coin<T>` object
 *                                IDs for the selected type, sorted by
 *                                descending balance. Drives `selectMinimumCover`
 *                                in the PTB builder.
 *
 * Both queries are scoped to the connected account — they no-op when no
 * wallet is connected (rather than throwing) so the picker can render an
 * empty state instead of a crash.
 *
 * Cache policy: balances change on every transfer / pay / claim. 15s
 * `staleTime` keeps the picker responsive without hammering the fullnode.
 * Window-focus refetch is on by default in the project's QueryClient.
 */

const STALE_MS = 15_000;

/* ─────────────────────────── useOwnedCoinGroups ─────────────────────────── */

export type UseOwnedCoinGroupsResult = {
  groups: OwnedCoinGroup[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  address: string | null;
};

export function useOwnedCoinGroups(): UseOwnedCoinGroupsResult {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const address = account?.address ?? null;

  const balances = useSuiClientQuery(
    "getAllBalances",
    { owner: address ?? "" },
    {
      enabled: Boolean(address),
      staleTime: STALE_MS,
    },
  );

  const coinTypes = useMemo(() => {
    const list = balances.data ?? [];
    return list
      .filter((b) => BigInt(b.totalBalance) > 0n)
      .map((b) => b.coinType);
  }, [balances.data]);

  // Fetch CoinMetadata once per type, in parallel. The contract output
  // is small + stable enough that a long staleTime is fine.
  const metadata = useQuery({
    queryKey: ["airdrop", "coinMetadataBatch", coinTypes.sort().join("|")],
    enabled: coinTypes.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        coinTypes.map(async (coinType) => {
          try {
            const meta = await client.getCoinMetadata({ coinType });
            return [coinType, meta] as const;
          } catch {
            return [coinType, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const groups = useMemo<OwnedCoinGroup[]>(() => {
    const totals = balances.data ?? [];
    if (totals.length === 0) return [];
    const metaMap = metadata.data ?? {};

    // `groupOwnedCoins` wants individual `OwnedCoin` objects, but the
    // picker only needs aggregate totals + metadata — we synthesize one
    // virtual `OwnedCoin` per type so the grouping/sort logic stays one
    // function. The picker doesn't read the synthetic `objectId` field,
    // and the PTB-side discovery uses `useOwnedCoinObjects` for the
    // real object ids.
    const synthetic: OwnedCoin[] = totals
      .filter((b) => BigInt(b.totalBalance) > 0n)
      .map((b) => ({
        objectId: `aggregate:${b.coinType}`,
        coinType: b.coinType,
        balanceRaw: BigInt(b.totalBalance),
        version: "0",
      }));
    return groupOwnedCoins(synthetic, (coinType) => {
      const meta = metaMap[coinType];
      if (!meta) return null;
      return {
        symbol: meta.symbol ?? null,
        name: meta.name ?? null,
        iconUrl: meta.iconUrl ?? null,
        decimals: meta.decimals ?? 0,
      };
    });
  }, [balances.data, metadata.data]);

  return {
    groups,
    isLoading: balances.isLoading || metadata.isLoading,
    isError: balances.isError || metadata.isError,
    refetch: () => {
      balances.refetch();
      metadata.refetch();
    },
    address,
  };
}

/* ─────────────────────────── useOwnedCoinObjects ─────────────────────────── */

export type UseOwnedCoinObjectsResult = {
  coins: OwnedCoin[];
  isLoading: boolean;
  isError: boolean;
  /**
   * Refetch the underlying `getCoins` query and return a parsed
   * `OwnedCoin[]` from the refreshed response. The submit loop calls
   * this between batches to pick up the post-tx state of the wallet
   * before selecting inputs for the next PTB.
   */
  refetch: () => Promise<OwnedCoin[]>;
};

/**
 * Enumerate the individual `Coin<T>` objects the connected wallet owns
 * for `coinType`, sorted by descending balance. Used by the submit path
 * to feed `selectMinimumCover` and `buildAirdropTx`.
 *
 * Pages up to 100 objects in one request — a generous cap. Wallets with
 * more than 100 dust objects for a single type are rare in practice; if
 * we hit that limit, the user can either consolidate manually or the
 * future submit flow can iterate `nextCursor`.
 */
export function useOwnedCoinObjects(
  coinType: string | null | undefined,
): UseOwnedCoinObjectsResult {
  const account = useCurrentAccount();
  const enabled = Boolean(account?.address && coinType);

  const q = useSuiClientQuery(
    "getCoins",
    {
      owner: account?.address ?? "",
      coinType: coinType ?? "",
      limit: 100,
    },
    {
      enabled,
      staleTime: STALE_MS,
    },
  );

  const coins = useMemo<OwnedCoin[]>(() => {
    const list = q.data?.data ?? [];
    return list
      .map((c) => ({
        objectId: c.coinObjectId,
        coinType: c.coinType,
        balanceRaw: BigInt(c.balance),
        version: c.version,
      }))
      .sort((a, b) => (a.balanceRaw < b.balanceRaw ? 1 : -1));
  }, [q.data]);

  return {
    coins,
    isLoading: enabled && q.isLoading,
    isError: q.isError,
    refetch: async () => {
      const next = await q.refetch();
      const list = next.data?.data ?? [];
      return list
        .map((c) => ({
          objectId: c.coinObjectId,
          coinType: c.coinType,
          balanceRaw: BigInt(c.balance),
          version: c.version,
        }))
        .sort((a, b) => (a.balanceRaw < b.balanceRaw ? 1 : -1));
    },
  };
}
