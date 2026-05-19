import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RelativeTime } from "@/components/identity/relative-time";
import type { OnChainProject } from "@/lib/projects";
import { hasValidParams } from "@/lib/project-health";
import { TokenDisc } from "./token-disc";

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

  const validParams = hasValidParams(project);
  const safeBaseRate = BigInt(project.baseRate || 1);
  // Move contract uses `tokens_raw = mist * base_rate`, so inverting is a
  // plain division — no extra MIST_PER_SUI factor.
  const raisedMist = project.sold / safeBaseRate;
  const targetMist = project.fundingAllocation / safeBaseRate;

  const pctBp =
    project.fundingAllocation > 0n
      ? Number((project.sold * 10_000n) / project.fundingAllocation)
      : 0;
  const pct = Math.min(100, Math.max(0, pctBp / 100));

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
      <div className="relative aspect-[16/9] overflow-hidden border-b border-ink/15 bg-bone">
        <div aria-hidden className={cn("absolute inset-0", ACCENT_BG_SOFT[a])} />

        {/* Centered token disc — no seal, no watermark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[78%] aspect-square overflow-hidden rounded-full border-[1.5px] border-ink bg-bone">
            <TokenDisc
              src={project.iconUrl}
              name={project.name}
              accent={a}
              priority={priority}
              sizes="(min-width:1280px) 18vw, (min-width:1024px) 22vw, (min-width:768px) 30vw, 50vw"
            />
          </div>
        </div>

        {/* Top-left: rank if supplied, otherwise blank */}
        {rank != null && (
          <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 border border-ink bg-bone px-1.5 py-0.5">
            <span
              aria-hidden
              className={cn("block h-1 w-1 rounded-full", ACCENT_BG_SOLID[a])}
            />
            <MonoLabel className="text-[9px]">
              Nº {String(rank).padStart(2, "0")}
            </MonoLabel>
          </div>
        )}

        {/* Top-right: status stack — Legacy + Live/Ended + Verified can all coexist */}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
          {!validParams && (
            <span
              className="inline-flex items-center gap-1 border border-poppy/60 bg-poppy/15 px-1.5 py-0.5 backdrop-blur-[2px]"
              title="Deployed before 9-decimal scaling fix — numbers are unreliable."
            >
              <span
                aria-hidden
                className="block h-1 w-1 rounded-full bg-poppy"
              />
              <MonoLabel className="text-[9px] text-poppy">legacy</MonoLabel>
            </span>
          )}

          <span
            className={cn(
              "inline-flex items-center gap-1 border bg-bone/90 px-1.5 py-0.5 backdrop-blur-[2px]",
              live
                ? "border-jade/60"
                : ended
                  ? "border-ink/40"
                  : "border-ink/30",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "block h-1 w-1 rounded-full",
                live ? "bg-jade" : ended ? "bg-ink/40" : "bg-ink/30",
              )}
              style={
                live
                  ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
                  : undefined
              }
            />
            <MonoLabel
              className={cn(
                "text-[9px]",
                live ? "text-jade" : ended ? "text-ink/60" : "text-ink/55",
              )}
            >
              {live ? "live" : ended ? "ended" : "idle"}
            </MonoLabel>
          </span>

          {project.verified && (
            <span className="inline-flex items-center gap-1 border border-ink/30 bg-bone/90 px-1.5 py-0.5 backdrop-blur-[2px]">
              <svg
                width="8"
                height="8"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-jade"
              >
                <path d="M2 6.5l3 3 5-6" />
              </svg>
              <MonoLabel className="text-[9px]">verified</MonoLabel>
            </span>
          )}
        </div>
      </div>

      {/* ─── Body ─── */}
      <Link
        href={`/p/${project.id}`}
        className="flex flex-1 flex-col px-4 pt-3.5 pb-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <MonoLabel
            accent={a}
            className={cn(
              "truncate text-[10px]",
              ACCENT_TEXT[a],
            )}
          >
            {tokenSlug || `Nº ${String(project.number).padStart(2, "0")}`}
          </MonoLabel>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            {relativeAgeLabel(project.createdAtMs)}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-medium leading-tight tracking-tight text-ink group-hover:underline group-hover:underline-offset-4">
            {project.name || "Unnamed project"}
          </h3>
          <ArrowGlyph
            className="shrink-0 text-ink/30 transition-all group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </div>

        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-ink/50">
          by {shortAddr(project.creator)}
        </p>

        {/* Progress meter — the one signal that drives the click */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between font-mono text-[11px] tabular-nums">
            <span className="text-ink/70">
              {formatSuiFromMist(raisedMist)} SUI
              <span className="text-ink/40">
                {" "}/ {formatSuiFromMist(targetMist)}
              </span>
            </span>
            <span className="text-ink">
              {pct.toFixed(pct >= 10 ? 0 : 1)}
              <span className="text-ink/45">%</span>
            </span>
          </div>
          <div className="relative mt-1.5 h-[2px] overflow-hidden bg-ink/10">
            <div
              className={cn(
                "absolute inset-y-0 left-0",
                ACCENT_BG_SOLID[a],
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Time-pressure cue — status badge lives on the cover now */}
        <div className="mt-2.5 font-mono text-[11px] lowercase text-ink/55">
          {ended ? "ended " : "ends "}
          <RelativeTime
            value={project.endTimeMs}
            className="text-[11px] text-ink/70"
          />
        </div>
      </Link>
    </article>
  );
}

function ArrowGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
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
