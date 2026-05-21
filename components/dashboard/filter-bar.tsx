"use client";

import { cn } from "@pandasui/ui/lib";

/**
 * Filter pills + sort dropdown for the owned-projects section. Counts in
 * pill labels are the single source of truth — drops the separate count
 * badge that used to sit in the section header. Sort is a native <select>
 * styled to match the rest of the dashboard (no fancy dropdown library
 * for one widget).
 */

export type FilterKey = "all" | "live" | "ending-soon" | "ended-awaiting" | "closed";

export type SortKey = "newest" | "most-raised" | "ending-soon";

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  "most-raised": "Most raised",
  "ending-soon": "Ending soonest",
};

export function FilterBar({
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
}: {
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}) {
  const pills: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "ending-soon", label: "Ending soon" },
    { key: "ended-awaiting", label: "Needs finalize" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* ── Filter pills — counts embedded in the labels ────────── */}
      <div className="flex flex-wrap items-center gap-1 border border-ink/15 bg-bone p-[3px]">
        {pills.map((p) => {
          const active = p.key === filter;
          const count = counts[p.key];
          // "All" stays clickable even at 0 (it's the reset) — every other
          // pill disables when its bucket is empty so the user can't pick
          // a filter that has nothing to show. Cursor + opacity make the
          // disabled state legible without changing layout.
          const disabled = p.key !== "all" && count === 0;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onFilterChange(p.key)}
              aria-pressed={active}
              disabled={disabled}
              title={disabled ? `No ${p.label.toLowerCase()} projects` : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 px-2.5",
                "font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors",
                active
                  ? "bg-ink text-bone"
                  : "text-ink/55 hover:text-ink",
                disabled && "cursor-not-allowed opacity-40 hover:text-ink/55",
              )}
            >
              {p.label}
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-bone/65" : "text-ink/35",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Sort — native <select> with a thin chevron ──────────── */}
      <label className="relative inline-flex items-center gap-2">
        <span className="font-mono-label text-[10px] text-ink/45">Sort</span>
        <span className="relative inline-flex items-center">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className={cn(
              "h-9 appearance-none border border-ink/20 bg-bone pl-3 pr-8",
              "font-mono text-[11px] uppercase tracking-[0.14em] text-ink",
              "shadow-offset-sm transition-all duration-200 ease-atelier",
              "hover:-translate-y-[1px] hover:border-ink hover:shadow-offset",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
            )}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="pointer-events-none absolute right-2.5 text-ink/45"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </label>
    </div>
  );
}
