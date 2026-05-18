"use client";

import { useWizard } from "@/lib/store/wizard";
import { Field, NumberField } from "../field";
import { StepCard, StepHeader } from "../step-header";
import { cn } from "@pandasui/ui/lib";

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

  const start = cycles.firstCycleStart ?? Date.now() + DAY;
  const durMs = (cycles.durationDays ?? 14) * DAY;
  const end = start + durMs;

  return (
    <div className="space-y-8">
      <StepHeader
        n={2}
        accent="poppy"
        title="Cycles"
        body="A cycle is a locked funding window. Parameters cannot change mid-cycle — they queue for the next one, after the ballot delay."
        meta="cycle Nº1 opens on deploy"
      />

      <StepCard title="Window length" meta="immutable once cycle starts">
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
                        "px-3 py-1.5 font-mono-label border transition-all duration-200 ease-atelier",
                        active
                          ? "border-ink bg-ink text-bone shadow-offset-sm"
                          : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
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
              className="h-12 w-full max-w-md border border-ink/25 bg-bone px-3 font-mono text-sm focus:border-ink focus:outline-none focus:shadow-offset-sm"
            />
          )}
        </Field>

        {/* Mini timeline preview — cycle window as a hairline */}
        <div className="border border-ink/15 bg-bone/40 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono-label text-[10px] text-ink/55">
              cycle Nº1 window
            </span>
            <span className="font-mono text-[10px] text-ink/55">
              {(cycles.durationDays ?? 14)}d
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink/40">
                opens
              </div>
              <div className="mt-0.5">{fmtUtc(start)}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink/40">
                closes
              </div>
              <div className="mt-0.5">{fmtUtc(end)}</div>
            </div>
          </div>
          <div className="relative mt-3 h-2 bg-ink/10">
            <div className="absolute inset-y-0 left-0 right-0 bg-poppy/35" />
            <div className="absolute -top-0.5 left-0 h-3 w-px bg-ink/55" />
            <div className="absolute -top-0.5 right-0 h-3 w-px bg-ink/55" />
          </div>
        </div>
      </StepCard>

      <StepCard title="Governance" meta="ballot delay">
        <Field
          label="Ballot delay"
          hint="Reconfigurations must queue for this long before taking effect on the next cycle"
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
                      "px-3 py-1.5 font-mono-label border transition-all duration-200 ease-atelier",
                      active
                        ? "border-ink bg-ink text-bone shadow-offset-sm"
                        : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
                    )}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      </StepCard>
    </div>
  );
}

function fmtUtc(ts: number): string {
  const d = new Date(ts);
  // YYYY-MM-DD HH:MM UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
