import { cn } from "@pandasui/ui/lib";

/**
 * Skeleton that mirrors `<OnchainProjectCard>` — same cover panel,
 * eyebrow/title/byline rows, progress meter, and time-pressure cue. A
 * single `animate-pulse` on the wrapper ties every block to one opacity
 * cycle so the card "breathes" as one shape instead of flickering parts.
 *
 * Used by `/explore`'s `loading.tsx` so the page streams a skeleton grid
 * while `getOnchainProjects()` resolves on the server.
 */
export function ProjectCardSkeleton() {
  return (
    <article
      className="group relative flex h-full animate-pulse flex-col border border-ink bg-bone shadow-offset-sm"
      aria-hidden
    >
      {/* Cover panel — soft tint + centered circular disc */}
      <div className="relative aspect-[16/9] overflow-hidden border-b border-ink/15 bg-ink/[0.04]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[78%] aspect-square rounded-full border-[1.5px] border-ink/30 bg-ink/10" />
        </div>
        {/* Status pill placeholder (top right) */}
        <div className="absolute right-2.5 top-2.5 h-5 w-14 border border-ink/20 bg-ink/[0.06]" />
        {/* Rank pill placeholder (top left) */}
        <div className="absolute left-2.5 top-2.5 h-5 w-12 border border-ink/20 bg-ink/[0.06]" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        {/* Eyebrow + time */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="h-2.5 w-20 bg-ink/10" />
          <div className="h-2.5 w-14 bg-ink/10" />
        </div>

        {/* Title */}
        <div className="mt-2 h-4 w-3/5 bg-ink/15" />

        {/* Byline */}
        <div className="mt-1.5 h-2.5 w-32 bg-ink/10" />

        {/* Progress row */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <div className="h-2.5 w-28 bg-ink/10" />
            <div className="h-2.5 w-10 bg-ink/10" />
          </div>
          <div className="relative mt-1.5 h-[3px] overflow-hidden bg-ink/10">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-ink/25" />
          </div>
        </div>

        {/* Time-pressure cue */}
        <div className="mt-2.5 h-2.5 w-24 bg-ink/10" />
      </div>
    </article>
  );
}

/**
 * Grid of N skeleton cards using the same breakpoints as the live
 * explore grid, so the page doesn't reflow once data lands.
 */
export function ProjectCardSkeletonGrid({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading projects"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading projects…</span>
    </div>
  );
}
