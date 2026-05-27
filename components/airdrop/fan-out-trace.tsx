"use client";

import { cn } from "@pandasui/ui/lib";
import { useEffect, useMemo, useState } from "react";

/**
 * The /airdrop hero visual — a live trace map of one source node fanning to
 * many recipient nodes. Pure SVG + CSS keyframes; no GSAP / motion lib yet
 * so the surface is server-renderable as soon as the page lands, with the
 * client-only `'use client'` boundary reserved for the state transitions
 * that arrive in later phases.
 *
 * Design intent: read as an air-traffic radar or a telescope mapping —
 * calm and technical at rest, only kinetic when something is happening.
 * Deliberately avoids the diecut clip-path so the surface feels distinct
 * from the launchpad core; geometry leans on hairlines + offset shadows +
 * corner ticks instead.
 *
 * Four discrete states:
 *
 *   · `idle`     — ambient breathing on the source node, dimmed spokes,
 *                  no recipients placed. The default when the user has
 *                  no draft yet.
 *   · `preview`  — recipient nodes appear in a procedural radial scatter,
 *                  light up in a slow stagger. Used while the user is
 *                  composing the recipient list.
 *   · `running`  — particles fire from source to recipient in sequence,
 *                  nodes "lock" as they receive. Used during PTB submit
 *                  in later phases.
 *   · `settled`  — all recipients filled; brief success glow; fades back
 *                  to idle with the bumped lifetime counter.
 *
 * Only `idle` and `preview` are wired today — `running` / `settled` will
 * be reached by Phase 6's submit flow.
 */

type FanOutState = "idle" | "preview" | "running" | "settled";

const VISIBLE_NODE_CAP = 36;

const POPPY = "#C47557";

