"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useWizard } from "@/lib/store/wizard";
import {
  StepCycles,
  StepEconomics,
  StepIdentity,
  StepPayouts,
  StepTiers,
} from "@/lib/store/wizard-schema";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Diecut } from "@/components/primitives/diecut";
import { Frame } from "@/components/primitives/frame";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

export function StepDeployForm() {
  const draft = useWizard((s) => s.draft);
  const reset = useWizard((s) => s.reset);
  const setStep = useWizard((s) => s.setStep);
  const account = useCurrentAccount();
  const router = useRouter();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checks = useMemo(() => validate(draft), [draft]);
  const ready = checks.every((c) => c.ok);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      // Chain wiring lands in step 13.11 of the build plan. For now: simulate
      // a successful deploy by routing to a placeholder project id and
      // clearing the draft so the wizard returns to a fresh state.
      // eslint-disable-next-line no-console
      console.info("[pandabox] create_project tx not wired yet", {
        identity: draft.identity,
        cycles: draft.cycles,
        economics: draft.economics,
        payouts: draft.payouts,
        tiers: draft.tiers,
      });
      await new Promise((r) => setTimeout(r, 600));
      reset();
      router.push(`/create?deployed=1`);
    } finally {
      setSubmitting(false);
      setInspectorOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <MonoLabel>Step 06</MonoLabel>
        <h2 className="mt-1 text-3xl">Review &amp; deploy</h2>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Pandabox builds a single Sui programmable transaction that creates
          the project, mints your admin cap, and opens cycle Nº1.
        </p>
      </div>

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

      <div className="space-y-2">
        <MonoLabel className="block">Pre-flight checks</MonoLabel>
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li
              key={c.label}
              className={cn(
                "flex items-baseline justify-between border-b border-ink/10 pb-1.5",
                !c.ok && "text-poppy",
              )}
            >
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-mono-label text-[10px]",
                    c.ok ? "text-jade" : "text-poppy",
                  )}
                >
                  {c.ok ? "✓" : "·"}
                </span>
                {c.label}
              </span>
              {!c.ok && c.step && (
                <button
                  type="button"
                  onClick={() => setStep(c.step!)}
                  className="font-mono-label text-poppy underline-offset-4 hover:underline"
                >
                  fix in step {String(c.step).padStart(2, "0")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink/15 pt-6">
        {account ? (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            disabled={!ready}
            className={cn(
              "diecut bg-ink px-8 py-4 text-bone transition-colors hover:bg-ink-90",
              !ready && "cursor-not-allowed opacity-40",
            )}
          >
            <span className="font-mono-label">Deploy to Sui →</span>
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

      <Modal
        open={inspectorOpen}
        onClose={() => !submitting && setInspectorOpen(false)}
        title="Transaction inspector"
      >
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Move call preview. Wires to a real Sui PTB in step 13.11; for now
            this stub completes locally and clears the draft.
          </p>
          <div className="border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
            <Row k="module">pandabox</Row>
            <Row k="function">create_project</Row>
            <Row k="arg.name">
              {JSON.stringify(draft.identity.name ?? "")}
            </Row>
            <Row k="arg.ticker">
              {JSON.stringify(draft.identity.ticker ?? "")}
            </Row>
            <Row k="arg.category">{draft.identity.category ?? "—"}</Row>
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
            <Row k="arg.tiers">
              {draft.tiers.enabled ? draft.tiers.list.length : 0}
            </Row>
            <Row k="gas">sponsored</Row>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setInspectorOpen(false)}
              className="diecut border border-ink/40 px-4 py-2 hover:bg-ink hover:text-bone transition-colors"
            >
              <span className="font-mono-label">Cancel</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmit}
              className="diecut bg-ink px-4 py-2 text-bone hover:bg-ink-90"
            >
              <span className="font-mono-label">
                {submitting ? "Signing…" : "Sign & deploy"}
              </span>
            </button>
          </div>
        </div>
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
  out.push({
    label:
      tiers.success && (!draft.tiers.enabled || draft.tiers.list.length > 0)
        ? draft.tiers.enabled
          ? `${draft.tiers.list.length} tier${draft.tiers.list.length === 1 ? "" : "s"} configured`
          : "No tiers (skipped)"
        : "Tiers enabled but no tier defined",
    ok:
      tiers.success && (!draft.tiers.enabled || draft.tiers.list.length > 0),
    step: 5,
  });

  return out;
}
