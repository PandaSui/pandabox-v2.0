import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import {
  getRedeemPlatform,
  getRedeemPool,
  getCoinMetadata,
  getPoolActivity,
} from "@/lib/redeem/server";
import type { HydratedPool } from "@/lib/redeem/discovery";
import { PoolHero } from "@/components/redeem/pool-hero";
import { PoolMetaStrip } from "@/components/redeem/pool-meta-strip";
import { AboutPool } from "@/components/redeem/about-pool";
import { PoolActivityFeed } from "@/components/redeem/pool-activity-feed";
import { RedeemPanel } from "@/components/redeem/redeem-panel";
import { DepositPanel } from "@/components/redeem/deposit-panel";

// Pool state changes on every redeem — keep the prerender window short so
// holders see fresh reserve numbers when they land. The reader cache
// (30s) absorbs any burst of reads inside this window.
export const revalidate = 15;

type PageProps = { params: Promise<{ poolId: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { poolId } = await params;
  const platform = await getRedeemPlatform();
  const pool = await getRedeemPool(poolId, platform?.treasuryAddress);
  if (!pool) {
    return {
      title: "Pool not found — Pandabox",
      robots: { index: false, follow: false },
    };
  }
  const metadata = await getCoinMetadata(pool.coinType);
  return {
    title: `${metadata.name} (${metadata.symbol}) · Redeem pool — Pandabox`,
    description: `Redeem ${metadata.symbol} for SUI at a permanent on-chain rate.`,
  };
}

export default async function RedeemPoolPage({ params }: PageProps) {
  const { poolId } = await params;

  const platform = await getRedeemPlatform();
  const pool = await getRedeemPool(poolId, platform?.treasuryAddress);
  if (!pool) notFound();

  const [metadata, activity] = await Promise.all([
    getCoinMetadata(pool.coinType),
    getPoolActivity({ poolId, limit: 20 }),
  ]);

  const hydrated: HydratedPool = {
    pool,
    metadata,
    createdEvent: null, // Not needed on the detail page — hero falls back to pool.createdAtMs.
  };
  const feeBps = platform?.feeBps ?? 500;
  const paused = platform?.paused ?? false;

  return (
    <>
      <Nav />
      <main id="main">
        <PoolHero data={hydrated} feeBps={feeBps} paused={paused} />

        {/*
          Metadata strip — a full-width band of mono-truncated identifiers
          (pool, coin, recipient, creator, platform) plus a Suiscan link.
          Demoting this out of the body grid frees the left rail for trust
          copy and reads as a transaction-receipt header instead of a
          competing column.
        */}
        <PoolMetaStrip data={hydrated} />

        <section className="relative">
          <Container className="py-10 lg:py-14">
            {/*
              Two-band body — actions+context above the fold, activity
              below at full width.
                · Top band: About (4) · Redeem (4) · Top-up Reserve (4).
                  Read order: explain → primary action → secondary action.
                  On mobile they stack with Redeem first so the primary
                  action is above the fold; About moves to the bottom.
                · Bottom band: Activity feed, spanning the full row. Gives
                  the list room to grow horizontally so rows don't have to
                  wrap when the address column needs space — the previous
                  5/12 center lane was the constraint that forced single-
                  line truncation everywhere.
            */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-12">
              <div className="order-2 lg:order-1 lg:col-span-4">
                <AboutPool data={hydrated} feeBps={feeBps} />
              </div>

              <div className="order-1 lg:order-2 lg:col-span-4">
                <RedeemPanel
                  data={hydrated}
                  feeBps={feeBps}
                  paused={paused}
                />
              </div>

              <div className="order-3 lg:col-span-4">
                <DepositPanel data={hydrated} />
              </div>

              <div className="order-4 lg:col-span-12 lg:mt-2">
                <PoolActivityFeed
                  items={activity}
                  symbol={metadata.symbol}
                  coinDecimals={pool.coinDecimals}
                />
              </div>
            </div>
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}
