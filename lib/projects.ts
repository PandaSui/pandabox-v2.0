import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "./sui";
import { PACKAGE_ID, IS_DEPLOYED } from "./contracts/pandabox";
import { fetchBlobText, resolveBlobRef } from "./ipfs";

export type ProjectStatus = "live" | "closed" | "unknown";

export type OnChainProject = {
  id: string;
  number: number;
  name: string;
  iconUrl: string;
  creator: string;
  createdAtMs: number;
  /** Sale window end, ms since epoch. 0 means "no time cap" (Option::None on chain). */
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
  /** 0 = burn unsold supply, 1 = transfer back to creator. */
  unsoldAction: number;
  descriptionBlobId: string;
  projectDetailsBlobId: string;
  sourceCodeBlobId: string;
  /** Hex coin type carried by the Project<T> generic. */
  tokenType: string;
};

/**
 * Off-chain extended metadata pinned alongside the project at deploy.
 * Shape mirrors what the create wizard writes in
 * `app/api/upload/route.ts` + `step-4-deploy.tsx`.
 */
export type ProjectDetails = {
  version?: number;
  tagline?: string;
  category?: string;
  ticker?: string;
  socials?: {
    twitter?: string;
    website?: string;
    discord?: string;
  };
};

export type HydratedProject = OnChainProject & {
  /** Markdown body from `description_blob_id`. */
  description: string | null;
  /** Parsed JSON from `project_details_blob_id`. */
  details: ProjectDetails | null;
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

/**
 * Move `Option<u64>` parsed via JSON-RPC arrives as either `null` (Option::None)
 * or the raw value (Option::Some(x)). We map None to 0 to signal "no time cap"
 * — callers should special-case the zero before doing time math.
 */
function parseOptionalU64Ms(v: unknown): number | null {
  if (v == null) return 0;
  const n = Number(typeof v === "string" ? v : String(v));
  return Number.isFinite(n) ? n : null;
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
        endTimeMs: parseOptionalU64Ms(p.end_time_ms) ?? 0,
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
      endTimeMs: parseOptionalU64Ms(fields.end_time_ms) ?? m.endTimeMs,
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
      unsoldAction: Number(fields.unsold_action ?? 0),
      descriptionBlobId: String(
        fields.description_blob_id ?? m.descriptionBlobId,
      ),
      projectDetailsBlobId: String(fields.project_details_blob_id ?? ""),
      sourceCodeBlobId: String(fields.source_code_blob_id ?? ""),
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

/* ─────────────────────────── Single project ─────────────────────────── */

async function readOneOnchain(id: string): Promise<OnChainProject | null> {
  if (!IS_DEPLOYED) return null;
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(id)) return null;

  const res = await client().getObject({
    id,
    options: { showContent: true, showType: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  const type = content.type ?? "";
  // Guard: must be our Project<T>
  if (!type.startsWith(`${PACKAGE_ID}::project::Project<`)) return null;

  const fields = content.fields as Record<string, unknown>;
  const rawStatus = Number(fields.status ?? 0);

  return {
    id,
    number: 0, // not exposed on the struct; left at 0 here (callers can cross-ref the event if needed)
    name: String(fields.name ?? ""),
    iconUrl: String(fields.icon_url ?? ""),
    creator: String(fields.creator ?? ""),
    createdAtMs: Number(fields.created_at_ms ?? 0),
    endTimeMs: parseOptionalU64Ms(fields.end_time_ms) ?? 0,
    fundingAllocation: BigInt(String(fields.funding_allocation ?? "0")),
    baseRate: Number(fields.base_rate ?? 0),
    sold: BigInt(String(fields.sold ?? "0")),
    suiBalance: BigInt(String(fields.sui_balance ?? "0")),
    status: statusFromRaw(rawStatus),
    rawStatus,
    verified: Boolean(fields.verified ?? false),
    unsoldProcessed: Boolean(fields.unsold_processed ?? false),
    unsoldAction: Number(fields.unsold_action ?? 0),
    descriptionBlobId: String(fields.description_blob_id ?? ""),
    projectDetailsBlobId: String(fields.project_details_blob_id ?? ""),
    sourceCodeBlobId: String(fields.source_code_blob_id ?? ""),
    tokenType: extractTokenType(type),
  };
}

/**
 * Read a single project from chain + hydrate the description markdown +
 * project_details JSON from IPFS. Returns `null` for unknown ids / non-Project
 * objects. IPFS fetch failures are tolerated — description / details just
 * come back null and the page renders with what's on-chain.
 *
 * Wrapped in `unstable_cache` keyed on the id with a short 30s revalidate so
 * sale state (sold / status / sui_balance) stays fresh while saving repeat
 * IPFS round-trips.
 */
async function readHydratedOnchain(id: string): Promise<HydratedProject | null> {
  const p = await readOneOnchain(id);
  if (!p) return null;

  const [description, details] = await Promise.all([
    fetchMarkdown(p.descriptionBlobId),
    fetchDetailsJson(p.projectDetailsBlobId),
  ]);

  return { ...p, description, details };
}

async function fetchMarkdown(blobIdOrUrl: string): Promise<string | null> {
  const ref = resolveBlobRef(blobIdOrUrl);
  if (!ref) return null;
  try {
    return await fetchBlobText(ref.blobId);
  } catch (err) {
    console.warn(`[projects] description fetch failed for ${ref.blobId}:`, err);
    return null;
  }
}

async function fetchDetailsJson(
  blobIdOrUrl: string,
): Promise<ProjectDetails | null> {
  const ref = resolveBlobRef(blobIdOrUrl);
  if (!ref) return null;
  try {
    const text = await fetchBlobText(ref.blobId);
    const parsed = JSON.parse(text) as ProjectDetails;
    return parsed;
  } catch (err) {
    console.warn(`[projects] details fetch failed for ${ref.blobId}:`, err);
    return null;
  }
}

// BigInts can't survive `unstable_cache`'s JSON boundary — same trick as the
// list reader.
type SerializedHydrated = Omit<
  HydratedProject,
  "fundingAllocation" | "sold" | "suiBalance"
> & {
  fundingAllocation: string;
  sold: string;
  suiBalance: string;
};

function serializeHydrated(p: HydratedProject): SerializedHydrated {
  return {
    ...p,
    fundingAllocation: p.fundingAllocation.toString(),
    sold: p.sold.toString(),
    suiBalance: p.suiBalance.toString(),
  };
}

function deserializeHydrated(s: SerializedHydrated): HydratedProject {
  return {
    ...s,
    fundingAllocation: BigInt(s.fundingAllocation),
    sold: BigInt(s.sold),
    suiBalance: BigInt(s.suiBalance),
  };
}

const cachedHydrated = unstable_cache(
  async (id: string): Promise<SerializedHydrated | null> => {
    try {
      const h = await readHydratedOnchain(id);
      return h ? serializeHydrated(h) : null;
    } catch (err) {
      console.error(`[projects] readHydratedOnchain failed for ${id}:`, err);
      return null;
    }
  },
  ["pandabox:onchain-project"],
  { revalidate: 30, tags: ["projects"] },
);

export async function getOnchainProject(
  id: string,
): Promise<HydratedProject | null> {
  const s = await cachedHydrated(id);
  return s ? deserializeHydrated(s) : null;
}
