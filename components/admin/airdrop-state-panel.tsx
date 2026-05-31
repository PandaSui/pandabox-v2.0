"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import {
  buildAirdropPauseTx,
  buildAirdropUnpauseTx,
  buildAirdropUpdateFeeTx,
  buildAirdropUpdateMaxRecipientsTx,
  buildAirdropSetTreasuryTx,
  buildAirdropWithdrawFeesTx,
  AIRDROP_IS_DEPLOYED,
} from "@/lib/contracts/airdrop";
import type { AirdropPlatformState } from "@/lib/airdrop/types";
import { formatRelative, formatSui } from "@/lib/admin/format";
import { useProtocolAdmin } from "./admin-context";
import { useAdminTx } from "./use-admin-tx";
import { ADMIN_CTA } from "./shared";
import {
  FlatFeeModal,
  MaxRecipientsModal,
  TreasuryModal,
  WithdrawModal,
  ConfirmModal,
} from "./modals";

const ACCENT = "jade" as const;

type Action = "pause" | "fee" | "max" | "treasury" | "withdraw";

/**
 * Airdrop platform controls — pause/unpause, the flat per-recipient SUI fee,
 * the max-recipients ceiling, treasury, and fee withdrawal. On the `jade`
 * accent (community / distribution). Every platform-touching builder needs the
 * shared object's `initial_shared_version`, which the reader surfaces on
 * `stats.initialSharedVersion`.
 */
export function AirdropStatePanel({ stats }: { stats: AirdropPlatformState }) {
  const router = useRouter();
  const { capId } = useProtocolAdmin("airdrop");
  const { state: tx, busy, run, reset } = useAdminTx<Action>({
    deployed: AIRDROP_IS_DEPLOYED,
  });
  const [open, setOpen] = useState<Action | null>(null);

  const isv = stats.initialSharedVersion;

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
          {stats.paused ? "paused" : "live"}
        </span>
      </header>

      <dl className="grid grid-cols-2 border-b border-ink/15 md:grid-cols-4">
        <Stat
          label="Fee / recipient"
          value={`${formatSui(stats.feePerRecipientMist)} SUI`}
        />
        <Stat
          label="Accumulated fees"
          value={`${formatSui(stats.feeTreasuryMist)} SUI`}
          border
        />
        <Stat
          label="Max recipients"
          value={stats.maxRecipients.toLocaleString()}
          border
        />
        <Stat
          label="Total airdrops"
          value={stats.totalAirdrops.toLocaleString()}
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
                buildAirdropUnpauseTx({
                  airdropAdminCapId: capId,
                  platformInitialSharedVersion: isv,
                }),
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
              <span>Unpause airdrops</span>
              <ArrowDiag size={12} />
            </>
          ) : (
            <span>Pause airdrops</span>
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
          <span>Update fee</span>
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen("max");
          }}
          disabled={busy}
          className={cn(ADMIN_CTA, "bg-bone text-ink")}
        >
          <span>Update max recipients</span>
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
          className={cn(ADMIN_CTA, "bg-jade text-bone border-jade")}
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
          title="Pause airdrops"
          body={
            <p>
              Pauses <em>all</em> airdrop distributions platform-wide until you
              unpause. In-flight transactions already signed are unaffected.
            </p>
          }
          confirm="Pause"
          state={tx}
          busy={busy}
          danger
          onClose={() => setOpen(null)}
          onSubmit={() =>
            run("pause", () =>
              buildAirdropPauseTx({
                airdropAdminCapId: capId,
                platformInitialSharedVersion: isv,
              }),
            )
          }
        />
      )}

      {open === "fee" && (
        <FlatFeeModal
          accent={ACCENT}
          currentMist={stats.feePerRecipientMist}
          unitLabel="per recipient"
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(newFeeMist) =>
            run("fee", () =>
              buildAirdropUpdateFeeTx({
                airdropAdminCapId: capId,
                platformInitialSharedVersion: isv,
                newFeeMist,
              }),
            )
          }
        />
      )}

      {open === "max" && (
        <MaxRecipientsModal
          accent={ACCENT}
          currentMax={stats.maxRecipients}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(newMax) =>
            run("max", () =>
              buildAirdropUpdateMaxRecipientsTx({
                airdropAdminCapId: capId,
                platformInitialSharedVersion: isv,
                newMax,
              }),
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
              buildAirdropSetTreasuryTx({
                airdropAdminCapId: capId,
                platformInitialSharedVersion: isv,
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
              buildAirdropWithdrawFeesTx({
                airdropAdminCapId: capId,
                platformInitialSharedVersion: isv,
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
  border = false,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div className={cn("p-4 md:p-5", border && "md:border-l md:border-ink/15")}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1 font-mono tabular-nums text-lg">{value}</div>
    </div>
  );
}
