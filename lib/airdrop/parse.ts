/**
 * Small JSON-RPC parsing helpers shared between the Platform object reader
 * and the event reader. Kept pure here so the reader+events layers can stay
 * a thin shim over `coerce*` calls — mirrors the redeem package shape.
 */

import type { AirdropPlatformState, AirdroppedEvent } from "./types";

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
 * A Move `Balance<SUI>` round-trips through JSON-RPC as either a bare string
 * (older paths) or `{ value: "<mist>" }` / `{ fields: { value } }` depending
 * on which display level the caller asked for. Handle all three.
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

/**
 * Move `Option<T>` round-trips as either `null`, a bare `T`, or
 * `{ vec: [T] }` / `{ vec: [] }`. Returns the inner value or `null`.
 */
export function optionString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as { vec?: unknown };
    if (Array.isArray(obj.vec)) {
      const first = obj.vec[0];
      return typeof first === "string" ? first : null;
    }
  }
  return null;
}

/**
 * `type_name::TypeName` round-trips as `{ name: "abc::airdrop::TOKEN" }` in
 * event payloads — Sui strips the `0x` prefix from the package address in
 * the TypeName encoding. Downstream callers (CoinMetadata lookup, Move call
 * type args) require the canonical `0x…::module::Type` form.
 */
export function coinTypeFromEvent(value: unknown): string {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (() => {
            const n = (value as { name?: unknown }).name;
            return typeof n === "string" ? n : "";
          })()
        : "";
  return normalizeCoinType(raw);
}

export function normalizeCoinType(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v.startsWith("0x")) return v;
  const firstSep = v.indexOf("::");
  if (firstSep <= 0) return v;
  const addr = v.slice(0, firstSep);
  if (/^[0-9a-fA-F]+$/.test(addr)) return `0x${v}`;
  return v;
}

/* ─────────────────────────── Platform parser ─────────────────────────── */

export function parseAirdropPlatform(args: {
  objectId: string;
  initialSharedVersion: string;
  fields: Record<string, unknown>;
}): AirdropPlatformState {
  const { objectId, initialSharedVersion, fields } = args;
  return {
    objectId,
    initialSharedVersion,
    feePerRecipientMist: asBigInt(fields.fee_per_recipient_mist),
    maxRecipients: asNumber(fields.max_recipients),
    treasuryAddress: asString(fields.treasury_address),
    feeTreasuryMist: balanceMist(fields.fee_treasury),
    paused: Boolean(fields.paused ?? false),
    totalAirdrops: asNumber(fields.total_airdrops),
    fetchedAt: Date.now(),
  };
}

/* ─────────────────────────── Event parsers ─────────────────────────── */

type RawEnvelope = {
  parsedJson: Record<string, unknown>;
  id: { txDigest: string; eventSeq: string };
};

export function parseAirdropped(e: RawEnvelope): AirdroppedEvent {
  const p = e.parsedJson;
  return {
    airdropNumber: asNumber(p.airdrop_number),
    caller: asString(p.caller),
    coinType: coinTypeFromEvent(p.coin_type),
    recipientCount: asNumber(p.recipient_count),
    totalAmountRaw: asBigInt(p.total_amount),
    feeMist: asBigInt(p.fee_paid),
    memo: optionString(p.memo),
    // The event carries a self-reported `tx_digest: vector<u8>`, but the
    // wrapping envelope's digest is canonical and string-form, so prefer
    // that and skip the vector decode.
    txDigest: e.id.txDigest,
    timestampMs: asNumber(p.timestamp_ms),
  };
}
