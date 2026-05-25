import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { WizardShell } from "@/components/create";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("create.page");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function CreatePage() {
  const t = await getTranslations("create.page");
  const tNav = await getTranslations("nav.links");
  return (
    <>
      <Nav />
      <main id="main">
        <section className="relative border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-3xl">
              <AccentRule color="saffron">
                <MonoLabel>{tNav("create")}</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 font-display text-3xl leading-[1.05] md:text-5xl">
                {t("headline")}
              </h1>
              <p className="mt-4 max-w-prose text-[15px] text-ink/65">
                {t("intro")}
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              <li className="inline-flex items-center gap-1.5">
                <span className="block h-1 w-1 rounded-full bg-saffron" />
                {t("badgeOneTransaction")}
              </li>
              <li className="text-ink/20">·</li>
              <li>{t("badgeAutoSaving")}</li>
              <li className="text-ink/20">·</li>
              <li>{t("badgeIpfs")}</li>
            </ul>
          </Container>
        </section>
        <WizardShell />
        <Footer />
      </main>
    </>
  );
}
