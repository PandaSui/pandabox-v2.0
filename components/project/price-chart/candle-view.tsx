"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "./use-chart-data";

/**
 * Candle-stick view using TradingView's lightweight-charts (v5). Themed to
 * match Pandabox: bone background, ink axis lines, saffron-up / poppy-down
 * bodies, ink wicks. The crosshair is set to magnet-to-bar so the readout
 * always lines up with a real candle.
 *
 * We mount the chart once and `setData` on candle prop changes — recreating
 * it would cause a visible flicker every 30s when the polling refresh
 * lands. ResizeObserver keeps the chart sized to its container.
 */
export function CandleView({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // ─── Create the chart once on mount. Sized to the container; resize
  //     observer pulls subsequent dimensions. ──────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#F7F1E3" },
        textColor: "#161310",
        fontFamily:
          "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: {
          color: "#161310",
          style: LineStyle.Solid,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(22, 19, 16, 0.15)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(22, 19, 16, 0.15)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "#161310",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#161310",
        },
        horzLine: {
          color: "#161310",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#161310",
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    // Soften the horizontal grid lines after creation — the API doesn't
    // accept color+opacity in one shot, so we apply the muted ink here.
    chart.applyOptions({
      grid: {
        horzLines: {
          color: "rgba(22, 19, 16, 0.07)",
          style: LineStyle.Solid,
        },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#B8C45E",
      downColor: "#C47557",
      borderUpColor: "#B8C45E",
      borderDownColor: "#C47557",
      wickUpColor: "#161310",
      wickDownColor: "#161310",
      priceFormat: {
        type: "price",
        precision: 6,
        minMove: 0.000001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ─── Push the latest candles into the existing series. ─────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(
      candles.map((k) => ({
        time: k.t as UTCTimestamp,
        open: k.o,
        high: k.h,
        low: k.l,
        close: k.c,
      })),
    );
    // Fit content on data swaps (timeframe / first load), but don't on
    // every poll — keeps the user's pan/zoom intact between refreshes.
    chartRef.current?.timeScale().fitContent();
    // Adjust price precision dynamically for the long tail of token prices.
    const lastClose = candles[candles.length - 1]?.c ?? 1;
    const precision =
      lastClose >= 1 ? 4 : lastClose >= 0.01 ? 6 : lastClose >= 0.0001 ? 8 : 10;
    series.applyOptions({
      priceFormat: {
        type: "price",
        precision,
        minMove: 1 / Math.pow(10, precision),
      },
    });
    // Note: deliberately depend only on candle count + last bucket so a
    // polling refresh that delivers the same data doesn't trigger fitContent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length, candles[candles.length - 1]?.t]);

  return <div ref={containerRef} className="h-full w-full" />;
}
