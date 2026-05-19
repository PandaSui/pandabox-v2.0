"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Hairline } from "@/components/primitives/hairline";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { explorerUrl } from "@/lib/sui";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
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
 */
export function DashboardShell() {
  const account = useCurrentAccount();
  const [data, setData] = useState<DashboardPayload | null>(null);
  // Start in `loading: true` so the first paint shows the skeleton instead
  // of briefly flashing the empty state while the useEffect spins up the
  // fetch. Reset to `false` in the no-account branch so the connect-wallet
  // card doesn't think it's still hydrating.
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
      <header className="flex flex-col gap-3 border-b border-ink/15 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <AccentRule color="saffron">
            <MonoLabel>Dashboard</MonoLabel>
          </AccentRule>
          <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-4xl">
            Your activity
          </h1>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex items-baseline gap-3 text-xs">
            <MonoLabel className="text-[10px]">connected</MonoLabel>
            <Address value={account.address} link />
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="font-mono-label text-[10px] text-ink/45 transition-colors hover:text-ink disabled:opacity-40"
          >
            {loading ? "refreshing…" : "refresh"}
          </button>
        </div>
      </header>

      <section className="py-10">
        <SectionHeader
          title="Your projects"
          subtitle="Projects whose ProjectAdminCap you hold. Click through to manage."
          count={data?.owned.length}
        />
        {loading && !data ? (
          <Loading />
        ) : data && data.owned.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.owned.map((row) => (
              <OwnedCard key={row.capId} row={row} />
            ))}
          </div>
        ) : (
          <EmptyState
            label="No projects yet"
            body="Spin up a token sale in minutes. Pre-deploy your coin, configure the sale terms, and ship in one signature."
            href="/create"
            cta="Launch a project"
          />
        )}
      </section>

      <Hairline />

      <section className="py-10">
        <SectionHeader
          title="Projects you support"
          subtitle="ContributionReceipts you hold. Claim once the sale finalizes."
          count={data?.supported.length}
        />
        {loading && !data ? (
          <Loading />
        ) : data && data.supported.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.supported.map((row) => (
              <SupportedCard key={row.project.id} row={row} />
            ))}
          </div>
        ) : (
          <EmptyState
            label="Not supporting anyone yet"
            body="Back a project on Explore — your receipts and claimable share will surface here."
            href="/explore"
            cta="Explore projects"
          />
        )}
      </section>
    </Container>
  );
}

/* ─────────────────────── Cards ─────────────────────── */

