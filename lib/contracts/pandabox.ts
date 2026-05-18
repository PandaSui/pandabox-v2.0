import { Transaction } from "@mysten/sui/transactions";

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Pandabox Move package address.
 *
 * Deployed mainnet package: `0xdb02…56c8`. Module layout:
 *
 *   - `math`       — pure helpers (calc_fee, calc_tokens_fixed, …).
 *   - `platform`   — singleton state: fee_bps, treasury, paused flag.
 *   - `project`    — sale lifecycle: create_project, contribute, claim,
 *                    try_finalize, withdraw_sui, update_metadata, …
 *   - `receipt`    — `ContributionReceipt<T>` minted by contribute().
 *
 * Pandabox is a **time-bounded fixed-allocation token sale launchpad**, not
 * a Juicebox-style funding-cycle protocol. The on-chain flow:
 *
 *   1. Creator pre-deploys a Coin type T, ending up owning a TreasuryCap<T>
 *      and a CoinMetadata<T> object.
 *   2. Creator calls `project::create_project<T>` with the caps + metadata
 *      strings + sale params. Receives a `ProjectAdminCap<T>` (transferred
 *      to the sender).
 *   3. Supporters call `project::contribute` with SUI. Receive a
 *      `ContributionReceipt<T>` + refund coin for any over-allocation.
 *   4. After end-time / sellout, anyone calls `project::try_finalize` or
 *      `permissionless_finalize` to lock the sale.
 *   5. Supporters call `project::claim` (or `claim_multiple`) to burn their
 *      receipt and receive `Coin<T>`.
 *   6. Admin calls `project::withdraw_sui(amount)` to pull raised SUI
 *      (platform fee skimmed automatically).
 *   7. Admin calls `project::process_unsold` to burn or return unsold supply.
 *
 * Constants verified against mainnet via sui_devInspectTransactionBlock:
 *   - decimals() == 9          (all project coins are 9-decimal)
 *   - unsold_burn == 0
 *   - unsold_transfer_to_creator == 1
 *   - status_active == 0, status_closed == 1, status_compromised == 2
 *   - close_trigger_time == 0, close_trigger_sellout == 1, close_trigger_admin == 2
 */
export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID?.trim() || ZERO;

export const MODULE = "project";
export const PLATFORM_MODULE = "platform";
export const RECEIPT_MODULE = "receipt";

export const IS_DEPLOYED = PACKAGE_ID !== ZERO;

/**
 * Shared `Platform` object — global launchpad state. Address comes from env.
 */
export const PLATFORM_OBJECT_ID =
  process.env.NEXT_PUBLIC_PLATFORM_OBJECT_ID?.trim() || ZERO;

/**
 * The on-chain `0x6::clock::Clock` shared object.
 */
export const CLOCK_OBJECT_ID = "0x6";

/** Project coin decimal count is fixed by the protocol. */
export const PROJECT_COIN_DECIMALS = 9;

/** Mist per 1 SUI. */
export const MIST = 1_000_000_000n;

/* ─────────────────────────── Constants ─────────────────────────── */

export const UnsoldAction = {
  Burn: 0,
  TransferToCreator: 1,
} as const;
export type UnsoldAction = (typeof UnsoldAction)[keyof typeof UnsoldAction];

