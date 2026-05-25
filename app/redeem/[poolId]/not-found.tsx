import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";

export default function RedeemPoolNotFound() {
  return (
    <>
      <Nav />
      <main id="main">
        <Container className="py-20 lg:py-28">
          <div className="max-w-xl">
            <AccentRule color="poppy">
              <MonoLabel>404 · Redeem pool</MonoLabel>
            </AccentRule>
            <h1 className="mt-3 font-display text-4xl leading-tight">
              No pool at that address.
            </h1>
            <p className="mt-3 text-pretty text-[15px] text-ink/65">
              Either the object ID doesn't exist, or it isn't a Pandabox redeem
              pool. Double-check the address — Sui object IDs are 32 bytes
              (64 hex). The discovery surface only lists known-good pools.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em]">
              <Link
                href="/redeem"
                className="inline-flex h-11 items-center gap-2 border border-ink bg-ink px-5 text-bone shadow-offset-sm transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
              >
                Back to redeem
              </Link>
              <Link
                href="/tools"
                className="inline-flex h-11 items-center gap-2 border border-ink bg-bone px-5 text-ink shadow-offset-sm transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
              >
                Onchain tools
              </Link>
            </div>
          </div>
        </Container>
        <Footer />
      </main>
    </>
  );
}