function OwnedCard({ row }: { row: DashboardOwnedRow }) {
  const p = row.project;
  const ticker = lastSegment(p.tokenType).toUpperCase() || "TOK";
  const pct =
    BigInt(p.fundingAllocation) > 0n
      ? Math.min(
          100,
          Math.max(
            0,
            Number((BigInt(p.sold) * 10_000n) / BigInt(p.fundingAllocation)) /
              100,
          ),
        )
      : 0;
  return (
    <article className="border border-ink/15 bg-bone shadow-offset-sm">
      <CardHeader project={p} accent="sky" badge="admin · you" />
      <div className="space-y-3 px-5 pb-5 pt-3">
        <ProgressMeter pct={pct} />
        <div className="grid grid-cols-3 border-t border-ink/15 pt-3 font-mono text-[11px]">
          <Stat
            label="Treasury"
            value={`${formatSui(BigInt(p.suiBalance))} SUI`}
            mono
          />
          <Stat
            label="Sold"
            value={`${formatToken(BigInt(p.sold), PROJECT_COIN_DECIMALS)} ${ticker}`}
            mono
            border
          />
          <Stat label="Status" value={statusLabel(p)} mono border />
        </div>
        <div className="flex items-center justify-between border-t border-ink/15 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            cap {shortMid(row.capId)}
          </span>
          <Link
            href={`/p/${p.id}`}
            className={cn(CTA_BASE, "bg-saffron text-ink")}
          >
            Manage
            <ArrowDiag size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function SupportedCard({ row }: { row: DashboardSupportedRow }) {
  const p = row.project;
  const ticker = lastSegment(p.tokenType).toUpperCase() || "TOK";
  const now = Date.now();
  const ended = p.endTimeMs > 0 && now > p.endTimeMs;
  const live = p.status === "live" && !ended;
  const closed = p.status === "closed";

  // Build a useful primary CTA per state.
  const action = closed
    ? { label: "Claim tokens", href: `/p/${p.id}#pay`, accent: "saffron" }
    : ended
      ? { label: "Finalize sale", href: `/p/${p.id}#pay`, accent: "saffron" }
      : { label: "Open project", href: `/p/${p.id}`, accent: "bone" };

  return (
    <article className="border border-ink/15 bg-bone shadow-offset-sm">
      <CardHeader
        project={p}
        accent={live ? "jade" : ended || closed ? "poppy" : "plum"}
        badge={`${row.receipts.length} receipt${row.receipts.length === 1 ? "" : "s"}`}
      />
      <div className="space-y-3 px-5 pb-5 pt-3">
        <div className="grid grid-cols-2 gap-3 border-y border-ink/15 py-3 font-mono">
          <Stat
            label="Contributed"
            value={`${formatSui(BigInt(row.totalSui))} SUI`}
            mono
          />
          <Stat
            label={closed ? "Claimable" : "Your share"}
            value={`${formatToken(BigInt(row.totalTokens), PROJECT_COIN_DECIMALS)} ${ticker}`}
            mono
            border
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            {live ? "live" : ended && !closed ? "ended — needs finalize" : "closed"}
          </span>
          <Link
            href={action.href}
            className={cn(
              CTA_BASE,
              action.accent === "saffron"
                ? "bg-saffron text-ink"
                : "bg-bone text-ink",
            )}
          >
            {action.label}
            <ArrowDiag size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function CardHeader({
  project,
  accent,
  badge,
}: {
  project: OnChainProjectJSON;
  accent: "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";
  badge: string;
}) {
  const dot = {
    saffron: "bg-saffron",
    poppy: "bg-poppy",
    jade: "bg-jade",
    sky: "bg-sky",
    sun: "bg-sun",
    plum: "bg-plum",
  }[accent];
  const ticker = lastSegment(project.tokenType).toUpperCase() || "TOK";
  return (
    <header className="flex items-center gap-3 border-b border-ink/15 px-5 py-3">
      {project.iconUrl ? (
        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-ink/40 bg-bone">
          <Image
            src={project.iconUrl}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full border border-ink/40 bg-bone font-display text-lg">
          {(project.name?.[0] ?? "P").toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/p/${project.id}`}
          className="block truncate font-display text-lg leading-tight hover:underline hover:underline-offset-4"
        >
          {project.name || "Untitled project"}
        </Link>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-mono uppercase tracking-[0.14em] text-ink/45">
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
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 border border-ink bg-bone px-2 py-1 font-mono-label text-[10px]">
        <span aria-hidden className={cn("block h-1.5 w-1.5 rounded-full", dot)} />
        {badge}
      </span>
    </header>
  );
}

function ProgressMeter({ pct }: { pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <MonoLabel className="text-[10px]">Raised</MonoLabel>
        <span className="font-mono tabular-nums text-xs">
          {pct.toFixed(2)}
          <span className="text-ink/45">%</span>
        </span>
      </div>
      <div className="relative mt-2 h-[3px] overflow-hidden bg-ink/10">
        <div
          className="absolute inset-y-0 left-0 bg-saffron"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
  border = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  border?: boolean;
}) {
  return (
    <div className={cn("px-3 py-1.5", border && "border-l border-ink/10")}>
      <span className="font-mono-label text-[9px] text-ink/55 block">
        {label}
      </span>
      <div
        className={cn(
          "mt-0.5",
          mono ? "font-mono tabular-nums text-[12.5px] text-ink/85" : "text-sm",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ─────────────────────── Layout helpers ─────────────────────── */

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between">
      <div>
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink/60">{subtitle}</p>
      </div>
      {typeof count === "number" && (
        <span className="font-mono tabular-nums text-sm text-ink/50">
          {count.toLocaleString()}
        </span>
      )}
    </div>
  );
}

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
        className={cn(
          CTA_BASE,
          "mt-5 inline-flex bg-saffron text-ink",
        )}
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
 * Skeleton mirroring the real OwnedCard / SupportedCard so the page
 * doesn't reflow when data lands. `animate-pulse` on the wrapper ties all
 * children to the same opacity cycle, so the whole card breathes together
 * rather than each block flickering on its own beat.
 */
function CardSkeleton() {
  return (
    <article
      className="animate-pulse border border-ink/15 bg-bone shadow-offset-sm"
      aria-hidden
    >
      {/* Header — avatar + title + ticker + status badge */}
      <header className="flex items-center gap-3 border-b border-ink/15 px-5 py-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/5 bg-ink/10" />
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-12 bg-ink/10" />
            <span className="text-ink/15">·</span>
            <div className="h-2.5 w-24 bg-ink/10" />
          </div>
        </div>
        <div className="h-6 w-20 shrink-0 border border-ink/15 bg-ink/[0.04]" />
      </header>

      {/* Body */}
      <div className="space-y-3 px-5 pb-5 pt-3">
        {/* Progress meter */}
        <div>
          <div className="flex items-baseline justify-between">
            <div className="h-2.5 w-14 bg-ink/10" />
            <div className="h-2.5 w-10 bg-ink/10" />
          </div>
          <div className="relative mt-2 h-[3px] overflow-hidden bg-ink/10">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-ink/20" />
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 border-t border-ink/15 pt-3">
          <SkeletonStat />
          <SkeletonStat border />
          <SkeletonStat border />
        </div>

        {/* Footer row — cap / CTA */}
        <div className="flex items-center justify-between border-t border-ink/15 pt-3">
          <div className="h-2.5 w-32 bg-ink/10" />
          <div className="h-11 w-28 border border-ink/20 bg-ink/[0.04] shadow-offset-sm" />
        </div>
      </div>
    </article>
  );
}

function SkeletonStat({ border = false }: { border?: boolean }) {
  return (
    <div className={cn("space-y-1.5 px-3 py-1.5", border && "border-l border-ink/10")}>
      <div className="h-2 w-12 bg-ink/10" />
      <div className="h-3 w-16 bg-ink/10" />
    </div>
  );
}

/* ─────────────────────── helpers ─────────────────────── */

function statusLabel(p: OnChainProjectJSON): string {
  if (p.status === "live") {
    if (p.endTimeMs > 0 && Date.now() > p.endTimeMs) return "ended (finalize)";
    return "live";
  }
  if (p.status === "closed") return "closed";
  return "—";
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
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
