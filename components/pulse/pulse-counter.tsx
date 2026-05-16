"use client";

import { useEffect, useRef, useState } from "react";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { MIST_PER_SUI } from "@/lib/sui";

function fmt(suiBn: BigNumber): string {
  return suiBn.toFormat(2, BigNumber.ROUND_DOWN, {
    groupSeparator: ",",
    groupSize: 3,
    decimalSeparator: ".",
  });
}

const EASE_OUT_QUART = (t: number) => 1 - Math.pow(1 - t, 4);

export function PulseCounter({
  mist,
  durationMs = 200,
  className,
}: {
  mist: bigint;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState<BigNumber>(() =>
    new BigNumber(mist.toString()).dividedBy(MIST_PER_SUI.toString()),
  );
  const fromRef = useRef<BigNumber>(display);
  const targetRef = useRef<BigNumber>(display);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = new BigNumber(mist.toString()).dividedBy(
      MIST_PER_SUI.toString(),
    );
    if (target.isEqualTo(targetRef.current)) return;

    fromRef.current = display;
    targetRef.current = target;
    startRef.current = performance.now();

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = EASE_OUT_QUART(t);
      const diff = targetRef.current.minus(fromRef.current);
      const cur = fromRef.current.plus(diff.multipliedBy(eased));
      setDisplay(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [mist, durationMs, display]);

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {fmt(display)}
    </span>
  );
}
