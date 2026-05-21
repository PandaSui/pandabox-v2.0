"use client";

import { useEffect, useRef, useState } from "react";
import type { Timeframe } from "./chart-frame";

/**
 * Client-side fetch hook for the project chart.
 *
 * Calls our server proxy (`/api/chart/{poolId}`) rather than GeckoTerminal
 * directly — the proxy gives us edge caching + a single point to swap the
 * upstream data source later. Polls on a cadence matched to the active
 * timeframe: short buckets refresh fast, daily candles refresh slowly.
 * Re-fetches on timeframe / poolId change and cleans up the in-flight
 * request via AbortController so we never write to a stale state after an
 * unmount.
 *
 * `state === 'no-trades'` is a normal response, not an error — surface it
 * so the caller can render the "awaiting first trade" placeholder inside
 * the same chart frame.
 */

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type ChartState = "live" | "no-trades";

type ApiResponse = {
  state: ChartState;
  timeframe: Timeframe;
  candles: Candle[];
  fetchedAt: number;
};

type HookState = {
  candles: Candle[];
  state: ChartState;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
};

const LIMIT_BY_TF: Record<Timeframe, number> = {
  "5m": 144,
  "1h": 168,
  "4h": 180,
  "1D": 90,
  "1W": 180,
};

const POLL_MS_BY_TF: Record<Timeframe, number> = {
  "5m": 15_000,
  "1h": 30_000,
  "4h": 60_000,
  "1D": 120_000,
  "1W": 300_000,
};

export function useChartData(opts: {
  poolId: string | undefined;
  timeframe: Timeframe;
  /** Skip the request entirely — used while liquidity isn't seeded yet. */
  enabled: boolean;
}): HookState {
  const { poolId, timeframe, enabled } = opts;
  const [s, setS] = useState<HookState>({
    candles: [],
    state: "no-trades",
    fetchedAt: null,
    loading: enabled && Boolean(poolId),
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !poolId) {
      setS({
        candles: [],
        state: "no-trades",
        fetchedAt: null,
        loading: false,
        error: null,
      });
      return;
    }

    setS((prev) => ({ ...prev, loading: true, error: null }));

    let cancelled = false;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const limit = LIMIT_BY_TF[timeframe];
    const url = `/api/chart/${encodeURIComponent(poolId)}?tf=${encodeURIComponent(timeframe)}&limit=${limit}`;

    const load = async () => {
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`upstream ${res.status}`);
        }
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setS({
          candles: json.candles ?? [],
          state: json.state ?? "no-trades",
          fetchedAt: json.fetchedAt ?? Date.now(),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled || ctrl.signal.aborted) return;
        setS((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "fetch failed",
        }));
      }
    };

    void load();
    const id = window.setInterval(load, POLL_MS_BY_TF[timeframe]);

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [poolId, timeframe, enabled]);

  return s;
}
