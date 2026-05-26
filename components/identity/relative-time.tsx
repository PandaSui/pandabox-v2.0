"use client";

import { useEffect, useState } from "react";
import { cn } from "@pandasui/ui/lib";

const MIN = 60;
const HOUR = 3600;
const DAY = 86400;
const MONTH = DAY * 30; // ~30-day month — close enough for relative-time copy
const YEAR = DAY * 365;

/**
 * Format a relative time string. Tier abbreviations are deliberately
 * disambiguated:
 *   · `min` for minutes (not `m`, which the eye reads as months in
 *     uppercase mono contexts like "8M AGO")
 *   · `h`   for hours
 *   · `d`   for days
 *   · `mo`  for months
 *   · `y`   for years
 * Two units are concatenated when they read more naturally together
 * (`2d 4h`, `3mo 12d`); above 1y we just show years to keep the cell
 * narrow.
 */
function format(diffSec: number): string {
  const abs = Math.abs(diffSec);
  const future = diffSec < 0;

  let core: string;
  if (abs < 45) core = "just now";
  else if (abs < MIN * 60) core = `${Math.round(abs / MIN)} min`;
  else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MIN);
    core = m ? `${h}h ${m} min` : `${h}h`;
  } else if (abs < MONTH) {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    core = h ? `${d}d ${h}h` : `${d}d`;
  } else if (abs < YEAR) {
    const months = Math.floor(abs / MONTH);
    const d = Math.floor((abs % MONTH) / DAY);
    core = d ? `${months}mo ${d}d` : `${months}mo`;
  } else {
    const years = Math.floor(abs / YEAR);
    const months = Math.floor((abs % YEAR) / MONTH);
    core = months ? `${years}y ${months}mo` : `${years}y`;
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
