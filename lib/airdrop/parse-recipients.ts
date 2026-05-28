/**
 * Recipient-list parser for the Airdrop tool.
 *
 * The user can drop in:
 *
 *   - CSV / TSV / semicolon-separated text:
 *       0xabc…01,1.5
 *       0xabc…02\t12
 *       0xabc…03; 0.0001
 *   - Plain whitespace-separated lines:
 *       0xabc…01 1.5
 *   - JSON: an array of `{ address, amount }` objects or `[address, amount]`
 *     tuples — common output from spreadsheet exports or scripts.
 *
 * The parser is intentionally lenient on input shape but strict on the
 * meaning of the two fields:
 *
 *   1. The address must satisfy `@mysten/sui/utils` `isValidSuiAddress`.
 *      Normalised to lowercase, `0x`-padded to 32 bytes / 64 hex chars.
 *   2. The amount must be a positive decimal that, once shifted by
 *      `coinDecimals`, produces an integer base-unit value (Move u64).
 *      Negative amounts, zero, NaN, and "too many decimals for this coin"
 *      are all errors per-row.
 *
 * Duplicate handling is a caller-driven policy (see `DuplicatePolicy`):
 *
 *   - `sum`    merges duplicates by summing their amounts (default).
 *   - `first`  keeps the first row, drops subsequent ones.
 *   - `reject` flags every duplicate row with an `issues` entry — the
 *              quote / submit path refuses to proceed.
 *
 * The parser never throws on bad data — it returns clean rows alongside
 * a parallel array of row-level issues so the UI can render the original
 * lines with inline error chips rather than failing globally on the first
 * bad address.
 */

import BigNumber from "bignumber.js";
import { isValidSuiAddress } from "@mysten/sui/utils";
import type {
  DuplicatePolicy,
  RecipientRow,
  RecipientRowIssue,
} from "./types";

// Burn destination. Structurally valid, but no one owns it — warn so the
// user confirms they meant to burn rather than typo-ing to it.
const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

// Sui framework / system objects. Sending coins here is almost always a
// mistake (the framework itself, the clock, the random oracle, deepbook).
const SYSTEM_ADDRESSES = new Set<string>([
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000000000000000000000000000005",
  "0x0000000000000000000000000000000000000000000000000000000000000006",
  "0x000000000000000000000000000000000000000000000000000000000000dee9",
]);

export type ParseRecipientsOptions = {
  /** Base-10 exponent for shifting `amountInput` to raw u64 units. */
  decimals: number;
  /** How to handle two rows sharing the same address. Default `sum`. */
  duplicatePolicy?: DuplicatePolicy;
};

export type ParseRecipientsResult = {
  /** Final rows after dedupe policy was applied. */
  rows: RecipientRow[];
  /**
   * Lines that couldn't be split into address + amount at all — usually
   * blank lines or stray header rows. Surfaced so the UI can show a
   * single "N lines skipped" hint without per-row noise.
   */
  skippedLineCount: number;
  /**
   * Top-level errors that prevent the parser from making sense of the
   * input as a whole (e.g. malformed JSON). When non-empty, `rows` will
   * always be empty.
   */
  errors: string[];
};

/* ─────────────────────────── Entry points ─────────────────────────── */

/**
 * Parse raw text (CSV / TSV / whitespace / JSON) into a list of
 * recipient rows. The function dispatches on the leading non-whitespace
 * character: `[` or `{` routes to the JSON branch, anything else to the
 * delimited-text branch.
 */
export function parseRecipients(
  input: string,
  opts: ParseRecipientsOptions,
): ParseRecipientsResult {
  const text = input.trim();
  if (!text) {
    return { rows: [], skippedLineCount: 0, errors: [] };
  }

  const looksLikeJson = text.startsWith("[") || text.startsWith("{");
  const raw = looksLikeJson
    ? parseJsonRows(text)
    : parseDelimitedRows(text);

  if (raw.errors.length > 0) {
    return { rows: [], skippedLineCount: 0, errors: raw.errors };
  }

  const built = buildRows(raw.pairs, opts);
  return {
    rows: applyDuplicatePolicy(built, opts.duplicatePolicy ?? "sum"),
    skippedLineCount: raw.skippedLineCount,
    errors: [],
  };
}

/* ─────────────────────────── Delimited text ─────────────────────────── */

type RawPair = {
  /** 1-based line number from the original input, for downstream surfaces. */
  lineNumber: number;
  rawAddress: string;
  rawAmount: string;
};

type RawParse = {
  pairs: RawPair[];
  skippedLineCount: number;
  errors: string[];
};

/**
 * Split each non-empty line on the most-likely separator. Tabs win over
 * commas which win over semicolons which win over whitespace, in that
 * order — the priority matches how spreadsheet exports actually look in
 * the wild. Rows with > 2 columns keep the first two and discard the
 * rest (some tools tack on a memo/label column we don't use here).
 */
