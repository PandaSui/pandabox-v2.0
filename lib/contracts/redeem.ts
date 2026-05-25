import { Transaction } from "@mysten/sui/transactions";

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Redeem Move package address.
 *
 * Deployed mainnet package: `0xfe5d…f4bd`. Module layout:
 *
 *   - `platform` — singleton `RedeemPlatform` shared object holding
 *                  fee_bps, fee_treasury<SUI>, treasury_address, paused
 *                  flag, total_pools counter. Admin-gated by
 *                  `PlatformAdminCap`.
 *   - `pool`     — generic `RedeemPool<T>` shared objects. One per
 *                  (creator, project coin type T). Holds the SUI reserve,
 *                  the fixed exchange rate (`price_mist_per_token`), the
 *                  recipient address (burn or buyback), and running
 *                  accounting counters.
 *
 * Pool mechanics (essential ones for the UI):
 *
 *   1. `pool::create_pool<T>` consumes a `CoinMetadata<T>` reference (just
 *      to pin `coin_decimals` — the metadata stays where it was) and an
 *      initial SUI coin, then shares the new `RedeemPool<T>` object.
 *   2. `pool::deposit_reserve<T>` lets anyone top up the reserve. Typically
 *      the creator, but the contract doesn't restrict it.
 *   3. `pool::redeem<T>` takes the user's `Coin<T>`, routes it to
 *      `pool.recipient` (burn or buyback), takes a platform fee in SUI, and
 *      RETURNS a `Coin<SUI>` to the caller — the PTB transfers it to the
 *      sender in the same transaction.
 *
 * Permanence guarantee: neither `price_mist_per_token` nor `recipient` has
 * a setter on the contract. Once a pool is shared, its terms are locked
 * at the bytecode level. This is the trust property the UI surfaces to
 * holders.
 *
 * Platform-fee invariant: 5% (500 bps) at deploy. Read live from
 * `RedeemPlatform.fee_bps` rather than hardcoding — the platform admin can
 * change it via `platform::update_fee_bps`.
 */
export const REDEEM_PACKAGE_ID =
  process.env.NEXT_PUBLIC_REDEEM_PACKAGE_ID?.trim() || ZERO;

export const REDEEM_PLATFORM_ID =
  process.env.NEXT_PUBLIC_REDEEM_PLATFORM_ID?.trim() || ZERO;

export const REDEEM_POOL_MODULE = "pool";
export const REDEEM_PLATFORM_MODULE = "platform";

/** The on-chain `0x6::clock::Clock` shared object. */
export const CLOCK_OBJECT_ID = "0x6";

export const REDEEM_IS_DEPLOYED =
  REDEEM_PACKAGE_ID !== ZERO && REDEEM_PLATFORM_ID !== ZERO;

/* ─────────────────────────── Move event types ─────────────────────────── */

export const REDEEM_EVENT_TYPE = {
  PoolCreated: `${REDEEM_PACKAGE_ID}::pool::PoolCreated`,
  Redeemed: `${REDEEM_PACKAGE_ID}::pool::Redeemed`,
  ReserveDeposited: `${REDEEM_PACKAGE_ID}::pool::ReserveDeposited`,
  FeeBpsUpdated: `${REDEEM_PACKAGE_ID}::platform::FeeBpsUpdated`,
  FeesWithdrawn: `${REDEEM_PACKAGE_ID}::platform::FeesWithdrawn`,
  TreasuryAddressUpdated: `${REDEEM_PACKAGE_ID}::platform::TreasuryAddressUpdated`,
  PlatformPaused: `${REDEEM_PACKAGE_ID}::platform::PlatformPaused`,
  PlatformUnpaused: `${REDEEM_PACKAGE_ID}::platform::PlatformUnpaused`,
} as const;

/* ─────────────────────────── pool::create_pool ─────────────────────────── */

export type CreatePoolArgs = {
  /** Fully-qualified project coin type, e.g. "0xabc…::mycoin::MYCOIN". */
  coinType: string;
  /**
   * Object ID of the `CoinMetadata<T>` for the same coin. The contract takes
   * it by `&` — it is NOT consumed, so the original owner keeps it.
   */
  coinMetadataId: string;
  /** Initial SUI to seed the reserve, in mist. */
  initialDepositMist: bigint;
  /**
   * Exchange rate: how many mist of SUI one base unit of the project coin
   * redeems for. Fixed forever once the pool is shared.
   *
   * Example: a 9-decimal coin trading at 0.001 SUI per WHOLE coin →
   * 1 mist of SUI per base unit → `priceMistPerToken = 1n`.
   */
  priceMistPerToken: bigint;
  /**
   * Where redeemed project coins are routed. Permanent. Use a known burn
   * address (e.g. `0x0…0`) to destroy them, or a treasury address for a
   * buyback flow.
   */
  recipient: string;
};

/**
 * Build `pool::create_pool<T>` — splits the initial SUI from gas, calls the
 * Move fn, and lets the contract share the new `RedeemPool<T>` object
 * itself (so no `transferObjects` on the return is needed).
 */
