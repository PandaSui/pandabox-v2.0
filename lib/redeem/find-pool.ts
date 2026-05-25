import { REDEEM_EVENT_TYPE } from "@/lib/contracts/redeem";
import { normalizeCoinType } from "./parse";

/**
 * The slice of `SuiClient` we actually need. Typed structurally so this
 * file doesn't pin a particular SDK entrypoint — callers pass either
 * `useSuiClient()` from dapp-kit or a server `SuiJsonRpcClient`.
 */
type EventQueryClient = {
  queryEvents: (input: {
    query: { MoveEventType: string };
    cursor?: { txDigest: string; eventSeq: string } | null;
    limit?: number;
    order?: "ascending" | "descending";
  }) => Promise<{
    data: Array<{
      parsedJson: unknown;
      id: { txDigest: string; eventSeq: string };
    }>;
    nextCursor?: { txDigest: string; eventSeq: string } | null;
    hasNextPage: boolean;
  }>;
};

/**
 * Walk recent `PoolCreated` events looking for the first one whose
 * `coin_type` matches the input. Caller is responsible for providing a
 * `SuiClient` (`useSuiClient()` from dapp-kit), so this function can be
 * called from either server (via `SuiJsonRpcClient`) or client
 * (`useSuiClient`) callers.
 *
 * The redeem contract rejects duplicate pools for the same `T` with an
 * abort code, so this is the cheapest way to give the wizard's Step 1
 * a clear "this coin already has a pool — open it" hint before the
 * user fills in the rest of the form.
 *
 * We paginate up to `maxPages × 50` events. With small pool counts
 * (early mainnet) this returns in one page; we'll swap the implementation
 * for an indexer when total pool volume justifies it.
 */
export async function findPoolByCoinType(args: {
  client: EventQueryClient;
  coinType: string;
  maxPages?: number;
}): Promise<{ poolId: string; creator: string; timestampMs: number } | null> {
  const target = normalizeCoinType(args.coinType);
  if (!target) return null;
  const pages = args.maxPages ?? 4;
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  for (let i = 0; i < pages; i++) {
    const res = await args.client.queryEvents({
      query: { MoveEventType: REDEEM_EVENT_TYPE.PoolCreated },
      cursor,
      limit: 50,
      order: "descending",
    });
    for (const ev of res.data) {
      const parsed = (ev.parsedJson ?? {}) as {
        pool_id?: string;
        creator?: string;
        coin_type?: { name?: string };
        timestamp_ms?: string | number;
      };
      const raw = parsed.coin_type?.name ?? "";
      if (normalizeCoinType(raw) === target) {
        return {
          poolId: parsed.pool_id ?? "",
          creator: parsed.creator ?? "",
          timestampMs: Number(parsed.timestamp_ms ?? 0),
        };
      }
    }
    if (!res.hasNextPage) break;
    cursor = res.nextCursor ?? null;
  }
  return null;
}
