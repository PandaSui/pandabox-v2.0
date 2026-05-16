"use client";

import { useEffect } from "react";
import { useWizard } from "@/lib/store/wizard";
import { cn } from "@/lib/cn";
import { Container } from "@/components/primitives/container";
import { Hairline } from "@/components/primitives/hairline";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Diecut } from "@/components/primitives/diecut";
import { StepNav } from "./step-nav";
import { PreviewPane } from "./preview-pane";
import { StepIdentityForm } from "./steps/step-1-identity";
import { StepCyclesForm } from "./steps/step-2-cycles";
import { StepEconomicsForm } from "./steps/step-3-economics";
import { StepPayoutsForm } from "./steps/step-4-payouts";
import { StepTiersForm } from "./steps/step-5-tiers";
import { StepDeployForm } from "./steps/step-6-deploy";

export function WizardShell() {
  const step = useWizard((s) => s.draft.step);
  const setStep = useWizard((s) => s.setStep);
  const goNext = useWizard((s) => s.goNext);
  const goPrev = useWizard((s) => s.goPrev);
  const reset = useWizard((s) => s.reset);
  const hydrated = useWizard((s) => s.hydrated);

  // Until the persisted store has hydrated, render a skeleton so SSR/CSR markup matches.
  useEffect(() => {
    // no-op; gate is on `hydrated`.
  }, []);

  if (!hydrated) {
    return (
      <Container className="py-12">
        <div className="h-8 w-48 animate-pulse bg-ink/5" />
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[2fr_3fr]">
          <div className="h-96 animate-pulse bg-ink/5" />
          <div className="h-96 animate-pulse bg-ink/5" />
        </div>
      </Container>
    );
  }

  return (
    <>
      <div className="border-b border-ink/15 bg-bone/85 backdrop-blur sticky top-0 z-30">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-4">
          <StepNav current={step} onChange={setStep} />
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear draft and start over?")) reset();
            }}
            className="font-mono-label text-[10px] text-ink/45 hover:text-ink"
          >
            reset draft
          </button>
        </Container>
      </div>

      <Container className="py-10">
        <div className={cn("grid grid-cols-1 gap-10 lg:grid-cols-[2fr_3fr]")}>
          <div>
            {step === 1 && <StepIdentityForm />}
            {step === 2 && <StepCyclesForm />}
            {step === 3 && <StepEconomicsForm />}
            {step === 4 && <StepPayoutsForm />}
            {step === 5 && <StepTiersForm />}
            {step === 6 && <StepDeployForm />}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <PreviewPane />
          </div>
        </div>

        <Hairline className="mt-12" />

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className={cn(
              "font-mono-label px-4 py-2 transition-colors",
              step === 1 ? "text-ink/30 cursor-not-allowed" : "text-ink/70 hover:text-ink",
            )}
          >
            ← Back
          </button>
          {step < 6 ? (
            <button type="button" onClick={goNext}>
              <Diecut className="bg-ink px-5 py-2.5 text-bone hover:bg-ink-90 transition-colors">
                <span className="font-mono-label">
                  Continue · step {String(step + 1).padStart(2, "0")} →
                </span>
              </Diecut>
            </button>
          ) : (
            <MonoLabel className="text-[10px] text-ink/45">
              review &amp; deploy below
            </MonoLabel>
          )}
        </div>
      </Container>
    </>
  );
}
