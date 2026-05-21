import { NextResponse, type NextRequest } from "next/server";
import {
  fetchOHLCV,
  GeckoTerminalError,
  type Timeframe,
} from "@/lib/geckoterminal";

/**
 * GET /api/chart/{poolId}?tf=1h&limit=168
 *
 * Server proxy in front of GeckoTerminal's `/networks/sui-network/pools/...
 * /ohlcv/...` endpoint. Two reasons it exists:
 *
 *   1. Edge caching — Vercel caches our response via the Cache-Control
 *      header; clients pay zero upstream cost on repeat loads of the same
 *      timeframe. GeckoTerminal's unauthenticated tier is ~30/min/IP and
 *      this lets us stay well under it even if the page is popular.
 *   2. Normalization — we re-shape GT's nested attributes.ohlcv_list into
 *      our own `{ t, o, h, l, c, v }` candle shape so the client never
 *      cares which provider we're talking to.
 *
 * Response:
 *   {
 *     state: "live" | "no-trades",   // gates UI between live chart / "awaiting trade" overlay
 *     timeframe: Timeframe,
 *     candles: Array<{ t, o, h, l, c, v }>,
 *     fetchedAt: number,
 *   }
 */

const VALID_TIMEFRAMES = new Set<Timeframe>(["5m", "1h", "4h", "1D", "1W"]);

function ttlFor(tf: Timeframe): number {
  switch (tf) {
    case "5m":
      return 15;
    case "1h":
      return 30;
    case "4h":
      return 90;
    case "1D":
      return 300;
    case "1W":
      return 600;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ poolId: string }> },
) {
  const { poolId: raw } = await ctx.params;
  const poolId = decodeURIComponent(raw);

  // Sui object IDs are `0x` + up to 64 hex chars. Reject anything else
  // early so we don't burn an upstream request on garbage input.
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(poolId)) {
    return NextResponse.json({ error: "bad poolId" }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const tfRaw = (sp.get("tf") ?? "1h") as Timeframe;
  if (!VALID_TIMEFRAMES.has(tfRaw)) {
    return NextResponse.json({ error: "bad timeframe" }, { status: 400 });
  }
  const timeframe = tfRaw;

  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const { candles, fetchedAt } = await fetchOHLCV({
      poolId,
      timeframe,
      limit: Number.isFinite(limit) ? limit : undefined,
      revalidate: ttlFor(timeframe),
    });

    return NextResponse.json(
      {
        state: candles.length > 0 ? "live" : "no-trades",
        timeframe,
        candles,
        fetchedAt,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${ttlFor(timeframe)}, stale-while-revalidate=${ttlFor(timeframe) * 4}`,
        },
      },
    );
  } catch (err) {
    if (err instanceof GeckoTerminalError) {
      // Bubble 429 distinctly so the client can back off polling.
      return NextResponse.json(
        { error: err.message },
        { status: err.status === 429 ? 429 : 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
