"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Hairline } from "@/components/primitives/hairline";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { ProjectAvatar } from "@/components/identity/project-avatar";
import { explorerUrl } from "@/lib/sui";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import { ManageWorkspace } from "./manage-workspace";
import { bustProjectsCache } from "@/lib/server-actions/projects-cache";
import { OwnedCard } from "./owned-card";
import { KpiStrip } from "./kpi-strip";
import {
  FilterBar,
  type FilterKey,
  type SortKey,
} from "./filter-bar";
import {
  getProjectState,
  getStateVisuals,
  getTimeLabel,
} from "./state";
import { formatSui, formatToken, lastSegment, shortMid } from "./format";
import type {
  DashboardOwnedRow,
  DashboardPayload,
  DashboardSupportedRow,
  OnChainProjectJSON,
} from "@/app/api/dashboard/[address]/route";

const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-11 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.75rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink";

/**
 * Dashboard wired to real on-chain reads.
 *
 *   - "Your projects" = ProjectAdminCap<T> objects owned by the connected wallet
 *   - "Projects you support" = ContributionReceipt<T> objects owned by the wallet,
 *     bucketed by project
 *
 * Data is fetched from `/api/dashboard/[address]` which joins
 * `lib/holdings.ts` against `lib/projects.ts` server-side so the client only
 * receives a presentation-ready payload.
 *
 * Layout in v2:
 *   - Header row with eyebrow, title, connected wallet, refresh
 *   - KPI strip (4 cells: Raised, Treasury, Live, Backing)
 *   - Owned section: filter pills + sort, then cards
 *   - Supported section: same card grid, accent-tinted
 *
 * The owned cards are URL-driven into the <ManageWorkspace> overlay via
 * `?manage=<projectId>` — the workspace replaces this whole tree when
 * the param is present.
 */
export function DashboardShell() {
  const account = useCurrentAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const manageId = searchParams.get("manage");

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Local UI state — filter + sort don't belong on the URL; they're
  // ephemeral preferences that don't survive sessions.
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const openManage = (projectId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("manage", projectId);
    router.push(`/dashboard?${params.toString()}`);
  };

  const managedRow =
    manageId && data ? data.owned.find((r) => r.project.id === manageId) : null;

  const onRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await bustProjectsCache();
    } catch (err) {
      console.warn("[dashboard] cache bust failed", err);
    }
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!account) {
      setData(null);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/dashboard/${account.address}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then((r) => r.json() as Promise<DashboardPayload>)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [account, refreshKey]);

  // ── Manage workspace branch ─────────────────────────────────
  if (account && managedRow) {
    return (
      <Container>
        <ManageWorkspace
          projectId={managedRow.project.id}
          capId={managedRow.capId}
          coinType={managedRow.project.tokenType}
        />
      </Container>
    );
  }

  if (!account) {
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-8 text-center shadow-offset-sm">
          <MonoLabel>Connect your wallet</MonoLabel>
          <h1 className="mt-3 font-display text-3xl leading-[1.05]">
            Your activity, on-chain.
          </h1>
          <p className="mt-3 text-sm text-ink/65">
            Connect a Sui wallet to see the projects you've created and the
            ones you've contributed to.
          </p>
          <div className="mt-5 flex justify-center">
            <ConnectWallet />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <AccentRule color="saffron">
            <MonoLabel>
              Dashboard
              <span className="ml-2 text-ink/30">·</span>
              <span className="ml-2 inline-block">
                <Address value={account.address} link />
              </span>
            </MonoLabel>
          </AccentRule>
          <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-4xl">
            Your activity
          </h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label={loading ? "Refreshing dashboard" : "Refresh dashboard"}
          className={cn(
            "group inline-flex h-9 items-center gap-2 self-start border border-ink/25 bg-bone px-3 shadow-offset-sm md:self-auto",
            "font-mono-label text-[10px] text-ink/70",
            "transition-all duration-300 ease-atelier",
            "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:border-ink hover:text-ink hover:shadow-offset",
            "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
            "disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm",
          )}
        >
          <RefreshGlyph spinning={loading} />
          <span>{loading ? "refreshing" : "refresh"}</span>
        </button>
      </header>

      {/* Skeleton spans the whole no-data window via `!data` — not
          `loading` — because there's a render between `account` hydrating
          and the fetch effect firing where `loading` is false but data is
          still null, which would otherwise flash EmptyState. */}
      {/* ── KPI strip — portfolio-level numbers ──────────────── */}
      <KpiStrip
        owned={data?.owned}
        supported={data?.supported}
        loading={!data}
      />

      {/* ── Owned projects ────────────────────────────────────── */}
      <OwnedSection
        rows={data?.owned}
        loading={!data}
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
        onManage={openManage}
      />

      <Hairline />

      {/* ── Supported projects ────────────────────────────────── */}
      <SupportedSection rows={data?.supported} loading={!data} />
    </Container>
  );
}

