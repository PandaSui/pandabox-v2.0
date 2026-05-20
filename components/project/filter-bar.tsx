"use client";

import { useEffect, useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { Diecut } from "@/components/primitives/diecut";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { TreasuryPulse } from "@/components/pulse";
import type { Category, SortKey } from "@/types/pandabox";

export type Filters = {
  category: Category | null;
  sort: SortKey;
  query: string;
};

const CATS: { key: Category | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "art", label: "Art" },
  { key: "infra", label: "Infra" },
  { key: "dao", label: "DAO" },
  { key: "research", label: "Research" },
  { key: "gaming", label: "Gaming" },
  { key: "music", label: "Music" },
  { key: "social", label: "Social" },
  { key: "rwa", label: "RWA" },
  { key: "meme", label: "Meme" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "newest", label: "Newest" },
  { key: "most-funded", label: "Most funded" },
  { key: "ending-soonest", label: "Ending soonest" },
];

export function FilterBar({
  value,
  onChange,
  resultCount,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  resultCount: number;
}) {
  const [localQuery, setLocalQuery] = useState(value.query);

  // Debounce search input.
  useEffect(() => {
    if (localQuery === value.query) return;
    const id = setTimeout(() => onChange({ ...value, query: localQuery }), 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQuery]);

  return (
    <div className="sticky top-0 z-30 border-b border-ink/15 bg-bone/85 backdrop-blur">
      <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATS.map((c) => {
            const active = c.key === value.category;
            return (
              <button
                key={c.label}
                onClick={() => onChange({ ...value, category: c.key })}
                className={cn(
                  "font-mono-label px-2.5 py-1 transition-colors",
                  active ? "text-ink" : "text-ink/55 hover:text-ink",
                )}
                aria-pressed={active}
              >
                {active ? <Marker color="saffron">{c.label}</Marker> : c.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="search"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="search projects"
              aria-label="Search projects"
              className={cn(
                "h-9 w-44 border border-ink/25 bg-transparent px-3",
                "font-mono text-xs placeholder:font-mono-label placeholder:text-ink/35",
                "focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
              )}
            />
          </div>

          <Diecut className="border border-ink/25 bg-transparent">
            <label className="flex items-center gap-2 px-2">
              <MonoLabel className="text-[10px]">Sort</MonoLabel>
              <select
                value={value.sort}
                onChange={(e) =>
                  onChange({ ...value, sort: e.target.value as SortKey })
                }
                className="h-9 cursor-pointer bg-transparent pr-1 font-mono text-xs focus:outline-none"
                aria-label="Sort projects"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </Diecut>

          <div className="hidden xl:block w-[180px]">
            <TreasuryPulse variant="compact" />
          </div>
        </div>
      </div>

      <div className="container flex items-center justify-between pb-2 text-xs">
        <span className="font-mono tabular-nums text-ink/50">
          {resultCount} {resultCount === 1 ? "project" : "projects"}
        </span>
        {(value.category || value.query) && (
          <button
            onClick={() => onChange({ ...value, category: null, query: "" })}
            className="font-mono-label text-ink/60 hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
