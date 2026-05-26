import { PACKAGE_ID } from "@/lib/contracts/pandabox";

/**
 * Structural slice of `SuiClient` we actually need. Typed structurally
 * so this helper isn't pinned to a particular SDK entrypoint — callers
 * can pass either `useSuiClient()` (dapp-kit, browser) or a server
 * `SuiJsonRpcClient`.
 */
type EventQueryClient = {
  queryEvents: (input: {
    query: { MoveEventType: string };
    cursor?: { txDigest: string; eventSeq: string } | null;
    limit?: number;
    order?: "ascending" | "descending";
  }) => Promise<{
    data: Array<{
      parsedJson: unknown;
      id: { txDigest: string; eventSeq: string };
    }>;
    nextCursor?: { txDigest: string; eventSeq: string } | null;
    hasNextPage: boolean;
  }>;
  multiGetObjects: (input: {
    ids: string[];
    options?: { showType?: boolean };
  }) => Promise<
    Array<{
      // The real SDK types `type` as `string | null | undefined` — keep
      // the same union here so the structural assignment from a real
      // `SuiClient` satisfies the constraint without a cast.
      data?: {
        objectId?: string | null;
        type?: string | null;
      } | null;
    }>
  >;
};

export type CreatedProject = {
  projectId: string;
  name: string;
  iconUrl: string;
  /** Fully-qualified coin type — e.g. `0xabc::module::TOKEN`. */
  coinType: string;
  createdAtMs: number;
};

/**
 * Find Pandabox projects whose `creator` matches the given address.
 *
 * Walks recent `ProjectCreated` events (in descending order so the most
 * recent launches show up first), filters by `creator`, then hydrates
 * the matching project objects to extract their generic coin type. The
 * event payload itself doesn't include the `T` of `Project<T>` — that's
 * carried by the object's type string — so we need a `multiGetObjects`
 * round-trip on the filtered set.
 *
 * Paginates up to `maxPages × 50` events. With current mainnet volume
 * this returns in one or two pages; swap for an indexer when project
 * counts cross a few hundred.
 *
 * Returns `[]` when:
 *   · The creator is empty or invalid
 *   · No projects exist for this creator within the search window
 *   · `PACKAGE_ID` isn't configured (the Pandabox contract isn't deployed)
 */
export async function findProjectsByCreator(args: {
  client: EventQueryClient;
  creator: string;
  maxPages?: number;
}): Promise<CreatedProject[]> {
  const creator = args.creator.trim();
  if (!creator) return [];
  if (!PACKAGE_ID || PACKAGE_ID === "0x0") return [];

  const pages = args.maxPages ?? 6;
  const matches: Array<{
    projectId: string;
    name: string;
    iconUrl: string;
    createdAtMs: number;
  }> = [];
  let cursor: { txDigest: string; eventSeq: string } | null = null;

  for (let i = 0; i < pages; i++) {
    const res = await args.client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::project::ProjectCreated` },
      cursor,
      limit: 50,
      order: "descending",
    });
    for (const ev of res.data) {
      const parsed = (ev.parsedJson ?? {}) as Record<string, unknown>;
      const eventCreator = String(parsed.creator ?? "");
      if (eventCreator !== creator) continue;
      const projectId = String(parsed.project_id ?? "");
      if (!projectId) continue;
      matches.push({
        projectId,
        name: String(parsed.name ?? ""),
        iconUrl: String(parsed.icon_url ?? ""),
        createdAtMs: Number(parsed.timestamp_ms ?? 0),
      });
    }
    if (!res.hasNextPage) break;
    cursor = res.nextCursor ?? null;
  }

  if (matches.length === 0) return [];

  // Hydrate just the matched projects to pull their generic `T` out of
  // the object's type string. Skip objects that fail to resolve — they
  // were likely closed/wrapped in a way that hides the type, and the
  // caller's UI already gracefully handles missing entries.
  const objects = await args.client.multiGetObjects({
    ids: matches.map((m) => m.projectId),
    options: { showType: true },
  });

  const byId = new Map(
    objects
      .map((o) => o.data)
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => [d.objectId ?? "", d.type ?? ""] as const),
  );

  return matches
    .map((m) => {
      const type = byId.get(m.projectId) ?? "";
      const coinType = extractGenericType(type);
      if (!coinType) return null;
      return { ...m, coinType };
    })
    .filter((p): p is CreatedProject => p !== null);
}

/**
 * "<pkg>::project::Project<T>" → "T". Matches the server-side helper
 * in `lib/projects.ts` so the wizard and the project pages agree on
 * what counts as the coin type for a given `Project<T>` object.
 */
function extractGenericType(typeStr: string): string {
  const lt = typeStr.indexOf("<");
  const gt = typeStr.lastIndexOf(">");
  if (lt === -1 || gt === -1 || gt < lt) return "";
  return typeStr.slice(lt + 1, gt);
}
