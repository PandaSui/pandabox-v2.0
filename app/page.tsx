import { Suspense } from "react";
import { Nav } from "@/components/nav";
import {
  FeaturedProjects,
  FeaturedProjectsSkeleton,
  FinalCta,
  Footer,
  Hero,
  HowItWorks,
  TheNumbers,
  WhySui,
  type HeroStats,
} from "@/components/blocks";
import { PACKAGE_ID } from "@/lib/contracts/pandabox";
import { getPlatformStats } from "@/lib/platform";

export default async function Landing() {
  const platform = await getPlatformStats();

  const heroStats: HeroStats = {
    projectCount: platform?.totalProjects ?? 0,
    platformFeeBps: platform?.feeBps,
    treasuryAddress: platform?.treasuryAddress,
  };

  const network: "mainnet" | "testnet" =
    process.env.NEXT_PUBLIC_SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";

  return (
    <>
      <Nav floatAfterHero />
      <main id="main">
        <Hero stats={heroStats} packageId={PACKAGE_ID} network={network} />
        <Suspense fallback={<FeaturedProjectsSkeleton />}>
          <FeaturedProjects />
        </Suspense>
        <HowItWorks />

        <TheNumbers />
        <WhySui />
        <FinalCta />
        <Footer />
      </main>
    </>
  );
}
