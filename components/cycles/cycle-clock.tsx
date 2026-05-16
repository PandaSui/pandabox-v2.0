"use client";

import { useEffect, useState } from "react";
import { cn } from "@pandasui/ui/lib";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "ended";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CycleClock({
  cycleEnd,
  className,
}: {
  cycleEnd: number;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Server render: show "—" so SSR/CSR match.
  const text =
    now == null ? "—" : formatRemaining(cycleEnd - now);
  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      suppressHydrationWarning
    >
      {text}
    </span>
  );
}
