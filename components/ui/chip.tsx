"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-8 px-3 rounded-full border text-xs font-mono uppercase tracking-[0.14em] transition-colors duration-200",
        active
          ? "border-ink bg-ink text-bone"
          : "border-ink/15 bg-transparent text-ink/70 hover:border-ink/40 hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}
