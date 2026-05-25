"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";
type Status = "live" | "ended" | "closed";

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
};

const STATUS_ACCENT: Record<Status, Accent> = {
  live: "jade",
  ended: "poppy",
  closed: "plum",
};

/**
 * Gallery-print cover frame for the project hero.
 *
 * Reads as a bone-paper matte with a hairline ink-bordered image well,
 * flanked by mono metadata strips that print the cover spec the way a
 * museum placard would. A diecut accent stamp sits in the top-right
 * carrying the live/ended/closed status, and registration ticks inside
 * each corner of the image well reinforce the "rendered to film" feel
 * pandabox uses throughout.
 *
 * On hover, the image inside the well scales gently while the matte
 * itself stays anchored — the artwork moves, the frame doesn't.
 */
export function CoverFrame({
  src,
  name,
  ticker,
  status = "live",
  projectId,
  createdAtMs,
  accent: forcedAccent,
  priority = false,
  className,
  ratioLabel = "1:1",
}: {
  src: string | null | undefined;
  name: string;
  ticker?: string;
  status?: Status;
  projectId?: string;
  createdAtMs?: number;
  accent?: Accent;
  priority?: boolean;
  className?: string;
  ratioLabel?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const t = useTranslations("project.detail.cover");
  const tStatus = useTranslations("project.status");
  const tDetailStatus = useTranslations("project.detail.status");

  const accent: Accent = forcedAccent ?? STATUS_ACCENT[status];
  const accentHex = ACCENT_HEX[accent];

  const showImage = !!src && !errored;
  const initial = (name?.[0] ?? "P").toUpperCase();
  const tickerLabel = (ticker ?? t("defaultTickerFallback")).toUpperCase();
  const statusLabel =
    status === "ended" ? tDetailStatus("ended") : tStatus(status);

  // Motion choreography:
  //   • Mount   — matte rises, spec strips fade, accent bar paints, stamp
  //               "stamps" in with overshoot, corner ticks reveal.
  //   • Idle    — when live, the stamp's inner hairline pulses softly so
  //               the cover frame has its own micro-heartbeat.
  //   • Hover   — image inside the well scales, stamp tilts further and
  //               lifts, the matte itself nudges up a touch.
  //   • Pointer — within the matte, the image parallax-tracks the cursor
  //               by a few pixels; the stamp tilts in the opposite direction.
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      const img = root.querySelector<HTMLElement>("[data-cover-img]");
      const stamp = root.querySelector<HTMLElement>("[data-stamp]");
      const stampLine = root.querySelector<HTMLElement>("[data-stamp-line]");
      const matte = root.querySelector<HTMLElement>("[data-matte]");
      const accentBar = root.querySelector<HTMLElement>("[data-accent-bar]");
      const specTop = root.querySelector<HTMLElement>("[data-spec-top]");
      const specBottom = root.querySelector<HTMLElement>("[data-spec-bottom]");
      const ticks = root.querySelector<HTMLElement>("[data-corner-ticks]");
      const chip = root.querySelector<HTMLElement>("[data-chip]");
      const chipDot = root.querySelector<HTMLElement>("[data-chip-dot]");

      // ─── Mount timeline ─────────────────────────────────────────
      const mount = gsap.timeline({
        defaults: { ease: "power3.out" },
      });
      if (matte) {
        mount.from(matte, { y: 18, opacity: 0, duration: 0.7 }, 0);
      }
      if (accentBar) {
        mount.from(
          accentBar,
          { scaleX: 0, duration: 0.55, ease: "power3.out" },
          0.18,
        );
      }
      if (specTop) {
        mount.from(specTop, { y: 6, opacity: 0, duration: 0.4 }, 0.2);
      }
      if (specBottom) {
        mount.from(specBottom, { y: 6, opacity: 0, duration: 0.4 }, 0.32);
      }
      if (ticks) {
        mount.from(ticks, { opacity: 0, duration: 0.5 }, 0.35);
      }
      // The stamp "stamps in" — a beat after the matte settles, scale from
      // zero with rotation overshoot so it lands like ink hitting paper.
      if (stamp) {
        mount.from(
          stamp,
          {
            scale: 0.55,
            rotate: 12,
            opacity: 0,
            duration: 0.55,
            ease: "back.out(2.2)",
            transformOrigin: "70% 30%",
          },
          0.42,
        );
      }
      if (stampLine) {
        gsap.set(stampLine, { scaleX: 0 });
        mount.to(
          stampLine,
          { scaleX: 1, duration: 0.45, ease: "power3.out" },
          0.7,
        );
      }

      // ─── Idle pulse on the stamp's hairline when status is live ───
      let idleTween: gsap.core.Tween | null = null;
      if (status === "live" && stampLine) {
        idleTween = gsap.to(stampLine, {
          opacity: 0.35,
          duration: 1.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: 1.2,
        });
      }
      // A second, slower pulse on the artwork chip dot — keeps the
      // bottom-left corner alive without competing with the live-stamp.
      let chipPulse: gsap.core.Tween | null = null;
      if (chipDot) {
        chipPulse = gsap.to(chipDot, {
          scale: 1.6,
          opacity: 0.45,
          duration: 1.6,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          transformOrigin: "center",
          delay: 1.5,
        });
      }

      // ─── Hover timeline (paused, reversible) ────────────────────
      const hover = gsap
        .timeline({
          paused: true,
          defaults: { ease: "power3.out", duration: 0.45 },
        })
        .to(img, { scale: 1.05 }, 0)
        .to(stamp, { rotate: -9, y: -3, scale: 1.04 }, 0)
        .to(matte, { y: -2 }, 0);
      if (chip) {
        hover.to(chip, { y: -2 }, 0);
      }

      // ─── Pointer parallax inside the matte ──────────────────────
      // Bounded shift: ±3px on the image, ±4px (counter direction) on the
      // stamp, so the two read as parallaxed planes against the matte.
      const onPointerMove = (e: PointerEvent) => {
        const rect = (matte ?? root).getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5; // −0.5 .. 0.5
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        if (img) {
          gsap.to(img, {
            x: nx * 6,
            y: ny * 6,
            duration: 0.6,
            ease: "power3.out",
          });
        }
        if (stamp) {
          gsap.to(stamp, {
            x: -nx * 5,
            y: -3 - ny * 4,
            duration: 0.5,
            ease: "power3.out",
          });
        }
      };
      const onPointerLeave = () => {
        if (img) {
          gsap.to(img, { x: 0, y: 0, duration: 0.6, ease: "power3.out" });
        }
        if (stamp) {
          gsap.to(stamp, { x: 0, y: 0, duration: 0.55, ease: "power3.out" });
        }
      };

      const onEnter = () => hover.play();
      const onLeave = () => {
        hover.reverse();
        onPointerLeave();
      };
      root.addEventListener("mouseenter", onEnter);
      root.addEventListener("mouseleave", onLeave);
      root.addEventListener("pointermove", onPointerMove);

      return () => {
        root.removeEventListener("mouseenter", onEnter);
        root.removeEventListener("mouseleave", onLeave);
        root.removeEventListener("pointermove", onPointerMove);
        idleTween?.kill();
        chipPulse?.kill();
      };
    },
    { scope, dependencies: [status] },
  );

  return (
    <div ref={scope} className={cn("relative", className)}>
      {/* Accent vignette — soft radial wash behind the matte so the frame
          floats off the bone background instead of sitting flush against it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 opacity-50 blur-[60px]"
        style={{
          background: `radial-gradient(60% 60% at 70% 30%, ${accentHex}55, transparent 70%)`,
        }}
      />

      {/* Outer matte — the paper mount that the print sits on */}
      <div
        data-matte
        className={cn(
          "relative flex h-full flex-col border border-ink bg-bone p-3 shadow-offset transition-shadow duration-300 ease-atelier md:p-4",
        )}
      >
        {/* Top spec strip — mono placard above the print */}
        <div
          data-spec-top
          className="flex items-baseline justify-between gap-3 pb-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/55"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <span
              aria-hidden
              data-accent-bar
              className="block h-[3px] w-5 shrink-0 origin-left"
              style={{ background: accentHex }}
            />
            {t("specCover", { ticker: tickerLabel })}
          </span>
          <span className="shrink-0 tabular-nums text-ink/40">
            {t("specFig", { ratio: ratioLabel })}
          </span>
        </div>

        {/* Image well — the print itself, with corner registration marks */}
        <div className="relative aspect-[4/3] min-h-0 flex-1 overflow-hidden border border-ink/35 bg-ink/[0.04]">
          {/* Soft accent floor visible during load + behind transparent art */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `${accentHex}1f` }}
          />
          {/* Faint dot grid — engineered "drawing paper" floor */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #161310 1px, transparent 1.2px)",
              backgroundSize: "12px 12px",
            }}
          />

          {/* Loading skeleton — gentle pulse while the gateway round-trips */}
          {showImage && !loaded && (
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse bg-ink/[0.08]"
            />
          )}

          {showImage ? (
            <Image
              data-cover-img
              src={src as string}
              alt={t("imgAlt", { name })}
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              priority={priority}
              unoptimized
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className={cn(
                "object-cover transition-opacity duration-500",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-display leading-none"
                style={{
                  fontSize: "clamp(5rem, 18vw, 9rem)",
                  color: `${accentHex}55`,
                }}
              >
                {initial}
              </span>
            </div>
          )}

          {/* Registration marks — small L-ticks at each corner of the well */}
          <CornerTicks />

          {/* Bottom-left ratio chip — sits over the image as a printed caption */}
          <span
            data-chip
            className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 bg-bone/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/70 backdrop-blur-[2px]"
          >
            <span
              aria-hidden
              data-chip-dot
              className="block h-1 w-1 rounded-full"
              style={{ background: accentHex }}
            />
            {t("artwork")}
          </span>
        </div>

        {/* Status stamp — clean bordered accent badge sitting over the
            upper-right corner of the matte. No clip-path so the border
            wraps cleanly; a thin inner hairline keeps the postal-stamp
            character without the diecut notches. Lightly rotated like a
            cancel mark, and animated via the mount + hover timelines. */}
        <span
          data-stamp
          className="absolute -right-2 -top-2 z-10 inline-flex flex-col items-center justify-center border border-ink px-3 py-1.5 text-bone shadow-offset-sm"
          style={{
            background: accentHex,
            transform: "rotate(-4deg)",
            boxShadow:
              "inset 0 0 0 1px rgba(247,241,227,0.35), 4px 4px 0 0 #161310",
          }}
        >
          <span className="font-mono text-[8px] font-semibold uppercase leading-none tracking-[0.2em]">
            {statusLabel}
          </span>
          <span
            data-stamp-line
            className="mt-1 block h-[1px] w-6 origin-left bg-bone/45"
          />
          <span className="mt-1 font-mono text-[7.5px] leading-none tracking-[0.16em] opacity-80">
            {t("suiMainnet")}
          </span>
        </span>

        {/* Bottom spec strip — projectId + deployment date, museum-placard style */}
        <div
          data-spec-bottom
          className="flex items-baseline justify-between gap-3 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/55"
        >
          <span className="truncate tabular-nums text-ink/60">
            {t("specObj", { id: projectId ? shortMid(projectId) : "—" })}
          </span>
          <span className="shrink-0 tabular-nums text-ink/40">
            {createdAtMs ? formatPrintedDate(createdAtMs) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CornerTicks() {
  const stroke = "rgba(22,19,16,0.42)";
  return (
    <svg
      aria-hidden
      data-corner-ticks
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g stroke={stroke} strokeWidth="0.9" strokeLinecap="square">
        {/* TL */}
        <line x1="0" y1="10" x2="0" y2="0" />
        <line x1="0" y1="0" x2="10" y2="0" />
        {/* TR */}
        <line x1="100%" y1="10" x2="100%" y2="0" />
        <line x1="calc(100% - 10px)" y1="0" x2="100%" y2="0" />
        {/* BL */}
        <line x1="0" y1="calc(100% - 10px)" x2="0" y2="100%" />
        <line x1="0" y1="100%" x2="10" y2="100%" />
        {/* BR */}
        <line
          x1="100%"
          y1="calc(100% - 10px)"
          x2="100%"
          y2="100%"
        />
        <line x1="calc(100% - 10px)" y1="100%" x2="100%" y2="100%" />
      </g>
    </svg>
  );
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatPrintedDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  // Three-letter month + day + last-two of year — short and printable.
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${String(d.getDate()).padStart(2, "0")} '${String(d.getFullYear()).slice(-2)}`;
}
