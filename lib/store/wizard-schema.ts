import { z } from "zod";

export const CATEGORY = z.enum([
  "art",
  "infra",
  "dao",
  "research",
  "gaming",
  "music",
  "social",
  "rwa",
]);

export const StepIdentity = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  ticker: z
    .string()
    .trim()
    .min(2, "Ticker is too short")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z][A-Z0-9]*$/, "Uppercase letters and digits only"),
  tagline: z.string().trim().min(8, "Add a short tagline").max(160),
  category: CATEGORY,
  description: z.string().trim().min(20, "Add a real description").max(4000),
  coverImage: z.string().trim().min(1),
  twitter: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(120).optional().or(z.literal("")),
  discord: z.string().trim().max(120).optional().or(z.literal("")),
});

export const StepCycles = z.object({
  durationDays: z
    .number()
    .int("Whole days only")
    .min(1, "At least 1 day")
    .max(90, "Max 90 days"),
  ballotDelayHours: z
    .number()
    .int()
    .min(0, "Cannot be negative")
    .max(720, "Max 30 days"),
  firstCycleStart: z.number().int(),
});

export const Split = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{1,64}$/, "Use a Sui address"),
  share: z.number().min(0).max(100),
});

export const StepEconomics = z
  .object({
    weight: z.string().regex(/^\d+$/, "Whole tokens per SUI"),
    reservedRate: z.number().min(0).max(50),
    reservedSplits: z.array(Split).max(20),
    issuanceReduction: z.number().min(0).max(20),
    cashOutTax: z.number().min(0).max(100),
  })
  .superRefine((val, ctx) => {
    if (val.reservedRate > 0 && val.reservedSplits.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["reservedSplits"],
        message: "Reserved rate is non-zero — add at least one split.",
      });
    }
    if (val.reservedSplits.length > 0) {
      const sum = val.reservedSplits.reduce((a, s) => a + s.share, 0);
      if (Math.abs(sum - 100) > 0.01) {
        ctx.addIssue({
          code: "custom",
          path: ["reservedSplits"],
          message: `Splits must sum to 100% (currently ${sum.toFixed(2)}%)`,
        });
      }
    }
  });

export const StepPayouts = z
  .object({
    payoutLimitMist: z.string().regex(/^\d+$/, "Use whole MIST"),
    payoutCurrency: z.enum(["SUI", "USD"]),
    splits: z.array(Split).max(20),
    sendSurplusToOwner: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (val.splits.length > 0) {
      const sum = val.splits.reduce((a, s) => a + s.share, 0);
      if (Math.abs(sum - 100) > 0.01) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: `Splits must sum to 100% (currently ${sum.toFixed(2)}%)`,
        });
      }
    }
  });

export const Tier = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Name required").max(32),
  priceMist: z.string().regex(/^\d+$/, "Use whole MIST"),
  maxSupply: z.number().int().min(0),
  perks: z.string().trim().max(280),
  image: z.string().optional(),
});

export const StepTiers = z.object({
  enabled: z.boolean(),
  list: z.array(Tier).max(10, "Max 10 tiers"),
});

export const Draft = z.object({
  version: z.literal(1),
  step: z.number().int().min(1).max(6),
  identity: StepIdentity.partial(),
  cycles: StepCycles.partial(),
  economics: z
    .object({
      weight: z.string(),
      reservedRate: z.number(),
      reservedSplits: z.array(Split),
      issuanceReduction: z.number(),
      cashOutTax: z.number(),
    })
    .partial(),
  payouts: z
    .object({
      payoutLimitMist: z.string(),
      payoutCurrency: z.enum(["SUI", "USD"]),
      splits: z.array(Split),
      sendSurplusToOwner: z.boolean(),
    })
    .partial(),
  tiers: StepTiers,
});

export type DraftV1 = z.infer<typeof Draft>;
export type IdentityV = z.infer<typeof StepIdentity>;
export type CyclesV = z.infer<typeof StepCycles>;
export type EconomicsV = z.infer<typeof StepEconomics>;
export type PayoutsV = z.infer<typeof StepPayouts>;
export type TiersV = z.infer<typeof StepTiers>;
export type SplitV = z.infer<typeof Split>;
export type TierV = z.infer<typeof Tier>;
