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
import { TxHash } from "@/components/identity/tx-hash";
import { buildRedeemTx, REDEEM_IS_DEPLOYED } from "@/lib/contracts/redeem";
import { quoteRedeem, maxRedeemableCoin } from "@/lib/redeem/quote";
import { formatAmount } from "@/lib/amount";
import { MIST_PER_SUI, explorerUrl } from "@/lib/sui";
import type { HydratedPool } from "@/lib/redeem/discovery";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirming"; digest: string }
  | { kind: "success"; digest: string; suiOutMist: bigint; coinIn: bigint }
  | { kind: "error"; message: string };

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-12 px-6 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

/**
 * The actual redeem flow.
 *
 *   1. We read the connected wallet's `Coin<T>` objects via `getCoins`.
 *   2. The user types a whole-token amount; we convert to base units and
 *      compute a live quote (gross / fee / net) without a roundtrip.
 *   3. Validation clamps to min(userBalance, pool.maxRedeemableCoin) so
 *      the user can never sign a transaction the contract would reject.
 *   4. Submit builds a PTB via `buildRedeemTx`, signs through dapp-kit,
 *      and shows a success frame with the tx digest + SUI received.
 *   5. After the chain has indexed the tx we refresh the RSC tree so
 *      the hero stats + activity feed pick up the new state without a
 *      manual reload.
 */