export function FanOutTrace({
  state,
  recipientCount,
  totalAirdrops,
  maxRecipients,
  className,
}: {
  state: FanOutState;
  recipientCount: number;
  totalAirdrops: number;
  maxRecipients: number;
  className?: string;
}) {
  // Cap the visible node count for visual sanity — 300 dots in a radial
  // scatter is noise, not signal. Above the cap we render the cap and
  // surface the true count in the chrome strip below.
  const visibleCount = Math.min(recipientCount, VISIBLE_NODE_CAP);
  const nodes = useMemo(() => layoutNodes(visibleCount), [visibleCount]);
  const showRecipients = state !== "idle" && recipientCount > 0;
  const reducedMotion = usePrefersReducedMotion();
  // Suppress the kinetic moments when the user prefers reduced motion. The
  // CSS keyframes are already clamped by the global `* { animation-duration:
  // 0.01ms }` rule, but SMIL `<animate>` elements bypass CSS entirely — we
  // have to skip rendering them here.
  const isRunning = state === "running" && !reducedMotion;

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-ink/15 bg-bone",
        className,
      )}
    >
      {/* Corner ticks — quiet L-marks that mark this as a measurement surface
          rather than a marketing block. Replaces the diecut motif. */}
      <CornerTick className="left-2 top-2" />
      <CornerTick className="right-2 top-2 rotate-90" />
      <CornerTick className="left-2 bottom-2 -rotate-90" />
      <CornerTick className="right-2 bottom-2 rotate-180" />

      <svg
        viewBox="0 0 800 280"
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {/* Background grid — almost invisible measurement grid. Reads as
            "instrument", not decoration. */}
        <defs>
          <pattern
            id="airdrop-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0 L0 0 0 32"
              fill="none"
              stroke="rgba(22,19,16,0.05)"
              strokeWidth="0.6"
            />
          </pattern>
          <radialGradient id="airdrop-source-glow">
            <stop offset="0%" stopColor={POPPY} stopOpacity="0.28" />
            <stop offset="60%" stopColor={POPPY} stopOpacity="0.05" />
            <stop offset="100%" stopColor={POPPY} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="800" height="280" fill="url(#airdrop-grid)" />

        {/* Reticle around the source node — two crossing dashed axes that
            converge at (200, 140). Reads as "this is the origin". */}
        <line
          x1="40"
          x2="360"
          y1="140"
          y2="140"
          stroke="rgba(22,19,16,0.18)"
          strokeWidth="0.7"
          strokeDasharray="2 4"
        />
        <line
          x1="200"
          x2="200"
          y1="40"
          y2="240"
          stroke="rgba(22,19,16,0.18)"
          strokeWidth="0.7"
          strokeDasharray="2 4"
        />

        {/* Spokes — drawn from source to each visible node. The reason for
            drawing them even when no recipients are placed: the idle state
            still hints at the fan-out shape. We render 12 "ghost" spokes
            at low opacity in idle mode, and replace them with real
            recipient-bound spokes in preview/running/settled. */}
        {!showRecipients
          ? IDLE_GHOST_ANGLES.map((angle, i) => (
              <line
                key={`ghost-${i}`}
                x1="200"
                y1="140"
                x2={200 + Math.cos(angle) * 220}
                y2={140 + Math.sin(angle) * 110}
                stroke={POPPY}
                strokeOpacity="0.12"
                strokeWidth="0.8"
                strokeDasharray="3 5"
              />
            ))
          : nodes.map((n, i) => (
              <line
                key={`spoke-${i}`}
                x1="200"
                y1="140"
                x2={n.x}
                y2={n.y}
                stroke={POPPY}
                strokeOpacity={isRunning ? 0.5 : 0.32}
                strokeWidth="0.9"
                strokeDasharray={isRunning ? "0" : "3 4"}
              />
            ))}

        {/* Running-state particles — one per visible node. SMIL motion along
            the spoke. Reserved for Phase 6; rendered conditionally so the
            DOM stays small at idle. */}
        {isRunning &&
          nodes.map((n, i) => (
            <circle
              key={`particle-${i}`}
              r="2.2"
              fill={POPPY}
              opacity="0"
            >
              <animate
                attributeName="cx"
                from="200"
                to={n.x}
                dur="0.9s"
                begin={`${0.02 * i}s`}
                repeatCount="1"
              />
              <animate
                attributeName="cy"
                from="140"
                to={n.y}
                dur="0.9s"
                begin={`${0.02 * i}s`}
                repeatCount="1"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="0.9s"
                begin={`${0.02 * i}s`}
                repeatCount="1"
              />
            </circle>
          ))}

        {/* Source glow — gentle ambient pulse. Stays on across all states
            so the eye anchors on the origin. */}
        <circle
          cx="200"
          cy="140"
          r="56"
          fill="url(#airdrop-source-glow)"
          style={{
            transformOrigin: "200px 140px",
            animation: "airdrop-source-breath 4.8s ease-in-out infinite",
          }}
        />

        {/* Source node — a hairline square with the lifetime counter
            inside. The square is rotated 45° to read as a diamond / token
            shape rather than a generic box; differentiates from the
            redeem tool's circular pools. */}
        <g transform="translate(200 140) rotate(45)">
          <rect
            x="-26"
            y="-26"
            width="52"
            height="52"
            fill="#F7F1E3"
            stroke="#161310"
            strokeWidth="1.2"
          />
          <rect
            x="-22"
            y="-22"
            width="44"
            height="44"
            fill="none"
            stroke={POPPY}
            strokeWidth="0.9"
            strokeDasharray="2 3"
            opacity="0.6"
          />
        </g>
        {/* Counterrotated text inside the diamond so labels stay upright. */}
        <text
          x="200"
          y="134"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="9"
          letterSpacing="0.18em"
          fill="#161310"
          opacity="0.55"
        >
          SOURCE
        </text>
        <text
          x="200"
          y="152"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="13"
          fontWeight="600"
          fill="#161310"
        >
          {formatCounter(totalAirdrops)}
        </text>

        {/* Recipient nodes — small hairline rects laid out in a deterministic
            radial scatter. Each one gets a staggered "fill" animation in
            preview/running states. */}
        {showRecipients &&
          nodes.map((n, i) => (
            <g key={`node-${i}`} transform={`translate(${n.x} ${n.y})`}>
              <rect
                x="-6"
                y="-4.5"
                width="12"
                height="9"
                fill="#F7F1E3"
                stroke="#161310"
                strokeWidth="0.8"
              />
              {/* Fill bar — animated in stagger to reinforce "one signature
                  arrives at many wallets" without dragging the eye away
                  from the source. */}
              <rect
                x="-4"
                y="-2.5"
                width="8"
                height="1.6"
                fill={POPPY}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "left center",
                  animation: isRunning
                    ? `airdrop-fill 0.6s ease-out ${0.02 * i + 0.6}s 1 forwards`
                    : state === "settled"
                      ? "none"
                      : `airdrop-preview-fill 2.4s ease-out ${0.04 * i}s infinite`,
                  transform:
                    state === "settled" ? "scaleX(1)" : undefined,
                }}
              />
              <rect
                x="-4"
                y="0.5"
                width="5"
                height="1"
                fill="#161310"
                opacity="0.3"
              />
            </g>
          ))}

        {/* Overflow ribbon — when the true count exceeds the visible cap,
            show a small mono ribbon outside the scatter so the eye reads
            "this is a sample, not the whole list". */}
        {recipientCount > VISIBLE_NODE_CAP && (
          <g transform="translate(720 30)">
            <line
              x1="-46"
              x2="0"
              y1="0"
              y2="0"
              stroke={POPPY}
              strokeOpacity="0.55"
              strokeWidth="0.9"
              strokeDasharray="3 4"
            />
            <text
              x="-50"
              y="3"
              textAnchor="end"
              fontFamily="var(--font-mono), monospace"
              fontSize="9"
              letterSpacing="0.14em"
              fill="#161310"
              opacity="0.6"
            >
              +{recipientCount - VISIBLE_NODE_CAP} MORE
            </text>
          </g>
        )}

        {/* Cap-line — a quiet hairline ruler along the lower edge marking
            the platform's max recipients. Reads as a measurement scale. */}
        <line
          x1="40"
          x2="760"
          y1="248"
          y2="248"
          stroke="rgba(22,19,16,0.18)"
          strokeWidth="0.7"
        />
        <line
          x1={40 + (Math.min(recipientCount, maxRecipients) / Math.max(maxRecipients, 1)) * 720}
          x2={40 + (Math.min(recipientCount, maxRecipients) / Math.max(maxRecipients, 1)) * 720}
          y1="244"
          y2="252"
          stroke={POPPY}
          strokeWidth="1.6"
        />
        <text
          x="40"
          y="264"
          fontFamily="var(--font-mono), monospace"
          fontSize="9"
          letterSpacing="0.18em"
          fill="#161310"
          opacity="0.45"
        >
          0
        </text>
        <text
          x="760"
          y="264"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="9"
          letterSpacing="0.18em"
          fill="#161310"
          opacity="0.45"
        >
          {maxRecipients} CAP
        </text>

        <style>{`
          @keyframes airdrop-source-breath {
            0%   { transform: scale(0.96); opacity: 0.85 }
            50%  { transform: scale(1.04); opacity: 1 }
            100% { transform: scale(0.96); opacity: 0.85 }
          }
          @keyframes airdrop-preview-fill {
            0%   { transform: scaleX(0); opacity: 0.35 }
            55%  { transform: scaleX(1); opacity: 1 }
            100% { transform: scaleX(1); opacity: 0.85 }
          }
          @keyframes airdrop-fill {
            0%   { transform: scaleX(0); opacity: 0.5 }
            100% { transform: scaleX(1); opacity: 1 }
          }
        `}</style>
      </svg>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

