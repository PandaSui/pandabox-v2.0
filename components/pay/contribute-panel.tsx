"use client";

import { useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { TransactionSuccess } from "./transaction-success";
import { AmountInput, suiUsd, usdSui, type Currency } from "./amount-input";
import { useSuiUsdPrice } from "@/lib/hooks/use-sui-usd-price";
import { resolveBlobRef } from "@/lib/ipfs";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import {
  buildContributeTx,
  IS_DEPLOYED,
  PACKAGE_ID,
  PROJECT_COIN_DECIMALS,
} from "@/lib/contracts/pandabox";
import type { HydratedProject } from "@/lib/projects";

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-12 px-6 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

const MIST = 1_000_000_000n;

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; digest: string }
  | { kind: "error"; message: string };

/**
 * Live contribute panel — calls `project::contribute<T>(project, &platform,
 * coin, &clock)`. Splits the SUI from gas, sends the coin to the contract,
 * the wrapper transfers the returned ContributionReceipt + refund coin back
 * to the sender. Pre-checks the sale window and remaining allocation so the
 * user sees a meaningful error instead of a wallet-side revert.
 */
export function ContributePanel({ project }: { project: HydratedProject }) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("SUI");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const { price: suiUsdPrice } = useSuiUsdPrice();

  // ── Sale-state preview ─────────────────────────────────────────────
  const ticker = lastSegment(project.tokenType).toUpperCase() || "TOK";
  const ended = project.endTimeMs > 0 && Date.now() > project.endTimeMs;
  const live = project.status === "live" && !ended;

  const remainingAllocation = useMemo(() => {
    const r = project.fundingAllocation - project.sold;
    return r > 0n ? r : 0n;
  }, [project.fundingAllocation, project.sold]);

  // ── Amount → tokens preview ────────────────────────────────────────
  const suiAmount = useMemo(() => {
    if (!amount || !Number.isFinite(Number(amount))) return new BigNumber(0);
    const bn = new BigNumber(amount);
    if (currency === "SUI") return bn;
    // USD entered but no live price yet — treat as 0 SUI; the input UI
    // already disables the USD toggle when the price is unavailable.
    return usdSui(bn, suiUsdPrice) ?? new BigNumber(0);
  }, [amount, currency, suiUsdPrice]);

  const amountMist = useMemo(() => {
    if (suiAmount.lte(0)) return 0n;
    return BigInt(
      suiAmount.multipliedBy(1e9).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
    );
  }, [suiAmount]);

  /**
   * Tokens issued for `amountMist` SUI, using the on-chain math:
   *   tokens_raw = amountMist * base_rate / 10^9
   * (base_rate is already scaled to coin decimals — both decimals = 9).
   */
  const tokensRaw = useMemo(() => {
    if (amountMist === 0n) return 0n;
    return (amountMist * BigInt(project.baseRate || 0)) / MIST;
  }, [amountMist, project.baseRate]);

  // Cap effective contribution by remaining allocation. Whatever the user
  // sends above this cap, the contract refunds — show that in the preview.
  const cappedTokens = useMemo(
    () => (tokensRaw > remainingAllocation ? remainingAllocation : tokensRaw),
    [tokensRaw, remainingAllocation],
  );
  const refundedMist = useMemo(() => {
    if (tokensRaw <= remainingAllocation) return 0n;
    const usableMist = project.baseRate
      ? (cappedTokens * MIST) / BigInt(project.baseRate)
      : 0n;
    return amountMist > usableMist ? amountMist - usableMist : 0n;
  }, [
    tokensRaw,
    remainingAllocation,
    cappedTokens,
    project.baseRate,
    amountMist,
  ]);

  const validation = useMemo(() => {
    if (!live) return ended ? "Sale has ended" : "Sale is closed";
    if (remainingAllocation <= 0n) return "Sold out";
    if (amountMist <= 0n) return null;
    if (amountMist < 1_000_000n) return "Minimum contribution is 0.001 SUI";
    return null;
  }, [live, ended, remainingAllocation, amountMist]);

  const isValid = !validation && amountMist > 0n;

  const onSubmit = async () => {
    if (!account || !isValid) return;
    if (!project.tokenType) {
      setState({ kind: "error", message: "Project is missing a coin type." });
      return;
    }
    setState({ kind: "submitting" });
    try {
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 600));
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
        return;
      }
      const tx = buildContributeTx({
        coinType: project.tokenType,
        projectId: project.id,
        amountMist,
        sender: account.address,
      });
      const result = await signAndExecute({ transaction: tx });
      setState({ kind: "success", digest: result.digest });
      // Best-effort revalidation so the page picks up the new sold/balance
      // shortly after submission.
      void client.waitForTransaction({ digest: result.digest });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Contribution failed to submit.",
      });
    }
  };

  const closeInspector = () => {
    if (state.kind === "submitting") return;
    setInspectorOpen(false);
    if (state.kind === "success") {
      setAmount("");
      setState({ kind: "idle" });
    }
  };

  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
          <MonoLabel className="text-[10px]">Back this project</MonoLabel>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-mono-label text-[10px]",
              live ? "text-jade" : "text-ink/45",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "block h-1.5 w-1.5 rounded-full",
                live ? "bg-jade" : "bg-ink/35",
              )}
              style={
                live
                  ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
                  : undefined
              }
            />
            {live ? "Live" : ended ? "Ended" : "Closed"}
          </span>
        </header>

        <div className="space-y-5 px-5 pt-5 pb-4">
          <AmountInput
            value={amount}
            currency={currency}
            onChange={setAmount}
            onCurrencyChange={(next) => {
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
                // Price not yet available — keep the typed value as-is and
                // just swap the currency label.
                setCurrency(next);
                return;
              }
              setAmount(
                converted.toFormat(
                  next === "USD" ? 2 : 4,
                  BigNumber.ROUND_DOWN,
                  {
                    groupSeparator: "",
                    groupSize: 3,
                    decimalSeparator: ".",
                  },
                ),
              );
              setCurrency(next);
            }}
          />

          {/* Preview row */}
          <div className="grid grid-cols-2 gap-3 border-t border-ink/15 pt-4">
            <Preview label="You receive">
              <Marker color="saffron">
                <span className="font-mono tabular-nums text-base">
                  {formatToken(cappedTokens, PROJECT_COIN_DECIMALS)} {ticker}
                </span>
              </Marker>
              {refundedMist > 0n && (
                <span className="mt-1 block font-mono text-[10px] text-poppy">
                  + refund {formatSui(refundedMist)} SUI · over-allocation
                </span>
              )}
            </Preview>
            <Preview label="Claim after">
              <span className="font-mono tabular-nums text-base">
                {ended ? "now" : project.endTimeMs > 0 ? "finalize" : "—"}
              </span>
            </Preview>
          </div>

          {validation && (
            <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy">
              {validation}
            </p>
          )}

          {/* CTA — primary action */}
          {account ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              disabled={!isValid}
              className={cn(CTA_BASE, "bg-saffron text-ink")}
            >
              <span>
                {isValid
                  ? `Pay ${suiAmount.toFormat(2, BigNumber.ROUND_DOWN)} SUI`
                  : amountMist > 0n
                    ? (validation ?? "Unavailable")
                    : "Enter an amount"}
              </span>
              {isValid && <ArrowDiag size={14} />}
            </button>
          ) : (
            <ConnectWallet />
          )}
        </div>

        {/* Spec strip — what the on-chain call actually does */}
        <dl className="grid grid-cols-2 border-t border-ink/15">
          <SpecCell
            k="base_rate"
            v={`${formatToken(BigInt(project.baseRate ?? 0), PROJECT_COIN_DECIMALS)} ${ticker} / SUI`}
          />
          <SpecCell
            k="remaining"
            v={`${formatToken(remainingAllocation, PROJECT_COIN_DECIMALS)} ${ticker}`}
            border
          />
        </dl>
      </div>

      <Modal
        open={inspectorOpen}
        onClose={closeInspector}
        title="Transaction inspector"
      >
        {state.kind === "success" ? (
          <TransactionSuccess
            title="Contribution submitted"
            projectName={project.name}
            txDigest={state.digest}
            primaryHref={`/p/${project.id}`}
            primaryLabel="Back to project"
          />
        ) : (
          <ContributePreview
            project={project}
            ticker={ticker}
            suiAmount={suiAmount}
            suiUsdPrice={suiUsdPrice}
            cappedTokens={cappedTokens}
            refundedMist={refundedMist}
            amountMist={amountMist}
            state={state}
            onCancel={closeInspector}
            onSubmit={onSubmit}
          />
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

/**
 * Friendly pre-sign preview: a SUI tile flowing into a token tile, with the
 * token amount as the headline. The raw Move call lives behind an advanced
 * disclosure for power users who want to verify before signing.
 */
function ContributePreview({
  project,
  ticker,
  suiAmount,
  suiUsdPrice,
  cappedTokens,
  refundedMist,
  amountMist,
  state,
  onCancel,
  onSubmit,
}: {
  project: HydratedProject;
  ticker: string;
  suiAmount: BigNumber;
  suiUsdPrice: BigNumber | null;
  cappedTokens: bigint;
  refundedMist: bigint;
  amountMist: bigint;
  state: SubmitState;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const iconUrl = resolveBlobRef(project.iconUrl)?.url ?? project.iconUrl ?? "";
  const usdValue = suiUsd(suiAmount, suiUsdPrice);
  const submitting = state.kind === "submitting";
  const rateText = `${formatToken(BigInt(project.baseRate ?? 0), PROJECT_COIN_DECIMALS)} ${ticker} / SUI`;
  const suiText = suiAmount.toFormat(
    suiAmount.isInteger() ? 0 : 4,
    BigNumber.ROUND_DOWN,
  );

  return (
    <div className="space-y-4">
      {/* You pay */}
      <div className="border border-ink/15 bg-bone p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-mono-label text-[10px] text-ink/55">
              You pay
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl tabular-nums text-ink">
                {suiText}
              </span>
              <span className="font-mono-label text-[11px] text-ink/70">
                SUI
              </span>
            </div>
            <p className="font-mono text-[11px] tabular-nums text-ink/45">
              {usdValue
                ? `≈ $${usdValue.toFormat(2, BigNumber.ROUND_DOWN)}`
                : "≈ $—"}
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/20 bg-ink/[0.04]">
            <SuiGlyph size={32} />
          </div>
        </div>
      </div>

      {/* Flow illustration — hairline with a saffron dot travelling down */}
      <div className="flex items-center justify-center" aria-hidden>
        <FlowConnector />
      </div>

      {/* You receive */}
      <div className="border border-ink bg-bone p-4 shadow-offset-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-mono-label text-[10px] text-jade">
              You receive
            </span>
            <div className="flex items-baseline gap-2">
              <Marker color="saffron">
                <span className="font-mono text-3xl tabular-nums text-ink">
                  {formatToken(cappedTokens, PROJECT_COIN_DECIMALS)}
                </span>
              </Marker>
              <span className="font-mono-label text-[11px] text-ink/70">
                {ticker}
              </span>
            </div>
            <p className="font-mono text-[11px] tabular-nums text-ink/45">
              at {rateText}
            </p>
          </div>
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-ink/20 bg-ink/[0.04]">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconUrl}
                alt={ticker}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-mono-label text-[9px] text-ink/40">
                  {ticker}
                </span>
              </div>
            )}
          </div>
        </div>
        {refundedMist > 0n && (
          <p className="mt-3 border-t border-ink/10 pt-3 font-mono text-[11px] text-poppy">
            + refund {formatSui(refundedMist)} SUI · contribution exceeded
            remaining allocation
          </p>
        )}
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={onCancel}
          className={cn(CTA_BASE, "h-10 w-auto bg-bone px-4 text-ink")}
        >
          <span>Cancel</span>
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className={cn(CTA_BASE, "h-10 w-auto bg-saffron px-4 text-ink")}
        >
          <span>{submitting ? "Signing…" : "Confirm & sign"}</span>
          <ArrowDiag size={12} />
        </button>
      </div>

      <details className="group">
        <summary className="cursor-pointer font-mono-label text-[10px] text-ink/45 hover:text-ink">
          advanced · raw move call
        </summary>
        <div className="mt-2 border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
          <Row k="package">{shortMid(PACKAGE_ID)}</Row>
          <Row k="module">project</Row>
          <Row k="function">contribute&lt;T&gt;</Row>
          <Row k="type.T">
            {project.tokenType ? shortMid(project.tokenType) : "—"}
          </Row>
          <Row k="arg.project">{shortMid(project.id)}</Row>
          <Row k="arg.coin">split({amountMist.toString()} mist)</Row>
          <Row k="returns">Receipt + refund → sender</Row>
        </div>
      </details>
    </div>
  );
}

function FlowConnector() {
  return (
    <svg
      width="4"
      height="44"
      viewBox="0 0 4 44"
      className="text-ink/25"
      role="presentation"
    >
      <line
        x1="2"
        y1="0"
        x2="2"
        y2="44"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <circle r="2.5" cx="2" cy="0" fill="#B8C45E">
        <animate
          attributeName="cy"
          values="0;44"
          dur="1.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.15;0.85;1"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function SpecCell({
  k,
  v,
  border = false,
}: {
  k: string;
  v: string;
  border?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3", border && "border-l border-ink/15")}>
      <span className="font-mono-label text-[10px] text-ink/50 block">{k}</span>
      <div className="mt-1 font-mono tabular-nums text-[12px] text-ink/80">
        {v}
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink/45">{k}</span>
      <span className="break-all text-ink">{children}</span>
    </div>
  );
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}

function formatSui(mist: bigint): string {
  const n = Number(mist) / 1e9;
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function formatToken(raw: bigint, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}
