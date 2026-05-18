import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer, Hero, type HeroStats } from "@/components/blocks";
import { ProjectCard } from "@/components/project/project-card";
import { RevealOnView } from "@/components/motion";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SplitFlapCounter } from "@/components/data";
import {
  GlyphDeploy,
  GlyphReceive,
  GlyphReconfigure,
  GlyphGas,
  GlyphObject,
  GlyphSponsor,
} from "@/components/icons";
import { getGlobalStats, listProjects } from "@/lib/indexer";
import { toProjectDTO } from "@/lib/api/project-dto";
import { PACKAGE_ID } from "@/lib/contracts/pandabox";
import { getPlatformStats } from "@/lib/platform";

export default async function Landing() {
  const [stats, featured, platform] = await Promise.all([
    getGlobalStats(),
    listProjects({ sort: "most-funded", limit: 3 }),
    getPlatformStats(),
  ]);
  const featuredDtos = featured.items.map(toProjectDTO);

  const heroStats: HeroStats = {
    projectCount: platform?.totalProjects ?? stats.projectCount,
    platformFeeBps: platform?.feeBps,
    treasuryAddress: platform?.treasuryAddress,
  };

  const network: "mainnet" | "testnet" =
    process.env.NEXT_PUBLIC_SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";

  return (
    <>
      <Nav />
      <main id="main">
        <Hero stats={heroStats} packageId={PACKAGE_ID} network={network} />

        {/* Section 3 — How it works */}
        <section>
          <Container className="py-20">
            <div className="mb-12">
              <MonoLabel>How it works</MonoLabel>
              <h2 className="mt-2 max-w-2xl text-3xl md:text-4xl">
                Three steps from idea to on-chain funding.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0">
              <Step
                number="01"
                accent="saffron"
                glyph={<GlyphDeploy />}
                heading="Deploy"
                body="Configure cycles, payouts, tokens, and optional NFT tiers. Sign one Sui transaction. Your project goes live with an admin cap object you own."
                border={false}
              />
              <Step
                number="02"
                accent="poppy"
                glyph={<GlyphReceive />}
                heading="Receive"
                body="Supporters pay SUI directly to your treasury. They receive project tokens at your cycle's weight, plus tier NFTs if you defined any."
                border
              />
              <Step
                number="03"
                accent="jade"
                glyph={<GlyphReconfigure />}
                heading="Reconfigure"
                body="Propose changes for the next cycle. After the ballot delay, the new parameters lock in. Holders can cash out surplus at any time."
                border
              />
            </div>
          </Container>
        </section>

        {/* Section 4 — Featured projects */}
        <section className="border-t border-ink/15 bg-paper/40">
          <Container className="py-20">
            <AccentRule color="saffron" className="mb-10">
              <MonoLabel>Featured</MonoLabel>
              <h2 className="mt-2 text-3xl md:text-4xl">Funded right now</h2>
            </AccentRule>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredDtos.map((p, i) => (
                <RevealOnView key={p.id} delayMs={i * 60}>
                  <ProjectCard
                    project={p}
                    variant="featured"
                    priority={i === 0}
                  />
                </RevealOnView>
              ))}
            </div>
            <div className="mt-10">
              <Link
                href="/explore"
                className="font-mono-label text-ink/70 hover:text-ink"
              >
                Explore all projects →
              </Link>
            </div>
          </Container>
        </section>

        {/* Section 5 — Numbers that matter */}
        <section className="border-t border-ink/15">
          <Container className="py-16">
            <MonoLabel>The numbers</MonoLabel>
            <div className="mt-6 grid grid-cols-2 border border-ink/15 md:grid-cols-4">
              <FactCell
                label="Total value locked"
                value={Math.round(Number(stats.tvlMist) / 1e9)}
                deltaPct={stats.delta7d.tvlPct}
                suffix="SUI"
              />
              <FactCell
                label="Active projects"
                value={stats.projectCount}
                deltaPct={stats.delta7d.projectsPct}
                border
              />
              <FactCell
                label="Supporters"
                value={stats.supporterCount}
                deltaPct={stats.delta7d.supportersPct}
                border
              />
              <FactCell
                label="Median cycle"
                value={stats.medianCycleDays}
                suffix="days"
                border
              />
            </div>
          </Container>
        </section>

        {/* Section 6 — Why Sui */}
        <section className="border-t border-ink/15">
          <Container className="py-20">
            <div className="mb-12 max-w-2xl">
              <MonoLabel>Why Sui</MonoLabel>
              <h2 className="mt-2 text-3xl md:text-4xl">
                Built for the chain that's built for this.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0">
              <WhyCol
                glyph={<GlyphGas />}
                heading="Sub-cent gas"
                body="Supporters don't pay $30 to back a project. Pandabox payments cost fractions of a cent — the small contributions that matter actually go through."
                border={false}
              />
              <WhyCol
                glyph={<GlyphObject />}
                heading="Object-centric ownership"
                body="Your ProjectAdminCap is a real Sui object. Transfer it to a multisig, hand it to a DAO, lock it in escrow — it's just an object."
                border
              />
              <WhyCol
                glyph={<GlyphSponsor />}
                heading="Sponsored transactions"
                body="Onboard supporters who don't yet hold SUI. Pandabox can sponsor the gas, so a first-time wallet can back a project on its first interaction."
                border
              />
            </div>
          </Container>
        </section>

        {/* Section 7 — Final CTA */}
        <section className="border-y border-ink/15">
          <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
            <MonoLabel>Ship it</MonoLabel>
            <h2 className="mt-4 max-w-3xl text-balance font-display text-4xl leading-tight md:text-6xl">
              Your project, on-chain in 12 minutes.
            </h2>
            <Link
              href="/create"
              className="diecut mt-10 bg-ink px-8 py-4 text-bone hover:bg-ink-90 transition-colors"
            >
              <span className="font-mono-label">Launch a project →</span>
            </Link>
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}

