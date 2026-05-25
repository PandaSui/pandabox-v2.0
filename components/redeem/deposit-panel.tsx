"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { ArrowDiag } from "@pandasui/ui";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Spinner } from "@/components/primitives/spinner";
import { SuiAmount } from "@/components/identity/sui-amount";
import {
  buildDepositReserveTx,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import { MIST_PER_SUI } from "@/lib/sui";
import { formatAmount } from "@/lib/amount";
import type { HydratedPool } from "@/lib/redeem/discovery";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirming"; digest: string }
  | { kind: "success"; digest: string; amountMist: bigint }
  | { kind: "error"; message: string };

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-11 px-5 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

/**
 * Compact reserve-top-up panel — sits beneath the activity feed on the
 * pool detail page. Calls `pool::deposit_reserve<T>` to push more SUI
 * into the reserve, growing the pool's redeem capacity without touching
 * any of its permanent terms.
 *
 * UX-wise we treat it as a secondary action (the page's primary is
 * Redeem) — outlined CTA, smaller chrome, lives below the fold. Any
 * wallet can deposit; we don't gate on "are you the creator".
 */
export function DepositPanel({ data }: { data: HydratedPool }) {
  const { pool, metadata } = data;
  const symbol = metadata.symbol;
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const { data: balance } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address },
  );

  const spendableMist = useMemo(
    () => (balance?.totalBalance ? BigInt(balance.totalBalance) : 0n),
    [balance],
  );

  const amountMist = useMemo(() => {
    const v = amount.trim();
    if (!v) return 0n;
    const bn = new BigNumber(v);
    if (!bn.isFinite() || bn.lte(0)) return 0n;
    const raw = bn.multipliedBy(MIST_PER_SUI.toString());
    if (!raw.isFinite() || raw.lte(0)) return 0n;
    return BigInt(raw.integerValue(BigNumber.ROUND_DOWN).toFixed(0));
  }, [amount]);

  const validation = useMemo(() => {
    if (!account) return null;
    if (amountMist === 0n) return null;
    if (amountMist > spendableMist) return "Amount exceeds your SUI balance";
    return null;
  }, [account, amountMist, spendableMist]);

  const submittable = !!account && !validation && amountMist > 0n;
  const isPanelBusy = state.kind === "submitting" || state.kind === "confirming";

  const onSubmit = async () => {
    if (!account || !submittable) return;
    setState({ kind: "submitting" });
    try {
      if (!REDEEM_IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 700));
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
          amountMist,
        });
        return;
      }
      const tx = buildDepositReserveTx({
        coinType: pool.coinType,
        poolId: pool.objectId,
        amountMist,
      });
      const result = await signAndExecute({ transaction: tx });
      setState({ kind: "confirming", digest: result.digest });
      void client
        .waitForTransaction({ digest: result.digest })
        .then(() => {
          setState({ kind: "success", digest: result.digest, amountMist });
          router.refresh();
        })
        .catch(() => {
          setState({ kind: "success", digest: result.digest, amountMist });
        });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Deposit failed.",
      });
    }
  };

  return (
    <section className="border border-ink/15 bg-bone">
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">Top up reserve</MonoLabel>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          anyone can deposit
        </span>
      </header>

      <div className="space-y-4 px-5 py-5">
        <p className="text-[13.5px] leading-relaxed text-ink/65">
          Add more SUI to the pool's reserve so it can honour additional
          redeems. The pool's exchange rate and recipient don't change —
          only the depth.
        </p>

        {state.kind === "success" ? (
          <div className="border border-jade/40 bg-jade/[0.06] px-4 py-3">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jade">
              <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
              Deposit signed
            </div>
            <p className="mt-2 text-[13px]">
              <SuiAmount
                mist={state.amountMist}
                maxFractionDigits={4}
                glyphSize={11}
                className="text-ink"
              />{" "}
              added to the reserve.
            </p>
            <button
              type="button"
              onClick={() => {
                setAmount("");
                setState({ kind: "idle" });
              }}
              className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55 transition-colors hover:text-ink"
            >
              Deposit again →
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
              <span>Your SUI balance</span>
              <span className="text-ink">
                {account
                  ? formatAmount(spendableMist, {
                      decimals: 9,
                      compact: true,
                      maxFractionDigits: 4,
                    }) + " SUI"
                  : "—"}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-3 border border-ink/25 bg-bone px-3 transition-colors",
                "focus-within:border-ink focus-within:shadow-offset-sm",
                isPanelBusy && "opacity-60",
              )}
            >
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  !isPanelBusy && setAmount(sanitize(e.target.value))
                }
                placeholder="0.00"
                disabled={isPanelBusy}
                className="h-12 w-full bg-transparent font-mono text-xl tabular-nums text-ink outline-none placeholder:text-ink/30"
                aria-label="Amount of SUI to deposit"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                SUI
              </span>
            </div>

            {validation && (
              <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-poppy">
                {validation}
              </p>
            )}

            {state.kind === "error" && (
              <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy">
                {state.message}
              </p>
            )}

            {account ? (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!submittable || isPanelBusy}
                className={cn(CTA_BASE, "bg-bone text-ink")}
              >
                {isPanelBusy ? (
                  <>
                    <Spinner size={13} className="text-ink/70" />
                    <span>
                      {state.kind === "submitting" ? "Sign in wallet…" : "Confirming…"}
                    </span>
                  </>
                ) : submittable ? (
                  <>
                    <span>
                      Deposit {formatAmount(amountMist, { decimals: 9, compact: true, maxFractionDigits: 4 })} SUI
                    </span>
                    <ArrowDiag size={11} />
                  </>
                ) : (
                  <span>{validation ?? "Enter an amount"}</span>
                )}
              </button>
            ) : (
              <ConnectWallet />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function sanitize(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot >= 0) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}
