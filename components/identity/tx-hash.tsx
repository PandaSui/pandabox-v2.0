"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/address";
import { explorerUrl, type SuiNetwork } from "@/lib/sui";

export function TxHash({
  value,
  head = 6,
  tail = 4,
  network,
  copyable = true,
  className,
}: {
  value: string;
  head?: number;
  tail?: number;
  network?: SuiNetwork;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-ink/80",
        className,
      )}
    >
      <a
        href={explorerUrl("tx", value, network)}
        target="_blank"
        rel="noreferrer"
        className="font-mono tabular-nums text-sm hover:text-ink underline-offset-4 hover:underline"
      >
        {truncateAddress(value, head, tail)}
      </a>
      <a
        href={explorerUrl("tx", value, network)}
        target="_blank"
        rel="noreferrer"
        aria-label="View on Sui Explorer"
        className="inline-flex h-5 w-5 items-center justify-center text-ink/40 hover:text-ink"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
      {copyable && (
        <button
          onClick={onCopy}
          aria-label="Copy transaction hash"
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
