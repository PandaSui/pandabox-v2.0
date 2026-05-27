"use client";

import { create } from "zustand";
import type { SubmitState } from "@/lib/airdrop";

/**
 * Transient (non-persisted) holder for the airdrop submit-lifecycle
 * state. The `AirdropPanel` writes via `useSubmitAirdrop`; the hero's
 * `LiveFanOutTrace` reads to project `running` / `settled` states.
 *
 * Why a store rather than React context: the trace lives in the page
 * masthead (way above the panel) and a context provider wrapping both
 * would have to be hoisted into the page tree. A Zustand atom keeps
 * the wiring flat — either consumer subscribes without coordination.
 *
 * Not persisted: signing progress only matters within one page session.
 * Reloading mid-flight resets the bench rather than pretending a tx is
 * still in-flight when the wallet sheet has long since disappeared.
 */

type Store = {
  state: SubmitState;
  setState: (s: SubmitState) => void;
};

export const useAirdropSubmitStore = create<Store>((set) => ({
  state: { kind: "idle" },
  setState: (s) => set({ state: s }),
}));
