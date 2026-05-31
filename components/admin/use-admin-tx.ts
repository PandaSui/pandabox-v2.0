"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import type { Transaction } from "@mysten/sui/transactions";
import { useAdminContext } from "./admin-context";

/**
 * The submit → sign → wait → refresh state machine shared by every protocol
 * panel. Keyed by an action string so a panel with several controls can track
 * which one is in flight.
 *
 * Two guard rails are baked in:
 *  - **preview**: while the console is in read-only preview, `run` never signs.
 *    It surfaces a friendly notice instead, so the operator sees the exact
 *    flow without a wallet prompt.
 *  - **simulation**: when `deployed` is false (env not wired), `run` fakes a
 *    successful digest after a short delay — keeps the UI demoable off-chain.
 */

export type TxState<A extends string = string> =
  | { kind: "idle" }
  | { kind: "submitting"; action: A }
  | { kind: "success"; action: A; digest: string }
  | { kind: "error"; action: A; message: string };

const PREVIEW_NOTICE =
  "Read-only preview — connect the wallet that holds this admin cap to sign.";

export function useAdminTx<A extends string = string>(opts: {
  /** Pass the protocol's `IS_DEPLOYED` flag; false → simulate. */
  deployed: boolean;
}) {
  const router = useRouter();
  const client = useSuiClient();
  const { preview } = useAdminContext();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [state, setState] = useState<TxState<A>>({ kind: "idle" });

  const busy = state.kind === "submitting";
  const reset = () => setState({ kind: "idle" });

  /**
   * Run an admin action. `build` is called lazily so the transaction is only
   * constructed when we're actually going to sign it.
   */
  const run = async (
    action: A,
    build: () => Transaction,
    runOpts?: {
      /** Fired after the tx is confirmed on chain, before `router.refresh()`. */
      afterSuccess?: () => void;
    },
  ): Promise<void> => {
    if (preview) {
      setState({ kind: "error", action, message: PREVIEW_NOTICE });
      return;
    }
    setState({ kind: "submitting", action });
    try {
      if (!opts.deployed) {
        await new Promise((r) => setTimeout(r, 500));
        setState({
          kind: "success",
          action,
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
        return;
      }
      const result = await signAndExecute({ transaction: build() });
      setState({ kind: "success", action, digest: result.digest });
      await client.waitForTransaction({ digest: result.digest });
      runOpts?.afterSuccess?.();
      router.refresh();
    } catch (err) {
      setState({
        kind: "error",
        action,
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
    }
  };

  return { state, busy, run, reset, preview };
}
