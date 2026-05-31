/**
 * The Pandabox operator controls three independent Move protocols, each with
 * its own admin cap. This registry is the single source of truth for the
 * unified `/admin` console: cap type strings (used to detect ownership in the
 * connected wallet), the semantic accent each protocol leans on, and whether
 * the package is wired up in this environment.
 *
 * Cap type strings were confirmed against the live mainnet objects:
 *   pandabox · <pkg>::platform::PlatformAdminCap
 *   redeem   · <pkg>::platform::PlatformAdminCap
 *   airdrop  · <pkg>::platform::AirdropAdminCap
 *
 * Keep this client-safe (no `server-only`) — the access provider runs in the
 * browser and needs the cap type strings to query owned objects.
 */
import { PACKAGE_ID, IS_DEPLOYED } from "@/lib/contracts/pandabox";
import {
  REDEEM_PACKAGE_ID,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import {
  AIRDROP_PACKAGE_ID,
  AIRDROP_IS_DEPLOYED,
} from "@/lib/contracts/airdrop";

export type ProtocolId = "pandabox" | "redeem" | "airdrop";

/** One of the six design-system accents, assigned by semantic role (§5.5). */
export type ProtocolAccent = "saffron" | "sun" | "jade";

export type ProtocolConfig = {
  id: ProtocolId;
  /** Display name in the switcher and deck. */
  label: string;
  /** One-line role, shown under the label. */
  tagline: string;
  /** Semantic accent — drives the switcher, deck card, and panel highlights. */
  accent: ProtocolAccent;
  /** Move package id powering this protocol. */
  packageId: string;
  /** Bare cap struct name, e.g. `PlatformAdminCap`. */
  capName: string;
  /** Fully-qualified cap type — the exact `type` an owned cap object reports. */
  capType: string;
  /** False when the package/platform env vars are unset in this environment. */
  isDeployed: boolean;
};

export const PROTOCOLS: Record<ProtocolId, ProtocolConfig> = {
  pandabox: {
    id: "pandabox",
    label: "Pandabox",
    tagline: "Funding launchpad",
    accent: "saffron",
    packageId: PACKAGE_ID,
    capName: "PlatformAdminCap",
    capType: `${PACKAGE_ID}::platform::PlatformAdminCap`,
    isDeployed: IS_DEPLOYED,
  },
  redeem: {
    id: "redeem",
    label: "Redeem",
    tagline: "Token cash-out pools",
    accent: "sun",
    packageId: REDEEM_PACKAGE_ID,
    capName: "PlatformAdminCap",
    capType: `${REDEEM_PACKAGE_ID}::platform::PlatformAdminCap`,
    isDeployed: REDEEM_IS_DEPLOYED,
  },
  airdrop: {
    id: "airdrop",
    label: "Airdrop",
    tagline: "Bulk token distribution",
    accent: "jade",
    packageId: AIRDROP_PACKAGE_ID,
    capName: "AirdropAdminCap",
    capType: `${AIRDROP_PACKAGE_ID}::platform::AirdropAdminCap`,
    isDeployed: AIRDROP_IS_DEPLOYED,
  },
};

/** Render/iteration order across the console. */
export const PROTOCOL_IDS: ProtocolId[] = ["pandabox", "redeem", "airdrop"];

export const PROTOCOL_LIST: ProtocolConfig[] = PROTOCOL_IDS.map(
  (id) => PROTOCOLS[id],
);

export function isProtocolId(v: string | null | undefined): v is ProtocolId {
  return v === "pandabox" || v === "redeem" || v === "airdrop";
}