function parseDelimitedRows(text: string): RawParse {
  const lines = text.split(/\r?\n/);
  const pairs: RawPair[] = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = stripComment(lines[i]).trim();
    if (!line) {
      skipped += 1;
      continue;
    }
    const parts = splitLine(line);
    if (parts.length < 2) {
      skipped += 1;
      continue;
    }
    pairs.push({
      lineNumber: i + 1,
      rawAddress: parts[0].trim(),
      rawAmount: parts[1].trim(),
    });
  }
  return { pairs, skippedLineCount: skipped, errors: [] };
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  if (line.includes(";")) return line.split(";");
  return line.split(/\s+/);
}

function stripComment(line: string): string {
  // `#` or `//` lead-in comments are common when people paste from notes.
  const hash = line.indexOf("#");
  const slash = line.indexOf("//");
  const cut = [hash, slash].filter((n) => n >= 0).sort((a, b) => a - b)[0];
  return typeof cut === "number" ? line.slice(0, cut) : line;
}

/* ─────────────────────────── JSON ─────────────────────────── */

function parseJsonRows(text: string): RawParse {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON.";
    return { pairs: [], skippedLineCount: 0, errors: [msg] };
  }
  if (!Array.isArray(json)) {
    return {
      pairs: [],
      skippedLineCount: 0,
      errors: ["Expected a JSON array of rows."],
    };
  }

  const pairs: RawPair[] = [];
  let skipped = 0;
  for (let i = 0; i < json.length; i += 1) {
    const item = json[i];
    const pair = jsonItemToPair(item, i + 1);
    if (pair) pairs.push(pair);
    else skipped += 1;
  }
  return { pairs, skippedLineCount: skipped, errors: [] };
}

function jsonItemToPair(item: unknown, lineNumber: number): RawPair | null {
  if (!item) return null;
  if (Array.isArray(item) && item.length >= 2) {
    return {
      lineNumber,
      rawAddress: String(item[0] ?? "").trim(),
      rawAmount: String(item[1] ?? "").trim(),
    };
  }
  if (typeof item === "object") {
    const o = item as Record<string, unknown>;
    const address =
      pickString(o, ["address", "recipient", "to", "wallet"]) ?? "";
    const amount =
      pickString(o, ["amount", "value", "qty", "tokens", "balance"]) ?? "";
    if (!address && !amount) return null;
    return { lineNumber, rawAddress: address.trim(), rawAmount: amount.trim() };
  }
  return null;
}

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/* ─────────────────────────── Validation ─────────────────────────── */

function buildRows(
  pairs: RawPair[],
  opts: ParseRecipientsOptions,
): RecipientRow[] {
  return pairs.map((p, i) => buildRow(p, i, opts));
}

function buildRow(
  pair: RawPair,
  index: number,
  opts: ParseRecipientsOptions,
): RecipientRow {
  const issues: RecipientRowIssue[] = [];

  const addressParse = normaliseAddress(pair.rawAddress);
  let address: string;
  if (addressParse.ok) {
    address = addressParse.address;
    if (addressParse.warning === "zero") {
      issues.push({ kind: "warn-zero-address" });
    } else if (addressParse.warning === "system") {
      issues.push({ kind: "warn-system-address", which: address });
    }
  } else {
    address = pair.rawAddress.trim().toLowerCase();
    issues.push(
      addressParse.error === "length"
        ? { kind: "invalid-address-length", raw: pair.rawAddress }
        : { kind: "invalid-address-format", raw: pair.rawAddress },
    );
  }

  const amountParse = parseAmount(pair.rawAmount, opts.decimals);
  let amountRaw: bigint;
  if (amountParse.ok) {
    amountRaw = amountParse.value;
    if (amountRaw === 0n) {
      issues.push({ kind: "zero-amount" });
    }
  } else {
    amountRaw = 0n;
    if (amountParse.error === "decimals") {
      issues.push({
        kind: "invalid-amount-decimals",
        raw: pair.rawAmount,
        decimals: opts.decimals,
      });
    } else if (amountParse.error === "overflow") {
      issues.push({ kind: "invalid-amount-overflow", raw: pair.rawAmount });
    } else {
      issues.push({ kind: "invalid-amount-format", raw: pair.rawAmount });
    }
  }

  return {
    // Stable, deterministic id: line-number + index keeps React keys
    // stable across the redo button without leaning on crypto.randomUUID
    // (which would change on every re-parse).
    id: `r${pair.lineNumber}-${index}`,
    address,
    amountRaw,
    amountInput: pair.rawAmount,
    issues,
  };
}

type AddressParse =
  | { ok: true; address: string; warning?: "zero" | "system" }
  | { ok: false; error: "format" | "length" };