/**
 * Deterministic radial scatter — for a given recipient count, return that
 * many `{x,y}` points in the right half of the canvas. Uses a Fibonacci
 * angle (the golden-angle sunflower pattern) so adding/removing one
 * recipient doesn't reshuffle the whole layout — only the most recent
 * point appears or disappears.
 *
 * The cluster is biased toward the right two-thirds of the canvas; the
 * source node anchors the left third (x ≈ 200). Radius range is tuned
 * to fit ~36 nodes without visible collision inside an 800×280 viewBox.
 */
function layoutNodes(n: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  const out: { x: number; y: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const baseRadius = 110;
  const radiusSpread = 80;
  const cx = 520;
  const cy = 140;
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / VISIBLE_NODE_CAP;
    const r = baseRadius + Math.sqrt(t) * radiusSpread;
    const a = i * goldenAngle - Math.PI / 2;
    out.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * 0.62,
    });
  }
  return out;
}

const IDLE_GHOST_ANGLES = Array.from({ length: 12 }, (_, i) => {
  const half = Math.PI / 1.6;
  return -half / 2 + (i / 11) * half;
});

function formatCounter(n: number): string {
  if (n < 1000) return n.toString().padStart(4, "0");
  if (n < 1_000_000) {
    return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  }
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * `prefers-reduced-motion` media-query hook. Local to this file because
 * the FanOutTrace is the only consumer that needs SMIL-aware reduced-
 * motion handling (other components rely on the global CSS rule that
 * clamps animation-duration to 0.01ms — SMIL ignores that).
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

function CornerTick({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn("absolute z-[1]", className)}
      aria-hidden
    >
      <path
        d="M0 0 L0 10 M0 0 L10 0"
        stroke="#161310"
        strokeOpacity="0.45"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  );
}
