import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type BadgeTone =
  | "ink"
  | "bone"
  | "moss"
  | "saffron"
  | "stone"
  | "signal"
  | "sky"
  | "jade"
  | "poppy"
  | "sun"
  | "plum";

export function Badge({
  children,
  tone = "ink",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  const tones: Record<BadgeTone, string> = {
    ink: "bg-ink text-bone",
    bone: "bg-bone text-ink border border-ink",
    moss: "bg-moss text-bone",
    saffron: "bg-saffron text-ink",
    stone: "bg-stone/20 text-ink border border-ink/20",
    signal: "bg-signal text-bone",
    sky: "bg-sky text-bone",
    jade: "bg-jade text-bone",
    poppy: "bg-poppy text-bone",
    sun: "bg-sun text-ink",
    plum: "bg-plum text-bone",
  };
  const dotTone: Record<BadgeTone, string> = {
    ink: "bg-saffron",
    bone: "bg-ink",
    moss: "bg-sun",
    saffron: "bg-ink",
    stone: "bg-ink",
    signal: "bg-bone",
    sky: "bg-sun",
    jade: "bg-sun",
    poppy: "bg-bone",
    sun: "bg-ink",
    plum: "bg-sun",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-2.5 h-6 font-mono-label rounded-none",
        tones[tone],
        className
      )}
    >
      {dot ? <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotTone[tone])} /> : null}
      {children}
    </span>
  );
}
