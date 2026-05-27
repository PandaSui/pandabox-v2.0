"use client";

import { useMemo, useState } from "react";
import { cn } from "@pandasui/ui/lib";
import { formatAmount } from "@/lib/amount";
import { useOwnedCoinGroups } from "@/lib/airdrop/use-owned-coins";
import type { OwnedCoinGroup } from "@/lib/airdrop";

/**
 * Asset-rail coin picker. Reads as a wallet's holdings row — horizontal
 * scroll of compact pills, each one showing icon + symbol + spendable
 * balance. The active pill carries a poppy underline + offset shadow;
 * no diecut, no rounded chrome.
 *
 * Above the rail: a text filter for wallets with > a handful of assets.
 * Below the rail: a single-line detail strip showing the resolved
 * `CoinMetadata` fields (name, decimals, type tag) — gives the user a
 * way to verify they picked the right asset before composing a list.
 *
 * Empty / disconnected states are handled in-place: the picker collapses
 * to a one-line hint that links into the wallet connection flow rather
 * than trying to mimic the wallet button.
 */
export function CoinTypePicker({
  selectedCoinType,
  onSelect,
}: {
  selectedCoinType: string;
  onSelect: (coinType: string) => void;
}) {
  const { groups, isLoading, address } = useOwnedCoinGroups();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return groups;
    const needle = filter.toLowerCase();
    return groups.filter((g) => {
      const haystack = [
        g.symbol ?? "",
        g.name ?? "",
        g.coinType,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [groups, filter]);

  const selected = useMemo(
    () => groups.find((g) => g.coinType === selectedCoinType) ?? null,
    [groups, selectedCoinType],
  );

  return (
    <div className="space-y-3">
      {/* Header band: filter input on the left, status pill on the right.
          Stacks vertically below sm so the two don't fight for space on
          narrow phone widths (the search input was hitting < 200px and
          becoming hard to read). */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Filter coin types</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search your assets…"
            disabled={!address}
            className={cn(
              "w-full border border-ink/15 bg-bone px-3 py-2 pl-7",
              "font-mono text-[12px] tracking-[0.04em] text-ink placeholder:text-ink/40",
              "focus:border-ink/55 focus:outline-none focus:ring-0",
              "disabled:cursor-not-allowed disabled:bg-ink/[0.02] disabled:opacity-60",
            )}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 block h-3 w-3 -translate-y-1/2"
          >
            <SearchGlyph />
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
          <span aria-hidden className="block h-1 w-1 bg-poppy" />
          <span>
            {address
              ? `${groups.length} asset${groups.length === 1 ? "" : "s"}`
              : "Wallet not connected"}
          </span>
        </div>
      </div>

      {/* Rail — horizontal scrollable strip of asset pills. */}
      {address ? (
        <div className="relative">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {isLoading && groups.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonPill key={i} />
                ))
              : filtered.length === 0
                ? null
                : filtered.map((g) => (
                    <AssetPill
                      key={g.coinType}
                      group={g}
                      selected={g.coinType === selectedCoinType}
                      onClick={() => onSelect(g.coinType)}
                    />
                  ))}
          </div>
          {!isLoading && filtered.length === 0 ? (
            <p className="px-2 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
              {filter ? "No matches in your wallet." : "No assets in this wallet."}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="border border-dashed border-ink/20 bg-ink/[0.015] px-4 py-5 text-center">
          <p className="font-sans text-[13.5px] text-ink/65">
            Connect your wallet to pick an asset.
          </p>
        </div>
      )}

      {/* Detail strip — only shown when a coin is selected. Reinforces that
          the picker has resolved a concrete asset, not just a symbol. */}
      {selected ? <SelectedAssetDetail group={selected} /> : null}
    </div>
  );
}

/* ─────────────────────────── pills ─────────────────────────── */

function AssetPill({
  group,
  selected,
  onClick,
}: {
  group: OwnedCoinGroup;
  selected: boolean;
  onClick: () => void;
}) {
  const displayBalance = formatAmount(group.totalBalanceRaw, {
    decimals: group.decimals,
    maxFractionDigits: 4,
    compact: true,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative inline-flex shrink-0 items-center gap-2 border bg-bone px-3 py-2 text-left transition-all duration-200 ease-atelier",
        selected
          ? "border-ink shadow-offset-sm"
          : "border-ink/15 hover:border-ink/45 hover:-translate-y-[1px]",
      )}
      style={{ minWidth: "10rem" }}
    >
      {/* Active indicator — full-width poppy underline on the active pill. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-[2px] bg-poppy transition-opacity duration-200",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <AssetGlyph group={group} />
      <div className="flex flex-1 flex-col">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
          {group.symbol ?? truncTail(group.coinType)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink/55">
          {displayBalance}
        </span>
      </div>
    </button>
  );
}

function SkeletonPill() {
  return (
    <div
      className="relative inline-flex shrink-0 animate-pulse items-center gap-2 border border-ink/10 bg-ink/[0.03] px-3 py-2"
      style={{ minWidth: "10rem", height: "44px" }}
      aria-hidden
    >
      <span className="block h-5 w-5 bg-ink/10" />
      <span className="block h-3 w-12 bg-ink/10" />
    </div>
  );
}

/* ─────────────────────────── glyphs ─────────────────────────── */

function AssetGlyph({ group }: { group: OwnedCoinGroup }) {
  // Show the icon if available; otherwise render a deterministic 2x2
  // pixel chip seeded by the coin type so each asset has a unique
  // monogram. Reads as a generative identicon — same gesture as the
  // launchpad core's <Identicon>.
  if (group.iconUrl) {
    return (
      <span
        className="relative block h-5 w-5 shrink-0 overflow-hidden border border-ink/20 bg-ink/[0.02]"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={group.iconUrl}
          alt=""
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="relative block h-5 w-5 shrink-0 border border-ink/20 bg-bone"
    >
      <PixelChip seed={group.coinType} />
    </span>
  );
}

function PixelChip({ seed }: { seed: string }) {
  // Tiny deterministic pixel chip — four cells across, two rows, mirrored
  // horizontally. Reads as a quiet asset monogram without needing a real
  // icon file.
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const cells: boolean[] = [];
  for (let i = 0; i < 8; i += 1) {
    cells.push(((h >> i) & 1) === 1);
  }
  // Pick one of the six accents from the hash for the fill.
  const accents = ["#B8C45E", "#C47557", "#6E8E5D", "#6D8796", "#D9C57A", "#7E685E"];
  const fill = accents[h % accents.length];
  return (
    <svg viewBox="0 0 5 4" className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)]" aria-hidden>
      {cells.map((on, i) => {
        if (!on) return null;
        const x = i % 4;
        const y = Math.floor(i / 4);
        return (
          <g key={i}>
            <rect x={x} y={y} width="1" height="1" fill={fill} />
            <rect x={4 - x} y={y} width="1" height="1" fill={fill} />
          </g>
        );
      })}
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden
    >
      <circle cx="5" cy="5" r="3.5" />
      <line x1="8" y1="8" x2="11" y2="11" strokeLinecap="round" />
    </svg>
  );
}

/* ─────────────────────────── detail ─────────────────────────── */

function SelectedAssetDetail({ group }: { group: OwnedCoinGroup }) {
  const balanceWhole = formatAmount(group.totalBalanceRaw, {
    decimals: group.decimals,
    maxFractionDigits: 6,
    compact: false,
  });
  return (
    <div className="border-t border-ink/10 bg-ink/[0.015]">
      <div className="grid grid-cols-2 divide-x divide-y divide-ink/10 md:grid-cols-4 md:divide-y-0">
        <Cell label="Name" value={group.name ?? "—"} />
        <Cell label="Spendable" mono value={`${balanceWhole} ${group.symbol ?? ""}`.trim()} />
        <Cell label="Decimals" mono value={String(group.decimals)} />
        <Cell label="Type" mono value={truncMiddle(group.coinType, 16)} />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-[13px] text-ink",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function truncTail(coinType: string): string {
  const tail = coinType.split("::").pop() ?? "";
  return tail.toUpperCase().slice(0, 6) || "?";
}

function truncMiddle(s: string, keep: number): string {
  if (s.length <= keep * 2 + 1) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}
