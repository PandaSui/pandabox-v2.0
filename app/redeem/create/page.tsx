import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RedeemCreateWizard } from "@/components/redeem/create/wizard";

export const metadata: Metadata = {
  title: "Deploy a redeem pool — Pandabox",
  description:
    "Stand up a permanent on-chain redeem pool. Pick a coin, fix the rate, choose burn or buyback, fund the reserve, sign one transaction.",
};

export default function RedeemCreatePage() {
  return (
    <>
      <Nav />
      <main id="main">
        {/* Compact header — wizard chrome carries most of the weight, so
            this just sets the page voice and explains the irreversibility
            up-front before the user starts filling in inputs. */}
        <section className="relative border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-2xl">
              <AccentRule color="sun">
                <MonoLabel>Deploy a redeem pool</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 text-balance font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.02] tracking-tight">
                Five steps. One signed transaction. No takebacks.
              </h1>
              <p className="mt-3 max-w-prose text-pretty text-[15px] text-ink/65">
                You'll pick the coin, set the exchange rate, choose where
                redeemed coins are routed, and seed the reserve. The contract
                shares the resulting <code className="font-mono text-[13px]">RedeemPool&lt;T&gt;</code>{" "}
                object — and from that moment, its rate and recipient are
                locked on-chain forever.
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:gap-x-5">
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden className="block h-1 w-1 rounded-full bg-sun" />
                Permanent terms
              </li>
              <li className="text-ink/20">·</li>
              <li>5% platform fee</li>
              <li className="text-ink/20">·</li>
              <li>One tx · sub-cent gas</li>
            </ul>
          </Container>
        </section>

        <RedeemCreateWizard />

        <Footer />
      </main>
    </>
  );
}
