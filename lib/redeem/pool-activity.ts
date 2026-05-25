import "server-only";
import { listRedeems, listReserveDeposits } from "./events";
import type { RedeemedEvent, ReserveDepositedEvent } from "./types";

/**
 * Pool-scoped activity feed. The on-chain event filter doesn't narrow by
 * pool id, only by event type — so we pull two recent windows (redeems +
 * deposits) across the whole platform and filter client-side to this pool.
 * Cheap on volume; revisit when total activity crosses a few hundred
 * events per minute.
 *
 * Events are normalized into a single `PoolActivity` union sorted newest
 * first, so the UI can render them as one chronological feed.
 */

export type PoolActivity =
  | ({ kind: "redeemed" } & RedeemedEvent)
  | ({ kind: "deposited" } & ReserveDepositedEvent);

/**
 * Fetch up to `limit` of the most recent activity entries for a specific
 * pool. We pull a slightly wider window from each event stream and slice
 * after merging to stay accurate when one event type dominates the other
 * (e.g. a freshly-deposited pool with no redeems yet).
 */
export async function getPoolActivity(args: {
  poolId: string;
  limit?: number;
}): Promise<PoolActivity[]> {
  const limit = args.limit ?? 25;
  const window = Math.min(50, limit * 4);

  const [redeems, deposits] = await Promise.all([
    listRedeems({ limit: window }),
    listReserveDeposits({ limit: window }),
  ]);

  const merged: PoolActivity[] = [
    ...redeems.items
      .filter((e) => e.poolId === args.poolId)
      .map((e) => ({ kind: "redeemed" as const, ...e })),
    ...deposits.items
      .filter((e) => e.poolId === args.poolId)
      .map((e) => ({ kind: "deposited" as const, ...e })),
  ];

  merged.sort((a, b) => b.timestampMs - a.timestampMs);
  return merged.slice(0, limit);
}
