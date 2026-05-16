import type { DraftV1 } from "@/lib/store/wizard-schema";
import type { ProjectDTO } from "@/lib/api/project-dto";
import type { Accent, Category } from "@/types/pandabox";

const CATEGORY_ACCENT: Record<Category, Accent> = {
  art: "saffron",
  infra: "poppy",
  dao: "jade",
  research: "sky",
  gaming: "sun",
  music: "plum",
  social: "jade",
  rwa: "sky",
};

const PLACEHOLDER_ADDR =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function draftToProject(draft: DraftV1): ProjectDTO {
  const category = (draft.identity.category ?? "art") as Category;
  const accent = CATEGORY_ACCENT[category];
  const start = draft.cycles.firstCycleStart ?? Date.now();
  const durationMs = (draft.cycles.durationDays ?? 14) * 86400_000;

  return {
    id: PLACEHOLDER_ADDR,
    packageId: PLACEHOLDER_ADDR,
    name: draft.identity.name?.trim() || "Untitled project",
    ticker: draft.identity.ticker?.trim() || "TOK",
    tagline:
      draft.identity.tagline?.trim() ||
      "Your tagline appears here once you fill it in.",
    description:
      draft.identity.description?.trim() ||
      "Your project description renders here once you fill it in.",
    category,
    accent,
    coverImage: draft.identity.coverImage || "/panda-logo.webp",
    creator: PLACEHOLDER_ADDR,
    adminCapId: PLACEHOLDER_ADDR,
    status: "live",
    deployedAt: Date.now(),
    raisedMist: "0",
    supporters: 0,
    cycleNumber: 1,
    cycleStart: start,
    cycleEnd: start + durationMs,
    params: {
      weight: draft.economics.weight ?? "0",
      reservedRate: draft.economics.reservedRate ?? 0,
      cashOutTax: draft.economics.cashOutTax ?? 0,
      issuanceReduction: draft.economics.issuanceReduction ?? 0,
      payoutLimitMist: draft.payouts.payoutLimitMist ?? "0",
      ballotDelayHours: draft.cycles.ballotDelayHours ?? 0,
    },
    tiers: draft.tiers.enabled
      ? draft.tiers.list.map((t) => ({
          id: t.id,
          name: t.name || "Untitled tier",
          priceMist: t.priceMist,
          maxSupply: t.maxSupply,
          minted: 0,
          image: t.image || "/panda-logo.webp",
          perks: t.perks,
        }))
      : [],
    queuedReconfiguration: null,
    socials: {
      twitter: draft.identity.twitter || undefined,
      website: draft.identity.website || undefined,
      discord: draft.identity.discord || undefined,
    },
  };
}
