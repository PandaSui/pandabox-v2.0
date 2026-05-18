import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "./sui";
import { PACKAGE_ID, IS_DEPLOYED } from "./contracts/pandabox";

export type ProjectStatus = "live" | "closed" | "unknown";

export type OnChainProject = {
  id: string;
  number: number;
  name: string;
  iconUrl: string;
  creator: string;
  createdAtMs: number;
  endTimeMs: number;
  /** Total token allocation pre-mint (raw units, u64). */
  fundingAllocation: bigint;
  /** Tokens-per-SUI rate at deploy. */
  baseRate: number;
  /** Raw tokens already minted to contributors. */
  sold: bigint;
  /** SUI escrow currently held by the project. */
  suiBalance: bigint;
  status: ProjectStatus;
  rawStatus: number;
  verified: boolean;
  unsoldProcessed: boolean;
  descriptionBlobId: string;
  /** Hex coin type carried by the Project<T> generic. */
  tokenType: string;
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

function statusFromRaw(raw: number): ProjectStatus {
  if (raw === 1) return "live";
  if (raw === 2 || raw === 3) return "closed";
  return "unknown";
}

function extractTokenType(typeStr: string): string {
  // "<pkg>::project::Project<T>" → "T"
  const lt = typeStr.indexOf("<");
  const gt = typeStr.lastIndexOf(">");
  if (lt === -1 || gt === -1 || gt < lt) return "";
  return typeStr.slice(lt + 1, gt);
}

type CreationMeta = {
  number: number;
  name: string;
  iconUrl: string;
  creator: string;
  createdAtMs: number;
  endTimeMs: number;
  fundingAllocation: bigint;
  baseRate: number;
  descriptionBlobId: string;
};

async function fetchAllCreationEvents(): Promise<Map<string, CreationMeta>> {
  const out = new Map<string, CreationMeta>();
  let cursor: { txDigest: string; eventSeq: string } | null = null;

  for (let i = 0; i < 8; i++) {
    const page = await client().queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::project::ProjectCreated` },
      cursor,
      limit: 50,
      order: "ascending",
    });

    for (const ev of page.data) {
      const p = ev.parsedJson as Record<string, unknown>;
      const id = String(p.project_id ?? "");
      if (!id) continue;
      out.set(id, {
        number: Number(p.project_number ?? 0),
        name: String(p.name ?? ""),
        iconUrl: String(p.icon_url ?? ""),
        creator: String(p.creator ?? ""),
        createdAtMs: Number(p.timestamp_ms ?? 0),
        endTimeMs: Number(p.end_time_ms ?? 0),
        fundingAllocation: BigInt(String(p.funding_allocation ?? "0")),
        baseRate: Number(p.base_rate ?? 0),
        descriptionBlobId: String(p.description_blob_id ?? ""),
      });
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return out;
}

async function listProjectsOnchain(): Promise<OnChainProject[]> {
  if (!IS_DEPLOYED) return [];

  const meta = await fetchAllCreationEvents();
  const ids = Array.from(meta.keys());
  if (ids.length === 0) return [];

  const objects = await client().multiGetObjects({
    ids,
    options: { showContent: true, showType: true },
  });

  const projects: OnChainProject[] = [];

  for (const res of objects) {
    const id = res.data?.objectId;
    if (!id) continue;
    const content = res.data?.content;
    if (!content || content.dataType !== "moveObject") continue;
    const fields = content.fields as Record<string, unknown>;
    const m = meta.get(id);
    if (!m) continue;

    const rawStatus = Number(fields.status ?? 0);

    projects.push({
      id,
      number: m.number,
      name: String(fields.name ?? m.name),
      iconUrl: String(fields.icon_url ?? m.iconUrl),
      creator: String(fields.creator ?? m.creator),
      createdAtMs: Number(fields.created_at_ms ?? m.createdAtMs),
      endTimeMs: Number(fields.end_time_ms ?? m.endTimeMs),
      fundingAllocation: BigInt(
        String(fields.funding_allocation ?? m.fundingAllocation),
      ),
      baseRate: Number(fields.base_rate ?? m.baseRate),
      sold: BigInt(String(fields.sold ?? "0")),
      suiBalance: BigInt(String(fields.sui_balance ?? "0")),
      status: statusFromRaw(rawStatus),
      rawStatus,
      verified: Boolean(fields.verified ?? false),
      unsoldProcessed: Boolean(fields.unsold_processed ?? false),
      descriptionBlobId: String(
        fields.description_blob_id ?? m.descriptionBlobId,
      ),
      tokenType: extractTokenType(content.type),
    });
  }

  // Newest first (highest project_number).
  projects.sort((a, b) => b.number - a.number);
  return projects;
}

/* unstable_cache uses JSON serialization, which can't carry BigInts. We
   serialize at the cache boundary and rehydrate on read. */

type SerializedProject = Omit<
  OnChainProject,
  "fundingAllocation" | "sold" | "suiBalance"
> & {
  fundingAllocation: string;
  sold: string;
  suiBalance: string;
};

function serializeProject(p: OnChainProject): SerializedProject {
  return {
    ...p,
    fundingAllocation: p.fundingAllocation.toString(),
    sold: p.sold.toString(),
    suiBalance: p.suiBalance.toString(),
  };
}

function deserializeProject(s: SerializedProject): OnChainProject {
  return {
    ...s,
    fundingAllocation: BigInt(s.fundingAllocation),
    sold: BigInt(s.sold),
    suiBalance: BigInt(s.suiBalance),
  };
}

const cachedSerializedProjects = unstable_cache(
  async (): Promise<SerializedProject[]> => {
    try {
      const list = await listProjectsOnchain();
      return list.map(serializeProject);
    } catch (err) {
      console.error("[projects] listProjectsOnchain failed:", err);
      return [];
    }
  },
  ["pandabox:onchain-projects"],
  { revalidate: 60, tags: ["projects"] },
);

export async function getOnchainProjects(): Promise<OnChainProject[]> {
  const list = await cachedSerializedProjects();
  return list.map(deserializeProject);
}
