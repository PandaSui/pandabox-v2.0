import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";
import { RedeemCreateWizard } from "@/components/redeem/create/wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("redeem.create.page");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function RedeemCreatePage() {
  const t = await getTranslations("redeem.create.page");
  return (
    <>
      <Nav />
      <main id="main">
        {/* Compact header — wizard chrome carries most of the weight. */}
        <section className="relative border-b border-ink/15">
          <Container className="flex flex-col gap-4 py-10 md:flex-row md:items-end md:justify-between md:py-12">
            <div className="max-w-2xl">
              <AccentRule color="sun">
                <MonoLabel>{t("eyebrow")}</MonoLabel>
              </AccentRule>
              <h1 className="mt-3 text-balance font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.02] tracking-tight">
                {t("headline")}
              </h1>
              <p className="mt-3 max-w-prose text-pretty text-[15px] text-ink/65">
                {t.rich("body", {
                  code: (chunks) => (
                    <code className="font-mono text-[13px]">{chunks}</code>
                  ),
                })}
              </p>
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 md:gap-x-5">
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden className="block h-1 w-1 rounded-full bg-sun" />
                {t("traitPermanent")}
              </li>
              <li className="text-ink/20">·</li>
              <li>{t("traitFee", { fee: "5" })}</li>
              <li className="text-ink/20">·</li>
              <li>{t("traitOneTx")}</li>
            </ul>
          </Container>
        </section>

        <RedeemCreateWizard />

        <Footer />
      </main>
    </>
  );
}
