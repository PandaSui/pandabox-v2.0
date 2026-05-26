"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { ArrowDiag, Modal } from "@pandasui/ui";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Spinner } from "@/components/primitives/spinner";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TxHash } from "@/components/identity/tx-hash";
import {
  buildDepositReserveTx,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import { bustRedeemPoolCache } from "@/lib/server-actions/redeem-cache";
import { MIST_PER_SUI, explorerUrl } from "@/lib/sui";
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
  const { pool } = data;
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const router = useRouter();
  const t = useTranslations("redeem.detail.depositPanel");

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
    if (amountMist > spendableMist) return t("validation.exceedsBalance");
    return null;
  }, [account, amountMist, spendableMist, t]);

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
        .then(async () => {
          setState({ kind: "success", digest: result.digest, amountMist });
          // `router.refresh()` alone re-renders the RSC tree but the
          // `unstable_cache`-wrapped `getRedeemPool` reader still returns
          // its 30s-cached snapshot, so the hero would show pre-deposit
          // reserve for up to half a minute. Bust the tag first so the
          // next render fetches fresh chain state.
          await bustRedeemPoolCache().catch(() => {});
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
      <header className="border-b border-ink/15 px-5 py-3.5">
        {/* Stacked title + tag — in the narrow left rail the previous
            `justify-between` row ran the two mono labels into each other.
            Stacking keeps the title legible at any column width. */}
        <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
        <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          <span aria-hidden className="block h-1 w-1 rounded-full bg-jade/70" />
          {t("anyoneCanDeposit")}
        </span>
      </header>

      <div className="space-y-4 px-5 py-5">
        <p className="text-[13px] leading-[1.55] text-ink/65">{t("body")}</p>

        {/* Form stays visible at all times. The success state is
            promoted to a Modal (rendered below) — the panel sits in the
            action column which can be below the fold on shorter
            viewports, and the previous inline jade banner was easy to
            scroll past. */}
        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          <span>{t("yourSuiBalance")}</span>
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
            aria-label={t("amountAria")}
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
                  {state.kind === "submitting"
                    ? t("signInWallet")
                    : t("confirming")}
                </span>
              </>
            ) : submittable ? (
              <>
                <span>
                  {t("depositAction", {
                    amount: formatAmount(amountMist, {
                      decimals: 9,
                      compact: true,
                      maxFractionDigits: 4,
                    }),
                  })}
                </span>
                <ArrowDiag size={11} />
              </>
            ) : (
              <span>{validation ?? t("enterAmount")}</span>
            )}
          </button>
        ) : (
          <ConnectWallet />
        )}
      </div>

      {/* Success modal — opens automatically when `state.kind === 'success'`
          and resets the form on close. Uses the shared `<Modal>` from
          @pandasui/ui (same chrome + close-button cell as Claim / Deploy
          success). */}
      <Modal
        open={state.kind === "success"}
        onClose={() => {
          setAmount("");
          setState({ kind: "idle" });
        }}
        title={t("modalTitle")}
      >
        {state.kind === "success" && (
          <DepositSuccessBody
            amountMist={state.amountMist}
            digest={state.digest}
            labels={{
              eyebrow: t("successEyebrow"),
              headline: t("successHeadline"),
              tagAdded: t("successAdded"),
              txLabel: t("txLabel"),
              viewOnSuiscan: t("viewOnSuiscan"),
              again: t("successAgain"),
            }}
            onAgain={() => {
              setAmount("");
              setState({ kind: "idle" });
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function DepositSuccessBody({
  amountMist,
  digest,
  labels,
  onAgain,
}: {
  amountMist: bigint;
  digest: string;
  labels: {
    eyebrow: string;
    headline: string;
    tagAdded: string;
    txLabel: string;
    viewOnSuiscan: string;
    again: string;
  };
  onAgain: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-jade">
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full bg-jade"
          style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
        />
        {labels.eyebrow}
      </div>

      <div>
        <h3 className="font-display text-[1.75rem] leading-[1.05]">
          <SuiAmount
            mist={amountMist}
            adaptive
            maxFractionDigits={4}
            glyphSize={18}
            className="text-[1.75rem]"
          />
        </h3>
        <p className="mt-1.5 text-[13.5px] text-ink/65">{labels.tagAdded}</p>
      </div>

      <div className="border-y border-ink/10">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {labels.txLabel}
          </dt>
          <dd className="min-w-0 text-right">
            <TxHash value={digest} copyable head={6} tail={4} />
          </dd>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={explorerUrl("tx", digest)}
          target="_blank"
          rel="noreferrer"
          className={cn(CTA_BASE, "h-10 bg-bone text-ink")}
        >
          <span>{labels.viewOnSuiscan}</span>
          <span aria-hidden>↗</span>
        </a>
        <button
          type="button"
          onClick={onAgain}
          className={cn(CTA_BASE, "h-10 bg-ink text-bone")}
        >
          <span>{labels.again}</span>
          <ArrowDiag size={12} />
        </button>
      </div>
    </div>
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
