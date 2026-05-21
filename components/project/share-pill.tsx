"use client";

import { useEffect, useState } from "react";
import { cn } from "@pandasui/ui/lib";

/**
 * Inline "copy URL · share on X" pill row for the project detail hero.
 * Keeps the surrounding row server-rendered by isolating the clipboard +
 * `window.location` access in this small client island.
 */
export function SharePill({
  projectName,
  ticker,
  className,
}: {
  projectName: string;
  ticker: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  // tweetHref is computed post-mount so SSR and the first CSR render emit
  // the same href ("…?text="). Previously the component conditionally
  // included window.location during render, which produced a server/client
  // mismatch and triggered a hydration warning.
  const [tweetHref, setTweetHref] = useState(
    "https://twitter.com/intent/tweet?text=",
  );

  useEffect(() => {
    const tweet = `Backing ${projectName} (${ticker}) on Pandabox — programmable on-chain funding on Sui.\n\n${window.location.href}`;
    setTweetHref(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
    );
  }, [projectName, ticker]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — swallow silently */
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "inline-flex h-7 items-center gap-1 border border-ink/25 px-2 font-mono-label text-[10px] transition-colors",
          copied
            ? "border-jade/60 text-jade"
            : "text-ink/60 hover:border-ink hover:text-ink",
        )}
        aria-label="Copy project URL"
      >
        {copied ? (
          <CheckGlyph />
        ) : (
          <CopyGlyph />
        )}
        <span>{copied ? "copied" : "copy"}</span>
      </button>
      <a
        href={tweetHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 items-center gap-1 border border-ink/25 px-2 font-mono-label text-[10px] text-ink/60 transition-colors hover:border-ink hover:text-ink"
        aria-label="Share on X"
      >
        <XGlyph />
        <span>share</span>
      </a>
    </div>
  );
}

function CopyGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="5" width="8" height="8" />
      <path d="M3 11V3h8" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2H21l-6.522 7.453L22 22h-6.844l-4.79-6.27L4.8 22H2.044l6.974-7.971L2 2h7.02l4.33 5.74L18.244 2Zm-2.4 18.4h1.5L7.24 3.5H5.66l10.184 16.9Z" />
    </svg>
  );
}
