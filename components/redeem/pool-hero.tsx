import Image from "next/image";
import Link from "next/link";
import BigNumber from "bignumber.js";
import { getTranslations } from "next-intl/server";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Identicon } from "@/components/identity/identicon";
import { CoinType } from "@/components/identity/coin-type";
import { SuiAmount } from "@/components/identity/sui-amount";
import { RelativeTime } from "@/components/identity/relative-time";
import { MIST_PER_SUI } from "@/lib/sui";
import { formatAmount } from "@/lib/amount";
import type { HydratedPool } from "@/lib/redeem/discovery";
import { getPoolTrustSignal } from "@/lib/redeem/discovery";
import { RecipientBadge } from "./recipient-badge";

const SUN_HEX = "#D9C57A";

/**
 * The masthead of `/redeem/[poolId]`. Pulls identity + headline numbers
 * into one wide band so a holder can size up the pool in one glance
 * before scrolling to the redeem panel.
 *
 * Layout:
 *   - Left:  coin avatar + name + ticker + recipient badge + created-at
 *   - Right: 4-cell stat strip (Rate · Reserve · Redeemed · Paid out)
 *   - Below: optional `Paused` warning band when the platform is paused
 */
export async function PoolHero({
  data,
  feeBps,
  paused,
}: {
  data: HydratedPool;
  feeBps: number;
  paused: boolean;
}) {
  const t = await getTranslations("redeem.detail.hero");
  const tShared = await getTranslations("redeem.shared");
  const { pool, metadata, createdEvent } = data;
  const symbol = metadata.symbol;

  // Per-whole-token SUI rate. `priceMistPerToken` is mist per WHOLE
  // token (see lib/redeem/quote.ts), so SUI/token is just price / 1e9.
  // Coin decimals don't enter — the contract uses them internally to
  // scale `coin_in`, but they don't change the price-per-token unit.
  const suiPerToken = new BigNumber(
    pool.priceMistPerToken.toString(),
  ).dividedBy(MIST_PER_SUI.toString());
  // Auto-tier precision so the rate stays legible across five orders of
  // magnitude without losing the trailing zeros that make the unit
  // explicit:
  //   · ≥ 0.01 SUI/token  → 3 fraction digits  ("1.000", "0.500")
  //   · ≥ 1e-6 SUI/token  → 6 fraction digits  ("0.001000")
  //   · < 1e-6 SUI/token  → 9 fraction digits  ("0.000000001")
  // The 9-digit floor reveals nano-SUI rates (e.g. mint-priced memecoins
  // at `price_mist_per_token = 1`) that would otherwise round to
  // "0.000000" and read as a broken display.
  const rateLabel = suiPerToken.isZero()
    ? "0"
    : suiPerToken.gte(0.01)
      ? suiPerToken.toFixed(3)
      : suiPerToken.gte(1e-6)
        ? suiPerToken.toFixed(6)
        : suiPerToken.toFixed(9);

  const redeemedFormatted = formatAmount(pool.totalCoinRedeemed, {
    decimals: pool.coinDecimals,
    compact: true,
    maxFractionDigits: 2,
  });

  return (
    <section className="relative overflow-hidden border-b border-ink/15">
      {/* Soft sun wash anchored top-right — gives the hero depth without
          a solid block of color. Pure decoration, blurred. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: SUN_HEX }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-sun"
      />

      <Container className="relative py-9 lg:py-12">
        <Link
          href="/redeem"
          className="group inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
        >
          <span
            aria-hidden
            className="inline-block transition-transform duration-300 ease-atelier group-hover:-translate-x-0.5"
          >
            ←
          </span>
          <span>{t("back")}</span>
        </Link>
        <div className="mt-4">
          <AccentRule color="sun">
            <MonoLabel>{t("eyebrow")}</MonoLabel>
          </AccentRule>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-12">
          {/* ── Identity column ─────────────────────────────────────── */}
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-start gap-5">
              <CoinAvatarLarge
                iconUrl={metadata.iconUrl}
                symbol={symbol}
                seed={pool.coinType}
              />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-balance text-[clamp(1.875rem,3.4vw,3rem)] leading-[1] tracking-tight">
                  {metadata.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[12px] text-ink/55">
                  <span className="font-semibold uppercase tracking-[0.08em] text-ink/80">
                    {symbol}
                  </span>
                  <span aria-hidden className="text-ink/20">
                    ·
                  </span>
                  <CoinType value={pool.coinType} className="text-ink/55" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <RecipientBadge
                    mode={pool.recipientMode}
                    address={pool.recipient}
                  />
                  {/* Three trust states, two visible:
                        · deployer-run → jade pill (verified)
                        · unofficial   → poppy pill (creator differs from
                                          the coin's known deployer — a
                                          real warning, not just absence
                                          of signal)
                        · unverified   → nothing (frozen metadata + no
                                          Pandabox record, can't say). */}
                  {(() => {
                    const signal = getPoolTrustSignal({
                      poolCreator: pool.creator,
                      metadataOwner: metadata.owner,
                      pandaboxCreator: data.pandaboxCreator,
                    });
                    if (signal === "deployer-run") {
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 border border-jade/45 bg-jade/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-jade hover:cursor-help"
                          title={t("deployerRunTitle")}
                        >
                          <span
                            aria-hidden
                            className="block h-1.5 w-1.5 rounded-full bg-jade"
                          />
                          {t("deployerRun")}
                        </span>
                      );
                    }
                    if (signal === "unofficial") {
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 border border-poppy/50 bg-poppy/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-poppy hover:cursor-help"
                          title={t("unofficialTitle")}
                        >
                          <span
                            aria-hidden
                            className="block h-1.5 w-1.5 rounded-full bg-poppy"
                          />
                          {t("unofficial")}
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span className="inline-flex items-center gap-1.5 border border-ink/20 bg-bone px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">
                    <span aria-hidden className="block h-1.5 w-1.5 bg-sun" />
                    {t("permanent")}
                  </span>
                  <span aria-hidden className="text-ink/25">
                    ·
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/45">
                    {t("deployed")}{" "}
                    <RelativeTime
                      value={createdEvent?.timestampMs ?? pool.createdAtMs}
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stat strip — 4 cells, hairline-divided ────────────────── */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 divide-x divide-y divide-ink/15 border border-ink/15 bg-bone sm:grid-cols-4 sm:divide-y-0">
              <Stat
                label={tShared("rate")}
                valueNode={
                  // Stack the unit beneath the number so a 9-decimal
                  // nano-SUI rate ("0.000000001") can't push past this
                  // 25% column into the adjacent reserve cell. Cell
                  // width stays predictable regardless of magnitude.
                  <div className="font-mono tabular-nums leading-[1.1]">
                    <div className="truncate text-[15px] text-ink">
                      {rateLabel}
                    </div>
                    <div className="mt-0.5 truncate text-[9.5px] uppercase tracking-[0.12em] text-ink/55">
                      {t("rateUnit", { symbol })}
                    </div>
                  </div>
                }
              />
              <Stat
                label={tShared("reserve")}
                valueNode={
                  <SuiAmount
                    mist={pool.suiReserveMist}
                    compact
                    adaptive
                    maxFractionDigits={3}
                    glyphSize={10}
                    className={cn(
                      "text-[15px]",
                      pool.suiReserveMist === 0n ? "text-poppy" : "text-ink",
                    )}
                  />
                }
              />
              <Stat
                label={tShared("redeemed")}
                value={`${redeemedFormatted} ${symbol}`}
              />
              <Stat
                label={tShared("paidOut")}
                valueNode={
                  <SuiAmount
                    mist={pool.totalSuiPaidOutMist}
                    compact
                    adaptive
                    maxFractionDigits={3}
                    glyphSize={10}
                    className="text-[15px] text-ink"
                  />
                }
              />
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
              <span>
                {t("feeNote", {
                  fee: (feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2),
                })}
              </span>
              <span>{t("live")}</span>
            </div>
          </div>
        </div>
      </Container>

      {paused && (
        <div className="relative border-t border-poppy/35 bg-poppy/[0.08]">
          <Container className="flex flex-wrap items-center gap-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-poppy md:py-3.5">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-poppy"
            />
            <span className="font-semibold">{t("pausedTitle")}</span>
            <span aria-hidden className="text-poppy/40">
              ·
            </span>
            <span className="normal-case tracking-normal text-poppy/85">
              {t("pausedBody")}
            </span>
          </Container>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── Subviews ─────────────────────────── */

function Stat({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </div>
      <div className="mt-1.5 font-mono tabular-nums text-ink">
        {valueNode ?? value}
      </div>
    </div>
  );
}

function CoinAvatarLarge({
  iconUrl,
  symbol,
  seed,
}: {
  iconUrl: string | null;
  symbol: string;
  seed: string;
}) {
  if (iconUrl) {
    return (
      <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-bone">
        <Image
          src={iconUrl}
          alt={`${symbol} icon`}
          width={64}
          height={64}
          className="h-full w-full object-cover"
          priority
          unoptimized
        />
      </span>
    );
  }
  return (
    <span
      aria-label={`${symbol} identicon`}
      className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-bone"
    >
      <Identicon value={seed} size={48} />
    </span>
  );
}
