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
  /**
   * True once the creator has paired SUI/<T> liquidity on a DEX. Until this
   * flips, the project is in primary issuance (Pandabox `contribute`) and no
   * external price chart can render — there is no pool to read from. The
   * Move struct does not yet expose this; readers default it to false and the
   * UI shows a placeholder chart. Wiring the on-chain field is a follow-up
   * Move PR — see CLAUDE.md.
   */
  liquiditySeeded: boolean;
  /** Pool object ID on the chosen DEX once seeded. */
  poolId?: string;
  /** Which DEX the liquidity lives on. Cetus is the default target. */
  dex?: "cetus";
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
  /**
   * Off-chain liquidity flag. The Move `Project<T>` struct doesn't yet expose
   * `liquidity_seeded` natively — until that ships, the creator marks the
   * pool as seeded by pinning an updated `project_details.json` (with this
   * sub-object set) via `update_metadata`. The verify route confirms the
   * pool object exists on-chain before pinning, so a creator can't flip the
   * flag without an actual paired pool. Trust-degraded vs. a real Move
   * field, but materially better than a pure UI toggle.
   */
  liquidity?: {
    seeded: boolean;
    poolId: string;
    dex: "cetus";
    seededAtMs?: number;
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

/**
 * Map the on-chain `status: u8` to a UI-friendly label.
 *
 *   0 — status_active     → "live"   (sale is taking contributions)
 *   1 — status_closed     → "closed" (sale finalized; claim + withdraw unlocked)
 *   2 — status_compromised → "closed" (platform admin emergency-closed)
 *
 * Constants verified via sui_devInspectTransactionBlock against the deployed
 * package. The previous mapping had 1→live which surfaced finalize buttons on
 * already-closed sales and led to wallet dry-runs aborting with
 * "transaction fee can't be calculated" because the contract rejects
 * permissionless_finalize on a non-active project.
 */
function statusFromRaw(raw: number): ProjectStatus {
  if (raw === 0) return "live";
  if (raw === 1 || raw === 2) return "closed";
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
 * Dev-only override for verifying the price chart end-to-end before the
 * real seed-liquidity flow lands. When both env vars are set, the named
 * project is forced into `liquiditySeeded: true` and its `poolId` is
 * swapped for a real Sui DEX pool address GeckoTerminal indexes (e.g.
 * USDC/SUI, DEEP/SUI, CETUS/SUI). The /api/chart proxy then returns live
 * OHLCV against that pool and the chart renders.
 *
 * Leave both unset in production. Example .env entries:
 *
 *   NEXT_PUBLIC_CHART_TEST_PROJECT_ID=0xabc...
 *   # USDC/SUI on Cetus — high-volume, always indexed
 *   NEXT_PUBLIC_CHART_TEST_POOL_ID=0x0df4f02d0e210169cb6d5aabd03c3058328c06f2c4dbb0804faa041159c78443
 */
const TEST_PROJECT_ID = process.env.NEXT_PUBLIC_CHART_TEST_PROJECT_ID?.trim();
const TEST_POOL_ID = process.env.NEXT_PUBLIC_CHART_TEST_POOL_ID?.trim();

function applyTestOverride<T extends OnChainProject>(p: T): T {
  if (!TEST_PROJECT_ID || !TEST_POOL_ID) return p;
  if (p.id !== TEST_PROJECT_ID) return p;
  return {
    ...p,
    liquiditySeeded: true,
    poolId: TEST_POOL_ID,
    dex: "cetus",
  };
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
      // Stubbed until the Move Project struct exposes a liquidity_seeded flag.
      liquiditySeeded: Boolean(fields.liquidity_seeded ?? false),
      poolId: typeof fields.pool_id === "string" ? fields.pool_id : undefined,
      dex:
        typeof fields.dex === "string" && fields.dex === "cetus"
          ? "cetus"
          : undefined,
    });
  }

  // Newest first (highest project_number).
  projects.sort((a, b) => b.number - a.number);
  return projects.map(applyTestOverride);
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

  const built = await readOneOnchainInner(id);
  return built ? applyTestOverride(built) : built;
}

async function readOneOnchainInner(id: string): Promise<OnChainProject | null> {
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
    liquiditySeeded: Boolean(fields.liquidity_seeded ?? false),
    poolId: typeof fields.pool_id === "string" ? fields.pool_id : undefined,
    dex:
      typeof fields.dex === "string" && fields.dex === "cetus"
        ? "cetus"
        : undefined,
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

  // Off-chain liquidity flag pinned in project_details.json overrides the
  // on-chain stub. When the Move struct grows a real `liquidity_seeded`
  // field, the on-chain value should take priority — until then IPFS wins
  // so the dashboard "Seed Cetus pool" flow has something to flip.
  const ipfsLiq = details?.liquidity;
  const merged: HydratedProject = {
    ...p,
    description,
    details,
    liquiditySeeded: p.liquiditySeeded || Boolean(ipfsLiq?.seeded),
    poolId: p.poolId ?? ipfsLiq?.poolId,
    dex: p.dex ?? ipfsLiq?.dex,
  };
  return merged;
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

/**
 * List variant that hydrates every project's IPFS details + description in
 * parallel. Each hydration hits the per-id `cachedHydrated` cache, so this
 * is cheap on repeat calls and gracefully degrades to whatever the on-chain
 * read returned if an IPFS fetch fails. Used by `/explore` so the grid can
 * filter on `details.category`.
 */
export async function getHydratedOnchainProjects(): Promise<HydratedProject[]> {
  const list = await getOnchainProjects();
  const hydrated = await Promise.all(
    list.map(async (p) => {
      const s = await cachedHydrated(p.id);
      return s ? deserializeHydrated(s) : { ...p, description: null, details: null };
    }),
  );
  return hydrated;
}
