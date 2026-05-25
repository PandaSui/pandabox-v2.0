import type {
  Accent,
  Category,
  Holder,
  NftTier,
  Payment,
  Project,
  ProjectStatus,
} from "@/types/pandabox";

export type NftTierDTO = Omit<NftTier, "priceMist"> & {
  priceMist: string;
};

export type ProjectDTO = Omit<
  Project,
  "raisedMist" | "weight" | "allocationTokens" | "alreadyMinted" | "tiers"
> & {
  raisedMist: string;
  weight: string;
  allocationTokens: string;
  alreadyMinted: string;
  tiers: NftTierDTO[];
};

export function toProjectDTO(p: Project): ProjectDTO {
  return {
    id: p.id,
    packageId: p.packageId,
    name: p.name,
    ticker: p.ticker,
    tagline: p.tagline,
    description: p.description,
    category: p.category as Category,
    accent: p.accent as Accent,
    coverImage: p.coverImage,
    creator: p.creator,
    adminCapId: p.adminCapId,
    status: p.status as ProjectStatus,
    deployedAt: p.deployedAt,
    raisedMist: p.raisedMist.toString(),
    supporters: p.supporters,
    coinType: p.coinType,
    weight: p.weight.toString(),
    allocationTokens: p.allocationTokens.toString(),
    alreadyMinted: p.alreadyMinted.toString(),
    unsoldAction: p.unsoldAction,
    endTimeMs: p.endTimeMs,
    tiers: p.tiers.map((t) => ({ ...t, priceMist: t.priceMist.toString() })),
    socials: p.socials,
  };
}

export type ProjectListDTO = {
  items: ProjectDTO[];
  nextCursor?: string;
};

export type PaymentDTO = Omit<Payment, "amountMist" | "tokensRaw"> & {
  amountMist: string;
  tokensRaw: string;
};

export function toPaymentDTO(p: Payment): PaymentDTO {
  return {
    txHash: p.txHash,
    projectId: p.projectId,
    projectName: p.projectName,
    projectAccent: p.projectAccent,
    payer: p.payer,
    amountMist: p.amountMist.toString(),
    tokensRaw: p.tokensRaw.toString(),
    memo: p.memo,
    tierId: p.tierId,
    timestamp: p.timestamp,
  };
}

export type HolderDTO = Omit<Holder, "balanceRaw"> & {
  balanceRaw: string;
};

export function toHolderDTO(h: Holder): HolderDTO {
  return {
    address: h.address,
    balanceRaw: h.balanceRaw.toString(),
    pctSupply: h.pctSupply,
  };
}

export type ActivityListDTO = {
  items: PaymentDTO[];
  nextCursor?: string;
};
