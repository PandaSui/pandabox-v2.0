import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "./sui";
import { PACKAGE_ID, IS_DEPLOYED } from "./contracts/pandabox";
import { getOnchainProjects } from "./projects";
import { getPlatformStats } from "./platform";

export type OnChainAggregate = {
  totalRaisedMist: bigint;
  totalTokensMintedRaw: bigint;
  totalFeesMist: bigint;
  totalProjects: number;
  activeProjects: number;
  closedProjects: number;
  uniqueBackers: number;
  contributionCount: number;
  largestContributionMist: bigint;
  latestContributionMs: number | null;
  /** Last 24h window. */
  contributionCount24h: number;
  raised24hMist: bigint;
  /** Median project duration in days. */
  medianDurationDays: number;
  feeBps: number;
  /** Histogram of recent activity for the sparkline — most recent 12 buckets, oldest → newest. */
  hourlyBuckets: number[];
  /** When the aggregate was computed. */
  computedAtMs: number;
};

function emptyAggregate(): OnChainAggregate {
  return {
    totalRaisedMist: 0n,
    totalTokensMintedRaw: 0n,
    totalFeesMist: 0n,
    totalProjects: 0,
    activeProjects: 0,
    closedProjects: 0,
    uniqueBackers: 0,
    contributionCount: 0,
    largestContributionMist: 0n,
    latestContributionMs: null,
    contributionCount24h: 0,
    raised24hMist: 0n,
    medianDurationDays: 0,
    feeBps: 0,
    hourlyBuckets: new Array(12).fill(0),
    computedAtMs: Date.now(),
  };
}

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

type ContributedEvent = {
  contributor: string;
  suiAmountMist: bigint;
  timestampMs: number;
};

async function fetchAllContributed(): Promise<ContributedEvent[]> {
  const out: ContributedEvent[] = [];
  let cursor: { txDigest: string; eventSeq: string } | null = null;

  for (let i = 0; i < 16; i++) {
    const page = await client().queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::project::Contributed` },
      cursor,
      limit: 50,
      order: "descending",
    });

    for (const ev of page.data) {
      const p = ev.parsedJson as Record<string, unknown>;
      out.push({
        contributor: String(p.contributor ?? ""),
        suiAmountMist: BigInt(String(p.sui_amount ?? "0")),
        timestampMs: Number(p.timestamp_ms ?? 0),
      });
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return out;
}

async function computeAggregate(): Promise<OnChainAggregate> {
  if (!IS_DEPLOYED) return emptyAggregate();

  const [projects, platform, contributed] = await Promise.all([
    getOnchainProjects(),
    getPlatformStats(),
    fetchAllContributed(),
  ]);

  // Per-project rollups.
  let totalRaised = 0n;
  let totalSold = 0n;
  let active = 0;
  let closed = 0;
  for (const p of projects) {
    // base_rate is scaled to 9 decimals; mist = sold * 1e9 / base_rate.
    if (p.baseRate > 0)
      totalRaised += (p.sold * 1_000_000_000n) / BigInt(p.baseRate);
    totalSold += p.sold;
    if (p.status === "live") active++;
    if (p.status === "closed") closed++;
  }

  // Durations.
  const durations = projects
    .map((p) => (p.endTimeMs - p.createdAtMs) / 86_400_000)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  const median =
    durations.length === 0
      ? 0
      : durations[Math.floor(durations.length / 2)];

  // Contributed event rollups.
  const backers = new Set<string>();
  let largest = 0n;
  let latestMs = 0;
  const now = Date.now();
  const dayAgo = now - 86_400_000;
  let count24 = 0;
  let raised24 = 0n;
  const buckets = new Array(12).fill(0);
  // 2-hour buckets → 12 buckets = 24h window
  const bucketMs = 2 * 3_600_000;
  for (const e of contributed) {
    if (e.contributor) backers.add(e.contributor);
    if (e.suiAmountMist > largest) largest = e.suiAmountMist;
    if (e.timestampMs > latestMs) latestMs = e.timestampMs;
    if (e.timestampMs >= dayAgo) {
      count24++;
      raised24 += e.suiAmountMist;
      const idx = Math.min(
        11,
        Math.max(0, Math.floor((e.timestampMs - dayAgo) / bucketMs)),
      );
      buckets[idx] += Number(e.suiAmountMist / 1_000_000n); // millisui for chart scale
    }
  }

  const feeBps = platform?.feeBps ?? 0;
  const totalFees = (totalRaised * BigInt(feeBps)) / 10_000n;

  return {
    totalRaisedMist: totalRaised,
    totalTokensMintedRaw: totalSold,
    totalFeesMist: totalFees,
    totalProjects: projects.length,
    activeProjects: active,
    closedProjects: closed,
    uniqueBackers: backers.size,
    contributionCount: contributed.length,
    largestContributionMist: largest,
    latestContributionMs: latestMs || null,
    contributionCount24h: count24,
    raised24hMist: raised24,
    medianDurationDays: Math.round(median * 10) / 10,
    feeBps,
    hourlyBuckets: buckets,
    computedAtMs: now,
  };
}

/* unstable_cache serializes values as JSON, which can't carry BigInts.
   We serialize at the cache boundary and rehydrate on read so callers
   keep working with bigint values. */

type SerializedAggregate = Omit<
  OnChainAggregate,
  | "totalRaisedMist"
  | "totalTokensMintedRaw"
  | "totalFeesMist"
  | "largestContributionMist"
  | "raised24hMist"
> & {
  totalRaisedMist: string;
  totalTokensMintedRaw: string;
  totalFeesMist: string;
  largestContributionMist: string;
  raised24hMist: string;
};

function serializeAggregate(a: OnChainAggregate): SerializedAggregate {
  return {
    ...a,
    totalRaisedMist: a.totalRaisedMist.toString(),
    totalTokensMintedRaw: a.totalTokensMintedRaw.toString(),
    totalFeesMist: a.totalFeesMist.toString(),
    largestContributionMist: a.largestContributionMist.toString(),
    raised24hMist: a.raised24hMist.toString(),
  };
}

function deserializeAggregate(s: SerializedAggregate): OnChainAggregate {
  return {
    ...s,
    totalRaisedMist: BigInt(s.totalRaisedMist),
    totalTokensMintedRaw: BigInt(s.totalTokensMintedRaw),
    totalFeesMist: BigInt(s.totalFeesMist),
    largestContributionMist: BigInt(s.largestContributionMist),
    raised24hMist: BigInt(s.raised24hMist),
  };
}

const cachedSerializedAggregate = unstable_cache(
  async (): Promise<SerializedAggregate> => {
    try {
      return serializeAggregate(await computeAggregate());
    } catch (err) {
      console.error("[stats] computeAggregate failed:", err);
      return serializeAggregate(emptyAggregate());
    }
  },
  ["pandabox:onchain-aggregate"],
  { revalidate: 60, tags: ["stats"] },
);

export async function getOnchainAggregate(): Promise<OnChainAggregate> {
  return deserializeAggregate(await cachedSerializedAggregate());
}
