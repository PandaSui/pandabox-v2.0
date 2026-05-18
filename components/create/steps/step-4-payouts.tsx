"use client";

import { useState } from "react";
import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField } from "../field";
import { StepCard, StepHeader } from "../step-header";
import { SplitsEditor } from "../splits-editor";
import { cn } from "@pandasui/ui/lib";

const MIST = 1_000_000_000n;

export function StepPayoutsForm() {
  const payouts = useWizard((s) => s.draft.payouts);
  const patch = useWizard((s) => s.patchPayouts);
  const setPayoutSplits = useWizard((s) => s.setPayoutSplits);

  const [suiInput, setSuiInput] = useState<number>(() => {
    const mist = BigInt(payouts.payoutLimitMist ?? "0");
    return Number(mist / MIST);
  });

  return (
    <div className="space-y-8">
      <StepHeader
        n={4}
        accent="sun"
        title="Payouts"
        body="How much SUI can leave the treasury each cycle. Anything above the limit becomes surplus, redeemable by token holders."
        meta="per cycle"
      />

      <StepCard title="Payout limit" meta="cap per cycle">
        <Field label="Limit" hint="Per cycle. Inflow above this becomes surplus.">
          {() => (
            <div className="flex max-w-md flex-wrap items-center gap-3">
              <NumberField
                value={suiInput}
                onChange={(v) => {
                  setSuiInput(v);
                  const mist = BigInt(Math.round(Math.max(0, v) * 1e9));
                  patch({ payoutLimitMist: mist.toString() });
                }}
                min={0}
                step={1}
                suffix="SUI"
              />
              <div className="inline-flex border border-ink/25 shadow-offset-sm">
                {(["SUI", "USD"] as const).map((c) => {
                  const active = payouts.payoutCurrency === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ payoutCurrency: c })}
                      aria-pressed={active}
                      className={cn(
                        "px-3 py-1 font-mono-label transition-colors",
                        active
                          ? "bg-ink text-bone"
                          : "text-ink/60 hover:text-ink",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Field>
      </StepCard>

      <StepCard title="Distribution" meta="who receives the payouts">
        <div className="space-y-2">
          <p className="text-xs text-ink/55">
            Leave empty to route all distributed SUI to the project owner.
            Otherwise share between addresses — splits must sum to 100%.
          </p>
          <SplitsEditor
            splits={payouts.splits ?? []}
            onChange={setPayoutSplits}
          />
        </div>
      </StepCard>

      <StepCard title="Surplus" meta="excess inflow">
        <label className="flex cursor-pointer items-start gap-3 select-none">
          <input
            type="checkbox"
            checked={payouts.sendSurplusToOwner ?? true}
            onChange={(e) => patch({ sendSurplusToOwner: e.target.checked })}
            className="mt-1 h-4 w-4 accent-ink"
          />
          <span className="text-sm text-ink/80">
            Route un-distributed surplus to the project owner.
            <span className="block font-mono text-[11px] text-ink/45">
              Otherwise it stays in the treasury, claimable only via token cash-out.
            </span>
          </span>
        </label>
      </StepCard>
    </div>
  );
}