/* ─────────────────────── Owned section ─────────────────────── */

function OwnedSection({
  rows,
  loading,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onManage,
}: {
  rows: DashboardOwnedRow[] | undefined;
  loading: boolean;
  filter: FilterKey;
  sort: SortKey;
  onFilterChange: (f: FilterKey) => void;
  onSortChange: (s: SortKey) => void;
  onManage: (projectId: string) => void;
}) {
  // Per-state counts feed both the filter pills and the section's
  // empty-state copy. Compute once and pass down.
  const counts = useMemo(() => {
    const base: Record<FilterKey, number> = {
      all: 0,
      live: 0,
      "ending-soon": 0,
      "ended-awaiting": 0,
      closed: 0,
    };
    if (!rows) return base;
    base.all = rows.length;
    for (const r of rows) {
      const s = getProjectState(r.project);
      if (s in base) base[s as keyof typeof base]++;
    }
    return base;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const matched =
      filter === "all"
        ? rows
        : rows.filter((r) => getProjectState(r.project) === filter);
    return [...matched].sort((a, b) => {
      if (sort === "newest") {
        return b.project.createdAtMs - a.project.createdAtMs;
      }
      if (sort === "most-raised") {
        // Use raw `sold` so a 1B-supply project doesn't get pushed by
        // absolute numbers — but absolute is fine here since all our
        // coins are 9-decimal. Compare BigInt directly.
        const aSold = BigInt(a.project.sold);
        const bSold = BigInt(b.project.sold);
        return bSold > aSold ? 1 : bSold < aSold ? -1 : 0;
      }
      // ending-soon: live projects with the closest end-time first;
      // projects with no time cap sink to the bottom; closed sinks last.
      const aEnd = liveEndOrInfinity(a.project);
      const bEnd = liveEndOrInfinity(b.project);
      return aEnd - bEnd;
    });
  }, [rows, filter, sort]);

  return (
    <section className="py-10">
      <div className="mb-5 flex flex-col gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight">
            Your projects
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink/60">
            Projects whose ProjectAdminCap you hold. Click manage to open the
            workspace.
          </p>
        </div>
        {rows && rows.length > 0 && (
          <FilterBar
            filter={filter}
            onFilterChange={onFilterChange}
            counts={counts}
            sort={sort}
            onSortChange={onSortChange}
          />
        )}
      </div>

      {loading ? (
        <Loading />
      ) : rows && rows.length > 0 ? (
        filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((row) => (
              <OwnedCard
                key={row.capId}
                row={row}
                onManage={() => onManage(row.project.id)}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-ink/25 bg-bone/40 p-8 text-center">
            <MonoLabel className="text-[10px]">
              No projects match this filter
            </MonoLabel>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
              Try a different state or clear the filter to see all{" "}
              {rows.length} {rows.length === 1 ? "project" : "projects"}.
            </p>
          </div>
        )
      ) : (
        <EmptyState
          label="No projects yet"
          body="Spin up a token sale in minutes. Pre-deploy your coin, configure the sale terms, and ship in one signature."
          href="/create"
          cta="Launch a project"
        />
      )}
    </section>
  );
}

function liveEndOrInfinity(p: OnChainProjectJSON): number {
  const state = getProjectState(p);
  if (state === "closed") return Number.MAX_SAFE_INTEGER;
  if (p.endTimeMs <= 0) return Number.MAX_SAFE_INTEGER - 1;
  return p.endTimeMs;
}

/* ─────────────────────── Supported section ─────────────────────── */

function SupportedSection({
  rows,
  loading,
}: {
  rows: DashboardSupportedRow[] | undefined;
  loading: boolean;
}) {
  return (
    <section className="py-10">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl leading-tight">
            Projects you back
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink/60">
            Your ContributionReceipts. Claim once the sale finalizes.
          </p>
        </div>
        {typeof rows?.length === "number" && (
          <span className="font-mono tabular-nums text-sm text-ink/45">
            {rows.length.toLocaleString()}
          </span>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : rows && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <SupportedCard key={row.project.id} row={row} />
          ))}
        </div>
      ) : (
        <EmptyState
          label="Not backing anyone yet"
          body="Back a project on Explore — your receipts and claimable share will surface here."
          href="/explore"
          cta="Explore projects"
        />
      )}
    </section>
  );
}