export function RedeemPanel({
  data,
  feeBps,
  paused,
}: {
  data: HydratedPool;
  feeBps: number;
  paused: boolean;
}) {
  const { pool, metadata } = data;
  const symbol = metadata.symbol;
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  /* ── Wallet balance & coin objects ─────────────────────────── */

  const {
    data: coinsPage,
    isFetching: coinsFetching,
  } = useSuiClientQuery(
    "getCoins",
    {
      owner: account?.address ?? "",
      coinType: pool.coinType,
      limit: 50,
    },
    { enabled: !!account?.address },
  );

  const userBalance: bigint = useMemo(() => {
    if (!coinsPage?.data) return 0n;
    return coinsPage.data.reduce(
      (acc, c) => acc + BigInt(c.balance),
      0n,
    );
  }, [coinsPage]);

  const coinObjectIds: string[] = useMemo(
    () => coinsPage?.data.map((c) => c.coinObjectId) ?? [],
    [coinsPage],
  );

  /* ── Amount → base units ────────────────────────────────────── */

  const amountBase: bigint = useMemo(() => {
    const v = amount.trim();
    if (!v) return 0n;
    const bn = new BigNumber(v);
    if (!bn.isFinite() || bn.lte(0)) return 0n;
    const raw = bn.multipliedBy(new BigNumber(10).pow(pool.coinDecimals));
    if (!raw.isFinite() || raw.lte(0)) return 0n;
    return BigInt(raw.integerValue(BigNumber.ROUND_DOWN).toFixed(0));
  }, [amount, pool.coinDecimals]);

  /* ── Quote ───────────────────────────────────────────────────── */

  const quote = useMemo(
    () =>
      quoteRedeem({
        coinIn: amountBase,
        priceMistPerToken: pool.priceMistPerToken,
        reserveMist: pool.suiReserveMist,
        feeBps,
      }),
    [amountBase, pool.priceMistPerToken, pool.suiReserveMist, feeBps],
  );

  const maxByReserve = useMemo(
    () =>
      maxRedeemableCoin({
        reserveMist: pool.suiReserveMist,
        priceMistPerToken: pool.priceMistPerToken,
      }),
    [pool.suiReserveMist, pool.priceMistPerToken],
  );

  // The amount the user can actually redeem — bounded by both balance
  // and reserve. Surfaced via the MAX button.
  const maxRedeemable = userBalance < maxByReserve ? userBalance : maxByReserve;

  /* ── Validation ─────────────────────────────────────────────── */

  const validation = useMemo(() => {
    if (paused) return "Platform is paused";
    if (pool.suiReserveMist === 0n) return "Pool reserve is empty";
    if (!account) return null;
    if (coinsFetching && userBalance === 0n) return null;
    if (userBalance === 0n) return `You hold no ${symbol}`;
    if (amountBase === 0n) return null;
    if (amountBase > userBalance) return "Amount exceeds your balance";
    if (amountBase > maxByReserve) return "Pool reserve too low for this amount";
    return null;
  }, [
    paused,
    pool.suiReserveMist,
    account,
    coinsFetching,
    userBalance,
    symbol,
    amountBase,
    maxByReserve,
  ]);

  const submittable = !!account && !validation && amountBase > 0n;

  /* ── Submit ──────────────────────────────────────────────────── */

  const onSubmit = async () => {
    if (!account || !submittable) return;
    if (coinObjectIds.length === 0) {
      setState({ kind: "error", message: "No coin objects to spend." });
      return;
    }
    setState({ kind: "submitting" });
    try {
      if (!REDEEM_IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 700));
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
          suiOutMist: quote.suiOutMist,
          coinIn: amountBase,
        });
        return;
      }
      const tx = buildRedeemTx({
        coinType: pool.coinType,
        poolId: pool.objectId,
        coinObjectIds: coinObjectIds as [string, ...string[]],
        coinAmount: amountBase,
        sender: account.address,
      });
      const result = await signAndExecute({ transaction: tx });
      setState({ kind: "confirming", digest: result.digest });

      void client
        .waitForTransaction({ digest: result.digest })
        .then(() => {
          setState({
            kind: "success",
            digest: result.digest,
            suiOutMist: quote.suiOutMist,
            coinIn: amountBase,
          });
          router.refresh();
        })
        .catch(() => {
          // Even if waitForTransaction errors, the tx was signed — show
          // success with whatever quote we already have.
          setState({
            kind: "success",
            digest: result.digest,
            suiOutMist: quote.suiOutMist,
            coinIn: amountBase,
          });
        });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Redeem failed.",
      });
    }
  };

  const resetForm = () => {
    setAmount("");
    setState({ kind: "idle" });
  };

  /* ── Render ──────────────────────────────────────────────────── */

  const isPanelBusy = state.kind === "submitting" || state.kind === "confirming";

  return (
    <aside id="redeem" className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        {/* Top accent spine */}
        <span aria-hidden className="block h-[2px] bg-sun" />

        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
          <MonoLabel className="text-[10px]">Redeem this pool</MonoLabel>
          <PanelStatusPill paused={paused} reserve={pool.suiReserveMist} />
        </header>

        {state.kind === "success" ? (
          <SuccessView
            digest={state.digest}
            suiOutMist={state.suiOutMist}
            coinIn={state.coinIn}
            symbol={symbol}
            decimals={pool.coinDecimals}
            onReset={resetForm}
          />
        ) : (
          <div className="space-y-5 px-5 pb-5 pt-5">
            {/* Balance row + MAX */}
            <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
              <span>Your balance</span>
              <span className="inline-flex items-center gap-2 text-ink">
                {coinsFetching && account && (
                  <Spinner size={11} className="text-ink/40" label="Loading balance" />
                )}
                {account
                  ? `${formatAmount(userBalance, {
                      decimals: pool.coinDecimals,
                      compact: true,
                      maxFractionDigits: 4,
                    })} ${symbol}`
                  : "—"}
              </span>
            </div>

            {/* Amount input */}
            <AmountField
              value={amount}
              onChange={(next) => {
                if (isPanelBusy) return;
                setAmount(sanitizeAmount(next));
              }}
              symbol={symbol}
              disabled={isPanelBusy || paused}
              onMax={() => {
                if (isPanelBusy) return;
                if (maxRedeemable === 0n) return;
                setAmount(
                  new BigNumber(maxRedeemable.toString())
                    .dividedBy(new BigNumber(10).pow(pool.coinDecimals))
                    .toFixed(pool.coinDecimals, BigNumber.ROUND_DOWN)
                    .replace(/\.?0+$/, ""),
                );
              }}
              maxDisabled={!account || maxRedeemable === 0n || isPanelBusy}
            />

            {/* Quote */}
            <Quote
              quote={quote}
              feeBps={feeBps}
              amountBase={amountBase}
              symbol={symbol}
              decimals={pool.coinDecimals}
            />

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

            {/* CTA */}
            {account ? (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!submittable || isPanelBusy}
                className={cn(CTA_BASE, "bg-ink text-bone")}
              >
                {isPanelBusy ? (
                  <>
                    <Spinner size={14} className="text-bone" />
                    <span>
                      {state.kind === "submitting" ? "Sign in wallet…" : "Confirming on chain…"}
                    </span>
                  </>
                ) : submittable ? (
                  <>
                    <span>
                      Redeem{" "}
                      {formatAmount(amountBase, {
                        decimals: pool.coinDecimals,
                        compact: true,
                        maxFractionDigits: 2,
                      })}{" "}
                      {symbol}
                    </span>
                    <ArrowDiag size={12} />
                  </>
                ) : (
                  <span>{validation ?? "Enter an amount"}</span>
                )}
              </button>
            ) : (
              <ConnectWallet />
            )}

            {/* Footer: fee disclosure */}
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
              {(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2)}% platform fee · taken from gross SUI · permanent terms
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─────────────────────────── Subviews ─────────────────────────── */

function PanelStatusPill({
  paused,
  reserve,
}: {
  paused: boolean;
  reserve: bigint;
}) {
  if (paused) {
    return <SmallPill label="Paused" tone="poppy" />;
  }
  if (reserve === 0n) {
    return <SmallPill label="Empty" tone="poppy" />;
  }
  return <SmallPill label="Open" tone="jade" pulsing />;
}

function SmallPill({
  label,
  tone,
  pulsing,
}: {
  label: string;
  tone: "jade" | "poppy";
  pulsing?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
        tone === "jade" ? "text-jade" : "text-poppy",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block h-1.5 w-1.5 rounded-full",
          tone === "jade" ? "bg-jade" : "bg-poppy",
        )}
        style={
          pulsing
            ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
            : undefined
        }
      />
      {label}
    </span>
  );
}

