"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { explorerUrl } from "@/lib/sui";

type Socials = {
  website?: string;
  twitter?: string;
  discord?: string;
};

/**
 * On-chain record — the "spec sheet" footer card on the project detail page.
 * Wraps the project's object id, coin type, deployment timestamp, and
 * outbound links in a single bone-paper card with glyph-led cells. Address
 * values copy on click; explorer links open in a new tab; social links render
 * as branded chips.
 *
 * Motion: a scroll-triggered mount timeline reveals the card, paints the
 * accent rule, and staggers the cells. Each cell has a quiet hover lift,
 * and the copy buttons swap glyph + label on success.
 */
export function OnchainRecord({
  projectId,
  tokenType,
  createdAtMs,
  socials = {},
}: {
  projectId: string;
  tokenType?: string;
  createdAtMs?: number;
  socials?: Socials;
}) {
  const scope = useRef<HTMLElement>(null);
  const t = useTranslations("project.detail.onchain");

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      const card = root.querySelector<HTMLElement>("[data-card]");
      const accentBar = root.querySelector<HTMLElement>("[data-accent-bar]");
      const cells = root.querySelectorAll<HTMLElement>("[data-cell]");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        defaults: { ease: "power3.out" },
      });

      if (card) tl.from(card, { y: 24, opacity: 0, duration: 0.7 }, 0);
      if (accentBar) {
        tl.from(
          accentBar,
          { scaleX: 0, duration: 0.55, ease: "power3.out" },
          0.15,
        );
      }
      if (cells.length) {
        tl.from(
          cells,
          {
            y: 14,
            opacity: 0,
            duration: 0.55,
            stagger: 0.08,
            ease: "power3.out",
          },
          0.2,
        );
      }
    },
    { scope },
  );

  const hasLinks =
    !!socials.website || !!socials.twitter || !!socials.discord;

  return (
    <section
      ref={scope}
      aria-label={t("title")}
      className="container relative"
    >
      <div
        data-card
        className="relative overflow-hidden border border-ink bg-bone shadow-offset-sm"
      >
        {/* Header band — "Spec sheet" eyebrow + mainnet badge */}
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/15 px-5 py-3 md:px-6">
          <div className="inline-flex items-center gap-3">
            <span
              data-accent-bar
              aria-hidden
              className="block h-1 w-10 origin-left bg-saffron"
            />
            <MonoLabel className="text-[10px]">{t("title")}</MonoLabel>
            <span aria-hidden className="hidden text-ink/15 md:inline">·</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40 md:inline">
              {t("specSheet")}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-jade"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            {t("suiMainnet")}
          </span>
        </header>

        {/* 4-col cells on desktop, 2x2 on tablet, stacked on mobile.
            Hairline dividers between cells. */}
        <div className="grid grid-cols-1 divide-y divide-ink/10 md:grid-cols-2 md:divide-y-0 md:[&>*]:border-b md:[&>*]:border-ink/10 md:[&>*:nth-last-child(-n+2)]:border-b-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0 lg:[&>*]:border-b-0">
          <Cell
            glyph={<GlyphObject />}
            label={t("projectObject")}
            footnote={t("sharedObject")}
          >
            <CopyableHash
              value={projectId}
              displayHead={6}
              displayTail={6}
              explorerHref={explorerUrl("object", projectId)}
            />
          </Cell>

          <Cell
            glyph={<GlyphCoin />}
            label={t("coinType")}
            footnote={t("contractAddress")}
          >
            {tokenType ? (
              <CopyableHash
                value={tokenType}
                displayHead={10}
                displayTail={10}
                explorerHref={
                  tokenType.includes("::")
                    ? explorerUrl("object", tokenType.split("::")[0]!)
                    : undefined
                }
                isCoinType
              />
            ) : (
              <span className="font-mono text-[12px] text-ink/35">—</span>
            )}
          </Cell>

          <Cell
            glyph={<GlyphClock />}
            label={t("deployed")}
            footnote={createdAtMs ? relativeFrom(createdAtMs, t) : undefined}
          >
            <DeployedReadout ms={createdAtMs} />
          </Cell>

          <Cell glyph={<GlyphLinks />} label={t("links")} footnote={t("social")}>
            {hasLinks ? (
              <div className="flex flex-wrap gap-1.5">
                {socials.website && (
                  <LinkChip
                    href={ensureHttp(socials.website)}
                    label={t("site")}
                    icon={<GlyphGlobe />}
                  />
                )}
                {socials.twitter && (
                  <LinkChip
                    href={`https://x.com/${socials.twitter.replace(/^@/, "")}`}
                    label={socials.twitter.replace(/^@/, "")}
                    icon={<GlyphX />}
                  />
                )}
                {socials.discord && (
                  <LinkChip
                    href={socials.discord}
                    label={t("discord")}
                    icon={<GlyphDiscord />}
                  />
                )}
              </div>
            ) : (
              <span className="font-mono text-[12px] text-ink/35">
                {t("noneProvided")}
              </span>
            )}
          </Cell>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── Cell ────────────────────────────── */

function Cell({
  glyph,
  label,
  footnote,
  children,
}: {
  glyph: React.ReactNode;
  label: string;
  footnote?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-cell
      className="group relative flex flex-col gap-3 px-5 py-5 transition-colors duration-300 ease-atelier hover:bg-ink/[0.02] md:px-6 md:py-6"
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center border border-ink/20 bg-bone text-ink/70 transition-colors duration-300 group-hover:border-ink group-hover:text-ink">
          {glyph}
        </span>
        <div className="flex flex-col">
          <MonoLabel className="text-[10px]">{label}</MonoLabel>
          {footnote && (
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/35">
              {footnote}
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ─────────────────────────── Copyable hash ──────────────────────── */

function CopyableHash({
  value,
  displayHead,
  displayTail,
  explorerHref,
  isCoinType = false,
}: {
  value: string;
  displayHead: number;
  displayTail: number;
  explorerHref?: string;
  isCoinType?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("project.detail.onchain");

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  // For coin types we render `0x12…34::module::WITNESS` so the suffix stays
  // legible; for raw object ids we just truncate the middle.
  const displayed = isCoinType
    ? truncateCoinType(value, displayHead, displayTail)
    : truncateMiddle(value, displayHead, displayTail);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <code className="block break-all font-mono text-[12.5px] tabular-nums text-ink">
        {displayed}
      </code>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCopy}
          aria-label={t("copyAria")}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 border px-2",
            "font-mono-label text-[10px] transition-all duration-200 ease-atelier",
            copied
              ? "border-jade bg-jade/10 text-jade"
              : "border-ink/25 text-ink/70 hover:-translate-y-[1px] hover:border-ink hover:text-ink hover:shadow-offset-sm",
          )}
        >
          {copied ? <GlyphCheck /> : <GlyphCopy />}
          <span>{copied ? t("copied") : t("copy")}</span>
        </button>
        {explorerHref && (
          <a
            href={explorerHref}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "group/link inline-flex h-7 items-center gap-1.5 border border-ink/25 px-2",
              "font-mono-label text-[10px] text-ink/70 transition-all duration-200 ease-atelier",
              "hover:-translate-y-[1px] hover:border-ink hover:text-ink hover:shadow-offset-sm",
            )}
          >
            <GlyphArrow />
            <span>{t("explorer")}</span>
          </a>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── Deployed readout ────────────────────── */

function DeployedReadout({ ms }: { ms?: number }) {
  const t = useTranslations("project.detail.onchain");
  if (!ms) {
    return <span className="font-mono text-[12px] text-ink/35">—</span>;
  }
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const time = d
    .toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })
    .toUpperCase();
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[13px] tabular-nums text-ink">
        {date.toUpperCase()}
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-ink/55">
        {time} UTC · {relativeFrom(ms, t)}
      </span>
    </div>
  );
}

/* ────────────────────────── Link chip ───────────────────────────── */

function LinkChip({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group/chip inline-flex h-8 max-w-full items-center gap-1.5 border border-ink/25 bg-bone px-2.5",
        "font-mono text-[11px] tabular-nums text-ink/75",
        "transition-all duration-200 ease-atelier",
        "hover:-translate-y-[1px] hover:border-ink hover:text-ink hover:shadow-offset-sm",
      )}
    >
      <span className="inline-flex shrink-0 text-ink/55 transition-colors group-hover/chip:text-ink">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </a>
  );
}

