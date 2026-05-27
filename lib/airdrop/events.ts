import "server-only";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "@/lib/sui";
import {
  AIRDROP_EVENT_TYPE,
  AIRDROP_IS_DEPLOYED,
} from "@/lib/contracts/airdrop";
import { parseAirdropped } from "./parse";
import type {
  AirdroppedEvent,
  EventPage,
  EventPageCursor,
} from "./types";

/**
 * Paginated event reader for the Airdrop contract. Single Move event type
 * matters at the user-facing surface — `airdrop::Airdropped`. Admin-side
 * events (`FeeUpdated`, `MaxRecipientsUpdated`, etc.) can be wired in
 * later when the operator console exists.
 *
 * Cursor shape matches Sui's `EventID` (`{ txDigest, eventSeq }`) so the
 * caller can echo it back unchanged. Results are descending (newest
 * first) to match what `suix_queryEvents` returns with
 * `descending_order: true`.
 *
 * Volume-wise: a single fullnode query handles up to 50 events per page,
 * which is plenty until the platform grows past a few thousand airdrops.
 * When that day comes the signature stays the same — only the backing
 * implementation moves to a Postgres indexer.
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
  if (!AIRDROP_IS_DEPLOYED) {
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

/** Newest airdrops first across the entire platform. */
export function listAirdrops(
  args: QueryArgs = {},
): Promise<EventPage<AirdroppedEvent>> {
  return queryEvents(
    AIRDROP_EVENT_TYPE.Airdropped,
    args,
    parseAirdropped,
  );
}

/**
 * Per-caller activity. The Move event filter doesn't support narrowing by
 * `caller` directly, so this fetches recent pages and filters client-side
 * until we've collected `limit` matches or exhausted `maxPages`.
 *
 * For wallets with few airdrops this returns immediately; for the lifetime
 * activity tab on a hot wallet, callers should add a `maxPages` cap so the
 * UI doesn't stall scanning a long tail.
 */
export async function listAirdropsByCaller(
  callerAddress: string,
  opts: { limit?: number; maxPages?: number } = {},
): Promise<AirdroppedEvent[]> {
  const wanted = Math.max(1, opts.limit ?? 20);
  const maxPages = Math.max(1, opts.maxPages ?? 6);
  const needle = callerAddress.toLowerCase();
  const out: AirdroppedEvent[] = [];
  let cursor: EventPageCursor | null = null;
  for (let i = 0; i < maxPages; i += 1) {
    const page: EventPage<AirdroppedEvent> = await listAirdrops({
      limit: 50,
      cursor,
    });
    for (const ev of page.items) {
      if (ev.caller.toLowerCase() === needle) {
        out.push(ev);
        if (out.length >= wanted) return out;
      }
    }
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}
