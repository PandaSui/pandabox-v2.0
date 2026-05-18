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
    return currency === "SUI" ? bn : usdSui(bn);
  }, [amount, currency]);

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
  }, [tokensRaw, remainingAllocation, cappedTokens, project.baseRate, amountMist]);

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
                  ? suiUsd(bn)
                  : currency === "USD" && next === "SUI"
                    ? usdSui(bn)
                    : bn;
              setAmount(
                converted.toFormat(next === "USD" ? 2 : 4, BigNumber.ROUND_DOWN, {
                  groupSeparator: "",
                  groupSize: 3,
                  decimalSeparator: ".",
                }),
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
              <span className="mt-1 block font-mono text-[10px] text-ink/55">
                via project::claim&lt;T&gt;
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
                    ? validation ?? "Unavailable"
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
          <SpecCell k="base_rate" v={`${project.baseRate} / SUI`} />
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
          <div className="space-y-4 text-xs">
            <p className="text-ink/55">
              {IS_DEPLOYED
                ? "Pre-sign preview. Your wallet will request a signature for this Move call."
                : "Move package address not configured. Submission is simulated."}
            </p>
            <div className="border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
              <Row k="package">{shortMid(PACKAGE_ID)}</Row>
              <Row k="module">project</Row>
              <Row k="function">contribute&lt;T&gt;</Row>
              <Row k="type.T">
                {project.tokenType ? shortMid(project.tokenType) : "—"}
              </Row>
              <Row k="arg.project">{shortMid(project.id)}</Row>
              <Row k="arg.platform">::env::PLATFORM_OBJECT_ID</Row>
              <Row k="arg.coin">split({amountMist.toString()} mist)</Row>
              <Row k="returns">Receipt + refund → sender</Row>
            </div>
            {state.kind === "error" && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
              >
                {state.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={state.kind === "submitting"}
                onClick={closeInspector}
                className={cn(CTA_BASE, "h-10 bg-bone text-ink w-auto px-4")}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                disabled={state.kind === "submitting"}
                onClick={onSubmit}
                className={cn(CTA_BASE, "h-10 bg-saffron text-ink w-auto px-4")}
              >
                <span>
                  {state.kind === "submitting" ? "Signing…" : "Sign & submit"}
                </span>
                <ArrowDiag size={12} />
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
    <div
      className={cn(
        "px-4 py-3",
        border && "border-l border-ink/15",
      )}
    >
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
