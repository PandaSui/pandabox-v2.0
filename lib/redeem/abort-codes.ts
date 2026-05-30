/**
 * Known Move abort codes thrown by the Redeem contract. Discovered by
 * devInspect failures against the live mainnet package and mapped to
 * holder-facing copy here so the wizard / panels can show actionable
 * errors instead of opaque `MoveAbort(…101)` strings.
 *
 * Add a new entry the first time we observe a new abort code in the
 * wild — better to maintain a small dictionary than to invent error
 * strings on the spot.
 */

type AbortInfo = {
  /** Stable code → short copy. Plain English, no jargon. */
  message: string;
};

const ABORTS: Record<string, Record<number, AbortInfo>> = {
  pool: {
    // Confirmed by devInspect against mainnet (`fe5d…f4bd`):
    //   100 @ instruction 17 in create_pool → asserts `price_mist_per_token > 0`.
    //   101 @ instruction 32 in create_pool → asserts `recipient != @0x0`.
    // The contract does *not* enforce one-pool-per-coin-type; multiple
    // pools for the same `T` are accepted by the Move bytecode.
    100: {
      message:
        "Exchange rate must be greater than zero. The contract rejects a pool with a zero `price_mist_per_token`.",
    },
    101: {
      message:
        "Recipient cannot be the Sui zero address. Pick a non-zero burn address or a real treasury / multisig.",
    },
  },
  platform: {
    // No platform-side asserts surfaced from the user-facing flow yet.
    // Add here when we see one (e.g. paused, fee_bps out of range).
  },
};

/**
 * Parse a Move abort error string and return a typed result.
 *
 *   "MoveAbort(MoveLocation { …, name: Identifier(\"pool\") …, function_name: Some(\"create_pool\") }, 101) in command 1"
 *     →
 *   { module: "pool", function: "create_pool", code: 101, message: "...", hint: "open-existing" }
 *
 * Returns `null` when the input doesn't look like a MoveAbort the
 * contract emits.
 */
export function parseRedeemAbort(error: string): {
  module: string;
  function: string;
  code: number;
  message: string;
} | null {
  if (!error) return null;
  // Match the module identifier, function name (optional), and code.
  const re =
    /name:\s*Identifier\(\\?"([^"]+)\\?"\).*?function_name:\s*Some\(\\?"([^"]+)\\?"\).*?,\s*(\d+)\)/;
  const m = error.match(re);
  if (!m) {
    // Fallback: any "MoveAbort(..., N)" with a code suffix.
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
  };
}
