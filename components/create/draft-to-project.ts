import BigNumber from "bignumber.js";
import type { DraftV2 } from "@/lib/store/wizard-schema";
import type { ProjectDTO } from "@/lib/api/project-dto";
import type { Accent, Category } from "@/types/pandabox";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";

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

/**
 * Build a preview-only ProjectDTO from the v2 wizard draft. Some legacy DTO
 * fields (cycle/reserved rate/cash-out tax) are not present in the new
 * contract — we stub them with neutral values so the existing
 * `<ProjectHero>` + `<ParamsSummary>` previews keep rendering without
 * dragging in a wider DTO refactor on the project pages.
 */
export function draftToProject(draft: DraftV2): ProjectDTO {
  const category = (draft.identity.category ?? "art") as Category;
  const accent = CATEGORY_ACCENT[category];
  const now = Date.now();
  const end = draft.sale.endTimeMs ?? now + 14 * 86400_000;

  const scale = new BigNumber(10).pow(PROJECT_COIN_DECIMALS);
  const baseRateScaled = new BigNumber(draft.sale.tokensPerSui ?? "0")
    .multipliedBy(scale)
    .integerValue(BigNumber.ROUND_DOWN);
  const allocationScaled = new BigNumber(draft.sale.allocationTokens ?? "0")
    .multipliedBy(scale)
    .integerValue(BigNumber.ROUND_DOWN);

  return {
    id: PLACEHOLDER_ADDR,
    packageId: PLACEHOLDER_ADDR,
    name: draft.identity.name?.trim() || "Untitled project",
    ticker:
      draft.coin.coinSymbol?.trim() ||
      draft.identity.ticker?.trim() ||
      "TOK",
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
    deployedAt: now,
    raisedMist: "0",
    supporters: 0,
    cycleNumber: 1,
    cycleStart: now,
    cycleEnd: end,
    params: {
      // Repurposed: weight ≈ base_rate (tokens per SUI, raw u64 scaled).
      weight: baseRateScaled.toFixed(0),
      reservedRate: 0,
      cashOutTax: 0,
      issuanceReduction: 0,
      // Repurposed: payoutLimitMist ≈ funding_allocation (raw u64).
      payoutLimitMist: allocationScaled.toFixed(0),
      ballotDelayHours: 0,
    },
    tiers: [],
    queuedReconfiguration: null,
    socials: {
      twitter: draft.identity.twitter || undefined,
      website: draft.identity.website || undefined,
      discord: draft.identity.discord || undefined,
    },
  };
}
