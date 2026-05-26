"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@pandasui/ui/lib";
import { TxHash } from "@/components/identity/tx-hash";
import { resolveBlobRef } from "@/lib/ipfs";
import { formatAmount } from "@/lib/amount";

type DeploySuccessProps = {
  projectName: string;
  ticker?: string;
  coinSymbol?: string;
  coverImage?: string;
  tokensPerSui?: string;
  allocationTokens?: string;
  endTimeMs?: number | null;
  /** Fully-qualified Move coin type — the on-chain CA users paste into wallets. */
  coinType?: string;
  /** Project<T> shared object ID. When present, the share URL deep-links to /projects/[id]. */
  projectId?: string;
  txDigest: string;
  onContinue?: () => void;
  continueLabel?: string;
};

const SITE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
  "https://pandabox.money";

export function DeploySuccess({
  projectName,
  ticker,
  coinSymbol,
  coverImage,
  tokensPerSui,
  allocationTokens,
  endTimeMs,
  coinType,
  projectId,
  txDigest,
  onContinue,
  continueLabel = "See it on Explore",
}: DeploySuccessProps) {
  const scope = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<"ca" | null>(null);
  const coverUrl = resolveBlobRef(coverImage)?.url ?? null;
  const symbol = coinSymbol || ticker || "TOKEN";

  const rateText = `1 SUI → ${formatAmount(tokensPerSui ?? "0")} ${symbol}`;
  const allocText = `${formatAmount(allocationTokens ?? "0")} ${symbol}`;
  const endsText =
    endTimeMs == null
      ? "Open-ended"
      : new Date(endTimeMs).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  // X will fetch og:image from the project page if we send a URL — that's
  // where the cover-image OG card comes from. The CA lives on the project
  // page itself, so the tweet just hands over the link.
  const shareUrl = projectId
    ? `${SITE_URL}/projects/${projectId}`
    : `${SITE_URL}/explore`;
  const tweet = `Just launched ${projectName} on @0xPandaSui — programmable on-chain funding on Sui.\n\n${shareUrl}`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;

  const onCopyCA = async () => {
    if (!coinType) return;
    try {
      await navigator.clipboard.writeText(coinType);
      setCopied("ca");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard blocked — fail silently rather than tripping the celebration
    }
  };

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) {
        gsap.set(scope.current?.querySelectorAll("[data-anim]") ?? [], {
          opacity: 1,
          clearProps: "transform",
        });
        gsap.set("[data-marker]", { clipPath: "inset(0 0% 0 0)" });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from("[data-polaroid]", {
        y: -28,
        rotate: -12,
        scale: 0.9,
        opacity: 0,
        duration: 0.7,
        ease: "back.out(1.4)",
      })
        .from(
          "[data-stamp]",
          {
            scale: 0.4,
            rotate: -42,
            opacity: 0,
            duration: 0.55,
            ease: "back.out(2.4)",
          },
          "-=0.25",
        )
        .from(
          "[data-confetti] > *",
          {
            scaleY: 0,
            opacity: 0,
            duration: 0.5,
            stagger: { each: 0.035, from: "random" },
            transformOrigin: "center center",
            ease: "back.out(2.2)",
          },
          "-=0.45",
        )
        .from("[data-eyebrow]", { y: 8, opacity: 0, duration: 0.35 }, "-=0.25")
        .fromTo(
          "[data-marker]",
          { clipPath: "inset(0 100% 0 0)" },
          {
            clipPath: "inset(0 0% 0 0)",
            duration: 0.55,
            ease: "power2.inOut",
          },
          "-=0.15",
        )
        .from("[data-meta]", { y: 6, opacity: 0, duration: 0.35 }, "-=0.35")
        .from(
          "[data-stat]",
          {
            y: 10,
            opacity: 0,
            duration: 0.35,
            stagger: 0.07,
          },
          "-=0.2",
        )
        .from("[data-tx]", { y: 6, opacity: 0, duration: 0.3 }, "-=0.15")
        .from(
          "[data-cta]",
          { y: 8, opacity: 0, duration: 0.35, stagger: 0.08 },
          "-=0.2",
        );
    },
    { scope },
  );

  return (
    <div ref={scope} className="relative pt-2">
      <div className="relative mx-auto w-full max-w-[280px]">
        <ConfettiBurst />

        <div
          data-polaroid
          data-anim
          className="relative origin-center -rotate-[3deg] border border-ink bg-bone p-2.5 shadow-offset"
        >
          <div className="relative aspect-[4/3] overflow-hidden border border-ink/10 bg-ink/5">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-mono-label text-[10px] text-ink/40">
                  {symbol}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between px-1">
            <span className="font-mono-label text-[9px] text-ink/55">
              {symbol}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-ink/40">
              {shortHash(txDigest)}
            </span>
          </div>
        </div>

        <div
          data-stamp
          data-anim
          className="absolute -right-3 -top-3 rotate-[8deg] border border-ink bg-jade px-3 py-1.5 text-bone shadow-offset-sm"
        >
          <div className="font-mono-label text-[9px] leading-none">
            deployed
          </div>
          <div className="mt-0.5 font-mono-label text-[8px] leading-none opacity-75">
            sui · live
          </div>
        </div>
      </div>

      <div className="mt-7 space-y-2 text-center">
        <span
          data-eyebrow
          data-anim
          className="font-mono-label inline-block text-[10px] text-jade"
        >
          · project deployed ·
        </span>
        <h2 className="font-display text-3xl leading-tight md:text-4xl">
          <span
            data-marker
            className="inline-block bg-saffron px-2 py-0.5 text-ink"
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            {projectName}
          </span>
        </h2>
        <p data-meta data-anim className="font-mono text-[11px] text-ink/55">
          {ticker ? `${ticker} · ` : ""}admin cap returned to your wallet
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 divide-x divide-ink/15 border-y border-ink/15">
        <Stat label="Rate" value={rateText} />
        <Stat label="Allocation" value={allocText} />
        <Stat label="Ends" value={endsText} />
      </div>

      {coinType && (
        <div
          data-tx
          data-anim
          className="mt-4 flex items-center justify-between gap-2 border border-ink/15 bg-bone/60 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono-label text-[9px] text-ink/45">
              contract address
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-ink">
              {shortCA(coinType)}
            </div>
          </div>
          <button
            type="button"
            onClick={onCopyCA}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 border px-2.5",
              "font-mono-label text-[10px] transition-all duration-200 ease-out",
              copied === "ca"
                ? "border-jade bg-jade/10 text-jade"
                : "border-ink/25 text-ink/70 hover:-translate-y-[1px] hover:border-ink hover:text-ink hover:shadow-offset-sm",
            )}
            aria-label="Copy contract address"
          >
            {copied === "ca" ? (
              <>
                <CheckGlyph />
                <span>copied</span>
              </>
            ) : (
              <>
                <CopyGlyph />
                <span>copy</span>
              </>
            )}
          </button>
        </div>
      )}

      <div
        data-tx
        data-anim
        className="mt-3 flex items-center justify-center gap-2"
      >
        <span className="font-mono-label text-[10px] text-ink/55">tx</span>
        <TxHash value={txDigest} head={6} tail={4} />
      </div>

      {/* Vertical stack — primary CTA on top, "Share on X" full-width
          below as a secondary outlined action. Same layout the Claim
          success modal uses, so both success surfaces read consistently. */}
      <div className="mt-5 space-y-2">
        {onContinue && (
          <button
            data-cta
            data-anim
            type="button"
            onClick={onContinue}
            className={cn(
              "diecut flex h-10 w-full items-center justify-center gap-2 border border-ink bg-ink px-5",
              "font-mono-label text-[11px] text-bone shadow-offset-sm",
              "transition-all duration-200 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-offset",
              "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
            )}
          >
            <span>{continueLabel}</span>
            <ArrowDiag />
          </button>
        )}
        <a
          data-cta
          data-anim
          href={tweetHref}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 border border-ink/30 px-4",
            "font-mono-label text-[10px] text-ink/75 transition-colors",
            "hover:border-ink hover:text-ink",
          )}
        >
          <XGlyph />
          <span>share on x</span>
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div data-stat data-anim className="px-3 py-3 text-center">
      <div className="font-mono-label text-[9px] text-ink/45">{label}</div>
      <div className="mt-1 truncate font-mono text-[11px] tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

