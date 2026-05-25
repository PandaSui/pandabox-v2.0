import type { Holder, Payment, Project } from "@/types/pandabox";
import { MOCK_NOW } from "./fixtures";
import { makeSeed, mulberry32, pickAddress, pickTxHash } from "./rng";

const MIST = 1_000_000_000n;

const MEMOS = [
  "",
  "",
  "",
  "good luck",
  "for the print run",
  "season 3",
  "from the indexer team",
  "go gooo",
  "",
  "long live the bamboo",
  "",
  "ship it",
  "",
];

export function generateHolders(p: Project, count = 32): Holder[] {
  const rng = mulberry32(makeSeed(p.id + ":holders"));
  const supply = (p.raisedMist * p.weight) / MIST;
  const weights: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const w = Math.pow(rng(), 2.4);
    weights.push(w);
    total += w;
  }
  const sorted = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
  return sorted.map(({ w }) => {
    const pct = (w / total) * 100;
    const balance = BigInt(Math.round((Number(supply) * pct) / 100));
    return {
      address: pickAddress(rng),
      balanceRaw: balance,
      pctSupply: pct,
    };
  });
}

export function generatePayments(p: Project, count: number): Payment[] {
  const rng = mulberry32(makeSeed(p.id + ":payments"));
  const span = MOCK_NOW - p.deployedAt;
  const out: Payment[] = [];
  for (let i = 0; i < count; i++) {
    const t = MOCK_NOW - Math.floor(rng() * span);
    const sui = 0.5 + Math.pow(rng(), 1.8) * 80;
    const amount = BigInt(Math.round(sui * 1_000_000_000));
    const tokens = (amount * p.weight) / MIST;
    out.push({
      txHash: pickTxHash(rng),
      projectId: p.id,
      projectName: p.name,
      projectAccent: p.accent,
      payer: pickAddress(rng),
      amountMist: amount,
      tokensRaw: tokens,
      memo: MEMOS[Math.floor(rng() * MEMOS.length)],
      tierId: null,
      timestamp: t,
    });
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}

export function generateGlobalRecentPayments(
  projects: Project[],
  count: number,
): Payment[] {
  const rng = mulberry32(makeSeed("global:recent"));
  const span = 6 * 60 * 60 * 1000; // last 6h
  const out: Payment[] = [];
  for (let i = 0; i < count; i++) {
    const p = projects[Math.floor(rng() * projects.length)];
    if (!p) continue;
    const t = MOCK_NOW - Math.floor(rng() * span);
    const sui = 0.3 + Math.pow(rng(), 1.6) * 40;
    const amount = BigInt(Math.round(sui * 1_000_000_000));
    const tokens = (amount * p.weight) / MIST;
    out.push({
      txHash: pickTxHash(rng),
      projectId: p.id,
      projectName: p.name,
      projectAccent: p.accent,
      payer: pickAddress(rng),
      amountMist: amount,
      tokensRaw: tokens,
      memo: MEMOS[Math.floor(rng() * MEMOS.length)],
      tierId: null,
      timestamp: t,
    });
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}
