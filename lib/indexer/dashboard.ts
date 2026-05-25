import type { Holder, Payment, Project } from "@/types/pandabox";
import { PROJECTS } from "./fixtures";
import { generateHolders, generatePayments } from "./generators";

export type SupportEntry = {
  project: Project;
  balanceRaw: bigint;
  pctSupply: number;
  lastPayment: Payment | null;
};

export type DashboardData = {
  owned: Project[];
  supported: SupportEntry[];
};

/**
 * v1: no on-chain reads. The mock indexer has synthetic creator addresses
 * that won't match a real wallet, so both lists are empty by default.
 * Once the chain is live this gets swapped for `useSuiClientQuery` lookups
 * (owned objects of type AdminCap, owned coins of project Token types).
 */
export async function getDashboard(address: string): Promise<DashboardData> {
  if (!address) return { owned: [], supported: [] };

  const owned = PROJECTS.filter(
    (p) => p.creator.toLowerCase() === address.toLowerCase(),
  );

  const supported: SupportEntry[] = [];
  for (const p of PROJECTS) {
    if (p.status !== "live") continue;
    const holders: Holder[] = generateHolders(p, 32);
    const hit = holders.find(
      (h) => h.address.toLowerCase() === address.toLowerCase(),
    );
    if (!hit) continue;

    const payments = generatePayments(p, 60);
    const last =
      payments.find(
        (pay) => pay.payer.toLowerCase() === address.toLowerCase(),
      ) ?? null;

    supported.push({
      project: p,
      balanceRaw: hit.balanceRaw,
      pctSupply: hit.pctSupply,
      lastPayment: last,
    });
  }

  return { owned, supported };
}
