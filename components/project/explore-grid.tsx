"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Diecut } from "@/components/primitives/diecut";
import { Frame } from "@/components/primitives/frame";
import { MonoLabel } from "@/components/primitives/mono-label";
import { ProjectCard } from "./project-card";
import { FilterBar, type Filters } from "./filter-bar";
import type { ProjectDTO, ProjectListDTO } from "@/lib/api/project-dto";

type Props = {
  initial: ProjectListDTO;
};

const PAGE_SIZE = 12;

function buildQuery(f: Filters, cursor?: string): string {
  const p = new URLSearchParams();
  p.set("sort", f.sort);
  if (f.category) p.set("category", f.category);
  if (f.query.trim()) p.set("q", f.query.trim());
  if (cursor) p.set("cursor", cursor);
  p.set("limit", String(PAGE_SIZE));
  return p.toString();
}

export function ExploreGrid({ initial }: Props) {
  const [filters, setFilters] = useState<Filters>({
    category: null,
    sort: "trending",
    query: "",
  });
  const [items, setItems] = useState<ProjectDTO[]>(initial.items);
  const [cursor, setCursor] = useState<string | undefined>(initial.nextCursor);
  const [isLoading, startTransition] = useTransition();
  const [isLoadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);
  const firstRun = useRef(true);

  // Refetch when filters change. Skip the first effect run — initial data is server-rendered.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const myId = ++reqId.current;
    const ac = new AbortController();
    startTransition(() => {
      fetch(`/api/projects?${buildQuery(filters)}`, {
        signal: ac.signal,
        cache: "no-store",
      })
        .then((r) => r.json() as Promise<ProjectListDTO>)
        .then((data) => {
          if (myId !== reqId.current) return;
          setItems(data.items);
          setCursor(data.nextCursor);
        })
        .catch(() => {});
    });
    return () => ac.abort();
  }, [filters]);

  const onLoadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/projects?${buildQuery(filters, cursor)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ProjectListDTO;
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const rankBy = filters.sort === "most-funded" ? "rank" : null;

  return (
    <>
      <FilterBar
        value={filters}
        onChange={setFilters}
        resultCount={items.length}
      />

      <section className="container py-10">
        {items.length === 0 ? (
          <EmptyState
            onClear={() =>
              setFilters({ ...filters, category: null, query: "" })
            }
          />
        ) : (
          <div
            className={cn(
              "grid gap-6 transition-opacity",
              isLoading && "opacity-60",
              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {items.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                rank={rankBy ? i + 1 : undefined}
              />
            ))}
          </div>
        )}

        {cursor && items.length > 0 && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className={cn(
                "diecut border border-ink px-6 py-2.5 transition-colors",
                "hover:bg-ink hover:text-bone",
                isLoadingMore && "opacity-60",
              )}
            >
              <span className="font-mono-label">
                {isLoadingMore ? "Loading…" : "Load more"}
              </span>
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <Frame className="mx-auto max-w-xl text-center">
      <svg
        viewBox="0 0 24 24"
        width="36"
        height="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto text-ink/40"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-5-5" />
      </svg>
      <MonoLabel className="mt-3 block">Nothing matches</MonoLabel>
      <p className="mt-2 text-sm text-ink/70">
        No projects fit those filters. Try clearing or widening the search.
      </p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex items-center"
      >
        <Diecut className="border border-ink px-4 py-2 hover:bg-ink hover:text-bone transition-colors">
          <span className="font-mono-label">Clear filters</span>
        </Diecut>
      </button>
    </Frame>
  );
}
