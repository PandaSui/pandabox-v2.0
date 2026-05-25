"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import {
  buildPermissionlessFinalizeTx,
  buildProcessUnsoldTx,
  buildRenounceProjectAdminTx,
  buildTransferProjectAdminTx,
  buildUpdateMetadataTx,
  buildWithdrawSuiTx,
  IS_DEPLOYED,
  PROJECT_COIN_DECIMALS,
} from "@/lib/contracts/pandabox";
import { explorerUrl } from "@/lib/sui";
import { usePlatformFeeBps } from "@/lib/hooks/use-platform-fee-bps";
import type { AdminCapHolding } from "@/lib/holdings";
import type { HydratedProject } from "@/lib/projects";
import { SeedLiquidityModal } from "./seed-liquidity-modal";

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-11 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.75rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

type Action =
  | "withdraw"
  | "metadata"
  | "finalize"
  | "unsold"
  | "transfer"
  | "renounce"
  | "seedLiquidity";

type TxState =
  | { kind: "idle" }
  | { kind: "submitting"; action: Action }
  | { kind: "success"; action: Action; digest: string }
  | { kind: "error"; action: Action; message: string };

/**
 * Project-creator admin panel — surfaced on `/projects/[id]` when the connected
 * wallet owns the `ProjectAdminCap<T>` for that project. Exposes every
 * creator-side mutation the on-chain `project` module supports:
 *
 *   - withdraw_sui<T>          → pull raised SUI (platform fee skimmed)
 *   - update_metadata<T>       → edit name + the four blob refs
 *   - process_unsold<T>        → burn / return unsold supply post-finalize
 *   - transfer_project_admin<T> → hand the cap to another address (multisig, DAO)
 *   - renounce_project_admin<T> → permanently destroy the cap
 */
