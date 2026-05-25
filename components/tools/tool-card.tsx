import Link from "next/link";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";

export type ToolStatus = "available" | "soon";
export type ToolAccent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

export const TOOL_ACCENT_HEX: Record<ToolAccent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
};

export type Tool = {
  /** Stable slug for translation lookup, anchor IDs, and analytics. */
  slug: string;
  accent: ToolAccent;
  status: ToolStatus;
  /** Display name, e.g. "Airdrop". */
  name: string;
  /** Short tagline that sits below the name in the body. */
  tagline: string;
  /** One-paragraph description of what the tool does. */
  description: string;
  /** Three short capability bullets — the spec at a glance. */
  capabilities: [string, string, string];
  /** On-chain Move call hint shown in the footer, e.g. "pandabox::airdrop::send". */
  moveCall: string;
  /** Where to go when the tool is available. Ignored when `status === "soon"`. */
  href?: string;
  /** Small SVG glyph rendered at 22px. */
  Glyph: (props: { color: string }) => React.ReactElement;
  /** SVG diagram rendered in the preview window. */
  Diagram: () => React.ReactElement;
};

/* ─────────────────────────── Full card ─────────────────────────── */

/**
 * Full-bleed tool card used on `/tools`. Header band, large diagram window,
 * description + capability list, footer with Move call meta and a CTA. No
 * diecut clip-paths — borders only — to keep the tools page reading as a
 * distinct surface from project/payment chrome.
 */
