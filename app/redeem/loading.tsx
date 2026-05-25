import { Nav } from "@/components/nav";
import { Container } from "@/components/primitives/container";
import { Spinner } from "@/components/primitives/spinner";

/**
 * Discovery skeleton. Mirrors `app/redeem/page.tsx` layout closely so
 * the page doesn't visually jump when data arrives. Spinners sit in
 * focal positions (stat strip + middle of the grid) so the user has a
 * clear "still loading" affordance without losing the spatial preview.
 */
export default function RedeemLoading() {
  return (
    <>
      <Nav />
      <main id="main" aria-busy="true" aria-live="polite">
        {/* Hero */}
        <section className="border-b border-ink/15">
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-12 lg:gap-12 lg:py-20">
            <div className="lg:col-span-7">
              <Sk w="w-32" h="h-3" />
              <Sk w="w-3/4" h="h-12" className="mt-5" />
              <Sk w="w-2/3" h="h-12" className="mt-2" />
              <Sk w="w-full" h="h-3" className="mt-6" />
              <Sk w="w-5/6" h="h-3" className="mt-2" />
              <div className="mt-7 flex gap-3">
                <Sk w="w-40" h="h-12" />
                <Sk w="w-36" h="h-12" />
              </div>
            </div>
            {/* Stat strip — focal spinner sits centered above the cells */}
            <div className="lg:col-span-5">
              <div className="relative border border-ink/15 bg-bone">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <Spinner size={20} className="text-ink/50" label="Loading totals" />
                </div>
                <div className="grid grid-cols-3 divide-x divide-ink/15 opacity-50">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="px-5 py-5">
                      <Sk w="w-16" h="h-2.5" />
                      <Sk w="w-20" h="h-5" className="mt-2.5" />
                    </div>
                  ))}
                </div>
              </div>
              <Sk w="w-1/2" h="h-2.5" className="mt-3" />
            </div>
          </Container>
        </section>

        {/* Permanence band */}
        <section className="border-b border-ink/15 bg-ink/[0.015]">
          <Container className="flex flex-wrap items-center gap-6 py-4 md:py-5">
            {[0, 1, 2, 3].map((i) => (
              <Sk key={i} w="w-32" h="h-3" />
            ))}
          </Container>
        </section>

        {/* Grid */}
        <section>
          <Container className="py-12 md:py-16">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <Sk w="w-24" h="h-3" />
                <Sk w="w-56" h="h-7" className="mt-2" />
              </div>
              <Sk w="w-32" h="h-3" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <PoolCardSkeleton key={i} focal={i === 0} />
              ))}
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}

function Sk({
  w,
  h,
  className,
}: {
  w: string;
  h: string;
  className?: string;
}) {
  return <span className={`block skeleton-block ${w} ${h} ${className ?? ""}`} />;
}

/**
 * Pool card placeholder. The first card in the grid gets the focal
 * spinner — single anchor point so the page reads as "loading" without
 * six spinners all turning out of sync.
 */
function PoolCardSkeleton({ focal }: { focal?: boolean }) {
  return (
    <div className="relative h-[340px] overflow-hidden border border-ink bg-bone shadow-offset-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-sun/60" />

      {focal && (
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <Spinner size={20} className="text-ink/55" label="Loading pools" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/45">
            reading mainnet
          </span>
        </div>
      )}

      <div className={`${focal ? "opacity-40" : ""}`}>
        <div className="flex items-start justify-between gap-3 px-5 pt-6">
          <div className="flex items-center gap-3">
            <Sk w="w-10" h="h-10" />
            <div>
              <Sk w="w-24" h="h-3.5" />
              <Sk w="w-20" h="h-3" className="mt-2" />
            </div>
          </div>
          <Sk w="w-16" h="h-5" />
        </div>
        <div className="mt-5 border-y border-ink/10 bg-ink/[0.015] px-5 py-4">
          <Sk w="w-12" h="h-2.5" />
          <Sk w="w-40" h="h-4" className="mt-2" />
          <Sk w="w-32" h="h-2.5" className="mt-2" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-ink/10 border-b border-ink/10">
          <div className="px-5 py-4">
            <Sk w="w-14" h="h-2.5" />
            <Sk w="w-20" h="h-3.5" className="mt-2" />
          </div>
          <div className="px-5 py-4">
            <Sk w="w-14" h="h-2.5" />
            <Sk w="w-20" h="h-3.5" className="mt-2" />
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3.5">
          <Sk w="w-36" h="h-3" />
          <Sk w="w-3" h="h-3" />
        </div>
      </div>
    </div>
  );
}
