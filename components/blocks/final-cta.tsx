"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowDiag } from "@pandasui/ui";
import { gsap, ScrollTrigger, registerGsap } from "@pandasui/ui/lib";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";

const ACCENT_HEX = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
} as const;

const PALETTE_BARS = ["saffron", "poppy", "jade", "sky", "sun", "plum"] as const;

const SPEC_TILES = [
  {
    label: "Sign",
    value: "1 transaction",
    accent: ACCENT_HEX.saffron,
    tint: "transparent",
  },
  {
    label: "Gas",
    value: "< $0.001",
    accent: ACCENT_HEX.poppy,
    tint: `${ACCENT_HEX.poppy}10`,
  },
  {
    label: "Setup",
    value: "6 steps",
    accent: ACCENT_HEX.sky,
    tint: `${ACCENT_HEX.sky}10`,
  },
  {
    label: "Keys",
    value: "AdminCap yours",
    accent: ACCENT_HEX.plum,
    tint: `${ACCENT_HEX.plum}10`,
  },
] as const;

const FLOATING_DOTS = [
  { top: "32%", left: "62%", color: ACCENT_HEX.poppy, size: 8 },
  { top: "53%", left: "32%", color: ACCENT_HEX.sky, size: 9 },
  { top: "74%", left: "67%", color: ACCENT_HEX.jade, size: 10 },
  { top: "22%", left: "38%", color: ACCENT_HEX.saffron, size: 7 },
] as const;

const SUBHEAD =
  "Configure cycles, payouts, and tokens. Sign one Sui transaction. You hold the admin cap.";

