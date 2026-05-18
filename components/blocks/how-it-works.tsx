import { cn } from "@pandasui/ui/lib";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RevealOnView } from "@/components/motion";

type Accent = "saffron" | "poppy" | "jade";

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
};

export function HowItWorks() {
  return (
    <section className="relative border-t border-ink/15">
      <Container className="py-20 lg:py-28">
        <div className="mb-12 max-w-2xl">
          <AccentRule color="saffron">
            <MonoLabel>How it works</MonoLabel>
          </AccentRule>
          <h2 className="mt-3 text-3xl md:text-4xl">
            Three steps from idea to on-chain funding.
          </h2>
          <p className="mt-4 max-w-prose text-base text-ink/65">
            Every parameter you configure here becomes a Move call. Every
            interaction your supporters take becomes a transaction. Pandabox
            is what's between.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
          <RevealOnView delayMs={0}>
            <StepCard
              number="01"
              accent="saffron"
              heading="Deploy"
              body="Configure cycles, payouts, tokens, and optional NFT tiers. Sign one Sui transaction. Your project goes live with an admin cap object you own."
              meta="pandabox::create_project"
              diagram={<DeployDiagram />}
            />
          </RevealOnView>
          <RevealOnView delayMs={80}>
            <StepCard
              number="02"
              accent="poppy"
              heading="Receive"
              body="Supporters pay SUI directly to your treasury. They receive project tokens at your cycle's weight, plus tier NFTs if you defined any."
              meta="pandabox::pay → Paid event"
              diagram={<ReceiveDiagram />}
            />
          </RevealOnView>
          <RevealOnView delayMs={160}>
            <StepCard
              number="03"
              accent="jade"
              heading="Reconfigure"
              body="Propose changes for the next cycle. After the ballot delay, the new parameters lock in. Holders can cash out surplus at any time."
              meta="queue_reconfiguration · ballot 4d 12h"
              diagram={<ReconfigureDiagram />}
            />
          </RevealOnView>
        </div>
      </Container>
    </section>
  );
}

function StepCard({
  number,
  accent,
  heading,
  body,
  meta,
  diagram,
}: {
  number: string;
  accent: Accent;
  heading: string;
  body: string;
  meta: string;
  diagram: React.ReactNode;
}) {
  const accentDot: Record<Accent, string> = {
    saffron: "bg-saffron",
    poppy: "bg-poppy",
    jade: "bg-jade",
  };
  return (
    <article
      className={cn(
        "group relative h-full bg-bone border border-ink shadow-offset-sm",
        "transition-all duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
      )}
    >
      {/* Header band */}
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn("block h-2 w-2 rounded-full", accentDot[accent])}
            aria-hidden
          />
          <MonoLabel accent={accent} className="text-[10px]">
            Step {number}
          </MonoLabel>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
          on-chain
        </span>
      </header>

      {/* Diagram zone */}
      <div className="relative h-[200px] overflow-hidden border-b border-ink/10">
        {/* Faint dot pattern as canvas backdrop — purely decorative depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #161310 1px, transparent 1.2px)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative h-full">{diagram}</div>
        {/* Outsized step number, half-transparent, behind everything */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-2 font-display text-[64px] leading-none text-ink/[0.06]"
        >
          {number}
        </span>
      </div>

      {/* Copy */}
      <div className="px-5 pt-5 pb-4">
        <h3 className="font-display text-2xl leading-tight">{heading}</h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink/65">{body}</p>
      </div>

      {/* Meta footer */}
      <footer className="flex items-center gap-2 border-t border-ink/15 bg-ink/[0.02] px-5 py-3">
        <span
          aria-hidden
          className="block h-1 w-1 rounded-full bg-ink/40"
        />
        <code className="font-mono text-[11px] text-ink/55">{meta}</code>
      </footer>
    </article>
  );
}

