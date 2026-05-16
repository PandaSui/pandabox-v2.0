"use client";

import { useState } from "react";
import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField } from "../field";
import { MonoLabel } from "@/components/primitives/mono-label";
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
    <div className="space-y-6">
      <div>
        <MonoLabel>Step 04</MonoLabel>
        <h2 className="mt-1 text-3xl">Payouts</h2>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          How much SUI can leave the treasury each cycle. Anything above the
          limit becomes surplus, redeemable by token holders.
        </p>
      </div>

      <Field label="Payout limit" hint="Per cycle, in SUI">
        {() => (
          <div className="flex max-w-md items-center gap-3">
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
            <div className="inline-flex border border-ink/25">
              {(["SUI", "USD"] as const).map((c) => {
                const active = payouts.payoutCurrency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ payoutCurrency: c })}
                    aria-pressed={active}
                    className={cn(
                      "px-2.5 py-0.5 font-mono-label transition-colors",
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

      <div className="space-y-2">
        <MonoLabel className="block">
          Payout splits (optional — leave empty to send all to project owner)
        </MonoLabel>
        <SplitsEditor
          splits={payouts.splits ?? []}
          onChange={setPayoutSplits}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3 select-none">
        <input
          type="checkbox"
          checked={payouts.sendSurplusToOwner ?? true}
          onChange={(e) =>
            patch({ sendSurplusToOwner: e.target.checked })
          }
          className="h-4 w-4 accent-ink"
        />
        <span className="text-sm text-ink/80">
          Route un-distributed surplus to the project owner (otherwise burned)
        </span>
      </label>
    </div>
  );
}
