import Image from "next/image";
import Link from "next/link";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { ArrowDiag } from "@pandasui/ui";
import { Address } from "@/components/identity/address";
import { Identicon } from "@/components/identity/identicon";
import { RelativeTime } from "@/components/identity/relative-time";
import { SuiAmount } from "@/components/identity/sui-amount";
import { MIST_PER_SUI } from "@/lib/sui";
import { formatAmount } from "@/lib/amount";
import type { HydratedPool } from "@/lib/redeem/discovery";
import { RecipientBadge } from "./recipient-badge";

const SUN_HEX = "#D9C57A";

/**
 * Format the pool's exchange rate as a human-readable "1 TICKER ≈ X SUI"
 * string. Despite the field name, `price_mist_per_token` is mist per
 * WHOLE token (see lib/redeem/quote.ts for the on-chain formula proof
 * against live mainnet redeems), so the conversion is just
 *
 *   sui_per_whole_token = price_mist_per_token / 1e9
 *
 * Coin decimals don't enter — the contract uses them internally when
 * scaling `coin_in`, but they don't change the price-per-token unit.
 */
function formatRate(args: {
  priceMistPerToken: bigint;
  decimals: number;
  symbol: string;
}): { suiPerToken: string; tokensPerSui: string } {
  void args.decimals;
  void args.symbol;
  const suiPerToken = new BigNumber(args.priceMistPerToken.toString())
    .dividedBy(MIST_PER_SUI.toString());

  // tokens-per-SUI is the natural inverse: how many whole tokens a single
  // SUI redeems for. Surfaced as a hint when the per-token SUI price is
  // very small (e.g. memecoins where 1 token < 0.0001 SUI).
  const tokensPerSui = suiPerToken.isZero()
    ? new BigNumber(0)
    : new BigNumber(1).dividedBy(suiPerToken);

  return {
    suiPerToken: suiPerToken.toFixed(
      Math.min(6, Math.max(2, suiPerToken.lt(0.01) ? 6 : 4)),
    ),
    tokensPerSui: formatAmount(
      BigInt(tokensPerSui.integerValue(BigNumber.ROUND_FLOOR).toFixed(0)),
      { decimals: 0, compact: true, maxFractionDigits: 1 },
    ),
  };
}

