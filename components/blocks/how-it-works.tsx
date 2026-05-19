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
            interaction your supporters take becomes a transaction. Pandabox is
            what's between.
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
        <span aria-hidden className="block h-1 w-1 rounded-full bg-ink/40" />
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
        <rect
          x="134"
          y="111"
          width="12"
          height="2"
          fill="#161310"
          opacity="0.6"
        />
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
          [0, 0],
          [2, 0],
          [4, 0],
          [1, 1],
          [3, 1],
          [0, 2],
          [2, 2],
          [4, 2],
          [1, 3],
          [3, 3],
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
  const jade = ACCENT_HEX.jade;
  // A stylized "project metadata" card. Four field rows (name, icon,
  // description, links). A jade marker stroke writes under each row's value
  // in sequence while a pen-tip glyph hops along to match, suggesting the
  // creator editing on-chain metadata via `pandabox::update_metadata`.
  //
  // The animation cycles 5s — slow enough to read each field as it's
  // touched. CYCLE timing:
  //   0–0.4s  pen rests on row 1 (name) → marker writes
  //   1.0s    pen jumps to row 2 (icon) → marker writes
  //   2.0s    pen jumps to row 3 (description) → marker writes
  //   3.0s    pen jumps to row 4 (links) → marker writes
  //   4.5s    pen returns home, all marks fade
  //
  // Each row's underline rect uses `hiw-mu-write` with a staggered delay so
  // the strokes appear in sequence, matching the pen's position.
  const ROW_DURATION = "5s";
  return (
    <svg
      viewBox="0 0 280 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Project metadata card frame */}
      <rect
        x="40"
        y="22"
        width="200"
        height="158"
        fill="rgba(248,243,232,0.7)"
        stroke="#161310"
        strokeWidth="1"
      />

      {/* Card header strip */}
      <line
        x1="40"
        y1="40"
        x2="240"
        y2="40"
        stroke="rgba(22,19,16,0.18)"
        strokeWidth="1"
      />
      <text
        x="50"
        y="34"
        fontFamily="var(--font-mono), monospace"
        fontSize="7"
        fill="#161310"
        opacity="0.6"
        letterSpacing="0.18em"
      >
        PROJECT METADATA
      </text>
      <g>
        <circle cx="226" cy="31" r="1.6" fill={jade} />
        <text
          x="232"
          y="34"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill={jade}
          letterSpacing="0.14em"
        >
          LIVE
        </text>
      </g>

      {/* Row 1 — NAME */}
      <g>
        <text
          x="50"
          y="58"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          NAME
        </text>
        <text
          x="50"
          y="72"
          fontFamily="var(--font-mono), monospace"
          fontSize="10"
          fill="#161310"
        >
          Panda Sui
        </text>
        <rect
          x="50"
          y="75"
          width="62"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "0s",
          }}
        />
      </g>

      {/* Row 2 — ICON */}
      <g>
        <text
          x="50"
          y="92"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          ICON
        </text>
        <circle
          cx="58"
          cy="105"
          r="5.5"
          fill="rgba(110,142,93,0.18)"
          stroke="#161310"
          strokeWidth="0.8"
        />
        <text
          x="72"
          y="108"
          fontFamily="var(--font-mono), monospace"
          fontSize="8"
          fill="#161310"
          opacity="0.7"
        >
          ipfs://Qm…f9c2
        </text>
        <rect
          x="50"
          y="114"
          width="98"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "1s",
          }}
        />
      </g>

      {/* Row 3 — DESCRIPTION */}
      <g>
        <text
          x="50"
          y="130"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          DESCRIPTION
        </text>
        <rect
          x="50"
          y="135"
          width="160"
          height="2.5"
          fill="#161310"
          opacity="0.28"
        />
        <rect
          x="50"
          y="141"
          width="120"
          height="2.5"
          fill="#161310"
          opacity="0.28"
        />
        <rect
          x="50"
          y="148"
          width="120"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "2s",
          }}
        />
      </g>

      {/* Row 4 — LINKS */}
      <g>
        <text
          x="50"
          y="164"
          fontFamily="var(--font-mono), monospace"
          fontSize="6.5"
          fill="#161310"
          opacity="0.45"
          letterSpacing="0.16em"
        >
          LINKS
        </text>
        {/* Three small link chips */}
        <g opacity="0.7">
          <rect
            x="50"
            y="168"
            width="22"
            height="6"
            fill="none"
            stroke="#161310"
            strokeWidth="0.7"
          />
          <rect
            x="76"
            y="168"
            width="22"
            height="6"
            fill="none"
            stroke="#161310"
            strokeWidth="0.7"
          />
          <rect
            x="102"
            y="168"
            width="22"
            height="6"
            fill="none"
            stroke="#161310"
            strokeWidth="0.7"
          />
        </g>
        <rect
          x="50"
          y="176"
          width="74"
          height="1.6"
          fill={jade}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
            animation: `hiw-mu-write ${ROW_DURATION} ease-in-out infinite`,
            animationDelay: "3s",
          }}
        />
      </g>

      {/* Pen-tip glyph that traverses the rows in sync with the writes.
          Sits at the right edge of the card and steps down 28px per row. */}
      <g
        style={{
          transformBox: "fill-box",
          transformOrigin: "top left",
          animation: `hiw-mu-pen ${ROW_DURATION} ease-in-out infinite`,
        }}
      >
        {/* Nib + barrel */}
        <g transform="translate(218 64)">
          <polygon
            points="0,0 10,-3 12,-1 4,7"
            fill={jade}
            stroke="#161310"
            strokeWidth="0.7"
          />
          <polygon points="0,0 3,2 4,7" fill="#161310" />
          <line
            x1="10"
            y1="-3"
            x2="22"
            y2="-15"
            stroke="#161310"
            strokeWidth="1.2"
          />
          {/* Ink droplet under tip — pulses softly */}
          <circle
            cx="4"
            cy="11"
            r="1.4"
            fill={jade}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "hiw-dot-pulse 1.6s ease-in-out infinite",
            }}
          />
        </g>
      </g>

      {/* Bottom — module call label */}
      <text
        x="140"
        y="14"
        textAnchor="middle"
        fontFamily="var(--font-mono), monospace"
        fontSize="6.5"
        fill="#161310"
        opacity="0.5"
        letterSpacing="0.18em"
      >
        pandabox::update_metadata
      </text>
    </svg>
  );
}