function Step({
  number,
  accent,
  glyph,
  heading,
  body,
  border,
}: {
  number: string;
  accent: "saffron" | "poppy" | "jade";
  glyph: React.ReactNode;
  heading: string;
  body: string;
  border: boolean;
}) {
  return (
    <div
      className={
        border
          ? "px-8 md:border-l md:border-ink/15"
          : "px-8 md:pl-0 md:pr-8"
      }
    >
      <div className="text-ink/60">{glyph}</div>
      <div className="mt-4">
        <AccentRule color={accent}>
          <MonoLabel accent={accent}>{number}</MonoLabel>
        </AccentRule>
      </div>
      <h3 className="mt-3 text-2xl">{heading}</h3>
      <p className="mt-3 max-w-prose text-base text-ink/70">{body}</p>
    </div>
  );
}

function WhyCol({
  glyph,
  heading,
  body,
  border,
}: {
  glyph: React.ReactNode;
  heading: string;
  body: string;
  border: boolean;
}) {
  return (
    <div
      className={
        border
          ? "px-8 md:border-l md:border-ink/15"
          : "px-8 md:pl-0 md:pr-8"
      }
    >
      <div className="text-ink/60">{glyph}</div>
      <h3 className="mt-4 text-xl">{heading}</h3>
      <p className="mt-2 max-w-prose text-sm text-ink/70">{body}</p>
    </div>
  );
}

function FactCell({
  label,
  value,
  deltaPct,
  suffix,
  border = false,
}: {
  label: string;
  value: number;
  deltaPct?: number;
  suffix?: string;
  border?: boolean;
}) {
  return (
    <div className={border ? "border-l border-ink/15 p-6" : "p-6"}>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-3 flex items-baseline gap-2">
        <SplitFlapCounter value={value} className="text-3xl md:text-4xl" />
        {suffix && (
          <span className="font-mono-label text-[10px] text-ink/50">
            {suffix}
          </span>
        )}
      </div>
      {typeof deltaPct === "number" && (
        <div className="mt-2 font-mono text-xs text-poppy">
          {deltaPct > 0 ? "+" : ""}
          {deltaPct.toFixed(2)}% · 7d
        </div>
      )}
    </div>
  );
}