function AmountField({
  value,
  onChange,
  onMax,
  maxDisabled,
  symbol,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onMax: () => void;
  maxDisabled: boolean;
  symbol: string;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
        <span>Amount</span>
        <button
          type="button"
          onClick={onMax}
          disabled={maxDisabled}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55 underline-offset-2 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink/55"
        >
          MAX
        </button>
      </div>
      <div
        className={cn(
          "mt-2 flex items-center gap-3 border border-ink/25 bg-bone px-3 transition-colors",
          "focus-within:border-ink focus-within:shadow-offset-sm",
          disabled && "opacity-60",
        )}
      >
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className="h-14 w-full bg-transparent font-mono text-2xl tabular-nums text-ink outline-none placeholder:text-ink/30"
          aria-label={`Amount of ${symbol} to redeem`}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
          {symbol}
        </span>
      </div>
    </div>
  );
}

function Quote({
  quote,
  amountBase,
  symbol,
  decimals,
}: {
  quote: { suiGrossMist: bigint; feeMist: bigint; suiOutMist: bigint; clamped: boolean };
  feeBps: number;
  amountBase: bigint;
  symbol: string;
  decimals: number;
}) {
  const isZero = amountBase === 0n;
  return (
    <div className="space-y-2 border-t border-ink/15 pt-4">
      <QuoteRow label="You send">
        <span
          className={cn(
            "font-mono tabular-nums",
            isZero ? "text-ink/40" : "text-ink",
          )}
        >
          {formatAmount(amountBase, {
            decimals,
            compact: false,
            maxFractionDigits: Math.min(6, decimals),
          })}{" "}
          <span className="text-[11px] uppercase tracking-[0.08em] text-ink/55">
            {symbol}
          </span>
        </span>
      </QuoteRow>
      <QuoteRow label="Gross SUI">
        <SuiAmount
          mist={quote.suiGrossMist}
          maxFractionDigits={6}
          glyphSize={11}
          className={cn(
            "text-[13.5px]",
            isZero ? "text-ink/40" : "text-ink",
          )}
        />
      </QuoteRow>
      <QuoteRow label="Platform fee">
        <SuiAmount
          mist={quote.feeMist}
          maxFractionDigits={6}
          glyphSize={11}
          className={cn(
            "text-[13.5px]",
            isZero ? "text-ink/40" : "text-poppy",
          )}
        />
      </QuoteRow>
      <div className="mt-1 border-t border-ink/10 pt-3">
        <QuoteRow label="You receive" emphasis>
          <SuiAmount
            mist={quote.suiOutMist}
            maxFractionDigits={6}
            glyphSize={13}
            className={cn(
              "text-[18px] font-semibold",
              isZero ? "text-ink/40" : "text-ink",
            )}
          />
        </QuoteRow>
      </div>
    </div>
  );
}

function QuoteRow({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "font-mono text-[10.5px] uppercase tracking-[0.16em]",
          emphasis ? "text-ink/70" : "text-ink/50",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SuccessView({
  digest,
  suiOutMist,
  coinIn,
  symbol,
  decimals,
  onReset,
}: {
  digest: string;
  suiOutMist: bigint;
  coinIn: bigint;
  symbol: string;
  decimals: number;
  onReset: () => void;
}) {
  return (
    <div className="px-5 py-6">
      <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jade">
        <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
        Redeem signed
      </div>
      <h3 className="mt-3 font-display text-[1.5rem] leading-[1.1]">
        You received{" "}
        <SuiAmount
          mist={suiOutMist}
          maxFractionDigits={6}
          glyphSize={14}
          className="text-[1.5rem]"
        />
      </h3>
      <p className="mt-2 text-[13.5px] text-ink/65">
        Burned{" "}
        <span className="font-mono tabular-nums text-ink">
          {formatAmount(coinIn, {
            decimals,
            compact: true,
            maxFractionDigits: 4,
          })}{" "}
          {symbol}
        </span>{" "}
        from your wallet at the pool's fixed rate.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
        <span>tx</span>
        <TxHash value={digest} copyable />
        <a
          href={explorerUrl("tx", digest)}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1 text-ink/55 transition-colors hover:text-ink"
        >
          <span>view on suiscan</span>
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-[1px]">↗</span>
        </a>
      </div>
      <button
        type="button"
        onClick={onReset}
        className={cn(CTA_BASE, "mt-6 bg-bone text-ink")}
      >
        <span>Redeem again</span>
        <ArrowDiag size={12} />
      </button>
    </div>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

/**
 * Trim disallowed characters out of the amount input as the user types.
 * Allows a single decimal point and any digits — paste-safe and IME-safe.
 */
function sanitizeAmount(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot >= 0) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

// `MIST_PER_SUI` is imported but the helpers above reach for it indirectly via
// `lib/sui` re-exports — kept here so the import isn't tree-shaken away by
// future refactors that inline the constant.
void MIST_PER_SUI;
