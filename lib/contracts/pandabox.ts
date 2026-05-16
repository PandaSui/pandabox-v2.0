import { Transaction } from "@mysten/sui/transactions";

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Pandabox Move package address. Configure via env when the package is
 * deployed; until then the placeholder lets every builder compile, but
 * `IS_DEPLOYED` gates real submission so the wallet never signs against
 * a non-existent module.
 */
export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID?.trim() || ZERO;

export const MODULE = "pandabox";

export const IS_DEPLOYED = PACKAGE_ID !== ZERO;

const MIST = 1_000_000_000n;
const HOUR_MS = 3_600_000n;
const DAY_MS = 86_400_000n;

/** Move sig: pandabox::pay<Project, Token>(project, coin<SUI>, memo, option<id>) */
export function buildPayTx(args: {
  projectId: string;
  amountMist: bigint;
  memo: string;
  tierId?: string | null;
}): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [args.amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::pay`,
    arguments: [
      tx.object(args.projectId),
      coin,
      tx.pure.string(args.memo),
      args.tierId
        ? tx.pure.option("id", args.tierId)
        : tx.pure.option("id", null),
    ],
  });
  return tx;
}

/** Move sig: pandabox::cash_out(project, balance<Token>) */
export function buildCashOutTx(args: {
  projectId: string;
  tokenCoinId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::cash_out`,
    arguments: [tx.object(args.projectId), tx.object(args.tokenCoinId)],
  });
  return tx;
}

/** Move sig: pandabox::distribute_payouts(project, &AdminCap) */
export function buildDistributePayoutsTx(args: {
  projectId: string;
  adminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::distribute_payouts`,
    arguments: [tx.object(args.projectId), tx.object(args.adminCapId)],
  });
  return tx;
}

/** Move sig: pandabox::queue_reconfiguration(project, &AdminCap, params...) */
export function buildQueueReconfigurationTx(args: {
  projectId: string;
  adminCapId: string;
  weight?: bigint;
  reservedRate?: number;
  cashOutTax?: number;
  issuanceReduction?: number;
  payoutLimitMist?: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::queue_reconfiguration`,
    arguments: [
      tx.object(args.projectId),
      tx.object(args.adminCapId),
      args.weight != null
        ? tx.pure.option("u64", args.weight)
        : tx.pure.option("u64", null),
      args.reservedRate != null
        ? tx.pure.option("u8", args.reservedRate)
        : tx.pure.option("u8", null),
      args.cashOutTax != null
        ? tx.pure.option("u8", args.cashOutTax)
        : tx.pure.option("u8", null),
      args.issuanceReduction != null
        ? tx.pure.option("u8", args.issuanceReduction)
        : tx.pure.option("u8", null),
      args.payoutLimitMist != null
        ? tx.pure.option("u64", args.payoutLimitMist)
        : tx.pure.option("u64", null),
    ],
  });
  return tx;
}

/** Move sig: pandabox::claim_reserved_tokens(project, &AdminCap) */
export function buildClaimReservedTokensTx(args: {
  projectId: string;
  adminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::claim_reserved_tokens`,
    arguments: [tx.object(args.projectId), tx.object(args.adminCapId)],
  });
  return tx;
}

/** Move sig: pandabox::transfer_admin_cap(cap, recipient) */
export function buildTransferAdminCapTx(args: {
  adminCapId: string;
  recipient: string;
}): Transaction {
  const tx = new Transaction();
  tx.transferObjects([tx.object(args.adminCapId)], args.recipient);
  return tx;
}

/**
 * Move sig:
 *   pandabox::create_project(
 *     name, ticker, tagline, description, category,
 *     duration_ms, ballot_delay_ms, first_cycle_start,
 *     weight, reserved_rate, cash_out_tax, issuance_reduction,
 *     reserved_splits: vector<(address, u8)>,
 *     payout_limit_mist, payout_splits: vector<(address, u8)>,
 *     send_surplus_to_owner,
 *     tiers: vector<(name, price_mist, max_supply, perks)>,
 *   ): (Project, AdminCap)
 *
 * Returns a Transaction. Caller passes to dapp-kit's signAndExecuteTransaction.
 */
export type CreateProjectArgs = {
  identity: {
    name: string;
    ticker: string;
    tagline: string;
    description: string;
    category: string;
  };
  cycles: {
    durationDays: number;
    ballotDelayHours: number;
    firstCycleStart: number;
  };
  economics: {
    weight: string;
    reservedRate: number;
    cashOutTax: number;
    issuanceReduction: number;
    reservedSplits: { address: string; share: number }[];
  };
  payouts: {
    payoutLimitMist: string;
    splits: { address: string; share: number }[];
    sendSurplusToOwner: boolean;
  };
  tiers: {
    enabled: boolean;
    list: {
      name: string;
      priceMist: string;
      maxSupply: number;
      perks: string;
    }[];
  };
};

export function buildCreateProjectTx(args: CreateProjectArgs): Transaction {
  const tx = new Transaction();
  const i = args.identity;
  const c = args.cycles;
  const e = args.economics;
  const p = args.payouts;
  const t = args.tiers;

  // Flatten splits to parallel vectors (addresses, shares) for Move's vector<T> simplicity.
  const flattenSplits = (
    list: { address: string; share: number }[],
  ): { addrs: string[]; shares: number[] } => ({
    addrs: list.map((s) => s.address),
    shares: list.map((s) => Math.round(s.share)),
  });
  const reserved = flattenSplits(e.reservedSplits);
  const payouts = flattenSplits(p.splits);

  const tiers = t.enabled ? t.list : [];

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::create_project`,
    arguments: [
      tx.pure.string(i.name),
      tx.pure.string(i.ticker),
      tx.pure.string(i.tagline),
      tx.pure.string(i.description),
      tx.pure.string(i.category),
      tx.pure.u64(BigInt(c.durationDays) * DAY_MS),
      tx.pure.u64(BigInt(c.ballotDelayHours) * HOUR_MS),
      tx.pure.u64(BigInt(c.firstCycleStart)),
      tx.pure.u64(BigInt(e.weight || "0")),
      tx.pure.u8(Math.round(e.reservedRate)),
      tx.pure.u8(Math.round(e.cashOutTax)),
      tx.pure.u8(Math.round(e.issuanceReduction)),
      tx.pure.vector("address", reserved.addrs),
      tx.pure.vector("u8", reserved.shares),
      tx.pure.u64(BigInt(p.payoutLimitMist || "0")),
      tx.pure.vector("address", payouts.addrs),
      tx.pure.vector("u8", payouts.shares),
      tx.pure.bool(p.sendSurplusToOwner),
      tx.pure.vector("string", tiers.map((tr) => tr.name)),
      tx.pure.vector("u64", tiers.map((tr) => BigInt(tr.priceMist || "0"))),
      tx.pure.vector("u64", tiers.map((tr) => BigInt(tr.maxSupply))),
      tx.pure.vector("string", tiers.map((tr) => tr.perks)),
    ],
  });

  return tx;
}

// Re-exports for ergonomics.
export { MIST };
