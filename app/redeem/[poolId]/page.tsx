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
import { PoolMetaPanel } from "@/components/redeem/pool-meta-panel";
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

        <section className="relative">
          <Container className="py-10 lg:py-14">
            {/*
              3-column layout on lg+:
                · Left rail (3/12) — pool meta + deposit panel.
                · Center (5/12)    — About + Activity.
                · Right rail (4/12) — Redeem panel (sticky).
              Mobile / tablet stack: redeem panel first (action above the
              fold), then about, then activity, then meta + deposit.
            */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="lg:order-1 lg:col-span-3 space-y-6">
                <PoolMetaPanel data={hydrated} />
                <DepositPanel data={hydrated} />
              </div>

              <div className="lg:order-2 lg:col-span-5 space-y-6">
                <AboutPool data={hydrated} feeBps={feeBps} />
                <PoolActivityFeed
                  items={activity}
                  symbol={metadata.symbol}
                  coinDecimals={pool.coinDecimals}
                />
              </div>

              <div className="lg:order-3 lg:col-span-4">
                <RedeemPanel data={hydrated} feeBps={feeBps} paused={paused} />
              </div>
            </div>
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}
