import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Container } from "@/components/primitives/container";
import { ExploreGrid } from "@/components/project";
import { listProjects } from "@/lib/indexer";
import { toProjectDTO } from "@/lib/api/project-dto";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover projects raising on Pandabox.",
};

export default async function ExplorePage() {
  const initial = await listProjects({ sort: "trending", limit: 12 });
  const dto = {
    items: initial.items.map(toProjectDTO),
    nextCursor: initial.nextCursor,
  };

  return (
    <>
      <Nav />
      <main id="main">
        <Container className="pb-2 pt-10">
          <h1 className="text-3xl md:text-4xl">Funded right now</h1>
          <p className="mt-2 max-w-prose text-sm text-ink/60">
            Live projects currently raising SUI on Pandabox. Sort, filter,
            search.
          </p>
        </Container>
        <ExploreGrid initial={dto} />
      </main>
    </>
  );
}
