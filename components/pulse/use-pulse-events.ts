"use client";

import { useEffect, useRef, useState } from "react";
import type { PulseEventDTO, PulseSnapshot } from "./types";

type Options = {
  capacity?: number;
  intervalMs?: number;
  enabled?: boolean;
};

export function usePulseEvents({
  capacity = 24,
  intervalMs = 6000,
  enabled = true,
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

        const fresh = snap.events.filter((e) => !seen.current.has(e.txHash));
        if (fresh.length === 0) return;
        fresh.forEach((e) => seen.current.add(e.txHash));

        setEvents((prev) => {
          const merged = [...fresh, ...prev]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, capacity);
          // Trim seen set to roughly capacity*3 so it doesn't grow unbounded.
          if (seen.current.size > capacity * 4) {
            const keep = new Set(merged.map((e) => e.txHash));
            seen.current = keep;
          }
          return merged;
        });
        setArrivalNonce((n) => n + fresh.length);
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
  }, [capacity, intervalMs, enabled]);

  return { events, tvlMist, arrivalNonce };
}
