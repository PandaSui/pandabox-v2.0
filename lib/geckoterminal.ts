import "server-only";

/**
 * Thin typed wrapper around the GeckoTerminal public API.
 *
 * Docs: https://api.geckoterminal.com/docs/index.html
 *
 * Free, no API key, ~30 calls/min/IP for unauth requests. Keyed on the DEX
 * pool address — not the coin type — which fits our seeded-liquidity model:
 * a project only has a chart once it has a real pool, and at that point we
 * already store the `poolId` in IPFS via the seed-liquidity flow.
 *
 * Same response shape Noodles used (tuple-array OHLCV), so callers in
 * `app/api/chart/...` can stay almost identical to the previous wiring.
 */

const BASE_URL = "https://api.geckoterminal.com/api/v2";
const NETWORK = "sui-network";

/**
 * Our public timeframe → GeckoTerminal's (timeframe, aggregate) pair.
 *
 * GeckoTerminal does NOT expose a native "week" candle. For `1W` we fall
 * back to daily candles with a longer history, which gives users a
 * 6-month zoom-out view — more useful in practice than 7-day buckets.
 */
export type Timeframe = "5m" | "1h" | "4h" | "1D" | "1W";

type GtTimeframe = "minute" | "hour" | "day";
type GtAggregate = 1 | 4 | 5 | 12 | 15;

const TIMEFRAME_MAP: Record<
  Timeframe,
  { timeframe: GtTimeframe; aggregate: GtAggregate; defaultLimit: number }
> = {
  "5m": { timeframe: "minute", aggregate: 5, defaultLimit: 144 },
  "1h": { timeframe: "hour", aggregate: 1, defaultLimit: 168 },
  "4h": { timeframe: "hour", aggregate: 4, defaultLimit: 180 },
  "1D": { timeframe: "day", aggregate: 1, defaultLimit: 90 },
  "1W": { timeframe: "day", aggregate: 1, defaultLimit: 180 },
};

export type Candle = {
  /** Unix seconds. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type OHLCVResult = {
  candles: Candle[];
  /** Server timestamp at fetch (ms). Used by the client to gate polling. */
  fetchedAt: number;
};

type GeckoTerminalResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>;
    };
  };
};

class GeckoTerminalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GeckoTerminalError";
  }
}

/**
 * Fetch OHLCV candles for a Sui DEX pool.
 *
 * `revalidate` controls Next's fetch cache TTL — match it to how stale the
 * caller can tolerate the latest bucket (e.g. 15s for 5m, 60s for hourly).
 * GeckoTerminal returns rows newest-first; we sort ascending before
 * returning so chart libraries can plot them directly.
 */
export async function fetchOHLCV(opts: {
  poolId: string;
  timeframe: Timeframe;
  /** Pagination: only return candles strictly before this unix-second timestamp. */
  beforeTimestamp?: number;
  /** Override the default candle count for the chosen timeframe. Max 1000 per GT docs. */
  limit?: number;
  revalidate?: number;
}): Promise<OHLCVResult> {
  const { poolId, timeframe, beforeTimestamp, limit, revalidate = 30 } = opts;
  const { timeframe: gtTf, aggregate, defaultLimit } = TIMEFRAME_MAP[timeframe];

  const params = new URLSearchParams({
    aggregate: String(aggregate),
    limit: String(Math.min(Math.max(limit ?? defaultLimit, 1), 1000)),
  });
  if (typeof beforeTimestamp === "number") {
    params.set("before_timestamp", String(Math.floor(beforeTimestamp)));
  }

  const url = `${BASE_URL}/networks/${NETWORK}/pools/${encodeURIComponent(poolId)}/ohlcv/${gtTf}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new GeckoTerminalError("rate limited", 429);
    }
    // 404 = the pool isn't indexed (or doesn't exist). Surface as empty so
    // the chart shows the "awaiting first trade" placeholder rather than
    // an error banner — matches the natural product flow where a freshly
    // created pool can take a beat to show up in GT's indexer.
    if (res.status === 404) {
      return { candles: [], fetchedAt: Date.now() };
    }
    const body = await res.text().catch(() => "");
    console.error(
      `[geckoterminal] ohlcv upstream ${res.status} for pool=${poolId} tf=${gtTf}/${aggregate}: ${body.slice(0, 400)}`,
    );
    throw new GeckoTerminalError(
      `upstream ${res.status}: ${body.slice(0, 200) || res.statusText}`,
      res.status,
    );
  }

  const json = (await res.json()) as GeckoTerminalResponse;
  const rows = json.data?.attributes?.ohlcv_list ?? [];

  // Dedupe by timestamp — GeckoTerminal occasionally emits two rows for
  // the same bucket (overlap at aggregation boundaries, partial-bucket
  // re-emits when a new trade lands). lightweight-charts asserts strict
  // ascending order, so two rows with identical `t` crashes the candle
  // view. Use a Map with last-write-wins so the freshest values for that
  // bucket survive.
  const byT = new Map<number, Candle>();
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 6) continue;
    const t = Number(r[0]);
    const c = Number(r[4]);
    if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    byT.set(t, {
      t,
      o: Number(r[1]),
      h: Number(r[2]),
      l: Number(r[3]),
      c,
      v: Number(r[5]),
    });
  }

  // GT returns newest-first; charts plot ascending.
  const candles = Array.from(byT.values()).sort((a, b) => a.t - b.t);

  return { candles, fetchedAt: Date.now() };
}

export { GeckoTerminalError };
