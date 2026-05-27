/**
 * Airdrop Move package wrapper.
 *
 * Deployed mainnet package: `0x081f…b55b`. Module layout:
 *
 *   - `platform` — singleton `AirdropPlatform` shared object holding
 *                  `fee_per_recipient_mist`, `max_recipients`,
 *                  `treasury_address`, `fee_treasury<SUI>`, paused flag, and
 *                  the lifetime `total_airdrops` counter. Admin-gated by
 *                  `AirdropAdminCap`.
 *   - `airdrop`  — the single user-facing module. One generic function:
 *                  `airdrop<T>` that fan-outs a `Coin<T>` across a vector of
 *                  recipients in one signed PTB, charging a per-recipient
 *                  SUI fee.
 *
 * The Move signature (paraphrased):
 *
 *   public fun airdrop<T>(
 *     platform: &mut AirdropPlatform,
 *     coin: Coin<T>,
 *     fee:  Coin<SUI>,
 *     recipients: vector<address>,
 *     amounts:    vector<u64>,
 *     memo: Option<String>,
 *     clock: &Clock,
 *     ctx: &mut TxContext,
 *   ): (Coin<T>, Coin<SUI>)
 *
 * Critical: the function is *not* `entry` and returns the leftover token +
 * leftover SUI as a `(Coin<T>, Coin<SUI>)` tuple. Whatever PTB calls this
 * MUST consume both — typically by `transferObjects(..., sender)` — or the
 * transaction fails to publish.
 *
 * Per-call invariants enforced on-chain:
 *
 *   - `paused == false`
 *   - `recipients.length == amounts.length`
 *   - `recipients.length <= max_recipients`  (live cap, currently 300)
 *   - `coin.value >= sum(amounts)`
 *   - `fee.value  >= recipients.length * fee_per_recipient_mist`
 *
 * Emits `airdrop::Airdropped { airdrop_number, caller, coin_type,
 * recipient_count, total_amount, fee_paid, memo, tx_digest, timestamp_ms }`.
 */

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const AIRDROP_PACKAGE_ID =
  process.env.NEXT_PUBLIC_AIRDROP_PACKAGE_ID?.trim() || ZERO;

export const AIRDROP_PLATFORM_ID =
  process.env.NEXT_PUBLIC_AIRDROP_PLATFORM_ID?.trim() || ZERO;

export const AIRDROP_MODULE = "airdrop";
export const AIRDROP_PLATFORM_MODULE = "platform";

/** The on-chain `0x6::clock::Clock` shared object. */
export const CLOCK_OBJECT_ID = "0x6";

export const AIRDROP_IS_DEPLOYED =
  AIRDROP_PACKAGE_ID !== ZERO && AIRDROP_PLATFORM_ID !== ZERO;

/**
 * Recipient-count ceiling baked into the contract today. The real cap lives
 * on `AirdropPlatform.max_recipients` (an admin can move it via
 * `update_max_recipients`), so any code touching the *current* limit should
 * read the live Platform state via the Phase-1 reader instead of using this
 * constant. The constant is only a sane default for forms that need to render
 * before the on-chain state has finished loading.
 */
export const DEFAULT_MAX_RECIPIENTS = 300;

/**
 * Default per-recipient fee in MIST baked into the contract today
 * (1_000_000 MIST = 0.001 SUI). Same caveat as `DEFAULT_MAX_RECIPIENTS` —
 * always prefer the live Platform value once available.
 */
export const DEFAULT_FEE_PER_RECIPIENT_MIST = 1_000_000n;

/* ─────────────────────────── Move event types ─────────────────────────── */

export const AIRDROP_EVENT_TYPE = {
  Airdropped: `${AIRDROP_PACKAGE_ID}::airdrop::Airdropped`,
  FeeUpdated: `${AIRDROP_PACKAGE_ID}::platform::FeeUpdated`,
  MaxRecipientsUpdated: `${AIRDROP_PACKAGE_ID}::platform::MaxRecipientsUpdated`,
  TreasuryAddressUpdated: `${AIRDROP_PACKAGE_ID}::platform::TreasuryAddressUpdated`,
  FeesWithdrawn: `${AIRDROP_PACKAGE_ID}::platform::FeesWithdrawn`,
  PlatformPaused: `${AIRDROP_PACKAGE_ID}::platform::PlatformPaused`,
  PlatformUnpaused: `${AIRDROP_PACKAGE_ID}::platform::PlatformUnpaused`,
  AdminTransferred: `${AIRDROP_PACKAGE_ID}::platform::AdminTransferred`,
  AdminRenounced: `${AIRDROP_PACKAGE_ID}::platform::AdminRenounced`,
} as const;

/* ─────────────────────────── Move target helpers ─────────────────────────── */

/**
 * Fully-qualified Move target string for the user-facing `airdrop` entry.
 * Centralised here so the PTB builder and any devInspect tooling reference
 * exactly one string.
 */
export const AIRDROP_TARGET = `${AIRDROP_PACKAGE_ID}::${AIRDROP_MODULE}::airdrop` as const;

/* ─────────────────────────── airdrop::airdrop ─────────────────────────── */

import { Transaction } from "@mysten/sui/transactions";

