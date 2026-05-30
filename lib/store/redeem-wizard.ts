"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * State for the Redeem create-pool wizard. Five steps, one draft.
 *
 *   1. Coin     — coin type + resolved metadata + metadata object id
 *   2. Rate     — exchange rate (whole-SUI per whole-token)
 *   3. Recipient— burn vs buyback + the address
 *   4. Reserve  — initial SUI to seed the pool's reserve
 *   5. Review   — read-only summary + deploy
 *
 * Persisted to localStorage so a navigation-away doesn't lose the user's
 * work. The shape version is encoded in the storage key — a breaking
 * field rename bumps the key and the old draft is discarded on first
 * read.
 */

export const REDEEM_DRAFT_KEY = "pandabox:redeem-draft:v1";

export type RecipientMode = "burn" | "buyback";

/**
 * Default burn destination for the redeem wizard's "Burn" mode — the
 * Sui zero address. Note: the current on-chain `pool::create_pool`
 * still asserts `recipient != @0x0` (abort code 101); Burn-mode
 * deploys will MoveAbort against that contract version until the
 * assertion is lifted or the wizard switches to a non-zero default.
 */
export const SUI_BURN_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export type RedeemDraft = {
  step: number;
  coin: {
    /** Fully-qualified type, e.g. "0xabc::fomo::FOMO". Empty until step 1 resolves. */
    type: string;
    /** Object id of the `CoinMetadata<T>` for the same coin. */
    metadataId: string;
    /** Cached display metadata so later steps can render without re-resolving. */
    name: string;
    symbol: string;
    decimals: number;
    iconUrl: string | null;
  };
  /**
   * The exchange rate expressed in WHOLE SUI per WHOLE token. The wizard
   * converts to `price_mist_per_token` (u64) at deploy time using the
   * coin's decimals.
   */
  rateSuiPerToken: string;
  recipient: {
    mode: RecipientMode;
    /** For `burn` we default to SUI_BURN_ADDRESS. For `buyback` the user types it. */
    address: string;
  };
  /** Initial reserve seed, as a decimal SUI string (e.g. "0.5"). */
  initialReserveSui: string;
};

function emptyDraft(): RedeemDraft {
  return {
    step: 1,
    coin: {
      type: "",
      metadataId: "",
      name: "",
      symbol: "",
      decimals: 9,
      iconUrl: null,
    },
    rateSuiPerToken: "",
    recipient: { mode: "burn", address: SUI_BURN_ADDRESS },
    initialReserveSui: "",
  };
}

type WizardState = {
  draft: RedeemDraft;
  hydrated: boolean;
  setStep: (n: number) => void;
  goNext: () => void;
  goPrev: () => void;
  patchCoin: (patch: Partial<RedeemDraft["coin"]>) => void;
  setRate: (v: string) => void;
  patchRecipient: (patch: Partial<RedeemDraft["recipient"]>) => void;
  setInitialReserve: (v: string) => void;
  reset: () => void;
  markHydrated: () => void;
};

const MAX_STEP = 5;

export const useRedeemWizard = create<WizardState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      hydrated: false,
      setStep: (n) =>
        set((s) => ({
          draft: { ...s.draft, step: Math.max(1, Math.min(MAX_STEP, n)) },
        })),
      goNext: () =>
        set((s) => ({
          draft: { ...s.draft, step: Math.min(MAX_STEP, s.draft.step + 1) },
        })),
      goPrev: () =>
        set((s) => ({
          draft: { ...s.draft, step: Math.max(1, s.draft.step - 1) },
        })),
      patchCoin: (patch) =>
        set((s) => ({
          draft: { ...s.draft, coin: { ...s.draft.coin, ...patch } },
        })),
      setRate: (v) =>
        set((s) => ({ draft: { ...s.draft, rateSuiPerToken: v } })),
      patchRecipient: (patch) =>
        set((s) => ({
          draft: { ...s.draft, recipient: { ...s.draft.recipient, ...patch } },
        })),
      setInitialReserve: (v) =>
        set((s) => ({ draft: { ...s.draft, initialReserveSui: v } })),
      reset: () => set({ draft: emptyDraft() }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: REDEEM_DRAFT_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
      partialize: (state) => ({ draft: state.draft }),
    },
  ),
);
