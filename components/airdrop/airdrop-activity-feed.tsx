"use client";

import { useMemo, useState, useTransition } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { Address } from "@/components/identity/address";
import { RelativeTime } from "@/components/identity/relative-time";
import { TxHash } from "@/components/identity/tx-hash";
import { Spinner } from "@/components/primitives/spinner";
import { formatAmount } from "@/lib/amount";
import { SuiAmount } from "@/components/identity/sui-amount";
import { RevealOnView } from "@/components/motion/reveal-on-view";
import { fromWire, type AirdroppedEvent, type EventPageCursor } from "@/lib/airdrop";
import { loadMoreAirdrops } from "@/lib/server-actions/airdrop-load-more";

type CoinMetaLite = {
  symbol: string | null;
  decimals: number;
};

/**
 * Cross-platform recent-airdrop feed. The page server-fetches the latest
 * N `Airdropped` events + a `CoinMetadata` map keyed by `coinType` and
 * hands both to this component; the component owns the (client-only)
 * "All / Yours" tab toggle and renders the rows.
 *
 * "Yours" filters by `event.caller === currentAccount.address`; gated to
 * a hint banner when the wallet isn't connected, since otherwise the
 * empty state would read as a broken fetch.
 *
 * Each row is a dense mono record with:
 *
 *   ┌─ # ── caller ─ coin ─ recipients · total · fee · memo ─── time + tx ─┐
 *
 * No diecut chrome — hairline dividers between rows, mono numerics
 * throughout, poppy accent on the airdrop count chip. Rows enter on a
 * 40 ms IntersectionObserver-triggered stagger via `<RevealOnView>`.
 */
