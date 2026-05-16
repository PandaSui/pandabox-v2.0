import type {
  Cycle,
  Holder,
  Payment,
  Project,
} from "@/types/pandabox";
import { MOCK_NOW } from "./fixtures";
import { makeSeed, mulberry32, pickAddress, pickTxHash } from "./rng";

const DAY = 86400 * 1000;
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

export function generateCycles(p: Project): Cycle[] {
  const rng = mulberry32(makeSeed(p.id + ":cycles"));
  const out: Cycle[] = [];
  const dur = p.cycleEnd - p.cycleStart;

  for (let n = 1; n < p.cycleNumber; n++) {
    const start = p.cycleStart - (p.cycleNumber - n) * dur;
    const raisedFactor = 0.4 + rng() * 1.2;
    const raised = BigInt(Math.round(Number(p.raisedMist / BigInt(p.cycleNumber)) * raisedFactor));
    const payouts = (raised * BigInt(60 + Math.round(rng() * 20))) / 100n;
    const reserved = (raised * BigInt(p.params.reservedRate)) / 100n;
    out.push({
      projectId: p.id,
      number: n,
      start,
      end: start + dur,
      raisedMist: raised,
      payoutsMist: payouts,
      reservedTokensRaw: reserved,
      status: "past",
      params: p.params,
    });
  }

  out.push({
    projectId: p.id,
    number: p.cycleNumber,
    start: p.cycleStart,
    end: p.cycleEnd,
    raisedMist: p.raisedMist / BigInt(p.cycleNumber || 1),
    payoutsMist: (p.params.payoutLimitMist * 7n) / 10n,
    reservedTokensRaw:
      (p.raisedMist * BigInt(p.params.reservedRate)) / 100n,
    status: "current",
    params: p.params,
  });

  out.push({
    projectId: p.id,
    number: p.cycleNumber + 1,
    start: p.cycleEnd,
    end: p.cycleEnd + dur,
    raisedMist: 0n,
    payoutsMist: 0n,
    reservedTokensRaw: 0n,
    status: "upcoming",
    params: p.params,
  });

  return out;
}

export function generateHolders(p: Project, count = 32): Holder[] {
  const rng = mulberry32(makeSeed(p.id + ":holders"));
  const supply = (p.raisedMist * p.params.weight) / MIST;
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
    const tokens = (amount * p.params.weight) / MIST;
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
    const tokens = (amount * p.params.weight) / MIST;
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
