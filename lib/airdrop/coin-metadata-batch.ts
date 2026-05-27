import "server-only";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { unstable_cache } from "next/cache";
import { getNetwork } from "@/lib/sui";

/**
 * Server-side batched `CoinMetadata<T>` lookup for the activity feed.
 *
 * The feed renders one row per `Airdropped` event, each carrying a
 * `coinType` string. To display "12.40 TURBOS" instead of "12,400,000,000
 * base units" we need the coin's `decimals` + `symbol`. Calling
 * `getCoinMetadata` once per type would be N HTTP requests for an
 * N-event page — wasteful when most pages share a handful of types.
 *
 * This helper:
 *
 *   - dedupes by `coinType`
 *   - issues one fullnode call per unique type, in parallel
 *   - caches each result for an hour via `unstable_cache` (`CoinMetadata`
 *     never changes after creation, so a long TTL is safe)
 *
 * Returns a partial map — types whose metadata can't be resolved (no
 * `CoinMetadata` published, RPC error) are simply absent. The renderer
 * falls back to a synthesized symbol + `decimals: 0` for missing
 * entries.
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

export type CoinMetadataLite = {
  symbol: string | null;
  name: string | null;
  decimals: number;
  iconUrl: string | null;
};

export type CoinMetadataMap = Record<string, CoinMetadataLite>;

const _singleCached = unstable_cache(
  async (coinType: string): Promise<CoinMetadataLite | null> => {
    try {
      const meta = await client().getCoinMetadata({ coinType });
      if (!meta) return null;
      return {
        symbol: meta.symbol ?? null,
        name: meta.name ?? null,
        decimals: meta.decimals ?? 0,
        iconUrl: meta.iconUrl ?? null,
      };
    } catch {
      return null;
    }
  },
  ["airdrop:coinMetadata"],
  // `CoinMetadata` is effectively immutable once the publisher freezes
  // it; the rare update path (icon change via a custom updater function)
  // is so seldom used we'd rather amortise an hour of staleness than
  // pay an RPC per row.
  { revalidate: 3600, tags: ["airdrop-coin-metadata"] },
);

export async function getCoinMetadataMap(
  coinTypes: readonly string[],
): Promise<CoinMetadataMap> {
  const unique = Array.from(new Set(coinTypes)).filter(Boolean);
  if (unique.length === 0) return {};
  const entries = await Promise.all(
    unique.map(async (t) => [t, await _singleCached(t)] as const),
  );
  const out: CoinMetadataMap = {};
  for (const [t, m] of entries) {
    if (m) out[t] = m;
  }
  return out;
}
