"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { NoiseLayer } from "@/components/primitives/noise-layer";
import { Address } from "@/components/identity/address";
import { HeroConsole } from "./hero-console";

// Mirrors @pandasui/ui Button (variant=ink/secondary, size=lg) so the hero
// CTAs read as siblings of the nav's ConnectWallet button — same shadow-offset
// lift, same uppercase tracking, same ease-atelier curve.
const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-14 px-7 font-sans font-medium uppercase tracking-[0.12em] text-[0.8125rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink";
const CTA_INK = "bg-saffron text-ink";
const CTA_SECONDARY = "bg-bone text-ink";

export type HeroStats = {
  projectCount: number;
  platformFeeBps?: number;
  treasuryAddress?: string;
};

export type HeroProps = {
  stats: HeroStats;
  packageId: string;
  network: "mainnet" | "testnet";
};

export function Hero({ stats, packageId, network }: HeroProps) {
  const scope = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const t = useTranslations("home.hero");

  useGSAP(
    () => {
      const words =
        scope.current?.querySelectorAll<HTMLElement>("[data-hero-word]");
      const fades =
        scope.current?.querySelectorAll<HTMLElement>("[data-hero-fade]") ?? [];
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) {
        gsap.set([...(words ?? []), ...fades], { opacity: 1, y: 0 });
        return;
      }

      if (words && words.length) {
        gsap.fromTo(
          words,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.04,
          },
        );
      }
      gsap.fromTo(
        fades,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          delay: 0.4,
          stagger: 0.08,
        },
      );
    },
    { dependencies: [locale], revertOnUpdate: true, scope },
  );

  return (
    <section ref={scope} className="relative overflow-hidden">
      <NoiseLayer />

      {/* Faint structural grid behind the whole hero — 12-col hairlines that
          give the asymmetric layout an engineered "console" feeling. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 mx-auto hidden max-w-[1400px] grid-cols-12 px-6 lg:grid"
      >
        {Array.from({ length: 13 }).map((_, i) => (
          <div
            key={i}
            className="h-full border-l border-ink/[0.05]"
            style={{ gridColumnStart: i + 1 }}
          />
        ))}
      </div>

      <div className="container relative z-10 grid min-h-[calc(100svh-4rem)] grid-cols-1 items-center gap-12 py-16 lg:grid-cols-[1.35fr_1fr] lg:gap-16 lg:py-20">
        {/* LEFT — narrative column */}
        <div className="relative">
          <div data-hero-fade className="opacity-0">
            <span className="inline-flex items-center gap-2 border border-ink/25 bg-bone/60 px-3 py-1">
              <span
                className="block h-1.5 w-1.5 rounded-full bg-saffron"
                style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
              />
              <MonoLabel className="text-[10px]">
                {t("live", { network })}
              </MonoLabel>
            </span>
          </div>

          <h1
            className={cn(
              "mt-8 max-w-[14ch] text-balance font-display leading-[0.95] tracking-tight",
              "text-5xl sm:text-6xl md:text-7xl xl:text-[6.5rem]",
            )}
          >
            {renderWords(t("titleFund"))}{" "}
            <Marker color="saffron">
              <span data-hero-word className="inline-block opacity-0">
                {t("titleWorth")}
              </span>
            </Marker>{" "}
            {renderWords(t("titleFunding"))}
            <br className="hidden sm:block" />
            <span className="inline-flex items-baseline gap-3">
              {renderWords(t("titleOnSui"))}
              <SerifPunctuator />
            </span>
          </h1>

          <p
            data-hero-fade
            className="mt-7 max-w-[48ch] text-base text-ink/70 opacity-0 md:text-lg"
          >
            {t("tagline")}
          </p>

          <div
            data-hero-fade
            className="mt-8 flex flex-wrap items-center gap-3 opacity-0"
          >
            <Link href="/create" className={cn(CTA_BASE, CTA_INK)}>
              <span>{t("ctaLaunch")}</span>
              <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
                <ArrowDiag size={14} />
              </span>
            </Link>
            <Link href="/explore" className={cn(CTA_BASE, CTA_SECONDARY)}>
              <span>{t("ctaExplore")}</span>
              <span className="inline-flex shrink-0 transition-transform duration-300 group-hover:translate-x-[2px]">
                <ArrowDiag size={14} />
              </span>
            </Link>
          </div>

          {/* Spec line — the "real builders" signal */}
          <div
            data-hero-fade
            className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/15 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 opacity-0"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-1 w-1 rounded-full bg-ink/40" />
              {t("specVersion")}
            </span>
            <span className="text-ink/20">·</span>
            <span>{t("specNetwork", { network })}</span>
            <span className="text-ink/20">·</span>
            <span className="inline-flex items-center gap-2 normal-case tracking-normal">
              <span className="text-[10px] uppercase tracking-[0.14em]">
                {t("specPkg")}
              </span>
              <Address
                value={packageId}
                copyable
                head={6}
                tail={4}
                className="text-ink/60"
              />
            </span>
          </div>
        </div>

        {/* RIGHT — live console */}
        <div className="relative">
          <HeroConsole
            projectCount={stats.projectCount}
            platformFeeBps={stats.platformFeeBps}
            treasuryAddress={stats.treasuryAddress}
            network={network}
          />
          {/* Decorative mono-label crop marks around the console */}
          <span
            aria-hidden
            className="absolute -left-3 -top-3 hidden font-mono text-[9px] uppercase tracking-[0.14em] text-ink/30 lg:block"
          >
            ┌
          </span>
          <span
            aria-hidden
            className="absolute -bottom-3 -right-3 hidden font-mono text-[9px] uppercase tracking-[0.14em] text-ink/30 lg:block"
          >
            ┘
          </span>
        </div>
      </div>
    </section>
  );
}

function SerifPunctuator() {
  // A small, deliberate diecut "chip" — a single visual punctuation mark
  // beside the headline. Reads as a typographic flourish, not decoration.
  return (
    <span
      aria-hidden
      className="diecut inline-flex h-3 w-3 translate-y-[-0.2em] bg-ink md:h-4 md:w-4"
      style={{ ["--c" as string]: "3px" }}
    />
  );
}

function renderWords(text: string) {
  // Each word is its own `inline-block` so GSAP can stagger them
  // independently. Trailing whitespace inside `inline-block` collapses on
  // some browsers (Chrome's text run merging eats it), so use a non-
  // breaking space — guarantees the gap between words renders regardless
  // of box layout or font metrics.
  const words = text.split(" ");
  return words.map((w, i) => (
    <span key={`${i}-${w}`} data-hero-word className="inline-block opacity-0">
      {w}
      {i < words.length - 1 ? " " : ""}
    </span>
  ));
}