export function AdminPanel({
  project,
  cap,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const router = useRouter();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  // Reads the on-chain `Platform.fee_bps` so the withdraw flow can show the
  // real net after the protocol skim instead of a placeholder. Null while
  // loading or if the platform object id isn't configured.
  const { feeBps } = usePlatformFeeBps();

  const [open, setOpen] = useState<Action | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  // `project.status` from the reader is a string label, not the u8 code.
  // Closed + compromised (rawStatus 1 or 2) both unlock `process_unsold`.
  const closedOrCompromised = project.status === "closed";

  // Finalize is permissionless on-chain, but it's useful to surface it inside
  // the AdminPanel too — covers the edge case where the creator is the only
  // wallet watching the sale (no supporters around to trigger close). We
  // gate the UI on "status is still live AND the end-time has elapsed" so
  // the button doesn't appear when the sale is still legitimately running.
  const endElapsed = project.endTimeMs > 0 && Date.now() > project.endTimeMs;
  const showFinalize = project.status === "live" && endElapsed;

  // Available SUI to withdraw equals project.sui_balance (the platform fee is
  // taken from the gross amount when the call executes).
  const availableSui = project.suiBalance;

  const execute = async (
    action: Action,
    build: () => ReturnType<typeof buildWithdrawSuiTx>,
  ) => {
    if (!account) return;
    setTx({ kind: "submitting", action });
    try {
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 500));
        setTx({
          kind: "success",
          action,
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
        return;
      }
      const transaction = build();
      const result = await signAndExecute({ transaction });
      setTx({ kind: "success", action, digest: result.digest });
      // Wait for the tx to be observable on a fullnode, then re-fetch the
      // server component so the props that drive this panel — treasury,
      // sold, status — reflect the new on-chain state. Done in the
      // background so the success modal stays snappy; by the time the
      // admin dismisses it, the page underneath has fresh numbers (e.g.
      // 0 SUI in the treasury after a full withdraw, "Withdraw SUI"
      // disabled).
      void client
        .waitForTransaction({ digest: result.digest })
        .finally(() => router.refresh());
    } catch (err) {
      setTx({
        kind: "error",
        action,
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
    }
  };

  const busy = tx.kind === "submitting";

  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-sky"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            <MonoLabel className="text-[10px]">Admin</MonoLabel>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            you hold the cap
          </span>
        </header>

        <div className="space-y-3 px-5 pt-5 pb-3">
          <SummaryRow
            k="treasury"
            v={`${formatSui(availableSui)} SUI`}
            hint="withdrawable"
          />
          <SummaryRow
            k="sold"
            v={`${formatToken(project.sold, PROJECT_COIN_DECIMALS)} ${shortCoin(project.tokenType)}`}
          />
          <SummaryRow k="cap" v={shortMid(cap.capId)} mono />
        </div>

        <div className="grid grid-cols-1 gap-2 px-5 pb-5">
          {/*
           * `withdraw_sui` is gated on the project being finalized — the Move
           * contract reverts while the sale is still live, even if the
           * treasury already holds raised SUI. Disable the button until the
           * sale is closed/compromised so we never build a doomed tx.
           */}
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("withdraw");
            }}
            disabled={busy || availableSui === 0n || !closedOrCompromised}
            className={cn(CTA_BASE, "bg-saffron text-ink")}
            title={
              !closedOrCompromised
                ? "Sale must be finalized before SUI can be withdrawn"
                : availableSui === 0n
                  ? "Treasury is empty"
                  : undefined
            }
          >
            <span>Withdraw SUI</span>
            <ArrowDiag size={12} />
          </button>
          {!closedOrCompromised && availableSui > 0n && (
            <div className="flex items-start gap-2 border border-poppy/40 bg-poppy/[0.08] px-3 py-2">
              <span
                aria-hidden
                className="mt-[3px] block h-1.5 w-1.5 shrink-0 rounded-full bg-poppy"
                style={{
                  animation: "stat-live-dot 1.4s ease-in-out infinite",
                }}
              />
              <p className="font-mono text-[10.5px] leading-snug text-poppy">
                <span className="font-semibold uppercase tracking-[0.14em]">
                  Sale must be finalized
                </span>{" "}
                before SUI can be withdrawn.
                {showFinalize ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTx({ kind: "idle" });
                      setOpen("finalize");
                    }}
                    className="font-mono-label underline-offset-2 hover:underline"
                  >
                    finalize sale →
                  </button>
                ) : (
                  <span className="text-poppy/80">
                    {" "}
                    Kindly wait for end-time to elapse.
                  </span>
                )}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("metadata");
            }}
            disabled={busy}
            className={cn(CTA_BASE, "bg-bone text-ink")}
          >
            <span>Update metadata</span>
          </button>
          {/*
           * Off-chain liquidity seed. Until the Move struct grows a real
           * `liquidity_seeded` field, the chart's "live trading" state is
           * driven by a flag we pin to project_details.json. Once the
           * creator marks it seeded against a verified Cetus pool, the
           * price chart on the project page switches from placeholder to
           * live OHLCV from GeckoTerminal. Already-seeded projects skip showing
           * this button so it doesn't pretend to be a re-seed flow.
           */}
          {!project.liquiditySeeded && (
            <button
              type="button"
              onClick={() => setOpen("seedLiquidity")}
              disabled={busy}
              className={cn(CTA_BASE, "bg-bone border-jade text-jade")}
              title="Mark this project's Cetus pool as live to enable the price chart"
            >
              <span>Seed Cetus pool</span>
              <ArrowDiag size={12} />
            </button>
          )}
          {project.liquiditySeeded && (
            <div className="flex items-start gap-2 border border-jade/30 bg-jade/[0.06] px-3 py-2">
              <span
                aria-hidden
                className="mt-[3px] block h-1.5 w-1.5 shrink-0 rounded-full bg-jade"
                style={{
                  animation: "stat-live-dot 1.4s ease-in-out infinite",
                }}
              />
              <p className="font-mono text-[10.5px] leading-snug text-jade">
                <span className="font-semibold uppercase tracking-[0.14em]">
                  Liquidity seeded
                </span>{" "}
                <span className="text-ink/65">
                  · price chart is live on this project's page.
                </span>
              </p>
            </div>
          )}
          {showFinalize && (
            <button
              type="button"
              onClick={() => {
                setTx({ kind: "idle" });
                setOpen("finalize");
              }}
              disabled={busy}
              className={cn(CTA_BASE, "bg-bone border-poppy text-poppy")}
              title="Sale end-time has elapsed — close the sale on-chain to unlock claims + withdrawals"
            >
              <span>Finalize sale</span>
              <ArrowDiag size={12} />
            </button>
          )}
          {closedOrCompromised && (
            <button
              type="button"
              onClick={() => {
                setTx({ kind: "idle" });
                setOpen("unsold");
              }}
              disabled={busy || project.unsoldProcessed}
              className={cn(CTA_BASE, "bg-bone text-ink")}
              title={
                project.unsoldProcessed
                  ? "Unsold supply already processed"
                  : undefined
              }
            >
              <span>
                {project.unsoldProcessed
                  ? "Unsold processed ✓"
                  : "Process unsold"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("transfer");
            }}
            disabled={busy}
            className={cn(CTA_BASE, "bg-bone text-ink")}
          >
            <span>Transfer admin</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("renounce");
            }}
            disabled={busy}
            className={cn(CTA_BASE, "bg-bone text-poppy border-poppy")}
          >
            <span>Renounce</span>
          </button>
        </div>
      </div>

      {open === "withdraw" && (
        <WithdrawModal
          project={project}
          cap={cap}
          state={tx}
          busy={busy}
          recipient={account?.address}
          feeBps={feeBps}
          onClose={() => setOpen(null)}
          onOpenFinalize={() => {
            setTx({ kind: "idle" });
            setOpen("finalize");
          }}
          onSubmit={(amountMist) =>
            execute("withdraw", () =>
              buildWithdrawSuiTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
                amountMist,
                recipient: account!.address,
              }),
            )
          }
        />
      )}
      {open === "metadata" && (
        <MetadataModal
          project={project}
          cap={cap}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(patch) =>
            execute("metadata", () =>
              buildUpdateMetadataTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
                ...patch,
              }),
            )
          }
        />
      )}
      {open === "finalize" && (
        <ConfirmModal
          title="Finalize sale"
          body={
            <p>
              Closes the sale on-chain. Anyone can call this once the end-time
              elapses — calling from your admin wallet just means you're the one
              paying the gas. After finalize, supporters can <code>claim</code>{" "}
              their tokens and you can <code>withdraw_sui</code> the raised
              funds.
            </p>
          }
          confirm="Finalize sale"
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("finalize", () =>
              buildPermissionlessFinalizeTx({
                coinType: cap.coinType,
                projectId: project.id,
              }),
            )
          }
        />
      )}
      {open === "unsold" && (
        <ConfirmModal
          title="Process unsold supply"
          body={
            <p>
              Burns or returns unsold{" "}
              <code>{shortCoin(project.tokenType)}</code> to{" "}
              {project.unsoldAction === 1 ? "you" : "the void"} based on this
              project's <code>unsold_action</code> setting. Callable once.
            </p>
          }
          confirm="Process unsold"
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("unsold", () =>
              buildProcessUnsoldTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
              }),
            )
          }
        />
      )}
      {open === "transfer" && (
        <TransferModal
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(recipient) =>
            execute("transfer", () =>
              buildTransferProjectAdminTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                recipient,
              }),
            )
          }
        />
      )}
      {open === "seedLiquidity" && (
        <SeedLiquidityModal
          project={project}
          cap={cap}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "renounce" && (
        <ConfirmModal
          title="Renounce admin"
          body={
            <p className="text-poppy">
              Permanently destroys this AdminCap. You will lose the ability to
              update metadata, withdraw SUI, or process unsold supply on this
              project. This action cannot be undone.
            </p>
          }
          confirm="Renounce"
          danger
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("renounce", () =>
              buildRenounceProjectAdminTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
              }),
            )
          }
        />
      )}
    </aside>
  );
}

