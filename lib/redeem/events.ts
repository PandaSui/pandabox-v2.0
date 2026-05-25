import "server-only";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "@/lib/sui";
import {
  REDEEM_EVENT_TYPE,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import {
  parsePoolCreated,
  parseRedeemed,
  parseReserveDeposited,
} from "./parse";
import type {
  EventPage,
  EventPageCursor,
  PoolCreatedEvent,
  RedeemedEvent,
  ReserveDepositedEvent,
} from "./types";

/**
 * Paginated event readers — the only discovery primitive we have until a
 * dedicated indexer lands. Cheap to call against the public fullnode for
 * the volume we expect in early mainnet (handfuls of pools, redeems on
 * the order of seconds). When pool count crosses ~50 we'll want a Postgres
 * indexer behind these signatures so callers don't have to change.
 *
 * Cursor shape matches Sui's `EventID` directly — `{ txDigest, eventSeq }`
 * — so the caller can echo it back unchanged.
 *
 * The result is sorted descending by transaction (newest first) to match
 * what `suix_queryEvents` returns with `descending_order: true`.
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

type QueryArgs = {
  limit?: number;
  cursor?: EventPageCursor | null;
};

type RawEvent = {
  id: { txDigest: string; eventSeq: string };
  parsedJson: Record<string, unknown>;
};

async function queryEvents<T>(
  type: string,
  args: QueryArgs,
  parser: (e: RawEvent) => T,
): Promise<EventPage<T>> {
  if (!REDEEM_IS_DEPLOYED) {
    return { items: [], nextCursor: null, hasNextPage: false };
  }
  const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
  const res = await client().queryEvents({
    query: { MoveEventType: type },
    cursor: args.cursor ?? null,
    limit,
    order: "descending",
  });
  return {
    items: res.data.map((e) =>
      parser({
        id: e.id,
        parsedJson: (e.parsedJson ?? {}) as Record<string, unknown>,
      }),
    ),
    nextCursor: res.nextCursor ?? null,
    hasNextPage: Boolean(res.hasNextPage),
  };
}

/** Newest pools first. */
export function listPoolsCreated(
  args: QueryArgs = {},
): Promise<EventPage<PoolCreatedEvent>> {
  return queryEvents(
    REDEEM_EVENT_TYPE.PoolCreated,
    args,
    parsePoolCreated,
  );
}

/**
 * All redeem events across the platform. For a specific pool, callers
 * filter client-side from the returned page (the event filter doesn't
 * support pool-id narrowing directly — only by type).
 */
export function listRedeems(
  args: QueryArgs = {},
): Promise<EventPage<RedeemedEvent>> {
  return queryEvents(REDEEM_EVENT_TYPE.Redeemed, args, parseRedeemed);
}

/** All reserve deposits across the platform. */
export function listReserveDeposits(
  args: QueryArgs = {},
): Promise<EventPage<ReserveDepositedEvent>> {
  return queryEvents(
    REDEEM_EVENT_TYPE.ReserveDeposited,
    args,
    parseReserveDeposited,
  );
}
