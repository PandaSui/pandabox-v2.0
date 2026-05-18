"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import {
  buildPlatformPauseTx,
  buildPlatformUnpauseTx,
  buildSetTreasuryAddressTx,
  buildUpdateFeeBpsTx,
  buildWithdrawPlatformFeesTx,
  IS_DEPLOYED,
} from "@/lib/contracts/pandabox";
import type { PlatformStats } from "@/lib/platform";
import { useAdmin } from "./admin-gate";

const ACTION_CTA =
  "group relative inline-flex items-center justify-center gap-2 h-10 px-4 font-medium uppercase tracking-[0.12em] text-[0.72rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

const MIST = 1_000_000_000n;
const MAX_FEE_BPS = 10_000;

type Action = "pause" | "fee" | "treasury" | "withdraw";

type TxState =
  | { kind: "idle" }
  | { kind: "submitting"; action: Action }
  | { kind: "success"; action: Action; digest: string }
  | { kind: "error"; action: Action; message: string };

/**
 * Platform-wide controls — pause/unpause, fee bps, treasury address, and the
 * fee withdrawal flow. Consumes `PlatformStats` from the server-side reader
 * so the UI always reflects on-chain state at first paint; after a successful
 * tx we call `router.refresh()` so Next re-renders the server component
 * against the latest chain state.
 */
export function PlatformStatePanel({ stats }: { stats: PlatformStats }) {
  const router = useRouter();
  const client = useSuiClient();
  const { capId } = useAdmin();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [open, setOpen] = useState<Action | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const busy = tx.kind === "submitting";

  const execute = async <T,>(
    action: Action,
    build: () => Parameters<typeof signAndExecute>[0]["transaction"],
  ): Promise<T | undefined> => {
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
      const result = await signAndExecute({ transaction: build() });
      setTx({ kind: "success", action, digest: result.digest });
      // Re-fetch the server-rendered Platform stats once the tx is indexed.
      await client.waitForTransaction({ digest: result.digest });
      router.refresh();
      return undefined;
    } catch (err) {
      setTx({
        kind: "error",
        action,
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
      return undefined;
    }
  };

  return (
    <section className="border border-ink bg-bone shadow-offset-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              stats.paused ? "bg-poppy" : "bg-jade",
            )}
            style={
              !stats.paused
                ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
                : undefined
            }
          />
          <MonoLabel className="text-[10px]">Platform state</MonoLabel>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
          {stats.paused ? "paused" : "live"} · {stats.network}
        </span>
      </header>

      <dl className="grid grid-cols-1 border-b border-ink/15 md:grid-cols-3">
        <Stat
          label="Fee"
          value={`${formatBps(stats.feeBps)}%`}
          hint={`${stats.feeBps} bps`}
        />
        <Stat
          label="Accumulated fees"
          value={`${formatSui(BigInt(stats.feeTreasuryMist))} SUI`}
          border
        />
        <Stat
          label="Total projects"
          value={stats.totalProjects.toLocaleString()}
          border
        />
      </dl>

      <div className="border-b border-ink/15 px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <MonoLabel className="block text-[10px]">Treasury address</MonoLabel>
          <Address value={stats.treasuryAddress} link className="text-[12px]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-ink/15 px-5 py-4">
        <button
          type="button"
          onClick={() => {
            setTx({ kind: "idle" });
            if (stats.paused) {
              void execute("pause", () =>
                buildPlatformUnpauseTx({ platformAdminCapId: capId }),
              );
            } else {
              setOpen("pause");
            }
          }}
          disabled={busy}
          className={cn(
            ACTION_CTA,
            stats.paused
              ? "bg-jade text-bone border-jade"
              : "bg-bone text-poppy border-poppy",
          )}
        >
          {tx.kind === "submitting" && tx.action === "pause" ? (
            <span>Signing…</span>
          ) : stats.paused ? (
            <>
              <span>Unpause launchpad</span>
              <ArrowDiag size={12} />
            </>
          ) : (
            <span>Pause launchpad</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setTx({ kind: "idle" });
            setOpen("fee");
          }}
          disabled={busy}
          className={cn(ACTION_CTA, "bg-bone text-ink")}
        >
          <span>Update fee bps</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTx({ kind: "idle" });
            setOpen("treasury");
          }}
          disabled={busy}
          className={cn(ACTION_CTA, "bg-bone text-ink")}
        >
          <span>Set treasury address</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTx({ kind: "idle" });
            setOpen("withdraw");
          }}
          disabled={busy || BigInt(stats.feeTreasuryMist) === 0n}
          className={cn(ACTION_CTA, "bg-saffron text-ink")}
        >
          <span>Withdraw fees</span>
          <ArrowDiag size={12} />
        </button>
      </div>

      <footer className="flex items-baseline justify-between px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        <span>last read · {formatRelative(stats.fetchedAt)}</span>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="hover:text-ink"
        >
          refresh
        </button>
      </footer>

      {open === "pause" && (
        <ConfirmModal
          title="Pause launchpad"
          body={
            <p>
              Pauses all new contributions across <em>every</em> project on
              Pandabox until you unpause. Existing receipts can still be
              claimed once their projects finalize.
            </p>
          }
          confirm="Pause"
          state={tx}
          busy={busy}
          danger
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("pause", () =>
              buildPlatformPauseTx({ platformAdminCapId: capId }),
            )
          }
        />
      )}

      {open === "fee" && (
        <FeeModal
          currentBps={stats.feeBps}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(newBps) =>
            execute("fee", () =>
              buildUpdateFeeBpsTx({ platformAdminCapId: capId, newBps }),
            )
          }
        />
      )}

      {open === "treasury" && (
        <TreasuryModal
          currentAddress={stats.treasuryAddress}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(addr) =>
            execute("treasury", () =>
              buildSetTreasuryAddressTx({
                platformAdminCapId: capId,
                newAddress: addr,
              }),
            )
          }
        />
      )}

      {open === "withdraw" && (
        <WithdrawModal
          treasuryAddress={stats.treasuryAddress}
          maxMist={BigInt(stats.feeTreasuryMist)}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(amountMist) =>
            execute("withdraw", () =>
              buildWithdrawPlatformFeesTx({
                platformAdminCapId: capId,
                amountMist,
              }),
            )
          }
        />
      )}
    </section>
  );
}

