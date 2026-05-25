import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "@/lib/sui";

/**
 * Sui `CoinMetadata<T>` resolver. Each `T` has at most one metadata object
 * on-chain, and metadata rarely changes — so we cache aggressively (24h)
 * and fall back to derived values from the type tag when the RPC lookup
 * misses (e.g. for coins whose metadata was destroyed or never published).
 *
 * Public API: `getCoinMetadata(coinType)` for a single type, or
 * `getCoinMetadataMap(coinTypes)` for parallel multi-fetch — used by the
 * `/redeem` discovery surface to hydrate every pool card in one round trip.
 */

export type CoinMetadataResolved = {
  coinType: string;
  /** Display name from CoinMetadata, or the module name as a fallback. */
  name: string;
  /** Ticker symbol, e.g. "FOMO". Falls back to the type name in caps. */
  symbol: string;
  decimals: number;
  description: string;
  /** Resolved gateway URL or `null` if no icon was set. */
  iconUrl: string | null;
};

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

/**
 * Extract a sensible display name out of a coin type tag. Used as the
 * fallback when on-chain metadata is missing.
 *
 *   "0xabc…::fomo::FOMO" → "FOMO"
 */
function fallbackFromType(coinType: string): { name: string; symbol: string } {
  const lastSegment = coinType.split("::").pop() ?? coinType;
  const symbol = lastSegment.toUpperCase();
  const name = lastSegment.charAt(0) + lastSegment.slice(1).toLowerCase();
  return { name, symbol };
}

/**
 * Some projects store IPFS URIs in `iconUrl`. Normalize to a public gateway
 * so `next/image` can fetch them. Pass-through for http(s) URLs.
 */
function resolveIconUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("ipfs://")) {
    const cid = v.slice("ipfs://".length).replace(/^\/+/, "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  // Some metadata uses bare CIDs — defensively gateway them too.
  if (/^[a-z0-9]{20,}$/i.test(v)) return `https://ipfs.io/ipfs/${v}`;
  return v;
}

async function fetchCoinMetadata(
  coinType: string,
): Promise<CoinMetadataResolved> {
  const fallback = fallbackFromType(coinType);
  try {
    const res = await client().getCoinMetadata({ coinType });
    if (!res) {
      return {
        coinType,
        name: fallback.name,
        symbol: fallback.symbol,
        decimals: 9,
        description: "",
        iconUrl: null,
      };
    }
    return {
      coinType,
      name: res.name || fallback.name,
      symbol: res.symbol || fallback.symbol,
      decimals: typeof res.decimals === "number" ? res.decimals : 9,
      description: res.description ?? "",
      iconUrl: resolveIconUrl(res.iconUrl),
    };
  } catch (err) {
    console.error(`[redeem] getCoinMetadata(${coinType}) failed:`, err);
    return {
      coinType,
      name: fallback.name,
      symbol: fallback.symbol,
      decimals: 9,
      description: "",
      iconUrl: null,
    };
  }
}

/** Cached single-coin lookup. 24h cache — metadata rarely changes. */
export const getCoinMetadata = unstable_cache(
  fetchCoinMetadata,
  ["redeem:coin-metadata"],
  { revalidate: 60 * 60 * 24, tags: ["coin-metadata"] },
);

/**
 * Parallel multi-fetch — returns a `coinType → metadata` map. Dedupes the
 * input first so we never spend an RPC roundtrip on a type we already
 * looked up in this call.
 */
export async function getCoinMetadataMap(
  coinTypes: readonly string[],
): Promise<Record<string, CoinMetadataResolved>> {
  const unique = Array.from(new Set(coinTypes));
  const resolved = await Promise.all(unique.map((t) => getCoinMetadata(t)));
  const out: Record<string, CoinMetadataResolved> = {};
  for (const meta of resolved) out[meta.coinType] = meta;
  return out;
}
