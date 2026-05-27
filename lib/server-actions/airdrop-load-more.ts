"use server";

import { listAirdrops, getCoinMetadataMap } from "@/lib/airdrop/server";
import { toWire } from "@/lib/airdrop/wire";
import type {
  AirdroppedEventWire,
  EventPageCursor,
} from "@/lib/airdrop";
import type { CoinMetadataMap } from "@/lib/airdrop/server";

/**
 * Server action that returns the next page of `Airdropped` events for
 * the activity feed's "Load more" button. Mirrors the initial fetch
 * from `app/airdrop/page.tsx`:
 *
 *   1. fullnode event query starting at `cursor`
 *   2. CoinMetadata batch lookup for any new coin types in the page
 *
 * Bigint serialization: amounts ride as decimal strings via `toWire`
 * (see `lib/airdrop/wire.ts`); the client lifts back to `bigint` after
 * the await.
 */

export type LoadMoreAirdropsResult = {
  items: AirdroppedEventWire[];
  nextCursor: EventPageCursor | null;
  hasNextPage: boolean;
  metadata: CoinMetadataMap;
};

const PAGE_SIZE = 30;

export async function loadMoreAirdrops(
  cursor: EventPageCursor | null,
): Promise<LoadMoreAirdropsResult> {
  const page = await listAirdrops({ limit: PAGE_SIZE, cursor });
  const metadata = await getCoinMetadataMap(
    page.items.map((e) => e.coinType),
  );
  return {
    items: page.items.map(toWire),
    nextCursor: page.nextCursor,
    hasNextPage: page.hasNextPage,
    metadata,
  };
}
