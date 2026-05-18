"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import BigNumber from "bignumber.js";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { useWizard } from "@/lib/store/wizard";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { Address } from "@/components/identity/address";
import { PROJECT_COIN_DECIMALS } from "@/lib/contracts/pandabox";
import type { Accent, Category } from "@/types/pandabox";

const DEBOUNCE_MS = 250;

const CATEGORY_ACCENT: Record<Category, Accent> = {
  art: "saffron",
  infra: "poppy",
  dao: "jade",
  research: "sky",
  gaming: "sun",
  music: "plum",
  social: "jade",
  rwa: "sky",
};
const ACCENT_TEXT: Record<Accent, string> = {
  saffron: "text-saffron",
  poppy: "text-poppy",
  jade: "text-jade",
  sky: "text-sky",
  sun: "text-sun",
  plum: "text-plum",
};

/**
 * Wizard live preview — purpose-built for the v2 sale contract. Renders the
 * draft fields the way they'll surface on the real project page once deployed.
 *
 * Differences from the old preview:
 *   - No cycle / reserved-rate / cash-out / payout-limit stats (don't exist
 *     on-chain).
 *   - Shows base rate, allocation, target raise, end window, unsold action.
 *   - "Back this project" CTA is borderless + modern; clicking it advances
 *     the wizard to the deploy step (the right rail isn't a real project
 *     page, so an in-place pay panel doesn't exist).
 */
export function PreviewPane({ className }: { className?: string }) {
  const draft = useWizard((s) => s.draft);
  const setStep = useWizard((s) => s.setStep);
  const [snapshot, setSnapshot] = useState<typeof draft | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSnapshot(draft), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft]);

  if (!snapshot) {
    return (
      <div className={className}>
        <PreviewHeader />
        <div className="border border-ink/15 p-6 text-sm text-ink/55">
          Building preview…
        </div>
      </div>
    );
  }

  const category = (snapshot.identity.category ?? "art") as Category;
  const accent = CATEGORY_ACCENT[category];
  const name = snapshot.identity.name?.trim() || "Untitled project";
  const tagline =
    snapshot.identity.tagline?.trim() ||
    "Your tagline appears here once you fill it in.";
  const ticker =
    snapshot.coin.coinSymbol?.trim() ||
    snapshot.identity.ticker?.trim() ||
    "TOK";
  const cover = snapshot.identity.coverImage || "/panda-logo.webp";
  const creator = "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Derived sale numbers.
  const tokensPerSui = safeBN(snapshot.sale.tokensPerSui);
  const allocation = safeBN(snapshot.sale.allocationTokens);
  const targetSui = tokensPerSui.isZero() ? null : allocation.dividedBy(tokensPerSui);
  const endMs = snapshot.sale.endTimeMs ?? null;
  const unsoldAction = snapshot.sale.unsoldAction ?? "burn";

  return (
    <div className={className}>
      <PreviewHeader />

      <article className="overflow-hidden border border-ink/15 bg-bone shadow-offset-sm">
        {/* Cover band — short banner crop so the whole preview fits in the
            sticky rail without internal scrolling on common viewport heights.
            object-cover keeps the artwork centred regardless of source ratio. */}
        <div className="relative h-40 w-full bg-paper md:h-48">
          <Image
            src={cover}
            alt={`${name} cover preview`}
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
          {/* Category badge over the cover, top-left */}
          <span
            className={cn(
              "absolute left-4 top-4 inline-flex items-center gap-1.5 border border-ink bg-bone/95 px-2.5 py-1 font-mono-label text-[10px] shadow-offset-sm",
              ACCENT_TEXT[accent],
            )}
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-current" />
            {category}
          </span>
          {/* Ticker pill, top-right */}
          <span className="absolute right-4 top-4 inline-flex items-center border border-ink bg-bone/95 px-2.5 py-1 font-mono text-[11px] shadow-offset-sm">
            {ticker}
          </span>
        </div>

        {/* Headline + tagline */}
        <header className="border-b border-ink/15 px-5 py-5 md:px-6 md:py-6">
          <h2 className="font-display text-3xl leading-[1.05] md:text-4xl">
            {name}
          </h2>
          <p className="mt-2 max-w-prose text-[14.5px] text-ink/65">{tagline}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink/50">creator</span>
            <Address value={creator} link={false} />
            {snapshot.coin.coinType && (
              <>
                <span className="text-ink/20">·</span>
                <span className="text-ink/50">coin</span>
                <code className="font-mono text-[11px] text-ink/70">
                  {shortMid(snapshot.coin.coinType)}
                </code>
              </>
            )}
          </div>
        </header>

        {/* Sale-state strip — the four numbers a supporter actually cares about */}
        <div className="grid grid-cols-2 border-b border-ink/15 md:grid-cols-4">
          <Cell label="Target raise" emphasis>
            {targetSui ? (
              <Marker color="saffron">
                <span className="font-mono tabular-nums text-xl md:text-2xl">
                  {targetSui.toFormat(0, BigNumber.ROUND_DOWN)}
                </span>
              </Marker>
            ) : (
              <span className="font-mono tabular-nums text-xl text-ink/40">
                —
              </span>
            )}
            <span className="ml-1 font-mono-label text-[10px] text-ink/55">
              SUI
            </span>
          </Cell>
          <Cell label="Allocation" border>
            <span className="font-mono tabular-nums text-lg md:text-xl">
              {compactNumber(allocation)}
            </span>
            <span className="ml-1 font-mono-label text-[10px] text-ink/55">
              {ticker}
            </span>
          </Cell>
          <Cell label="Rate" border>
            <span className="font-mono tabular-nums text-lg md:text-xl">
              {compactNumber(tokensPerSui)}
            </span>
            <span className="ml-1 font-mono-label text-[10px] text-ink/55">
              /SUI
            </span>
          </Cell>
          <Cell label="Ends" border>
            {endMs == null ? (
              <span className="font-mono text-sm text-ink/60">no time cap</span>
            ) : (
              <Countdown endMs={endMs} />
            )}
          </Cell>
        </div>

        {/* CTA — borderless ink-fill, modern chrome. In the wizard preview a
            "real" pay panel doesn't exist, so clicking advances to the
            deploy step instead. */}
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-5 py-4 md:px-6">
          <button
            type="button"
            onClick={() => setStep(4)}
            className={cn(
              "group relative inline-flex items-center justify-center gap-2 px-6 py-3 font-medium uppercase tracking-[0.12em] text-[0.78rem]",
              "bg-ink text-bone",
              "transition-all duration-300 ease-atelier",
              "hover:-translate-y-[1px] hover:bg-ink-90",
              "active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
            )}
          >
            <span>Back this project</span>
            <ArrowDiag
              size={14}
              className="transition-transform duration-300 group-hover:translate-x-[2px]"
            />
          </button>
          <div className="hidden text-right md:block">
            <div className="font-mono-label text-[10px] text-ink/45">
              status
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-ink/70">
              draft preview
            </div>
          </div>
        </div>

        {/* Spec strip — every contract-relevant field, dense */}
        <dl className="grid grid-cols-2 md:grid-cols-4">
          <SpecCell k="base_rate" v={describeBaseRate(tokensPerSui, ticker)} />
          <SpecCell
            k="allocation"
            v={`${compactNumber(allocation)} ${ticker}`}
            border
          />
          <SpecCell
            k="unsold"
            v={unsoldAction === "transfer_to_creator" ? "→ creator" : "burn"}
            border
          />
          <SpecCell
            k="decimals"
            v={String(snapshot.coin.coinDecimals ?? PROJECT_COIN_DECIMALS)}
            border
          />
        </dl>
      </article>
    </div>
  );
}

