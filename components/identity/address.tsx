"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/address";
import { explorerUrl, type SuiNetwork } from "@/lib/sui";

export function Address({
  value,
  head,
  tail,
  link = false,
  copyable = true,
  network,
  className,
}: {
  value: string;
  head?: number;
  tail?: number;
  link?: boolean;
  copyable?: boolean;
  network?: SuiNetwork;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = truncateAddress(value, head, tail);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const label = (
    <span className="font-mono tabular-nums text-sm">{text}</span>
  );
  const inner = link ? (
    <a
      href={explorerUrl("address", value, network)}
      target="_blank"
      rel="noreferrer"
      className="hover:text-ink underline-offset-4 hover:underline"
    >
      {label}
    </a>
  ) : (
    label
  );

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-ink/80",
        className,
      )}
    >
      {inner}
      {copyable && (
        <button
          onClick={onCopy}
          aria-label="Copy address"
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center text-ink/40 transition-colors hover:text-ink",
            copied && "text-moss",
          )}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {copied ? (
              <path d="M3 8.5l3 3 7-7" />
            ) : (
              <>
                <rect x="5" y="5" width="8" height="8" />
                <path d="M3 11V3h8" />
              </>
            )}
          </svg>
        </button>
      )}
    </span>
  );
}
