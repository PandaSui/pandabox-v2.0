"use client";

import { useCallback } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AIRDROP_EVENT_TYPE,
  buildAirdropTx,
} from "@/lib/contracts/airdrop";
import { bustAirdropCache } from "@/lib/server-actions/airdrop-cache";
import { useAirdropSubmitStore } from "@/lib/store/airdrop-submit";
import { parseAirdropped } from "./parse";
import { parseAirdropAbort } from "./abort-codes";
import { selectMinimumCover } from "./coin-discovery";
import { useOwnedCoinObjects } from "./use-owned-coins";
import { quoteBatch } from "./quote";
import type {
  AirdropBatch,
  AirdropPlatformState,
  AirdroppedEvent,
  OwnedCoin,
} from "./types";
import type { BatchResult, SubmitState } from "./submit-state";

/**
 * Hook that owns the airdrop submit lifecycle. Walks the batches one by
 * one — each batch:
 *
 *   1. picks a minimum-cover subset of the wallet's `Coin<T>` objects
 *      that sums to ≥ the batch's `totalAmountRaw`
 *   2. builds the PTB via `buildAirdropTx` (Phase 3)
 *   3. opens the wallet (`useSignAndExecuteTransaction`)
 *   4. waits for the tx to settle via `waitForTransaction({ showEvents })`
 *   5. extracts the `Airdropped` event and folds it into `completed[]`
 *   6. invalidates the wallet's `getCoins` cache so the picker reflects
 *      the post-tx balance before the next batch picks its inputs
 *
 * After the last batch lands, busts the cached `getAirdropPlatform` reader
 * + revalidates the `/airdrop` route so the masthead lifetime counter
 * updates immediately.
 *
 * Errors mid-flight don't reset progress — `completed[]` is carried into
 * the `error` branch so the user can either retry remaining batches or
 * reset cleanly. Retry policy lives in the caller (the panel) since it
 * involves UI choices.
 */

export type UseSubmitAirdropArgs = {
  platform: AirdropPlatformState | null;
  coinType: string;
  batches: AirdropBatch[];
  memo: string | null;
  feePerRecipientMist: bigint;
};

export type UseSubmitAirdropResult = {
  state: SubmitState;
  openInspector: () => void;
  closeInspector: () => void;
  /**
   * Begin the signing loop. When the prior state is `error` with
   * partial batch completion, the loop resumes from the first
   * incomplete batch (skipping already-settled ones). Use `restart` to
   * force a fresh run from batch 1.
   */
  submit: () => Promise<void>;
  /**
   * Clear any prior partial completion and run the loop from batch 1.
   * Only meaningful when state is `error` with `partial.length > 0` —
   * for fresh sends, callers should use `submit` instead.
   */
  restart: () => Promise<void>;
  /** Force back to idle — used by the success-modal close button. */
  reset: () => void;
};

