"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { ProjectAvatar } from "@/components/identity/project-avatar";
import { AdminPanel } from "@/components/project/admin-panel";
import { explorerUrl } from "@/lib/sui";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import type { AdminCapHolding } from "@/lib/holdings";
import type { HydratedProject } from "@/lib/projects";

/**
 * Full-screen admin workspace — opens in place of the dashboard's project
 * lists when the user clicks "Manage" on an owned card. URL-driven via
 * `?manage=<projectId>` so browser back works and the view survives a
 * refresh.
 *
 * The workspace fetches the full HydratedProject from /api/projects/[id]
 * (the dashboard payload only carries the on-chain core), then mounts the
 * existing AdminPanel on the right rail. Left rail surfaces spec data —
 * pool, treasury, supply — so the creator doesn't need to bounce to
 * /p/[id] to see the headlines while they're managing.
 *
 * AdminPanel is reused as-is; this file owns layout + chrome only. When
 * an admin action lands a tx, AdminPanel's internal state shows the
 * confirmation; we re-fetch the hydrated project on a soft interval so
 * the workspace stats catch up.
 */
export function ManageWorkspace({
  projectId,
  capId,
  coinType,
}: {
  projectId: string;
  capId: string;
  coinType: string;
}) {
  const router = useRouter();
  const [project, setProject] = useState<HydratedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`upstream ${r.status}`);
        return r.json();
      })
      .then((data: SerializedHydrated) => {
        if (cancelled) return;
        setProject(deserialize(data));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled || ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "fetch failed");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [projectId, refreshKey]);

  const onBack = () => {
    router.push("/dashboard");
  };

  // The cap holding the dashboard handed us is enough for the AdminPanel —
  // it doesn't need to re-derive ownership.
  const cap: AdminCapHolding = { capId, projectId, coinType };

  return (
    <div className="py-8 md:py-10">
      {/* ── Top bar — back + external link ───────────────────────── */}
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex items-center gap-2 font-mono-label text-[10px] text-ink/55 transition-colors hover:text-ink"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="transition-transform group-hover:-translate-x-0.5"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            back to dashboard
          </button>
          <Link
            href={`/p/${projectId}`}
            className="group inline-flex items-center gap-2 font-mono-label text-[10px] text-ink/55 transition-colors hover:text-ink"
          >
            <span>open public page</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            >
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </Link>
        </div>

        {/* ── Loading / error / loaded states ───────────────────── */}
        {loading && <LoadingShell />}

        {!loading && error && (
          <ErrorShell
            message={error}
            onRetry={() => setRefreshKey((k) => k + 1)}
          />
        )}

        {!loading && !error && project && (
          <Loaded project={project} cap={cap} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Loaded view ─────────────────────────── */

function Loaded({
  project,
  cap,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
}) {
  const ticker = resolveTicker(project);
  const now = Date.now();
  const ended = project.endTimeMs > 0 && now > project.endTimeMs;
  const live = project.status === "live" && !ended;

  return (
    <>
      {/* ── Project header strip ───────────────────────────────── */}
      <header className="border border-ink/15 bg-bone shadow-offset-sm">
        <div className="flex flex-wrap items-center gap-4 border-b border-ink/15 px-5 py-4">
          <ProjectAvatar src={project.iconUrl} name={project.name} size={56} />

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl leading-tight">
              {project.name || "Untitled project"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center border border-ink bg-bone px-2 py-0.5 font-mono text-[11px]">
                {ticker}
              </span>
              <span className="text-ink/20">·</span>
              <a
                href={explorerUrl("object", project.id)}
                target="_blank"
                rel="noreferrer"
                className="font-mono tabular-nums text-ink/55 hover:text-ink"
              >
                {shortMid(project.id)}
              </a>
              <span className="text-ink/20">·</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
                  live
                    ? "text-jade"
                    : ended
                      ? "text-poppy"
                      : "text-ink/55",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-1.5 w-1.5 rounded-full",
                    live ? "bg-jade" : ended ? "bg-poppy" : "bg-ink/35",
                  )}
                  style={
                    live
                      ? {
                          animation: "stat-live-dot 1.4s ease-in-out infinite",
                        }
                      : undefined
                  }
                />
                {live ? "live" : ended ? "ended" : "closed"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick-glance stat strip */}
        <dl className="grid grid-cols-2 md:grid-cols-4">
          <Stat label="Treasury" value={`${formatSui(project.suiBalance)} SUI`} />
          <Stat
            label="Sold"
            value={`${formatToken(project.sold, PROJECT_COIN_DECIMALS)} ${ticker}`}
            border
          />
          <Stat label="Creator" value={<Address value={project.creator} link />} border />
          <Stat
            label="Cap"
            value={
              <span className="font-mono tabular-nums">
                {shortMid(cap.capId)}
              </span>
            }
            border
          />
        </dl>
      </header>

      {/* ── Liquidity status strip ─────────────────────────────── */}
      <div
        className={cn(
          "mt-4 border bg-bone px-5 py-3",
          project.liquiditySeeded ? "border-jade/40" : "border-ink/15",
        )}
        style={
          project.liquiditySeeded
            ? { background: "rgba(110,142,93,0.06)" }
            : undefined
        }
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "block h-1.5 w-1.5 rounded-full",
                project.liquiditySeeded ? "bg-jade" : "bg-ink/30",
              )}
              style={
                project.liquiditySeeded
                  ? {
                      animation: "stat-live-dot 1.4s ease-in-out infinite",
                    }
                  : undefined
              }
            />
            <MonoLabel
              className="text-[10px]"
              accent={project.liquiditySeeded ? "jade" : "ink"}
            >
              {project.liquiditySeeded
                ? "Liquidity seeded · chart live"
                : "No pool yet · chart in placeholder"}
            </MonoLabel>
          </div>
          <div className="font-mono text-[11px] tabular-nums text-ink/55">
            {project.liquiditySeeded && project.poolId ? (
              <a
                href={`https://app.cetus.zone/liquidity/deposit?poolAddress=${project.poolId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink"
              >
                pool {shortMid(project.poolId)}
              </a>
            ) : (
              <span>seed via the panel →</span>
            )}
          </div>
        </div>
      </div>

      {/* ── AdminPanel — reused exactly as on the project page ─── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left column — supporting context cards */}
        <div className="space-y-4">
          <SectionCard
            label="What you can do here"
            body="Every admin action — finalize, withdraw, update metadata, seed liquidity, transfer or renounce the cap — runs through the same on-chain entry functions as the project page. The buttons live in the panel on the right; pre-flight checks are surfaced inside each modal."
          />
          <SectionCard
            label="Supply"
            body={
              <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                <Pair k="Allocation" v={`${formatToken(project.fundingAllocation, PROJECT_COIN_DECIMALS)} ${ticker}`} />
                <Pair k="Sold" v={`${formatToken(project.sold, PROJECT_COIN_DECIMALS)} ${ticker}`} />
                <Pair k="Remaining" v={`${formatToken(project.fundingAllocation - project.sold > 0n ? project.fundingAllocation - project.sold : 0n, PROJECT_COIN_DECIMALS)} ${ticker}`} />
                <Pair k="Unsold action" v={project.unsoldAction === 1 ? "→ creator" : "burn"} />
              </div>
            }
          />
        </div>

        {/* Right column — the admin panel itself */}
        <div>
          <AdminPanel project={project} cap={cap} />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function LoadingShell() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse border border-ink/15 bg-bone shadow-offset-sm">
        <div className="flex items-center gap-4 border-b border-ink/15 px-5 py-4">
          <div className="h-14 w-14 rounded-full bg-ink/10" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-2/3 bg-ink/10" />
            <div className="h-3 w-1/3 bg-ink/10" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "px-4 py-3",
                i > 0 && "border-l border-ink/10",
              )}
            >
              <div className="h-2 w-12 bg-ink/10" />
              <div className="mt-2 h-4 w-20 bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="h-60 animate-pulse bg-ink/[0.04]" />
        <div className="h-[480px] animate-pulse bg-ink/[0.04]" />
      </div>
    </div>
  );
}

function ErrorShell({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="border border-poppy/40 bg-poppy/[0.06] px-5 py-4 text-poppy"
    >
      <MonoLabel className="text-[10px]" accent="poppy">
        Couldn&apos;t load project
      </MonoLabel>
      <p className="mt-1 text-[13px] text-ink/75">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex h-9 items-center border border-ink bg-bone px-3 font-mono-label text-[10px] shadow-offset-sm transition-all duration-300 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
      >
        Retry
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  border = false,
}: {
  label: string;
  value: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3", border && "border-l border-ink/10")}>
      <MonoLabel className="text-[10px] block">{label}</MonoLabel>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

function SectionCard({
  label,
  body,
}: {
  label: string;
  body: React.ReactNode;
}) {
  return (
    <div className="border border-ink/15 bg-bone shadow-offset-sm">
      <header className="border-b border-ink/15 px-5 py-3">
        <MonoLabel className="text-[10px]">{label}</MonoLabel>
      </header>
      <div className="px-5 py-4 text-[13.5px] leading-relaxed text-ink/75">
        {body}
      </div>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="border-l border-ink/10 pl-3">
      <span className="font-mono-label text-[10px] text-ink/55 block">{k}</span>
      <span className="font-mono tabular-nums text-ink/85">{v}</span>
    </div>
  );
}

function resolveTicker(p: HydratedProject): string {
  const fromDetails = p.details?.ticker?.trim();
  if (fromDetails) return fromDetails;
  if (!p.tokenType) return "TOK";
  const segments = p.tokenType.split("::");
  return (segments[segments.length - 1] ?? "TOK").toUpperCase();
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
}

function formatSui(mist: bigint): string {
  return formatToken(mist, 9);
}

function formatToken(raw: bigint, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}

/* ─────────────────────────── serialization ─────────────────────────── */

type SerializedHydrated = Omit<
  HydratedProject,
  "fundingAllocation" | "sold" | "suiBalance"
> & {
  fundingAllocation: string;
  sold: string;
  suiBalance: string;
};

function deserialize(s: SerializedHydrated): HydratedProject {
  return {
    ...s,
    fundingAllocation: BigInt(s.fundingAllocation),
    sold: BigInt(s.sold),
    suiBalance: BigInt(s.suiBalance),
  };
}
