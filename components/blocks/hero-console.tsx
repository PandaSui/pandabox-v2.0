"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SplitFlapCounter } from "@/components/data";
import { Address } from "@/components/identity/address";
import { SuiGlyph } from "@/components/identity/sui-glyph";
import { RelativeTime } from "@/components/identity/relative-time";
import { usePulseEvents } from "@/components/pulse/use-pulse-events";
import type { PulseEventDTO } from "@/components/pulse/types";
import type { Accent } from "@/types/pandabox";

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
};

const PULSE_W = 480;
const PULSE_H = 132;
const PULSE_PAD = 18;
const PULSE_CAP = 18;
const PULSE_BASELINE = 104;

function peakHeight(amountMist: bigint, maxH: number): number {
  const sui = Number(amountMist) / 1e9;
  if (sui <= 0) return 4;
  const log = Math.log10(sui + 0.1) + 1;
  return Math.max(4, Math.min(maxH, (log / 4) * maxH));
}

export type HeroConsoleProps = {
  projectCount: number;
  platformFeeBps?: number;
  treasuryAddress?: string;
  network: "mainnet" | "testnet";
  className?: string;
};

export function HeroConsole({
  projectCount,
  platformFeeBps,
  treasuryAddress,
  network,
  className,
}: HeroConsoleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [seq, setSeq] = useState(0);

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

  const { events, arrivalNonce } = usePulseEvents({
    capacity: PULSE_CAP,
    enabled: visible,
    intervalMs: 5000,
  });

  useEffect(() => {
    if (arrivalNonce > 0) setSeq((s) => s + 1);
  }, [arrivalNonce]);

  const recent = events.slice(0, 3);

  return (
    <div
      ref={ref}
      data-hero-fade
      className={cn(
        "relative bg-bone/85 opacity-0 backdrop-blur-[2px]",
        className,
      )}
    >
      {/* Outer frame layer — pulses subtly on each new event for a "signal
          received" feel without breaking the diecut silhouette. */}
      <FrameLayer arrivalNonce={arrivalNonce} reduced={reduced} />

      <div className="diecut relative">
        <ConsoleHeader
          network={network}
          sequence={seq}
          arrivalNonce={arrivalNonce}
          reduced={reduced}
        />

        <PulseStrip
          events={events}
          arrivalNonce={arrivalNonce}
          reduced={reduced}
        />

        <RecentStream
          events={recent}
          arrivalNonce={arrivalNonce}
          reduced={reduced}
        />

        <StatsFooter
          projectCount={projectCount}
          platformFeeBps={platformFeeBps}
          treasuryAddress={treasuryAddress}
          arrivalNonce={arrivalNonce}
          reduced={reduced}
        />
      </div>
    </div>
  );
}

function FrameLayer({
  arrivalNonce,
  reduced,
}: {
  arrivalNonce: number;
  reduced: boolean;
}) {
  const tintRef = useRef<HTMLDivElement>(null);
  const lastNonceRef = useRef(arrivalNonce);
  const initRef = useRef(false);

  useGSAP(
    () => {
      if (arrivalNonce === lastNonceRef.current) return;
      lastNonceRef.current = arrivalNonce;
      if (!initRef.current) {
        initRef.current = true;
        return;
      }
      if (reduced || !tintRef.current) return;
      gsap.fromTo(
        tintRef.current,
        { opacity: 0.22 },
        { opacity: 0, duration: 0.9, ease: "power2.out" },
      );
    },
    { dependencies: [arrivalNonce, reduced] },
  );

  return (
    <>
      <div className="diecut absolute inset-0 bg-ink/[0.06]" aria-hidden />
      <div className="diecut absolute inset-[1px] bg-bone" aria-hidden />
      <div
        ref={tintRef}
        aria-hidden
        className="diecut pointer-events-none absolute inset-0 bg-saffron opacity-0"
      />
    </>
  );
}

