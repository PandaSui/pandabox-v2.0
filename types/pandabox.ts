export type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

export type Category =
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

export type NftTier = {
  id: string;
  name: string;
  priceMist: bigint;
  maxSupply: number;
  minted: number;
  image: string;
  perks: string;
};

export type CycleParams = {
  weight: bigint;
  reservedRate: number;
  cashOutTax: number;
  issuanceReduction: number;
  payoutLimitMist: bigint;
  ballotDelayHours: number;
};

export type QueuedReconfiguration = {
  takesEffectAt: number;
  summary: string;
  params: Partial<CycleParams>;
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
  cycleNumber: number;
  cycleStart: number;
  cycleEnd: number;
  params: CycleParams;
  tiers: NftTier[];
  queuedReconfiguration: QueuedReconfiguration | null;
  socials: {
    twitter?: string;
    website?: string;
    discord?: string;
  };
};

export type CycleStatus = "past" | "current" | "upcoming";

export type Cycle = {
  projectId: string;
  number: number;
  start: number;
  end: number;
  raisedMist: bigint;
  payoutsMist: bigint;
  reservedTokensRaw: bigint;
  status: CycleStatus;
  params: CycleParams;
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
  medianCycleDays: number;
  delta7d: {
    tvlPct: number;
    projectsPct: number;
    supportersPct: number;
  };
};
