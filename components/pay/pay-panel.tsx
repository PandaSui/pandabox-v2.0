"use client";

import { useMemo, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import BigNumber from "bignumber.js";
import { cn } from "@/lib/cn";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Diecut } from "@/components/primitives/diecut";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TokenAmount } from "@/components/identity/token-amount";
import { Modal } from "@/components/ui/modal";
import { AmountInput, suiUsd, usdSui, type Currency } from "./amount-input";
import { TierSelector } from "./tier-selector";
import type { ProjectDTO } from "@/lib/api/project-dto";

const MEMO_MAX = 256;

export function PayPanel({ project }: { project: ProjectDTO }) {
  const account = useCurrentAccount();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("SUI");
  const [tierId, setTierId] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Resolve everything in SUI.
  const suiAmount = useMemo(() => {
    if (!amount || !Number.isFinite(Number(amount))) return new BigNumber(0);
    const bn = new BigNumber(amount);
    return currency === "SUI" ? bn : usdSui(bn);
  }, [amount, currency]);

  const amountMist = useMemo(
    () =>
      BigInt(
        suiAmount.multipliedBy(1_000_000_000).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
      ),
    [suiAmount],
  );

  // Token preview: amount × weight.
  const tokensRaw = useMemo(() => {
    return (amountMist * BigInt(project.params.weight)) / 1_000_000_000n;
  }, [amountMist, project.params.weight]);

  // Cash-out preview (heuristic): your share of treasury, less cash-out tax.
  const cashOutSui = useMemo(() => {
    if (suiAmount.isZero()) return new BigNumber(0);
    // After your payment, share = your tokens / (existing supply + your tokens).
    // Treasury after your payment ≈ raised + your amount.
    const raisedSui = new BigNumber(project.raisedMist).dividedBy(1e9);
    const newTreasury = raisedSui.plus(suiAmount);
    // Total supply ≈ raised × weight + your tokens.
    const totalSupply = new BigNumber(project.raisedMist)
      .multipliedBy(project.params.weight)
      .dividedBy(1e9)
      .plus(new BigNumber(tokensRaw.toString()));
    if (totalSupply.isZero()) return new BigNumber(0);
    const share = new BigNumber(tokensRaw.toString()).dividedBy(totalSupply);
    const gross = newTreasury.multipliedBy(share);
    const tax = new BigNumber(project.params.cashOutTax).dividedBy(100);
    return gross.multipliedBy(new BigNumber(1).minus(tax));
  }, [
    suiAmount,
    tokensRaw,
    project.raisedMist,
    project.params.weight,
    project.params.cashOutTax,
  ]);

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
                ? suiUsd(bn)
                : currency === "USD" && next === "SUI"
                  ? usdSui(bn)
                  : bn;
            setAmount(converted.toFormat(next === "USD" ? 2 : 4, BigNumber.ROUND_DOWN, {
              groupSeparator: "",
              groupSize: 3,
              decimalSeparator: ".",
            }));
            setCurrency(next);
          }}
          className="mt-5"
        />

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink/15 pt-4 text-xs">
          <Preview label="You receive">
            <TokenAmount
              raw={tokensRaw}
              decimals={9}
              ticker={project.ticker}
              compact
              className="text-sm"
            />
          </Preview>
          <Preview label="Cash out today">
            <span className="inline-flex items-baseline gap-1 text-sm">
              ≈ <SuiAmount mist={BigInt(cashOutSui.multipliedBy(1e9).integerValue().toFixed(0))} maxFractionDigits={2} />
            </span>
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

        <div className="mt-4 grid grid-cols-3 border-t border-ink/15 pt-3 text-center">
          <ParamCell label="Reserved" value={`${project.params.reservedRate}%`} />
          <ParamCell label="Cash-out tax" value={`${project.params.cashOutTax}%`} border />
          <ParamCell label="Issuance ↓" value={`${project.params.issuanceReduction}%`} border />
        </div>
      </div>

      <Modal
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="Transaction inspector"
      >
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Pre-sign preview. Wires to a real Sui PTB in step 13.11 of the build
            plan; for now this is a UI-only inspector.
          </p>
          <div className="border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
            <Row k="package">{project.packageId.slice(0, 18)}…</Row>
            <Row k="module">pandabox</Row>
            <Row k="function">pay</Row>
            <Row k="arg.project_id">{project.id.slice(0, 18)}…</Row>
            <Row k="arg.amount_mist">{amountMist.toString()}</Row>
            <Row k="arg.memo">{memo ? JSON.stringify(memo) : "\"\""}</Row>
            <Row k="arg.tier_id">{tierId ?? "none"}</Row>
            <Row k="gas">sponsored</Row>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              className="diecut border border-ink/40 px-4 py-2 hover:bg-ink hover:text-bone transition-colors"
            >
              <span className="font-mono-label">Cancel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                // Stub: chain wiring lands in step 13.11.
                // eslint-disable-next-line no-console
                console.info("[pandabox] pay tx not wired yet", {
                  projectId: project.id,
                  amountMist: amountMist.toString(),
                  memo,
                  tierId,
                });
                setInspectorOpen(false);
              }}
              className="diecut bg-ink px-4 py-2 text-bone hover:bg-ink-90"
            >
              <span className="font-mono-label">Sign &amp; submit</span>
            </button>
          </div>
        </div>
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
