/**
 * Small JSON-RPC parsing helpers shared between the object reader and the
 * event reader. Keeping them pure here makes the reader+events layers a
 * thin shim over `coerce*` calls.
 */

import {
  classifyRecipient,
  type PoolRecipientMode,
  type RedeemPlatformState,
  type RedeemPoolState,
  type PoolCreatedEvent,
  type RedeemedEvent,
  type ReserveDepositedEvent,
} from "./types";

/* ─────────────────────────── Field coercion ─────────────────────────── */

/** Move u64 fields arrive as decimal strings; this normalizes to bigint. */
export function asBigInt(value: unknown, fallback = 0n): bigint {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * A Move `Balance<SUI>` round-trips through JSON-RPC as either a bare
 * string (older paths) or `{ value: "<mist>" }` / `{ fields: { value } }`
 * depending on which display level the caller asked for. Handle all three.
 */
export function balanceMist(value: unknown): bigint {
  if (typeof value === "string") return asBigInt(value);
  if (value && typeof value === "object") {
    const obj = value as { value?: unknown; fields?: { value?: unknown } };
    if ("value" in obj && obj.value !== undefined) return asBigInt(obj.value);
    if (obj.fields && "value" in obj.fields) return asBigInt(obj.fields.value);
  }
  return 0n;
}

/* ─────────────────────────── Type-string parsing ─────────────────────────── */

/**
 * Pull the inner type parameter T out of a `RedeemPool<T>` object type tag.
 *
 *   "<pkg>::pool::RedeemPool<0xabc::fomo::FOMO>"  →  "0xabc::fomo::FOMO"
 *
 * Returns `null` when the tag doesn't match the expected shape — callers
 * should treat that as an "unrecognised object" rather than crash.
 */
export function extractCoinTypeFromObjectType(
  objectType: string | undefined,
): string | null {
  if (!objectType) return null;
  const start = objectType.indexOf("<");
  const end = objectType.lastIndexOf(">");
  if (start < 0 || end < 0 || end <= start) return null;
  return objectType.slice(start + 1, end).trim();
}

/**
 * `type_name::TypeName` round-trips as `{ name: "0xabc::fomo::FOMO" }`
 * inside event payloads.
 */
export function coinTypeFromEvent(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const n = (value as { name?: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

/* ─────────────────────────── Object → state parsers ─────────────────────────── */

export function parseRedeemPlatform(
  objectId: string,
  fields: Record<string, unknown>,
): RedeemPlatformState {
  return {
    objectId,
    feeBps: asNumber(fields.fee_bps),
    treasuryAddress: asString(fields.treasury_address),
    feeTreasuryMist: balanceMist(fields.fee_treasury),
    paused: Boolean(fields.paused ?? false),
    totalPools: asNumber(fields.total_pools),
    fetchedAt: Date.now(),
  };
}

export function parseRedeemPool(args: {
  objectId: string;
  objectType: string;
  fields: Record<string, unknown>;
  platformTreasuryAddress?: string;
}): RedeemPoolState | null {
  const coinType = extractCoinTypeFromObjectType(args.objectType);
  if (!coinType) return null;
  const recipient = asString(args.fields.recipient);
  const recipientMode: PoolRecipientMode = classifyRecipient(
    recipient,
    args.platformTreasuryAddress,
  );
  return {
    objectId: args.objectId,
    coinType,
    creator: asString(args.fields.creator),
    recipient,
    recipientMode,
    priceMistPerToken: asBigInt(args.fields.price_mist_per_token),
    coinDecimals: asNumber(args.fields.coin_decimals),
    suiReserveMist: balanceMist(args.fields.sui_reserve),
    totalSuiDepositedMist: asBigInt(args.fields.total_sui_deposited),
    totalSuiPaidOutMist: asBigInt(args.fields.total_sui_paid_out),
    totalCoinRedeemed: asBigInt(args.fields.total_coin_redeemed),
    createdAtMs: asNumber(args.fields.created_at_ms),
    fetchedAt: Date.now(),
  };
}

/* ─────────────────────────── Event payload parsers ─────────────────────────── */

type RawEnvelope = {
  parsedJson: Record<string, unknown>;
  id: { txDigest: string; eventSeq: string };
};

export function parsePoolCreated(e: RawEnvelope): PoolCreatedEvent {
  const p = e.parsedJson;
  return {
    poolId: asString(p.pool_id),
    poolNumber: asNumber(p.pool_number),
    creator: asString(p.creator),
    coinType: coinTypeFromEvent(p.coin_type),
    recipient: asString(p.recipient),
    priceMistPerToken: asBigInt(p.price_mist_per_token),
    coinDecimals: asNumber(p.coin_decimals),
    initialDepositMist: asBigInt(p.initial_deposit),
    timestampMs: asNumber(p.timestamp_ms),
    txDigest: e.id.txDigest,
  };
}

export function parseRedeemed(e: RawEnvelope): RedeemedEvent {
  const p = e.parsedJson;
  return {
    poolId: asString(p.pool_id),
    poolCreator: asString(p.pool_creator),
    redeemer: asString(p.redeemer),
    coinType: coinTypeFromEvent(p.coin_type),
    coinRecipient: asString(p.coin_recipient),
    coinIn: asBigInt(p.coin_in),
    suiGrossMist: asBigInt(p.sui_gross),
    feeMist: asBigInt(p.fee),
    suiOutMist: asBigInt(p.sui_out),
    reserveAfterMist: asBigInt(p.reserve_after),
    totalCoinRedeemedAfter: asBigInt(p.total_coin_redeemed_after),
    totalSuiPaidOutAfterMist: asBigInt(p.total_sui_paid_out_after),
    timestampMs: asNumber(p.timestamp_ms),
    txDigest: e.id.txDigest,
  };
}

export function parseReserveDeposited(e: RawEnvelope): ReserveDepositedEvent {
  const p = e.parsedJson;
  return {
    poolId: asString(p.pool_id),
    poolCreator: asString(p.pool_creator),
    depositor: asString(p.depositor),
    amountMist: asBigInt(p.amount),
    newReserveMist: asBigInt(p.new_reserve),
    totalSuiDepositedAfterMist: asBigInt(p.total_sui_deposited_after),
    timestampMs: asNumber(p.timestamp_ms),
    txDigest: e.id.txDigest,
  };
}