function ConsoleHeader({
  network,
  sequence,
  arrivalNonce,
  reduced,
}: {
  network: "mainnet" | "testnet";
  sequence: number;
  arrivalNonce: number;
  reduced: boolean;
}) {
  const seqRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const lastNonceRef = useRef(arrivalNonce);
  const initRef = useRef(false);

  useGSAP(
    () => {
      if (arrivalNonce === lastNonceRef.current) return;
      lastNonceRef.current = arrivalNonce;
      if (!initRef.current) {
        initRef.current = true;
        return;
      }
      if (reduced) return;

      if (seqRef.current) {
        gsap.fromTo(
          seqRef.current,
          { color: "#B8C45E", y: -1, scale: 1.05 },
          {
            color: "rgba(22,19,16,0.5)",
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: "power2.out",
          },
        );
      }
      if (labelRef.current) {
        const tl = gsap.timeline();
        tl.to(labelRef.current, {
          color: "#B8C45E",
          duration: 0.12,
          ease: "power2.out",
        }).to(labelRef.current, {
          color: "rgba(22,19,16,0.6)",
          duration: 0.55,
          ease: "power2.out",
        });
      }
    },
    { dependencies: [arrivalNonce, reduced] },
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-5 pt-5 pb-3">
      <div className="flex items-center gap-2">
        <span className="relative inline-flex">
          <span
            className="block h-1.5 w-1.5 rounded-full bg-saffron"
            style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
          />
          <span className="absolute inset-0 rounded-full bg-saffron/40 blur-[3px]" />
        </span>
        <MonoLabel className="text-[10px]">
          <span ref={labelRef}>Live console</span>
        </MonoLabel>
      </div>
      <div className="flex items-center gap-3">
        <span
          ref={seqRef}
          data-seq
          className="font-mono tabular-nums text-[10px] text-ink/50"
          aria-label="Stream sequence"
        >
          SEQ {sequence.toString().padStart(4, "0")}
        </span>
        <span className="inline-flex items-center gap-1.5 border border-ink/20 px-2 py-0.5">
          <span className="block h-1 w-1 rounded-full bg-jade" />
          <MonoLabel className="text-[9px]">
            {network === "mainnet" ? "Sui mainnet" : "Sui testnet"}
          </MonoLabel>
        </span>
      </div>
    </div>
  );
}

