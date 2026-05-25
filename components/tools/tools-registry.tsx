import type { Tool, ToolAccent, ToolStatus } from "./tool-card";
import { TOOL_ACCENT_HEX } from "./tool-card";

/**
 * The tools registry. The single source of truth for everything tool-related —
 * which tools exist, their accent/status/route, the glyph + preview diagram
 * each one ships with. The landing-page block reads this for its compact
 * tiles; `/tools` reads it for the full cards. Add a new tool here and it
 * surfaces in both places.
 *
 * Translation is layered on top via a `messages` map keyed by `slug`, so the
 * registry stays language-agnostic and the JSON file is the only place that
 * carries copy.
 */

type ToolMeta = {
  slug: string;
  accent: ToolAccent;
  status: ToolStatus;
  href?: string;
  moveCall: string;
  Glyph: (props: { color: string }) => React.ReactElement;
  Diagram: () => React.ReactElement;
};

export const TOOLS_META: readonly ToolMeta[] = [
  {
    slug: "airdrop",
    accent: "poppy",
    status: "soon",
    moveCall: "pandabox::airdrop::send_bulk",
    Glyph: GlyphAirdrop,
    Diagram: AirdropDiagram,
  },
  {
    slug: "redeem",
    accent: "sun",
    status: "soon",
    moveCall: "pandabox::redeem::buyback",
    Glyph: GlyphRedeem,
    Diagram: RedeemDiagram,
  },
] as const;

export type ToolMessages = Record<
  string,
  {
    name: string;
    tagline: string;
    description: string;
    capabilities: [string, string, string];
  }
>;

/** Merge static registry + translated copy into the `Tool` shape the cards expect. */
export function hydrateTools(messages: ToolMessages): Tool[] {
  return TOOLS_META.map((meta) => {
    const m = messages[meta.slug];
    return {
      slug: meta.slug,
      accent: meta.accent,
      status: meta.status,
      href: meta.href,
      moveCall: meta.moveCall,
      Glyph: meta.Glyph,
      Diagram: meta.Diagram,
      name: m.name,
      tagline: m.tagline,
      description: m.description,
      capabilities: m.capabilities,
    };
  });
}

/* ─────────────────────────── Glyphs ─────────────────────────── */

function GlyphAirdrop({ color }: { color: string }) {
  // A node at top spraying three trails of fine particles outward — the visual
  // of a single transaction fanning into many wallet recipients.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle
        cx="11"
        cy="4"
        r="2.2"
        stroke={color}
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M11 6.4 L11 11"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11 11 L4.5 17"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M11 11 L11 18"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M11 11 L17.5 17"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="4.5" cy="17" r="1.2" fill={color} />
      <circle cx="11" cy="18" r="1.2" fill={color} />
      <circle cx="17.5" cy="17" r="1.2" fill={color} />
    </svg>
  );
}

function GlyphRedeem({ color }: { color: string }) {
  // A circular flow — tokens in, SUI out. Two opposing chevrons orbit a tiny
  // central token to convey "buyback pool" rather than a one-way trade.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="7.5"
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        strokeDasharray="2 3"
        opacity="0.55"
      />
      <path
        d="M5.5 8.5 L9 8.5 L9 5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M16.5 13.5 L13 13.5 L13 17"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="11" cy="11" r="1.8" fill={color} />
    </svg>
  );
}

/* ─────────────────────────── Diagrams ─────────────────────────── */