/* ────────────────────────── Glyphs ──────────────────────────────── */

function GlyphObject() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <polygon
        points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <line x1="2" y1="4.5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.1" />
      <line x1="14" y1="4.5" x2="8" y2="8" stroke="currentColor" strokeWidth="1.1" />
      <line x1="8" y1="8" x2="8" y2="15" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function GlyphCoin() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 5.5 L10.5 10.5 M5.5 10.5 L10.5 5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function GlyphClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5 L8 8 L10.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphLinks() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M7 9 L5 11 a2.5 2.5 0 1 1-3.5-3.5 L3.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 7 L11 5 a2.5 2.5 0 1 1 3.5 3.5 L12.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 10 L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function GlyphCopy() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="9" height="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 11 L3 3 L11 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GlyphCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8 L7 12 L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphArrow() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5 11 L11 5 M6 5 H11 V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphGlobe() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 8 H14" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 2 a8 8 0 0 1 0 12 a8 8 0 0 1 0-12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function GlyphX() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2H21l-6.522 7.453L22 22h-6.844l-4.79-6.27L4.8 22H2.044l6.974-7.971L2 2h7.02l4.33 5.74L18.244 2Zm-2.4 18.4h1.5L7.24 3.5H5.66l10.184 16.9Z" />
    </svg>
  );
}

function GlyphDiscord() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5.5 6 a6 6 0 0 1 5 0 M3.5 4 c1.5-0.5 4-1 4.5-1 s3 0.5 4.5 1 c1 2 1.5 5 1.5 7 c-1 1-2 1.5-3 1.5 l-0.5-1 a3 3 0 0 0-5 0 l-0.5 1 c-1 0-2-0.5-3-1.5 c0-2 0.5-5 1.5-7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="6" cy="9" r="0.9" fill="currentColor" />
      <circle cx="10" cy="9" r="0.9" fill="currentColor" />
    </svg>
  );
}

/* ────────────────────────── Helpers ─────────────────────────────── */

function truncateMiddle(s: string, head: number, tail: number): string {
  if (!s) return "—";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function truncateCoinType(s: string, head: number, tail: number): string {
  if (!s) return "—";
  const idx = s.indexOf("::");
  if (idx === -1) return truncateMiddle(s, head, tail);
  const pkg = s.slice(0, idx);
  const rest = s.slice(idx);
  if (pkg.length <= head + tail + 1) return s;
  return `${pkg.slice(0, head)}…${pkg.slice(-tail)}${rest}`;
}

function relativeFrom(
  ms: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const diff = Date.now() - ms;
  if (diff < 0) return t("justNow");
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return t("agoSeconds", { n: secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("agoMinutes", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("agoHours", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("agoDays", { n: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t("agoMonths", { n: months });
  return t("agoYears", { n: Math.floor(months / 12) });
}

function ensureHttp(s: string): string {
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}
