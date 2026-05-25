import Link from "next/link";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { PoolCard } from "./pool-card";
import type { HydratedPool } from "@/lib/redeem/discovery";

export function PoolGrid({
  pools,
  feeBps,
}: {
  pools: HydratedPool[];
  feeBps: number;
}) {
  if (pools.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {pools.map((p, i) => (
        <PoolCard
          key={p.pool.objectId}
          data={p}
          feeBps={feeBps}
          priority={i === 0}
        />
      ))}
    </div>
  );
}

/**
 * Empty state for the discovery surface. Reads as "no pools yet, you
 * could be the first" rather than "something is broken" — first-mover
 * framing for the crypto-native audience.
 */
function EmptyState() {
  return (
    <div className="relative border border-dashed border-ink/30 bg-bone px-6 py-14 text-center">
      <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center border border-ink/20">
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden
          className="text-ink/55"
        >
          <circle cx="11" cy="11" r="7.5" strokeDasharray="2 3" opacity="0.55" />
          <path d="M5.5 8.5 L9 8.5 L9 5" strokeLinejoin="round" />
          <path d="M16.5 13.5 L13 13.5 L13 17" strokeLinejoin="round" />
          <circle cx="11" cy="11" r="1.8" fill="currentColor" />
        </svg>
      </div>
      <h3 className="font-display text-[1.5rem] leading-tight">
        No redeem pools yet.
      </h3>
      <p className="mx-auto mt-2 max-w-md text-pretty text-[14px] text-ink/65">
        Be the first to deploy one. Pick a rate, fund it from your treasury,
        and the contract takes care of the rest.
      </p>
      <Link
        href="/redeem/create"
        className={cn(
          "group mt-6 inline-flex h-11 items-center justify-center gap-2 border border-ink bg-ink px-5 text-bone",
          "font-sans text-[0.8125rem] font-medium uppercase tracking-[0.12em]",
          "shadow-offset-sm transition-all duration-300 ease-atelier",
          "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
        )}
      >
        <span>Deploy the first pool</span>
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-[2px]">
          <ArrowDiag size={11} />
        </span>
      </Link>
    </div>
  );
}