function AirdropDiagram() {
  const color = TOOL_ACCENT_HEX.poppy;
  // Compact horizontal banner — source pill on the left fans out to a row
  // of recipient wallets on the right via hairline spokes. A single particle
  // travels each spoke on a staggered loop, so the whole strip reads as
  // "one transaction settling across many addresses" at a glance.
  const sourceX = 30;
  const sourceY = 48;
  const wallets = [
    { x: 200, y: 16 },
    { x: 232, y: 30 },
    { x: 260, y: 48 },
    { x: 232, y: 66 },
    { x: 200, y: 80 },
  ];
  return (
    <svg
      viewBox="0 0 320 96"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* Source pill — the single signed transaction */}
      <g>
        <rect
          x="6"
          y="30"
          width="48"
          height="36"
          fill={color}
          opacity="0.16"
          stroke={color}
          strokeWidth="0.7"
        />
        <rect
          x="6"
          y="30"
          width="48"
          height="36"
          fill="none"
          stroke="#161310"
          strokeWidth="0.9"
        />
        <text
          x={sourceX}
          y="44"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="5.5"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.16em"
        >
          1 SIG
        </text>
        <text
          x={sourceX}
          y="56"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="7"
          fill={color}
          fontWeight="600"
          letterSpacing="0.02em"
        >
          send_bulk
        </text>
      </g>

      {/* Spokes + animated particles */}
      {wallets.map((w, i) => (
        <g key={i}>
          <line
            x1={sourceX + 24}
            y1={sourceY}
            x2={w.x - 8}
            y2={w.y}
            stroke="rgba(22,19,16,0.18)"
            strokeWidth="0.9"
          />
          <line
            x1={sourceX + 24}
            y1={sourceY}
            x2={w.x - 8}
            y2={w.y}
            stroke={color}
            strokeWidth="0.7"
            strokeDasharray="2 3"
            opacity="0.55"
          />
          {/* Particle riding the spoke */}
          <circle
            r="1.6"
            fill={color}
            style={{
              animation: `airdrop-particle-${i} 3.6s linear ${i * 0.32}s infinite`,
            }}
          >
            <animate
              attributeName="cx"
              from={sourceX + 24}
              to={w.x - 8}
              dur="3.6s"
              begin={`${i * 0.32}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              from={sourceY}
              to={w.y}
              dur="3.6s"
              begin={`${i * 0.32}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              dur="3.6s"
              begin={`${i * 0.32}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}

      {/* Recipient wallets — small slots that "fill" on a stagger */}
      {wallets.map((w, i) => (
        <g key={`wallet-${i}`}>
          <rect
            x={w.x - 8}
            y={w.y - 6}
            width="16"
            height="12"
            fill="#F7F1E3"
            stroke="#161310"
            strokeWidth="0.8"
          />
          <rect
            x={w.x - 5}
            y={w.y - 3}
            width="10"
            height="1.6"
            fill={color}
            style={{
              transformBox: "fill-box",
              transformOrigin: "left center",
              animation: `airdrop-fill 3.6s ease-out ${0.6 + i * 0.32}s infinite`,
            }}
          />
          <rect
            x={w.x - 5}
            y={w.y + 0.5}
            width="6"
            height="1"
            fill="#161310"
            opacity="0.3"
          />
        </g>
      ))}

      <style>{`
        @keyframes airdrop-fill {
          0% { transform: scaleX(0); opacity: 0.4 }
          55% { transform: scaleX(1); opacity: 1 }
          100% { transform: scaleX(1); opacity: 0.85 }
        }
      `}</style>
    </svg>
  );
}

function RedeemDiagram() {
  const color = TOOL_ACCENT_HEX.sun;
  // Compact horizontal banner — three stations laid left-to-right: holders,
  // buyback pool, treasury. Tokens flow right (burn), SUI flows left (payout),
  // and the pool itself "breathes" by gently scaling its fill bar. Reads as
  // a closed liquidity loop the moment the eye lands on it.
  return (
    <svg
      viewBox="0 0 320 96"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* Holders — left column */}
      <g>
        <rect
          x="8"
          y="18"
          width="48"
          height="60"
          fill="#F7F1E3"
          stroke="#161310"
          strokeWidth="0.9"
        />
        <text
          x="32"
          y="28"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="5"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.16em"
        >
          HOLDERS
        </text>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(14, ${36 + i * 12})`}>
            <circle r="2.6" cx="3" cy="3" fill={color} opacity="0.85" />
            <rect x="8" y="1.5" width="22" height="1.5" fill="#161310" opacity="0.4" />
            <rect x="8" y="5" width="16" height="1" fill="#161310" opacity="0.25" />
          </g>
        ))}
      </g>

      {/* Pool — center */}
      <g>
        <rect
          x="124"
          y="14"
          width="72"
          height="68"
          fill={color}
          opacity="0.16"
          stroke="#161310"
          strokeWidth="0.9"
        />
        <text
          x="160"
          y="26"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="5"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.16em"
        >
          BUYBACK POOL
        </text>

        {/* fill level — animated rise/fall */}
        <rect
          x="126"
          y="58"
          width="68"
          height="22"
          fill={color}
          opacity="0.55"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center bottom",
            animation: "redeem-pool 4.4s ease-in-out infinite",
          }}
        />
        {/* floor reference */}
        <line
          x1="124"
          x2="196"
          y1="56"
          y2="56"
          stroke="#161310"
          strokeWidth="0.7"
          strokeDasharray="2 3"
          opacity="0.55"
        />
        <text
          x="160"
          y="73"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="7"
          fill="#161310"
          fontWeight="600"
        >
          1.42 SUI
        </text>
        <text
          x="160"
          y="42"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="5"
          fill={color}
          fontWeight="600"
          letterSpacing="0.14em"
        >
          FLOOR
        </text>
      </g>

      {/* Treasury — right diecut polygon */}
      <g>
        <polygon
          points="232,18 290,18 304,30 304,66 290,78 232,78 218,66 218,30"
          fill={color}
          opacity="0.16"
          stroke="#161310"
          strokeWidth="0.9"
        />
        <text
          x="261"
          y="32"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="5"
          fill="#161310"
          opacity="0.55"
          letterSpacing="0.16em"
        >
          TREASURY
        </text>
        <text
          x="261"
          y="54"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="9"
          fill="#161310"
          fontWeight="600"
        >
          412 SUI
        </text>
        <text
          x="261"
          y="68"
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize="5"
          fill="#161310"
          opacity="0.5"
          letterSpacing="0.14em"
        >
          FUNDS POOL
        </text>
      </g>

      {/* Tracks between stations */}
      <line x1="56" x2="124" y1="48" y2="48" stroke="rgba(22,19,16,0.18)" strokeWidth="0.9" />
      <line x1="56" x2="124" y1="48" y2="48" stroke={color} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.45" />
      <line x1="196" x2="218" y1="48" y2="48" stroke="rgba(22,19,16,0.18)" strokeWidth="0.9" />
      <line x1="196" x2="218" y1="48" y2="48" stroke={color} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.45" />

      {/* Tokens burning into the pool (left → middle) */}
      {[0, 1, 2].map((i) => (
        <circle key={`tok-${i}`} r="2.6" fill={color} stroke="#161310" strokeWidth="0.7">
          <animate
            attributeName="cx"
            from="56"
            to="124"
            dur="3.4s"
            begin={`${i * 1.1}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            from="48"
            to="48"
            dur="3.4s"
            begin={`${i * 1.1}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="3.4s"
            begin={`${i * 1.1}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* SUI flowing from pool back to holders (middle → left) */}
      {[0, 1, 2].map((i) => (
        <polygon
          key={`sui-${i}`}
          points="-3,0 0,-3 3,0 0,3"
          fill="#F7F1E3"
          stroke={color}
          strokeWidth="0.9"
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            from="196 48"
            to="56 48"
            dur="3.4s"
            begin={`${0.55 + i * 1.1}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="3.4s"
            begin={`${0.55 + i * 1.1}s`}
            repeatCount="indefinite"
          />
        </polygon>
      ))}

      <style>{`
        @keyframes redeem-pool {
          0% { transform: scaleY(0.5) }
          50% { transform: scaleY(1) }
          100% { transform: scaleY(0.65) }
        }
      `}</style>
    </svg>
  );
}
