import { Nav } from "@/components/nav";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { ProjectCardSkeletonGrid } from "@/components/project/project-card-skeleton";

/**
 * Streamed fallback for `/explore`. Renders the full page chrome (nav,
 * hero band, sticky filter strip) with skeleton placeholders so the user
 * sees the eventual layout immediately instead of a blank page while
 * `getOnchainProjects()` resolves on the server.
 *
 * Next.js drops this in automatically during navigation to /explore — no
 * wiring needed in `page.tsx`.
 */
export default function ExploreLoading() {
  return (
    <>
      <Nav />
      <main id="main">
        {/* Hero band — keep the static copy so users get instant context. */}
        <section className="border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-3xl">
              <AccentRule color="saffron">
                <MonoLabel>Explore</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-5xl">
                Funded right now.
              </h1>
              <p className="mt-4 max-w-prose text-[15px] text-ink/65">
                Every active token sale on Pandabox, read directly from the
                Sui mainnet package — no indexer in between.
              </p>
            </div>
            <ul
              className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45"
              aria-hidden
            >
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 animate-pulse rounded-full bg-ink/30" />
                <span className="inline-block h-2.5 w-12 animate-pulse bg-ink/10" />
              </li>
              <li className="text-ink/20">·</li>
              <li>
                <span className="inline-block h-2.5 w-14 animate-pulse bg-ink/10" />
              </li>
              <li className="text-ink/20">·</li>
              <li>cached 60s</li>
            </ul>
          </Container>
        </section>

        {/* Sticky filter band — render the chrome but disable interactivity
            so users don't tap dead controls before the page hydrates. */}
        <div
          className="sticky top-0 z-30 border-b border-ink/15 bg-bone/85 backdrop-blur"
          aria-hidden
        >
          <Container className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["All", "Live", "Ended"] as const).map((label, i) => (
                <span
                  key={label}
                  className={
                    i === 0
                      ? "border border-ink bg-ink px-3 py-1.5 font-mono-label text-bone shadow-offset-sm"
                      : "border border-ink/25 px-3 py-1.5 font-mono-label text-ink/55"
                  }
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MonoLabel className="text-[10px]">Search</MonoLabel>
                <div className="h-9 w-56 border border-ink/25 bg-ink/[0.03]" />
              </div>
              <div className="flex items-center gap-2">
                <MonoLabel className="text-[10px]">Sort</MonoLabel>
                <div className="h-9 w-32 border border-ink/25 bg-ink/[0.03]" />
              </div>
              <span className="inline-block h-2.5 w-12 animate-pulse bg-ink/10" />
            </div>
          </Container>
        </div>

        <Container className="py-10">
          <ProjectCardSkeletonGrid count={8} />
        </Container>
      </main>
    </>
  );
}