// Strict 0x-prefixed, exactly-64-hex-char check. Refuses to auto-pad short
// hex (the previous behaviour silently turned `0x123` into a valid
// burn-adjacent address — disastrous for airdrops). Burn + system
// addresses pass but carry a warning so the UI can prompt the user.
function normaliseAddress(raw: string): AddressParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "format" };
  if (!/^0x/i.test(trimmed)) return { ok: false, error: "format" };
  const body = trimmed.slice(2);
  if (body.length !== 64) return { ok: false, error: "length" };
  if (!/^[0-9a-fA-F]{64}$/.test(body)) return { ok: false, error: "format" };
  const address = `0x${body.toLowerCase()}`;
  // Defence-in-depth — should be redundant given the regex above, but
  // keeps us aligned with whatever the SDK considers canonical.
  if (!isValidSuiAddress(address)) return { ok: false, error: "format" };
  if (address === ZERO_ADDRESS) return { ok: true, address, warning: "zero" };
  if (SYSTEM_ADDRESSES.has(address)) {
    return { ok: true, address, warning: "system" };
  }
  return { ok: true, address };
}

type AmountParse =
  | { ok: true; value: bigint }
  | { ok: false; error: "format" | "decimals" | "overflow" };

function parseAmount(raw: string, decimals: number): AmountParse {
  if (!raw) return { ok: false, error: "format" };
  const cleaned = raw.replace(/,/g, "").replace(/_/g, "").trim();
  if (!cleaned) return { ok: false, error: "format" };
  const bn = new BigNumber(cleaned);
  if (!bn.isFinite() || bn.isNegative()) {
    return { ok: false, error: "format" };
  }
  const shifted = bn.shiftedBy(decimals);
  if (!shifted.isInteger()) return { ok: false, error: "decimals" };
  // Move u64 max — anything beyond this overflows the on-chain type.
  const u64Max = new BigNumber("18446744073709551615");
  if (shifted.isGreaterThan(u64Max)) return { ok: false, error: "overflow" };
  return { ok: true, value: BigInt(shifted.toFixed(0)) };
}

/* ─────────────────────────── Duplicate policy ─────────────────────────── */

function applyDuplicatePolicy(
  rows: RecipientRow[],
  policy: DuplicatePolicy,
): RecipientRow[] {
  if (rows.length < 2) return rows;
  const seen = new Map<string, RecipientRow>();
  const out: RecipientRow[] = [];

  for (const row of rows) {
    const hasFatalIssue = row.issues.some(
      (i) =>
        i.kind === "invalid-address-format" ||
        i.kind === "invalid-address-length",
    );
    if (hasFatalIssue) {
      out.push(row);
      continue;
    }
    const prior = seen.get(row.address);
    if (!prior) {
      seen.set(row.address, row);
      out.push(row);
      continue;
    }
    if (policy === "first") {
      // Drop the duplicate silently — the user opted out of merge math.
      continue;
    }
    if (policy === "reject") {
      out.push({
        ...row,
        issues: [
          ...row.issues,
          { kind: "duplicate", mergedWith: prior.id },
        ],
      });
      continue;
    }
    // Default: sum. Mutate the prior row's amount in place; surface a
    // duplicate marker on the new row so the UI can show "merged" copy
    // without dropping the line entirely.
    prior.amountRaw = prior.amountRaw + row.amountRaw;
    out.push({
      ...row,
      amountRaw: 0n,
      issues: [
        ...row.issues,
        { kind: "duplicate", mergedWith: prior.id },
      ],
    });
  }
  return out;
}

/* ─────────────────────────── Convenience selectors ─────────────────────────── */

/**
 * Rows that should actually be sent on-chain — positive amount and no
 * blocking issue. Rows zeroed by the `sum` dedupe policy don't appear
 * here (their balance has already been folded into the row they merged
 * with).
 */
export function liveRows(rows: RecipientRow[]): RecipientRow[] {
  return rows.filter((r) => r.amountRaw > 0n && !r.issues.some(isBlockingIssue));
}

/**
 * True for issues that prevent a row from being sent on-chain. Warnings
 * (zero address, system address) explicitly do NOT block — the user
 * opted in by leaving the row in the list.
 */
export function isBlockingIssue(issue: RecipientRowIssue): boolean {
  switch (issue.kind) {
    case "invalid-address-format":
    case "invalid-address-length":
    case "invalid-amount-format":
    case "invalid-amount-decimals":
    case "invalid-amount-overflow":
    case "zero-amount":
      return true;
    case "warn-zero-address":
    case "warn-system-address":
    case "duplicate":
      return false;
  }
}

/**
 * Rows that the UI should render as blocking errors — anything with an
 * invalid address, invalid amount, or duplicate-under-reject marker.
 * Zero-amount rows from the `sum` merge are excluded because they're
 * already accounted for in the merged-into row.
 */
export function blockingRows(rows: RecipientRow[]): RecipientRow[] {
  return rows.filter((r) =>
    r.issues.some(
      (i) =>
        isBlockingIssue(i) ||
        (i.kind === "duplicate" && r.amountRaw > 0n),
    ),
  );
}
