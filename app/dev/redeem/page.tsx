// Phase 1 verification route for the Redeem foundations. Renders the live
// `RedeemPlatform` state plus the most recently created pool, so we can
// confirm the reader + event layer are wired correctly before any
// user-facing UI lands. This page is /dev-namespaced; not linked from the
// main nav.

import type { Metadata } from "next";
import {
  REDEEM_PACKAGE_ID,
  REDEEM_PLATFORM_ID,
} from "@/lib/contracts/redeem";
import {
  getRedeemPlatform,
  getRedeemPool,
  listPoolsCreated,
} from "@/lib/redeem/server";
import { quoteRedeem, maxRedeemableCoin } from "@/lib/redeem/quote";
import { Container } from "@/components/primitives/container";
import { mistToSui, rawToDecimal } from "@/lib/sui";

export const metadata: Metadata = {
  title: "Redeem · dev probe",
  robots: { index: false, follow: false },
};

export default async function RedeemDevPage() {
  const platform = await getRedeemPlatform();
  const recent = await listPoolsCreated({ limit: 5 });
  const newest = recent.items[0];
  const pool = newest
    ? await getRedeemPool(newest.poolId, platform?.treasuryAddress)
    : null;

  return (
    <main id="main">
      <Container className="py-10">
        <h1 className="font-display text-3xl leading-tight">
          Redeem · phase 1 probe
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          Live state from the deployed contract. If anything below renders
          empty, the env vars or RPC path is wrong.
        </p>

        <Section title="Contract addresses">
          <KV k="REDEEM_PACKAGE_ID" v={REDEEM_PACKAGE_ID} mono />
          <KV k="REDEEM_PLATFORM_ID" v={REDEEM_PLATFORM_ID} mono />
        </Section>

        <Section title="RedeemPlatform state">
          {platform ? (
            <>
              <KV k="fee_bps" v={`${platform.feeBps} (${(platform.feeBps / 100).toFixed(2)}%)`} />
              <KV k="treasury_address" v={platform.treasuryAddress} mono />
              <KV
                k="fee_treasury"
                v={`${platform.feeTreasuryMist.toString()} mist · ${mistToSui(platform.feeTreasuryMist).toString()} SUI`}
              />
              <KV k="paused" v={String(platform.paused)} />
              <KV k="total_pools" v={String(platform.totalPools)} />
            </>
          ) : (
            <p className="text-sm text-poppy">Platform read failed.</p>
          )}
        </Section>

        <Section title={`Recent PoolCreated events (${recent.items.length})`}>
          {recent.items.length === 0 && (
            <p className="text-sm text-ink/60">No pools created yet.</p>
          )}
          {recent.items.map((ev) => (
            <div
              key={`${ev.txDigest}-${ev.poolNumber}`}
              className="border-t border-ink/15 py-3 text-sm"
            >
              <div className="font-mono text-[11px] text-ink/55">
                #{ev.poolNumber} · {new Date(ev.timestampMs).toISOString()}
              </div>
              <KV k="pool_id" v={ev.poolId} mono />
              <KV k="coin_type" v={ev.coinType} mono />
              <KV k="recipient" v={ev.recipient} mono />
              <KV
                k="price_mist_per_token"
                v={ev.priceMistPerToken.toString()}
              />
              <KV k="coin_decimals" v={String(ev.coinDecimals)} />
              <KV
                k="initial_deposit"
                v={`${ev.initialDepositMist.toString()} mist · ${mistToSui(ev.initialDepositMist).toString()} SUI`}
              />
            </div>
          ))}
        </Section>

        <Section title="Newest pool · live state">
          {pool ? (
            <>
              <KV k="objectId" v={pool.objectId} mono />
              <KV k="coinType (T)" v={pool.coinType} mono />
              <KV k="creator" v={pool.creator} mono />
              <KV k="recipient" v={pool.recipient} mono />
              <KV k="recipientMode" v={pool.recipientMode} />
              <KV
                k="price_mist_per_token"
                v={pool.priceMistPerToken.toString()}
              />
              <KV k="coin_decimals" v={String(pool.coinDecimals)} />
              <KV
                k="sui_reserve"
                v={`${pool.suiReserveMist.toString()} mist · ${mistToSui(pool.suiReserveMist).toString()} SUI`}
              />
              <KV
                k="total_sui_deposited"
                v={`${pool.totalSuiDepositedMist.toString()} mist`}
              />
              <KV
                k="total_sui_paid_out"
                v={`${pool.totalSuiPaidOutMist.toString()} mist`}
              />
              <KV
                k="total_coin_redeemed"
                v={`${pool.totalCoinRedeemed.toString()} base units · ${rawToDecimal(pool.totalCoinRedeemed, pool.coinDecimals).toString()} whole`}
              />
              <KV
                k="created_at"
                v={new Date(pool.createdAtMs).toISOString()}
              />
            </>
          ) : (
            <p className="text-sm text-ink/60">No pool to inspect yet.</p>
          )}
        </Section>

        {pool && platform && (
          <Section title="Pure-math sanity (quote, max redeemable)">
            <QuoteSanity
              reserve={pool.suiReserveMist}
              price={pool.priceMistPerToken}
              feeBps={platform.feeBps}
              decimals={pool.coinDecimals}
            />
          </Section>
        )}
      </Container>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/55">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="w-56 shrink-0 font-mono text-[11px] text-ink/55">{k}</span>
      <span className={mono ? "font-mono text-[12px] break-all" : "text-[13px]"}>
        {v}
      </span>
    </div>
  );
}

function QuoteSanity({
  reserve,
  price,
  feeBps,
  decimals,
}: {
  reserve: bigint;
  price: bigint;
  feeBps: number;
  decimals: number;
}) {
  const cap = maxRedeemableCoin({ reserveMist: reserve, priceMistPerToken: price });
  // Try three sample sizes: 1 whole token, 25% of cap, 110% of cap (to see clamp).
  const oneWhole = 10n ** BigInt(decimals);
  const quarterOfCap = cap > 0n ? cap / 4n : 0n;
  const overCap = cap + oneWhole;

  const cases = [
    { label: "1 whole token", coinIn: oneWhole },
    { label: "25% of cap", coinIn: quarterOfCap },
    { label: "cap + 1 token (should clamp)", coinIn: overCap },
  ];
  return (
    <div className="space-y-2">
      <KV
        k="maxRedeemableCoin"
        v={`${cap.toString()} base units · ${rawToDecimal(cap, decimals).toString()} whole`}
      />
      {cases.map((c) => {
        const q = quoteRedeem({
          coinIn: c.coinIn,
          priceMistPerToken: price,
          reserveMist: reserve,
          feeBps,
        });
        return (
          <div
            key={c.label}
            className="rounded-none border border-ink/10 px-3 py-2 text-[12px]"
          >
            <div className="font-mono text-[11px] text-ink/55">{c.label} — coin_in {c.coinIn.toString()}</div>
            <div>gross: {q.suiGrossMist.toString()} mist · fee: {q.feeMist.toString()} · net: {q.suiOutMist.toString()} {q.clamped ? "· CLAMPED" : ""}</div>
          </div>
        );
      })}
    </div>
  );
}
