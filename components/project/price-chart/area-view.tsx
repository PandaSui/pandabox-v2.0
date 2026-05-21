"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle } from "./use-chart-data";
import type { Timeframe } from "./chart-frame";
import { formatPrice, formatTimeShort, formatTimeFull } from "./format";

/**
 * Area-chart view (smoothed close-price). Default view; complements the
 * `<CandleView>` candlestick option behind a toggle. Themed to match the
 * Pandabox surface: ink stroke, saffron fill at low opacity, hairline grid,
 * mono crosshair tooltip.
 *
 * Recharts' time scale expects milliseconds — GeckoTerminal gives us
 * seconds, so we convert at the data boundary here.
 */
export function AreaView({
  candles,
  timeframe,
}: {
  candles: Candle[];
  timeframe: Timeframe;
}) {
  const data = candles.map((k) => ({ t: k.t * 1000, c: k.c }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 16, right: 14, bottom: 8, left: 0 }}
      >
        <defs>
          <linearGradient id="pb-area-saffron" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B8C45E" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#B8C45E" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke="#161310"
          strokeOpacity={0.06}
          vertical={false}
        />

        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(ms) => formatTimeShort(ms, timeframe)}
          tick={{
            fill: "#161310",
            fillOpacity: 0.45,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
          axisLine={{ stroke: "#161310", strokeOpacity: 0.15 }}
          tickLine={false}
          minTickGap={48}
        />

        <YAxis
          dataKey="c"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => formatPrice(v)}
          tick={{
            fill: "#161310",
            fillOpacity: 0.45,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
          axisLine={{ stroke: "#161310", strokeOpacity: 0.15 }}
          tickLine={false}
          orientation="right"
          width={68}
        />

        <Tooltip
          cursor={{ stroke: "#161310", strokeOpacity: 0.45, strokeWidth: 1 }}
          content={<AreaTooltip />}
        />

        <Area
          type="monotone"
          dataKey="c"
          stroke="#161310"
          strokeWidth={1.5}
          fill="url(#pb-area-saffron)"
          dot={false}
          activeDot={{
            r: 3.5,
            fill: "#B8C45E",
            stroke: "#161310",
            strokeWidth: 1,
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: { t: number; c: number } }>;
};

function AreaTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  if (!p) return null;
  return (
    <div className="border border-ink bg-bone px-2.5 py-1.5 shadow-offset-sm">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {formatTimeFull(p.t)}
      </div>
      <div className="mt-0.5 font-mono tabular-nums text-[12px] text-ink">
        {formatPrice(p.c)}{" "}
        <span className="text-ink/45">SUI</span>
      </div>
    </div>
  );
}
