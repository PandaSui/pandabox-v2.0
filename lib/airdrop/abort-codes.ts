/**
 * Known Move abort codes thrown by the Airdrop contract. The dictionary is
 * intentionally empty at first launch — we populate it the first time we
 * observe a given code via devInspect / failed mainnet tx so the wizard
 * shows actionable copy instead of an opaque `MoveAbort(…, N)` string.
 *
 * Mirrors the redeem abort-codes module so the parser can be shared in
 * shape (different package, different module names).
 */

type AbortInfo = {
  /** Stable code → short copy. Plain English, no jargon. */
  message: string;
  /** Optional hint for the UI to render a CTA (e.g. "open existing pool"). */
  hint?: string;
};

const ABORTS: Record<string, Record<number, AbortInfo>> = {
  airdrop: {
    // Populate on first sighting. Likely candidates the bytecode encodes:
    //   - `recipients.length != amounts.length`
    //   - `recipients.length == 0`
    //   - `recipients.length > max_recipients`
    //   - `coin.value < sum(amounts)`
    //   - `fee.value  < recipients.length * fee_per_recipient_mist`
    // Don't pre-fill speculative codes — wait for the real one to surface
    // so we don't ship lies.
  },
  platform: {
    // Admin-only aborts (paused toggling, fee bounds, etc). Same policy:
    // observe before mapping.
  },
};

/**
 * Parse a Move abort error string and return a typed result.
 *
 *   "MoveAbort(MoveLocation { …, name: Identifier(\"airdrop\") …, function_name: Some(\"airdrop\") }, 7) in command 1"
 *     →
 *   { module: "airdrop", function: "airdrop", code: 7, message: "..." }
 *
 * Returns `null` when the input doesn't look like a MoveAbort from this
 * package.
 */
export function parseAirdropAbort(error: string): {
  module: string;
  function: string;
  code: number;
  message: string;
  hint?: string;
} | null {
  if (!error) return null;
  const re =
    /name:\s*Identifier\(\\?"([^"]+)\\?"\).*?function_name:\s*Some\(\\?"([^"]+)\\?"\).*?,\s*(\d+)\)/;
  const m = error.match(re);
  if (!m) {
    const fallback = error.match(/MoveAbort\([^)]*?,\s*(\d+)\)/);
    if (!fallback) return null;
    return {
      module: "",
      function: "",
      code: Number(fallback[1]),
      message: `Move abort code ${fallback[1]}.`,
    };
  }
  const moduleName = m[1];
  const funcName = m[2];
  const code = Number(m[3]);
  const info = ABORTS[moduleName]?.[code];
  return {
    module: moduleName,
    function: funcName,
    code,
    message:
      info?.message ??
      `Contract aborted with code ${code} in ${moduleName}::${funcName}.`,
    hint: info?.hint,
  };
}