export function buildCreatePoolTx(args: CreatePoolArgs): Transaction {
  const tx = new Transaction();
  const [seed] = tx.splitCoins(tx.gas, [args.initialDepositMist]);
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_POOL_MODULE}::create_pool`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(REDEEM_PLATFORM_ID),
      tx.object(args.coinMetadataId),
      seed,
      tx.pure.u64(args.priceMistPerToken),
      tx.pure.address(args.recipient),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/* ─────────────────────────── pool::deposit_reserve ─────────────────────────── */

export type DepositReserveArgs = {
  coinType: string;
  poolId: string;
  /** SUI amount to top up the reserve with, in mist. */
  amountMist: bigint;
};

/**
 * Build `pool::deposit_reserve<T>` — splits SUI from gas and pushes it into
 * the pool's reserve. Anyone can call; typically the creator topping up
 * after early redeems.
 */
export function buildDepositReserveTx(args: DepositReserveArgs): Transaction {
  const tx = new Transaction();
  const [topUp] = tx.splitCoins(tx.gas, [args.amountMist]);
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_POOL_MODULE}::deposit_reserve`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.poolId),
      topUp,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/* ─────────────────────────── pool::redeem ─────────────────────────── */

export type RedeemArgs = {
  coinType: string;
  poolId: string;
  /**
   * Object IDs of the user's `Coin<T>` to spend. If more than one is passed,
   * the builder merges them into the first before splitting off the exact
   * amount to redeem. Pass a single id when you already know which coin
   * holds enough balance.
   */
  coinObjectIds: [string, ...string[]];
  /** Amount of base coin units to redeem (NOT decimal-formatted). */
  coinAmount: bigint;
  /** Wallet that receives the returned `Coin<SUI>`. */
  sender: string;
};

/**
 * Build `pool::redeem<T>` — burn/route the user's project coins, receive
 * SUI minus the platform fee, transfer the SUI to the sender. The PTB:
 *
 *   1. (optional) merges extra coin objects into the first to consolidate
 *      balance.
 *   2. splits exactly `coinAmount` off the (now-merged) coin.
 *   3. calls `pool::redeem<T>` and receives a `Coin<SUI>` back.
 *   4. transfers the SUI coin to `sender`.
 */
export function buildRedeemTx(args: RedeemArgs): Transaction {
  if (args.coinObjectIds.length < 1) {
    throw new Error("buildRedeemTx: coinObjectIds must contain at least one id");
  }
  const tx = new Transaction();
  const [primary, ...rest] = args.coinObjectIds;
  const primaryRef = tx.object(primary);

  if (rest.length > 0) {
    tx.mergeCoins(
      primaryRef,
      rest.map((id) => tx.object(id)),
    );
  }
  const [spendCoin] = tx.splitCoins(primaryRef, [args.coinAmount]);

  const suiOut = tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_POOL_MODULE}::redeem`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.poolId),
      tx.object(REDEEM_PLATFORM_ID),
      spendCoin,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  tx.transferObjects([suiOut], args.sender);
  return tx;
}

/* ─────────────────────────── Platform admin (operator-side) ─────────────────────────── *
 *
 * These require the `PlatformAdminCap`. They live here so the same surface
 * has both the user-facing builders and the operator console builders — same
 * pattern as the pandabox.ts contract wrapper. Operator UI goes on a
 * separate admin route gated by ownership of the cap.
 */

/** `platform::update_fee_bps(&cap, &mut platform, new_bps, &clock, &ctx)` */
export function buildPlatformUpdateFeeBpsTx(args: {
  platformAdminCapId: string;
  newBps: number;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_PLATFORM_MODULE}::update_fee_bps`,
    arguments: [
      tx.object(args.platformAdminCapId),
      tx.object(REDEEM_PLATFORM_ID),
      tx.pure.u64(BigInt(args.newBps)),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** `platform::set_treasury_address(&cap, &mut platform, addr, &clock, &ctx)` */
export function buildPlatformSetTreasuryAddressTx(args: {
  platformAdminCapId: string;
  newAddress: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_PLATFORM_MODULE}::set_treasury_address`,
    arguments: [
      tx.object(args.platformAdminCapId),
      tx.object(REDEEM_PLATFORM_ID),
      tx.pure.address(args.newAddress),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** `platform::pause(&cap, &mut platform, &clock, &ctx)` */
export function buildPlatformPauseTx(args: {
  platformAdminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_PLATFORM_MODULE}::pause`,
    arguments: [
      tx.object(args.platformAdminCapId),
      tx.object(REDEEM_PLATFORM_ID),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** `platform::unpause(&cap, &mut platform, &clock, &ctx)` */
export function buildPlatformUnpauseTx(args: {
  platformAdminCapId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_PLATFORM_MODULE}::unpause`,
    arguments: [
      tx.object(args.platformAdminCapId),
      tx.object(REDEEM_PLATFORM_ID),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * `platform::withdraw_fees(&cap, &mut platform, amount, &clock, &mut ctx)`.
 *
 * Note: the function has no recipient parameter — fees are routed to
 * `platform.treasury_address`. To change destination, first call
 * `set_treasury_address`, then withdraw.
 */
export function buildPlatformWithdrawFeesTx(args: {
  platformAdminCapId: string;
  amountMist: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_PLATFORM_MODULE}::withdraw_fees`,
    arguments: [
      tx.object(args.platformAdminCapId),
      tx.object(REDEEM_PLATFORM_ID),
      tx.pure.u64(args.amountMist),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** `platform::transfer_admin(cap, recipient, &clock, &ctx)` — cap consumed by-value. */
export function buildPlatformTransferAdminTx(args: {
  platformAdminCapId: string;
  recipient: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${REDEEM_PACKAGE_ID}::${REDEEM_PLATFORM_MODULE}::transfer_admin`,
    arguments: [
      tx.object(args.platformAdminCapId),
      tx.pure.address(args.recipient),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}
