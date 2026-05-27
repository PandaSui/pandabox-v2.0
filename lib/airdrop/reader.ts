import "server-only";
import { unstable_cache } from "next/cache";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "@/lib/sui";
import {
  AIRDROP_IS_DEPLOYED,
  AIRDROP_PLATFORM_ID,
} from "@/lib/contracts/airdrop";
import { parseAirdropPlatform } from "./parse";
import type { AirdropPlatformState } from "./types";

/**
 * Server-side read layer for the Airdrop contract. Mirrors the redeem
 * reader almost exactly — `unstable_cache` wraps the fetch so RSC pages
 * pull live state without hammering the fullnode, falling back to `null`
 * on any RPC hiccup (the UI handles the empty case).
 *
 * The Platform object is a Sui shared object, so the PTB builder will
 * eventually need its `initial_shared_version` to build a
 * `sharedObjectRef`. We pull it from `getObject({ showOwner: true })` and
 * pass it through alongside the field state — that way the same cached
 * snapshot drives both the masthead numbers and the transaction builder.
 *
 * Cache-safety note: `unstable_cache` JSON-serializes its return value to
 * disk and `JSON.stringify` throws on `bigint`. We therefore store a
 * "wire" shape (u64 fields as decimal strings) inside the cache and lift
 * back to `bigint` at the exported boundary.
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

/* ─────────────────────────── Wire ↔ runtime ─────────────────────────── */

type WirePlatform = Omit<
  AirdropPlatformState,
  "feePerRecipientMist" | "feeTreasuryMist"
> & {
  feePerRecipientMist: string;
  feeTreasuryMist: string;
};

function platformToWire(s: AirdropPlatformState): WirePlatform {
  return {
    ...s,
    feePerRecipientMist: s.feePerRecipientMist.toString(),
    feeTreasuryMist: s.feeTreasuryMist.toString(),
  };
}
function platformFromWire(w: WirePlatform): AirdropPlatformState {
  return {
    ...w,
    feePerRecipientMist: BigInt(w.feePerRecipientMist),
    feeTreasuryMist: BigInt(w.feeTreasuryMist),
  };
}

/* ─────────────────────────── Platform ─────────────────────────── */

async function fetchAirdropPlatform(): Promise<AirdropPlatformState | null> {
  if (!AIRDROP_IS_DEPLOYED) return null;
  const res = await client().getObject({
    id: AIRDROP_PLATFORM_ID,
    options: { showContent: true, showOwner: true },
  });
  const data = res.data;
  const content = data?.content;
  if (!content || content.dataType !== "moveObject") return null;

  // The shared-object metadata lives on `owner`. We need
  // `initial_shared_version` so Phase 3's PTB builder can construct a
  // mutable `sharedObjectRef`. Bail out if the object isn't actually
  // shared — that would indicate the env var points at the wrong thing.
  const owner = data.owner;
  if (
    !owner ||
    typeof owner !== "object" ||
    !("Shared" in owner) ||
    !owner.Shared ||
    typeof owner.Shared !== "object" ||
    !("initial_shared_version" in owner.Shared)
  ) {
    return null;
  }
  const initialSharedVersion = String(owner.Shared.initial_shared_version);

  return parseAirdropPlatform({
    objectId: AIRDROP_PLATFORM_ID,
    initialSharedVersion,
    fields: content.fields as Record<string, unknown>,
  });
}

const _platformWireCached = unstable_cache(
  async (): Promise<WirePlatform | null> => {
    try {
      const state = await fetchAirdropPlatform();
      return state ? platformToWire(state) : null;
    } catch (err) {
      console.error("[airdrop] getAirdropPlatform failed:", err);
      return null;
    }
  },
  ["airdrop:platform"],
  { revalidate: 60, tags: ["airdrop-platform"] },
);

/**
 * Live `AirdropPlatform` state — fee-per-recipient, max-recipients, treasury
 * address, accrued fee balance, paused flag, lifetime airdrop counter,
 * plus the `initial_shared_version` the PTB builder needs. Cached for 60s,
 * tag-bustable from server actions after admin mutations.
 */
export async function getAirdropPlatform(): Promise<AirdropPlatformState | null> {
  const wire = await _platformWireCached();
  return wire ? platformFromWire(wire) : null;
}
