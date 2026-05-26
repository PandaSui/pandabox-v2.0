import "server-only";
import { getRedeemPlatform, getRedeemPools } from "./reader";
import { listPoolsCreated } from "./events";
import { getCoinMetadataMap, type CoinMetadataResolved } from "./coin-metadata";
import { getOnchainProjects } from "@/lib/projects";
import type {
  RedeemPlatformState,
  RedeemPoolState,
  PoolCreatedEvent,
} from "./types";

/**
 * Look up the Pandabox creator for a given coin type. Returns the
 * address that deployed the matching `Project<T>` via the launchpad,
 * or `null` if no Pandabox project exists for that coin type.
 *
 * This is the on-chain fallback used to award the "deployer-run" badge
 * to coins whose `CoinMetadata` is frozen — for coins launched through
 * Pandabox we know the deployer regardless of metadata ownership,
 * because the `Project<T>` Move object carries the creator field. The
 * project list is already `unstable_cache`'d in `lib/projects.ts` so
 * repeat lookups in the same render cost nothing.
 */
export async function getPandaboxCreatorForCoin(
  coinType: string,
): Promise<string | null> {
  if (!coinType) return null;
  const projects = await getOnchainProjects();
  const match = projects.find((p) => p.tokenType === coinType);
  return match?.creator ?? null;
}

/**
 * Discrete trust classifications for a pool against its underlying
 * coin. The three states map to distinct UI affordances — see the
 * detailed comments below for what each one means and when it fires.
 */
export type PoolTrustSignal =
  /**
   * The pool's creator matches a verifiable on-chain deployer. Either:
   *   · `metadata.owner.address === pool.creator` (works for any coin
   *     whose `CoinMetadata` is `AddressOwner`), OR
   *   · `pandaboxCreator === pool.creator` (closes the gap for
   *     Pandabox-launched coins whose metadata was frozen — we still
   *     know the canonical deployer from the launchpad record).
   * UI: jade DEPLOYER-RUN pill.
   */
  | "deployer-run"
  /**
   * The pool's creator is verifiably *not* the deployer of the coin.
   * Currently this only fires when the coin was launched via Pandabox
   * (so we have a known-good deployer address) but the pool's creator
   * differs from that address. Treat as a strong negative signal —
   * the pool is technically valid but it wasn't deployed by whoever
   * minted the coin, so a holder should compare rates and reserves
   * carefully before redeeming.
   * UI: poppy UNOFFICIAL pill.
   */
  | "unofficial"
  /**
   * We can't say either way. The metadata is frozen (so the on-chain
   * owner gives us no signal) and there's no Pandabox record for the
   * coin to fall back on — typical for the bulk of the Sui ecosystem
   * (USDC, DEEP, etc.). We deliberately render nothing here so a
   * pool for a popular non-Pandabox coin isn't false-flagged as
   * suspicious; if a holder cares, they can verify via off-chain
   * signals (reserve depth, project comms, etc.).
   * UI: no badge.
   */
  | "unverified";

/**
 * Classify a pool's relationship to its underlying coin's deployer.
 * See `PoolTrustSignal` for what each value means and the badge UI
 * each one drives.
 */
export function getPoolTrustSignal(args: {
  poolCreator: string;
  metadataOwner: CoinMetadataResolved["owner"];
  pandaboxCreator?: string | null;
}): PoolTrustSignal {
  const lower = args.poolCreator.toLowerCase();

  if (
    args.metadataOwner.kind === "address" &&
    args.metadataOwner.address.toLowerCase() === lower
  ) {
    return "deployer-run";
  }
  if (
    args.pandaboxCreator &&
    args.pandaboxCreator.toLowerCase() === lower
  ) {
    return "deployer-run";
  }
  // Coin has a known deployer on Pandabox AND the pool's creator is a
  // different address — strongest negative signal we can show without
  // calling something "scam" outright.
  if (
    args.pandaboxCreator &&
    args.pandaboxCreator.toLowerCase() !== lower
  ) {
    return "unofficial";
  }
  // Owned-metadata case where the contract permitted the deploy but
  // the metadata owner doesn't match — this *shouldn't* normally
  // happen since the contract requires `&CoinMetadata<T>` (only the
  // owner can pass it), but ownership could have transferred AFTER
  // the pool was deployed, leaving a stale mismatch on chain. Flag
  // it the same way so the holder verifies.
  if (args.metadataOwner.kind === "address") {
    return "unofficial";
  }
  return "unverified";
}

/**
 * Convenience wrapper kept for back-compat with existing call sites
 * that only need the boolean answer. New code should prefer
 * `getPoolTrustSignal` so it can distinguish the three states.
 */
export function isDeployerRunPool(args: {
  poolCreator: string;
  metadataOwner: CoinMetadataResolved["owner"];
  pandaboxCreator?: string | null;
}): boolean {
  return getPoolTrustSignal(args) === "deployer-run";
}

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
  /**
   * Pandabox-launched coins carry their canonical deployer address on
   * the `Project<T>` object regardless of metadata ownership. Populated
   * when this pool's coin was launched through Pandabox, `null`
   * otherwise. Used as the fallback signal for the deployer-run badge
   * so a coin whose `CoinMetadata` is frozen can still qualify.
   */
  pandaboxCreator: string | null;
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

  // Hydrate pool state + metadata + Pandabox project map in parallel.
  // `getOnchainProjects` is `unstable_cache`'d (60s revalidate), so the
  // discovery grid pays for it once per cache window. We build a
  // tokenType → creator map from it so every pool below can look up
  // its Pandabox deployer (if any) in O(1).
  const [pools, metadataMap, pandaboxProjects] = await Promise.all([
    getRedeemPools(
      events.map((e) => e.poolId),
      platform?.treasuryAddress,
    ),
    getCoinMetadataMap(events.map((e) => e.coinType)),
    getOnchainProjects(),
  ]);
  const pandaboxCreatorByCoin = new Map<string, string>(
    pandaboxProjects.map((p) => [p.tokenType, p.creator]),
  );

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
      pandaboxCreator: pandaboxCreatorByCoin.get(pool.coinType) ?? null,
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
