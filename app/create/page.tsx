import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
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
        <Container className="border-b border-ink/15 py-8">
          <MonoLabel>Create</MonoLabel>
          <h1 className="mt-2 text-3xl md:text-4xl">
            Configure your project, deploy in one transaction.
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink/60">
            Six steps. Drafts auto-save to your browser. The right rail shows
            exactly what supporters will see on your project page.
          </p>
        </Container>
        <WizardShell />
        <Footer />
      </main>
    </>
  );
}
