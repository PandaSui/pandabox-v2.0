import Link from "next/link";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";

// Same chrome as the hero CTAs — keeps the page's primary actions visually
// synchronized (shadow-offset lift, uppercase tracking, ease-atelier).
const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-14 px-8 font-sans font-medium uppercase tracking-[0.12em] text-[0.8125rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink";
const CTA_INK = "bg-saffron text-ink";
const CTA_SECONDARY = "bg-bone text-ink";

export function FinalCta() {
  return (
    <section className="relative border-y border-ink/15">
      <Container className="relative flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <div className="inline-flex">
          <AccentRule color="saffron">
            <MonoLabel>Ship it</MonoLabel>
          </AccentRule>
        </div>

        <h2 className="mt-5 max-w-3xl text-balance font-display text-4xl leading-[1.05] md:text-6xl">
          Your project, on-chain in 12 minutes.
        </h2>

        <p className="mt-5 max-w-xl text-balance text-base text-ink/65 md:text-lg">
          Configure cycles, payouts, and tokens. Sign one Sui transaction. You
          hold the admin cap.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/create" className={cn(CTA_BASE, CTA_INK)}>
            <span>Launch a project</span>
            <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
              <ArrowDiag size={14} />
            </span>
          </Link>
        </div>

        {/* Spec footnote — mirrors the hero's "real builders" footer */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-ink/15 pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="block h-1 w-1 rounded-full bg-saffron" />
            one transaction
          </span>
          <span className="text-ink/20">·</span>
          <span>gas under $0.001</span>
          <span className="text-ink/20">·</span>
          <span>admin cap minted to you</span>
        </div>
      </Container>
    </section>
  );
}
