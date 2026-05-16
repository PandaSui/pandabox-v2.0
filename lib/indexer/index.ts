import type {
  Category,
  Cycle,
  GlobalStats,
  Holder,
  Payment,
  Project,
  SortKey,
} from "@/types/pandabox";
import { MOCK_NOW, PROJECTS, PROJECT_BY_ID } from "./fixtures";
import {
  generateCycles,
  generateGlobalRecentPayments,
  generateHolders,
  generatePayments,
} from "./generators";

export type { Category, Cycle, GlobalStats, Holder, Payment, Project, SortKey };

export type ListProjectsOpts = {
  sort?: SortKey;
  category?: Category;
  cursor?: string;
  limit?: number;
  query?: string;
};

function sortProjects(items: Project[], sort: SortKey): Project[] {
  const copy = items.slice();
  switch (sort) {
    case "newest":
      copy.sort((a, b) => b.deployedAt - a.deployedAt);
      break;
    case "most-funded":
      copy.sort((a, b) =>
        a.raisedMist === b.raisedMist
          ? 0
          : a.raisedMist > b.raisedMist
            ? -1
            : 1,
      );
      break;
    case "ending-soonest":
      copy.sort((a, b) => a.cycleEnd - b.cycleEnd);
      break;
    case "trending":
    default: {
      // simple heuristic: supporters + raised, weighted by cycle freshness
      const score = (p: Project) => {
        const ageDays = Math.max(1, (MOCK_NOW - p.deployedAt) / 86400000);
        const raisedSui = Number(p.raisedMist / 1_000_000_000n);
        return (raisedSui + p.supporters * 0.6) / Math.sqrt(ageDays);
      };
      copy.sort((a, b) => score(b) - score(a));
      break;
    }
  }
  return copy;
}

export async function listProjects(
  opts: ListProjectsOpts = {},
): Promise<{ items: Project[]; nextCursor?: string }> {
  const { sort = "trending", category, cursor, limit = 12, query } = opts;
  let items = PROJECTS.filter((p) => p.status === "live");
  if (category) items = items.filter((p) => p.category === category);
  if (query) {
    const q = query.trim().toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ticker.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q),
    );
  }
  items = sortProjects(items, sort);

  const start = cursor ? Number(cursor) || 0 : 0;
  const slice = items.slice(start, start + limit);
  const nextCursor =
    start + limit < items.length ? String(start + limit) : undefined;
  return { items: slice, nextCursor };
}

export async function getProject(id: string): Promise<Project | null> {
  return PROJECT_BY_ID.get(id) ?? null;
}

export async function getCycles(projectId: string): Promise<Cycle[]> {
  const p = PROJECT_BY_ID.get(projectId);
  if (!p) return [];
  return generateCycles(p);
}

export async function getActivity(
  projectId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ items: Payment[]; nextCursor?: string }> {
  const p = PROJECT_BY_ID.get(projectId);
  if (!p) return { items: [] };
  const { limit = 25, cursor } = opts;
  const all = generatePayments(p, 120);
  const start = cursor ? Number(cursor) || 0 : 0;
  const slice = all.slice(start, start + limit);
  const nextCursor =
    start + limit < all.length ? String(start + limit) : undefined;
  return { items: slice, nextCursor };
}

export async function getHolders(projectId: string): Promise<Holder[]> {
  const p = PROJECT_BY_ID.get(projectId);
  if (!p) return [];
  return generateHolders(p);
}

export async function getRecentPaymentsGlobal(
  limit = 32,
): Promise<Payment[]> {
  return generateGlobalRecentPayments(
    PROJECTS.filter((p) => p.status === "live"),
    limit,
  );
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const live = PROJECTS.filter((p) => p.status === "live");
  const tvlMist = live.reduce((acc, p) => acc + p.raisedMist, 0n);
  const supporterCount = live.reduce((acc, p) => acc + p.supporters, 0);
  const durations = live.map(
    (p) => (p.cycleEnd - p.cycleStart) / 86400000,
  );
  durations.sort((a, b) => a - b);
  const medianCycleDays =
    durations.length === 0
      ? 0
      : durations[Math.floor(durations.length / 2)];

  return {
    tvlMist,
    projectCount: live.length,
    supporterCount,
    medianCycleDays,
    delta7d: {
      tvlPct: 4.2,
      projectsPct: 1.8,
      supportersPct: 6.4,
    },
  };
}