/* ─────────────────────── Modals ─────────────────────── */

function FeeModal({
  currentBps,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  currentBps: number;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (bps: number) => void;
}) {
  const [input, setInput] = useState(String(currentBps));
  const parsed = Number(input);
  const valid =
    Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_FEE_BPS;
  const pct = valid ? formatBps(parsed) : "—";

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Update platform fee">
      {state.kind === "success" && state.action === "fee" ? (
        <Success
          digest={state.digest}
          label="Fee updated"
          body="The new fee_bps takes effect immediately on the next contribute / withdraw call."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Fee is expressed in basis points (1/100 of a percent). 100 bps =
            1%. Max enforceable by the contract is{" "}
            <code className="font-mono">{MAX_FEE_BPS}</code> (= 100%).
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              New fee_bps
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) =>
                  setInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="h-11 flex-1 border border-ink/25 bg-bone px-3 font-mono tabular-nums text-base focus:border-ink focus:outline-none focus:shadow-offset-sm"
                placeholder="e.g. 250 = 2.5%"
              />
              <span className="font-mono-label text-[10px] text-ink/55">
                = {pct}%
              </span>
            </div>
            <span className="mt-1 block font-mono text-[10px] text-ink/45">
              current · {currentBps} bps ({formatBps(currentBps)}%)
            </span>
          </label>
          {state.kind === "error" && state.action === "fee" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primary={busy ? "Signing…" : "Sign & update"}
            disabled={!valid || parsed === currentBps}
            onCancel={onClose}
            onConfirm={() => onSubmit(parsed)}
          />
        </div>
      )}
    </Modal>
  );
}

