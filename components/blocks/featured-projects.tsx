import { getOnchainProjects } from "@/lib/projects";
import { FeaturedProjectsView } from "./featured-projects-view";

export async function FeaturedProjects() {
  const all = await getOnchainProjects();
  // Rank by absolute SUI raised (sold / base_rate), then by recency.
  const ranked = [...all].sort((a, b) => {
    const ar = a.baseRate ? Number(a.sold / BigInt(a.baseRate)) : 0;
    const br = b.baseRate ? Number(b.sold / BigInt(b.baseRate)) : 0;
    if (br !== ar) return br - ar;
    return b.createdAtMs - a.createdAtMs;
  });
  const top = ranked.slice(0, 3);

  const totalRaisedMist = top.reduce(
    (acc, p) => acc + (p.baseRate ? p.sold / BigInt(p.baseRate) : 0n),
    0n,
  );
  // The view counts SUI up from zero, so we hand it a plain number (mist → SUI).
  const totalRaisedSui = Number(totalRaisedMist) / 1e9;

  return (
    <FeaturedProjectsView
      projects={top}
      totalProjects={all.length}
      totalRaisedSui={totalRaisedSui}
    />
  );
}
