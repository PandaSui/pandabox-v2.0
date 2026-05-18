import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
  type SuiObjectResponse,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "./sui";
import { PACKAGE_ID, IS_DEPLOYED } from "./contracts/pandabox";

/**
 * Per-address holdings of Pandabox objects.
 *
 *   - `adminCaps`    → ProjectAdminCap<T> objects owned by the address.
 *                      Each one means "this address can administer that project".
 *   - `receipts`     → ContributionReceipt<T> objects owned by the address.
 *                      Bucketed by project_id so the UI can pair a project with
 *                      the receipts the user can claim against it.
 *
 * Both are owned objects, so a single `getOwnedObjects` query with a
 * `MoveModule` filter gives us everything in two paginated calls (one for
 * the `project` module, one for the `receipt` module). We then filter client
 * side by `objectType` prefix because JSON-RPC's `StructType` filter can't
 * match across open generics like `ProjectAdminCap<T>`.
 */

export type AdminCapHolding = {
  /** The cap object id (consumed by transfer / renounce). */
  capId: string;
  /** The project the cap administers — `cap.fields.project_id`. */
  projectId: string;
  /** Coin type T parsed from `ProjectAdminCap<T>`. */
  coinType: string;
};

export type ReceiptHolding = {
  receiptId: string;
  projectId: string;
  coinType: string;
  suiAmount: bigint;
  tokenShare: bigint;
  createdAtMs: number;
};

export type UserHoldings = {
  adminCaps: AdminCapHolding[];
  /** projectId → receipts[]. Pre-bucketed for the dashboard. */
  receiptsByProject: Record<string, ReceiptHolding[]>;
  /** Flat list, same data — handy for total counts / iteration. */
  allReceipts: ReceiptHolding[];
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

async function fetchOwnedFromModule(
  owner: string,
  moduleName: "project" | "receipt",
): Promise<SuiObjectResponse[]> {
  const out: SuiObjectResponse[] = [];
  let cursor: string | null | undefined = null;
  for (let i = 0; i < 6; i++) {
    const page = await client().getOwnedObjects({
      owner,
      filter: { MoveModule: { package: PACKAGE_ID, module: moduleName } },
      options: { showType: true, showContent: true, showOwner: true },
      cursor: cursor ?? null,
      limit: 50,
    });
    out.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

function extractTypeArg(typeStr: string): string {
  const lt = typeStr.indexOf("<");
  const gt = typeStr.lastIndexOf(">");
  if (lt === -1 || gt === -1 || gt < lt) return "";
  return typeStr.slice(lt + 1, gt);
}

async function readUserHoldings(address: string): Promise<UserHoldings> {
  if (!IS_DEPLOYED || !/^0x[0-9a-fA-F]{1,64}$/.test(address)) {
    return { adminCaps: [], receiptsByProject: {}, allReceipts: [] };
  }

  const [projectModuleObjs, receiptModuleObjs] = await Promise.all([
    fetchOwnedFromModule(address, "project"),
    fetchOwnedFromModule(address, "receipt"),
  ]);

  const adminCaps: AdminCapHolding[] = [];
  for (const o of projectModuleObjs) {
    const t = o.data?.type ?? "";
    if (!t.startsWith(`${PACKAGE_ID}::project::ProjectAdminCap<`)) continue;
    const content = o.data?.content;
    if (!content || content.dataType !== "moveObject") continue;
    const fields = content.fields as Record<string, unknown>;
    const projectId = String(fields.project_id ?? "");
    if (!projectId) continue;
    adminCaps.push({
      capId: o.data!.objectId,
      projectId,
      coinType: extractTypeArg(t),
    });
  }

  const allReceipts: ReceiptHolding[] = [];
  for (const o of receiptModuleObjs) {
    const t = o.data?.type ?? "";
    if (!t.startsWith(`${PACKAGE_ID}::receipt::ContributionReceipt<`)) continue;
    const content = o.data?.content;
    if (!content || content.dataType !== "moveObject") continue;
    const fields = content.fields as Record<string, unknown>;
    const projectId = String(fields.project_id ?? "");
    if (!projectId) continue;
    allReceipts.push({
      receiptId: o.data!.objectId,
      projectId,
      coinType: extractTypeArg(t),
      suiAmount: BigInt(String(fields.sui_amount ?? "0")),
      tokenShare: BigInt(String(fields.token_share ?? "0")),
      createdAtMs: Number(fields.created_at_ms ?? 0),
    });
  }

  const receiptsByProject: Record<string, ReceiptHolding[]> = {};
  for (const r of allReceipts) {
    (receiptsByProject[r.projectId] ??= []).push(r);
  }

  return { adminCaps, receiptsByProject, allReceipts };
}

/* ───────────── unstable_cache: BigInt serialization boundary ───────────── */

type SerializedReceipt = Omit<
  ReceiptHolding,
  "suiAmount" | "tokenShare"
> & {
  suiAmount: string;
  tokenShare: string;
};
type SerializedHoldings = {
  adminCaps: AdminCapHolding[];
  receipts: SerializedReceipt[];
};

function serialize(h: UserHoldings): SerializedHoldings {
  return {
    adminCaps: h.adminCaps,
    receipts: h.allReceipts.map((r) => ({
      ...r,
      suiAmount: r.suiAmount.toString(),
      tokenShare: r.tokenShare.toString(),
    })),
  };
}

function deserialize(s: SerializedHoldings): UserHoldings {
  const allReceipts = s.receipts.map((r) => ({
    ...r,
    suiAmount: BigInt(r.suiAmount),
    tokenShare: BigInt(r.tokenShare),
  }));
  const receiptsByProject: Record<string, ReceiptHolding[]> = {};
  for (const r of allReceipts) {
    (receiptsByProject[r.projectId] ??= []).push(r);
  }
  return { adminCaps: s.adminCaps, receiptsByProject, allReceipts };
}

const cachedSerialized = unstable_cache(
  async (address: string): Promise<SerializedHoldings> => {
    try {
      return serialize(await readUserHoldings(address));
    } catch (err) {
      console.error(`[holdings] readUserHoldings(${address}) failed:`, err);
      return { adminCaps: [], receipts: [] };
    }
  },
  ["pandabox:holdings"],
  { revalidate: 20, tags: ["holdings"] },
);

export async function getUserHoldings(address: string): Promise<UserHoldings> {
  return deserialize(await cachedSerialized(address));
}