export const ProjectStatus = {
  Active: 0,
  Closed: 1,
  Compromised: 2,
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const CloseTrigger = {
  Time: 0,
  Sellout: 1,
  Admin: 2,
} as const;
export type CloseTrigger = (typeof CloseTrigger)[keyof typeof CloseTrigger];

/* ─────────────────────────── create_project ─────────────────────────── */

export type CreateProjectArgs = {
  /** Fully-qualified coin type, e.g. "0xabc…::mycoin::MYCOIN". */
  coinType: string;
  /** Object ID of the `TreasuryCap<T>` owned by the sender (consumed). */
  treasuryCapId: string;
  /** Object ID of the `CoinMetadata<T>` for the same coin (consumed). */
  coinMetadataId: string;
  /** Display name shown on the project page. */
  name: string;
  /** IPFS CID of the markdown description blob. */
  descriptionBlobId: string;
  /** Gateway URL for the icon image. */
  iconUrl: string;
  /** IPFS CID for the source-code blob. Use "" if you don't have one yet. */
  sourceCodeBlobId: string;
  /**
   * IPFS CID of a JSON blob with extended off-chain metadata (tagline,
   * socials, category, etc.). Use "" if you don't pin one.
   */
  projectDetailsBlobId: string;
  /**
   * Tokens issued per 1 SUI of contribution, scaled to coin's 9 decimals.
   * Example: 100 tokens-per-SUI → base_rate = 100 × 10^9 = 100_000_000_000n.
   * Caller supplies the already-scaled u64.
   */
  baseRate: bigint;
  /**
   * Total tokens to be sold (in raw coin units, with 9 decimals).
   * Example: 1,000,000 tokens → 1_000_000n × 10^9 = 1_000_000_000_000_000n.
   */
  fundingAllocation: bigint;
  /** Sale end time in ms since epoch. `null` = no time cap. */
  endTimeMs: number | null;
  /** Burn (0) vs return-to-creator (1) for unsold supply. */
  unsoldAction: UnsoldAction;
  /**
   * Address that receives the returned `ProjectAdminCap<T>`. Must be the
   * connected wallet — passed in by the caller because the wrapper has no
   * access to the dapp-kit context.
   */
  sender: string;
};

/**
 * Build `project::create_project<T>` and transfer the returned AdminCap to
 * the caller. Returns a `Transaction` ready for `signAndExecuteTransaction`.
 */
export function buildCreateProjectTx(args: CreateProjectArgs): Transaction {
  const tx = new Transaction();

  const adminCap = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::create_project`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(PLATFORM_OBJECT_ID),
      tx.object(args.treasuryCapId),
      tx.object(args.coinMetadataId),
      tx.pure.string(args.name),
      tx.pure.string(args.descriptionBlobId),
      tx.pure.string(args.iconUrl),
      tx.pure.string(args.sourceCodeBlobId),
      tx.pure.string(args.projectDetailsBlobId),
      tx.pure.u64(args.baseRate),
      tx.pure.u64(args.fundingAllocation),
      args.endTimeMs != null
        ? tx.pure.option("u64", BigInt(args.endTimeMs))
        : tx.pure.option("u64", null),
      tx.pure.u8(args.unsoldAction),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  // create_project is `Public`, not `entry`. The returned ProjectAdminCap<T>
  // must be consumed — we transfer it to the sender so they own it.
  tx.transferObjects([adminCap], args.sender);

  return tx;
}

/* ─────────────────────────── contribute ─────────────────────────── */

export type ContributeArgs = {
  coinType: string;
  projectId: string;
  amountMist: bigint;
  /** Connected wallet — receipt + refund coin are transferred here. */
  sender: string;
};

/**
 * `project::contribute<T>(project, &platform, coin, &clock, &mut ctx)` →
 * `(ContributionReceipt<T>, Coin<SUI> refund)`.
 *
 * Splits SUI from gas, calls contribute, then transfers the receipt + any
 * refund coin to the sender.
 */
export function buildContributeTx(args: ContributeArgs): Transaction {
  const tx = new Transaction();
  const [paymentCoin] = tx.splitCoins(tx.gas, [args.amountMist]);

  const [receipt, refund] = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::contribute`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.projectId),
      tx.object(PLATFORM_OBJECT_ID),
      paymentCoin,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  tx.transferObjects([receipt, refund], args.sender);

  return tx;
}

/* ─────────────────────────── claim ─────────────────────────── */

export type ClaimArgs = {
  coinType: string;
  projectId: string;
  receiptId: string;
  sender: string;
};

/**
 * `project::claim<T>(project, receipt, &clock, &mut ctx) → Coin<T>`.
 * Transfers the minted token coin to the sender.
 */
export function buildClaimTx(args: ClaimArgs): Transaction {
  const tx = new Transaction();
  const tokens = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::claim`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.projectId),
      tx.object(args.receiptId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  tx.transferObjects([tokens], args.sender);
  return tx;
}

export type ClaimMultipleArgs = {
  coinType: string;
  projectId: string;
  receiptIds: string[];
  sender: string;
};

/**
 * `project::claim_multiple<T>(project, vector<receipts>, &clock, &mut ctx)
 *   → Coin<T>`. Burns multiple receipts and returns a single merged coin.
 */
export function buildClaimMultipleTx(args: ClaimMultipleArgs): Transaction {
  const tx = new Transaction();
  const tokens = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::claim_multiple`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.projectId),
      tx.makeMoveVec({
        type: `${PACKAGE_ID}::${RECEIPT_MODULE}::ContributionReceipt<${args.coinType}>`,
        elements: args.receiptIds.map((id) => tx.object(id)),
      }),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  tx.transferObjects([tokens], args.sender);
  return tx;
}

