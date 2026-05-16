import type {
  Accent,
  Category,
  Cycle,
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
  "raisedMist" | "params" | "tiers" | "queuedReconfiguration"
> & {
  raisedMist: string;
  params: {
    weight: string;
    reservedRate: number;
    cashOutTax: number;
    issuanceReduction: number;
    payoutLimitMist: string;
    ballotDelayHours: number;
  };
  tiers: NftTierDTO[];
  queuedReconfiguration:
    | (Omit<NonNullable<Project["queuedReconfiguration"]>, "params"> & {
        params: Record<string, never>;
      })
    | null;
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
    cycleNumber: p.cycleNumber,
    cycleStart: p.cycleStart,
    cycleEnd: p.cycleEnd,
    params: {
      weight: p.params.weight.toString(),
      reservedRate: p.params.reservedRate,
      cashOutTax: p.params.cashOutTax,
      issuanceReduction: p.params.issuanceReduction,
      payoutLimitMist: p.params.payoutLimitMist.toString(),
      ballotDelayHours: p.params.ballotDelayHours,
    },
    tiers: p.tiers.map((t) => ({ ...t, priceMist: t.priceMist.toString() })),
    queuedReconfiguration: p.queuedReconfiguration
      ? {
          takesEffectAt: p.queuedReconfiguration.takesEffectAt,
          summary: p.queuedReconfiguration.summary,
          params: {},
        }
      : null,
    socials: p.socials,
  };
}

export type ProjectListDTO = {
  items: ProjectDTO[];
  nextCursor?: string;
};

export type CycleDTO = Omit<
  Cycle,
  "raisedMist" | "payoutsMist" | "reservedTokensRaw" | "params"
> & {
  raisedMist: string;
  payoutsMist: string;
  reservedTokensRaw: string;
  params: {
    weight: string;
    reservedRate: number;
    cashOutTax: number;
    issuanceReduction: number;
    payoutLimitMist: string;
    ballotDelayHours: number;
  };
};

export function toCycleDTO(c: Cycle): CycleDTO {
  return {
    projectId: c.projectId,
    number: c.number,
    start: c.start,
    end: c.end,
    raisedMist: c.raisedMist.toString(),
    payoutsMist: c.payoutsMist.toString(),
    reservedTokensRaw: c.reservedTokensRaw.toString(),
    status: c.status,
    params: {
      weight: c.params.weight.toString(),
      reservedRate: c.params.reservedRate,
      cashOutTax: c.params.cashOutTax,
      issuanceReduction: c.params.issuanceReduction,
      payoutLimitMist: c.params.payoutLimitMist.toString(),
      ballotDelayHours: c.params.ballotDelayHours,
    },
  };
}

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
