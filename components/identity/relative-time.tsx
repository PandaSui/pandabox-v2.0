"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

function format(diffSec: number): string {
  const abs = Math.abs(diffSec);
  const future = diffSec < 0;

  let core: string;
  if (abs < 45) core = "just now";
  else if (abs < MIN * 60) core = `${Math.round(abs / MIN)}m`;
  else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MIN);
    core = m ? `${h}h ${m}m` : `${h}h`;
  } else {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    core = h ? `${d}d ${h}h` : `${d}d`;
  }

  if (core === "just now") return core;
  return future ? `in ${core}` : `${core} ago`;
}

export function RelativeTime({
  value,
  className,
  intervalMs = 30_000,
}: {
  value: Date | number | string;
  className?: string;
  intervalMs?: number;
}) {
  const target = new Date(value).getTime();
  const iso = new Date(target).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const text =
    now == null ? iso : format(Math.round((now - target) / 1000));

  return (
    <time
      dateTime={new Date(target).toISOString()}
      title={iso}
      className={cn("font-mono tabular-nums text-sm", className)}
      suppressHydrationWarning
    >
      {text}
    </time>
  );
}
