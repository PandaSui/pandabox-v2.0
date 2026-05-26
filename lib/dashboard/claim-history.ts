import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "../sui";
import { PACKAGE_ID, IS_DEPLOYED } from "../contracts/pandabox";

/**
 * Per-wallet *historical* claim ledger — the projects a wallet backed and
 * has since claimed.
 *
 * The dashboard's "supported" section is normally driven by
 * `ContributionReceipt<T>` *holdings* (see `lib/holdings.ts`), which
 * surfaces projects you've contributed to and not yet claimed. Once a
 * holder claims, the receipt is burned and the project drops out of
 * that list — the wallet has no on-chain artifact left to enumerate.
 *
 * This helper closes that gap by walking the `Claimed` event stream
 * filtered to events where the claimer matches the wallet, and groups
 * them by project so the dashboard can render a "claimed" historical
 * row even after the supporting receipt has been burned.
 *
 * We pull a generous event window because claim events are rare per
 * wallet (one per receipt) so paginating deep is acceptable — but cap
 * at `maxPages × 50` so a runaway query can't slow the dashboard.
 *
 * Cached per-address for 60s (`updateTag("holdings")` busts this when a
 * claim lands so the user sees their fresh history immediately).
 */

export type ClaimRecord = {
  projectId: string;
  /** Mist of SUI originally contributed for the receipts that were burned. */
  suiAmount: bigint;
  /** Raw u64 token share delivered to the claimer. */
  tokenShare: bigint;
  timestampMs: number;
  txDigest: string;
};

/** Per-project aggregate for a single user's claim history. */
export type ClaimedProjectAggregate = {
  projectId: string;
  /** Sum of SUI from every claim event the user has on this project. */
  totalSui: bigint;
  /** Sum of tokens delivered across every claim. */
  totalTokens: bigint;
  /** Newest claim — drives sort order and "last touched" labels. */
  latestClaimAtMs: number;
  /** All tx digests that comprise this aggregate, newest first. */
  txDigests: string[];
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

async function fetchClaimHistory(address: string): Promise<ClaimRecord[]> {
  if (!IS_DEPLOYED || !/^0x[0-9a-fA-F]{1,64}$/.test(address)) return [];

  const EVENT_TYPE = `${PACKAGE_ID}::project::Claimed`;
  const out: ClaimRecord[] = [];
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  const maxPages = 8;

  for (let page = 0; page < maxPages; page++) {
    const res = await client().queryEvents({
      query: { MoveEventType: EVENT_TYPE },
      cursor,
      limit: 50,
      order: "descending",
    });

    for (const ev of res.data) {
      const json = ev.parsedJson as Record<string, unknown>;
      // The contract's `Claimed` event field for the claimer is `user`
      // (verified in lib/activity.ts where the same event is parsed).
      const user = String(json.user ?? "");
      if (user.toLowerCase() !== address.toLowerCase()) continue;

      const projectId = String(json.project_id ?? "");
      if (!projectId) continue;

      out.push({
        projectId,
        suiAmount: BigInt(String(json.sui_amount ?? "0")),
        tokenShare: BigInt(String(json.token_share ?? "0")),
        timestampMs: Number(ev.timestampMs ?? json.timestamp_ms ?? 0),
        txDigest: ev.id.txDigest,
      });
    }

    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  return out;
}

const _cached = unstable_cache(
  async (address: string) => fetchClaimHistory(address),
  ["dashboard:claim-history"],
  // 60s revalidate matches the rest of the dashboard's tag cadence;
  // `updateTag("holdings")` after a claim invalidates this immediately
  // so the user sees their newly-claimed project on next page load.
  { revalidate: 60, tags: ["holdings"] },
);

/**
 * Per-project aggregates for a wallet's claim history. Convenient shape
 * for the dashboard, which renders one row per project.
 */
export async function getClaimHistoryByProject(
  address: string,
): Promise<Map<string, ClaimedProjectAggregate>> {
  const records = await _cached(address);
  // Reattach bigint values lost through JSON serialization inside the
  // cache wrapper (`unstable_cache` JSON-serializes its return).
  const hydrated: ClaimRecord[] = records.map((r) => ({
    projectId: r.projectId,
    suiAmount: BigInt(r.suiAmount.toString()),
    tokenShare: BigInt(r.tokenShare.toString()),
    timestampMs: r.timestampMs,
    txDigest: r.txDigest,
  }));

  const byProject = new Map<string, ClaimedProjectAggregate>();
  for (const r of hydrated) {
    const existing = byProject.get(r.projectId);
    if (existing) {
      existing.totalSui += r.suiAmount;
      existing.totalTokens += r.tokenShare;
      existing.latestClaimAtMs = Math.max(
        existing.latestClaimAtMs,
        r.timestampMs,
      );
      existing.txDigests.push(r.txDigest);
    } else {
      byProject.set(r.projectId, {
        projectId: r.projectId,
        totalSui: r.suiAmount,
        totalTokens: r.tokenShare,
        latestClaimAtMs: r.timestampMs,
        txDigests: [r.txDigest],
      });
    }
  }
  // Newest first within each project's tx list.
  for (const agg of byProject.values()) {
    agg.txDigests.reverse();
  }
  return byProject;
}
