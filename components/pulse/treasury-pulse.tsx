"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@/lib/cn";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { Address } from "@/components/identity/address";
import { RelativeTime } from "@/components/identity/relative-time";
import { MonoLabel } from "@/components/primitives/mono-label";
import { PulseCounter } from "./pulse-counter";
import { usePulseEvents } from "./use-pulse-events";
import type { Accent } from "@/types/pandabox";
import type { PulseEventDTO } from "./types";

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
};

type Variant = "hero" | "compact";

const DIMS: Record<Variant, { w: number; h: number; pad: number; cap: number; baseline: number }> = {
  hero: { w: 720, h: 360, pad: 32, cap: 24, baseline: 280 },
  compact: { w: 180, h: 40, pad: 6, cap: 12, baseline: 30 },
};

function peakHeight(amountMist: bigint, maxH: number): number {
  // log scale; 0.1 SUI → ~10% of max, 100 SUI → ~85%, 1k SUI → max
  const sui = Number(amountMist) / 1e9;
  if (sui <= 0) return 4;
  const log = Math.log10(sui + 0.1) + 1; // ~0 at 0.1 SUI, ~4 at 1000 SUI
  return Math.max(4, Math.min(maxH, (log / 4) * maxH));
}

export function TreasuryPulse({
  variant = "hero",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const dims = DIMS[variant];
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { events, tvlMist } = usePulseEvents({
    capacity: dims.cap,
    enabled: visible,
    intervalMs: 6000,
  });

  const slotWidth = (dims.w - dims.pad * 2) / Math.max(1, dims.cap);
  const maxPeak = dims.baseline - dims.pad;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative overflow-hidden">
        <svg
          width="100%"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="none"
          className={cn(
            variant === "hero" ? "mask-fade-x" : undefined,
            "block",
          )}
          aria-hidden
        >
          {/* Baseline rule */}
          <line
            x1={dims.pad}
            x2={dims.w - dims.pad}
            y1={dims.baseline}
            y2={dims.baseline}
            stroke="rgba(22,19,16,0.25)"
            strokeWidth="1"
          />

          {/* Ghost tick grid */}
          {variant === "hero" &&
            Array.from({ length: dims.cap }).map((_, i) => {
              const x = dims.w - dims.pad - i * slotWidth - slotWidth / 2;
              return (
                <line
                  key={i}
                  x1={x}
                  x2={x}
                  y1={dims.baseline}
                  y2={dims.baseline + 6}
                  stroke="rgba(22,19,16,0.12)"
                  strokeWidth="1"
                />
              );
            })}

          <PeakLayer
            events={events}
            slotWidth={slotWidth}
            maxPeak={maxPeak}
            baseline={dims.baseline}
            rightEdge={dims.w - dims.pad}
            reduced={reduced}
            variant={variant}
          />
        </svg>
      </div>

      {variant === "hero" && (
        <div className="mt-6 flex items-baseline justify-between border-t border-ink/15 pt-4">
          <div>
            <MonoLabel>Total raised across Pandabox</MonoLabel>
            <div className="mt-2 flex items-baseline gap-2 text-3xl">
              <SuiGlyph size={14} className="text-ink/60" />
              <PulseCounter mist={tvlMist} />
            </div>
          </div>
          {events[0] && <RecentRow event={events[0]} />}
        </div>
      )}
    </div>
  );
}

function PeakLayer({
  events,
  slotWidth,
  maxPeak,
  baseline,
  rightEdge,
  reduced,
  variant,
}: {
  events: PulseEventDTO[];
  slotWidth: number;
  maxPeak: number;
  baseline: number;
  rightEdge: number;
  reduced: boolean;
  variant: Variant;
}) {
  const containerRef = useRef<SVGGElement>(null);
  const lastTopRef = useRef<string | null>(null);

  useGSAP(
    () => {
      if (reduced || !containerRef.current) return;
      const top = events[0]?.txHash ?? null;
      if (top && top !== lastTopRef.current) {
        const node = containerRef.current.querySelector<SVGGElement>(
          `[data-peak="${top}"]`,
        );
        if (node) {
          gsap.fromTo(
            node,
            { opacity: 0, scaleY: 0.2, transformOrigin: `center ${baseline}px` },
            {
              opacity: 1,
              scaleY: 1,
              duration: 0.42,
              ease: "power3.out",
            },
          );
        }
        lastTopRef.current = top;
      }
    },
    { dependencies: [events[0]?.txHash, reduced, baseline], scope: containerRef },
  );

  return (
    <g ref={containerRef}>
      {events.map((e, i) => {
        const x = rightEdge - i * slotWidth - slotWidth / 2;
        const h = peakHeight(BigInt(e.amountMist), maxPeak);
        const color = ACCENT_HEX[e.projectAccent];
        const opacity = Math.max(0.18, 1 - i / events.length);
        const tickSize = variant === "compact" ? 1.4 : 2.2;
        return (
          <g
            key={e.txHash}
            data-peak={e.txHash}
            style={{ transition: "transform 380ms cubic-bezier(0.25, 1, 0.5, 1)" }}
          >
            <line
              x1={x}
              x2={x}
              y1={baseline}
              y2={baseline - h}
              stroke={color}
              strokeWidth={variant === "compact" ? 1 : 1.25}
              opacity={opacity}
              strokeLinecap="round"
            />
            <circle
              cx={x}
              cy={baseline - h}
              r={tickSize}
              fill={color}
              opacity={opacity}
            />
            <rect
              x={x - tickSize}
              y={baseline}
              width={tickSize * 2}
              height="1"
              fill={color}
              opacity={opacity * 0.7}
            />
          </g>
        );
      })}
    </g>
  );
}

function RecentRow({ event }: { event: PulseEventDTO }) {
  return (
    <div className="text-right text-sm">
      <MonoLabel>Most recent</MonoLabel>
      <div className="mt-1 flex items-center justify-end gap-2 font-mono tabular-nums text-ink/80">
        <span style={{ color: ACCENT_HEX[event.projectAccent] }}>●</span>
        <span>{event.projectName}</span>
        <span className="text-ink/40">←</span>
        <span>
          <SuiGlyph size={11} className="text-ink/50" />{" "}
          {(Number(BigInt(event.amountMist)) / 1e9).toFixed(2)}
        </span>
        <span className="text-ink/40">·</span>
        <Address value={event.payer} copyable={false} />
        <span className="text-ink/40">·</span>
        <RelativeTime value={event.timestamp} />
      </div>
    </div>
  );
}