export function ToolCard({
  tool,
  labels,
}: {
  tool: Tool;
  labels: {
    available: string;
    soon: string;
    open: string;
    notify: string;
    capabilities: string;
    onchainHint: string;
  };
}) {
  const { accent, status, name, tagline, capabilities, moveCall, href, Glyph, Diagram } =
    tool;
  const accentHex = TOOL_ACCENT_HEX[accent];
  const isLive = status === "available";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border border-ink bg-bone shadow-offset-sm",
        "transition-all duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
      )}
    >
      {/* Accent spine — the tool's color identity */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[3px]"
        style={{ background: accentHex }}
      />

      {/* Soft accent wash anchored to the top-right — single decorative
          element replacing the older diagram window, gives the card depth
          without the 220px height hit. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full opacity-[0.18] blur-[80px]"
        style={{ background: accentHex }}
      />

      {/* Top — glyph + status pill on a padded row */}
      <div className="relative flex items-start justify-between gap-3 px-5 pt-6">
        <span
          aria-hidden
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center"
          style={{
            background: `radial-gradient(circle at center, ${accentHex}55 0%, ${accentHex}1c 55%, transparent 78%)`,
          }}
        >
          <Glyph color={accentHex} />
        </span>
        <StatusPill
          status={status}
          accentHex={accentHex}
          availableLabel={labels.available}
          soonLabel={labels.soon}
        />
      </div>

      {/* Title block */}
      <div className="relative px-5 pt-4">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: accentHex }}
        >
          {labels.onchainHint}
        </span>
        <h3 className="mt-1 font-display text-[1.5rem] leading-[1.05]">
          {name}
        </h3>
        <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-ink/65">
          {tagline}
        </p>
      </div>

      {/* Compact animated diagram strip — full-width banner, ~96px tall.
          Lives between the title and capability list, giving each tool its
          own kinetic signature without adding the height a full preview
          window would. */}
      <div className="relative mt-5 h-[96px] overflow-hidden border-y border-ink/10 bg-bone">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[1.5px] z-10"
          style={{
            background: `linear-gradient(90deg, ${accentHex} 0%, ${accentHex}55 65%, transparent 100%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #161310 1px, transparent 1.2px)",
            backgroundSize: "10px 10px",
          }}
        />
        <div className="relative h-full">
          <Diagram />
        </div>
      </div>

      {/* Capabilities — compact list */}
      <ul className="flex flex-1 flex-col gap-1.5 px-5 py-4">
        {capabilities.map((line, i) => (
          <li
            key={i}
            className="flex items-start gap-2 font-mono text-[11.5px] leading-snug text-ink/70"
          >
            <span
              aria-hidden
              className="mt-[5px] block h-1 w-1 shrink-0"
              style={{ background: accentHex }}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {/* Footer — Move call (truncated) + CTA. Compact, hairline-divided. */}
      <footer className="relative flex items-center justify-between gap-3 border-t border-ink/15 px-5 py-3">
        <code
          className="min-w-0 truncate font-mono text-[10.5px] tracking-tight text-ink/55"
          title={moveCall}
        >
          {moveCall}
        </code>
        {isLive && href ? (
          <Link
            href={href}
            className={cn(
              "group/btn relative inline-flex h-8 shrink-0 items-center justify-center gap-1.5 border border-ink bg-ink px-3.5",
              "font-sans text-[0.7rem] font-medium uppercase tracking-[0.14em] text-bone",
              "transition-all duration-300 ease-atelier",
              "hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-offset-sm",
            )}
          >
            <span>{labels.open}</span>
            <span className="inline-flex shrink-0 transition-transform duration-300 group-hover/btn:translate-x-[2px]">
              <ArrowDiag size={9} />
            </span>
          </Link>
        ) : (
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-ink/25 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65">
            <span
              aria-hidden
              className="block h-1 w-1"
              style={{ background: accentHex }}
            />
            {labels.notify}
          </span>
        )}
      </footer>
    </article>
  );
}

/* ─────────────────────────── Compact tile ─────────────────────────── */

/**
 * Compact tool tile used in the landing-page block. Shares semantics with
 * `ToolCard` but trims the diagram and capability list so three tiles fit
 * comfortably side-by-side at typical viewport widths.
 */
export function ToolTile({
  tool,
  labels,
}: {
  tool: Tool;
  labels: {
    available: string;
    soon: string;
  };
}) {
  const { accent, status, name, tagline, Glyph } = tool;
  const accentHex = TOOL_ACCENT_HEX[accent];

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border border-ink bg-bone shadow-offset-sm",
        "transition-all duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[3px]"
        style={{ background: accentHex }}
      />

      {/* Faint accent wash behind the glyph */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-[0.16] blur-[80px]"
        style={{ background: accentHex }}
      />

      <div className="relative flex flex-1 flex-col gap-5 px-6 py-7">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="relative inline-flex h-11 w-11 items-center justify-center"
            style={{
              background: `radial-gradient(circle at center, ${accentHex}55 0%, ${accentHex}1c 55%, transparent 78%)`,
            }}
          >
            <Glyph color={accentHex} />
          </span>
          <StatusPill
            status={status}
            accentHex={accentHex}
            availableLabel={labels.available}
            soonLabel={labels.soon}
          />
        </div>
        <div>
          <h3 className="font-display text-[1.5rem] leading-[1.05]">{name}</h3>
          <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-ink/65">
            {tagline}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────── Status pill ─────────────────────────── */

function StatusPill({
  status,
  accentHex,
  availableLabel,
  soonLabel,
}: {
  status: ToolStatus;
  accentHex: string;
  availableLabel: string;
  soonLabel: string;
}) {
  if (status === "available") {
    return (
      <span
        className="inline-flex items-center gap-1.5 border border-ink/30 bg-bone px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink"
      >
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full"
          style={{
            background: accentHex,
            boxShadow: `0 0 0 3px ${accentHex}33`,
            animation: "stat-live-dot 1.4s ease-in-out infinite",
          }}
        />
        {availableLabel}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 border border-ink/20 bg-bone/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65"
    >
      <span
        aria-hidden
        className="block h-1.5 w-1.5"
        style={{ background: accentHex, opacity: 0.7 }}
      />
      {soonLabel}
    </span>
  );
}
