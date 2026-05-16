"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DraftV1, SplitV, TierV } from "./wizard-schema";

export const STORAGE_KEY = "pandabox:draft:v1";

const DAY = 86400_000;

export function initialDraft(): DraftV1 {
  return {
    version: 1,
    step: 1,
    identity: {
      coverImage: "/panda-logo.webp",
    },
    cycles: {
      durationDays: 14,
      ballotDelayHours: 72,
      firstCycleStart: Date.now() + DAY,
    },
    economics: {
      weight: "1000000",
      reservedRate: 10,
      reservedSplits: [],
      issuanceReduction: 5,
      cashOutTax: 15,
    },
    payouts: {
      payoutLimitMist: (10_000n * 1_000_000_000n).toString(),
      payoutCurrency: "SUI",
      splits: [],
      sendSurplusToOwner: true,
    },
    tiers: {
      enabled: false,
      list: [],
    },
  };
}

type WizardState = {
  draft: DraftV1;
  hydrated: boolean;
  setStep: (n: number) => void;
  goNext: () => void;
  goPrev: () => void;
  patchIdentity: (patch: Partial<DraftV1["identity"]>) => void;
  patchCycles: (patch: Partial<DraftV1["cycles"]>) => void;
  patchEconomics: (patch: Partial<DraftV1["economics"]>) => void;
  patchPayouts: (patch: Partial<DraftV1["payouts"]>) => void;
  setTiersEnabled: (v: boolean) => void;
  upsertTier: (tier: TierV) => void;
  removeTier: (id: string) => void;
  setReservedSplits: (splits: SplitV[]) => void;
  setPayoutSplits: (splits: SplitV[]) => void;
  reset: () => void;
  markHydrated: () => void;
};

export const useWizard = create<WizardState>()(
  persist(
    (set) => ({
      draft: initialDraft(),
      hydrated: false,
      setStep: (n) =>
        set((s) => ({
          draft: { ...s.draft, step: Math.max(1, Math.min(6, n)) },
        })),
      goNext: () =>
        set((s) => ({
          draft: { ...s.draft, step: Math.min(6, s.draft.step + 1) },
        })),
      goPrev: () =>
        set((s) => ({
          draft: { ...s.draft, step: Math.max(1, s.draft.step - 1) },
        })),
      patchIdentity: (patch) =>
        set((s) => ({
          draft: { ...s.draft, identity: { ...s.draft.identity, ...patch } },
        })),
      patchCycles: (patch) =>
        set((s) => ({
          draft: { ...s.draft, cycles: { ...s.draft.cycles, ...patch } },
        })),
      patchEconomics: (patch) =>
        set((s) => ({
          draft: {
            ...s.draft,
            economics: { ...s.draft.economics, ...patch },
          },
        })),
      patchPayouts: (patch) =>
        set((s) => ({
          draft: { ...s.draft, payouts: { ...s.draft.payouts, ...patch } },
        })),
      setTiersEnabled: (v) =>
        set((s) => ({
          draft: {
            ...s.draft,
            tiers: { enabled: v, list: v ? s.draft.tiers.list : [] },
          },
        })),
      upsertTier: (tier) =>
        set((s) => {
          const idx = s.draft.tiers.list.findIndex((t) => t.id === tier.id);
          const list =
            idx === -1
              ? [...s.draft.tiers.list, tier]
              : s.draft.tiers.list.map((t, i) => (i === idx ? tier : t));
          return {
            draft: { ...s.draft, tiers: { ...s.draft.tiers, list } },
          };
        }),
      removeTier: (id) =>
        set((s) => ({
          draft: {
            ...s.draft,
            tiers: {
              ...s.draft.tiers,
              list: s.draft.tiers.list.filter((t) => t.id !== id),
            },
          },
        })),
      setReservedSplits: (splits) =>
        set((s) => ({
          draft: {
            ...s.draft,
            economics: { ...s.draft.economics, reservedSplits: splits },
          },
        })),
      setPayoutSplits: (splits) =>
        set((s) => ({
          draft: {
            ...s.draft,
            payouts: { ...s.draft.payouts, splits },
          },
        })),
      reset: () => set({ draft: initialDraft() }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ draft: s.draft }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
