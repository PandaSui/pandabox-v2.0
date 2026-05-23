"use client";

import { useRef, type ReactNode } from "react";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { FundingBar } from "./funding-bar";

/**
 * Project-detail-page funding meter. Owns the count-up ref so the bar fill
 * and the percentage tick together on first viewport entry. Renders the
 * surrounding labels (raised SUI, target SUI, milestone hairlines).
 */
export function DetailFundingMeter({
  pct,
  live,
  raisedLabel,
  targetLabel,
}: {
  pct: number;
  live: boolean;
  raisedLabel: ReactNode;
  targetLabel: ReactNode;
}) {
  const pctRef = useRef<HTMLSpanElement>(null);
  const initial = pct.toFixed(pct >= 10 ? 0 : pct >= 1 ? 1 : 2);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <MonoLabel className="text-[10px]">Raised</MonoLabel>
        <span className="font-mono tabular-nums text-2xl text-ink leading-none">
          <span ref={pctRef}>
            <span>{initial}</span>
          </span>
          <span className="text-ink/45">%</span>
        </span>
      </div>
      <div className="mt-3">
        <FundingBar
          pct={pct}
          live={live}
          accent="saffron"
          size="lg"
          pctRef={pctRef}
        />
      </div>
      {/* Milestone scale under the bar — anchors the eye and makes the bar
          feel structurally important rather than decorative. */}
      <div
        aria-hidden
        className="mt-1.5 grid grid-cols-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/30"
      >
        <span>0</span>
        <span className="text-center">25</span>
        <span className="text-center">50</span>
        <span className="text-right">100</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between font-mono text-[12px] tabular-nums text-ink/60">
        <span>
          {live ? (
            <Marker color="saffron">
              <span className="text-ink">{raisedLabel}</span>
            </Marker>
          ) : (
            <span className="text-ink">{raisedLabel}</span>
          )}
        </span>
        <span>
          of {targetLabel} <span className="text-ink/40">target</span>
        </span>
      </div>
    </div>
  );
}