function PreviewHeader() {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <MonoLabel>Live preview</MonoLabel>
      <span className="font-mono-label text-[10px] text-ink/40">
        what supporters see
      </span>
    </div>
  );
}

function Cell({
  label,
  children,
  border = false,
  emphasis = false,
}: {
  label: string;
  children: React.ReactNode;
  border?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 md:p-5",
        border && "border-l border-ink/15",
        emphasis && "bg-bone/40",
      )}
    >
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-2 flex items-baseline">{children}</div>
    </div>
  );
}

function SpecCell({
  k,
  v,
  border = false,
}: {
  k: string;
  v: string;
  border?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3 md:px-5", border && "border-l border-ink/15")}>
      <span className="font-mono-label text-[10px] text-ink/50 block">{k}</span>
      <div className="mt-1 font-mono tabular-nums text-[12.5px] text-ink/80">
        {v}
      </div>
    </div>
  );
}

function Countdown({ endMs }: { endMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, endMs - now);
  if (ms === 0) return <span className="font-mono text-sm text-poppy">ended</span>;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span className="font-mono tabular-nums text-lg md:text-xl">
      {days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`}
    </span>
  );
}

function safeBN(s: string | undefined | null): BigNumber {
  if (!s) return new BigNumber(0);
  const n = new BigNumber(s);
  return n.isFinite() ? n : new BigNumber(0);
}

function compactNumber(n: BigNumber): string {
  if (n.isZero()) return "0";
  if (n.gte(1_000_000_000)) return `${n.dividedBy(1_000_000_000).toFormat(1, BigNumber.ROUND_DOWN)}B`;
  if (n.gte(1_000_000)) return `${n.dividedBy(1_000_000).toFormat(1, BigNumber.ROUND_DOWN)}M`;
  if (n.gte(1_000)) return `${n.dividedBy(1_000).toFormat(1, BigNumber.ROUND_DOWN)}K`;
  return n.toFormat(0, BigNumber.ROUND_DOWN);
}

function describeBaseRate(rate: BigNumber, ticker: string): string {
  if (rate.isZero()) return "—";
  return `${compactNumber(rate)} ${ticker} / SUI`;
}

function shortMid(s: string): string {
  if (s.length <= 24) return s;
  return `${s.slice(0, 12)}…${s.slice(-8)}`;
}