export function AirdropActivityFeed({
  items: initialItems,
  metadata: initialMetadata = {},
  initialCursor = null,
  initialHasNextPage = false,
}: {
  items: AirdroppedEvent[];
  metadata?: Record<string, CoinMetaLite>;
  /** First-page `nextCursor` for the "Load more" CTA. */
  initialCursor?: EventPageCursor | null;
  initialHasNextPage?: boolean;
}) {
  const t = useTranslations("airdrop");
  const account = useCurrentAccount();
  const [tab, setTab] = useState<"all" | "yours">("all");

  // Pagination state. The page server-renders the first 30 events; from
  // there, this component owns the growing list + cursor + has-next flag
  // through React state. Each "Load more" hit appends to `items` and
  // extends `metadata` so the rows mounted from the first page don't
  // re-render.
  const [items, setItems] = useState<AirdroppedEvent[]>(initialItems);
  const [metadata, setMetadata] =
    useState<Record<string, CoinMetaLite>>(initialMetadata);
  const [cursor, setCursor] = useState<EventPageCursor | null>(
    initialCursor,
  );
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onLoadMore = () => {
    if (!hasNextPage || isPending) return;
    setLoadError(null);
    startTransition(async () => {
      try {
        const next = await loadMoreAirdrops(cursor);
        const lifted = next.items.map(fromWire);
        setItems((prev) => [...prev, ...lifted]);
        setMetadata((prev) => ({ ...prev, ...next.metadata }));
        setCursor(next.nextCursor);
        setHasNextPage(next.hasNextPage);
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : "Couldn't load more — try again in a moment.",
        );
      }
    });
  };

  const filtered = useMemo(() => {
    if (tab === "all" || !account?.address) return items;
    const needle = account.address.toLowerCase();
    return items.filter((e) => e.caller.toLowerCase() === needle);
  }, [items, tab, account?.address]);

  // Count for the "Yours" pill, even when the tab isn't active — gives the
  // user a quick "have I done this yet?" read without clicking through.
  const yoursCount = useMemo(() => {
    if (!account?.address) return null;
    const needle = account.address.toLowerCase();
    return items.filter((e) => e.caller.toLowerCase() === needle).length;
  }, [items, account?.address]);

  return (
    <section aria-label={t("activityTitle")}>
      <header className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-poppy">
            {t("activityEyebrow")}
          </p>
          <h2 className="mt-1.5 text-balance text-2xl leading-[1.05] md:text-3xl">
            {t("activityTitle")}
          </h2>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          allCount={items.length}
          yoursCount={yoursCount}
          walletConnected={Boolean(account?.address)}
          allLabel="All"
          yoursLabel="Yours"
        />
      </header>

      {filtered.length === 0 ? (
        <EmptyState tab={tab} walletConnected={Boolean(account?.address)} />
      ) : (
        <ol className="divide-y divide-ink/10 border border-ink/15 bg-bone">
          {filtered.map((ev, i) => (
            <RevealOnView
              key={`${ev.txDigest}-${ev.airdropNumber}`}
              as="li"
              // Cap the stagger at 12 rows worth so a long feed doesn't
              // make the last row's entrance wait half a second. Beyond
              // that, fade in immediately.
              delayMs={Math.min(i, 12) * 40}
              className="block"
            >
              <Row ev={ev} meta={metadata[ev.coinType] ?? null} />
            </RevealOnView>
          ))}
        </ol>
      )}

      {/* Footer band: load-more button on the left, source note on the
          right. Centred when no more pages are available. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {hasNextPage && tab === "all" ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isPending}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 border border-ink/25 bg-bone px-4",
              "font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/75 transition-colors",
              "hover:border-ink/55 hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isPending ? (
              <>
                <Spinner size={10} className="text-ink/55" />
                <span>Loading older airdrops…</span>
              </>
            ) : (
              <span>Load 30 more</span>
            )}
          </button>
        ) : (
          <span aria-hidden />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
          Live from Sui mainnet · {filtered.length} of {items.length} shown
        </p>
      </div>
      {loadError ? (
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-poppy">
          {loadError}
        </p>
      ) : null}
    </section>
  );
}

/* ─────────────────────────── tabs ─────────────────────────── */

function Tabs({
  value,
  onChange,
  allCount,
  yoursCount,
  walletConnected,
  allLabel,
  yoursLabel,
}: {
  value: "all" | "yours";
  onChange: (v: "all" | "yours") => void;
  allCount: number;
  yoursCount: number | null;
  walletConnected: boolean;
  allLabel: string;
  yoursLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Activity filter"
      className="inline-flex border border-ink/20 bg-bone"
    >
      <TabButton
        active={value === "all"}
        onClick={() => onChange("all")}
        label={allLabel}
        count={allCount}
      />
      <TabButton
        active={value === "yours"}
        onClick={() => onChange("yours")}
        label={yoursLabel}
        count={yoursCount}
        disabled={!walletConnected}
        title={
          walletConnected
            ? `${yoursCount ?? 0} airdrops signed from this wallet`
            : "Connect a wallet to filter to your airdrops"
        }
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | null;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "relative inline-flex items-center gap-2 px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors",
        active
          ? "bg-ink text-bone"
          : "text-ink/65 hover:text-ink",
        disabled && "cursor-not-allowed opacity-40 hover:text-ink/65",
      )}
    >
      <span>{label}</span>
      {count !== null ? (
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            active ? "text-bone/80" : "text-ink/45",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* ─────────────────────────── row ─────────────────────────── */

function Row({
  ev,
  meta,
}: {
  ev: AirdroppedEvent;
  meta: CoinMetaLite | null;
}) {
  const decimals = meta?.decimals ?? 0;
  const symbol =
    meta?.symbol ?? synthSymbol(ev.coinType);
  // Only label the unit as "u" (raw u64) when we couldn't resolve a
  // symbol — otherwise the symbol carries the unit and "u" reads as
  // duplication.
  const unitLabel = meta?.symbol ? symbol : "u";
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-ink/[0.02] md:grid-cols-[80px_1.4fr_1.4fr_auto] md:items-center">
      {/* Sequence chip — the global airdrop number, padded so columns
          line up regardless of magnitude. Reads as a serial number. */}
      <div className="inline-flex shrink-0 items-center gap-2">
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full bg-poppy"
        />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          #{String(ev.airdropNumber).padStart(4, "0")}
        </span>
      </div>

      {/* Actor + coin column */}
      <div className="flex min-w-0 flex-col gap-1">
        <Address value={ev.caller} className="text-ink/75" copyable={false} />
        <CoinTag coinType={ev.coinType} symbol={symbol} />
      </div>

      {/* Numbers column — recipients · total · fee · optional memo */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] tabular-nums text-ink/75">
        <span className="text-ink">
          {ev.recipientCount.toLocaleString()}{" "}
          <span className="text-ink/45">recip</span>
        </span>
        <span className="text-ink/25">·</span>
        <span className="text-ink/65">
          {formatAmount(ev.totalAmountRaw, {
            decimals,
            maxFractionDigits: meta?.symbol ? 2 : 0,
            compact: true,
          })}{" "}
          <span className="text-ink/45">{unitLabel}</span>
        </span>
        <span className="text-ink/25">·</span>
        <span className="inline-flex items-baseline gap-1 text-ink/65">
          <SuiAmount
            mist={ev.feeMist}
            adaptive
            maxFractionDigits={4}
            glyphSize={10}
            className="text-[11.5px] text-ink/75"
          />
          <span className="text-ink/45">fee</span>
        </span>
        {ev.memo ? (
          <>
            <span className="text-ink/25">·</span>
            <span
              className="max-w-[18ch] truncate font-mono text-[11px] text-ink/55"
              title={ev.memo}
            >
              "{ev.memo}"
            </span>
          </>
        ) : null}
      </div>

      {/* Time + tx hash — right-aligned on wide, stacked on narrow */}
      <div className="flex flex-wrap items-center gap-2.5 font-mono text-[10.5px] text-ink/45 md:justify-end">
        <RelativeTime
          value={ev.timestampMs}
          className="whitespace-nowrap"
        />
        <TxHash value={ev.txDigest} copyable={false} head={4} tail={4} />
      </div>
    </div>
  );
}

function synthSymbol(coinType: string): string {
  const tail = coinType.split("::").pop() ?? "";
  return tail.toUpperCase().slice(0, 8) || "?";
}

function CoinTag({
  coinType,
  symbol,
}: {
  coinType: string;
  symbol: string;
}) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 border border-ink/15 bg-ink/[0.02] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/65"
      title={coinType}
    >
      <span aria-hidden className="block h-1 w-1 bg-jade" />
      {symbol}
    </span>
  );
}

/* ─────────────────────────── empty ─────────────────────────── */

function EmptyState({
  tab,
  walletConnected,
}: {
  tab: "all" | "yours";
  walletConnected: boolean;
}) {
  const t = useTranslations("airdrop");
  return (
    <div className="border border-dashed border-ink/20 bg-ink/[0.015] px-6 py-14 text-center">
      <EmptyGlyph />
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
        {tab === "yours" && walletConnected
          ? "No airdrops from this wallet yet."
          : tab === "yours"
            ? "Connect a wallet to filter to yours."
            : t("activityEmpty")}
      </p>
      {tab === "all" ? (
        <p className="mt-1.5 text-[13px] text-ink/55">
          Yours could be the first one indexed.
        </p>
      ) : null}
    </div>
  );
}

function EmptyGlyph() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.4"
      strokeWidth="1.2"
      className="mx-auto text-ink"
      aria-hidden
    >
      <circle cx="10" cy="10" r="2.4" />
      <circle cx="26" cy="14" r="1.8" />
      <circle cx="22" cy="26" r="1.8" />
      <circle cx="12" cy="24" r="1.8" />
      <path
        d="M10 10 L26 14 M10 10 L22 26 M10 10 L12 24"
        strokeDasharray="2 3"
      />
    </svg>
  );
}
