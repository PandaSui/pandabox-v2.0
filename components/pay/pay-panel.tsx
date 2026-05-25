"use client";

import { useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TokenAmount } from "@/components/identity/token-amount";
import { Modal } from "@pandasui/ui";
import { AmountInput, suiUsd, usdSui, type Currency } from "./amount-input";
import { useSuiUsdPrice } from "@/lib/hooks/use-sui-usd-price";
import { TierSelector } from "./tier-selector";
import { TransactionSuccess } from "./transaction-success";
import { buildContributeTx, IS_DEPLOYED, PACKAGE_ID } from "@/lib/contracts";
// NOTE: this UI still renders the legacy "pay" model (memo / tier selector /
// cash-out preview) which doesn't exist on the deployed contract. The Move
// call below is wired to `project::contribute<T>`. The surrounding inputs
// will be reworked when the project pages are rebuilt against the new DTO.
import type { ProjectDTO } from "@/lib/api/project-dto";

const MEMO_MAX = 256;

export function PayPanel({ project }: { project: ProjectDTO }) {
  const account = useCurrentAccount();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("SUI");
  const [tierId, setTierId] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [submitState, setSubmitState] =
    useState<
      | { kind: "idle" }
      | { kind: "submitting" }
      | { kind: "success"; digest: string }
      | { kind: "error"; message: string }
    >({ kind: "idle" });
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { price: suiUsdPrice } = useSuiUsdPrice();

  // Resolve everything in SUI.
  const suiAmount = useMemo(() => {
    if (!amount || !Number.isFinite(Number(amount))) return new BigNumber(0);
    const bn = new BigNumber(amount);
    if (currency === "SUI") return bn;
    return usdSui(bn, suiUsdPrice) ?? new BigNumber(0);
  }, [amount, currency, suiUsdPrice]);

  const amountMist = useMemo(
    () =>
      BigInt(
        suiAmount.multipliedBy(1_000_000_000).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
      ),
    [suiAmount],
  );

  // Token preview: amount × weight.
  const tokensRaw = useMemo(() => {
    return (amountMist * BigInt(project.weight)) / 1_000_000_000n;
  }, [amountMist, project.weight]);

  const isValid = amountMist > 0n;

  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink/15 bg-bone/40 p-5">
        <MonoLabel>Back this project</MonoLabel>

        <AmountInput
          value={amount}
          currency={currency}
          onChange={setAmount}
          onCurrencyChange={(next) => {
            // Recompute display so the typed number tracks the new currency.
            if (!amount) {
              setCurrency(next);
              return;
            }
            const bn = new BigNumber(amount);
            const converted =
              currency === "SUI" && next === "USD"
                ? suiUsd(bn, suiUsdPrice)
                : currency === "USD" && next === "SUI"
                  ? usdSui(bn, suiUsdPrice)
                  : bn;
            if (converted === null) {
              setCurrency(next);
              return;
            }
            setAmount(converted.toFormat(next === "USD" ? 2 : 4, BigNumber.ROUND_DOWN, {
              groupSeparator: "",
              groupSize: 3,
              decimalSeparator: ".",
            }));
            setCurrency(next);
          }}
          className="mt-5"
        />

        <div className="mt-5 border-t border-ink/15 pt-4 text-xs">
          <Preview label="You receive">
            <TokenAmount
              raw={tokensRaw}
              decimals={9}
              ticker={project.ticker}
              compact
              className="text-sm"
            />
          </Preview>
        </div>

        <TierSelector
          tiers={project.tiers}
          selectedId={tierId}
          onSelect={setTierId}
          className="mt-5"
        />

        <label className="mt-5 block">
          <MonoLabel>Memo (optional)</MonoLabel>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
            placeholder="recorded on-chain with your payment"
            rows={2}
            className={cn(
              "mt-2 block w-full resize-none border border-ink/25 bg-bone p-2.5",
              "font-mono text-xs placeholder:text-ink/30",
              "focus:border-ink focus:outline-none",
            )}
          />
          <div className="mt-1 text-right font-mono text-[10px] text-ink/40">
            {memo.length}/{MEMO_MAX}
          </div>
        </label>

        <div className="mt-5">
          {account ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              disabled={!isValid}
              className={cn(
                "diecut w-full bg-ink px-5 py-3 text-bone transition-colors",
                "hover:bg-ink-90",
                !isValid && "opacity-40 cursor-not-allowed",
              )}
            >
              <span className="font-mono-label">
                {isValid
                  ? `Pay ${suiAmount.toFormat(2, BigNumber.ROUND_DOWN)} SUI`
                  : "Enter an amount"}
              </span>
            </button>
          ) : (
            <ConnectWallet />
          )}
        </div>

        {/* ParamCell row is rebuilt in stage 4 (share of supply / remaining mintable / unsold). */}
      </div>

      <Modal
        open={inspectorOpen}
        onClose={() => {
          if (submitState.kind !== "submitting") {
            setInspectorOpen(false);
            if (submitState.kind === "success") setSubmitState({ kind: "idle" });
          }
        }}
        title="Transaction inspector"
      >
        {submitState.kind === "success" ? (
          <TransactionSuccess
            title="Payment confirmed"
            projectName={project.name}
            txDigest={submitState.digest}
            primaryHref={`/projects/${project.id}`}
            primaryLabel="Back to project"
          />
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-ink/55">
              {IS_DEPLOYED
                ? "Pre-sign preview. Your wallet will request a signature for this Move call."
                : "Move package not deployed yet — submission is simulated locally until NEXT_PUBLIC_PACKAGE_ID is set."}
            </p>
            <div className="border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
              <Row k="package">{PACKAGE_ID.slice(0, 18)}…</Row>
              <Row k="module">project</Row>
              <Row k="function">contribute&lt;T&gt;</Row>
              <Row k="arg.project_id">{project.id.slice(0, 18)}…</Row>
              <Row k="arg.amount_mist">{amountMist.toString()}</Row>
              <Row k="returns">ContributionReceipt + refund coin → sender</Row>
            </div>
            {submitState.kind === "error" && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/8 p-2 font-mono text-[11px] text-poppy"
              >
                {submitState.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitState.kind === "submitting"}
                onClick={() => setInspectorOpen(false)}
                className="diecut border border-ink/40 px-4 py-2 hover:bg-ink hover:text-bone transition-colors"
              >
                <span className="font-mono-label">Cancel</span>
              </button>
              <button
                type="button"
                disabled={submitState.kind === "submitting"}
                onClick={async () => {
                  setSubmitState({ kind: "submitting" });
                  try {
                    if (!IS_DEPLOYED) {
                      // Local-only simulated success while Move package is unpublished.
                      await new Promise((r) => setTimeout(r, 500));
                      setSubmitState({
                        kind: "success",
                        digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
                      });
                      return;
                    }
                    if (!account) {
                      throw new Error("Connect a wallet to contribute.");
                    }
                    const tx = buildContributeTx({
                      coinType: project.coinType,
                      projectId: project.id,
                      amountMist,
                      sender: account.address,
                    });
                    const result = await signAndExecute({ transaction: tx });
                    setSubmitState({ kind: "success", digest: result.digest });
                  } catch (err) {
                    setSubmitState({
                      kind: "error",
                      message:
                        err instanceof Error ? err.message : "Transaction failed.",
                    });
                  }
                }}
                className="diecut bg-ink px-4 py-2 text-bone hover:bg-ink-90 disabled:opacity-50"
              >
                <span className="font-mono-label">
                  {submitState.kind === "submitting"
                    ? "Signing…"
                    : "Sign & submit"}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </aside>
  );
}

function Preview({
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

function ParamCell({
  label,
  value,
  border = false,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div className={cn("px-2 py-1", border && "border-l border-ink/15")}>
      <div className="font-mono-label text-[10px] text-ink/50">{label}</div>
      <div className="mt-1 font-mono tabular-nums text-sm">{value}</div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink/45">{k}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}
