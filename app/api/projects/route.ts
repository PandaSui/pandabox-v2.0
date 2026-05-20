import { NextResponse } from "next/server";
import { listProjects } from "@/lib/indexer";
import type { Category, SortKey } from "@/types/pandabox";
import { toProjectDTO, type ProjectListDTO } from "@/lib/api/project-dto";

export const dynamic = "force-dynamic";

const SORT_KEYS: ReadonlySet<SortKey> = new Set([
  "trending",
  "newest",
  "most-funded",
  "ending-soonest",
]);

const CATEGORIES: ReadonlySet<Category> = new Set([
  "art",
  "infra",
  "dao",
  "research",
  "gaming",
  "music",
  "social",
  "rwa",
  "meme",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sortRaw = url.searchParams.get("sort") ?? "trending";
  const sort = (SORT_KEYS.has(sortRaw as SortKey)
    ? sortRaw
    : "trending") as SortKey;

  const catRaw = url.searchParams.get("category");
  const category =
    catRaw && CATEGORIES.has(catRaw as Category)
      ? (catRaw as Category)
      : undefined;

  const query = url.searchParams.get("q") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.max(
    1,
    Math.min(48, Number(url.searchParams.get("limit") ?? "12")),
  );

  const result = await listProjects({ sort, category, query, cursor, limit });
  const payload: ProjectListDTO = {
    items: result.items.map(toProjectDTO),
    nextCursor: result.nextCursor,
  };
  return NextResponse.json(payload);
}
