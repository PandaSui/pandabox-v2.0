"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@/lib/cn";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { NoiseLayer } from "@/components/primitives/noise-layer";
import { SplitFlapCounter } from "@/components/data";

export type HeroStats = {
  projectCount: number;
  raisedSui: number;
  supporters: number;
};

export function Hero({ stats }: { stats: HeroStats }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      const words = scope.current?.querySelectorAll<HTMLElement>(
        "[data-hero-word]",
      );
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
        scope.current?.querySelectorAll<HTMLElement>("[data-hero-fade]") ?? [],
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
    { scope },
  );

  return (
    <section
      ref={scope}
      className="relative min-h-[calc(100svh-4rem)] overflow-hidden"
    >
      <NoiseLayer />
      <div className="container relative z-10 flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16 lg:py-24">
        <div data-hero-fade className="opacity-0">
          <span className="inline-flex items-center gap-2 border border-ink/25 bg-bone/60 px-3 py-1">
            <span
              className="block h-1.5 w-1.5 rounded-full bg-saffron"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            <MonoLabel className="text-[10px]">Live on Sui mainnet</MonoLabel>
          </span>
        </div>

        <h1
          className={cn(
            "mt-10 max-w-[16ch] text-balance font-display leading-[0.95] tracking-tight",
            "text-6xl sm:text-7xl md:text-8xl",
          )}
        >
          {renderWords("Fund what's")} <Marker color="saffron">
            <span data-hero-word className="inline-block opacity-0">worth</span>
          </Marker>{" "}
          {renderWords("funding. On Sui.")}
        </h1>

        <p
          data-hero-fade
          className="mt-8 max-w-[52ch] text-lg text-ink/70 opacity-0 md:text-xl"
        >
          Pandabox is the programmable funding platform for Sui. Launch a
          project in minutes. Receive SUI, issue tokens, define payouts — all
          on-chain, all transparent, all yours.
        </p>

        <div data-hero-fade className="mt-10 flex flex-wrap items-center gap-3 opacity-0">
          <Link
            href="/create"
            className="diecut bg-ink px-6 py-3 text-bone hover:bg-ink-90 transition-colors"
          >
            <span className="font-mono-label">Launch a project</span>
          </Link>
          <Link
            href="/explore"
            className="diecut border border-ink px-6 py-3 hover:bg-ink hover:text-bone transition-colors"
          >
            <span className="font-mono-label">Explore projects</span>
          </Link>
        </div>

        <div
          data-hero-fade
          className="mt-12 flex flex-wrap items-baseline gap-6 border-t border-ink/15 pt-6 opacity-0"
        >
          <StatPill label="Projects" value={stats.projectCount} />
          <span className="text-ink/30">·</span>
          <StatPill
            label="SUI raised"
            value={Math.round(stats.raisedSui)}
          />
          <span className="text-ink/30">·</span>
          <StatPill label="Supporters" value={stats.supporters} />
        </div>
      </div>
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <SplitFlapCounter value={value} className="text-2xl" />
      <MonoLabel className="text-[10px]">{label}</MonoLabel>
    </span>
  );
}

function renderWords(text: string) {
  return text.split(" ").map((w, i) => (
    <span key={`${i}-${w}`} data-hero-word className="inline-block opacity-0">
      {w}
      {i < text.split(" ").length - 1 ? " " : ""}
    </span>
  ));
}
