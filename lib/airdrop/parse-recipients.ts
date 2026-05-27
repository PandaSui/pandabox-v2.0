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
import {
  isValidSuiAddress,
  normalizeSuiAddress,
} from "@mysten/sui/utils";
import type {
  DuplicatePolicy,
  RecipientRow,
  RecipientRowIssue,
} from "./types";

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

  const normalisedAddress = normaliseAddress(pair.rawAddress);
  if (!normalisedAddress) {
    issues.push({ kind: "invalid-address", raw: pair.rawAddress });
  }

  const parsedAmount = parseAmount(pair.rawAmount, opts.decimals);
  if (parsedAmount === null) {
    issues.push({ kind: "invalid-amount", raw: pair.rawAmount });
  } else if (parsedAmount === 0n) {
    issues.push({ kind: "zero-amount" });
  }

  return {
    // Stable, deterministic id: line-number + index keeps React keys
    // stable across the redo button without leaning on crypto.randomUUID
    // (which would change on every re-parse).
    id: `r${pair.lineNumber}-${index}`,
    address: normalisedAddress ?? pair.rawAddress.toLowerCase(),
    amountRaw: parsedAmount ?? 0n,
    amountInput: pair.rawAmount,
    issues,
  };
}

function normaliseAddress(raw: string): string | null {
  if (!raw) return null;
  // `normalizeSuiAddress` pads to 32 bytes; `isValidSuiAddress` then
  // confirms the shape. Reject anything that doesn't normalise cleanly.
  let normalised: string;
  try {
    normalised = normalizeSuiAddress(raw);
  } catch {
    return null;
  }
  if (!isValidSuiAddress(normalised)) return null;
  return normalised.toLowerCase();
}

function parseAmount(raw: string, decimals: number): bigint | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").replace(/_/g, "").trim();
  if (!cleaned) return null;
  const bn = new BigNumber(cleaned);
  if (!bn.isFinite() || bn.isNegative()) return null;
  const shifted = bn.shiftedBy(decimals);
  if (!shifted.isInteger()) return null;
  // Move u64 max — anything beyond this overflows the on-chain type.
  const u64Max = new BigNumber("18446744073709551615");
  if (shifted.isGreaterThan(u64Max)) return null;
  return BigInt(shifted.toFixed(0));
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
      (i) => i.kind === "invalid-address",
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
  return rows.filter(
    (r) =>
      r.amountRaw > 0n &&
      !r.issues.some(
        (i) =>
          i.kind === "invalid-address" ||
          i.kind === "invalid-amount" ||
          i.kind === "zero-amount",
      ),
  );
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
        i.kind === "invalid-address" ||
        i.kind === "invalid-amount" ||
        (i.kind === "duplicate" && r.amountRaw > 0n),
    ),
  );
}