function SupportedCard({ row }: { row: DashboardSupportedRow }) {
  const p = row.project;
  const ticker = lastSegment(p.tokenType).toUpperCase() || "TOK";
  const state = getProjectState(p);
  const visuals = getStateVisuals(state);
  const closed = state === "closed";
  const endedAwaiting = state === "ended-awaiting";

  const action = closed
    ? { label: "Claim tokens", href: `/projects/${p.id}#pay`, accent: "saffron" as const }
    : endedAwaiting
      ? { label: "Finalize sale", href: `/projects/${p.id}#pay`, accent: "saffron" as const }
      : { label: "Open project", href: `/projects/${p.id}`, accent: "bone" as const };

  return (
    <article
      className={cn(
        "relative overflow-hidden border bg-bone shadow-offset-sm transition-all duration-200 ease-atelier",
        "hover:-translate-y-[2px] hover:shadow-offset",
        visuals.borderClass,
      )}
      style={visuals.bgTint ? { background: visuals.bgTint } : undefined}
    >
      <span
        aria-hidden
        className={cn("absolute inset-x-0 top-0 h-[3px]", visuals.accentBar)}
      />

      <header className="flex items-center gap-3 px-5 pb-3 pt-4">
        <ProjectAvatar src={p.iconUrl} name={p.name} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${p.id}`}
            className="block truncate font-display text-lg leading-tight hover:underline hover:underline-offset-4"
          >
            {p.name || "Untitled project"}
          </Link>
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className="font-mono uppercase tracking-[0.14em] text-ink/45">
              {ticker}
            </span>
            <span className="text-ink/20">·</span>
            <a
              href={explorerUrl("object", p.id)}
              target="_blank"
              rel="noreferrer"
              className="font-mono tabular-nums text-ink/55 hover:text-ink"
            >
              {shortMid(p.id)}
            </a>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 border bg-bone px-2 py-[3px]",
            "font-mono text-[9.5px] uppercase tracking-[0.16em]",
            visuals.pillBorderClass,
            visuals.pillTextClass,
          )}
        >
          <span
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              visuals.dotClass,
            )}
          />
          {row.receipts.length} {row.receipts.length === 1 ? "receipt" : "receipts"}
        </span>
      </header>

      {/* Hero metric pair — Contributed + Claimable */}
      <div className="grid grid-cols-2 border-t border-ink/10">
        <HeroCell
          label="Contributed"
          value={`${formatSui(BigInt(row.totalSui))} SUI`}
        />
        <HeroCell
          label={closed ? "Claimable" : "Your share"}
          value={`${formatToken(BigInt(row.totalTokens), PROJECT_COIN_DECIMALS)} ${ticker}`}
          border
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/60">
          {getTimeLabel(p, state)}
        </span>
        <Link
          href={action.href}
          className={cn(
            CTA_BASE,
            "h-10 text-[0.74rem]",
            action.accent === "saffron"
              ? "bg-saffron text-ink"
              : "bg-bone text-ink",
          )}
        >
          {action.label}
          <ArrowDiag size={12} />
        </Link>
      </div>
    </article>
  );
}

function HeroCell({
  label,
  value,
  border = false,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div className={cn("px-5 py-4", border && "border-l border-ink/10")}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1 font-mono tabular-nums text-lg text-ink">
        {value}
      </div>
    </div>
  );
}

/* ─────────────────────── Glyphs ─────────────────────── */

function RefreshGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "shrink-0 transition-transform duration-300",
        spinning && "animate-spin",
      )}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

/* ─────────────────────── Layout helpers ─────────────────────── */

function EmptyState({
  label,
  body,
  href,
  cta,
}: {
  label: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="border border-dashed border-ink/25 bg-bone/40 p-8 text-center">
      <MonoLabel className="text-[10px]">{label}</MonoLabel>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">{body}</p>
      <Link
        href={href}
        className={cn(CTA_BASE, "mt-5 inline-flex bg-saffron text-ink")}
      >
        {cta}
        <ArrowDiag size={12} />
      </Link>
    </div>
  );
}

function Loading() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label="Loading projects"
    >
      <CardSkeleton />
      <CardSkeleton />
      <span className="sr-only">Loading projects…</span>
    </div>
  );
}

/**
 * Skeleton mirroring the new card shape — accent bar, header with avatar
 * + sparkline placeholder, hero metric, meter, footer row.
 */
function CardSkeleton() {
  return (
    <article
      className="relative overflow-hidden animate-pulse border border-ink/15 bg-bone shadow-offset-sm"
      aria-hidden
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-ink/15"
      />
      <header className="flex items-center gap-3 px-5 pb-3 pt-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/5 bg-ink/10" />
          <div className="h-2.5 w-32 bg-ink/10" />
        </div>
        <div className="h-6 w-20 shrink-0 border border-ink/15 bg-ink/[0.04]" />
      </header>
      <div className="border-t border-ink/10 px-5 py-4 space-y-3">
        <div className="h-2.5 w-16 bg-ink/10" />
        <div className="h-7 w-32 bg-ink/10" />
      </div>
      <div className="border-t border-ink/10 px-5 py-3">
        <div className="flex justify-between">
          <div className="h-2.5 w-20 bg-ink/10" />
          <div className="h-2.5 w-24 bg-ink/10" />
        </div>
        <div className="mt-2 h-[3px] bg-ink/10" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-5 py-3">
        <div className="h-2.5 w-32 bg-ink/10" />
        <div className="h-10 w-28 border border-ink/20 bg-ink/[0.04] shadow-offset-sm" />
      </div>
    </article>
  );
}
