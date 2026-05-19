"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDiag } from "@pandasui/ui";
import { gsap, ScrollTrigger, registerGsap } from "@pandasui/ui/lib";
import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";

type Accent = "saffron" | "poppy" | "jade";

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
};

// Paper-tinted card backgrounds — ~12% of the accent mixed into bone (#F7F1E3),
// pre-computed so we don't depend on color-mix() support. Each card reads as
// its own warmly-tinted sheet rather than identical bone, which is what gives
// the section its colorful, magazine-spread feeling.
const ACCENT_TINT: Record<Accent, string> = {
  saffron: "#EFECD3",
  poppy: "#F1E2D2",
  jade: "#E7E5D3",
};

// A second, deeper tint reserved for the header band — gives each card a
// printed-folder "tab" feel without breaking the bone palette.
const ACCENT_TINT_DEEP: Record<Accent, string> = {
  saffron: "#E5E2BF",
  poppy: "#EBD0BC",
  jade: "#D8DABE",
};

type Step = {
  number: string;
  accent: Accent;
  phase: string;
  heading: string;
  body: string;
  outcome: string;
  meta: string;
  Diagram: () => React.ReactElement;
  GlyphIcon: (props: { color: string }) => React.ReactElement;
};

const STEPS: Step[] = [
  {
    number: "01",
    accent: "saffron",
    phase: "Configure",
    heading: "Deploy",
    body: "Configure cycles, payouts, tokens, and optional NFT tiers. Sign one Sui transaction. Your project goes live with an admin cap object you own.",
    outcome: "AdminCap minted",
    meta: "pandabox::create_project",
    Diagram: DeployDiagram,
    GlyphIcon: GlyphStamp,
  },
  {
    number: "02",
    accent: "poppy",
    phase: "Inflow",
    heading: "Receive",
    body: "Supporters pay SUI directly to your treasury. They receive project tokens at your cycle's weight, plus tier NFTs if you defined any.",
    outcome: "Tokens minted",
    meta: "pandabox::pay → Paid event",
    Diagram: ReceiveDiagram,
    GlyphIcon: GlyphInflow,
  },
  {
    number: "03",
    accent: "jade",
    phase: "Govern",
    heading: "Reconfigure",
    body: "Propose changes for the next cycle. After the ballot delay, the new parameters lock in. Holders can cash out surplus at any time.",
    outcome: "Cycle queued",
    meta: "queue_reconfiguration · ballot 4d 12h",
    Diagram: ReconfigureDiagram,
    GlyphIcon: GlyphLedger,
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const activeNumRef = useRef<HTMLSpanElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    registerGsap();
    const section = sectionRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!section || !left || !right) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const mm = gsap.matchMedia();

    // Pin the left column while the right column scrolls — desktop only.
    mm.add("(min-width: 1024px)", () => {
      ScrollTrigger.create({
        trigger: right,
        start: "top top+=110",
        endTrigger: right,
        end: "bottom bottom-=60",
        pin: left,
        pinSpacing: false,
      });
    });

    const ctx = gsap.context(() => {
      const cards = cardsRef.current.filter(
        (c): c is HTMLElement => c !== null,
      );

      if (!reduce) {
        // Staggered entrance — cards rise into place from below.
        gsap.set(cards, { y: 48, opacity: 0 });
        gsap.to(cards, {
          y: 0,
          opacity: 1,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: {
            trigger: right,
            start: "top 82%",
            toggleActions: "play none none none",
          },
        });

        cards.forEach((card) => {
          const watermark =
            card.querySelector<HTMLElement>("[data-watermark]");
          const halo = card.querySelector<HTMLElement>("[data-halo]");
          const diagramFrame =
            card.querySelector<HTMLElement>("[data-diagram-frame]");
          const accentRule =
            card.querySelector<HTMLElement>("[data-accent-rule]");
          const heading = card.querySelector<HTMLElement>("[data-heading]");
          const body = card.querySelector<HTMLElement>("[data-body]");
          const outcomeUnderline = card.querySelector<HTMLElement>(
            "[data-outcome-underline]",
          );
          const glyphIcon =
            card.querySelector<HTMLElement>("[data-glyph-icon]");
          const glyphTick =
            card.querySelector<HTMLElement>("[data-glyph-tick]");

          if (watermark) {
            gsap.fromTo(
              watermark,
              { x: 28, opacity: 0 },
              {
                x: 0,
                opacity: 0.08,
                duration: 1.1,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: card,
                  start: "top 85%",
                  once: true,
                },
              },
            );
          }

          // Per-card entrance timeline — accent rule paints in, heading +
          // body fade up, outcome underline draws, diagram window opens like
          // a shutter from its center.
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: "top 80%",
              once: true,
            },
          });
          if (accentRule) {
            tl.to(
              accentRule,
              { scaleX: 1, duration: 0.55, ease: "power3.out" },
              0,
            );
          }
          if (heading) {
            tl.fromTo(
              heading,
              { y: 14, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
              0.08,
            );
          }
          if (body) {
            tl.fromTo(
              body,
              { y: 10, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
              0.22,
            );
          }
          if (outcomeUnderline) {
            tl.to(
              outcomeUnderline,
              { scaleX: 1, duration: 0.55, ease: "power3.out" },
              0.35,
            );
          }
          if (diagramFrame) {
            // "Shutter" reveal — the window opens from its horizontal axis,
            // exposing the running diagram inside.
            tl.fromTo(
              diagramFrame,
              { scaleY: 0, transformOrigin: "50% 50%" },
              { scaleY: 1, duration: 0.7, ease: "power3.out" },
              0.18,
            );
          }
          if (glyphTick) {
            tl.fromTo(
              glyphTick,
              { scale: 0, transformOrigin: "50% 50%" },
              { scale: 1, duration: 0.4, ease: "back.out(2.2)" },
              0.4,
            );
          }

          const enter = () => {
            gsap.to(card, { y: -4, duration: 0.4, ease: "power3.out" });
            if (halo) {
              gsap.to(halo, { opacity: 1, duration: 0.5, ease: "power2.out" });
            }
            if (diagramFrame) {
              gsap.to(diagramFrame, {
                x: -2,
                y: -2,
                duration: 0.4,
                ease: "power3.out",
              });
            }
            // Glyph wiggle — a slight rotate + scale punch on hover. Keeps
            // the icon feeling responsive without ever spinning.
            if (glyphIcon) {
              gsap.to(glyphIcon, {
                rotate: 6,
                scale: 1.12,
                duration: 0.45,
                ease: "back.out(2)",
                transformOrigin: "50% 50%",
              });
            }
          };
          const leave = () => {
            gsap.to(card, { y: 0, duration: 0.5, ease: "power3.out" });
            if (halo) {
              gsap.to(halo, { opacity: 0, duration: 0.45, ease: "power2.out" });
            }
            if (diagramFrame) {
              gsap.to(diagramFrame, {
                x: 0,
                y: 0,
                duration: 0.45,
                ease: "power3.out",
              });
            }
            if (glyphIcon) {
              gsap.to(glyphIcon, {
                rotate: 0,
                scale: 1,
                duration: 0.5,
                ease: "power3.out",
              });
            }
          };
          card.addEventListener("pointerenter", enter);
          card.addEventListener("pointerleave", leave);
        });
      }

      // Active-step tracking — swap the left panel as each card crosses center.
      cards.forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top center+=40",
          end: "bottom center",
          onEnter: () => setActiveStep(i),
          onEnterBack: () => setActiveStep(i),
        });
      });
    }, section);

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  // Animate the big number swap when the active step changes.
  useEffect(() => {
    const el = activeNumRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      el,
      { y: -14, opacity: 0, filter: "blur(4px)" },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.5,
        ease: "power3.out",
      },
    );
  }, [activeStep]);

  // Pulse the active card — fade in its inset accent ring and tick the watermark
  // a touch brighter so the user can locate which station the left rail is
  // tracking even when the right column is fully on screen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = cardsRef.current;
    cards.forEach((card, i) => {
      if (!card) return;
      const ring = card.querySelector<HTMLElement>("[data-active-ring]");
      const watermark = card.querySelector<HTMLElement>("[data-watermark]");
      const isActive = i === activeStep;
      if (ring) {
        gsap.to(ring, {
          opacity: isActive ? 0.55 : 0,
          duration: 0.45,
          ease: "power2.out",
        });
      }
      if (watermark) {
        gsap.to(watermark, {
          opacity: isActive ? 0.14 : 0.08,
          duration: 0.5,
          ease: "power2.out",
        });
      }
    });
  }, [activeStep]);

  const active = STEPS[activeStep];

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden border-t border-ink/15"
    >
      <Container className="py-20 lg:py-28">
        {/* Eyebrow band — matches the section's voice across the landing */}
        <div className="mb-12 flex items-center gap-4 md:mb-16">
          <AccentRule color="saffron" className="!pt-0">
            <MonoLabel>How it works</MonoLabel>
          </AccentRule>
          <span aria-hidden className="h-px flex-1 bg-ink/10" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-ink/40 md:inline">
            03 moves · idea → on-chain
          </span>
        </div>

        <div className="grid grid-cols-12 items-start gap-y-14 lg:gap-x-14">
          {/* ─── Left rail (pinned on desktop) ─────────────── */}
          <div
            ref={leftRef}
            className="col-span-12 lg:col-span-5 will-change-transform"
          >
            <h2 className="text-balance font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[0.95] tracking-tight">
              Three steps from idea to on-chain funding.
            </h2>
            <p className="mt-5 max-w-prose text-pretty text-base text-ink/65 md:text-[1.0625rem]">
              Every parameter you configure here becomes a Move call. Every
              interaction your supporters take becomes a transaction. Pandabox
              is what's between.
            </p>

            {/* Now-viewing panel — light, hairline-bordered, ink-on-bone */}
            <div className="relative mt-9 overflow-hidden border border-ink bg-bone shadow-offset-sm">
              {/* Soft accent wash, swaps color with active step */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full opacity-[0.22] blur-[80px] transition-colors duration-700"
                style={{ background: ACCENT_HEX[active.accent] }}
              />

              <div className="relative p-6 md:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-500"
                    style={{ color: ACCENT_HEX[active.accent] }}
                  >
                    <span
                      className="block h-1.5 w-1.5 rounded-full transition-colors duration-500"
                      style={{ background: ACCENT_HEX[active.accent] }}
                    />
                    Now viewing
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-ink/45">
                    {String(activeStep + 1).padStart(2, "0")} / 03
                  </span>
                </div>

                <div className="flex items-start gap-5">
                  <span
                    ref={activeNumRef}
                    key={active.number}
                    className="font-display text-[4.5rem] leading-none tabular-nums transition-colors duration-500 md:text-[5.25rem]"
                    style={{ color: ACCENT_HEX[active.accent] }}
                  >
                    {active.number}
                  </span>
                  <div className="pt-1.5">
                    <div
                      className="font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-500"
                      style={{ color: ACCENT_HEX[active.accent] }}
                    >
                      {active.phase}
                    </div>
                    <div className="mt-1.5 max-w-[18ch] font-display text-[1.4rem] leading-[1.05]">
                      {active.heading}
                    </div>
                  </div>
                </div>

                {/* Segmented progress — three hairline cells */}
                <div className="mt-7 grid grid-cols-3 gap-1.5">
                  {STEPS.map((s, i) => (
                    <div
                      key={s.number}
                      className="h-1 overflow-hidden bg-ink/10"
                    >
                      <div
                        className="h-full transition-all duration-700 ease-out"
                        style={{
                          width: i <= activeStep ? "100%" : "0%",
                          background: ACCENT_HEX[s.accent],
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                  <span>Deploy</span>
                  <span>Reconfigure</span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/create"
                className={cn(
                  "group relative inline-flex h-12 items-center justify-center gap-2 border border-ink bg-saffron px-6",
                  "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink",
                  "shadow-offset-sm transition-all duration-300 ease-atelier",
                  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
                )}
              >
                <span>Launch a project</span>
                <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
                  <ArrowDiag size={12} />
                </span>
              </Link>
              <Link
                href="/docs"
                className={cn(
                  "group inline-flex h-12 items-center justify-center gap-2 border border-ink bg-bone px-6",
                  "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink",
                  "shadow-offset-sm transition-all duration-300 ease-atelier",
                  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                )}
              >
                <span>Read the docs</span>
                <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
                  <ArrowDiag size={12} />
                </span>
              </Link>
            </div>
          </div>

          {/* ─── Right rail (scrolling station cards) ─────────── */}
          <div
            ref={rightRef}
            className="col-span-12 flex flex-col gap-6 lg:col-span-7 lg:gap-8"
          >
            {STEPS.map((step, i) => (
              <StepCard
                key={step.number}
                step={step}
                ref={(el: HTMLElement | null) => {
                  cardsRef.current[i] = el;
                }}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ─────────────────────────── Card ─────────────────────────── */

const StepCard = ({
  step,
  ref,
}: {
  step: Step;
  ref: (el: HTMLElement | null) => void;
}) => {
  const { number, accent, phase, heading, body, outcome, meta, Diagram, GlyphIcon } =
    step;
  const accentHex = ACCENT_HEX[accent];
  const tint = ACCENT_TINT[accent];
  const tintDeep = ACCENT_TINT_DEEP[accent];

  return (
    <article
      ref={ref}
      className={cn(
        "group relative overflow-hidden border border-ink shadow-offset-sm",
        "transition-shadow duration-300 ease-atelier",
      )}
      style={{ background: tint }}
    >
      {/* Top accent spine — the "folder tab" giving each card its color identity */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[3px]"
        style={{ background: accentHex }}
      />

      {/* Active-step ring — inset accent border that fades in via GSAP when
          this card is the one currently being tracked in the left rail. */}
      <span
        aria-hidden
        data-active-ring
        className="pointer-events-none absolute inset-0 z-10 opacity-0"
        style={{ boxShadow: `inset 0 0 0 2px ${accentHex}` }}
      />

      {/* Hover halo — fades in via GSAP */}
      <div
        aria-hidden
        data-halo
        className="pointer-events-none absolute -right-24 -top-28 h-[22rem] w-[22rem] rounded-full opacity-0 blur-[110px]"
        style={{ background: accentHex }}
      />

      {/* Soft radial wash anchored to the top-right — gives the surface depth
          without ever resembling a glow effect. Always on, low intensity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full opacity-[0.18] blur-[120px]"
        style={{ background: accentHex }}
      />

      {/* Watermark — outsized accent number behind the card */}
      <span
        aria-hidden
        data-watermark
        className="pointer-events-none absolute -top-4 right-2 select-none font-display text-[11rem] leading-none tracking-[-0.05em] opacity-0 md:right-4 md:text-[15rem]"
        style={{ color: accentHex }}
      >
        {number}
      </span>

      {/* Decorative dotted arc, top-left */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -left-6 -top-6 opacity-30"
        width="140"
        height="140"
        viewBox="0 0 140 140"
      >
        <circle
          cx="70"
          cy="70"
          r="58"
          fill="none"
          stroke={accentHex}
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        <circle
          cx="70"
          cy="70"
          r="42"
          fill="none"
          stroke={accentHex}
          strokeWidth="0.8"
          strokeDasharray="1 5"
          opacity="0.7"
        />
      </svg>

      {/* Header band — sits over the deeper accent tint */}
      <header
        className="relative flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-6 py-4 md:px-8 md:py-5"
        style={{ background: tintDeep }}
      >
        <div className="inline-flex items-center gap-4">
          {/* Glyph rides on a soft accent halo — no border, no clip-path, just
              a radial wash so the icon reads as floating on color rather than
              boxed in. The bg is a radial gradient that fades into the header
              tint, giving it edge-less integration. */}
          <span
            data-glyph
            className="relative inline-flex h-12 w-12 items-center justify-center"
            style={{
              background: `radial-gradient(circle at center, ${accentHex}55 0%, ${accentHex}1c 55%, transparent 78%)`,
            }}
          >
            {/* Tiny accent corner tick — a "registered" mark, ink-thin, the
                only piece of geometry the glyph carries. */}
            <span
              aria-hidden
              data-glyph-tick
              className="absolute right-0 top-0 h-1.5 w-1.5"
              style={{ background: accentHex }}
            />
            <span data-glyph-icon className="inline-flex">
              <GlyphIcon color={accentHex} />
            </span>
          </span>
          <div className="flex flex-col">
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: accentHex }}
            >
              Step {number} · {phase}
            </span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              on-chain · sui move
            </span>
          </div>
        </div>
        {/* Outcome reads as a console status line — a pulsing accent dot, a
            mono label in ink, and a hairline accent underline that bleeds
            into the header tint. No pill, no border to "cut". */}
        <span className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/85">
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{
              background: accentHex,
              boxShadow: `0 0 0 3px ${accentHex}33`,
            }}
          />
          <span className="relative pb-1">
            {outcome}
            <span
              aria-hidden
              data-outcome-underline
              className="absolute inset-x-0 bottom-0 origin-left"
              style={{
                height: "1.5px",
                background: accentHex,
                transform: "scaleX(0)",
              }}
            />
          </span>
        </span>
      </header>

      {/* Body — copy left, animated diagram right (stacks on small screens) */}
      <div className="relative grid grid-cols-1 gap-6 px-6 py-7 md:grid-cols-[1.1fr_1fr] md:gap-8 md:px-8 md:py-9">
        <div className="relative flex flex-col">
          {/* Tiny accent rule above the heading — color punctuation */}
          <span
            aria-hidden
            data-accent-rule
            className="mb-3 block h-1 w-10 origin-left"
            style={{ background: accentHex, transform: "scaleX(0)" }}
          />
          <h3
            data-heading
            className="font-display text-[clamp(1.7rem,2.5vw,2.4rem)] leading-[1.02] tracking-tight"
          >
            {heading}
          </h3>
          <p
            data-body
            className="mt-3 max-w-[44ch] text-pretty text-[14.5px] leading-relaxed text-ink/70"
          >
            {body}
          </p>
        </div>

        {/* Diagram preview window — bone surface against the tinted card.
            The "window" effect comes from a soft accent fade at the edges
            instead of a hard border; a thin accent tape across the top ties
            it to the card's spine. */}
        <div
          data-diagram-frame
          className="relative h-[200px] overflow-hidden bg-bone transition-transform duration-300 ease-atelier md:h-[230px]"
          style={{
            boxShadow: `inset 0 0 0 1px ${accentHex}33, inset 0 18px 30px -22px ${accentHex}44`,
          }}
        >
          {/* Accent tape running across the top — ties this window to the
              card's spine. Two-stop gradient so it fades into the tint. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, ${accentHex} 0%, ${accentHex}66 65%, transparent 100%)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #161310 1px, transparent 1.2px)",
              backgroundSize: "12px 12px",
            }}
          />
          <div className="relative h-full">
            <Diagram />
          </div>
          {/* Status indicator — borderless, just a pulsing dot + accent label
              floating in the corner. Blends into the bone surface. */}
          <span
            className="absolute bottom-2.5 right-3 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: accentHex }}
          >
            <span
              className="block h-1 w-1 rounded-full"
              style={{
                background: accentHex,
                animation: "stat-live-dot 1.4s ease-in-out infinite",
              }}
            />
            Live
          </span>
        </div>
      </div>

      {/* Meta footer — keyed to the accent so the on-chain call reads as part
          of the card's identity, not boilerplate. */}
      <footer
        className="relative flex items-center justify-between gap-3 border-t border-ink/15 px-6 py-3 md:px-8"
        style={{ background: tintDeep }}
      >
        <div className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: accentHex }}
          />
          <code
            className="font-mono text-[11px] font-medium"
            style={{ color: "#161310" }}
          >
            {meta}
          </code>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40 md:inline">
          {number} / 03
        </span>
      </footer>
    </article>
  );
};

/* ─────────────────────────── Header glyphs ─────────────────────────── */

function GlyphStamp({ color }: { color: string }) {
  // A diecut octagon — visual echo of the project object being minted on-chain.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <polygon
        points="5,1 13,1 17,5 17,13 13,17 5,17 1,13 1,5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="9" cy="9" r="1.6" fill={color} />
    </svg>
  );
}

function GlyphInflow({ color }: { color: string }) {
  // Arrow into a chamber — payment flowing into the treasury.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2 9 L11 9"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6 L11 9 L8.5 12"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 3.5 L16 3.5 L16 14.5 L12 14.5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function GlyphLedger({ color }: { color: string }) {
  // Three stacked rows — a ledger / cycle log being amended.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3"
        width="13"
        height="12"
        stroke={color}
        strokeWidth="1.4"
        fill="none"
      />
      <line x1="5" y1="7" x2="13" y2="7" stroke={color} strokeWidth="1.2" />
      <line x1="5" y1="10" x2="11" y2="10" stroke={color} strokeWidth="1.2" />
      <line
        x1="5"
        y1="13"
        x2="9"
        y2="13"
        stroke={color}
        strokeWidth="1.2"
      />
    </svg>
  );
}

/* ───────────────────────── Diagrams (preserved) ───────────────────────── */

function DeployDiagram() {
  const color = ACCENT_HEX.saffron;
  // Eight hairlines stitching from edges toward the central object.
  const lines = [
    { x1: 20, y1: 30, x2: 130, y2: 95 },
    { x1: 260, y1: 24, x2: 150, y2: 95 },
    { x1: 18, y1: 170, x2: 130, y2: 110 },
    { x1: 260, y1: 175, x2: 150, y2: 110 },
    { x1: 90, y1: 18, x2: 138, y2: 80 },
    { x1: 190, y1: 18, x2: 142, y2: 80 },
    { x1: 90, y1: 180, x2: 138, y2: 122 },
    { x1: 190, y1: 180, x2: 142, y2: 122 },
  ];
  // Diecut octagon centered at (140, 100), half-size 30, notch 10.
  const octagon = "120,70 160,70 170,80 170,120 160,130 120,130 110,120 110,80";
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {lines.map((l, i) => {
        const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
        return (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={color}
            strokeWidth="0.9"
            strokeLinecap="round"
            style={
              {
                strokeDasharray: len,
                strokeDashoffset: len,
                animation: `hiw-stitch 3.6s ease-out ${i * 0.12}s infinite alternate`,
                ["--len"]: String(len),
              } as React.CSSProperties
            }
          />
        );
      })}

      <g
        className="hiw-fb"
        style={{
          animation: "hiw-pulse-scale 3.6s ease-in-out infinite",
          transformOrigin: "140px 100px",
        }}
      >
        <polygon
          points={octagon}
          fill={color}
          opacity="0.18"
          stroke={color}
          strokeWidth="1.2"
        />
        <polygon
          points={octagon}
          fill="none"
          stroke="#161310"
          strokeWidth="1"
        />
        <circle cx="140" cy="96" r="3" fill="#161310" />
        <rect x="130" y="104" width="20" height="3" fill="#161310" />
        <rect
          x="134"
          y="111"
          width="12"
          height="2"
          fill="#161310"
          opacity="0.6"
        />
      </g>

      <g
        style={{
          animation: "hiw-dot-pulse 3.6s ease-in-out 1.4s infinite",
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      >
        <rect
          x="196"
          y="86"
          width="58"
          height="28"
          fill="#F7F1E3"
          stroke="#161310"
          strokeWidth="1"
        />
        {[
          [0, 0],
          [2, 0],
          [4, 0],
          [1, 1],
          [3, 1],
          [0, 2],
          [2, 2],
          [4, 2],
          [1, 3],
          [3, 3],
          [2, 4],
        ].map(([cx, cy], i) => (
          <rect
            key={i}
            x={200 + cx * 4}
            y={90 + cy * 4}
            width="3"
            height="3"
            fill={color}
            opacity={0.4 + (i % 3) * 0.2}
          />
        ))}
        <text
          x="225"
          y="108"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.14em"
        >
          ADMINCAP
        </text>
      </g>

      {[0, 0.6, 1.2, 1.8].map((d, i) => (
        <circle
          key={i}
          cx="140"
          cy="100"
          r="1.5"
          fill={color}
          style={{
            animation: `hiw-dot-pulse 1.8s ease-in-out ${d}s infinite`,
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
        />
      ))}
    </svg>
  );
}

function ReceiveDiagram() {
  const color = ACCENT_HEX.poppy;
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "hiw-dot-pulse 2.4s ease-in-out infinite",
        }}
      >
        <circle cx="40" cy="100" r="6" fill={color} />
        <circle
          cx="40"
          cy="100"
          r="11"
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity="0.35"
        />
      </g>
      <text
        x="40"
        y="132"
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="7"
        fill="#161310"
        opacity="0.5"
        letterSpacing="0.14em"
      >
        SUPPORTER
      </text>

      <line
        x1="56"
        x2="206"
        y1="100"
        y2="100"
        stroke="rgba(22,19,16,0.22)"
        strokeWidth="1"
      />
      <line
        x1="56"
        x2="206"
        y1="100"
        y2="100"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray="2 4"
        opacity="0.5"
      />

      {[0, 1, 2].map((i) => (
        <g
          key={i}
          style={{
            transform: "translateX(0)",
            animation: `hiw-coin-flow 2.7s linear ${i * 0.9}s infinite`,
          }}
        >
          <g transform="translate(60, 100)">
            <circle r="6.5" fill="#F7F1E3" stroke="#161310" strokeWidth="1" />
            <path
              d="M-2.6 -3 L0 -5.5 L2.6 -3 A4 4 0 1 1 -2.6 -3 Z"
              fill="none"
              stroke={color}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>
        </g>
      ))}

      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "hiw-treasury-thump 2.7s ease-out 1.4s infinite",
        }}
      >
        <polygon
          points="222,80 252,80 262,90 262,116 252,126 222,126 212,116 212,90"
          fill={color}
          opacity="0.16"
          stroke={color}
          strokeWidth="1"
        />
        <polygon
          points="222,80 252,80 262,90 262,116 252,126 222,126 212,116 212,90"
          fill="none"
          stroke="#161310"
          strokeWidth="1"
        />
        <text
          x="237"
          y="106"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.7"
          letterSpacing="0.14em"
        >
          TREASURY
        </text>
      </g>

      <g
        style={{
          animation: "hiw-text-swap 2.7s ease-in-out 1.45s infinite",
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      >
        <text
          x="237"
          y="62"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="9"
          fill={color}
          letterSpacing="0.05em"
          fontWeight="600"
        >
          +1,240,000
        </text>
        <text
          x="237"
          y="72"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="6"
          fill="#161310"
          opacity="0.5"
          letterSpacing="0.14em"
        >
          TOKENS MINTED
        </text>
      </g>

      <path
        d="M138 96 L146 100 L138 104"
        fill="none"
        stroke="#161310"
        strokeWidth="1"
        opacity="0.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReconfigureDiagram() {
  const jade = ACCENT_HEX.jade;
  const ROW_DURATION = "5s";
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect
        x="40"
        y="22"
        width="200"
        height="158"
        fill="rgba(248,243,232,0.7)"
        stroke="#161310"
        strokeWidth="1"
      />

      <line
        x1="40"
        y1="40"
        x2="240"
        y2="40"
        stroke="rgba(22,19,16,0.18)"
        strokeWidth="1"
      />
      <text
        x="50"
        y="34"
        fontFamily="var(--font-mono), monospace"
        fontSize="7"
        fill="#161310"
        opacity="0.6"
        letterSpacing="0.18em"
      >
        PROJECT METADATA
      </text>
      <g>
        <circle cx="226" cy="31" r="1.6" fill={jade} />
        <text
          x="232"
          y="34"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill={jade}
          letterSpacing="0.14em"
        >
          LIVE
        </text>
      </g>

      <g>
        <text
          x="50"
          y="58"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          NAME
        </text>
        <text
          x="50"
          y="72"
          fontFamily="var(--font-mono), monospace"
          fontSize="10"
          fill="#161310"
        >
          Panda Sui
        </text>
        <rect
          x="50"
          y="75"
          width="62"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "0s",
          }}
        />
      </g>

      <g>
        <text
          x="50"
          y="92"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          ICON
        </text>
        <circle
          cx="58"
          cy="105"
          r="5.5"
          fill="rgba(110,142,93,0.18)"
          stroke="#161310"
          strokeWidth="0.8"
        />
        <text
          x="72"
          y="108"
          fontFamily="var(--font-mono), monospace"
          fontSize="8"
          fill="#161310"
          opacity="0.7"
        >
          ipfs://Qm…f9c2
        </text>
        <rect
          x="50"
          y="114"
          width="98"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "1s",
          }}
        />
      </g>

      <g>
        <text
          x="50"
          y="130"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          DESCRIPTION
        </text>
        <rect
          x="50"
          y="135"
          width="160"
          height="2.5"
          fill="#161310"
          opacity="0.28"
        />
        <rect
          x="50"
          y="141"
          width="120"
          height="2.5"
          fill="#161310"
          opacity="0.28"
        />
        <rect
          x="50"
          y="148"
          width="120"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "2s",
          }}
        />
      </g>

      <g>
        <text
          x="50"
          y="164"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          LINKS
        </text>
        <g opacity="0.7">
          <rect
            x="50"
            y="168"
            width="22"
            height="6"
            fill="none"
            stroke="#161310"
            strokeWidth="0.7"
          />
          <rect
            x="76"
            y="168"
            width="22"
            height="6"
            fill="none"
            stroke="#161310"
            strokeWidth="0.7"
          />
          <rect
            x="102"
            y="168"
            width="22"
            height="6"
            fill="none"
            stroke="#161310"
            strokeWidth="0.7"
          />
        </g>
        <rect
          x="50"
          y="176"
          width="74"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "3s",
          }}
        />
      </g>

      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "top left",
          animation: `hiw-mu-pen ${ROW_DURATION} ease-in-out infinite`,
        }}
      >
        <g transform="translate(218 64)">
          <polygon
            points="0,0 10,-3 12,-1 4,7"
            fill={jade}
            stroke="#161310"
            strokeWidth="0.7"
          />
          <polygon points="0,0 3,2 4,7" fill="#161310" />
          <line
            x1="10"
            y1="-3"
            x2="22"
            y2="-15"
            stroke="#161310"
            strokeWidth="1.2"
          />
          <circle
            cx="4"
            cy="11"
            r="1.4"
            fill={jade}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "hiw-dot-pulse 1.6s ease-in-out infinite",
            }}
          />
        </g>
      </g>

      <text
        x="140"
        y="14"
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="6.5"
        fill="#161310"
        opacity="0.5"
        letterSpacing="0.18em"
      >
        pandabox::update_metadata
      </text>
    </svg>
  );
}
