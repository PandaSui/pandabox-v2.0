"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/address";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs px-2.5 h-8 border border-ink/25 bg-bone hover:border-ink transition-colors",
        copied && "border-moss text-moss",
        className
      )}
      aria-label={`Copy ${label || "value"}`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        {copied ? (
          <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="5" y="5" width="8" height="8" />
            <path d="M3 11V3h8" />
          </>
        )}
      </svg>
      <span>{copied ? "Copied" : label ?? "Copy"}</span>
    </button>
  );
}
