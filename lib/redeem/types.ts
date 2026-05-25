/**
 * TypeScript shape of the Redeem contract's on-chain objects and events.
 *
 * Numbers that come off the chain as `u64` are kept as `bigint` once parsed
 * (Move u64s overflow JS `number` at 2^53-1 and we'd rather not silently
 * lose precision on a token balance). Event-side and object-side amounts
 * arrive as decimal strings from JSON-RPC; the reader converts.
 */

/** Recipient-mode heuristic for UI presentation only — pure derived state. */
export type PoolRecipientMode = "burn" | "buyback" | "unknown";

/** Set of addresses we treat as "burn" for the purposes of UI labelling. */
export const KNOWN_BURN_ADDRESSES = new Set<string>([
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000000000000000000000000000dead",
]);

export function classifyRecipient(
  recipient: string,
  platformTreasury?: string,
): PoolRecipientMode {
  const r = recipient.toLowerCase();
  if (KNOWN_BURN_ADDRESSES.has(r)) return "burn";
  if (platformTreasury && r === platformTreasury.toLowerCase()) {
    // The platform treasury is the dev's buyback destination by default on
    // the example pool we've seen — treat that as buyback rather than burn.
    return "buyback";
  }
  // Anything else: most likely a project treasury / multisig — buyback.
  // The UI surfaces the raw address either way, so this is just the label.
  return "buyback";
}

/* ─────────────────────────── Platform ─────────────────────────── */

export type RedeemPlatformState = {
  objectId: string;
  feeBps: number;
  /** Address fees are routed to on `withdraw_fees`. */
  treasuryAddress: string;
  /** Accumulated fees ready to withdraw, in mist. */
  feeTreasuryMist: bigint;
  paused: boolean;
  /** Lifetime pool counter — useful as a discovery sanity check. */
  totalPools: number;
  /** Wall-clock when this snapshot was fetched. */
  fetchedAt: number;
};

/* ─────────────────────────── Pool ─────────────────────────── */

export type RedeemPoolState = {
  /** Object ID of the `RedeemPool<T>` shared object. */
  objectId: string;
  /** Fully-qualified type T — e.g. `0xabc…::fomo::FOMO`. */
  coinType: string;
  creator: string;
  recipient: string;
  recipientMode: PoolRecipientMode;
  /** Mist of SUI per 1 base unit of the project coin. Fixed forever. */
  priceMistPerToken: bigint;
  coinDecimals: number;
  /** Current SUI reserve in mist. */
  suiReserveMist: bigint;
  /** Lifetime SUI ever deposited into the reserve, in mist. */
  totalSuiDepositedMist: bigint;
  /** Lifetime SUI ever paid out (gross of fee), in mist. */
  totalSuiPaidOutMist: bigint;
  /** Lifetime project-coin base units ever redeemed. */
  totalCoinRedeemed: bigint;
  createdAtMs: number;
  /** Wall-clock when this snapshot was fetched. */
  fetchedAt: number;
};

/* ─────────────────────────── Events ─────────────────────────── */

export type PoolCreatedEvent = {
  poolId: string;
  poolNumber: number;
  creator: string;
  coinType: string;
  recipient: string;
  priceMistPerToken: bigint;
  coinDecimals: number;
  initialDepositMist: bigint;
  timestampMs: number;
  txDigest: string;
};

export type RedeemedEvent = {
  poolId: string;
  poolCreator: string;
  redeemer: string;
  coinType: string;
  coinRecipient: string;
  coinIn: bigint;
  suiGrossMist: bigint;
  feeMist: bigint;
  suiOutMist: bigint;
  reserveAfterMist: bigint;
  totalCoinRedeemedAfter: bigint;
  totalSuiPaidOutAfterMist: bigint;
  timestampMs: number;
  txDigest: string;
};

export type ReserveDepositedEvent = {
  poolId: string;
  poolCreator: string;
  depositor: string;
  amountMist: bigint;
  newReserveMist: bigint;
  totalSuiDepositedAfterMist: bigint;
  timestampMs: number;
  txDigest: string;
};

/** Cursor returned by paginated event readers. */
export type EventPageCursor = {
  txDigest: string;
  eventSeq: string;
};

export type EventPage<T> = {
  items: T[];
  nextCursor: EventPageCursor | null;
  hasNextPage: boolean;
};
