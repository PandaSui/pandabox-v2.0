"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@pandasui/ui/lib";
import { AreaView } from "./area-view";
import type { Candle } from "./use-chart-data";
import type { Timeframe, ViewStyle } from "./chart-frame";

/**
 * Lightweight-charts is browser-only (it touches `canvas` and resize APIs).
 * We can't safely render it on the server, and pulling it into the bundle
 * eagerly would inflate the initial JS for everyone — including pages that
 * never reach a project detail view. `next/dynamic` with `ssr: false`
 * defers both concerns until the user actually lands here.
 */
const CandleView = dynamic(
  () => import("./candle-view").then((m) => m.CandleView),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-bone" />,
  },
);

/**
 * Live canvas that swaps between the Recharts area view and the
 * lightweight-charts candle view. Adds two micro-interactions:
 *
 *   1. First-trade flash — the canvas briefly pulses saffron the first time
 *      we receive a candle after the section was empty (i.e. the chart
 *      goes from `no-trades` to `live`). This is the "trading just started"
 *      moment; we surface it instead of having the candles silently appear.
 *   2. View crossfade — switching AREA ↔ CANDLES fades the outgoing view so
 *      the swap doesn't feel binary.
 */
export function LiveCanvas({
  candles,
  timeframe,
  viewStyle,
}: {
  candles: Candle[];
  timeframe: Timeframe;
  viewStyle: ViewStyle;
}) {
  const [flash, setFlash] = useState(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const prev = prevCountRef.current;
    const next = candles.length;
    if (prev === 0 && next > 0) {
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 1400);
      prevCountRef.current = next;
      return () => window.clearTimeout(id);
    }
    prevCountRef.current = next;
  }, [candles.length]);

  return (
    <div className="relative h-full w-full">
      {/* Sub-second saffron sweep when the first candle lands. The flash
          element sits above the chart canvas so it doesn't interfere with
          chart pointer events once it fades out. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 transition-opacity duration-700",
          flash ? "opacity-100" : "opacity-0",
        )}
        style={{
          background:
            "linear-gradient(90deg, rgba(184,196,94,0) 0%, rgba(184,196,94,0.55) 50%, rgba(184,196,94,0) 100%)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Canvas — keyed by viewStyle so React fully tears down one and mounts
          the other; this is the simplest way to swap chart libs without
          residual DOM state from the previous renderer. */}
      <div key={viewStyle} className="h-full w-full animate-[fadein_320ms_ease-out]">
        {viewStyle === "candles" ? (
          <CandleView candles={candles} />
        ) : (
          <AreaView candles={candles} timeframe={timeframe} />
        )}
      </div>

      <style jsx>{`
        @keyframes fadein {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
