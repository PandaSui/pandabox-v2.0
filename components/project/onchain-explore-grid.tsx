"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { Container } from "@/components/primitives/container";
import { RevealOnView } from "@/components/motion";
import { OnchainProjectCard } from "./onchain-project-card";
import type { OnChainProject } from "@/lib/projects";

type Sort = "trending" | "newest" | "most-funded" | "ending-soonest";
type Status = "all" | "live" | "ended";

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

const PAGE = 12;

const ACCENT_ROTATION = ["saffron", "poppy", "jade", "sky", "sun", "plum"] as const;

export function OnchainExploreGrid({
  projects,
}: {
  projects: OnChainProject[];
}) {
  const [sort, setSort] = useState<Sort>("trending");
  const [status, setStatus] = useState<Status>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = deferredQuery.trim().toLowerCase();
    let list = projects.slice();
    if (status === "live") list = list.filter((p) => p.status === "live" && now < p.endTimeMs);
    else if (status === "ended") list = list.filter((p) => p.status !== "live" || now >= p.endTimeMs);
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
    list.sort((a, b) => {
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
  }, [projects, sort, status, deferredQuery]);

  // Clamp the page window whenever the filtered list shrinks.
  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > shown;
  const rankBy = sort === "most-funded";

  return (
    <>
      {/* Filter band — sticky below the global nav. Search + sort + status. */}
      <div className="sticky top-0 z-30 border-b border-ink/15 bg-bone/85 backdrop-blur">
        <Container className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <MonoLabel className="text-[10px]">Search</MonoLabel>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="name, ticker or id"
                className="h-9 w-56 border border-ink/25 bg-bone px-3 font-mono text-[12px] placeholder:text-ink/30 focus:border-ink focus:outline-none focus:shadow-offset-sm"
              />
            </label>
            <label className="flex items-center gap-2">
              <MonoLabel className="text-[10px]">Sort</MonoLabel>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  setShown(PAGE);
                }}
                className="h-9 border border-ink/25 bg-bone px-2 font-mono-label text-[11px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              {filtered.length}/{projects.length}
            </span>
          </div>
        </Container>
      </div>

      <Container className="py-10">
        {visible.length === 0 ? (
          <EmptyState
            onReset={() => {
              setStatus("all");
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
          <div className="mt-10 flex justify-center">
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
    <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-10 text-center shadow-offset-sm">
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