function shortHash(d: string): string {
  if (!d || d.length < 10) return d;
  return `${d.slice(0, 4)}…${d.slice(-3)}`;
}

/**
 * Format a Move coin type like `0xabc…::module::WITNESS`. We keep the module
 * and witness portions intact (those carry meaning) and truncate only the
 * package hex in the middle so the string stays scannable in a 280-char tweet.
 */
function shortCA(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length < 2) return coinType;
  const [pkg, ...rest] = parts;
  if (!pkg || pkg.length < 14) return coinType;
  return `${pkg.slice(0, 6)}…${pkg.slice(-4)}::${rest.join("::")}`;
}

function ConfettiBurst() {
  return (
    <svg
      data-confetti
      viewBox="0 0 220 160"
      className="pointer-events-none absolute -right-10 -top-10 z-10 h-32 w-44 overflow-visible"
      aria-hidden
    >
      <g
        fill="none"
        strokeWidth="1.4"
        strokeLinecap="round"
        transform="translate(150 35)"
      >
        <line x1="0" y1="-2" x2="0" y2="-22" className="stroke-saffron" />
        <line x1="14" y1="-14" x2="28" y2="-26" className="stroke-jade" />
        <line x1="20" y1="2" x2="38" y2="4" className="stroke-sky" />
        <line x1="16" y1="14" x2="32" y2="26" className="stroke-poppy" />
        <line x1="-4" y1="18" x2="-6" y2="34" className="stroke-sun" />
        <line x1="-18" y1="12" x2="-32" y2="22" className="stroke-saffron" />
        <line x1="-20" y1="-2" x2="-38" y2="-4" className="stroke-jade" />
        <line x1="-14" y1="-14" x2="-26" y2="-26" className="stroke-poppy" />
        <circle cx="32" cy="-12" r="1.6" className="fill-saffron" />
        <circle cx="-26" cy="14" r="1.6" className="fill-jade" />
        <circle cx="36" cy="18" r="1.4" className="fill-sky" />
      </g>
    </svg>
  );
}

function ArrowDiag() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="1.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2H21l-6.522 7.453L22 22h-6.844l-4.79-6.27L4.8 22H2.044l6.974-7.971L2 2h7.02l4.33 5.74L18.244 2Zm-2.4 18.4h1.5L7.24 3.5H5.66l10.184 16.9Z" />
    </svg>
  );
}