export type BuildAirdropArgs = {
  /** Fully-qualified coin type T, e.g. `0xabc…::mycoin::MYCOIN`. */
  coinType: string;
  /**
   * Owned `Coin<T>` object IDs the caller wants to spend from. Sorted by
   * the caller (typically descending balance) — the builder merges any
   * extras into the first and then splits off the exact amount needed.
   * Must be non-empty.
   */
  coinObjectIds: [string, ...string[]];
  /**
   * Sum of `amounts` in base units — the amount the builder splits off
   * the merged primary coin before handing it to the Move call. Must
   * equal the literal sum of `amounts` (the contract reads `coin.value`
   * directly when distributing, so passing extra burns it as leftover).
   */
  totalAmountRaw: bigint;
  /** Exact SUI fee = `recipients.length * fee_per_recipient_mist`. */
  feeMist: bigint;
  /** Recipient addresses, parallel to `amounts`. Length ≤ max_recipients. */
  recipients: readonly string[];
  /** Base-unit amounts, parallel to `recipients`. */
  amounts: readonly bigint[];
  /** Optional caller memo, recorded on-chain in the `Airdropped` event. */
  memo: string | null;
  /**
   * Initial shared version of the `AirdropPlatform` object, pulled from
   * the Phase-1 reader. Required to build a `sharedObjectRef` with
   * `mutable: true` — the lossy `tx.object()` shorthand can't express
   * the mutability flag the contract needs.
   */
  platformInitialSharedVersion: string;
  /** Wallet that will receive the two returned leftover coins. */
  sender: string;
};

/**
 * Build `airdrop::airdrop<T>` PTB. Shape:
 *
 *   1. Optionally `mergeCoins(primary, …rest)` to consolidate the user's
 *      `Coin<T>` objects into a single value the builder can split from.
 *   2. `splitCoins(primary, [totalAmountRaw])` → `payToken`.
 *   3. `splitCoins(tx.gas, [feeMist])` → `feeCoin`.
 *   4. `moveCall airdrop::airdrop::airdrop<T>` with the shared Platform,
 *      `payToken`, `feeCoin`, the recipients/amounts vectors, the memo
 *      option, and the `0x6` Clock.
 *   5. `transferObjects([leftoverToken, leftoverSui], sender)` — the Move
 *      function returns both as a tuple and the PTB MUST drain them or
 *      the transaction fails to publish.
 *
 * The caller is responsible for invariants the contract enforces:
 *   - `recipients.length === amounts.length`
 *   - `recipients.length <= max_recipients`
 *   - `totalAmountRaw === sum(amounts)`
 *   - `feeMist === recipients.length * fee_per_recipient_mist`
 *   - the owned coins selected actually sum to ≥ `totalAmountRaw`.
 *
 * Use the helpers in `@/lib/airdrop` (`quote`, `selectMinimumCover`,
 * `splitIntoBatches`) to derive these — they're the source of truth.
 */
export function buildAirdropTx(args: BuildAirdropArgs): Transaction {
  if (args.recipients.length !== args.amounts.length) {
    throw new Error(
      `buildAirdropTx: recipients.length (${args.recipients.length}) !== amounts.length (${args.amounts.length})`,
    );
  }
  if (args.coinObjectIds.length < 1) {
    throw new Error("buildAirdropTx: coinObjectIds must contain at least one id");
  }

  const tx = new Transaction();

  // 1. Consolidate the user's Coin<T> objects so we can split a single
  //    exact amount off the merged primary.
  const [primary, ...rest] = args.coinObjectIds;
  const primaryRef = tx.object(primary);
  if (rest.length > 0) {
    tx.mergeCoins(
      primaryRef,
      rest.map((id) => tx.object(id)),
    );
  }

  // 2. Exact-amount Coin<T> for the airdrop.
  const [payToken] = tx.splitCoins(primaryRef, [args.totalAmountRaw]);

  // 3. Exact-amount Coin<SUI> for the platform fee, split from gas.
  const [feeCoin] = tx.splitCoins(tx.gas, [args.feeMist]);

  // 4. Memo encoded as Move `Option<String>`.
  const memoArg =
    args.memo === null || args.memo === undefined
      ? tx.pure.option("string", null)
      : tx.pure.option("string", args.memo);

  // 5. Move call — pass the Platform as a mutable shared ref, the recipient
  //    + amount vectors, the memo option, and the canonical Clock.
  const [leftoverToken, leftoverSui] = tx.moveCall({
    target: AIRDROP_TARGET,
    typeArguments: [args.coinType],
    arguments: [
      tx.sharedObjectRef({
        objectId: AIRDROP_PLATFORM_ID,
        initialSharedVersion: args.platformInitialSharedVersion,
        mutable: true,
      }),
      payToken,
      feeCoin,
      tx.pure.vector("address", args.recipients as string[]),
      tx.pure.vector("u64", args.amounts as bigint[]),
      memoArg,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  // 6. Drain the returned (leftoverToken, leftoverSui) tuple — the Move
  //    function isn't `entry`, so the PTB must consume both returns.
  tx.transferObjects([leftoverToken, leftoverSui], args.sender);

  return tx;
}
