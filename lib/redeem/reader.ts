import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "@/lib/sui";
import {
  REDEEM_IS_DEPLOYED,
  REDEEM_PLATFORM_ID,
} from "@/lib/contracts/redeem";
import {
  parseRedeemPlatform,
  parseRedeemPool,
} from "./parse";
import type { RedeemPlatformState, RedeemPoolState } from "./types";

/**
 * Server-side read layer for the Redeem contract. Mirrors the pattern in
 * `lib/platform.ts` for the launchpad — `unstable_cache` wraps each fetch
 * so RSC pages can pull live state without hammering the fullnode, and
 * falls back to `null` on any RPC hiccup (the UI handles the empty case).
 */

let _client: SuiJsonRpcClient | null = null;
function client(): SuiJsonRpcClient {
  if (!_client) {
    const network = getNetwork();
    _client = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(network),
      network,
    });
  }
  return _client;
}

/* ─────────────────────────── Platform ─────────────────────────── */

async function fetchRedeemPlatform(): Promise<RedeemPlatformState | null> {
  if (!REDEEM_IS_DEPLOYED) return null;
  const res = await client().getObject({
    id: REDEEM_PLATFORM_ID,
    options: { showContent: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  return parseRedeemPlatform(
    REDEEM_PLATFORM_ID,
    content.fields as Record<string, unknown>,
  );
}

/**
 * Live `RedeemPlatform` state — fee_bps, treasury address, fee balance,
 * paused flag, total pool count. Cached for 60s.
 */
export const getRedeemPlatform = unstable_cache(
  async (): Promise<RedeemPlatformState | null> => {
    try {
      return await fetchRedeemPlatform();
    } catch (err) {
      console.error("[redeem] getRedeemPlatform failed:", err);
      return null;
    }
  },
  ["redeem:platform"],
  { revalidate: 60, tags: ["redeem-platform"] },
);

/* ─────────────────────────── Pool ─────────────────────────── */

async function fetchRedeemPool(
  poolId: string,
  platformTreasuryAddress?: string,
): Promise<RedeemPoolState | null> {
  const res = await client().getObject({
    id: poolId,
    options: { showContent: true, showType: true },
  });
  const data = res.data;
  const content = data?.content;
  if (!content || content.dataType !== "moveObject" || !data?.type) return null;
  return parseRedeemPool({
    objectId: poolId,
    objectType: data.type,
    fields: content.fields as Record<string, unknown>,
    platformTreasuryAddress,
  });
}

/**
 * Live `RedeemPool<T>` state for a specific pool ID. Cached per-id for
 * 30s — pools change state on every redeem so we keep this shorter than
 * the platform cache, but still long enough to absorb burst reads from
 * a single page render.
 *
 * Pass the platform treasury address (if you already have it) so
 * `recipientMode` can be classified correctly. Pass `undefined` to fall
 * back to the "buyback" default for any non-burn recipient.
 */
export const getRedeemPool = unstable_cache(
  async (
    poolId: string,
    platformTreasuryAddress?: string,
  ): Promise<RedeemPoolState | null> => {
    try {
      return await fetchRedeemPool(poolId, platformTreasuryAddress);
    } catch (err) {
      console.error(`[redeem] getRedeemPool(${poolId}) failed:`, err);
      return null;
    }
  },
  ["redeem:pool"],
  { revalidate: 30, tags: ["redeem-pool"] },
);

/**
 * Multi-pool fetch. Used by the discovery surface to hydrate the cards
 * returned from the event-driven listing. Runs the per-pool reads in
 * parallel — `getObject` is cheap and these are independent.
 */
export async function getRedeemPools(
  poolIds: readonly string[],
  platformTreasuryAddress?: string,
): Promise<RedeemPoolState[]> {
  if (poolIds.length === 0) return [];
  const out = await Promise.all(
    poolIds.map((id) => getRedeemPool(id, platformTreasuryAddress)),
  );
  return out.filter((p): p is RedeemPoolState => p !== null);
}
