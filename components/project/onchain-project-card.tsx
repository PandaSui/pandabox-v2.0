import Image from "next/image";
import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { RelativeTime } from "@/components/identity/relative-time";
import { explorerUrl } from "@/lib/sui";
import type { OnChainProject } from "@/lib/projects";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

const ACCENT_BG_SOFT: Record<Accent, string> = {
  saffron: "bg-saffron/15",
  poppy: "bg-poppy/15",
  jade: "bg-jade/15",
  sky: "bg-sky/15",
  sun: "bg-sun/20",
  plum: "bg-plum/15",
};

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
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

/**
 * Passport-style project card driven by on-chain data only. Used on
 * landing's `<FeaturedProjects>` and on `/explore`. Picks an accent from
 * `accent` (caller's choice) or falls back to plum.
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

  const safeBaseRate = BigInt(project.baseRate || 1);
  const raisedMist = project.sold / safeBaseRate;
  const targetMist = project.fundingAllocation / safeBaseRate;

  const pctBp =
    project.fundingAllocation > 0n
      ? Number((project.sold * 10_000n) / project.fundingAllocation)
      : 0;
  const pct = Math.min(100, Math.max(0, pctBp / 100));
  const fillRatio = (pct / 100).toFixed(4);

  const ended = Date.now() > project.endTimeMs;
  const live = project.status === "live" && !ended;
  const tokenSlug = shortTokenSlug(project.tokenType);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col bg-bone border border-ink shadow-offset-sm",
        "transition-all duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
      )}
    >
      {/* ─── Cover panel ─── */}
      <div className="relative aspect-[4/3] overflow-hidden border-b border-ink/15 bg-bone">
        <div aria-hidden className={cn("absolute inset-0", ACCENT_BG_SOFT[a])} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #161310 1px, transparent 1.2px)",
            backgroundSize: "12px 12px",
          }}
        />

        {/* Minted-token treatment: rotating mono seal + ink-bordered disc */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square h-[82%]">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="-50 -50 100 100"
              aria-hidden
            >
              <circle r="39" fill="none" stroke="rgba(22,19,16,0.25)" strokeWidth="0.5" />
              <polygon points="0,-44 1.6,-42 0,-40 -1.6,-42" fill={ACCENT_HEX[a]} />
              <polygon points="0,40 1.6,42 0,44 -1.6,42" fill={ACCENT_HEX[a]} />
            </svg>
            <svg
              className="fp-icon-ring absolute inset-0 h-full w-full"
              viewBox="-50 -50 100 100"
              aria-hidden
            >
              <defs>
                <path
                  id={`seal-${project.id.slice(2, 10)}`}
                  d="M -43 0 a 43 43 0 1 1 86 0 a 43 43 0 1 1 -86 0"
                  fill="none"
                />
              </defs>
              <text
                fill={ACCENT_HEX[a]}
                fontFamily="var(--font-mono), monospace"
                fontSize="4.4"
                letterSpacing="0.32em"
                style={{ textTransform: "uppercase" }}
              >
                <textPath href={`#seal-${project.id.slice(2, 10)}`} startOffset="0">
                  {`· Project · Nº ${String(project.number).padStart(2, "0")} · Pandabox · On-chain · Sui mainnet `.repeat(2)}
                </textPath>
              </text>
            </svg>
            <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[1.5px] border-ink bg-bone">
              {project.iconUrl ? (
                <Image
                  src={project.iconUrl}
                  alt={`${project.name} icon`}
                  fill
                  sizes="(min-width:1024px) 18vw, (min-width:768px) 32vw, 56vw"
                  priority={priority}
                  className="fp-cover-img object-cover"
                  unoptimized
                />
              ) : (
                <IconFallback name={project.name} accent={a} />
              )}
            </div>
          </div>
        </div>

        {/* Rank ribbon — top-left (only when supplied) */}
        {rank != null && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 bg-bone border border-ink px-2 py-1">
            <span
              aria-hidden
              className={cn("block h-1.5 w-1.5 rounded-full", ACCENT_BG_SOLID[a])}
            />
            <MonoLabel className="text-[9px]">
              Nº {String(rank).padStart(2, "0")}
            </MonoLabel>
          </div>
        )}

        {project.verified && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 bg-bone border border-ink px-2 py-1">
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-jade"
            >
              <path d="M2 6.5l3 3 5-6" />
            </svg>
            <MonoLabel className="text-[9px]">Verified</MonoLabel>
          </div>
        )}

        <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-bone/85 backdrop-blur-[2px] border border-ink/40 px-2 py-1">
          <span
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              live ? "bg-jade" : "bg-ink/35",
            )}
            style={
              live
                ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
                : undefined
            }
          />
          <MonoLabel className="text-[9px]">
            {live ? "Live" : project.status === "closed" ? "Closed" : "Idle"}
          </MonoLabel>
        </div>

        {tokenSlug && (
          <span className="absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/55">
            {tokenSlug}
          </span>
        )}

        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-2 right-3 font-display text-[88px] leading-none text-ink/[0.06]"
        >
          {String(project.number).padStart(2, "0")}
        </span>
      </div>

      {/* ─── Body ─── */}
      <Link
        href={`/p/${project.id}`}
        className="flex flex-1 flex-col px-5 pt-5 pb-4 hover:[&_h3]:underline hover:[&_h3]:underline-offset-4"
      >
        <div className="flex items-baseline justify-between">
          <MonoLabel accent={a} className={cn("text-[10px]", ACCENT_TEXT[a])}>
            Project Nº {String(project.number).padStart(2, "0")}
          </MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {relativeAgeLabel(project.createdAtMs)}
          </span>
        </div>

        <h3 className="mt-2 font-display text-2xl leading-tight">
          {project.name || "Unnamed project"}
        </h3>

        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-ink/55">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">by</span>
          <span className="font-mono tabular-nums text-ink/70">
            {shortAddr(project.creator)}
          </span>
        </div>

        {/* Progress meter */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <MonoLabel className="text-[10px]">Raised</MonoLabel>
            <span className="font-mono text-sm tabular-nums text-ink">
              {pct.toFixed(2)}
              <span className="text-ink/45">%</span>
            </span>
          </div>
          <div className="relative mt-2 h-[3px] overflow-hidden bg-ink/10">
            <div
              className={cn(
                "fp-meter-fill absolute inset-y-0 left-0 w-full",
                ACCENT_BG_SOLID[a],
              )}
              style={{ ["--fill" as string]: fillRatio }}
            />
            <div
              className="fp-meter-fill absolute inset-y-0 left-0 w-full opacity-50"
              style={{
                ["--fill" as string]: fillRatio,
                background:
                  "linear-gradient(to right, transparent 88%, rgba(255,255,255,0.55) 100%)",
              }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-ink/55">
            <span>{formatSuiFromMist(raisedMist)} SUI</span>
            <span>
              {formatSuiFromMist(targetMist)} SUI{" "}
              <span className="text-ink/35">target</span>
            </span>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-5 grid grid-cols-3 border-t border-ink/15">
          <StatCell label="Rate" value={`${project.baseRate}/SUI`} />
          <StatCell
            label="Supply"
            value={formatToken(project.fundingAllocation)}
            border
          />
          <StatCell
            label={ended ? "Ended" : "Ends"}
            value={
              <RelativeTime
                value={project.endTimeMs}
                className="text-[12px] text-ink"
              />
            }
            border
          />
        </div>
      </Link>

      <footer className="flex items-center justify-between gap-2 border-t border-ink/15 bg-ink/[0.02] px-5 py-3">
        <Address
          value={project.id}
          head={6}
          tail={4}
          link
          className="text-[11px] text-ink/55"
        />
        <a
          href={explorerUrl("object", project.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 transition-colors hover:text-ink"
        >
          Suiscan
          <svg
            width="9"
            height="9"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8l4-4M5 4h3v3" />
          </svg>
        </a>
      </footer>
    </article>
  );
}

function StatCell({
  label,
  value,
  border = false,
}: {
  label: string;
  value: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={cn("px-3 py-3", border && "border-l border-ink/15")}>
      <MonoLabel className="block text-[9px]">{label}</MonoLabel>
      <div className="mt-1.5 font-mono text-[12px] tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

function IconFallback({ name, accent }: { name: string; accent: Accent }) {
  const initial = (name?.[0] ?? "P").toUpperCase();
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-bone",
        ACCENT_TEXT[accent],
      )}
    >
      <span className="font-display text-6xl leading-none">{initial}</span>
    </div>
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
