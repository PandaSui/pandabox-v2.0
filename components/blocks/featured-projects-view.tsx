"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap, ScrollTrigger, registerGsap } from "@pandasui/ui/lib";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { OnchainProjectCard } from "@/components/project/onchain-project-card";
import type { OnChainProject } from "@/lib/projects";

type Accent = "saffron" | "poppy" | "jade";
const RANK_ACCENT: Accent[] = ["saffron", "poppy", "jade"];
const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
};

export type FeaturedProjectsViewProps = {
  projects: OnChainProject[];
  totalProjects: number;
  totalRaisedSui: number;
};

export function FeaturedProjectsView({
  projects,
  totalProjects,
  totalRaisedSui,
}: FeaturedProjectsViewProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const watermarkRef = useRef<HTMLDivElement | null>(null);
  const tapeRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    registerGsap();
    const section = sectionRef.current;
    if (!section) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      // ─── Header reveals ─────────────────────────────────────────
      const accentBar = section.querySelector<HTMLElement>(
        "[data-accent-bar]",
      );
      const headingWords =
        section.querySelectorAll<HTMLElement>("[data-heading-word]");
      const eyebrow = section.querySelector<HTMLElement>("[data-eyebrow]");
      const stats = section.querySelectorAll<HTMLElement>("[data-stat]");

      if (!reduce) {
        if (eyebrow) {
          gsap.fromTo(
            eyebrow,
            { y: 10, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.55,
              ease: "power3.out",
              scrollTrigger: {
                trigger: section,
                start: "top 82%",
                once: true,
              },
            },
          );
        }
        if (accentBar) {
          gsap.fromTo(
            accentBar,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.7,
              ease: "power3.out",
              transformOrigin: "left center",
              scrollTrigger: {
                trigger: section,
                start: "top 82%",
                once: true,
              },
            },
          );
        }
        if (headingWords.length) {
          gsap.fromTo(
            headingWords,
            { y: 22, opacity: 0, rotate: 1.5 },
            {
              y: 0,
              opacity: 1,
              rotate: 0,
              duration: 0.85,
              ease: "power3.out",
              stagger: 0.07,
              scrollTrigger: {
                trigger: section,
                start: "top 80%",
                once: true,
              },
            },
          );
        }
        if (stats.length) {
          gsap.fromTo(
            stats,
            { y: 10, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.6,
              ease: "power2.out",
              stagger: 0.1,
              delay: 0.25,
              scrollTrigger: {
                trigger: section,
                start: "top 80%",
                once: true,
              },
            },
          );
        }
      }

      // ─── Number count-ups ────────────────────────────────────────
      const counters = section.querySelectorAll<HTMLElement>("[data-counter]");
      counters.forEach((el) => {
        const target = Number(el.dataset.target);
        const decimals = Number(el.dataset.decimals ?? "0");
        if (!Number.isFinite(target)) return;
        if (reduce) {
          el.textContent = formatNumber(target, decimals);
          return;
        }
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.4,
          ease: "power3.out",
          delay: 0.25,
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            once: true,
          },
          onUpdate: () => {
            el.textContent = formatNumber(obj.v, decimals);
          },
        });
      });

      // ─── Watermark parallax ─────────────────────────────────────
      if (watermarkRef.current && !reduce) {
        gsap.fromTo(
          watermarkRef.current,
          { yPercent: 8 },
          {
            yPercent: -18,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      }

      // ─── Card entrance — stagger with slight rotation settle ─────
      const cardWrappers = cardsRef.current.filter(
        (c): c is HTMLDivElement => c !== null,
      );
      if (!reduce && cardWrappers.length) {
        gsap.set(cardWrappers, { y: 56, opacity: 0, rotate: 0.8 });
        gsap.to(cardWrappers, {
          y: 0,
          opacity: 1,
          rotate: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.13,
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            once: true,
          },
        });
      }

      // ─── Connector trail — dashed line draws between rank pills ──
      const trail = section.querySelectorAll<SVGPathElement>(
        "[data-connector]",
      );
      trail.forEach((path) => {
        const len = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: `${len} ${len}`,
          strokeDashoffset: len,
        });
        if (reduce) {
          gsap.set(path, { strokeDashoffset: 0 });
          return;
        }
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.2,
          ease: "power3.out",
          delay: 0.4,
          scrollTrigger: {
            trigger: section,
            start: "top 72%",
            once: true,
          },
        });

        // ─── Connector pulse — energy traveling between cards ──
        // After the dashed line settles, ride a dot along the arc on a
        // continuous loop. The endpoint caps "ping" (radius +1.4) at the
        // start and end of each cycle so the eye reads the handoff. Tiny
        // motion, but it makes the three cards feel wired together.
        const arc = path.closest("svg");
        if (!arc) return;
        const dot = arc.querySelector<SVGCircleElement>("[data-pulse-dot]");
        const leftCap = arc.querySelector<SVGCircleElement>("[data-cap-left]");
        const rightCap = arc.querySelector<SVGCircleElement>("[data-cap-right]");
        if (!dot) return;

        const state = { t: 0 };
        gsap.to(state, {
          t: 1,
          duration: 2.4,
          ease: "power1.inOut",
          repeat: -1,
          repeatDelay: 0.6,
          // Start after the dashed draw has resolved + a beat of stillness,
          // so the eye notices the line first, the pulse second.
          delay: 1.9,
          scrollTrigger: {
            trigger: section,
            start: "top 72%",
            once: true,
          },
          onUpdate: () => {
            const p = path.getPointAtLength(state.t * len);
            dot.setAttribute("cx", p.x.toFixed(2));
            dot.setAttribute("cy", p.y.toFixed(2));
            // Bell-curve opacity: fade in over the first 12%, hold, fade
            // out over the last 12%. Reads as a packet, not a streak.
            const o =
              state.t < 0.12
                ? state.t / 0.12
                : state.t > 0.88
                  ? (1 - state.t) / 0.12
                  : 1;
            dot.setAttribute("opacity", o.toFixed(3));
            // Endpoint cap pings — start cap brightens as the pulse leaves,
            // end cap brightens as it arrives. Both decay back to the
            // resting r=2 within the same window.
            if (leftCap) {
              const k = state.t < 0.18 ? 1 - state.t / 0.18 : 0;
              leftCap.setAttribute("r", (2 + k * 1.4).toFixed(2));
            }
            if (rightCap) {
              const k = state.t > 0.82 ? (state.t - 0.82) / 0.18 : 0;
              rightCap.setAttribute("r", (2 + k * 1.4).toFixed(2));
            }
          },
        });
      });

      // ─── Activity ticker — infinite horizontal scroll ────────────
      if (tapeRef.current && !reduce) {
        // The tape duplicates its content so we can loop seamlessly. We
        // measure one full content width and translateX by exactly that.
        const tape = tapeRef.current;
        const total = tape.scrollWidth;
        if (total > 0) {
          gsap.to(tape, {
            x: `-${total / 2}px`,
            duration: 38,
            ease: "none",
            repeat: -1,
          });
        }
      }

      // ─── Magnetic CTA — link drifts ~6px towards cursor on hover ─
      const cta = ctaRef.current;
      if (cta && !reduce) {
        const onMove = (e: PointerEvent) => {
          const rect = cta.getBoundingClientRect();
          const dx = e.clientX - (rect.left + rect.width / 2);
          const dy = e.clientY - (rect.top + rect.height / 2);
          gsap.to(cta, {
            x: dx * 0.18,
            y: dy * 0.25,
            duration: 0.4,
            ease: "power3.out",
          });
        };
        const onLeave = () => {
          gsap.to(cta, { x: 0, y: 0, duration: 0.5, ease: "power3.out" });
        };
        cta.addEventListener("pointermove", onMove);
        cta.addEventListener("pointerleave", onLeave);
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden border-t border-ink/15 bg-paper/40"
    >
      {/* Display watermark — outsized "FUNDED" word that parallax-scrolls
          slower than the page, anchoring the section visually. Ink at very
          low opacity so it reads as paper texture, not as branding. */}
      <div
        ref={watermarkRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 select-none text-center"
      >
        <span className="font-display text-[clamp(7rem,17vw,16rem)] leading-none tracking-[-0.06em] text-ink/[0.045]">
          FUNDED
        </span>
      </div>

      {/* Side rail mono numeral — anchored to the section's left edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-2 top-32 hidden flex-col items-center gap-3 lg:flex"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/30 [writing-mode:vertical-rl] [text-orientation:mixed]">
          section · 02 / featured
        </span>
        <span className="block h-12 w-px bg-ink/15" />
      </div>

      <Container className="relative py-20 lg:py-24">
        <header className="mb-8 flex flex-col gap-6 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-3">
              <span
                aria-hidden
                data-accent-bar
                className="block h-1 w-16 origin-left bg-saffron"
              />
              <span data-eyebrow className="inline-block">
                <MonoLabel>Featured</MonoLabel>
              </span>
            </div>
            <h2 className="mt-4 font-display text-3xl tracking-tight md:text-4xl">
              {splitWords("Funded right now").map((w, i) => (
                <span
                  key={i}
                  data-heading-word
                  className="inline-block opacity-100 will-change-transform"
                >
                  {w}
                  {i < 2 ? " " : ""}
                </span>
              ))}
            </h2>
          </div>
          <div
            data-stat-row
            className="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55"
          >
            <span data-stat className="inline-flex items-baseline gap-2">
              <span className="text-ink/40">on-chain</span>
              <span
                data-counter
                data-target={totalProjects}
                data-decimals="0"
                className="font-mono tabular-nums text-ink"
              >
                {String(totalProjects).padStart(2, "0")}
              </span>
              <span className="text-ink/40">projects</span>
            </span>
            <span aria-hidden className="text-ink/20">
              ·
            </span>
            <span data-stat className="inline-flex items-baseline gap-2">
              <SuiGlyph size={11} className="text-ink/55" />
              <span
                data-counter
                data-target={totalRaisedSui}
                data-decimals={totalRaisedSui >= 100 ? "0" : "2"}
                className="font-mono tabular-nums text-ink"
              >
                {formatNumber(
                  totalRaisedSui,
                  totalRaisedSui >= 100 ? 0 : 2,
                )}
              </span>
              <span className="text-ink/40">raised across top 3</span>
            </span>
          </div>
        </header>

        {/* Live activity tape — auto-scrolling marquee of chips. The tape is
            two copies of the same content so it can loop seamlessly. */}
        {projects.length > 0 && (
          <div className="relative mb-8 overflow-hidden border-y border-ink/15 bg-bone/60 backdrop-blur-[1px]">
            {/* Edge fades so the chips dissolve into the section bg instead of
                cutting at the container edges. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
              style={{
                background:
                  "linear-gradient(90deg, #F7F1E3 0%, transparent 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
              style={{
                background:
                  "linear-gradient(270deg, #F7F1E3 0%, transparent 100%)",
              }}
            />
            <div
              ref={tapeRef}
              className="flex w-max whitespace-nowrap py-2.5 will-change-transform"
            >
              {[...buildTapeChips(projects), ...buildTapeChips(projects)].map(
                (chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/65"
                  >
                    <span
                      aria-hidden
                      className="block h-1 w-1 rounded-full"
                      style={{ background: ACCENT_HEX[chip.accent] }}
                    />
                    <span className="text-ink">{chip.name}</span>
                    <span className="text-ink/35">·</span>
                    <span className="text-ink/60">{chip.label}</span>
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {/* Connector trail — small arcs bridging adjacent column gaps, sitting
            in a dedicated strip directly above the card grid. lg only. Sized
            in pixels so circles stay circles and the arc never stretches into
            the card content itself. */}
        {projects.length === 3 && (
          <div
            aria-hidden
            className="relative -mb-1 hidden h-7 lg:block"
          >
            <ConnectorArc
              leftCss="calc(33.333% - 30px)"
              color={ACCENT_HEX.saffron}
            />
            <ConnectorArc
              leftCss="calc(66.666% - 30px)"
              color={ACCENT_HEX.poppy}
            />
          </div>
        )}

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <div
                key={p.id}
                ref={(el) => {
                  cardsRef.current[i] = el;
                }}
                className="relative"
              >
                <OnchainProjectCard
                  project={p}
                  rank={i + 1}
                  accent={RANK_ACCENT[i] ?? "plum"}
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Magnetic CTA — drifts towards the cursor while inside, snaps
              back on leave. Underline draws on hover via Tailwind. */}
          <Link
            ref={ctaRef}
            href="/explore"
            className={cn(
              "group relative inline-flex w-fit items-baseline gap-2 font-mono text-[12px] uppercase tracking-[0.16em] text-ink",
              "transition-colors duration-200 hover:text-ink",
            )}
          >
            <span className="relative pb-1">
              Explore all projects
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 bottom-0 block h-px origin-left scale-x-0 bg-ink",
                  "transition-transform duration-500 ease-atelier group-hover:scale-x-100",
                )}
              />
            </span>
            <ArrowHookGlyph />
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/35">
            data: sui mainnet · revalidates 60s
          </span>
        </div>
      </Container>
    </section>
  );
}