function PulseStrip({
  events,
  arrivalNonce,
  reduced,
}: {
  events: PulseEventDTO[];
  arrivalNonce: number;
  reduced: boolean;
}) {
  const slotWidth = (PULSE_W - PULSE_PAD * 2) / Math.max(1, PULSE_CAP);
  const maxPeak = PULSE_BASELINE - PULSE_PAD;
  const containerRef = useRef<SVGGElement>(null);
  const scannerRef = useRef<SVGLineElement>(null);
  const flashRef = useRef<SVGLineElement>(null);
  const lastTopRef = useRef<string | null>(null);
  const lastNonceRef = useRef(arrivalNonce);
  const initRef = useRef(false);

  // Peak grow-in on each new top event.
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
            {
              opacity: 0,
              scaleY: 0.2,
              transformOrigin: `center ${PULSE_BASELINE}px`,
            },
            { opacity: 1, scaleY: 1, duration: 0.42, ease: "power3.out" },
          );
        }
        lastTopRef.current = top;
      }
    },
    { dependencies: [events[0]?.txHash, reduced], scope: containerRef },
  );

  // Scanner sweep + baseline flash on each subsequent arrival.
  useGSAP(
    () => {
      if (arrivalNonce === lastNonceRef.current) return;
      lastNonceRef.current = arrivalNonce;
      if (!initRef.current) {
        initRef.current = true;
        return;
      }
      if (reduced) return;

      if (scannerRef.current) {
        gsap.killTweensOf(scannerRef.current);
        gsap.set(scannerRef.current, {
          attr: { x1: PULSE_W - PULSE_PAD, x2: PULSE_W - PULSE_PAD },
          opacity: 0.65,
        });
        gsap.to(scannerRef.current, {
          attr: { x1: PULSE_PAD, x2: PULSE_PAD },
          opacity: 0,
          duration: 0.85,
          ease: "power2.out",
        });
      }
      if (flashRef.current) {
        gsap.fromTo(
          flashRef.current,
          { opacity: 0.55, attr: { "stroke-width": 1.8 } },
          {
            opacity: 0,
            attr: { "stroke-width": 1 },
            duration: 0.9,
            ease: "power2.out",
          },
        );
      }
    },
    { dependencies: [arrivalNonce, reduced] },
  );

  return (
    <div className="relative px-5 pt-4">
      <div className="pointer-events-none absolute left-5 right-5 top-4 bottom-0 grid grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-l border-dashed border-ink/[0.06]" />
        ))}
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${PULSE_W} ${PULSE_H}`}
        preserveAspectRatio="none"
        className="mask-fade-x relative block"
        aria-hidden
      >
        {/* Baseline — flashes saffron on each arrival */}
        <line
          x1={PULSE_PAD}
          x2={PULSE_W - PULSE_PAD}
          y1={PULSE_BASELINE}
          y2={PULSE_BASELINE}
          stroke="rgba(22,19,16,0.22)"
          strokeWidth="1"
        />
        <line
          ref={flashRef}
          x1={PULSE_PAD}
          x2={PULSE_W - PULSE_PAD}
          y1={PULSE_BASELINE}
          y2={PULSE_BASELINE}
          stroke="#B8C45E"
          strokeWidth="1"
          opacity="0"
        />

        {Array.from({ length: PULSE_CAP }).map((_, i) => {
          const x = PULSE_W - PULSE_PAD - i * slotWidth - slotWidth / 2;
          return (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={PULSE_BASELINE}
              y2={PULSE_BASELINE + 4}
              stroke="rgba(22,19,16,0.12)"
              strokeWidth="1"
            />
          );
        })}

        <g ref={containerRef}>
          {events.map((e, i) => {
            const x = PULSE_W - PULSE_PAD - i * slotWidth - slotWidth / 2;
            const h = peakHeight(BigInt(e.amountMist), maxPeak);
            const color = ACCENT_HEX[e.projectAccent];
            const opacity = Math.max(0.18, 1 - i / events.length);
            return (
              <g key={e.txHash} data-peak={e.txHash}>
                <line
                  x1={x}
                  x2={x}
                  y1={PULSE_BASELINE}
                  y2={PULSE_BASELINE - h}
                  stroke={color}
                  strokeWidth="1.2"
                  opacity={opacity}
                  strokeLinecap="round"
                />
                <circle
                  cx={x}
                  cy={PULSE_BASELINE - h}
                  r="2"
                  fill={color}
                  opacity={opacity}
                />
              </g>
            );
          })}
        </g>

        {/* Scanner — right-to-left sweep on each new event */}
        <line
          ref={scannerRef}
          x1={PULSE_W - PULSE_PAD}
          x2={PULSE_W - PULSE_PAD}
          y1={PULSE_PAD}
          y2={PULSE_BASELINE}
          stroke="#B8C45E"
          strokeWidth="1"
          opacity="0"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
        <span>← 5s window · oldest</span>
        <span>now →</span>
      </div>
    </div>
  );
}

function RecentStream({
  events,
  arrivalNonce,
  reduced,
}: {
  events: PulseEventDTO[];
  arrivalNonce: number;
  reduced: boolean;
}) {
  const ulRef = useRef<HTMLUListElement>(null);
  const lastTopRef = useRef<string | null>(null);
  const lastNonceRef = useRef(arrivalNonce);
  const initializedRef = useRef(false);

  useGSAP(
    () => {
      if (!ulRef.current) return;
      const topTx = events[0]?.txHash ?? null;

      if (
        topTx === lastTopRef.current &&
        arrivalNonce === lastNonceRef.current
      ) {
        return;
      }
      lastTopRef.current = topTx;
      lastNonceRef.current = arrivalNonce;

      if (reduced) return;

      const rows =
        ulRef.current.querySelectorAll<HTMLElement>("[data-stream-row]");
      if (rows.length === 0) return;

      if (!initializedRef.current) {
        initializedRef.current = true;
        gsap.fromTo(
          rows,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: "power2.out",
            stagger: 0.07,
          },
        );
        return;
      }

      // A new event arrived. Wash the top row, dot-ring the new dot,
      // and have the existing rows settle from their previous position.
      const [topRow, ...others] = Array.from(rows);
      if (!topRow) return;

      const wash = topRow.querySelector<HTMLElement>("[data-row-wash]");
      const ring = topRow.querySelector<HTMLElement>("[data-row-ring]");

      gsap.fromTo(
        topRow,
        { opacity: 0, y: -18 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
      );
      if (wash) {
        gsap.fromTo(
          wash,
          { opacity: 0.45, scaleX: 1.02 },
          {
            opacity: 0,
            scaleX: 1,
            duration: 0.95,
            ease: "power2.out",
          },
        );
      }
      if (ring) {
        gsap.fromTo(
          ring,
          { opacity: 0.9, scale: 0.4 },
          {
            opacity: 0,
            scale: 3.4,
            duration: 0.85,
            ease: "power2.out",
          },
        );
      }

      others.forEach((row, i) => {
        gsap.fromTo(
          row,
          { y: -22, opacity: 0.4 },
          {
            y: 0,
            opacity: 1,
            duration: 0.42,
            ease: "power3.out",
            delay: 0.04 + i * 0.05,
          },
        );
      });
    },
    {
      dependencies: [events[0]?.txHash, arrivalNonce, reduced],
      scope: ulRef,
    },
  );

  return (
    <div className="border-t border-ink/15 px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <MonoLabel className="text-[10px]">Stream</MonoLabel>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
          recent payments
        </span>
      </div>
      <ul ref={ulRef} className="relative space-y-1.5">
        {events.length === 0 ? (
          <li className="font-mono text-xs text-ink/40">
            Listening for events…
          </li>
        ) : (
          events.map((e) => <StreamRow key={e.txHash} event={e} />)
        )}
        {Array.from({ length: Math.max(0, 3 - events.length) }).map((_, i) => (
          <li
            key={`ph-${i}`}
            className="h-[18px] border-t border-dashed border-ink/[0.08]"
          />
        ))}
      </ul>
    </div>
  );
}

function StreamRow({ event }: { event: PulseEventDTO }) {
  const sui = (Number(BigInt(event.amountMist)) / 1e9).toFixed(2);
  const color = ACCENT_HEX[event.projectAccent];
  return (
    <li
      data-stream-row={event.txHash}
      className="relative grid grid-cols-[14px_1fr_auto] items-center gap-3 font-mono text-[12px] tabular-nums text-ink/80"
    >
      {/* Saffron wash — flashes on enter */}
      <span
        data-row-wash
        aria-hidden
        className="pointer-events-none absolute inset-y-[-2px] inset-x-[-8px] origin-left bg-saffron opacity-0"
        style={{ mixBlendMode: "multiply" }}
      />
      <span className="relative inline-flex items-center justify-center">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        {/* Expanding ring */}
        <span
          data-row-ring
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border opacity-0"
          style={{ borderColor: color }}
        />
      </span>
      <span
        aria-label={`View project ${event.projectName}`}
        className="relative flex items-center gap-2 truncate transition-colors hover:text-ink"
      >
        {/* Show the project's on-chain object address rather than its name.
            Pandabox objects are themselves Sui addresses, so this reads as a
            raw on-chain stream — no curated branding leaking into the feed. */}
        <Address value={event.projectId} copyable={false} head={4} tail={4} />
        <span className="text-ink/30">←</span>
        <span className="flex items-center gap-1 text-ink">
          <SuiGlyph size={10} className="text-ink/55" />
          {sui}
        </span>
      </span>
      <span className="relative flex items-center gap-2 text-ink/45">
        <Address value={event.payer} copyable={false} head={4} tail={4} />
        <RelativeTime
          value={event.timestamp}
          className="text-[11px] text-ink/45"
        />
      </span>
    </li>
  );
}

function StatsFooter({
  projectCount,
  platformFeeBps,
  treasuryAddress,
  arrivalNonce,
  reduced,
}: {
  projectCount: number;
  platformFeeBps?: number;
  treasuryAddress?: string;
  arrivalNonce: number;
  reduced: boolean;
}) {
  // The Treasury cell is where every payment ultimately lands — so on each
  // new event, glint its accent rule. Semantically: "funds just hit here."
  const treasuryRuleRef = useRef<HTMLSpanElement>(null);
  const lastNonceRef = useRef(arrivalNonce);
  const initRef = useRef(false);

  useGSAP(
    () => {
      if (arrivalNonce === lastNonceRef.current) return;
      lastNonceRef.current = arrivalNonce;
      if (!initRef.current) {
        initRef.current = true;
        return;
      }
      if (reduced || !treasuryRuleRef.current) return;
      gsap.fromTo(
        treasuryRuleRef.current,
        { width: 24, opacity: 1 },
        {
          width: 48,
          opacity: 0.7,
          duration: 0.4,
          ease: "power2.out",
          yoyo: true,
          repeat: 1,
        },
      );
    },
    { dependencies: [arrivalNonce, reduced] },
  );

  const feePercent =
    typeof platformFeeBps === "number"
      ? (platformFeeBps / 100).toFixed(2)
      : null;

  return (
    <div className="grid grid-cols-[0.85fr_0.9fr_1.25fr] border-t border-ink/15">
      <StatCell label="Projects" accent="saffron">
        <SplitFlapCounter value={projectCount} className="text-lg md:text-xl" />
      </StatCell>

      <StatCell label="Platform fee" accent="poppy" border>
        {feePercent !== null ? (
          <span className="flex items-baseline gap-0.5 font-mono tabular-nums leading-none">
            <span className="text-lg md:text-xl">{feePercent}</span>
            <span className="text-[11px] text-ink/55">%</span>
          </span>
        ) : (
          <span className="font-mono text-lg text-ink/30">—</span>
        )}
      </StatCell>

      <StatCell label="Treasury" accent="jade" border ruleRef={treasuryRuleRef}>
        {treasuryAddress ? (
          <Address
            value={treasuryAddress}
            head={6}
            tail={4}
            link
            className="text-[13px] md:text-[14px]"
          />
        ) : (
          <span className="font-mono text-lg text-ink/30">—</span>
        )}
      </StatCell>
    </div>
  );
}

function StatCell({
  label,
  children,
  accent,
  border = false,
  ruleRef,
}: {
  label: string;
  children: React.ReactNode;
  accent: "saffron" | "poppy" | "jade";
  border?: boolean;
  ruleRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  const accentBg: Record<typeof accent, string> = {
    saffron: "bg-saffron",
    poppy: "bg-poppy",
    jade: "bg-jade",
  };
  return (
    <div
      className={cn("relative px-4 py-4", border && "border-l border-ink/15")}
    >
      <span
        ref={ruleRef}
        aria-hidden
        className={cn(
          "absolute left-4 top-3 block h-[3px] w-6",
          accentBg[accent],
        )}
      />
      <MonoLabel className="mt-3 block text-[9px]">{label}</MonoLabel>
      <div className="mt-2 flex items-baseline gap-1">{children}</div>
    </div>
  );
}
