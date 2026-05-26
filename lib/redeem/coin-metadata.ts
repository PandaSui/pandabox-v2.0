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

/**
 * Ownership classification for the on-chain `CoinMetadata<T>` object.
 *
 *   · `address`   — owned by a specific address (only that address can
 *                   reference it as an `&CoinMetadata<T>` in a tx)
 *   · `immutable` — frozen via `transfer::public_freeze_object`; anyone
 *                   can reference it, anyone can deploy a redeem pool
 *                   against it (this is where spam-pool risk lives)
 *   · `shared`    — rare; treated like `immutable` for our purposes
 *   · `unknown`   — RPC lookup failed; UI should not surface a trust
 *                   signal in this case
 */
export type CoinMetadataOwner =
  | { kind: "address"; address: string }
  | { kind: "immutable" }
  | { kind: "shared" }
  | { kind: "unknown" };

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
  /**
   * Ownership of the on-chain `CoinMetadata<T>` object — the signal we
   * use to mark a pool as deployer-run. A frozen-metadata coin can be
   * "pooled" by anyone, so the badge is only awarded when both:
   *   1. The metadata is owned by a specific address (not frozen), AND
   *   2. The pool's `creator` matches that address.
   *
   * Defaults to `{ kind: "unknown" }` when the metadata object can't
   * be resolved (RPC error, destroyed, never published). UI treats
   * `unknown` the same as "not deployer-run".
   */
  owner: CoinMetadataOwner;
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

async function fetchMetadataOwner(
  metadataId: string,
): Promise<CoinMetadataOwner> {
  // `suix_getCoinMetadata` returns the metadata fields but not the
  // object owner — we need a separate `sui_getObject` round-trip with
  // `showOwner: true` to classify it. Returns "unknown" on RPC failure
  // so the caller can fall back gracefully (no trust signal at all is
  // better than a wrong one).
  try {
    const res = await client().getObject({
      id: metadataId,
      options: { showOwner: true },
    });
    const owner = res?.data?.owner;
    if (!owner) return { kind: "unknown" };
    if (owner === "Immutable") return { kind: "immutable" };
    if (typeof owner === "object") {
      if ("AddressOwner" in owner) {
        return { kind: "address", address: owner.AddressOwner };
      }
      if ("ObjectOwner" in owner) {
        return { kind: "address", address: owner.ObjectOwner };
      }
      if ("Shared" in owner) return { kind: "shared" };
    }
    return { kind: "unknown" };
  } catch (err) {
    console.error(`[redeem] fetchMetadataOwner(${metadataId}) failed:`, err);
    return { kind: "unknown" };
  }
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
        owner: { kind: "unknown" },
      };
    }
    // Hydrate the owner in parallel with the rest of the metadata —
    // single extra `sui_getObject` call per coin type, batched alongside
    // the existing `suix_getCoinMetadata` so the discovery surface
    // doesn't get noticeably slower.
    const owner = res.id
      ? await fetchMetadataOwner(res.id)
      : ({ kind: "unknown" } as CoinMetadataOwner);
    return {
      coinType,
      name: res.name || fallback.name,
      symbol: res.symbol || fallback.symbol,
      decimals: typeof res.decimals === "number" ? res.decimals : 9,
      description: res.description ?? "",
      iconUrl: resolveIconUrl(res.iconUrl),
      owner,
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
      owner: { kind: "unknown" },
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
