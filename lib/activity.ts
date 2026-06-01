import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "./sui";
import { PACKAGE_ID, IS_DEPLOYED } from "./contracts/pandabox";

/**
 * Read recent activity for one project off chain — Contributed / Claimed /
 * Withdrawn / Closed events. We use the `MoveModule` event filter (project
 * module-wide) and then filter client-side on `project_id`, because
 * JSON-RPC's event-query language can't filter on event payload fields.
 *
 * `limit` is the rough number of project-relevant entries we want to surface.
 * We page through up to ~6 pages of 50 events apiece (300 events / project
 * module) to find them — generous enough to handle a busy day and bounded
 * enough that a single project page render stays fast.
 */

export type ActivityKind = "contribute" | "claim" | "withdraw" | "close";

export type ActivityItem = {
  digest: string;
  kind: ActivityKind;
  timestampMs: number;
  /** Who triggered the action. */
  actor: string;
  /** SUI value associated with the event (mist). 0 if not applicable. */
  suiAmount: bigint;
  /** Token amount associated, raw u64. 0 if not applicable. */
  tokenAmount: bigint;
  /** Cosmetic — e.g. "time" / "sellout" / "admin" for close events. */
  extra?: string;
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

const CONTRIBUTED = `${PACKAGE_ID}::project::Contributed`;
const CLAIMED = `${PACKAGE_ID}::project::Claimed`;
const WITHDRAWN = `${PACKAGE_ID}::project::Withdrawn`;
const CLOSED = `${PACKAGE_ID}::project::Closed`;

function classify(eventType: string): ActivityKind | null {
  if (eventType === CONTRIBUTED) return "contribute";
  if (eventType === CLAIMED) return "claim";
  if (eventType === WITHDRAWN) return "withdraw";
  if (eventType === CLOSED) return "close";
  return null;
}

function parseClose(p: Record<string, unknown>): string {
  const t = Number(p.trigger ?? 0);
  if (t === 0) return "time";
  if (t === 1) return "sellout";
  if (t === 2) return "admin";
  return "—";
}

async function readActivityOnchain(
  projectId: string,
  limit: number,
): Promise<ActivityItem[]> {
  if (!IS_DEPLOYED) return [];

  const out: ActivityItem[] = [];
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  const maxPages = 6;

  for (let page = 0; page < maxPages && out.length < limit; page++) {
    const res = await client().queryEvents({
      query: { MoveModule: { package: PACKAGE_ID, module: "project" } },
      cursor,
      limit: 50,
      order: "descending",
    });

    for (const ev of res.data) {
      const kind = classify(ev.type);
      if (!kind) continue;
      const json = ev.parsedJson as Record<string, unknown>;
      if (String(json.project_id ?? "") !== projectId) continue;

      let actor = "";
      let suiAmount = 0n;
      let tokenAmount = 0n;
      let extra: string | undefined;

      if (kind === "contribute") {
        actor = String(json.contributor ?? "");
        suiAmount = BigInt(String(json.sui_amount ?? "0"));
        tokenAmount = BigInt(String(json.token_share ?? "0"));
      } else if (kind === "claim") {
        actor = String(json.user ?? "");
        suiAmount = BigInt(String(json.sui_amount ?? "0"));
        tokenAmount = BigInt(String(json.token_share ?? "0"));
      } else if (kind === "withdraw") {
        actor = String(json.recipient ?? json.project_owner ?? "");
        suiAmount = BigInt(String(json.net_to_owner ?? "0"));
      } else if (kind === "close") {
        actor = String(json.triggered_by ?? "");
        suiAmount = BigInt(String(json.total_sui_raised ?? "0"));
        tokenAmount = BigInt(String(json.sold ?? "0"));
        extra = parseClose(json);
      }

      out.push({
        digest: ev.id.txDigest,
        kind,
        timestampMs: Number(ev.timestampMs ?? 0),
        actor,
        suiAmount,
        tokenAmount,
        extra,
      });
      if (out.length >= limit) break;
    }

    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  return out;
}

/* ───────────── unstable_cache: BigInt serialization boundary ───────────── */

type Serialized = Omit<ActivityItem, "suiAmount" | "tokenAmount"> & {
  suiAmount: string;
  tokenAmount: string;
};

function serialize(items: ActivityItem[]): Serialized[] {
  return items.map((i) => ({
    ...i,
    suiAmount: i.suiAmount.toString(),
    tokenAmount: i.tokenAmount.toString(),
  }));
}

function deserialize(items: Serialized[]): ActivityItem[] {
  return items.map((i) => ({
    ...i,
    suiAmount: BigInt(i.suiAmount),
    tokenAmount: BigInt(i.tokenAmount),
  }));
}

const cached = unstable_cache(
  async (projectId: string, limit: number): Promise<Serialized[]> => {
    try {
      return serialize(await readActivityOnchain(projectId, limit));
    } catch (err) {
      console.error(`[activity] readActivityOnchain failed:`, err);
      return [];
    }
  },
  ["pandabox:activity"],
  { revalidate: 30, tags: ["activity"] },
);

export async function getProjectActivity(
  projectId: string,
  limit = 25,
): Promise<ActivityItem[]> {
  return deserialize(await cached(projectId, limit));
}

/* ─────────────────────────── Supporter count ─────────────────────────── */

/**
 * Count a project's total unique supporters across its *full* `Contributed`
 * history, deduped by contributor address.
 *
 * Why this exists separately from `getProjectActivity`: the activity reader
 * caps at ~300 module-wide events to keep a page render fast, so an older or
 * finalized sale surfaces zero recent contributions even though it raised
 * 100%. That made the project page show "be the first to back this project" on
 * a sold-out sale. This pages the `Contributed` event type directly and counts
 * distinct contributors so the page can show a real supporter total once a
 * sale is closed.
 *
 * v1 indexer limitation: JSON-RPC can't filter events on payload fields, so we
 * page platform-wide `Contributed` events descending and match on
 * `project_id`. Bounded to `maxPages` — fine for a recently-closed sale (its
 * events are near the top) and for testnet volume; a real indexer (CLAUDE.md
 * §8) replaces this for large histories.
 */
async function readSupporterCountOnchain(projectId: string): Promise<number> {
  if (!IS_DEPLOYED) return 0;

  const seen = new Set<string>();
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  const maxPages = 20;

  for (let page = 0; page < maxPages; page++) {
    const res = await client().queryEvents({
      query: { MoveEventType: CONTRIBUTED },
      cursor,
      limit: 50,
      order: "descending",
    });

    for (const ev of res.data) {
      const json = ev.parsedJson as Record<string, unknown>;
      if (String(json.project_id ?? "") !== projectId) continue;
      const contributor = String(json.contributor ?? "");
      if (contributor) seen.add(contributor);
    }

    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }

  return seen.size;
}

const cachedSupporterCount = unstable_cache(
  async (projectId: string): Promise<number> => {
    try {
      return await readSupporterCountOnchain(projectId);
    } catch (err) {
      console.error(`[activity] readSupporterCountOnchain failed:`, err);
      return 0;
    }
  },
  ["pandabox:supporter-count"],
  { revalidate: 60, tags: ["activity"] },
);

export async function getProjectSupporterCount(
  projectId: string,
): Promise<number> {
  return cachedSupporterCount(projectId);
}
