import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";

export const metadata: Metadata = {
  title: "404 · Not found",
  description: "No signal on this route.",
  robots: { index: false, follow: false },
};

/**
 * Global 404 page. The conceptual conceit: Pandabox's signature kinetic
 * element is the Treasury Pulse — a hairline that breathes when the chain
 * breathes. On a route that doesn't exist, the pulse flatlines. The visual
 * pun carries the page; everything else is restrained recovery copy.
 *
 * Plum is the accent — it's the design system's "historical / archive"
 * semantic, fitting for "this isn't where you wanted to go."
 */
export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="border-t border-ink/15">
        <Container className="py-16 md:py-24">
          {/* ─── Eyebrow: 404 · NOT FOUND ─────────────────────────── */}
          <div className="inline-flex items-center gap-2 border border-plum/40 bg-plum/10 px-2.5 py-1">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-plum"
            />
            <MonoLabel className="text-[11px]" accent="plum">
              404 · ROUTE NOT FOUND
            </MonoLabel>
          </div>

          {/* ─── The flatlined Treasury Pulse ─────────────────────── */}
          <FlatPulse />

          {/* ─── Spec block: status sheet ─────────────────────────── */}
          <dl className="mt-10 grid max-w-md grid-cols-[6.5rem_1fr] gap-x-6 gap-y-2 font-mono text-[12px]">
            <Row label="STATUS" value="NOT FOUND" tone="plum" />
            <Row label="SIGNAL" value="—" />
            <Row label="CYCLE" value="—" />
          </dl>

          {/* ─── Headline + body ──────────────────────────────────── */}
          <h1 className="mt-10 font-display text-5xl leading-[0.95] tracking-tight md:text-7xl">
            No signal on this route.
          </h1>
          <p className="mt-5 max-w-prose text-base text-ink/70 md:text-lg">
            Pandabox couldn't find what you were looking for. Either the URL
            drifted between cycles, or this page was never on-chain to begin
            with. Pick one of the live routes below — they're all paying out
            signal.
          </p>

          {/* ─── Recovery CTAs ────────────────────────────────────── */}
          <div className="mt-10 flex flex-wrap gap-3">
            <RecoveryCta
              href="/explore"
              accent="saffron"
              label="Explore projects"
            />
            <RecoveryCta
              href="/create"
              accent="poppy"
              label="Launch a project"
            />
            <RecoveryCta href="/docs" accent="sky" label="Read the docs" />
          </div>

          {/* ─── Home link, restrained ────────────────────────────── */}
          <div className="mt-6">
            <Link
              href="/"
              className="font-mono-label text-[11px] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
            >
              back to pandabox.money
            </Link>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

/* ─────────────────────────── Flatlined pulse ─────────────────────────── */

/**
 * A static SVG that visually quotes the Treasury Pulse — but with no peaks.
 * Two diecut tick marks anchor the start and end of the line so the canvas
 * still reads as the same component family, just silent.
 */
function FlatPulse() {
  return (
    <figure
      className="relative mt-10 overflow-hidden border border-ink/20 bg-bone/40"
      aria-label="Treasury Pulse — flatlined"
    >
      <svg
        viewBox="0 0 720 120"
        width="100%"
        height="120"
        preserveAspectRatio="none"
        aria-hidden
        style={{ display: "block" }}
      >
        {/* Frame ticks — small vertical marks at the edges, mimicking the
            tick rhythm of an active pulse but compressed to nothing in the
            middle. */}
        <rect
          x="12"
          y="48"
          width="2"
          height="24"
          fill="currentColor"
          opacity="0.25"
        />
        <rect
          x="706"
          y="48"
          width="2"
          height="24"
          fill="currentColor"
          opacity="0.25"
        />

        {/* The flat line — a single 1px hairline through the middle. */}
        <line
          x1="14"
          y1="60"
          x2="706"
          y2="60"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.55"
        />

        {/* A single plum tick at the right edge — the last recorded signal
            before this route went dark. Static; no animation. */}
        <circle cx="690" cy="60" r="3" fill="#7E685E" />
      </svg>
      <figcaption className="sr-only">
        No payment events on this route. Pandabox cannot render a pulse for a
        page that does not exist.
      </figcaption>
    </figure>
  );
}

/* ───────────────────────────── Spec row ───────────────────────────────── */

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "plum";
}) {
  return (
    <>
      <dt className="text-ink/40 tracking-[0.14em] uppercase">{label}</dt>
      <dd className={tone === "plum" ? "text-plum" : "text-ink/80"}>{value}</dd>
    </>
  );
}

/* ───────────────────────────── Recovery CTA ───────────────────────────── */

const CTA_BG: Record<"saffron" | "poppy" | "sky", string> = {
  saffron: "bg-saffron/15 hover:bg-saffron/25",
  poppy: "bg-poppy/15 hover:bg-poppy/25",
  sky: "bg-sky/15 hover:bg-sky/25",
};

const CTA_DOT: Record<"saffron" | "poppy" | "sky", string> = {
  saffron: "bg-saffron",
  poppy: "bg-poppy",
  sky: "bg-sky",
};

function RecoveryCta({
  href,
  accent,
  label,
}: {
  href: string;
  accent: "saffron" | "poppy" | "sky";
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 ${CTA_BG[accent]} px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink transition-colors`}
    >
      <span
        aria-hidden
        className={`block h-1.5 w-1.5 rounded-full ${CTA_DOT[accent]}`}
      />
      {label}
    </Link>
  );
}
