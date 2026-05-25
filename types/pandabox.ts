export type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

export type Category =
  | "opc"
  | "art"
  | "infra"
  | "dao"
  | "research"
  | "gaming"
  | "music"
  | "social"
  | "rwa"
  | "meme";

export type SortKey = "trending" | "newest" | "most-funded" | "ending-soonest";

export type ProjectStatus = "live" | "paused" | "closed";

export type UnsoldAction = "burn" | "transfer_to_creator";

export type NftTier = {
  id: string;
  name: string;
  priceMist: bigint;
  maxSupply: number;
  minted: number;
  image: string;
  perks: string;
};

export type Project = {
  id: string;
  packageId: string;
  name: string;
  ticker: string;
  tagline: string;
  description: string;
  category: Category;
  accent: Accent;
  coverImage: string;
  creator: string;
  adminCapId: string;
  status: ProjectStatus;
  deployedAt: number;
  raisedMist: bigint;
  supporters: number;
  /** Fully-qualified Move coin type — needed by PayPanel to build contribute<T>. */
  coinType: string;
  /** Contract base_rate (already scaled by 10^9). tokens = mist × weight / 1e9. */
  weight: bigint;
  /** funding_allocation: total raw tokens (with 9 decimals) the sale can mint. */
  allocationTokens: bigint;
  /** Raw tokens already minted. mock layer always 0. */
  alreadyMinted: bigint;
  unsoldAction: UnsoldAction;
  /** Unix ms or null (no time cap, admin-closed only). */
  endTimeMs: number | null;
  tiers: NftTier[];
  socials: {
    twitter?: string;
    website?: string;
    discord?: string;
  };
};

export type Payment = {
  txHash: string;
  projectId: string;
  projectName: string;
  projectAccent: Accent;
  payer: string;
  amountMist: bigint;
  tokensRaw: bigint;
  memo: string;
  tierId: string | null;
  timestamp: number;
};

export type Holder = {
  address: string;
  balanceRaw: bigint;
  pctSupply: number;
};

export type GlobalStats = {
  tvlMist: bigint;
  projectCount: number;
  supporterCount: number;
  medianSaleDays: number;
  delta7d: {
    tvlPct: number;
    projectsPct: number;
    supportersPct: number;
  };
};
