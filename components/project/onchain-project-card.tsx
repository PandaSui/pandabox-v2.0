"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RelativeTime } from "@/components/identity/relative-time";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import type { OnChainProject } from "@/lib/projects";
import { hasValidParams } from "@/lib/project-health";
import { TokenDisc } from "./token-disc";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

const ACCENT_BG_SOFT: Record<Accent, string> = {
  saffron: "bg-saffron/15",
  poppy: "bg-poppy/15",
  jade: "bg-jade/15",
  sky: "bg-sky/15",
  sun: "bg-sun/20",
  plum: "bg-plum/15",
};

const ACCENT_BG_SOLID: Record<Accent, string> = {
  saffron: "bg-saffron",
  poppy: "bg-poppy",
  jade: "bg-jade",
  sky: "bg-sky",
  sun: "bg-sun",
  plum: "bg-plum",
};

const ACCENT_TEXT: Record<Accent, string> = {
  saffron: "text-saffron",
  poppy: "text-poppy",
  jade: "text-jade",
  sky: "text-sky",
  sun: "text-sun",
  plum: "text-plum",
};

/** 24h in milliseconds — threshold for the poppy urgency tint. */
const URGENCY_MS = 24 * 60 * 60 * 1000;

/**
 * Passport-style project card driven by on-chain data only. Used on
 * landing's `<FeaturedProjects>` and on `/explore`. Picks an accent from
 * `accent` (caller's choice) or falls back to plum.
 *
 * Motion: a single reversible GSAP hover timeline drives the cover tint,
 * disc scale, status pulse, and arrow slide together — one shape moving as
 * one object. A separate scroll-trigger fills the progress bar from 0 to
 * the live value on first viewport entry, with the percentage counter
 * ticking alongside. Both honor `prefers-reduced-motion`.
 */
