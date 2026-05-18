"use client";

import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField, TextField } from "../field";
import { StepCard, StepHeader } from "../step-header";
import { CycleSimulator } from "../cycle-simulator";
import { SplitsEditor } from "../splits-editor";

export function StepEconomicsForm() {
  const draft = useWizard((s) => s.draft);
  const patch = useWizard((s) => s.patchEconomics);
  const setReservedSplits = useWizard((s) => s.setReservedSplits);

  const econ = draft.economics;
  const ticker = draft.identity.ticker ?? "TOK";

  return (
    <div className="space-y-8">
      <StepHeader
        n={3}
        accent="jade"
        title="Token economics"
        body="How tokens are issued, who gets a slice, and how cash-out works. These rates are immutable on deploy except via queued reconfiguration."
        meta={`ticker · ${ticker}`}
      />

      <StepCard title="Issuance" meta="weight = tokens / SUI">
        <Field
          label="Initial weight"
          hint="Whole tokens minted per 1 SUI of inflow during cycle Nº1"
        >
          {(id) => (
            <TextField
              id={id}
              value={econ.weight ?? "1000000"}
              onChange={(v) => patch({ weight: v.replace(/\D/g, "") || "0" })}
              placeholder="1000000"
            />
          )}
        </Field>

        <Field label="Issuance reduction" hint="Drop in weight each next cycle · 0–20%">
          {() => (
            <NumberField
              value={econ.issuanceReduction ?? 0}
              onChange={(v) =>
                patch({ issuanceReduction: Math.max(0, Math.min(20, v)) })
              }
              min={0}
              max={20}
              step={1}
              suffix="%"
            />
          )}
        </Field>
      </StepCard>

      <StepCard title="Reserved rate" meta="held back from new tokens">
        <Field
          label="Reserved rate"
          hint="Share of newly minted tokens held back for splits · 0–50%"
        >
          {() => (
            <NumberField
              value={econ.reservedRate ?? 0}
              onChange={(v) =>
                patch({ reservedRate: Math.max(0, Math.min(50, v)) })
              }
              min={0}
              max={50}
              step={1}
              suffix="%"
            />
          )}
        </Field>

        {(econ.reservedRate ?? 0) > 0 && (
          <div className="space-y-2 border-t border-ink/10 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono-label text-[10px] text-ink/55">
                Reserved split — who gets the {econ.reservedRate}% reserved
              </span>
              <span className="font-mono text-[10px] text-ink/45">
                must sum to 100%
              </span>
            </div>
            <SplitsEditor
              splits={econ.reservedSplits ?? []}
              onChange={setReservedSplits}
            />
          </div>
        )}
      </StepCard>

      <StepCard title="Cash-out" meta="surplus claims">
        <Field
          label="Cash-out tax"
          hint="% withheld when token-holders burn to claim treasury surplus · 0–100%"
        >
          {() => (
            <NumberField
              value={econ.cashOutTax ?? 0}
              onChange={(v) =>
                patch({ cashOutTax: Math.max(0, Math.min(100, v)) })
              }
              min={0}
              max={100}
              step={1}
              suffix="%"
            />
          )}
        </Field>
      </StepCard>

      <StepCard title="Live simulator" meta="based on current params">
        <CycleSimulator
          weight={econ.weight ?? "0"}
          reservedRate={econ.reservedRate ?? 0}
          cashOutTax={econ.cashOutTax ?? 0}
          payoutLimitMist={draft.payouts.payoutLimitMist ?? "0"}
          ticker={ticker}
        />
      </StepCard>
    </div>
  );
}
