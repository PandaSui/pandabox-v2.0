"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DuplicatePolicy } from "@/lib/airdrop";

/**
 * Draft state for the /airdrop composer. One screen, one draft. Persisted
 * to localStorage so a stray refresh or accidental navigation doesn't lose
 * the user's recipient list.
 *
 * What we persist:
 *   - `coinType`        — fully-qualified Move type the user picked.
 *                         Metadata + balances are fetched live, never
 *                         stored, so the next page load reflects the
 *                         current wallet state.
 *   - `rawInput`        — verbatim text from the paste/upload box. The
 *                         parser is pure + cheap, so we re-derive
 *                         `RecipientRow[]` on every render rather than
 *                         persisting the parsed list (which would risk
 *                         going stale against the parser's logic).
 *   - `memo`            — optional caller memo, max 256 chars.
 *   - `duplicatePolicy` — how the parser merges duplicate-address rows.
 *
 * What we don't persist:
 *   - Selected coin objects (live wallet state).
 *   - Quote totals (derived from `rawInput` + `coinType` + chain state).
 *   - Submit progress / batch index (transient; reset on reload).
 *
 * The shape version is encoded in the storage key so a breaking field
 * rename bumps the key and the old draft is discarded cleanly.
 */

export const AIRDROP_DRAFT_KEY = "pandabox:airdrop-draft:v1";

export type AirdropDraft = {
  coinType: string;
  rawInput: string;
  memo: string;
  duplicatePolicy: DuplicatePolicy;
};

function emptyDraft(): AirdropDraft {
  return {
    coinType: "",
    rawInput: "",
    memo: "",
    duplicatePolicy: "sum",
  };
}

type DraftState = {
  draft: AirdropDraft;
  hydrated: boolean;
  setCoinType: (t: string) => void;
  setRawInput: (v: string) => void;
  setMemo: (v: string) => void;
  setDuplicatePolicy: (p: DuplicatePolicy) => void;
  reset: () => void;
  markHydrated: () => void;
};

const MEMO_MAX = 256;

export const useAirdropDraft = create<DraftState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      hydrated: false,
      setCoinType: (t) => set((s) => ({ draft: { ...s.draft, coinType: t } })),
      setRawInput: (v) => set((s) => ({ draft: { ...s.draft, rawInput: v } })),
      setMemo: (v) =>
        set((s) => ({
          draft: { ...s.draft, memo: v.slice(0, MEMO_MAX) },
        })),
      setDuplicatePolicy: (p) =>
        set((s) => ({ draft: { ...s.draft, duplicatePolicy: p } })),
      reset: () => set({ draft: emptyDraft() }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: AIRDROP_DRAFT_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
      partialize: (state) => ({ draft: state.draft }),
    },
  ),
);

export { MEMO_MAX };
