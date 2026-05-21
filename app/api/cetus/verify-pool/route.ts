import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { getNetwork } from "@/lib/sui";

/**
 * GET /api/cetus/verify-pool?poolId={id}&coinType={pkg}::{mod}::{NAME}
 *
 * Verifies a candidate Cetus pool BEFORE the creator pins it to IPFS via
 * the seed-liquidity admin flow. Three things must hold for `ok: true`:
 *
 *   1. The object exists on the configured network and is a Move object.
 *   2. Its type matches `<pkg>::pool::Pool<A, B>` — Cetus's CLMM uses the
 *      `pool::Pool` shape. We don't maintain an allowlist of Cetus package
 *      IDs (they've had multiple upgrades) — the structural check + the
 *      coin-pair check below are tight enough to catch obvious mistakes.
 *   3. One of A or B is `0x2::sui::SUI` and the other matches the
 *      project's coin type (with address normalization on both sides —
 *      Sui canonicalizes `0x2` while user input often comes long-form).
 *
 * Returns a single shape — `{ ok: true, poolType, coinA, coinB }` on
 * success, or `{ ok: false, reason }` with a human-readable explanation
 * the admin modal surfaces directly.
 */

const SUI_TYPE = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

type VerifyResult =
  | {
      ok: true;
      poolType: string;
      coinA: string;
      coinB: string;
    }
  | {
      ok: false;
      reason: string;
    };

let _client: SuiJsonRpcClient | null = null;
function client(): SuiJsonRpcClient {
  if (!_client) {
    const network = getNetwork();
    _client = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(network),
      network,
    });
  }
  return _client;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const poolId = (sp.get("poolId") ?? "").trim();
  const coinType = (sp.get("coinType") ?? "").trim();

  if (!/^0x[0-9a-fA-F]{1,64}$/.test(poolId)) {
    return json({ ok: false, reason: "Pool address is not a valid Sui object ID." });
  }
  if (!/^0x[0-9a-fA-F]{1,64}::[A-Za-z0-9_]+::[A-Za-z0-9_]+$/.test(coinType)) {
    return json({ ok: false, reason: "Project coin type is malformed." });
  }

  let res;
  try {
    res = await client().getObject({
      id: poolId,
      options: { showType: true, showContent: true },
    });
  } catch (err) {
    return json({
      ok: false,
      reason:
        "Couldn't reach Sui RPC — " +
        (err instanceof Error ? err.message : "unknown error"),
    });
  }

  if (res.error || !res.data) {
    return json({ ok: false, reason: "No object at that address on this network." });
  }
  if (res.data.content?.dataType !== "moveObject") {
    return json({
      ok: false,
      reason: "Address points to a non-Move object (likely a package or coin).",
    });
  }

  const fullType = res.data.type ?? "";
  // Match `<pkg>::pool::Pool<A, B>`. Cetus's CLMM module is named `pool`;
  // a future variant could use `pool_v2` — we accept either to avoid
  // breaking when they ship an upgrade.
  const m = fullType.match(
    /^(0x[0-9a-fA-F]{1,64})::pool(?:_v2)?::Pool<([^,]+),\s*(.+)>$/,
  );
  if (!m) {
    return json({
      ok: false,
      reason: `Object isn't a Cetus pool — type is \`${fullType}\`.`,
    });
  }

  const coinA = m[2].trim();
  const coinB = m[3].trim();

  // Normalize both sides before comparing. Sui RPC emits the framework
  // address as `0x2::sui::SUI`; user input may come long-form. We pad to
  // 64-char addresses so equality works either way.
  const want = normalizeCoinType(coinType);
  const suiCanon = normalizeCoinType(SUI_TYPE);
  const aN = normalizeCoinType(coinA);
  const bN = normalizeCoinType(coinB);

  const hasSui = aN === suiCanon || bN === suiCanon;
  const hasProjectCoin = aN === want || bN === want;

  if (!hasSui) {
    return json({
      ok: false,
      reason:
        "Pool is not paired with SUI. Pandabox launches require a SUI pair so the chart price is denominated correctly.",
    });
  }
  if (!hasProjectCoin) {
    return json({
      ok: false,
      reason: `Pool doesn't include this project's coin (${shortCoin(coinType)}). Pool sides: ${shortCoin(coinA)} / ${shortCoin(coinB)}.`,
    });
  }

  return json({
    ok: true,
    poolType: fullType,
    coinA,
    coinB,
  });
}

function json(body: VerifyResult): NextResponse {
  return NextResponse.json(body, {
    status: body.ok ? 200 : 200, // surface failure in payload, not HTTP — easier to bind to UI state
    headers: {
      // Verification is intentionally uncached — the admin clicks Verify
      // once, gets the answer, and signs. Caching here would mask a fresh
      // pool that just landed.
      "Cache-Control": "no-store",
    },
  });
}

function normalizeCoinType(t: string): string {
  const parts = t.split("::");
  if (parts.length < 3) return t;
  const [pkg, mod, ...rest] = parts;
  const addr = pkg.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return `0x${addr}::${mod}::${rest.join("::")}`;
}

function shortCoin(typeStr: string): string {
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? typeStr;
}
