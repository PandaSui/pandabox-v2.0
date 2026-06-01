"use client";

import { useEffect, useRef, useState } from "react";
import type { PulseEventDTO, PulseSnapshot } from "./types";

type Options = {
  capacity?: number;
  intervalMs?: number;
  enabled?: boolean;
  /**
   * Drop events older than this many ms — on ingest and as they age past the
   * window on later polls. Leave undefined to keep every event regardless of
   * age (the default). The hero console sets a short window so the feed only
   * ever shows fresh "just now / N min ago" activity, never stale timestamps.
   */
  maxAgeMs?: number;
};

export function usePulseEvents({
  capacity = 24,
  intervalMs = 6000,
  enabled = true,
  maxAgeMs,
}: Options = {}) {
  const [events, setEvents] = useState<PulseEventDTO[]>([]);
  const [tvlMist, setTvlMist] = useState<bigint>(0n);
  const [arrivalNonce, setArrivalNonce] = useState(0);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const ac = new AbortController();

    async function tick() {
      try {
        const res = await fetch(`/api/pulse?limit=${capacity}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const snap = (await res.json()) as PulseSnapshot;
        if (cancelled) return;

        setTvlMist(BigInt(snap.tvlMist));

        const now = Date.now();
        const isFresh = (e: PulseEventDTO) =>
          maxAgeMs == null || now - e.timestamp <= maxAgeMs;

        const fresh = snap.events.filter(
          (e) => isFresh(e) && !seen.current.has(e.txHash),
        );
        fresh.forEach((e) => seen.current.add(e.txHash));

        setEvents((prev) => {
          const merged = [...fresh, ...prev]
            // Re-apply the window on every poll so events that have aged out
            // of it since they arrived drop from the feed too.
            .filter(isFresh)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, capacity);
          // Nothing arrived and nothing aged out — keep the same reference so
          // the poll doesn't churn a re-render.
          if (fresh.length === 0 && merged.length === prev.length) {
            return prev;
          }
          // Trim seen set to roughly capacity*3 so it doesn't grow unbounded.
          if (seen.current.size > capacity * 4) {
            const keep = new Set(merged.map((e) => e.txHash));
            seen.current = keep;
          }
          return merged;
        });
        if (fresh.length > 0) setArrivalNonce((n) => n + fresh.length);
      } catch {
        /* ignore */
      }
    }

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      ac.abort();
      clearInterval(id);
    };
  }, [capacity, intervalMs, enabled, maxAgeMs]);

  return { events, tvlMist, arrivalNonce };
}