const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-14 px-8 font-sans font-medium uppercase tracking-[0.12em] text-[0.8125rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink will-change-transform";

export function FinalCta() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    registerGsap();
    const section = sectionRef.current;
    if (!section) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const teardown: Array<() => void> = [];

    const ctx = gsap.context(() => {
      if (!reduce) {
        // ─── Top marginalia ────────────────────────────────────────
        gsap.fromTo(
          "[data-fc-margin]",
          { opacity: 0, y: -4 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: "power3.out",
            stagger: 0.07,
            scrollTrigger: { trigger: section, start: "top 90%", once: true },
          },
        );

        // ─── Octagon glyph — drops in, then the polygon strokes itself
        //     and the center dot starts a slow pulse. ───────────────
        gsap.fromTo(
          "[data-fc-glyph]",
          { opacity: 0, y: -16, scale: 0.82 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.85,
            ease: "back.out(1.8)",
            scrollTrigger: { trigger: section, start: "top 82%", once: true },
          },
        );

        const octPath = section.querySelector<SVGPolygonElement>(
          "[data-fc-oct-path]",
        );
        if (octPath) {
          const len = octPath.getTotalLength();
          gsap.set(octPath, {
            strokeDasharray: len,
            strokeDashoffset: len,
          });
          gsap.to(octPath, {
            strokeDashoffset: 0,
            duration: 1.3,
            ease: "power3.out",
            delay: 0.25,
            scrollTrigger: { trigger: section, start: "top 82%", once: true },
          });
        }

        // Octagon outline orbits slowly — almost imperceptible, never stops.
        gsap.to("[data-fc-oct-svg]", {
          rotate: 360,
          duration: 48,
          repeat: -1,
          ease: "none",
          transformOrigin: "50% 50%",
        });

        // Center dot pulse — heartbeat for the whole composition.
        gsap.to("[data-fc-oct-dot]", {
          attr: { r: 3 },
          duration: 1.3,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });

        // Corner notches subtly breathe.
        gsap.to("[data-fc-glyph-corner]", {
          scale: 1.18,
          duration: 2.4,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          stagger: { each: 0.3, from: "random" },
          transformOrigin: "50% 50%",
        });

        // ─── SHIP IT pill — fades in, then the + rotates forever. ──
        gsap.fromTo(
          "[data-fc-pill]",
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: "power3.out",
            delay: 0.18,
            scrollTrigger: { trigger: section, start: "top 82%", once: true },
          },
        );

        gsap.to("[data-fc-plus]", {
          rotate: 360,
          duration: 14,
          repeat: -1,
          ease: "none",
          transformOrigin: "50% 50%",
        });

        // ─── Palette bars — scale-x in, then a scanning wave passes
        //     across the row every few seconds (each bar briefly grows). ─
        gsap.fromTo(
          "[data-fc-palette]",
          { opacity: 0, scaleX: 0.3, transformOrigin: "50% 50%" },
          {
            opacity: 1,
            scaleX: 1,
            duration: 0.7,
            ease: "power3.out",
            delay: 0.32,
            stagger: 0.05,
            scrollTrigger: { trigger: section, start: "top 82%", once: true },
          },
        );

        const paletteBars = section.querySelectorAll<HTMLElement>(
          "[data-fc-palette]",
        );
        if (paletteBars.length) {
          const scanTl = gsap.timeline({ repeat: -1, repeatDelay: 2.4, delay: 2 });
          paletteBars.forEach((bar, i) => {
            scanTl.to(
              bar,
              {
                scaleY: 2.6,
                duration: 0.18,
                ease: "power2.out",
                transformOrigin: "50% 50%",
              },
              i * 0.08,
            );
            scanTl.to(
              bar,
              { scaleY: 1, duration: 0.42, ease: "power2.in" },
              i * 0.08 + 0.18,
            );
          });
        }

        // ─── Headline lines land with a slight rotation overshoot. ─
        gsap.fromTo(
          "[data-fc-line]",
          { opacity: 0, y: 32, rotate: -1.5 },
          {
            opacity: 1,
            y: 0,
            rotate: 0,
            duration: 1.0,
            ease: "back.out(1.4)",
            stagger: 0.12,
            delay: 0.45,
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
          },
        );

        // ─── "on-chain" italic — continuously floats, with a saffron
        //     marker that sweeps in beneath it, and magnetic cursor pull. ─
        gsap.to("[data-fc-onchain]", {
          y: -5,
          duration: 2.8,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });

        gsap.fromTo(
          "[data-fc-underline]",
          { scaleX: 0, transformOrigin: "0% 50%" },
          {
            scaleX: 1,
            duration: 1.1,
            ease: "power4.out",
            delay: 1.0,
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
          },
        );

        const onchain = section.querySelector<HTMLElement>("[data-fc-onchain]");
        if (onchain) {
          const onMove = (e: PointerEvent) => {
            const rect = onchain.getBoundingClientRect();
            const x = e.clientX - (rect.left + rect.width / 2);
            const y = e.clientY - (rect.top + rect.height / 2);
            gsap.to(onchain, {
              x: x * 0.06,
              y: y * 0.06 - 5,
              duration: 0.6,
              ease: "power3.out",
            });
          };
          const onLeave = () => {
            gsap.to(onchain, {
              x: 0,
              y: -5,
              duration: 0.9,
              ease: "power3.out",
            });
          };
          onchain.addEventListener("pointermove", onMove);
          onchain.addEventListener("pointerleave", onLeave);
          teardown.push(() => {
            onchain.removeEventListener("pointermove", onMove);
            onchain.removeEventListener("pointerleave", onLeave);
          });
        }

        // ─── Subhead — word-by-word reveal, blur + lift. ───────────
        gsap.fromTo(
          "[data-fc-word]",
          { opacity: 0, y: 10, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.55,
            ease: "power3.out",
            delay: 0.85,
            stagger: 0.025,
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
          },
        );

        // ─── CTAs ─────────────────────────────────────────────────
        gsap.fromTo(
          "[data-fc-btn]",
          { opacity: 0, y: 12, scale: 0.94 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.65,
            ease: "back.out(1.8)",
            delay: 1.05,
            stagger: 0.08,
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
          },
        );

        // ─── Spec tiles — lift in, then each gets a corner-dot pulse
        //     and a hover lift with border darkening. ───────────────
        gsap.fromTo(
          "[data-fc-tile]",
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            delay: 1.25,
            stagger: 0.08,
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
          },
        );

        gsap.to("[data-fc-tile-corner]", {
          scale: 1.6,
          opacity: 1,
          duration: 1.5,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          stagger: { each: 0.4, from: "start" },
          transformOrigin: "50% 50%",
        });

        section.querySelectorAll<HTMLElement>("[data-fc-tile]").forEach((tile) => {
          const onEnter = () => {
            gsap.to(tile, {
              y: -4,
              duration: 0.35,
              ease: "power3.out",
            });
          };
          const onLeave = () => {
            gsap.to(tile, { y: 0, duration: 0.5, ease: "power3.out" });
          };
          tile.addEventListener("pointerenter", onEnter);
          tile.addEventListener("pointerleave", onLeave);
          teardown.push(() => {
            tile.removeEventListener("pointerenter", onEnter);
            tile.removeEventListener("pointerleave", onLeave);
          });
        });

        // ─── Floating dots — pop in, drift, then scatter away from
        //     the cursor when it gets within ~160px of each one. ───
        gsap.fromTo(
          "[data-fc-dot]",
          { opacity: 0, scale: 0 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "back.out(2.2)",
            delay: 1.4,
            stagger: 0.1,
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
          },
        );

        const dotEls = Array.from(
          section.querySelectorAll<HTMLElement>("[data-fc-dot]"),
        );
        const dotState = dotEls.map(() => ({ ox: 0, oy: 0 }));
        // Lightweight idle drift baked into ox/oy offsets, applied each frame.
        dotEls.forEach((_, i) => {
          gsap.to(dotState[i], {
            ox: (i % 2 === 0 ? 12 : -10),
            oy: (i % 3 === 0 ? -10 : 8),
            duration: 3 + (i % 3),
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          });
        });

        let raf = 0;
        let lastP: { x: number; y: number } | null = null;
        const apply = () => {
          raf = 0;
          dotEls.forEach((dot, i) => {
            const dr = dot.getBoundingClientRect();
            const cx = dr.left + dr.width / 2;
            const cy = dr.top + dr.height / 2;
            let tx = dotState[i].ox;
            let ty = dotState[i].oy;
            if (lastP) {
              const dx = cx - lastP.x;
              const dy = cy - lastP.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 160) {
                const force = (160 - dist) / 160;
                tx += (dx / Math.max(dist, 1)) * 42 * force;
                ty += (dy / Math.max(dist, 1)) * 42 * force;
              }
            }
            gsap.to(dot, {
              x: tx,
              y: ty,
              duration: 0.5,
              ease: "power3.out",
              overwrite: "auto",
            });
          });
        };
        const onSectionMove = (e: PointerEvent) => {
          lastP = { x: e.clientX, y: e.clientY };
          if (!raf) raf = requestAnimationFrame(apply);
        };
        const onSectionLeave = () => {
          lastP = null;
          if (!raf) raf = requestAnimationFrame(apply);
        };
        section.addEventListener("pointermove", onSectionMove);
        section.addEventListener("pointerleave", onSectionLeave);
        teardown.push(() => {
          section.removeEventListener("pointermove", onSectionMove);
          section.removeEventListener("pointerleave", onSectionLeave);
          if (raf) cancelAnimationFrame(raf);
        });
        // Kick off idle drift application loop (apply runs once and then
        // re-schedules itself whenever the drift tween ticks).
        const driftLoop = () => {
          if (!raf) raf = requestAnimationFrame(apply);
        };
        const driftId = window.setInterval(driftLoop, 80);
        teardown.push(() => window.clearInterval(driftId));

        // ─── Halos drift ──────────────────────────────────────────
        gsap.to("[data-fc-blob-a]", {
          x: 26,
          y: -18,
          duration: 7,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });
        gsap.to("[data-fc-blob-b]", {
          x: -20,
          y: 16,
          duration: 8.5,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });

        // ─── Magnetic primary CTA ─────────────────────────────────
        const btn = section.querySelector<HTMLElement>("[data-fc-magnet]");
        if (btn) {
          const glow = btn.querySelector<HTMLElement>("[data-fc-magnet-glow]");
          const arrow = btn.querySelector<HTMLElement>("[data-fc-magnet-arrow]");
          const onMove = (e: PointerEvent) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(btn, {
              x: x * 0.2,
              y: y * 0.2,
              duration: 0.4,
              ease: "power3.out",
            });
            if (glow)
              gsap.to(glow, {
                x: x * 0.4,
                y: y * 0.4,
                duration: 0.4,
                ease: "power3.out",
              });
            if (arrow)
              gsap.to(arrow, {
                x: x * 0.3,
                y: y * 0.3,
                duration: 0.35,
                ease: "power3.out",
              });
          };
          const onLeave = () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.55, ease: "power3.out" });
            if (glow)
              gsap.to(glow, { x: 0, y: 0, duration: 0.55, ease: "power3.out" });
            if (arrow)
              gsap.to(arrow, { x: 0, y: 0, duration: 0.55, ease: "power3.out" });
          };
          btn.addEventListener("pointermove", onMove);
          btn.addEventListener("pointerleave", onLeave);
          teardown.push(() => {
            btn.removeEventListener("pointermove", onMove);
            btn.removeEventListener("pointerleave", onLeave);
          });
        }
      }
    }, section);

    return () => {
      teardown.forEach((fn) => fn());
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden border-t border-ink/15 bg-bone"
    >
      {/* ─── Ambient layer ─────────────────────────────────────────── */}
      <div
        aria-hidden
        data-fc-blob-a
        className="pointer-events-none absolute -bottom-24 -right-24 h-[640px] w-[640px] rounded-full opacity-25 blur-[140px]"
        style={{
          background: `radial-gradient(circle, ${ACCENT_HEX.saffron} 0%, transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        data-fc-blob-b
        className="pointer-events-none absolute -top-32 left-[12%] h-[500px] w-[500px] rounded-full opacity-20 blur-[130px]"
        style={{
          background: `radial-gradient(circle, ${ACCENT_HEX.poppy} 0%, transparent 70%)`,
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(#161310 1px, transparent 1.2px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ─── Top marginalia ────────────────────────────────────────── */}
      <div className="border-b border-ink/10">
        <Container className="flex items-center justify-between py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
          <span data-fc-margin className="inline-flex items-center gap-2">
            <span aria-hidden className="block h-1 w-1 rounded-full bg-saffron" />
            Nº 04 · final
          </span>
          <span data-fc-margin className="hidden md:inline">
            project spec — pandabox
          </span>
          <span data-fc-margin>2026 · Sui mainnet</span>
        </Container>
      </div>

      {/* ─── Main composition — centered column ────────────────────── */}
      <Container className="relative py-20 md:py-28 lg:py-32">
        {/* Floating accent dots — pop in, idle drift, scatter from cursor */}
        {FLOATING_DOTS.map((d, i) => (
          <span
            key={i}
            data-fc-dot
            aria-hidden
            className="pointer-events-none absolute block rounded-full will-change-transform"
            style={{
              top: d.top,
              left: d.left,
              width: d.size,
              height: d.size,
              background: d.color,
            }}
          />
        ))}

        <div className="relative mx-auto flex max-w-[64ch] flex-col items-center text-center">
          {/* Octagon glyph card */}
          <div
            data-fc-glyph
            className="relative inline-flex h-[88px] w-[88px] items-center justify-center border border-ink bg-bone shadow-offset-sm"
            style={{ perspective: 600 }}
          >
            <svg
              width="38"
              height="38"
              viewBox="0 0 40 40"
              aria-hidden
              data-fc-oct-svg
              style={{ overflow: "visible" }}
            >
              <polygon
                data-fc-oct-path
                points="14,6 26,6 34,14 34,26 26,34 14,34 6,26 6,14"
                fill="none"
                stroke="#161310"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle data-fc-oct-dot cx="20" cy="20" r="2" fill="#161310" />
            </svg>
            {/* Diecut corner notches */}
            <span
              data-fc-glyph-corner
              aria-hidden
              className="absolute -top-[5px] -left-[5px] h-2.5 w-2.5 rotate-45 bg-bone border border-ink"
            />
            <span
              data-fc-glyph-corner
              aria-hidden
              className="absolute -top-[5px] -right-[5px] h-2.5 w-2.5 rotate-45 bg-bone border border-ink"
            />
            <span
              data-fc-glyph-corner
              aria-hidden
              className="absolute -bottom-[5px] -left-[5px] h-2.5 w-2.5 rotate-45 bg-bone border border-ink"
            />
            <span
              data-fc-glyph-corner
              aria-hidden
              className="absolute -bottom-[5px] -right-[5px] h-2.5 w-2.5 rotate-45 bg-bone border border-ink"
            />
          </div>

          {/* SHIP IT pill */}
          <span
            data-fc-pill
            className="mt-6 inline-flex items-center gap-2 border border-ink/30 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/65"
          >
            <span
              data-fc-plus
              aria-hidden
              className="inline-block text-saffron text-[13px] leading-none"
              style={{ transformOrigin: "50% 55%" }}
            >
              +
            </span>
            Ship it
          </span>

          {/* Palette bars — the 6 brand accents */}
          <div className="mt-5 flex items-center gap-1.5" aria-hidden>
            {PALETTE_BARS.map((c) => (
              <span
                key={c}
                data-fc-palette
                className="block h-[3px] w-9 will-change-transform"
                style={{ background: ACCENT_HEX[c] }}
              />
            ))}
          </div>

          {/* Headline */}
          <h2 className="mt-10 font-display leading-[0.95] tracking-[-0.035em] text-balance">
            <span
              data-fc-line
              className="block text-[clamp(2.4rem,6vw,5rem)]"
            >
              Your project,
            </span>
            <span
              data-fc-line
              className="block text-[clamp(2.4rem,6vw,5rem)]"
            >
              <span
                data-fc-onchain
                className="relative inline-block will-change-transform"
              >
                <span className="font-light italic text-saffron">on-chain</span>
                <span
                  data-fc-underline
                  aria-hidden
                  className="absolute left-[0.04em] right-[0.04em] -bottom-[0.04em] block h-[0.07em] bg-saffron/45"
                />
              </span>{" "}
              in 3 minutes.
            </span>
          </h2>

          {/* Subhead — word-split for reveal stagger */}
          <p className="mt-7 max-w-[52ch] text-pretty text-[1.0625rem] leading-relaxed text-ink/70">
            {SUBHEAD.split(" ").map((w, i) => (
              <span
                key={i}
                data-fc-word
                className="inline-block will-change-[opacity,transform,filter]"
                style={{ marginRight: "0.28em" }}
              >
                {w}
              </span>
            ))}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/create"
              data-fc-btn
              data-fc-magnet
              className={cn(CTA_BASE, "overflow-hidden bg-saffron text-ink")}
            >
              <span
                data-fc-magnet-glow
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${ACCENT_HEX.sun} 0%, transparent 65%)`,
                  opacity: 0.55,
                }}
              />
              <span className="relative">Launch a project</span>
              <span
                data-fc-magnet-arrow
                className="relative inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]"
              >
                <ArrowDiag size={14} />
              </span>
            </Link>
            <Link
              href="/docs"
              data-fc-btn
              className={cn(CTA_BASE, "bg-bone text-ink")}
            >
              <span>Read the docs</span>
              <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
                <ArrowDiag size={14} />
              </span>
            </Link>
          </div>

          {/* Spec tile row */}
          <div className="mt-14 grid w-full max-w-[820px] grid-cols-2 gap-3 md:grid-cols-4">
            {SPEC_TILES.map((t) => (
              <div
                key={t.label}
                data-fc-tile
                className="group relative border border-ink/15 px-4 py-3 text-left will-change-transform transition-colors duration-300 hover:border-ink/45"
                style={{ background: t.tint }}
              >
                <span
                  data-fc-tile-corner
                  aria-hidden
                  className="absolute right-2.5 top-2.5 block h-1.5 w-1.5 rounded-full"
                  style={{ background: t.accent, opacity: 0.55 }}
                />
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: t.accent }}
                >
                  {t.label}
                </div>
                <div className="mt-1.5 font-display text-[1.25rem] leading-tight text-ink">
                  {t.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* ─── Bottom marginalia ─────────────────────────────────────── */}
      <div className="border-t border-ink/10 bg-bone/85 backdrop-blur-[2px]">
        <Container className="flex items-center justify-between py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          <span data-fc-margin className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-jade opacity-60" />
              <span className="relative block h-1.5 w-1.5 rounded-full bg-jade" />
            </span>
            pandabox.sui · live
          </span>
          <span data-fc-margin className="hidden md:inline">
            <code className="font-mono text-ink/60">
              pandabox::create_project
            </code>
          </span>
          <span data-fc-margin>revalidates 60s</span>
        </Container>
      </div>
    </section>
  );
}
