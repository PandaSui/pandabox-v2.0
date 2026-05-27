/**
 * TypeScript shape of the Airdrop contract's on-chain objects and events.
 *
 * Numbers that come off the chain as `u64` are kept as `bigint` once parsed
 * (Move u64s overflow JS `number` at 2^53-1 and we'd rather not silently
 * lose precision on a token balance). Event-side and object-side amounts
 * arrive as decimal strings from JSON-RPC; the reader (Phase 1) converts.
 *
 * Dollar/SUI display formatting lives in the UI layer — these types stay
 * raw so the same shape can be consumed by the indexer, the page server
 * components, and the client store without re-stringifying.
 */

/* ─────────────────────────── Platform ─────────────────────────── */

export type AirdropPlatformState = {
  objectId: string;
  /**
   * The Sui object's `initial_shared_version`. The PTB builder needs this
   * to construct a `sharedObjectRef` with `mutable: true` rather than the
   * lossy `tx.object()` shorthand. Read once and cached server-side.
   */
  initialSharedVersion: string;
  /** Flat per-recipient fee in MIST. Live value, not a constant. */
  feePerRecipientMist: bigint;
  /** Hard ceiling on `recipients.length` enforced by the Move bytecode. */
  maxRecipients: number;
  /** Address fees are routed to on `withdraw_fees`. */
  treasuryAddress: string;
  /** Accumulated fees ready to withdraw, in MIST. */
  feeTreasuryMist: bigint;
  paused: boolean;
  /** Lifetime airdrop counter — also surfaced in the masthead strip. */
  totalAirdrops: number;
  /** Wall-clock when this snapshot was fetched. */
  fetchedAt: number;
};

/* ─────────────────────────── Draft / form rows ─────────────────────────── */

/**
 * One row of the recipient list, post-parse and post-validation.
 *
 * `amountRaw` is in *base units* of the chosen coin (not decimal-formatted).
 * The parser is responsible for shifting the user's decimal input by
 * `coinDecimals` before populating this field.
 */
export type RecipientRow = {
  /** Stable id assigned by the parser so React keys survive edits. */
  id: string;
  /** Normalised Sui address (lowercase, `0x`-prefixed, 64 hex chars). */
  address: string;
  /** Base-unit amount, > 0. */
  amountRaw: bigint;
  /**
   * Human-readable amount as the user typed it, kept verbatim so the table
   * can render their original input rather than a re-formatted version.
   */
  amountInput: string;
  /** Row-level validation issues. Empty when the row is clean. */
  issues: RecipientRowIssue[];
};

export type RecipientRowIssue =
  | { kind: "invalid-address"; raw: string }
  | { kind: "invalid-amount"; raw: string }
  | { kind: "zero-amount" }
  | { kind: "duplicate"; mergedWith: string };

/**
 * Policy for handling duplicate recipient addresses in the same draft.
 *
 *   - `sum`    — merge duplicate rows by summing their amounts.
 *   - `first`  — keep only the first occurrence, drop subsequent ones.
 *   - `reject` — flag every duplicate row with an issue and refuse to quote.
 */
export type DuplicatePolicy = "sum" | "first" | "reject";

/* ─────────────────────────── Quote ─────────────────────────── */

export type AirdropQuote = {
  /** Number of rows that will actually be sent. */
  recipientCount: number;
  /** Sum of `amountRaw` across all rows, in base units. */
  totalAmountRaw: bigint;
  /** `recipientCount * feePerRecipientMist`. */
  feeMist: bigint;
  /**
   * Total SUI required from the caller's gas: the fee plus a buffer for
   * gas itself. The UI surfaces this so users can preflight without
   * surprise. Buffer policy lives in the quote module.
   */
  totalSuiBudgetMist: bigint;
  /** Whether the row count exceeds the live `max_recipients`. */
  overRecipientLimit: boolean;
  /** Number of PTBs the draft will be split into to respect the cap. */
  batchCount: number;
};

/* ─────────────────────────── Batching ─────────────────────────── */

/**
 * One PTB worth of recipients. Drafts with more recipients than
 * `max_recipients` are sliced into a sequence of these by the batching
 * helper (Phase 2).
 */
export type AirdropBatch = {
  index: number;
  total: number;
  rows: RecipientRow[];
  /** Sum of `amountRaw` within this batch. */
  totalAmountRaw: bigint;
  /** Fee for this batch only, in MIST. */
  feeMist: bigint;
};

/* ─────────────────────────── Coin discovery ─────────────────────────── */

/**
 * A `Coin<T>` object owned by the connected wallet. Used by the coin picker
 * + the PTB builder to choose a minimum-cover set.
 */
export type OwnedCoin = {
  objectId: string;
  /** Fully-qualified Move type, e.g. `0xabc…::mycoin::MYCOIN`. */
  coinType: string;
  /** Balance in base units of T. */
  balanceRaw: bigint;
  /** Object version, for staleness checks. */
  version: string;
};

/**
 * Aggregated view of a single coin type the user holds — what the picker
 * actually renders. `objects` is sorted by `balanceRaw` desc so the
 * minimum-cover algorithm picks the largest first.
 */
export type OwnedCoinGroup = {
  coinType: string;
  symbol: string | null;
  name: string | null;
  iconUrl: string | null;
  decimals: number;
  totalBalanceRaw: bigint;
  objects: OwnedCoin[];
};

/* ─────────────────────────── Events ─────────────────────────── */

export type AirdroppedEvent = {
  airdropNumber: number;
  caller: string;
  /** Stringified `TypeName` of the coin that was airdropped. */
  coinType: string;
  recipientCount: number;
  /** Total base units distributed in this airdrop. */
  totalAmountRaw: bigint;
  /** SUI fee paid in this airdrop, in MIST. */
  feeMist: bigint;
  /** Optional caller-supplied memo. */
  memo: string | null;
  /** Self-reported tx digest from the Move event (matches the wrapping tx). */
  txDigest: string;
  timestampMs: number;
};

/** Cursor returned by paginated event readers (mirrors redeem's shape). */
export type EventPageCursor = {
  txDigest: string;
  eventSeq: string;
};

export type EventPage<T> = {
  items: T[];
  nextCursor: EventPageCursor | null;
  hasNextPage: boolean;
};
