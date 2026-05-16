"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Char = string;

function format(n: number, grouping: boolean): string {
  return grouping ? Math.round(n).toLocaleString("en-US") : String(Math.round(n));
}

export function SplitFlapCounter({
  value,
  grouping = true,
  durationMs = 200,
  staggerMs = 40,
  className,
}: {
  value: number;
  grouping?: boolean;
  durationMs?: number;
  staggerMs?: number;
  className?: string;
}) {
  const text = format(value, grouping);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chars: Char[] = text.split("");

  return (
    <span
      className={cn(
        "inline-flex font-mono tabular-nums leading-none",
        className,
      )}
      aria-label={text}
      suppressHydrationWarning
    >
      {chars.map((ch, i) => (
        <Digit
          key={`${i}-${ch}`}
          char={ch}
          delayMs={mounted ? i * staggerMs : 0}
          durationMs={durationMs}
        />
      ))}
    </span>
  );
}

const ROW = "0123456789".split("");
const ROW_HEIGHT_EM = 1;

function Digit({
  char,
  delayMs,
  durationMs,
}: {
  char: Char;
  delayMs: number;
  durationMs: number;
}) {
  // For non-digit characters (commas, periods, etc.) render statically.
  const isNum = /\d/.test(char);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    const id = setTimeout(() => setSettled(true), delayMs);
    return () => clearTimeout(id);
  }, [char, delayMs]);

  if (!isNum) {
    return (
      <span className="px-[0.04em] text-current" aria-hidden>
        {char}
      </span>
    );
  }

  const target = Number(char);
  // Pre-mount the digit at "0" then transition to target.
  const offset = settled ? -target * ROW_HEIGHT_EM : 0;

  return (
    <span
      ref={containerRef}
      className="relative inline-block overflow-hidden text-current"
      style={{ height: "1em", width: "0.65em" }}
      aria-hidden
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        style={{
          transform: `translateY(${offset}em)`,
          transition: `transform ${durationMs}ms cubic-bezier(0.65, 0, 0.35, 1)`,
        }}
      >
        {ROW.map((d) => (
          <span key={d} style={{ height: "1em", lineHeight: "1em" }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}
