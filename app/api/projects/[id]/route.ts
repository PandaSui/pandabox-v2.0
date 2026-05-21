import { NextResponse } from "next/server";
import { getOnchainProject, type HydratedProject } from "@/lib/projects";

/**
 * GET /api/projects/{id} — server-side hydrated project read.
 *
 * Used by the dashboard's manage workspace which needs the full
 * `HydratedProject` (including IPFS-pinned `details`, the `liquidity`
 * sub-object, etc.) but is rendering inside a client component where
 * importing the server-only reader directly isn't an option. The single
 * shared `getOnchainProject` already memoizes via `unstable_cache`, so
 * this endpoint is essentially free on repeat hits during a session.
 *
 * Bigints are serialized to strings — same boundary trick used elsewhere
 * (lib/projects.ts, /api/dashboard) since JSON can't carry them natively.
 */

export const dynamic = "force-dynamic";

type SerializedHydrated = Omit<
  HydratedProject,
  "fundingAllocation" | "sold" | "suiBalance"
> & {
  fundingAllocation: string;
  sold: string;
  suiBalance: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getOnchainProject(id);
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const out: SerializedHydrated = {
    ...project,
    fundingAllocation: project.fundingAllocation.toString(),
    sold: project.sold.toString(),
    suiBalance: project.suiBalance.toString(),
  };

  return NextResponse.json(out, {
    headers: {
      "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
    },
  });
}

export type { SerializedHydrated };
