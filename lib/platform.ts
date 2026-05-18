import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork, type SuiNetwork } from "./sui";

export const PLATFORM_OBJECT_ID =
  process.env.NEXT_PUBLIC_PLATFORM_OBJECT_ID?.trim() || "";

export type PlatformStats = {
  totalProjects: number;
  feeBps: number;
  paused: boolean;
  treasuryAddress: string;
  /** Accumulated SUI fees ready for `withdraw_platform_fees`, as mist (string for JSON safety). */
  feeTreasuryMist: string;
  objectId: string;
  network: SuiNetwork;
  fetchedAt: number;
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

/** Reads the live `Platform` shared object on Sui mainnet and parses its
 *  Move struct fields. Returns null when the env var is unset or the RPC
 *  call fails — callers should fall back to a sensible default so the UI
 *  never breaks on a transient fullnode hiccup. */
async function fetchPlatformStats(): Promise<PlatformStats | null> {
  if (!PLATFORM_OBJECT_ID) return null;

  const res = await client().getObject({
    id: PLATFORM_OBJECT_ID,
    options: { showContent: true },
  });

  const content = res.data?.content;
  if (!content || content.dataType !== "moveObject") return null;

  const fields = content.fields as Record<string, unknown>;
  // `fee_treasury` is a Move `Balance<SUI>`, which the JSON-RPC encoder
  // surfaces as `{ value: "<mist>" }` (the inner u64). Old indexer code
  // sometimes serializes it as a bare string — handle both.
  const feeTreasuryRaw = fields.fee_treasury;
  let feeTreasuryMist = "0";
  if (typeof feeTreasuryRaw === "string") {
    feeTreasuryMist = feeTreasuryRaw;
  } else if (feeTreasuryRaw && typeof feeTreasuryRaw === "object") {
    const v = (feeTreasuryRaw as { value?: unknown; fields?: { value?: unknown } });
    feeTreasuryMist = String(v.value ?? v.fields?.value ?? "0");
  }
  return {
    totalProjects: Number(fields.total_projects ?? 0),
    feeBps: Number(fields.fee_bps ?? 0),
    paused: Boolean(fields.paused ?? false),
    treasuryAddress: String(fields.treasury_address ?? ""),
    feeTreasuryMist,
    objectId: PLATFORM_OBJECT_ID,
    network: getNetwork(),
    fetchedAt: Date.now(),
  };
}

export const getPlatformStats = unstable_cache(
  async (): Promise<PlatformStats | null> => {
    try {
      return await fetchPlatformStats();
    } catch (err) {
      console.error("[platform] getPlatformStats failed:", err);
      return null;
    }
  },
  ["pandabox:platform-stats"],
  { revalidate: 60, tags: ["platform"] },
);
