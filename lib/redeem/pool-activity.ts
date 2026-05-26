import "server-only";
import {
  listPoolsCreated,
  listRedeems,
  listReserveDeposits,
} from "./events";
import type {
  PoolCreatedEvent,
  RedeemedEvent,
  ReserveDepositedEvent,
} from "./types";

/**
 * Pool-scoped activity feed. The on-chain event filter doesn't narrow by
 * pool id, only by event type — so we pull recent windows for each
 * relevant event (PoolCreated + Redeemed + ReserveDeposited) across the
 * whole platform and filter client-side to this pool. Cheap on volume;
 * revisit when total activity crosses a few hundred events per minute.
 *
 * Events are normalized into a single `PoolActivity` union sorted newest
 * first, so the UI can render them as one chronological feed. The
 * `PoolCreated` event is rare per pool (exactly one) but emitting it as
 * an activity row anchors the timeline — without it, a brand-new pool
 * with no redeems yet shows an empty feed even though something *did*
 * happen on-chain.
 */

export type PoolActivity =
  | ({ kind: "created" } & PoolCreatedEvent)
  | ({ kind: "redeemed" } & RedeemedEvent)
  | ({ kind: "deposited" } & ReserveDepositedEvent);

/**
 * Fetch up to `limit` of the most recent activity entries for a specific
 * pool. We pull a slightly wider window from each event stream and slice
 * after merging to stay accurate when one event type dominates the
 * others (e.g. a freshly-deposited pool with no redeems yet).
 */
export async function getPoolActivity(args: {
  poolId: string;
  limit?: number;
}): Promise<PoolActivity[]> {
  const limit = args.limit ?? 25;
  const window = Math.min(50, limit * 4);

  const [created, redeems, deposits] = await Promise.all([
    // `PoolCreated` is rare per pool — pull a slightly smaller window
    // since the whole-platform stream is dominated by creates only as
    // a tiny fraction of the others. The client-side filter is still
    // O(window) so this stays cheap.
    listPoolsCreated({ limit: window }),
    listRedeems({ limit: window }),
    listReserveDeposits({ limit: window }),
  ]);

  const merged: PoolActivity[] = [
    ...created.items
      .filter((e) => e.poolId === args.poolId)
      .map((e) => ({ kind: "created" as const, ...e })),
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