export function OnchainProjectCard({
  project,
  rank,
  accent,
  priority = false,
}: {
  project: OnChainProject;
  /** Optional rank ribbon (e.g. top-3 on landing). */
  rank?: number;
  accent?: Accent;
  priority?: boolean;
}) {
  const a: Accent = accent ?? "plum";
  const scope = useRef<HTMLElement>(null);

  const validParams = hasValidParams(project);
  const safeBaseRate = BigInt(project.baseRate || 1);
  // Move contract uses `tokens_raw = mist * base_rate`, so inverting is a
  // plain division — no extra MIST_PER_SUI factor.
  const raisedMist = project.sold / safeBaseRate;
  const targetMist = project.fundingAllocation / safeBaseRate;

  const pctBp =
    project.fundingAllocation > 0n
      ? Number((project.sold * 10_000n) / project.fundingAllocation)
      : 0;
  const pct = Math.min(100, Math.max(0, pctBp / 100));

  const now = Date.now();
  const ended = now > project.endTimeMs;
  const live = project.status === "live" && !ended;
  const msLeft = project.endTimeMs - now;
  const urgent = live && msLeft > 0 && msLeft < URGENCY_MS;
  const tokenSlug = shortTokenSlug(project.tokenType);

  useGSAP(
    () => {
      if (!scope.current) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Progress-bar reveal + percent count-up on first viewport entry.
      const fill = scope.current.querySelector<HTMLElement>("[data-progress-fill]");
      const percent = scope.current.querySelector<HTMLElement>("[data-progress-pct]");
      let progressIO: IntersectionObserver | null = null;
      if (fill && !reduce) {
        gsap.set(fill, { width: "0%" });
        progressIO = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              gsap.to(fill, {
                width: `${pct}%`,
                duration: 0.9,
                ease: "power3.out",
              });
              if (percent) {
                const obj = { v: 0 };
                gsap.to(obj, {
                  v: pct,
                  duration: 0.9,
                  ease: "power3.out",
                  onUpdate: () => {
                    percent.firstChild!.textContent = obj.v.toFixed(
                      obj.v >= 10 ? 0 : 1,
                    );
                  },
                });
              }
              progressIO?.disconnect();
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
        );
        progressIO.observe(scope.current);
      } else if (fill) {
        gsap.set(fill, { width: `${pct}%` });
      }

      // Continuous live-dot pulse — slower + softer than a CSS keyframe so
      // it doesn't compete with the Treasury Pulse on the page.
      const dot = scope.current.querySelector<HTMLElement>("[data-live-dot]");
      if (dot && !reduce) {
        gsap.fromTo(
          dot,
          { scale: 1, opacity: 1 },
          {
            scale: 1.55,
            opacity: 0.35,
            duration: 1.1,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
        );
      }

      // Reversible hover choreography — one timeline, paused at 0.
      const disc = scope.current.querySelector<HTMLElement>("[data-disc]");
      const cover = scope.current.querySelector<HTMLElement>("[data-cover-tint]");
      const arrow = scope.current.querySelector<HTMLElement>("[data-arrow]");
      const ring = scope.current.querySelector<HTMLElement>("[data-disc-ring]");

      const hover = gsap
        .timeline({ paused: true, defaults: { ease: "power3.out", duration: 0.35 } })
        .to(disc, { scale: 1.05 }, 0)
        .to(cover, { opacity: 1 }, 0)
        .to(arrow, { x: 4, y: -4 }, 0)
        .to(ring, { opacity: 0.85, scale: 1.04 }, 0);

      const article = scope.current;
      const onEnter = () => !reduce && hover.play();
      const onLeave = () => !reduce && hover.reverse();
      article.addEventListener("mouseenter", onEnter);
      article.addEventListener("mouseleave", onLeave);
      article.addEventListener("focusin", onEnter);
      article.addEventListener("focusout", onLeave);

      return () => {
        article.removeEventListener("mouseenter", onEnter);
        article.removeEventListener("mouseleave", onLeave);
        article.removeEventListener("focusin", onEnter);
        article.removeEventListener("focusout", onLeave);
        progressIO?.disconnect();
      };
    },
    { scope, dependencies: [pct] },
  );

  return (
    <article
      ref={scope}
      className={cn(
        "group relative flex h-full flex-col bg-bone border border-ink shadow-offset-sm",
        "transition-transform duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
        "focus-within:-translate-x-[2px] focus-within:-translate-y-[2px] focus-within:shadow-offset",
      )}
    >
      {/* ─── Cover panel ─── */}
      <div className="relative aspect-[16/9] overflow-hidden border-b border-ink/15 bg-bone">
        {/* Soft accent tint + hairline crosshatch texture */}
        <div
          aria-hidden
          className={cn("absolute inset-0", ACCENT_BG_SOFT[a])}
        />
        {/* Hover-only deepener — sits on top of the base tint and fades in
            via the GSAP hover timeline. Same accent class so the tint
            roughly doubles when the user is engaging with the card. */}
        <div
          aria-hidden
          data-cover-tint
          className={cn("absolute inset-0 opacity-0", ACCENT_BG_SOFT[a])}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, currentColor 1px, transparent 1px), linear-gradient(-45deg, currentColor 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            color: "rgb(28 27 26 / 1)",
          }}
        />

        {/* Centered token disc with a thin GSAP-animated ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[78%] aspect-square">
            {/* Pulse ring — expands subtly on hover */}
            <div
              aria-hidden
              data-disc-ring
              className="absolute -inset-1.5 rounded-full border border-ink/30"
              style={{ opacity: 0 }}
            />
            <div
              data-disc
              className="relative h-full w-full overflow-hidden rounded-full border-[1.5px] border-ink bg-bone"
            >
              <TokenDisc
                src={project.iconUrl}
                name={project.name}
                accent={a}
                priority={priority}
                sizes="(min-width:1280px) 18vw, (min-width:1024px) 22vw, (min-width:768px) 30vw, 50vw"
              />
            </div>
          </div>
        </div>

        {/* Top-left: rank if supplied, otherwise blank */}
        {rank != null && (
          <div className="diecut absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 border border-ink bg-bone px-2 py-1 shadow-offset-sm">
            <span
              aria-hidden
              className={cn("block h-1 w-1 rounded-full", ACCENT_BG_SOLID[a])}
            />
            <MonoLabel className="text-[9px]">
              Nº {String(rank).padStart(2, "0")}
            </MonoLabel>
          </div>
        )}

        {/* Top-right: status stack — Legacy + Live/Ended + Verified can all coexist */}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
          {!validParams && (
            <span
              className="diecut inline-flex items-center gap-1 border border-poppy/60 bg-poppy/15 px-2 py-1 backdrop-blur-[2px]"
              title="Deployed before 9-decimal scaling fix — numbers are unreliable."
            >
              <span aria-hidden className="block h-1 w-1 rounded-full bg-poppy" />
              <MonoLabel className="text-[9px] text-poppy">legacy</MonoLabel>
            </span>
          )}

          <span
            className={cn(
              "diecut inline-flex items-center gap-1 border bg-bone/90 px-2 py-1 shadow-offset-sm backdrop-blur-[2px]",
              live
                ? "border-jade/60"
                : ended
                  ? "border-ink/40"
                  : "border-ink/30",
            )}
          >
            <span
              aria-hidden
              data-live-dot={live ? "" : undefined}
              className={cn(
                "block h-1 w-1 rounded-full origin-center",
                live ? "bg-jade" : ended ? "bg-ink/40" : "bg-ink/30",
              )}
            />
            <MonoLabel
              className={cn(
                "text-[9px]",
                live ? "text-jade" : ended ? "text-ink/60" : "text-ink/55",
              )}
            >
              {live ? "live" : ended ? "ended" : "idle"}
            </MonoLabel>
          </span>

          {project.verified && (
            <span className="diecut inline-flex items-center gap-1 border border-ink/30 bg-bone/90 px-2 py-1 backdrop-blur-[2px]">
              <svg
                width="8"
                height="8"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-jade"
                aria-hidden
              >
                <path d="M2 6.5l3 3 5-6" />
              </svg>
              <MonoLabel className="text-[9px]">verified</MonoLabel>
            </span>
          )}
        </div>
      </div>

      {/* Stretched link — overlays the whole card so the cover, disc, and
          status pill are all clickable. The body Link below keeps the
          underline-on-hover hint on the title. */}
      <Link
        href={`/p/${project.id}`}
        aria-label={`View ${project.name || "project"}`}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      />

      {/* ─── Body ─── */}
      <Link
        href={`/p/${project.id}`}
        tabIndex={-1}
        aria-hidden
        className="relative z-0 flex flex-1 flex-col px-4 pt-3.5 pb-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <MonoLabel
            accent={a}
            className={cn("truncate text-[10px]", ACCENT_TEXT[a])}
          >
            {tokenSlug || `Nº ${String(project.number).padStart(2, "0")}`}
          </MonoLabel>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {relativeAgeLabel(project.createdAtMs)}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-medium leading-tight tracking-tight text-ink group-hover:underline group-hover:underline-offset-4">
            {project.name || "Unnamed project"}
          </h3>
          <span data-arrow className="inline-block shrink-0 text-ink/30 group-hover:text-ink">
            <ArrowGlyph />
          </span>
        </div>

        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-ink/50">
          by {shortAddr(project.creator)}
        </p>

        {/* Progress meter — the one signal that drives the click */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between font-mono text-[12px] tabular-nums">
            <span className="inline-flex items-baseline gap-1.5">
              {live ? (
                <span className="bg-saffron px-1 text-ink">
                  {formatSuiFromMist(raisedMist)}
                </span>
              ) : (
                <span className="text-ink/80">
                  {formatSuiFromMist(raisedMist)}
                </span>
              )}
              <SuiGlyph size={11} className="opacity-70" />
              <span className="text-ink/40">
                / {formatSuiFromMist(targetMist)}
              </span>
            </span>
            <span data-progress-pct className="text-ink">
              <span>{pct.toFixed(pct >= 10 ? 0 : 1)}</span>
              <span className="text-ink/45">%</span>
            </span>
          </div>
          <div className="relative mt-1.5 h-[3px] overflow-hidden bg-ink/10">
            <div
              data-progress-fill
              className={cn("absolute inset-y-0 left-0", ACCENT_BG_SOLID[a])}
              style={{ width: `${pct}%` }}
            />
            {/* 100% reference tick */}
            <span
              aria-hidden
              className="absolute right-0 top-0 h-full w-px bg-ink/20"
            />
          </div>
        </div>

        {/* Time-pressure cue — poppy when <24h to nudge urgency */}
        <div
          className={cn(
            "mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] lowercase",
            urgent ? "text-poppy" : "text-ink/55",
          )}
        >
          {urgent && (
            <span aria-hidden className="block h-1 w-1 rounded-full bg-poppy" />
          )}
          {ended ? "ended " : "ends "}
          <RelativeTime
            value={project.endTimeMs}
            className={cn(
              "text-[11px]",
              urgent ? "text-poppy" : "text-ink/70",
            )}
          />
        </div>
      </Link>
    </article>
  );
}

function ArrowGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function formatSuiFromMist(mist: bigint): string {
  return formatToken(mist, 9);
}

function formatToken(raw: bigint, decimals = 9): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(1) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortTokenSlug(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1]?.toUpperCase() ?? "";
}

function relativeAgeLabel(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(0, Math.floor(diff / 60_000));
  return `${mins}m ago`;
}
