import "server-only";
import { getRedeemPlatform, getRedeemPools } from "./reader";
import { listPoolsCreated } from "./events";
import { getCoinMetadataMap, type CoinMetadataResolved } from "./coin-metadata";
import type {
  RedeemPlatformState,
  RedeemPoolState,
  PoolCreatedEvent,
} from "./types";

/**
 * A pool that's been fully hydrated for UI consumption: live on-chain
 * state, the coin metadata, and the originating `PoolCreated` event in
 * case the card wants the creator-at-deploy or initial-deposit values.
 *
 * This is the canonical shape every discovery surface (the `/redeem`
 * landing grid, the `/tools` redeem teaser, embedded "your pool" cards
 * on `/dashboard`) reads.
 */
export type HydratedPool = {
  pool: RedeemPoolState;
  metadata: CoinMetadataResolved;
  /** Event the pool was created from — `null` if we couldn't find it. */
  createdEvent: PoolCreatedEvent | null;
};

export type RedeemDiscoveryPage = {
  platform: RedeemPlatformState | null;
  pools: HydratedPool[];
  /**
   * Aggregates across the rendered set — useful for the header stat strip
   * without forcing the page to recompute them.
   */
  totals: {
    poolCount: number;
    reserveMist: bigint;
    paidOutMist: bigint;
  };
};

/**
 * Hydrate the top-N most recently created pools into the shape the
 * discovery UI consumes. Ordering matches `listPoolsCreated` (newest
 * first); pools whose object lookup failed are skipped so a single 404
 * doesn't break the grid.
 *
 * `limit` should match the page's visual capacity (we fetch in one shot
 * for v1). When pool count crosses ~50, a dedicated indexer will sit
 * behind this signature and pagination becomes a real concern.
 */
export async function getRedeemDiscovery(
  limit = 30,
): Promise<RedeemDiscoveryPage> {
  const platform = await getRedeemPlatform();

  const eventPage = await listPoolsCreated({ limit });
  const events = eventPage.items;
  if (events.length === 0) {
    return {
      platform,
      pools: [],
      totals: { poolCount: 0, reserveMist: 0n, paidOutMist: 0n },
    };
  }

  // Hydrate pool state + metadata in parallel.
  const [pools, metadataMap] = await Promise.all([
    getRedeemPools(
      events.map((e) => e.poolId),
      platform?.treasuryAddress,
    ),
    getCoinMetadataMap(events.map((e) => e.coinType)),
  ]);

  // Build an event lookup once, then re-walk the events array so the final
  // order matches the on-chain "newest first" without depending on the
  // order `Promise.all(getObject)` happened to resolve in.
  const eventByPool = new Map<string, PoolCreatedEvent>(
    events.map((e) => [e.poolId, e]),
  );
  const poolById = new Map<string, RedeemPoolState>(
    pools.map((p) => [p.objectId, p]),
  );

  const hydrated: HydratedPool[] = [];
  for (const ev of events) {
    const pool = poolById.get(ev.poolId);
    if (!pool) continue; // skip pools we couldn't read
    const metadata = metadataMap[pool.coinType];
    if (!metadata) continue; // metadata fetcher always returns a fallback, but typesafe-skip just in case
    hydrated.push({
      pool,
      metadata,
      createdEvent: eventByPool.get(pool.objectId) ?? null,
    });
  }

  const totals = hydrated.reduce(
    (acc, h) => {
      acc.reserveMist += h.pool.suiReserveMist;
      acc.paidOutMist += h.pool.totalSuiPaidOutMist;
      return acc;
    },
    { poolCount: hydrated.length, reserveMist: 0n, paidOutMist: 0n },
  );

  return { platform, pools: hydrated, totals };
}
