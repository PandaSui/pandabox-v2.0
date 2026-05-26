"use client";

import Image from "next/image";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TxHash } from "@/components/identity/tx-hash";
import { explorerUrl } from "@/lib/sui";
import { formatAmount } from "@/lib/amount";

/**
 * Post-redeem celebration modal — sibling of `<ClaimSuccess>` and
 * `<DeploySuccess>`. Same creative language (polaroid + jade stamp +
 * confetti burst + saffron marker sweep + GSAP entrance), tuned for
 * the redeem story:
 *
 *   "I burned (or routed) N project tokens at the pool's fixed rate
 *    and received X SUI in return."
 *
 * The polaroid frames the *project token* that just left the holder's
 * wallet — that's the visible artifact of the trade. The stamp colors
 * + copy adapt to the pool's recipient mode (burn vs buyback) so a
 * crypto-native reads the trade type at a glance:
 *
 *   - burn    → poppy "BURNED" stamp; coins are gone forever
 *   - buyback → jade  "REDEEMED" stamp; coins routed back to treasury
 *
 * Headline + saffron marker live on the SUI amount — that's the reward,
 * the part the user actually cares about. Secondary mono row anchors
 * the numbers: tokens burned · pool rate · tx digest.
 */
export type RedeemSuccessProps = {
  ticker: string;
  /** Project coin's icon URL (optional — falls back to ticker text). */
  iconUrl?: string | null;
  /** Recipient mode for the pool — toggles stamp color + copy. */
  recipientMode: "burn" | "buyback";
  /** SUI received (mist) post-fee. */
  suiOutMist: bigint;
  /** Project coin sent in (base units). */
  coinIn: bigint;
  coinDecimals: number;
  txDigest: string;
  onAgain: () => void;
};

