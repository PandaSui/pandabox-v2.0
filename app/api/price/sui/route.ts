import { NextResponse } from "next/server";

/**
 * SUI/USD spot price, proxied from CoinGecko's free `simple/price` endpoint.
 * Cached for 60s at the route layer to keep us well under CoinGecko's
 * unauthenticated rate limit (~10–30 rpm).
 *
 * Response shape:
 *   { usd: number, fetchedAt: number }   200
 *   { error: string }                    502 (upstream failed; client falls back)
 */
const ENDPOINT =
  "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd";

export const revalidate = 60;

export async function GET() {
  try {
    const res = await fetch(ENDPOINT, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as { sui?: { usd?: number } };
    const usd = json.sui?.usd;
    if (typeof usd !== "number" || !isFinite(usd) || usd <= 0) {
      return NextResponse.json({ error: "no price" }, { status: 502 });
    }
    return NextResponse.json(
      { usd, fetchedAt: Date.now() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
