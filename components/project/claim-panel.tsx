"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import {
  buildClaimMultipleTx,
  buildClaimTx,
  buildPermissionlessFinalizeTx,
  IS_DEPLOYED,
  PROJECT_COIN_DECIMALS,
} from "@/lib/contracts/pandabox";
import type { ReceiptHolding } from "@/lib/holdings";
import type { HydratedProject } from "@/lib/projects";

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-12 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

type Mode = "claim" | "finalize";

type TxState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; digest: string }
  | { kind: "error"; message: string };

/**
 * Post-sale panel.
 *
 *   - If the sale is closed AND the user holds one or more
 *     `ContributionReceipt<T>` for this project → claim flow. Burns the
 *     receipts and returns a `Coin<T>` to the sender.
 *
 *   - If the sale is over (end time elapsed) but still in `live` status →
 *     finalize flow. `project::permissionless_finalize<T>` can be called by
 *     anyone once the close condition is met.
 *
 * The parent (`ProjectActionRail`) decides which mode to render — this
 * component just executes whichever is asked.
 */
export function ClaimPanel({
  project,
  receipts,
  mode,
}: {
  project: HydratedProject;
  /** Receipts the user holds for THIS project. Empty in finalize mode. */
  receipts: ReceiptHolding[];
  mode: Mode;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [state, setState] = useState<TxState>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  const ticker = lastSegment(project.tokenType).toUpperCase() || "TOK";

  // Aggregate totals across all of the user's receipts for this project.
  const totalSui = receipts.reduce((acc, r) => acc + r.suiAmount, 0n);
  const totalTokens = receipts.reduce((acc, r) => acc + r.tokenShare, 0n);

  const onSubmit = async () => {
    if (!account) return;
    setState({ kind: "submitting" });
    try {
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 500));
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
        return;
      }
      let tx;
      if (mode === "claim") {
        if (receipts.length === 1) {
          tx = buildClaimTx({
            coinType: project.tokenType,
            projectId: project.id,
            receiptId: receipts[0].receiptId,
            sender: account.address,
          });
        } else {
          tx = buildClaimMultipleTx({
            coinType: project.tokenType,
            projectId: project.id,
            receiptIds: receipts.map((r) => r.receiptId),
            sender: account.address,
          });
        }
      } else {
        tx = buildPermissionlessFinalizeTx({
          coinType: project.tokenType,
          projectId: project.id,
        });
      }
      const result = await signAndExecute({ transaction: tx });
      setState({ kind: "success", digest: result.digest });
      void client.waitForTransaction({ digest: result.digest });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
    }
  };

  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
          <MonoLabel className="text-[10px]">
            {mode === "claim" ? "Claim your tokens" : "Finalize sale"}
          </MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            {mode === "claim"
              ? `${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`
              : "anyone"}
          </span>
        </header>

        <div className="space-y-4 px-5 pt-5 pb-4">
          {mode === "claim" ? (
            <>
              <p className="text-sm text-ink/70">
                The sale has closed. Burn your{" "}
                <code className="font-mono text-[12px]">
                  ContributionReceipt&lt;T&gt;
                </code>{" "}
                {receipts.length > 1 ? "objects" : "object"} and receive your
                share of {ticker}.
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-ink/15 pt-4">
                <Stat label="You'll receive">
                  <Marker color="saffron">
                    <span className="font-mono tabular-nums text-base">
                      {formatToken(totalTokens, PROJECT_COIN_DECIMALS)} {ticker}
                    </span>
                  </Marker>
                </Stat>
                <Stat label="From">
                  <span className="font-mono tabular-nums text-base">
                    {formatSui(totalSui)} SUI
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-ink/55">
                    contributed
                  </span>
                </Stat>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink/70">
                The sale end-time has passed. Anyone can finalize to lock in
                the final sold amount and unlock claim + withdraw for everyone.
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-ink/15 pt-4">
                <Stat label="Sold">
                  <span className="font-mono tabular-nums text-base">
                    {formatToken(project.sold, PROJECT_COIN_DECIMALS)} {ticker}
                  </span>
                </Stat>
                <Stat label="Treasury">
                  <span className="font-mono tabular-nums text-base">
                    {formatSui(project.suiBalance)} SUI
                  </span>
                </Stat>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setState({ kind: "idle" });
              setOpen(true);
            }}
            disabled={mode === "claim" && receipts.length === 0}
            className={cn(CTA_BASE, "bg-saffron text-ink")}
          >
            <span>
              {mode === "claim"
                ? `Claim ${receipts.length > 1 ? "all" : ""} → ${formatToken(totalTokens, PROJECT_COIN_DECIMALS)} ${ticker}`
                : "Finalize sale"}
            </span>
            <ArrowDiag size={14} />
          </button>
        </div>

        {mode === "claim" && receipts.length > 0 && (
          <details className="border-t border-ink/15 px-5 py-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 hover:text-ink">
              receipts ({receipts.length})
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink/65">
              {receipts.map((r) => (
                <li
                  key={r.receiptId}
                  className="flex items-baseline justify-between"
                >
                  <span>{shortMid(r.receiptId)}</span>
                  <span className="tabular-nums">
                    {formatToken(r.tokenShare, PROJECT_COIN_DECIMALS)} {ticker}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => {
          if (state.kind === "submitting") return;
          setOpen(false);
          if (state.kind === "success") setState({ kind: "idle" });
        }}
        title={mode === "claim" ? "Claim tokens" : "Finalize sale"}
      >
        {state.kind === "success" ? (
          <div className="space-y-3 text-xs">
            <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
              <span className="font-mono-label text-[11px]">
                {mode === "claim" ? "Tokens claimed" : "Sale finalized"}
              </span>
              <p className="mt-1 text-ink/75">
                {mode === "claim"
                  ? `${ticker} coin transferred to your address. Receipts burned.`
                  : "Project is now closed. Token claims and admin withdrawals are unlocked."}
              </p>
            </div>
            <p className="break-all font-mono text-[11px] text-ink/55">
              digest · {state.digest}
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-ink/55">
              {mode === "claim"
                ? `Calls project::${receipts.length > 1 ? "claim_multiple" : "claim"}<T>. Burns ${receipts.length} receipt${receipts.length === 1 ? "" : "s"} and returns a Coin<${ticker}>.`
                : "Calls project::permissionless_finalize<T>. No-op if conditions aren't met yet."}
            </p>
            {state.kind === "error" && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
              >
                {state.message}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={state.kind === "submitting"}
                className={cn(CTA_BASE, "w-auto h-10 bg-bone text-ink px-4")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={state.kind === "submitting"}
                className={cn(CTA_BASE, "w-auto h-10 bg-saffron text-ink px-4")}
              >
                <span>
                  {state.kind === "submitting"
                    ? "Signing…"
                    : mode === "claim"
                      ? "Sign & claim"
                      : "Sign & finalize"}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </aside>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function formatSui(mist: bigint): string {
  return formatToken(mist, 9);
}

function formatToken(raw: bigint, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}