export function RedeemSuccess({
  ticker,
  iconUrl,
  recipientMode,
  suiOutMist,
  coinIn,
  coinDecimals,
  txDigest,
  onAgain,
}: RedeemSuccessProps) {
  const t = useTranslations("redeem.detail.redeemPanel");
  const scope = useRef<HTMLDivElement>(null);

  const tokensFormatted = `${formatAmount(coinIn, {
    decimals: coinDecimals,
    compact: true,
    maxFractionDigits: 4,
  })} ${ticker}`;

  const tweet = t("tweetText", {
    amount: tokensFormatted,
  });
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;

  const isBurn = recipientMode === "burn";

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
        rotate: -10,
        scale: 0.9,
        opacity: 0,
        duration: 0.65,
        ease: "back.out(1.4)",
      })
        .from(
          "[data-stamp]",
          {
            scale: 0.4,
            rotate: -36,
            opacity: 0,
            duration: 0.5,
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
        .from("[data-meta]", { y: 6, opacity: 0, duration: 0.35 }, "-=0.3")
        .from(
          "[data-stat]",
          { y: 10, opacity: 0, duration: 0.35, stagger: 0.07 },
          "-=0.2",
        )
        .from("[data-tx]", { y: 6, opacity: 0, duration: 0.3 }, "-=0.1")
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
      {/* Polaroid centered, slightly rotated — the metaphor is "snapshot
          of the asset that just left the wallet". */}
      <div className="relative mx-auto w-full max-w-[280px]">
        <ConfettiBurst />

        <div
          data-polaroid
          data-anim
          className="relative origin-center -rotate-[3deg] border border-ink bg-bone p-2.5 shadow-offset"
        >
          <div className="relative aspect-[4/3] overflow-hidden border border-ink/10 bg-ink/5">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-mono-label text-[10px] text-ink/40">
                  {ticker}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between px-1">
            <span className="font-mono-label text-[9px] text-ink/55">
              {ticker}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-ink/40">
              {shortHash(txDigest)}
            </span>
          </div>
        </div>

        {/* Stamp — color + copy adapt to the pool's recipient mode.
            Burn pools get poppy ("gone forever"); buyback pools get
            jade ("routed back to project treasury"). The two-line stamp
            keeps the typography readable even at the tilted angle. */}
        <div
          data-stamp
          data-anim
          className={cn(
            "absolute -right-3 -top-3 rotate-[8deg] border border-ink px-3 py-1.5 shadow-offset-sm",
            isBurn ? "bg-poppy" : "bg-jade",
            "text-bone",
          )}
        >
          <div className="font-mono-label text-[9px] leading-none">
            {isBurn ? t("stampBurned") : t("stampRedeemed")}
          </div>
          <div className="mt-0.5 font-mono-label text-[8px] leading-none opacity-75">
            {isBurn ? t("stampBurnedSub") : t("stampRedeemedSub")}
          </div>
        </div>
      </div>

      <div className="mt-7 space-y-2 text-center">
        <span
          data-eyebrow
          data-anim
          className="font-mono-label inline-block text-[10px] text-jade"
        >
          {t("successEyebrow")}
        </span>
        {/* Saffron marker sweep over the SUI amount — that's the reward
            the user came for. The amount uses `adaptive` so a dust-
            grade redeem (~95 mist) still surfaces visibly instead of
            rounding to "0.00". */}
        <h2 className="font-display text-3xl leading-tight md:text-4xl">
          <span
            data-marker
            className="inline-flex items-baseline gap-1.5 bg-saffron px-2 py-0.5 text-ink"
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            <SuiAmount
              mist={suiOutMist}
              adaptive
              maxFractionDigits={6}
              glyphSize={20}
              className="text-3xl md:text-4xl"
            />
          </span>
        </h2>
        <p data-meta data-anim className="font-mono text-[11px] text-ink/55">
          {t("successBody", { amount: tokensFormatted })}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 divide-x divide-ink/15 border-y border-ink/15">
        <Stat label={t("statBurned")} value={tokensFormatted} accent />
        <Stat label={t("statRouted")} value={isBurn ? t("routedBurn") : t("routedBuyback")} mute />
      </div>

      <div
        data-tx
        data-anim
        className="mt-4 flex items-center justify-center gap-2"
      >
        <span className="font-mono-label text-[10px] text-ink/55">
          {t("txLabel")}
        </span>
        <TxHash value={txDigest} head={6} tail={4} />
      </div>

      {/* Stack the CTAs vertically and pull each to the modal's full
          width — matches the Claim + Deploy success modal layout. */}
      <div className="mt-5 space-y-2">
        <button
          data-cta
          data-anim
          type="button"
          onClick={onAgain}
          className={cn(
            "diecut flex h-10 w-full items-center justify-center gap-2 border border-ink bg-ink px-5",
            "font-mono-label text-[11px] text-bone shadow-offset-sm",
            "transition-all duration-200 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-offset",
            "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm",
          )}
        >
          <span>{t("successAgain")}</span>
          <ArrowDiag />
        </button>
        <a
          data-cta
          data-anim
          href={explorerUrl("tx", txDigest)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 border border-ink/30 px-4",
            "font-mono-label text-[10px] text-ink/75 transition-colors",
            "hover:border-ink hover:text-ink",
          )}
        >
          <span>{t("viewOnSuiscan")}</span>
          <span aria-hidden>↗</span>
        </a>
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
          <span>{t("shareOnX")}</span>
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────── Subviews ─────────────────────────── */

function Stat({
  label,
  value,
  accent,
  mute,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mute?: boolean;
}) {
  return (
    <div data-stat data-anim className="px-4 py-3 text-center">
      <span className="font-mono-label text-[9.5px] text-ink/55">{label}</span>
      <div
        className={cn(
          "mt-1 font-mono text-[13px] tabular-nums",
          accent && "text-ink",
          mute && "text-ink/65",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function shortHash(d: string): string {
  if (!d || d.length < 10) return d;
  return `${d.slice(0, 4)}…${d.slice(-3)}`;
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

// `Image` from next/image is imported in case future revisions want to
// swap the polaroid's <img> tag for next-optimized loading. Marked here
// so the import doesn't get tree-shaken by the linter.
void Image;