/* ───────────────────────── Diagrams ───────────────────────── */

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
  // AdminCap mini-pill — appears beside it.
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Stitching hairlines */}
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

      {/* Center diecut object — the Project */}
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
        {/* Inner "PROJECT" mark — small dot + bar */}
        <circle cx="140" cy="96" r="3" fill="#161310" />
        <rect x="130" y="104" width="20" height="3" fill="#161310" />
        <rect x="134" y="111" width="12" height="2" fill="#161310" opacity="0.6" />
      </g>

      {/* AdminCap pill to the right — generative identicon */}
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
        {/* Identicon 5x5 */}
        {[
          [0, 0], [2, 0], [4, 0],
          [1, 1], [3, 1],
          [0, 2], [2, 2], [4, 2],
          [1, 3], [3, 3],
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

      {/* Sparks at the convergence point */}
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
  // Channel runs left → right at y=100 between x=60 and x=210.
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Supporter dot left */}
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

      {/* Channel — solid baseline + dashed track */}
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

      {/* Flowing SUI coins */}
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
            {/* SUI mini-glyph */}
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

      {/* Treasury — diecut box right */}
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

      {/* Token mint counter above — fades in/out in sync with arrivals */}
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

      {/* Small arrow indicating direction */}
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
  const color = ACCENT_HEX.jade;
  const sky = "#6D8796";
  // Cycle clock at (140, 100), r=48
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Outer cycle ring */}
      <circle
        cx="140"
        cy="100"
        r="56"
        fill="none"
        stroke="rgba(22,19,16,0.12)"
        strokeWidth="1"
      />

      {/* Tick marks every 30deg */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const inner = 50;
        const outer = 56;
        const x1 = 140 + Math.cos(a) * inner;
        const y1 = 100 + Math.sin(a) * inner;
        const x2 = 140 + Math.cos(a) * outer;
        const y2 = 100 + Math.sin(a) * outer;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(22,19,16,0.25)"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Current cycle — solid jade arc that sweeps */}
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "140px 100px",
          animation: "hiw-cycle-sweep 6s linear infinite",
        }}
      >
        <path
          d="M 140 52 A 48 48 0 0 1 188 100"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Tip dot */}
        <circle cx="188" cy="100" r="3" fill={color} />
      </g>

      {/* Queued cycle — dashed sky arc on the opposite side */}
      <path
        d="M 92 100 A 48 48 0 0 1 140 52"
        fill="none"
        stroke={sky}
        strokeWidth="1.3"
        strokeDasharray="3 4"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* Center — small rotating diamond marker */}
      <g
        className="hiw-fb"
        style={{
          transformOrigin: "140px 100px",
          animation: "hiw-orbit 8s linear infinite",
        }}
      >
        <polygon
          points="140,90 150,100 140,110 130,100"
          fill="none"
          stroke="#161310"
          strokeWidth="1"
        />
        <circle cx="140" cy="100" r="1.8" fill={color} />
      </g>

      {/* "CYCLE 04" label inside */}
      <text
        x="140"
        y="138"
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="7"
        fill="#161310"
        opacity="0.55"
        letterSpacing="0.18em"
      >
        CYCLE Nº 04
      </text>

      {/* Left side — parameter swap demonstration */}
      <g>
        <text
          x="20"
          y="46"
          fontFamily="var(--font-mono), monospace"
          fontSize="7"
          fill="#161310"
          opacity="0.5"
          letterSpacing="0.14em"
        >
          WEIGHT
        </text>
        <text
          x="20"
          y="58"
          fontFamily="var(--font-mono), monospace"
          fontSize="10"
          fill="#161310"
          letterSpacing="0.02em"
        >
          1,000,000
        </text>
        <g
          style={{
            animation: "hiw-text-swap 4.5s ease-in-out infinite",
            transformBox: "fill-box",
            transformOrigin: "left center",
          }}
        >
          <text
            x="20"
            y="74"
            fontFamily="var(--font-mono), monospace"
            fontSize="9"
            fill={color}
            letterSpacing="0.02em"
          >
            → 950,000
          </text>
          <text
            x="78"
            y="74"
            fontFamily="var(--font-mono), monospace"
            fontSize="6"
            fill="#161310"
            opacity="0.5"
            letterSpacing="0.14em"
          >
            QUEUED
          </text>
        </g>
      </g>

      {/* Right side — ballot delay countdown */}
      <g>
        <text
          x="260"
          y="158"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="7"
          fill="#161310"
          opacity="0.5"
          letterSpacing="0.14em"
        >
          BALLOT DELAY
        </text>
        <text
          x="260"
          y="172"
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize="11"
          fill={sky}
          letterSpacing="0.02em"
        >
          4d{" "}
          <tspan
            style={{ animation: "hiw-ballot-tick 1s ease-in-out infinite" }}
          >
            12h
          </tspan>
        </text>
      </g>
    </svg>
  );
}
