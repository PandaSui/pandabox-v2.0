"use client";

import { useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { explorerUrl, type SuiNetwork } from "@/lib/sui";

/**
 * Display a fully-qualified Move coin type (e.g.
 * `0xabc…::module::WITNESS`) with a copy button. The package hex is
 * truncated in the visible label so it sits nicely beside short Sui
 * addresses, but the copy action writes the full type to the clipboard so
 * users can paste it into wallets / listings.
 *
 * `link` opens the coin type's package on Sui Explorer when set, mirroring
 * the `<Address>` component's behaviour for creator addresses.
 */
export function CoinType({
  value,
  link = false,
  copyable = true,
  network,
  className,
  pkgHead = 4,
  pkgTail = 4,
}: {
  value: string;
  link?: boolean;
  copyable?: boolean;
  network?: SuiNetwork;
  className?: string;
  pkgHead?: number;
  pkgTail?: number;
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

  const pretty = formatCoinType(value, pkgHead, pkgTail);
  const packageId = value.split("::")[0] ?? value;

  const label = (
    <span className="truncate font-mono tabular-nums text-sm">{pretty}</span>
  );
  const inner = link ? (
    <a
      href={explorerUrl("object", packageId, network)}
      target="_blank"
      rel="noreferrer"
      className="min-w-0 truncate underline-offset-4 hover:text-ink hover:underline"
    >
      {label}
    </a>
  ) : (
    label
  );

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-ink/80",
        className,
      )}
    >
      {inner}
      {copyable && (
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy contract address"
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center text-ink/40 transition-colors hover:text-ink",
            copied && "text-jade",
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

function formatCoinType(value: string, head: number, tail: number): string {
  if (!value) return "";
  const parts = value.split("::");
  if (parts.length < 2) return value;
  const [pkg, ...rest] = parts;
  if (!pkg || pkg.length < head + tail + 4) return value;
  const prefix = pkg.startsWith("0x") ? "0x" : "";
  const hex = pkg.startsWith("0x") ? pkg.slice(2) : pkg;
  return `${prefix}${hex.slice(0, head)}…${hex.slice(-tail)}::${rest.join("::")}`;
}
