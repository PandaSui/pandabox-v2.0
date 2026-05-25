import { Nav } from "@/components/nav";
import { Container } from "@/components/primitives/container";
import { Spinner } from "@/components/primitives/spinner";

/**
 * Detail-page skeleton. Mirrors the eventual 3-column layout, with a
 * focal spinner inside the right-rail panel where the user is most
 * likely to be staring while data fetches.
 */
export default function PoolDetailLoading() {
  return (
    <>
      <Nav />
      <main id="main" aria-busy="true" aria-live="polite">
        {/* Hero */}
        <section className="border-b border-ink/15">
          <Container className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-12 lg:gap-10 lg:py-14">
            <div className="lg:col-span-7">
              <Sk w="w-28" h="h-3" />
              <div className="mt-4 flex items-start gap-5">
                <Sk w="w-16" h="h-16" />
                <div className="flex-1">
                  <Sk w="w-2/3" h="h-9" />
                  <Sk w="w-3/4" h="h-3" className="mt-3" />
                  <div className="mt-4 flex gap-2.5">
                    <Sk w="w-20" h="h-6" />
                    <Sk w="w-24" h="h-6" />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 divide-x divide-y divide-ink/15 border border-ink/15 bg-bone sm:grid-cols-4 sm:divide-y-0">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="px-4 py-3.5">
                    <Sk w="w-14" h="h-2.5" />
                    <Sk w="w-16" h="h-4" className="mt-2" />
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* Body */}
        <section>
          <Container className="py-10 lg:py-14">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              {/* Left rail */}
              <div className="lg:col-span-3 space-y-6">
                <SkPanel rows={5} />
                <SkPanel rows={3} />
              </div>
              {/* Center */}
              <div className="lg:col-span-5 space-y-6">
                <SkPanel rows={4} taller />
                <SkPanel rows={3} taller />
              </div>
              {/* Right rail — the focal panel where the spinner lives */}
              <div className="lg:col-span-4">
                <SkRedeemPanel />
              </div>
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

function SkPanel({ rows, taller }: { rows: number; taller?: boolean }) {
  return (
    <div className="border border-ink/15 bg-bone">
      <div className="border-b border-ink/15 px-5 py-3.5">
        <Sk w="w-24" h="h-3" />
      </div>
      <div className={`space-y-3 px-5 ${taller ? "py-5" : "py-3"}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <Sk
            key={i}
            w={i % 2 === 0 ? "w-full" : "w-3/4"}
            h={taller ? "h-3.5" : "h-3"}
          />
        ))}
      </div>
    </div>
  );
}

function SkRedeemPanel() {
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        <span aria-hidden className="block h-[2px] bg-sun" />
        <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3">
          <Sk w="w-28" h="h-3" />
          <Sk w="w-12" h="h-3" />
        </div>

        {/* Focal spinner — the user's "loading" eye magnet sits inside the
            panel they're about to interact with. Hairline ring, no
            background, no shadow — just the affordance. */}
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-12">
          <Spinner size={22} className="text-ink/55" label="Loading pool" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            Loading pool state
          </span>
        </div>

        <div className="space-y-3 border-t border-ink/15 px-5 py-5">
          <Sk w="w-1/3" h="h-2.5" />
          <Sk w="w-full" h="h-12" />
          <Sk w="w-2/3" h="h-3" />
          <Sk w="w-full" h="h-11" className="mt-3" />
        </div>
      </div>
    </aside>
  );
}