/* ─────────────────────────── finalize ─────────────────────────── */

/**
 * `project::try_finalize<T>(project, &platform, &clock)`.
 * Admin path: locks the sale once end-time or sellout conditions are met.
 */
export function buildTryFinalizeTx(args: {
  coinType: string;
  projectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::try_finalize`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.projectId),
      tx.object(PLATFORM_OBJECT_ID),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * `project::permissionless_finalize<T>(project, &platform, &clock)`.
 * Anyone can call once finalization conditions are met.
 */
export function buildPermissionlessFinalizeTx(args: {
  coinType: string;
  projectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::permissionless_finalize`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.projectId),
      tx.object(PLATFORM_OBJECT_ID),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/* ─────────────────────────── withdraw_sui ─────────────────────────── */

export type WithdrawSuiArgs = {
  coinType: string;
  adminCapId: string;
  projectId: string;
  amountMist: bigint;
  /** Recipient of the withdrawn SUI (typically the admin). */
  recipient: string;
};

/**
 * `project::withdraw_sui<T>(&cap, project, &mut platform, amount, &clock, ctx)
 *   → Coin<SUI>`.
 *
 * Withdraws raised SUI (platform fee skimmed automatically). The returned
 * coin is transferred to `recipient`.
 */
export function buildWithdrawSuiTx(args: WithdrawSuiArgs): Transaction {
  const tx = new Transaction();
  const coin = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::withdraw_sui`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.adminCapId),
      tx.object(args.projectId),
      tx.object(PLATFORM_OBJECT_ID),
      tx.pure.u64(args.amountMist),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  tx.transferObjects([coin], args.recipient);
  return tx;
}

/* ─────────────────────────── process_unsold ─────────────────────────── */

/**
 * `project::process_unsold<T>(&cap, project, &clock, ctx)`. Burns or returns
 * unsold supply per the project's configured `unsold_action`.
 */
export function buildProcessUnsoldTx(args: {
  coinType: string;
  adminCapId: string;
  projectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::process_unsold`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.adminCapId),
      tx.object(args.projectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/* ─────────────────────────── update_metadata ─────────────────────────── */

export type UpdateMetadataArgs = {
  coinType: string;
  adminCapId: string;
  projectId: string;
  /** Pass `undefined` (not null) to leave a field unchanged. */
  name?: string;
  descriptionBlobId?: string;
  iconUrl?: string;
  sourceCodeBlobId?: string;
  projectDetailsBlobId?: string;
};

/**
 * `project::update_metadata<T>(&cap, project, Opt<name>, Opt<desc_blob>,
 *   Opt<icon_url>, Opt<source_blob>, Opt<details_blob>, &clock, &ctx)`.
 */
export function buildUpdateMetadataTx(args: UpdateMetadataArgs): Transaction {
  const tx = new Transaction();
  const opt = (v: string | undefined) =>
    v == null ? tx.pure.option("string", null) : tx.pure.option("string", v);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::update_metadata`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.adminCapId),
      tx.object(args.projectId),
      opt(args.name),
      opt(args.descriptionBlobId),
      opt(args.iconUrl),
      opt(args.sourceCodeBlobId),
      opt(args.projectDetailsBlobId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/* ─────────────────────────── admin cap movement ─────────────────────────── */

/**
 * `project::transfer_project_admin<T>(cap, recipient, &clock, &ctx)`.
 * Emits the `ProjectAdminTransferred` event the indexer relies on — prefer
 * over a bare `tx.transferObjects([cap], recipient)`.
 */
export function buildTransferProjectAdminTx(args: {
  coinType: string;
  adminCapId: string;
  recipient: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::transfer_project_admin`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.adminCapId),
      tx.pure.address(args.recipient),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/**
 * `project::renounce_project_admin<T>(cap, &project, &clock, &ctx)`.
 * Permanently destroys the AdminCap so the project becomes unstoppable.
 */
export function buildRenounceProjectAdminTx(args: {
  coinType: string;
  adminCapId: string;
  projectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::renounce_project_admin`,
    typeArguments: [args.coinType],
    arguments: [
      tx.object(args.adminCapId),
      tx.object(args.projectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}
