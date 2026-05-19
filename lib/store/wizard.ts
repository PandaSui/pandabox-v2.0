"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DraftV2 } from "./wizard-schema";

// Bumped to v2 because the v1 shape is incompatible. Old localStorage drafts
// won't migrate — they're discarded on first read of the new schema.
export const STORAGE_KEY = "pandabox:draft:v2";

export function initialDraft(): DraftV2 {
  return {
    version: 2,
    step: 1,
    identity: {},
    coin: { verified: false },
    sale: {},
    deploy: {},
  };
}

type WizardState = {
  draft: DraftV2;
  hydrated: boolean;
  setStep: (n: number) => void;
  goNext: () => void;
  goPrev: () => void;
  patchIdentity: (patch: Partial<DraftV2["identity"]>) => void;
  patchCoin: (patch: Partial<DraftV2["coin"]>) => void;
  patchSale: (patch: Partial<DraftV2["sale"]>) => void;
  patchDeploy: (patch: Partial<DraftV2["deploy"]>) => void;
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
          draft: { ...s.draft, step: Math.max(1, Math.min(4, n)) },
        })),
      goNext: () =>
        set((s) => ({
          draft: { ...s.draft, step: Math.min(4, s.draft.step + 1) },
        })),
      goPrev: () =>
        set((s) => ({
          draft: { ...s.draft, step: Math.max(1, s.draft.step - 1) },
        })),
      patchIdentity: (patch) =>
        set((s) => ({
          draft: { ...s.draft, identity: { ...s.draft.identity, ...patch } },
        })),
      patchCoin: (patch) =>
        set((s) => ({
          draft: { ...s.draft, coin: { ...s.draft.coin, ...patch } },
        })),
      patchSale: (patch) =>
        set((s) => ({
          draft: { ...s.draft, sale: { ...s.draft.sale, ...patch } },
        })),
      patchDeploy: (patch) =>
        set((s) => ({
          draft: { ...s.draft, deploy: { ...s.draft.deploy, ...patch } },
        })),
      reset: () => set({ draft: initialDraft() }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ draft: s.draft }),
      // Discard drafts shaped for the old (v1) wizard.
      migrate: (persisted) => {
        const p = persisted as { draft?: { version?: number } } | undefined;
        if (!p || !p.draft || p.draft.version !== 2) {
          return { draft: initialDraft() };
        }
        return p as { draft: DraftV2 };
      },
      version: 2,
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
