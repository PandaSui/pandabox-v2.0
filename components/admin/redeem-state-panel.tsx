"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import {
  buildPlatformPauseTx,
  buildPlatformUnpauseTx,
  buildPlatformSetTreasuryAddressTx,
  buildPlatformUpdateFeeBpsTx,
  buildPlatformWithdrawFeesTx,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import type { RedeemPlatformState } from "@/lib/redeem/types";
import { formatBps, formatRelative, formatSui } from "@/lib/admin/format";
import { useProtocolAdmin } from "./admin-context";
import { useAdminTx } from "./use-admin-tx";
import { ADMIN_CTA } from "./shared";
import { FeeModal, TreasuryModal, WithdrawModal, ConfirmModal } from "./modals";

const ACCENT = "sun" as const;

type Action = "pause" | "fee" | "treasury" | "withdraw";

/**
 * Redeem platform controls — pause/unpause, fee bps, treasury, and fee
 * withdrawal. Mirrors the Pandabox panel structure on the `sun` accent
 * (surplus / cash-out value), driven by the shared `useAdminTx` machine and
 * the protocol-agnostic action modals. Cap-transfer / renounce live in the
 * separate <AdminCapCard>.
 */
export function RedeemStatePanel({ stats }: { stats: RedeemPlatformState }) {
  const router = useRouter();
  const { capId } = useProtocolAdmin("redeem");
  const { state: tx, busy, run, reset } = useAdminTx<Action>({
    deployed: REDEEM_IS_DEPLOYED,
  });
  const [open, setOpen] = useState<Action | null>(null);

  return (
    <section className="border border-ink bg-bone shadow-offset-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              stats.paused ? "bg-poppy" : "bg-sun",
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
          {stats.paused ? "paused" : "live"}
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
          value={`${formatSui(stats.feeTreasuryMist)} SUI`}
          border
        />
        <Stat
          label="Total pools"
          value={stats.totalPools.toLocaleString()}
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
            reset();
            if (stats.paused) {
              void run("pause", () =>
                buildPlatformUnpauseTx({ platformAdminCapId: capId }),
              );
            } else {
              setOpen("pause");
            }
          }}
          disabled={busy}
          className={cn(
            ADMIN_CTA,
            stats.paused
              ? "bg-jade text-bone border-jade"
              : "bg-bone text-poppy border-poppy",
          )}
        >
          {tx.kind === "submitting" && tx.action === "pause" ? (
            <span>Signing…</span>
          ) : stats.paused ? (
            <>
              <span>Unpause redemptions</span>
              <ArrowDiag size={12} />
            </>
          ) : (
            <span>Pause redemptions</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen("fee");
          }}
          disabled={busy}
          className={cn(ADMIN_CTA, "bg-bone text-ink")}
        >
          <span>Update fee bps</span>
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen("treasury");
          }}
          disabled={busy}
          className={cn(ADMIN_CTA, "bg-bone text-ink")}
        >
          <span>Set treasury address</span>
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen("withdraw");
          }}
          disabled={busy || stats.feeTreasuryMist === 0n}
          className={cn(ADMIN_CTA, "bg-sun text-ink")}
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
          accent={ACCENT}
          title="Pause redemptions"
          body={
            <p>
              Pauses redemptions across <em>every</em> Redeem pool until you
              unpause. Reserve deposits and pool reads are unaffected.
            </p>
          }
          confirm="Pause"
          state={tx}
          busy={busy}
          danger
          onClose={() => setOpen(null)}
          onSubmit={() =>
            run("pause", () =>
              buildPlatformPauseTx({ platformAdminCapId: capId }),
            )
          }
        />
      )}

      {open === "fee" && (
        <FeeModal
          accent={ACCENT}
          currentBps={stats.feeBps}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(newBps) =>
            run("fee", () =>
              buildPlatformUpdateFeeBpsTx({ platformAdminCapId: capId, newBps }),
            )
          }
        />
      )}

      {open === "treasury" && (
        <TreasuryModal
          accent={ACCENT}
          currentAddress={stats.treasuryAddress}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(addr) =>
            run("treasury", () =>
              buildPlatformSetTreasuryAddressTx({
                platformAdminCapId: capId,
                newAddress: addr,
              }),
            )
          }
        />
      )}

      {open === "withdraw" && (
        <WithdrawModal
          accent={ACCENT}
          treasuryAddress={stats.treasuryAddress}
          maxMist={stats.feeTreasuryMist}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(amountMist) =>
            run("withdraw", () =>
              buildPlatformWithdrawFeesTx({
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
      {hint && <div className="mt-1 font-mono text-[10px] text-ink/45">{hint}</div>}
    </div>
  );
}
