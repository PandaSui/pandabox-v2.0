"use client";

import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField, TextField } from "../field";
import { MonoLabel } from "@/components/primitives/mono-label";
import { CycleSimulator } from "../cycle-simulator";
import { SplitsEditor } from "../splits-editor";

export function StepEconomicsForm() {
  const draft = useWizard((s) => s.draft);
  const patch = useWizard((s) => s.patchEconomics);
  const setReservedSplits = useWizard((s) => s.setReservedSplits);

  const econ = draft.economics;
  const ticker = draft.identity.ticker ?? "TOK";

  return (
    <div className="space-y-6">
      <div>
        <MonoLabel>Step 03</MonoLabel>
        <h2 className="mt-1 text-3xl">Token economics</h2>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          How tokens are issued, who gets a slice, and how cash-out works.
        </p>
      </div>

      <Field
        label="Initial weight"
        hint="Tokens minted per 1 SUI of inflow this cycle"
      >
        {(id) => (
          <TextField
            id={id}
            value={econ.weight ?? "1000000"}
            onChange={(v) =>
              patch({ weight: v.replace(/\D/g, "") || "0" })
            }
            placeholder="1000000"
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Field label="Reserved rate" hint="0–50%">
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
        <Field label="Issuance reduction" hint="0–20% each next cycle">
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
        <Field label="Cash-out tax" hint="0–100% on surplus claims">
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
      </div>

      {(econ.reservedRate ?? 0) > 0 && (
        <div className="space-y-2">
          <MonoLabel className="block">
            Reserved split — who gets the {econ.reservedRate}% reserved
          </MonoLabel>
          <SplitsEditor
            splits={econ.reservedSplits ?? []}
            onChange={setReservedSplits}
          />
        </div>
      )}

      <CycleSimulator
        weight={econ.weight ?? "0"}
        reservedRate={econ.reservedRate ?? 0}
        cashOutTax={econ.cashOutTax ?? 0}
        payoutLimitMist={draft.payouts.payoutLimitMist ?? "0"}
        ticker={ticker}
      />
    </div>
  );
}