export function PoolCard({
  data,
  feeBps,
  priority = false,
}: {
  data: HydratedPool;
  /** Platform fee in bps, used purely to surface the displayed net rate is gross. */
  feeBps: number;
  /** Pass true for the first card in the grid to bias LCP towards its image. */
  priority?: boolean;
}) {
  const { pool, metadata, createdEvent } = data;
  const symbol = metadata.symbol;

  const { suiPerToken, tokensPerSui } = formatRate({
    priceMistPerToken: pool.priceMistPerToken,
    decimals: pool.coinDecimals,
    symbol,
  });

  // Reserve health: a pool with empty reserve cannot honour a redeem, so
  // it visually mutes. Crypto-natives parse "0.000 SUI reserve" instantly,
  // but the muting is the read-at-a-glance signal.
  const isEmpty = pool.suiReserveMist === 0n;

  const totalRedeemed = formatAmount(pool.totalCoinRedeemed, {
    decimals: pool.coinDecimals,
    compact: true,
    maxFractionDigits: 2,
  });

  return (
    <Link
      href={`/redeem/${pool.objectId}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border border-ink bg-bone shadow-offset-sm",
        "transition-all duration-300 ease-atelier",
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
        isEmpty && "opacity-90",
      )}
      aria-label={`Open ${metadata.name} redeem pool`}
    >
      {/* Top accent spine — sun, the redeem tool's color register */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[3px] bg-sun"
      />
      {/* Soft accent wash, anchored top-right — depth without a hard surface */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-[0.18] blur-[80px]"
        style={{ background: SUN_HEX }}
      />

      {/* ── Identity row ───────────────────────────────────────────── */}
      <div className="relative flex items-start justify-between gap-3 px-5 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <CoinAvatar
            iconUrl={metadata.iconUrl}
            symbol={symbol}
            seed={pool.coinType}
            priority={priority}
          />
          <div className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight text-ink">
              {metadata.name}
            </span>
            <span className="mt-0.5 inline-flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums text-ink/55">
              <span className="font-medium uppercase tracking-[0.06em] text-ink/70">
                {symbol}
              </span>
              <span aria-hidden className="text-ink/25">·</span>
              <span className="truncate">
                {pool.coinType.split("::").pop() ?? ""}
              </span>
            </span>
          </div>
        </div>
        <RecipientBadge mode={pool.recipientMode} address={pool.recipient} />
      </div>

      {/* ── Rate row ───────────────────────────────────────────────── */}
      <div className="relative mt-5 border-y border-ink/10 bg-ink/[0.015] px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Rate
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
            permanent
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink/55">
            1 {symbol} ≈
          </span>
          <span className="text-[16px] font-semibold text-ink">
            {suiPerToken}
          </span>
          <span className="text-[11px] text-ink/65">SUI</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-ink/40">
          1 SUI ≈ {tokensPerSui} {symbol}
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────────── */}
      <dl className="relative grid grid-cols-2 divide-x divide-ink/10 border-b border-ink/10">
        <div className="px-5 py-4">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Reserve
          </dt>
          <dd className="mt-1.5 text-[14px]">
            <SuiAmount
              mist={pool.suiReserveMist}
              maxFractionDigits={4}
              showGlyph
              glyphSize={11}
              className={cn(
                "text-[14px]",
                isEmpty ? "text-ink/40" : "text-ink",
              )}
            />
            {isEmpty && (
              <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-poppy">
                <span aria-hidden className="block h-1 w-1 bg-poppy" />
                empty
              </span>
            )}
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Redeemed
          </dt>
          <dd className="mt-1.5 font-mono text-[14px] tabular-nums text-ink">
            {totalRedeemed}{" "}
            <span className="text-[10px] uppercase tracking-[0.06em] text-ink/55">
              {symbol}
            </span>
          </dd>
        </div>
      </dl>

      {/* ── Footer row ─────────────────────────────────────────────── */}
      <div className="relative mt-auto flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[10.5px] text-ink/55">
          <span className="uppercase tracking-[0.16em] text-ink/40">by</span>
          <Address value={pool.creator} className="text-ink/70" copyable={false} />
          <span aria-hidden className="text-ink/20">·</span>
          <RelativeTime
            value={createdEvent?.timestampMs ?? pool.createdAtMs}
            className="text-ink/45"
          />
        </div>
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center justify-center text-ink/55 transition-all duration-300 group-hover:translate-x-[2px] group-hover:text-ink"
        >
          <ArrowDiag size={11} />
        </span>
      </div>

      {/* Fee hint — a single hairline under the row, small enough not to
          shout but loud enough that a crypto-native sees it before
          clicking. */}
      <div className="relative border-t border-ink/10 px-5 py-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/35">
        {(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2)}% platform fee · taken from gross SUI
      </div>
    </Link>
  );
}

/**
 * Coin icon with a graceful fallback: render the metadata image if present,
 * otherwise show a deterministic 5×5 identicon generated from the coin
 * type. No layout shift — both render at the same size.
 */
function CoinAvatar({
  iconUrl,
  symbol,
  seed,
  priority,
}: {
  iconUrl: string | null;
  symbol: string;
  seed: string;
  priority: boolean;
}) {
  if (iconUrl) {
    return (
      <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-bone">
        <Image
          src={iconUrl}
          alt={`${symbol} icon`}
          width={40}
          height={40}
          className="h-full w-full object-cover"
          priority={priority}
          unoptimized
        />
      </span>
    );
  }
  return (
    <span
      aria-label={`${symbol} identicon`}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-bone"
    >
      <Identicon value={seed} size={28} />
    </span>
  );
}