export function useSubmitAirdrop(
  args: UseSubmitAirdropArgs,
): UseSubmitAirdropResult {
  const { platform, coinType, batches, memo, feePerRecipientMist } = args;

  const account = useCurrentAccount();
  const client = useSuiClient();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Live owned-coin objects for the picked type. The hook fetches them
  // here (rather than passing them in from the panel) so each successive
  // batch re-reads the post-mutation state — the previous batch consumed
  // some objects, so the next must select from a fresh list.
  const { coins, refetch: refetchCoins } = useOwnedCoinObjects(coinType);

  // Publish state through the shared store so the hero trace + any other
  // sibling consumer can subscribe without prop drilling.
  const state = useAirdropSubmitStore((s) => s.state);
  const setState = useAirdropSubmitStore((s) => s.setState);
  const appendSuccesses = useAirdropSubmitStore((s) => s.appendSuccesses);

  const openInspector = useCallback(() => {
    if (state.kind === "idle" || state.kind === "error") {
      setState({ kind: "inspecting" });
    }
  }, [state.kind]);

  const closeInspector = useCallback(() => {
    // Allow dismissal from any state where the user can sensibly cancel —
    // before submit (`inspecting`) or after a terminal failure (`error`).
    // Mid-flight states (`dry-running`, `signing`, `confirming`) are
    // gated by `disabled={isInFlight}` on the Cancel button itself.
    if (state.kind === "inspecting" || state.kind === "error") {
      setState({ kind: "idle" });
    }
  }, [state.kind]);

  const reset = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  const runSubmit = useCallback(async (opts: { resumeFromPartial: boolean }) => {
    if (!account?.address) {
      setState({
        kind: "error",
        message: "Connect a wallet to sign.",
        partial: [],
      });
      return;
    }
    if (!platform) {
      setState({
        kind: "error",
        message: "Airdrop platform state isn't loaded.",
        partial: [],
      });
      return;
    }
    if (batches.length === 0) {
      setState({
        kind: "error",
        message: "No recipients to send.",
        partial: [],
      });
      return;
    }

    // Resume policy: when the caller asks to resume and the prior
    // state is `error` with a non-empty `partial` whose batch indices
    // line up with the current `batches` array, seed `completed` with
    // those results and start the loop after them. Anything else
    // (drift in batches, change in coinType, fresh state) falls back
    // to a fresh run from batch 1.
    const priorPartial =
      opts.resumeFromPartial && state.kind === "error"
        ? state.partial
        : [];
    const completed: BatchResult[] = priorPartial.filter(
      (r) => r.index < batches.length,
    );
    const startIndex = completed.reduce(
      (max, r) => Math.max(max, r.index + 1),
      0,
    );
    const totalBatches = batches.length;

    // No remaining batches — the resume path can land here if every
    // partial batch already covered the whole list, which would be a
    // strange shape but the right answer is the success state.
    if (startIndex >= totalBatches) {
      setState({ kind: "success", results: completed });
      void bustAirdropCache().catch(() => {});
      router.refresh();
      return;
    }

    // Walk the batches sequentially. dapp-kit `signAndExecute` already
    // serializes through the wallet, but we want our own loop so we can
    // surface per-batch progress, refetch coins between batches, and
    // halt cleanly on the first failure.
    let liveCoins: OwnedCoin[] = coins;

    for (let i = startIndex; i < totalBatches; i += 1) {
      const batch = batches[i];

      // Recompute the fee + total to defend against drift from any
      // upstream caller — `quoteBatch` is pure + cheap.
      const { totalAmountRaw, feeMist } = quoteBatch(
        batch.rows,
        feePerRecipientMist,
      );

      const cover = selectMinimumCover(liveCoins, totalAmountRaw);
      if (!cover || cover.selected.length === 0) {
        setState({
          kind: "error",
          message: `Batch ${i + 1}/${totalBatches}: insufficient ${shortType(coinType)} balance to cover ${totalAmountRaw.toString()} base units.`,
          partial: [...completed],
        });
        return;
      }

      const coinObjectIds = cover.selected.map((c) => c.objectId) as [
        string,
        ...string[],
      ];

      const tx = buildAirdropTx({
        coinType,
        coinObjectIds,
        totalAmountRaw,
        feeMist,
        recipients: batch.rows.map((r) => r.address),
        amounts: batch.rows.map((r) => r.amountRaw),
        memo: memo && memo.length > 0 ? memo : null,
        platformInitialSharedVersion: platform.initialSharedVersion,
        sender: account.address,
      });

      // Pre-flight dry-run via `devInspect_transactionBlock`. This is a
      // read-only simulation against current chain state — it surfaces
      // contract aborts before the wallet sheet opens, so the user
      // doesn't burn a signature on a tx we already know will fail.
      // Cheap (sub-100ms typical) and worth the round-trip.
      setState({
        kind: "dry-running",
        batchIndex: i,
        totalBatches,
        completed: [...completed],
      });
      try {
        const inspect = await client.devInspectTransactionBlock({
          sender: account.address,
          transactionBlock: tx,
        });
        const status = inspect.effects?.status?.status;
        if (status !== "success") {
          const rawError =
            inspect.effects?.status?.error ?? "dry-run failed";
          setState({
            kind: "error",
            message: explainError(
              new Error(rawError),
              i,
              totalBatches,
            ),
            partial: [...completed],
          });
          return;
        }
      } catch (err) {
        // A devInspect transport error is not the same as a contract
        // abort — log it, then proceed to actual sign. The signing path
        // has its own error handling and will catch genuine asserts.
        // We don't want a transient RPC blip to block the user.
        console.warn("[airdrop] devInspect pre-flight skipped:", err);
      }

      setState({
        kind: "signing",
        batchIndex: i,
        totalBatches,
        completed: [...completed],
      });

      let result: { digest: string };
      try {
        result = await signAndExecute({ transaction: tx });
      } catch (err) {
        setState({
          kind: "error",
          message: explainError(err, i, totalBatches),
          partial: [...completed],
        });
        return;
      }

      setState({
        kind: "confirming",
        batchIndex: i,
        totalBatches,
        digest: result.digest,
        completed: [...completed],
      });

      // Wait for the tx to settle, then pull the events out so the
      // success view can render the on-chain `Airdropped` payload. If
      // the wait fails, fall through with a null event — the digest is
      // still authoritative, the chain accepted it.
      let event: AirdroppedEvent | null = null;
      try {
        const receipt = await client.waitForTransaction({
          digest: result.digest,
          options: { showEvents: true },
        });
        const airdropEvent = receipt.events?.find(
          (e) => e.type === AIRDROP_EVENT_TYPE.Airdropped,
        );
        if (airdropEvent) {
          event = parseAirdropped({
            id: airdropEvent.id,
            parsedJson:
              (airdropEvent.parsedJson as Record<string, unknown>) ?? {},
          });
        }
      } catch {
        event = null;
      }

      completed.push({
        index: i,
        total: totalBatches,
        digest: result.digest,
        event,
      });

      // Between batches: refetch the wallet's coin objects so the next
      // `selectMinimumCover` sees the post-batch state. The PTB consumed
      // some objects and produced a leftover — `getCoins` is the only
      // way to know which ids exist now.
      try {
        liveCoins = await refetchCoins();
      } catch {
        // If the refetch fails, fall back to the previous list minus
        // the just-spent ids. Imperfect but keeps the loop going.
        const spentIds = new Set(coinObjectIds);
        liveCoins = liveCoins.filter((c) => !spentIds.has(c.objectId));
      }
    }

    setState({ kind: "success", results: completed });

    // Optimistically prepend the just-settled events into the shared
    // store so the activity feed below the panel shows them
    // immediately. The Sui event indexer typically lags
    // `waitForTransaction` by 2-3s on mainnet — without this, the
    // feed's `router.refresh()` pull would briefly show stale data.
    // Once the server fetch catches up, dedupe by `txDigest` hides
    // the optimistic copy.
    const successfulEvents = completed
      .map((r) => r.event)
      .filter((e): e is NonNullable<typeof e> => e !== null);
    if (successfulEvents.length > 0) {
      appendSuccesses(successfulEvents);
    }

    // Cache busts — fire and forget. The masthead lifetime counter +
    // recent-activity feed will pick these up on the next render.
    void bustAirdropCache().catch(() => {});
    router.refresh();
    queryClient.invalidateQueries({ queryKey: [network, "getCoins"] });
    queryClient.invalidateQueries({ queryKey: [network, "getAllBalances"] });
  }, [
    account?.address,
    platform,
    batches,
    coins,
    coinType,
    feePerRecipientMist,
    memo,
    signAndExecute,
    client,
    refetchCoins,
    router,
    queryClient,
    network,
    state,
    setState,
    appendSuccesses,
  ]);

  const submit = useCallback(
    () => runSubmit({ resumeFromPartial: true }),
    [runSubmit],
  );
  const restart = useCallback(
    () => runSubmit({ resumeFromPartial: false }),
    [runSubmit],
  );

  return { state, openInspector, closeInspector, submit, restart, reset };
}

/* ─────────────────────────── helpers ─────────────────────────── */

function explainError(err: unknown, index: number, total: number): string {
  const raw = err instanceof Error ? err.message : String(err);
  const abort = parseAirdropAbort(raw);
  const prefix = total > 1 ? `Batch ${index + 1}/${total}: ` : "";
  if (abort) {
    return `${prefix}${abort.message}`;
  }
  // Wallet rejection patterns vary across wallets — surface a stable
  // copy for the most common one so the user knows they cancelled.
  if (/user rejected|user denied|cancel/i.test(raw)) {
    return `${prefix}Signing cancelled.`;
  }
  return `${prefix}${raw}`;
}

function shortType(coinType: string): string {
  const tail = coinType.split("::").pop() ?? "";
  return tail || coinType;
}
