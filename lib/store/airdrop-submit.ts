"use client";

import { create } from "zustand";
import type { AirdroppedEvent, SubmitState } from "@/lib/airdrop";

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
 * The store also carries a session-scoped `recentSuccesses` list — the
 * activity feed prepends these so a just-completed airdrop appears in
 * the list *immediately*, before Sui's event indexer has caught up
 * with `waitForTransaction` (typically a 2-3 second lag on mainnet).
 * The list is deduped by `txDigest`, so when the server eventually
 * refetches and includes the same digest, no duplicate renders.
 *
 * Not persisted: signing progress only matters within one page session.
 * Reloading mid-flight resets the bench rather than pretending a tx is
 * still in-flight when the wallet sheet has long since disappeared.
 */

const RECENT_SUCCESS_CAP = 50;

type Store = {
  state: SubmitState;
  setState: (s: SubmitState) => void;
  /**
   * Locally-observed `Airdropped` events from successful sends in this
   * session. Newest-first. Bounded to the last `RECENT_SUCCESS_CAP`
   * entries so the list can't grow unbounded across many sends.
   */
  recentSuccesses: AirdroppedEvent[];
  appendSuccesses: (events: AirdroppedEvent[]) => void;
};

export const useAirdropSubmitStore = create<Store>((set) => ({
  state: { kind: "idle" },
  setState: (s) => set({ state: s }),
  recentSuccesses: [],
  appendSuccesses: (events) =>
    set((s) => {
      if (events.length === 0) return s;
      const seen = new Set<string>(
        s.recentSuccesses.map((e) => e.txDigest),
      );
      const incoming = events.filter((e) => !seen.has(e.txDigest));
      if (incoming.length === 0) return s;
      const merged = [...incoming, ...s.recentSuccesses];
      return {
        recentSuccesses:
          merged.length > RECENT_SUCCESS_CAP
            ? merged.slice(0, RECENT_SUCCESS_CAP)
            : merged,
      };
    }),
}));
