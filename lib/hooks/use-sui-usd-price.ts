"use client";

import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";

type PriceResponse = { usd: number; fetchedAt: number };

async function fetchSuiUsdPrice(): Promise<PriceResponse> {
  const res = await fetch("/api/price/sui", { cache: "no-store" });
  if (!res.ok) throw new Error(`price ${res.status}`);
  return (await res.json()) as PriceResponse;
}

/**
 * Live SUI/USD spot price, refreshed every minute. Backed by `/api/price/sui`
 * which proxies CoinGecko's free `simple/price` endpoint.
 *
 *   `price`     — BigNumber, or `null` while loading / on error
 *   `fetchedAt` — server-side fetch timestamp; useful for "as of …" labels
 *   `isLoading` — initial fetch in flight
 *   `isError`   — last fetch failed (we still surface a stale price if any)
 */
export function useSuiUsdPrice(): {
  price: BigNumber | null;
  fetchedAt: number | null;
  isLoading: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ["sui-usd-price"],
    queryFn: fetchSuiUsdPrice,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const price =
    q.data && q.data.usd > 0 ? new BigNumber(q.data.usd) : null;

  return {
    price,
    fetchedAt: q.data?.fetchedAt ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}
