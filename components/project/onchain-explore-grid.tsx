"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { Container } from "@/components/primitives/container";
import { RevealOnView } from "@/components/motion";
import { OnchainProjectCard } from "./onchain-project-card";
import type { HydratedProject } from "@/lib/projects";
import type { Category } from "@/types/pandabox";

type Sort = "trending" | "newest" | "most-funded" | "ending-soonest";
type Status = "all" | "live" | "ended";
type CategoryFilter = Category | "all";

const SORTS: { key: Sort; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "newest", label: "Newest" },
  { key: "most-funded", label: "Most funded" },
  { key: "ending-soonest", label: "Ending soonest" },
];

const STATUSES: { key: Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "ended", label: "Ended" },
];

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "meme", label: "Meme" },
  { key: "art", label: "Art" },
  { key: "infra", label: "Infra" },
  { key: "dao", label: "DAO" },
  { key: "gaming", label: "Gaming" },
  { key: "music", label: "Music" },
  { key: "social", label: "Social" },
  { key: "research", label: "Research" },
  { key: "rwa", label: "RWA" },
];

const PAGE = 12;

const ACCENT_ROTATION = ["saffron", "poppy", "jade", "sky", "sun", "plum"] as const;

export function OnchainExploreGrid({
  projects,
}: {
  projects: HydratedProject[];
}) {
  const [sort, setSort] = useState<Sort>("trending");
  const [status, setStatus] = useState<Status>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = deferredQuery.trim().toLowerCase();
    let list = projects.slice();
    if (status === "live") list = list.filter((p) => p.status === "live" && now < p.endTimeMs);
    else if (status === "ended") list = list.filter((p) => p.status !== "live" || now >= p.endTimeMs);
    if (category !== "all") {
      list = list.filter((p) => p.details?.category === category);
    }
    if (q.length > 0) {
      list = list.filter((p) => {
        const slug = lastSegment(p.tokenType).toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          slug.includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      });
    }
    const isLive = (p: HydratedProject) =>
      p.status === "live" && now < p.endTimeMs;
    list.sort((a, b) => {
      // Live always ranks above ended/closed, regardless of the chosen sort —
      // when the status filter is "all" (the default), live work should still
      // surface first.
      const al = isLive(a) ? 0 : 1;
      const bl = isLive(b) ? 0 : 1;
      if (al !== bl) return al - bl;
      if (sort === "newest") return b.createdAtMs - a.createdAtMs;
      if (sort === "ending-soonest") {
        const am = a.endTimeMs > now ? a.endTimeMs - now : Number.MAX_SAFE_INTEGER;
        const bm = b.endTimeMs > now ? b.endTimeMs - now : Number.MAX_SAFE_INTEGER;
        return am - bm;
      }
      if (sort === "most-funded") {
        const ar = a.baseRate ? Number(a.sold / BigInt(a.baseRate)) : 0;
        const br = b.baseRate ? Number(b.sold / BigInt(b.baseRate)) : 0;
        return br - ar;
      }
      // trending: percentage filled, tie-broken by recency
      const ap =
        a.fundingAllocation > 0n
          ? Number((a.sold * 10_000n) / a.fundingAllocation)
          : 0;
      const bp =
        b.fundingAllocation > 0n
          ? Number((b.sold * 10_000n) / b.fundingAllocation)
          : 0;
      if (bp !== ap) return bp - ap;
      return b.createdAtMs - a.createdAtMs;
    });
    return list;
  }, [projects, sort, status, category, deferredQuery]);

  // Clamp the page window whenever the filtered list shrinks.
  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > shown;
  const rankBy = sort === "most-funded";

  // Per-category counts so the chip labels read as "Meme · 4" — independent
  // of the current category filter so the user can see what's available
  // without clearing their selection. Status + search still apply so the
  // counts reflect the rest of the active filters.
  const categoryCounts = useMemo(() => {
    const now = Date.now();
    const q = deferredQuery.trim().toLowerCase();
    let base = projects.slice();
    if (status === "live")
      base = base.filter((p) => p.status === "live" && now < p.endTimeMs);
    else if (status === "ended")
      base = base.filter((p) => p.status !== "live" || now >= p.endTimeMs);
    if (q.length > 0) {
      base = base.filter((p) => {
        const slug = lastSegment(p.tokenType).toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          slug.includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      });
    }
    const counts: Record<string, number> = { all: base.length };
    for (const p of base) {
      const c = p.details?.category;
      if (!c) continue;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [projects, status, deferredQuery]);

  return (
    <>
      {/* Filter band — sticky below the global nav. Status + category + sort.
          Mobile prefers a tighter band: each group goes full-width, the
          category row scrolls horizontally with edge fades, and search +
          sort share a single justified row at the bottom. */}
      <div className="sticky top-0 z-30 border-b border-ink/15 bg-bone/85 backdrop-blur">
        <Container className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between lg:py-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUSES.map((s) => {
                const active = s.key === status;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setStatus(s.key);
                      setShown(PAGE);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "px-3 py-1.5 font-mono-label border transition-all duration-200 ease-atelier",
                      active
                        ? "border-ink bg-ink text-bone shadow-offset-sm"
                        : "border-ink/25 hover:border-ink hover:-translate-y-[1px]",
                    )}
                  >
                    {active ? (
                      <Marker color="saffron">
                        <span>{s.label}</span>
                      </Marker>
                    ) : (
                      s.label
                    )}
                  </button>
                );
              })}
            </div>

            {/* Category row — scrolls horizontally on narrow viewports so the
                full list stays in one band rather than wrapping into three
                rows. Per-category counts on the right of each chip make
                empty buckets visible without clicking through them. Edge
                fades (mask-image) hint at scrollability on mobile. */}
            <div
              className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-0.5 sm:-mx-6 sm:px-6 lg:-mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Filter by category"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
              }}
            >
              {CATEGORIES.map((c) => {
                const active = c.key === category;
                const count = categoryCounts[c.key] ?? 0;
                const disabled = c.key !== "all" && count === 0;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={disabled}
                    onClick={() => {
                      setCategory(c.key);
                      setShown(PAGE);
                    }}
                    className={cn(
                      "shrink-0 inline-flex items-baseline gap-1.5 px-2.5 py-1 font-mono-label text-[10px] border transition-all duration-200 ease-atelier",
                      active
                        ? "border-ink bg-ink text-bone"
                        : disabled
                          ? "border-ink/15 text-ink/30 cursor-not-allowed"
                          : "border-ink/20 text-ink/70 hover:border-ink hover:text-ink hover:-translate-y-[1px]",
                    )}
                  >
                    <span>{c.label}</span>
                    <span
                      className={cn(
                        "font-mono tabular-nums text-[9px]",
                        active
                          ? "text-bone/60"
                          : disabled
                            ? "text-ink/25"
                            : "text-ink/40",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* On mobile: search takes the full row; sort + count share a
              second row, justified between so the count sits flush right.
              On lg+: everything collapses back to a single wrap row. */}
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
            <label className="flex items-center gap-2">
              <MonoLabel className="shrink-0 text-[10px]">Search</MonoLabel>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="name, ticker or id"
                className="h-9 w-full min-w-0 border border-ink/25 bg-bone px-3 font-mono text-[12px] placeholder:text-ink/30 focus:border-ink focus:outline-none focus:shadow-offset-sm lg:w-56"
              />
            </label>
            <div className="flex items-center justify-between gap-3 lg:justify-start">
              <label className="flex min-w-0 items-center gap-2">
                <MonoLabel className="shrink-0 text-[10px]">Sort</MonoLabel>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as Sort);
                    setShown(PAGE);
                  }}
                  className="h-9 min-w-0 border border-ink/25 bg-bone px-2 font-mono-label text-[11px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                {filtered.length}/{projects.length}
              </span>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-6 lg:py-10">
        {visible.length === 0 ? (
          <EmptyState
            onReset={() => {
              setStatus("all");
              setCategory("all");
              setQuery("");
              setSort("trending");
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((p, i) => (
              <RevealOnView key={p.id} delayMs={Math.min(i, 8) * 40}>
                <OnchainProjectCard
                  project={p}
                  rank={rankBy ? i + 1 : undefined}
                  accent={ACCENT_ROTATION[i % ACCENT_ROTATION.length]}
                />
              </RevealOnView>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center lg:mt-10">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className={cn(
                "group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 font-mono-label",
                "border border-ink bg-bone shadow-offset-sm",
                "transition-all duration-300 ease-atelier",
                "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
              )}
            >
              Load more
              <span className="font-mono text-[10px] text-ink/55">
                +{Math.min(PAGE, filtered.length - shown)}
              </span>
            </button>
          </div>
        )}
      </Container>
    </>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-6 text-center shadow-offset-sm md:p-10">
      <MonoLabel className="block">Nothing matches</MonoLabel>
      <p className="mt-2 text-sm text-ink/70">
        No on-chain projects match your filters yet. Try clearing or widening.
      </p>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "mt-5 inline-flex items-center justify-center px-4 py-2 font-mono-label",
          "border border-ink bg-bone shadow-offset-sm",
          "transition-all duration-300 ease-atelier",
          "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
        )}
      >
        Reset filters
      </button>
    </div>
  );
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}
