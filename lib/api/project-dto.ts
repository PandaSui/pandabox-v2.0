import type {
  Accent,
  Category,
  NftTier,
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
