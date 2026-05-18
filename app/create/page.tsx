import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { WizardShell } from "@/components/create";

export const metadata: Metadata = {
  title: "Create a project",
  description: "Configure cycles, tokens, payouts, and tiers. Deploy to Sui.",
};

export default function CreatePage() {
  return (
    <>
      <Nav />
      <main id="main">
        <section className="relative border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-3xl">
              <AccentRule color="saffron">
                <MonoLabel>Create</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-5xl">
                Configure your project, deploy in one transaction.
              </h1>
              <p className="mt-4 max-w-prose text-[15px] text-ink/65">
                Six steps. Drafts auto-save to your browser. The right rail
                shows exactly what supporters will see on your project page.
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-saffron" />
                one transaction
              </li>
              <li className="text-ink/20">·</li>
              <li>auto-saving draft</li>
              <li className="text-ink/20">·</li>
              <li>ipfs-pinned assets</li>
            </ul>
          </Container>
        </section>
        <WizardShell />
        <Footer />
      </main>
    </>
  );
}
