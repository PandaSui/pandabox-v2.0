"use client";

import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField } from "../field";
import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/primitives/mono-label";

const DURATIONS = [3, 7, 14, 30];
const BALLOT_DELAYS = [
  { hours: 0, label: "None" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];

const DAY = 86400_000;

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(ts - tz).toISOString().slice(0, 16);
}

function fromLocalInput(s: string): number {
  return new Date(s).getTime();
}

export function StepCyclesForm() {
  const cycles = useWizard((s) => s.draft.cycles);
  const patch = useWizard((s) => s.patchCycles);

  return (
    <div className="space-y-6">
      <div>
        <MonoLabel>Step 02</MonoLabel>
        <h2 className="mt-1 text-3xl">Cycles</h2>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          A cycle is a locked window. Parameters cannot change mid-cycle —
          they queue for the next one, after the ballot delay.
        </p>
      </div>

      <Field
        label="Cycle duration"
        hint="How long each funding window stays open"
      >
        {() => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => {
                const active = cycles.durationDays === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => patch({ durationDays: d })}
                    aria-pressed={active}
                    className={cn(
                      "px-3 py-1.5 font-mono-label border transition-colors",
                      active
                        ? "border-ink bg-ink text-bone"
                        : "border-ink/25 hover:border-ink",
                    )}
                  >
                    {d} days
                  </button>
                );
              })}
              <span className="font-mono-label text-ink/40 self-center">
                · or custom
              </span>
            </div>
            <NumberField
              value={cycles.durationDays ?? 14}
              onChange={(v) => patch({ durationDays: Math.round(v) })}
              min={1}
              max={90}
              suffix="DAYS"
            />
          </div>
        )}
      </Field>

      <Field
        label="Ballot delay"
        hint="Reconfigurations must queue for this long before taking effect"
      >
        {() => (
          <div className="flex flex-wrap gap-1.5">
            {BALLOT_DELAYS.map((b) => {
              const active = cycles.ballotDelayHours === b.hours;
              return (
                <button
                  key={b.hours}
                  type="button"
                  onClick={() => patch({ ballotDelayHours: b.hours })}
                  aria-pressed={active}
                  className={cn(
                    "px-3 py-1.5 font-mono-label border transition-colors",
                    active
                      ? "border-ink bg-ink text-bone"
                      : "border-ink/25 hover:border-ink",
                  )}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      <Field
        label="First cycle starts"
        hint="When supporters can begin paying"
      >
        {(id) => (
          <input
            id={id}
            type="datetime-local"
            value={toLocalInput(cycles.firstCycleStart ?? Date.now() + DAY)}
            onChange={(e) =>
              patch({ firstCycleStart: fromLocalInput(e.target.value) })
            }
            className="h-12 w-full max-w-sm border border-ink/25 bg-bone px-3 font-mono text-sm focus:border-ink focus:outline-none focus:shadow-offset-sm"
          />
        )}
      </Field>
    </div>
  );
}
