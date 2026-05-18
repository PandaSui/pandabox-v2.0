"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { useWizard } from "@/lib/store/wizard";
import {
  StepCycles,
  StepEconomics,
  StepIdentity,
  StepPayouts,
  StepTiers,
} from "@/lib/store/wizard-schema";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Frame } from "@/components/primitives/frame";
import { MonoLabel } from "@/components/primitives/mono-label";
import { TransactionSuccess } from "@/components/pay";
import { buildCreateProjectTx, IS_DEPLOYED, PACKAGE_ID } from "@/lib/contracts";
import { StepCard, StepHeader } from "../step-header";

// Same chrome as the hero / final-cta CTAs.
const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

export function StepDeployForm() {
  const draft = useWizard((s) => s.draft);
  const reset = useWizard((s) => s.reset);
  const setStep = useWizard((s) => s.setStep);
  const account = useCurrentAccount();
  const router = useRouter();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success"; digest: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const checks = useMemo(() => validate(draft), [draft]);
  const ready = checks.every((c) => c.ok);

  const onSubmit = async () => {
    if (!ready) return;
    setSubmitState({ kind: "submitting" });
    try {
      if (!IS_DEPLOYED) {
        // Move package not yet published. Simulate so the UX is complete.
        await new Promise((r) => setTimeout(r, 600));
        const digest = "SIMULATED" + Date.now().toString(36).toUpperCase();
        setSubmitState({ kind: "success", digest });
        return;
      }
      const tx = buildCreateProjectTx({
        identity: {
          name: draft.identity.name ?? "",
          ticker: draft.identity.ticker ?? "",
          tagline: draft.identity.tagline ?? "",
          // The on-chain description field is a blob ref. Until we have an
          // async pre-deploy "pin description" step, the wrapper expects the
          // string description directly — submit raw text for now and the
          // backend indexer can re-pin server-side. When the contract migrates
          // to CID-only, swap to `draft.identity.descriptionCid`.
          description: draft.identity.description ?? "",
          category: draft.identity.category ?? "art",
        },
        cycles: {
          durationDays: draft.cycles.durationDays ?? 14,
          ballotDelayHours: draft.cycles.ballotDelayHours ?? 72,
          firstCycleStart: draft.cycles.firstCycleStart ?? Date.now(),
        },
        economics: {
          weight: draft.economics.weight ?? "0",
          reservedRate: draft.economics.reservedRate ?? 0,
          cashOutTax: draft.economics.cashOutTax ?? 0,
          issuanceReduction: draft.economics.issuanceReduction ?? 0,
          reservedSplits: draft.economics.reservedSplits ?? [],
        },
        payouts: {
          payoutLimitMist: draft.payouts.payoutLimitMist ?? "0",
          splits: draft.payouts.splits ?? [],
          sendSurplusToOwner: draft.payouts.sendSurplusToOwner ?? true,
        },
        tiers: {
          enabled: draft.tiers.enabled,
          list: draft.tiers.list.map((t) => ({
            name: t.name,
            priceMist: t.priceMist,
            maxSupply: t.maxSupply,
            perks: t.perks,
          })),
        },
      });
      const result = await signAndExecute({ transaction: tx });
      setSubmitState({ kind: "success", digest: result.digest });
    } catch (err) {
      setSubmitState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Deploy transaction failed.",
      });
    }
  };

  const onFinishSuccess = () => {
    reset();
    setInspectorOpen(false);
    setSubmitState({ kind: "idle" });
    router.push("/explore");
  };

  const okCount = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-8">
      <StepHeader
        n={6}
        accent="saffron"
        title="Review & deploy"
        body="Pandabox builds a single Sui programmable transaction that creates the project, mints your admin cap, and opens cycle Nº1."
        meta={`${okCount}/${checks.length} checks · ${ready ? "ready" : "blocked"}`}
      />

      <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
        <div className="flex items-start gap-3">
          <span className="font-mono-label text-poppy">Heads up</span>
          <p className="text-sm text-ink/80">
            <strong>Immutable on deploy:</strong> name, ticker, weight, first
            cycle start, reserved rate, cash-out tax. Reconfigurations queue
            for next cycle after the ballot delay.{" "}
            <strong>Editable any time:</strong> tagline, description, cover
            image, social links, NFT tier images and perks copy.
          </p>
        </div>
      </Frame>

      <StepCard
        title="Pre-flight checks"
        meta={ready ? "all green" : `${checks.length - okCount} blocking`}
      >
        <ul className="-mt-1 divide-y divide-ink/10">
          {checks.map((c) => (
            <li
              key={c.label}
              className={cn(
                "flex items-baseline justify-between gap-3 py-2.5",
                !c.ok && "text-poppy",
              )}
            >
              <span className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 translate-y-[2px] items-center justify-center font-mono text-[10px]",
                    c.ok
                      ? "border border-jade/40 bg-jade/10 text-jade"
                      : "border border-poppy/40 bg-poppy/10 text-poppy",
                  )}
                >
                  {c.ok ? "✓" : "!"}
                </span>
                <span className="text-sm">{c.label}</span>
              </span>
              {!c.ok && c.step && (
                <button
                  type="button"
                  onClick={() => setStep(c.step!)}
                  className="font-mono-label text-[10px] text-poppy underline-offset-4 hover:underline"
                >
                  fix in step {String(c.step).padStart(2, "0")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </StepCard>

      <StepCard title="Deploy" meta={IS_DEPLOYED ? "live · sui mainnet" : "simulated"}>
        <div className="flex flex-wrap items-center gap-3">
          {account ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              disabled={!ready}
              className={cn(CTA_BASE, "bg-saffron text-ink")}
            >
              <span>Deploy to Sui</span>
              <ArrowDiag size={14} />
            </button>
          ) : (
            <ConnectWallet />
          )}
          <span className="font-mono-label text-[10px] text-ink/45">
            gas sponsored by pandabox · ≈0.0023 SUI
          </span>
        </div>

        <p className="font-mono text-[10px] text-ink/40">
          Draft auto-saves to your browser as <code>pandabox:draft:v1</code>.
        </p>
      </StepCard>

      <Modal
        open={inspectorOpen}
        onClose={() => {
          if (submitState.kind === "submitting") return;
          if (submitState.kind === "success") {
            onFinishSuccess();
            return;
          }
          setInspectorOpen(false);
        }}
        title="Transaction inspector"
      >
        {submitState.kind === "success" ? (
          <TransactionSuccess
            title="Project deployed"
            projectName={draft.identity.name || "Untitled project"}
            txDigest={submitState.digest}
            primaryHref="/explore"
            primaryLabel="See it on Explore"
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
              <Row k="module">pandabox</Row>
              <Row k="function">create_project</Row>
              <Row k="arg.name">{JSON.stringify(draft.identity.name ?? "")}</Row>
              <Row k="arg.ticker">
                {JSON.stringify(draft.identity.ticker ?? "")}
              </Row>
              <Row k="arg.category">{draft.identity.category ?? "—"}</Row>
              <Row k="arg.cover_cid">
                {draft.identity.coverImageCid
                  ? `${draft.identity.coverImageCid.slice(0, 10)}…${draft.identity.coverImageCid.slice(-4)}`
                  : "—"}
              </Row>
              <Row k="arg.weight">{draft.economics.weight ?? "0"}</Row>
              <Row k="arg.reserved_rate">{draft.economics.reservedRate}%</Row>
              <Row k="arg.cash_out_tax">{draft.economics.cashOutTax}%</Row>
              <Row k="arg.issuance_reduction">
                {draft.economics.issuanceReduction}%
              </Row>
              <Row k="arg.duration_ms">
                {(draft.cycles.durationDays ?? 0) * 86400_000}
              </Row>
              <Row k="arg.ballot_delay_ms">
                {(draft.cycles.ballotDelayHours ?? 0) * 3600_000}
              </Row>
              <Row k="arg.payout_limit_mist">
                {draft.payouts.payoutLimitMist ?? "0"}
              </Row>
              <Row k="arg.reserved_splits">
                {draft.economics.reservedSplits?.length ?? 0}
              </Row>
              <Row k="arg.payout_splits">
                {draft.payouts.splits?.length ?? 0}
              </Row>
              <Row k="arg.tiers">
                {draft.tiers.enabled ? draft.tiers.list.length : 0}
              </Row>
              <Row k="gas">sponsored</Row>
            </div>
            {submitState.kind === "error" && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
              >
                {submitState.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitState.kind === "submitting"}
                onClick={() => setInspectorOpen(false)}
                className={cn(CTA_BASE, "bg-bone text-ink h-10 px-4")}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                disabled={submitState.kind === "submitting"}
                onClick={onSubmit}
                className={cn(CTA_BASE, "bg-saffron text-ink h-10 px-4")}
              >
                <span>
                  {submitState.kind === "submitting"
                    ? "Signing…"
                    : "Sign & deploy"}
                </span>
                <ArrowDiag size={12} />
              </button>
            </div>
          </div>
        )}
      </Modal>
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

type Check = { label: string; ok: boolean; step?: number };

function validate(draft: ReturnType<typeof useWizard.getState>["draft"]): Check[] {
  const out: Check[] = [];

  const identity = StepIdentity.safeParse(draft.identity);
  out.push({
    label: identity.success
      ? "Identity complete"
      : `Identity: ${identity.error.issues[0]?.message ?? "incomplete"}`,
    ok: identity.success,
    step: 1,
  });

  const cycles = StepCycles.safeParse(draft.cycles);
  out.push({
    label: cycles.success
      ? "Cycle window valid"
      : `Cycles: ${cycles.error.issues[0]?.message ?? "incomplete"}`,
    ok: cycles.success,
    step: 2,
  });

  const econ = StepEconomics.safeParse(draft.economics);
  out.push({
    label: econ.success
      ? "Token economics valid"
      : `Economics: ${econ.error.issues[0]?.message ?? "incomplete"}`,
    ok: econ.success,
    step: 3,
  });

  const payouts = StepPayouts.safeParse(draft.payouts);
  out.push({
    label: payouts.success
      ? "Payouts configured"
      : `Payouts: ${payouts.error.issues[0]?.message ?? "incomplete"}`,
    ok: payouts.success,
    step: 4,
  });

  const tiers = StepTiers.safeParse(draft.tiers);
  const tiersOk =
    tiers.success && (!draft.tiers.enabled || draft.tiers.list.length > 0);
  out.push({
    label: tiersOk
      ? draft.tiers.enabled
        ? `${draft.tiers.list.length} tier${draft.tiers.list.length === 1 ? "" : "s"} configured`
        : "No tiers (skipped)"
      : "Tiers enabled but no tier defined",
    ok: tiersOk,
    step: 5,
  });

  return out;
}
