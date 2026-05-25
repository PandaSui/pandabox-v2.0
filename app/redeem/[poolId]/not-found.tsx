import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks/footer";
import { Container } from "@/components/primitives/container";
import { AccentRule } from "@/components/primitives/accent-rule";
import { MonoLabel } from "@/components/primitives/mono-label";

export default async function RedeemPoolNotFound() {
  const t = await getTranslations("redeem.detail.notFound");
  return (
    <>
      <Nav />
      <main id="main">
        <Container className="py-20 lg:py-28">
          <div className="max-w-xl">
            <AccentRule color="poppy">
              <MonoLabel>{t("eyebrow")}</MonoLabel>
            </AccentRule>
            <h1 className="mt-3 font-display text-4xl leading-tight">
              {t("headline")}
            </h1>
            <p className="mt-3 text-pretty text-[15px] text-ink/65">
              {t("body")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em]">
              <Link
                href="/redeem"
                className="inline-flex h-11 items-center gap-2 border border-ink bg-ink px-5 text-bone shadow-offset-sm transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
              >
                {t("ctaBack")}
              </Link>
              <Link
                href="/tools"
                className="inline-flex h-11 items-center gap-2 border border-ink bg-bone px-5 text-ink shadow-offset-sm transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
              >
                {t("ctaTools")}
              </Link>
            </div>
          </div>
        </Container>
        <Footer />
      </main>
    </>
  );
}
