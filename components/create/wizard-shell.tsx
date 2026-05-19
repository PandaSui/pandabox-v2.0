"use client";

import { useState } from "react";
import { useWizard } from "@/lib/store/wizard";
import { ArrowDiag, Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";
import { Hairline } from "@/components/primitives/hairline";
import { MonoLabel } from "@/components/primitives/mono-label";
import { StepNav } from "./step-nav";
import { PreviewPane } from "./preview-pane";
import { StepIdentityForm } from "./steps/step-1-identity";
import { StepCoinForm } from "./steps/step-2-coin";
import { StepSaleForm } from "./steps/step-3-sale";
import { StepDeployForm } from "./steps/step-4-deploy";

const TOTAL_STEPS = 4;

const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

export function WizardShell() {
  const step = useWizard((s) => s.draft.step);
  const setStep = useWizard((s) => s.setStep);
  const goNext = useWizard((s) => s.goNext);
  const goPrev = useWizard((s) => s.goPrev);
  const reset = useWizard((s) => s.reset);
  const hydrated = useWizard((s) => s.hydrated);
  const [resetOpen, setResetOpen] = useState(false);

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

  const pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-ink/15 bg-bone/85 backdrop-blur">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-4">
          <StepNav current={step} onChange={setStep} />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:inline">
              {pct}% complete
            </span>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 border border-ink/25 bg-bone px-2.5",
                "font-mono-label text-[10px] text-ink/70 transition-all duration-200 ease-atelier",
                "hover:-translate-y-[1px] hover:border-poppy hover:text-poppy hover:shadow-offset-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
              )}
            >
              <span
                aria-hidden
                className="block h-1 w-1 rounded-full bg-poppy/70"
              />
              reset draft
            </button>
          </div>
        </Container>
        <div className="relative h-px w-full bg-ink/10">
          <div
            className="absolute inset-y-0 left-0 bg-saffron transition-[width] duration-500 ease-atelier"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Container className="py-10">
        <div className={cn("grid grid-cols-1 gap-10 lg:grid-cols-[2fr_3fr]")}>
          <div>
            {step === 1 && <StepIdentityForm />}
            {step === 2 && <StepCoinForm />}
            {step === 3 && <StepSaleForm />}
            {step === 4 && <StepDeployForm />}
          </div>

          {/*
           * Sticky live preview. The wizard's top nav band is ~5.5rem tall,
           * so we offset to top-24 and cap the visible region at
           * calc(100vh - 7rem) — enough breathing room that the bottom of
           * the preview card (the Back-this-project CTA + spec strip) always
           * stays on-screen. `overflow-y-auto` lets unusually-tall previews
           * scroll inside the rail instead of getting clipped, and
           * `overscroll-contain` keeps that scroll from bleeding into the
           * outer page.
           */}
          <div
            className={cn(
              "lg:sticky lg:top-24 lg:self-start",
              "lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain",
              "[scrollbar-width:thin]",
            )}
          >
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
              "font-mono-label inline-flex items-center gap-2 px-2 py-2 transition-colors",
              step === 1
                ? "text-ink/30 cursor-not-allowed"
                : "text-ink/70 hover:text-ink",
            )}
          >
            <ArrowDiag size={12} className="rotate-180" /> Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              className={cn(CTA_BASE, "bg-ink text-bone")}
            >
              <span>
                Continue · step {String(step + 1).padStart(2, "0")}
              </span>
              <ArrowDiag size={12} />
            </button>
          ) : (
            <MonoLabel className="text-[10px] text-ink/45">
              review &amp; deploy above
            </MonoLabel>
          )}
        </div>
      </Container>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset draft?"
      >
        <div className="space-y-5">
          <p className="text-sm text-ink/75">
            This clears every field in the wizard and removes the saved draft
            from your browser. Nothing on-chain is affected — you just start
            from a blank form.
          </p>
          <ul className="space-y-1.5 border border-ink/15 bg-bone/60 px-4 py-3 font-mono text-[11px] text-ink/65">
            <li className="flex items-baseline gap-2">
              <span aria-hidden className="block h-1 w-1 rounded-full bg-ink/40" />
              identity, coin, sale, deploy — all wiped
            </li>
            <li className="flex items-baseline gap-2">
              <span aria-hidden className="block h-1 w-1 rounded-full bg-ink/40" />
              <code>pandabox:draft:v3</code> removed from localStorage
            </li>
            <li className="flex items-baseline gap-2">
              <span aria-hidden className="block h-1 w-1 rounded-full bg-ink/40" />
              this cannot be undone
            </li>
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className={cn(
                "inline-flex h-10 items-center justify-center border border-ink/25 bg-bone px-4",
                "font-mono-label text-[10px] text-ink/70 transition-all duration-200 ease-atelier",
                "hover:-translate-y-[1px] hover:border-ink hover:text-ink hover:shadow-offset-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
              )}
            >
              Keep draft
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setResetOpen(false);
              }}
              className={cn(
                "inline-flex h-10 items-center gap-2 border border-ink bg-poppy px-4 text-bone shadow-offset-sm",
                "font-sans font-medium uppercase tracking-[0.12em] text-[0.75rem]",
                "transition-all duration-200 ease-atelier",
                "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
              )}
            >
              <span>Reset draft</span>
              <ArrowDiag size={12} />
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