function TreasuryModal({
  currentAddress,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  currentAddress: string;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (addr: string) => void;
}) {
  const [addr, setAddr] = useState("");
  const trimmed = addr.trim();
  const valid =
    /^0x[0-9a-fA-F]{1,64}$/.test(trimmed) && trimmed !== currentAddress;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Set treasury address"
    >
      {state.kind === "success" && state.action === "treasury" ? (
        <Success
          digest={state.digest}
          label="Treasury address updated"
          body="Future withdraw_platform_fees calls route SUI to this address."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            All future <code className="font-mono">withdraw_platform_fees</code>{" "}
            calls send SUI to this address. Pre-existing fees in the platform
            balance aren't redirected retroactively — they go wherever you
            withdraw them <em>to</em> next.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              New treasury address
            </span>
            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value.trim())}
              placeholder="0x…"
              className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
            />
            <span className="mt-1 block font-mono text-[10px] text-ink/45 break-all">
              current · {currentAddress}
            </span>
          </label>
          {state.kind === "error" && state.action === "treasury" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primary={busy ? "Signing…" : "Sign & set"}
            disabled={!valid}
            onCancel={onClose}
            onConfirm={() => onSubmit(trimmed)}
          />
        </div>
      )}
    </Modal>
  );
}

function WithdrawModal({
  treasuryAddress,
  maxMist,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  treasuryAddress: string;
  maxMist: bigint;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (amountMist: bigint) => void;
}) {
  const maxSui = Number(maxMist) / 1e9;
  const [input, setInput] = useState(maxSui.toFixed(4));
  const bn = new BigNumber(input || "0");
  const amountMist = bn.isFinite() && bn.gt(0)
    ? clamp(
        BigInt(bn.multipliedBy(1e9).integerValue(BigNumber.ROUND_DOWN).toFixed(0)),
        maxMist,
      )
    : 0n;
  const valid = amountMist > 0n;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Withdraw platform fees"
    >
      {state.kind === "success" && state.action === "withdraw" ? (
        <Success
          digest={state.digest}
          label="Fees withdrawn"
          body="The amount has been transferred to the platform treasury address."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Transfers SUI from the platform's fee balance to{" "}
            <strong>this platform's treasury address</strong> (not an arbitrary
            recipient — to redirect, run "Set treasury address" first). Caller
            pays gas.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              Amount (SUI)
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) =>
                  setInput(e.target.value.replace(/[^0-9.]/g, ""))
                }
                className="h-11 flex-1 border border-ink/25 bg-bone px-3 font-mono tabular-nums text-base focus:border-ink focus:outline-none focus:shadow-offset-sm"
              />
              <button
                type="button"
                onClick={() => setInput(maxSui.toFixed(4))}
                className="h-11 border border-ink/25 px-3 font-mono-label text-[10px] hover:border-ink"
              >
                max
              </button>
            </div>
            <span className="mt-1 block font-mono text-[10px] text-ink/45">
              available · {formatSui(maxMist)} SUI · recipient {shortMid(treasuryAddress)}
            </span>
          </label>
          {state.kind === "error" && state.action === "withdraw" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primary={busy ? "Signing…" : "Sign & withdraw"}
            disabled={!valid}
            onCancel={onClose}
            onConfirm={() => onSubmit(amountMist)}
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
  danger,
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
        <Success digest={state.digest} label={title} body="Transaction confirmed." />
      ) : (
        <div className="space-y-4 text-xs text-ink/65">
          {body}
          {state.kind === "error" && <ErrorBanner message={state.message} />}
          <ModalFooter
            busy={busy}
            primary={busy ? "Signing…" : confirm}
            danger={danger}
            onCancel={onClose}
            onConfirm={onSubmit}
          />
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────── Small UI helpers ─────────────────────── */

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
  primary,
  onCancel,
  onConfirm,
  danger = false,
  disabled = false,
}: {
  busy: boolean;
  primary: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className={cn(ACTION_CTA, "bg-bone text-ink")}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={cn(
          ACTION_CTA,
          danger ? "bg-poppy text-bone border-poppy" : "bg-saffron text-ink",
        )}
      >
        {primary}
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  border = false,
}: {
  label: string;
  value: string;
  hint?: string;
  border?: boolean;
}) {
  return (
    <div className={cn("p-4 md:p-5", border && "md:border-l md:border-ink/15")}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1 font-mono tabular-nums text-xl">{value}</div>
      {hint && (
        <div className="mt-1 font-mono text-[10px] text-ink/45">{hint}</div>
      )}
    </div>
  );
}

function clamp(v: bigint, max: bigint): bigint {
  return v > max ? max : v;
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2);
}

function formatSui(mist: bigint): string {
  const n = Number(mist) / 1e9;
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(4);
  if (n === 0) return "0";
  return n.toFixed(6);
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}