/* ─────────────────────── Sub-modals ─────────────────────── */

function WithdrawModal({
  project,
  cap,
  state,
  busy,
  onClose,
  onSubmit,
  onOpenFinalize,
  recipient,
  feeBps,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (amountMist: bigint) => void;
  /** Switches the modal stack to the Finalize confirmation when the sale isn't ready. */
  onOpenFinalize: () => void;
  recipient?: string;
  /**
   * Live `Platform.fee_bps`. Null while the on-chain read is loading or the
   * platform object id isn't configured — in that case the modal falls back
   * to the "− protocol bps" placeholder language.
   */
  feeBps?: number | null;
}) {
  const max = project.suiBalance;
  const maxSui = Number(max) / 1e9;
  const [input, setInput] = useState<string>(maxSui.toFixed(4));
  // Snapshot of the amount the admin submitted. We need this because once
  // the tx confirms and `router.refresh()` rehydrates props with the new
  // treasury balance (0n after a full withdraw), the live `amount` memo
  // recomputes to 0 — which would falsely tell the success view that 0 SUI
  // was just withdrawn.
  const [submittedAmount, setSubmittedAmount] = useState<bigint | null>(null);

  const amount = useMemo(() => {
    const bn = new BigNumber(input || "0");
    if (!bn.isFinite() || bn.lte(0)) return 0n;
    const m = BigInt(
      bn.multipliedBy(1e9).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
    );
    return m > max ? max : m;
  }, [input, max]);

  const finalized = project.status === "closed";
  const treasuryHasBalance = max > 0n;
  const amountValid = amount > 0n && amount <= max;

  // Real protocol skim, computed off the live `Platform.fee_bps`. When the
  // bps read hasn't resolved yet we keep `fee` and `net` null — the UI then
  // falls back to the "− protocol bps" placeholder rather than showing a
  // misleading 0% net. Move executes the same integer math on-chain: see
  // `withdraw_sui` in the project module.
  const feeMist =
    feeBps != null ? (amount * BigInt(feeBps)) / 10_000n : null;
  const netMist = feeMist != null ? amount - feeMist : null;

  // Pre-flight is "all green" only when every prerequisite the Move call
  // checks is satisfied. The first failure becomes the blocker we surface
  // at the bottom of the modal.
  const checks: Check[] = [
    {
      label: "You hold the ProjectAdminCap for this project",
      ok: true,
    },
    {
      label: finalized
        ? "Sale finalized · withdrawals unlocked"
        : "Sale must be finalized before SUI can be withdrawn",
      ok: finalized,
    },
    {
      label: treasuryHasBalance
        ? `Treasury holds ${formatSui(max)} SUI`
        : "Treasury is empty — nothing to withdraw",
      ok: treasuryHasBalance,
    },
    {
      label:
        amountValid || !treasuryHasBalance
          ? `Withdrawing ${formatSui(amount)} SUI`
          : "Enter an amount up to the treasury balance",
      ok: amountValid || !treasuryHasBalance,
    },
  ];

  const blocker = checks.find((c) => !c.ok);
  // Show a "Finalize first" affordance when finalization is the only thing
  // standing between the admin and a successful withdraw.
  const showFinalizeShortcut = !finalized && treasuryHasBalance;

  const fillPct = (p: number) => {
    const sui = maxSui * p;
    setInput(sui.toFixed(4));
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Withdraw SUI"
      className={state.kind === "success" ? undefined : "max-w-3xl"}
    >
      {state.kind === "success" && state.action === "withdraw" ? (
        <WithdrawSuccess
          amount={submittedAmount ?? amount}
          digest={state.digest}
          recipient={recipient}
          capId={cap.capId}
          feeBps={feeBps}
          onClose={onClose}
        />
      ) : (
        <div className="space-y-5 text-xs">
          <p className="text-[13px] leading-relaxed text-ink/65">
            Withdraws SUI from the project treasury. A platform fee is skimmed
            at execution; the remainder is transferred as a{" "}
            <code className="font-mono text-ink">Coin&lt;SUI&gt;</code> to your
            address.
          </p>

          {/* Two-column body — left rail holds the treasury + amount controls,
              right rail surfaces the payout breakdown + pre-flight checks. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
              {/* Treasury readout — the headline number, big and unambiguous */}
              <div className="border border-ink/20 bg-bone shadow-offset-sm">
                <div className="flex items-baseline justify-between border-b border-ink/15 px-4 py-2">
                  <MonoLabel className="text-[10px]">Treasury</MonoLabel>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em]",
                      finalized ? "text-jade" : "text-poppy",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "block h-1.5 w-1.5 rounded-full",
                        finalized ? "bg-jade" : "bg-poppy",
                      )}
                      style={
                        finalized
                          ? undefined
                          : {
                              animation:
                                "stat-live-dot 1.4s ease-in-out infinite",
                            }
                      }
                    />
                    {finalized ? "withdrawable" : "locked · sale live"}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-4 px-4 py-4">
                  <span className="font-display text-3xl leading-none tabular-nums text-ink md:text-[2.5rem]">
                    {formatSui(max)}
                    <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
                      SUI
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-ink/45">
                    cap {shortMid(cap.capId)}
                  </span>
                </div>
              </div>

              {/* Amount picker — input + slider + quick-fill chips */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <MonoLabel className="text-[10px]">
                    Amount to withdraw
                  </MonoLabel>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-ink/45">
                    {maxSui > 0
                      ? `${((Number(amount) / 1e9 / maxSui) * 100).toFixed(0)}% of treasury`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-stretch gap-2">
                  <div className="relative flex flex-1 items-center border border-ink/25 bg-bone focus-within:border-ink focus-within:shadow-offset-sm">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={input}
                      onChange={(e) =>
                        setInput(e.target.value.replace(/[^0-9.]/g, ""))
                      }
                      disabled={!treasuryHasBalance}
                      className="h-12 w-full bg-transparent px-3 font-mono tabular-nums text-base text-ink placeholder:text-ink/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="0.0000"
                    />
                    <span className="pr-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                      SUI
                    </span>
                  </div>
                  <div className="grid grid-cols-3">
                    {[0.25, 0.5, 1].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => fillPct(p)}
                        disabled={!treasuryHasBalance}
                        className={cn(
                          "h-12 border border-l-0 border-ink/25 px-3 font-mono-label text-[10px] text-ink/70 transition-all duration-200 ease-atelier first:border-l",
                          "hover:-translate-y-[1px] hover:border-ink hover:text-ink hover:shadow-offset-sm",
                          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none",
                        )}
                      >
                        {p === 1 ? "max" : `${p * 100}%`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Native range — minimal styling, just a thin track. */}
                <input
                  type="range"
                  min={0}
                  max={Number(max)}
                  step={Math.max(1, Math.floor(Number(max) / 1000) || 1)}
                  value={Number(amount)}
                  onChange={(e) => {
                    const m = BigInt(e.target.value || "0");
                    const sui = Number(m) / 1e9;
                    setInput(sui.toFixed(4));
                  }}
                  disabled={!treasuryHasBalance}
                  aria-label="Withdraw amount"
                  className="w-full accent-saffron disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>
            </div>

            <div className="space-y-4">
              {/* Payout breakdown — gross, fee note, net */}
              <div className="border border-ink/15">
                <div className="border-b border-ink/15 px-4 py-2">
                  <MonoLabel className="text-[10px]">Payout</MonoLabel>
                </div>
                <dl className="divide-y divide-ink/10 text-[12.5px]">
                  <BreakdownRow
                    k="Gross"
                    v={
                      <span className="font-mono tabular-nums text-ink">
                        {formatSui(amount)} SUI
                      </span>
                    }
                  />
                  <BreakdownRow
                    k="Platform fee"
                    hint={
                      feeBps != null
                        ? `${(feeBps / 100).toFixed(2)}% skimmed at execution`
                        : "skimmed by the protocol at execution"
                    }
                    v={
                      <span className="font-mono tabular-nums text-poppy">
                        {feeMist != null
                          ? `− ${formatSui(feeMist)} SUI`
                          : "− protocol bps"}
                      </span>
                    }
                  />
                  <BreakdownRow
                    k="You receive"
                    v={
                      <span className="font-mono tabular-nums text-ink">
                        {netMist != null
                          ? `${formatSui(netMist)} SUI`
                          : `≈ ${formatSui(amount)} SUI`}{" "}
                        <span className="text-ink/45">net</span>
                      </span>
                    }
                    strong
                  />
                  {recipient && (
                    <BreakdownRow
                      k="Recipient"
                      v={
                        <span className="font-mono tabular-nums text-ink/70">
                          {shortMid(recipient)}
                        </span>
                      }
                    />
                  )}
                </dl>
              </div>

              {/* Pre-flight — checks that mirror the Move call's assertions */}
              <div className="border border-ink/15">
                <div className="flex items-baseline justify-between border-b border-ink/15 px-4 py-2">
                  <MonoLabel className="text-[10px]">Pre-flight</MonoLabel>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.14em]",
                      blocker ? "text-poppy" : "text-jade",
                    )}
                  >
                    {blocker
                      ? `${checks.filter((c) => !c.ok).length} blocking`
                      : "all green"}
                  </span>
                </div>
                <ul className="divide-y divide-ink/10">
                  {checks.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-baseline gap-3 px-4 py-2.5"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center border font-mono text-[9px]",
                          c.ok
                            ? "border-jade/50 bg-jade/10 text-jade"
                            : "border-poppy/50 bg-poppy/10 text-poppy",
                        )}
                      >
                        {c.ok ? "✓" : "!"}
                      </span>
                      <span
                        className={cn(
                          "text-[12.5px]",
                          c.ok ? "text-ink/75" : "text-poppy",
                        )}
                      >
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {state.kind === "error" && state.action === "withdraw" && (
            <ErrorBanner message={state.message} />
          )}

          {/* Footer — when finalize is the only blocker, offer it inline so
              the admin can resolve the prerequisite without bouncing out. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-10 border border-ink bg-bone px-4 font-medium uppercase tracking-[0.12em] text-[0.72rem] text-ink shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              Cancel
            </button>
            {showFinalizeShortcut ? (
              <button
                type="button"
                onClick={onOpenFinalize}
                disabled={busy}
                className="h-10 border border-ink bg-poppy px-4 font-medium uppercase tracking-[0.12em] text-[0.72rem] text-bone shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finalize sale first →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSubmittedAmount(amount);
                  onSubmit(amount);
                }}
                disabled={busy || !!blocker}
                className="h-10 border border-ink bg-saffron px-4 font-medium uppercase tracking-[0.12em] text-[0.72rem] text-ink shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                {busy ? "Signing…" : "Sign & withdraw"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

type Check = { label: string; ok: boolean };

function BreakdownRow({
  k,
  v,
  hint,
  strong = false,
}: {
  k: string;
  v: React.ReactNode;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <span className="flex flex-col">
        <span
          className={cn(
            "font-mono-label text-[10px]",
            strong ? "text-ink" : "text-ink/55",
          )}
        >
          {k}
        </span>
        {hint && (
          <span className="font-mono text-[9.5px] text-ink/40">{hint}</span>
        )}
      </span>
      <span className={cn(strong && "font-medium")}>{v}</span>
    </div>
  );
}

function MetadataModal({
  project,
  cap,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (patch: {
    name?: string;
    descriptionBlobId?: string;
    iconUrl?: string;
    sourceCodeBlobId?: string;
    projectDetailsBlobId?: string;
  }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [descCid, setDescCid] = useState(project.descriptionBlobId);
  const [iconUrl, setIconUrl] = useState(project.iconUrl);
  const [sourceCid, setSourceCid] = useState(project.sourceCodeBlobId);
  const [detailsCid, setDetailsCid] = useState(project.projectDetailsBlobId);

  const dirty = {
    name: name !== project.name ? name : undefined,
    descriptionBlobId:
      descCid !== project.descriptionBlobId ? descCid : undefined,
    iconUrl: iconUrl !== project.iconUrl ? iconUrl : undefined,
    sourceCodeBlobId:
      sourceCid !== project.sourceCodeBlobId ? sourceCid : undefined,
    projectDetailsBlobId:
      detailsCid !== project.projectDetailsBlobId ? detailsCid : undefined,
  };
  const anyDirty = Object.values(dirty).some((v) => v !== undefined);

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Update metadata">
      {state.kind === "success" && state.action === "metadata" ? (
        <Success
          digest={state.digest}
          label="Metadata updated"
          body="MetadataUpdated event emitted. The project page will reflect the new fields within ~30s of cache revalidation."
        />
      ) : (
        <div className="space-y-3 text-xs">
          <p className="text-ink/55">
            Only edited fields are sent on-chain — unchanged inputs are passed
            as <code>Option::None</code> and won't trigger a write.
          </p>
          <MetaField label="Name" value={name} onChange={setName} />
          <MetaField
            label="Icon URL"
            value={iconUrl}
            onChange={setIconUrl}
            mono
          />
          <MetaField
            label="Description blob (IPFS CID)"
            value={descCid}
            onChange={setDescCid}
            mono
          />
          <MetaField
            label="Project details blob (IPFS CID)"
            value={detailsCid}
            onChange={setDetailsCid}
            mono
          />
          <MetaField
            label="Source code blob (IPFS CID)"
            value={sourceCid}
            onChange={setSourceCid}
            mono
          />
          <p className="font-mono text-[10px] text-ink/45">
            cap {shortMid(cap.capId)}
          </p>
          {state.kind === "error" && state.action === "metadata" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : "Sign & update"}
            onCancel={onClose}
            onConfirm={() => onSubmit(dirty)}
            disabled={!anyDirty}
          />
        </div>
      )}
    </Modal>
  );
}

function MetaField({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono-label text-[10px] text-ink/55">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 h-10 w-full border border-ink/25 bg-bone px-3 text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm",
          mono && "font-mono tabular-nums",
        )}
      />
    </label>
  );
}

function TransferModal({
  state,
  busy,
  onClose,
  onSubmit,
}: {
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (recipient: string) => void;
}) {
  const [addr, setAddr] = useState("");
  const valid = /^0x[0-9a-fA-F]{1,64}$/.test(addr.trim());

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Transfer project admin"
    >
      {state.kind === "success" && state.action === "transfer" ? (
        <Success
          digest={state.digest}
          label="Admin transferred"
          body="The recipient now holds the ProjectAdminCap. You can no longer perform admin actions on this project from this wallet."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Hands the AdminCap to another address. Common targets: a multisig, a
            DAO contract, a co-founder, or a backup wallet.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              Recipient address
            </span>
            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value.trim())}
              placeholder="0x…"
              className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
            />
            {addr && !valid && (
              <span className="mt-1 block font-mono text-[10px] text-poppy">
                Not a valid Sui address
              </span>
            )}
          </label>
          {state.kind === "error" && state.action === "transfer" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : "Sign & transfer"}
            onCancel={onClose}
            onConfirm={() => onSubmit(addr.trim())}
            disabled={!valid}
          />
        </div>
      )}
    </Modal>
  );
}

function ConfirmModal({
  title,
  body,
  confirm,
  danger = false,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  body: React.ReactNode;
  confirm: string;
  danger?: boolean;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={title}>
      {state.kind === "success" ? (
        <Success
          digest={state.digest}
          label={title}
          body="Transaction confirmed."
        />
      ) : (
        <div className="space-y-4 text-xs text-ink/65">
          {body}
          {state.kind === "error" && <ErrorBanner message={state.message} />}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : confirm}
            danger={danger}
            onCancel={onClose}
            onConfirm={onSubmit}
          />
        </div>
      )}
    </Modal>
  );
}

function Success({
  digest,
  label,
  body,
}: {
  digest: string;
  label: string;
  body: string;
}) {
  return (
    <div className="space-y-3 text-xs">
      <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
        <span className="font-mono-label text-[11px]">{label}</span>
        <p className="mt-1 text-ink/75">{body}</p>
      </div>
      <p className="break-all font-mono text-[11px] text-ink/55">
        digest · {digest}
      </p>
    </div>
  );
}

/**
 * Withdraw-specific success view. Replaces the generic `<Success>` pill for
 * the `withdraw_sui` flow because withdraw has unique post-tx data worth
 * surfacing: the actual SUI amount the admin pulled, where it landed, which
 * cap authorized it, and the digest you can paste into a block explorer.
 *
 * Exported so the `/dev/withdraw-success` route can preview it without
 * running a real transaction.
 */
export function WithdrawSuccess({
  amount,
  digest,
  recipient,
  capId,
  feeBps,
  onClose,
}: {
  amount: bigint;
  digest: string;
  recipient?: string;
  capId: string;
  /**
   * Live `Platform.fee_bps`. When provided, the receipt shows the actual
   * fee taken and the real net received. Null/undefined falls back to the
   * "− protocol bps" placeholder so we never quietly mislead the admin.
   */
  feeBps?: number | null;
  onClose?: () => void;
}) {
  const txUrl = explorerUrl("tx", digest);
  const recipientUrl = recipient ? explorerUrl("address", recipient) : null;
  // Same integer-math as the Move `withdraw_sui` entry: fee = gross * bps / 10_000.
  const feeMist =
    feeBps != null ? (amount * BigInt(feeBps)) / 10_000n : null;
  const netMist = feeMist != null ? amount - feeMist : null;
  const feePct = feeBps != null ? (feeBps / 100).toFixed(2) : null;

  return (
    <div className="space-y-4 text-xs">
      {/* ── Hero — big display number, jade-bordered ─────────────── */}
      <div className="border border-jade/35 bg-jade/[0.06]">
        <div className="flex items-center justify-between border-b border-jade/20 px-4 py-2.5">
          <span className="inline-flex items-center gap-2">
            <CheckBadge />
            <MonoLabel className="text-[10px]" accent="jade">
              SUI withdrawn
            </MonoLabel>
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-jade/80">
            on-chain · finalized
          </span>
        </div>
        <div className="px-4 py-5">
          {/* Display number = the real net received, not the gross. The
              gross is still surfaced in the receipt below; leading with
              gross here would misstate what actually landed in the wallet. */}
          <div className="font-display leading-none tabular-nums text-ink text-4xl md:text-[2.75rem]">
            {formatSui(netMist ?? amount)}
            <span className="ml-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink/45">
              SUI
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink/65">
            Landed in your address as a{" "}
            <code className="font-mono text-ink/80">Coin&lt;SUI&gt;</code>
            {feePct != null && feeBps != null && feeBps > 0 ? (
              <>
                {" "}
                after a{" "}
                <span className="font-mono text-ink">{feePct}%</span> protocol
                fee was skimmed from the {formatSui(amount)} SUI gross.
              </>
            ) : (
              <> (less the platform fee skimmed at execution).</>
            )}
          </p>
        </div>
      </div>

      {/* ── Receipt — spec sheet of the payout ─────────────────── */}
      <div className="border border-ink/15">
        <div className="border-b border-ink/15 px-4 py-2">
          <MonoLabel className="text-[10px]">Receipt</MonoLabel>
        </div>
        <dl className="divide-y divide-ink/10">
          <ReceiptRow
            k="Gross"
            v={`${formatSui(amount)} SUI`}
            hint="from project treasury"
          />
          <ReceiptRow
            k="Platform fee"
            v={
              feeMist != null ? (
                <span className="text-poppy">
                  − {formatSui(feeMist)} SUI
                </span>
              ) : (
                "− protocol bps"
              )
            }
            hint={
              feePct != null
                ? `${feePct}% skimmed at execution`
                : "skimmed at execution"
            }
            muted={feeMist == null}
          />
          <ReceiptRow
            k="You received"
            v={
              <>
                {netMist != null ? formatSui(netMist) : `≈ ${formatSui(amount)}`}{" "}
                SUI <span className="text-ink/45">net</span>
              </>
            }
            strong
          />
          {recipient && (
            <ReceiptRow
              k="Recipient"
              v={
                recipientUrl ? (
                  <a
                    href={recipientUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-offset-2 hover:underline"
                  >
                    {shortMid(recipient)}
                  </a>
                ) : (
                  shortMid(recipient)
                )
              }
              muted
            />
          )}
          <ReceiptRow
            k="Authorized by"
            v={`cap ${shortMid(capId)}`}
            muted
          />
        </dl>
      </div>

      {/* ── Digest + explorer link ─────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border border-ink/15 px-4 py-3">
        <div className="min-w-0 flex-1">
          <MonoLabel className="block text-[10px]">Transaction digest</MonoLabel>
          <span className="mt-1 block break-all font-mono text-[11px] text-ink/65">
            {digest}
          </span>
        </div>
        <a
          href={txUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 inline-flex items-center gap-1.5 font-mono-label text-[10px] text-jade underline-offset-2 hover:underline"
        >
          view on suiscan ↗
        </a>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      {onClose && (
        <div className="flex justify-end border-t border-ink/10 pt-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "h-10 px-5 border border-ink bg-bone shadow-offset-sm",
              "font-medium uppercase tracking-[0.12em] text-[0.72rem] text-ink",
              "transition-all duration-300 ease-atelier",
              "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
            )}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function ReceiptRow({
  k,
  v,
  hint,
  muted,
  strong,
}: {
  k: string;
  v: React.ReactNode;
  hint?: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <MonoLabel className="block text-[10px]">{k}</MonoLabel>
        {hint && (
          <span className="mt-0.5 block font-mono text-[10px] text-ink/40">
            {hint}
          </span>
        )}
      </div>
      <span
        className={cn(
          "font-mono tabular-nums text-[12.5px]",
          strong ? "text-ink" : muted ? "text-ink/55" : "text-ink/80",
        )}
      >
        {v}
      </span>
    </div>
  );
}

function CheckBadge() {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 items-center justify-center border border-jade/55 bg-jade/15 text-jade"
    >
      <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
        <path
          d="M2 6.5 L5 9 L10 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
    >
      {message}
    </p>
  );
}

function ModalFooter({
  busy,
  primaryLabel,
  onCancel,
  onConfirm,
  disabled = false,
  danger = false,
}: {
  busy: boolean;
  primaryLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const FOOTER_CTA =
    "h-10 px-4 inline-flex items-center justify-center gap-2 border border-ink shadow-offset-sm font-medium uppercase tracking-[0.12em] text-[0.72rem] transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0";
  return (
    <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className={cn(FOOTER_CTA, "bg-bone text-ink")}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={cn(
          FOOTER_CTA,
          danger ? "bg-poppy text-bone border-poppy" : "bg-saffron text-ink",
        )}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

function SummaryRow({
  k,
  v,
  hint,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink/10 pb-2 last:border-b-0">
      <span className="font-mono-label text-[10px] text-ink/55">
        {k}
        {hint && <span className="ml-1 text-ink/35">· {hint}</span>}
      </span>
      <span
        className={cn(
          "text-sm",
          mono ? "font-mono tabular-nums text-ink/80" : "text-ink",
        )}
      >
        {v}
      </span>
    </div>
  );
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function shortCoin(typeStr: string): string {
  if (!typeStr) return "TOK";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "TOK";
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