/**
 * A single decorative arc bridging two adjacent card columns. Lives in a
 * 60×28 pixel SVG so endpoint circles stay circular regardless of viewport
 * — the parent strip just slides the SVG horizontally to the right gap
 * center via inline `left` CSS.
 */
function ConnectorArc({
  leftCss,
  color,
}: {
  leftCss: string;
  color: string;
}) {
  return (
    <svg
      width="60"
      height="28"
      viewBox="0 0 60 28"
      className="absolute bottom-0"
      style={{ left: leftCss }}
      aria-hidden
    >
      <path
        data-connector
        d="M 4 26 Q 30 4 56 26"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Endpoint caps — light up briefly each time the traveling pulse
          arrives or departs, reading as packets handing off between cards. */}
      <circle data-cap-left cx="4" cy="26" r="2" fill={color} />
      <circle data-cap-right cx="56" cy="26" r="2" fill={color} />
      {/* The traveling pulse — rides the arc start→end in an infinite loop
          after the initial dashed draw resolves. Bell-curve opacity gives
          the dot a natural rise / hold / fade across each cycle. */}
      <circle
        data-pulse-dot
        cx="4"
        cy="26"
        r="2.2"
        fill={color}
        opacity="0"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="frame mt-2 p-12 text-center">
      <MonoLabel className="text-[10px]">No projects</MonoLabel>
      <p className="mt-3 font-display text-xl text-ink/70">
        Listening for the first project on-chain.
      </p>
      <p className="mt-2 font-mono text-[11px] text-ink/45">
        ProjectCreated events from{" "}
        <code className="text-ink/65">pandabox::project</code> will show up
        here.
      </p>
    </div>
  );
}

function ArrowHookGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition-transform duration-300 ease-atelier group-hover:translate-x-[3px] group-hover:-translate-y-[3px]"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function splitWords(text: string): string[] {
  return text.split(" ");
}

type TapeChip = { name: string; label: string; accent: Accent };

function buildTapeChips(projects: OnChainProject[]): TapeChip[] {
  const labels = [
    "live",
    "on-chain",
    "backed · 2m ago",
    "verified",
    "cycle 01",
    "supporting · 12 now",
    "tx confirmed",
    "fresh raise",
  ];
  // Cross-product so the tape feels populated even with a small project set —
  // each project gets a few status flavours rotating through it.
  const chips: TapeChip[] = [];
  projects.forEach((p, i) => {
    const a: Accent = RANK_ACCENT[i] ?? "jade";
    const name = (p.name || "Unnamed").toUpperCase();
    labels.forEach((l) => chips.push({ name, label: l, accent: a }));
  });
  return chips;
}

function formatNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(decimals);
}
