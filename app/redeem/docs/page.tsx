import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { DocsTabs, type DocsTab } from "@/components/docs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("redeem.docs.metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

/**
 * Documentation for the Redeem tool — separate from the launchpad docs at
 * `/docs` because the mental model is different enough that mixing them
 * confuses new users (one is "raise capital with a fixed-supply project",
 * the other is "deploy a permanent buyback pool"). Same tabbed-shell +
 * sticky-TOC layout for visual continuity, different content tree.
 *
 * Tab structure mirrors the launchpad docs:
 *   · Mechanics — how the contract actually works
 *   · Wizard    — five-step walkthrough of /redeem/create
 *   · Reference — glossary + FAQ
 *
 * Section ids are unique across the page so `?tab=…#…` deep links keep
 * working if tabs ever get reshuffled.
 */
export default async function RedeemDocsPage() {
  const t = await getTranslations("redeem.docs");

  const TABS: DocsTab[] = [
    {
      id: "mechanics",
      label: t("tabs.mechanics.label"),
      sections: [
        { id: "what-is-a-pool", label: t("tabs.mechanics.sections.what") },
        { id: "recipient", label: t("tabs.mechanics.sections.recipient") },
        { id: "rate", label: t("tabs.mechanics.sections.rate") },
        { id: "reserve", label: t("tabs.mechanics.sections.reserve") },
        { id: "permanence", label: t("tabs.mechanics.sections.permanence") },
        { id: "fee", label: t("tabs.mechanics.sections.fee") },
      ],
    },
    {
      id: "wizard",
      label: t("tabs.wizard.label"),
      sections: [
        { id: "wizard-intro", label: t("tabs.wizard.sections.intro") },
        { id: "wizard-coin", label: t("tabs.wizard.sections.coin") },
        { id: "wizard-rate", label: t("tabs.wizard.sections.rate") },
        { id: "wizard-recipient", label: t("tabs.wizard.sections.recipient") },
        { id: "wizard-reserve", label: t("tabs.wizard.sections.reserve") },
        { id: "wizard-deploy", label: t("tabs.wizard.sections.deploy") },
      ],
    },
    {
      id: "reference",
      label: t("tabs.reference.label"),
      sections: [
        { id: "glossary", label: t("tabs.reference.sections.glossary") },
        { id: "faq", label: t("tabs.reference.sections.faq") },
      ],
    },
  ];

  return (
    <>
      <Nav />
      <main id="main">
        <Container className="border-b border-ink/15 py-8">
          <MonoLabel>{t("eyebrow")}</MonoLabel>
          <h1 className="mt-2 text-3xl md:text-4xl">{t("heading")}</h1>
          <p className="mt-2 max-w-prose text-sm text-ink/60">
            {t("subhead")}
          </p>
        </Container>

        <Suspense fallback={null}>
          <DocsTabs
            tabs={TABS}
            ariaLabel={t("tabs.ariaLabel")}
            panels={{
              mechanics: <MechanicsPanel />,
              wizard: <WizardPanel />,
              reference: <ReferencePanel />,
            }}
          />
        </Suspense>

        <Footer />
      </main>
    </>
  );
}

/* ─────────────────────────── Mechanics tab ─────────────────────────── */

async function MechanicsPanel() {
  const t = await getTranslations("redeem.docs.mechanics");
  return (
    <>
      <Section id="what-is-a-pool" label={t("what.label")}>
        <P>
          {t.rich("what.p1", { term: (chunks) => <Term>{chunks}</Term> })}
        </P>
        <P>
          {t.rich("what.p2", { term: (chunks) => <Term>{chunks}</Term> })}
        </P>
        <P>{t("what.p3")}</P>
        <TryIt href="/redeem/create" label={t("what.cta")} />
      </Section>

      <Section id="recipient" label={t("recipient.label")}>
        <P>
          {t.rich("recipient.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("recipient.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>{t("recipient.p3")}</P>
      </Section>

      <Section id="rate" label={t("rate.label")}>
        <P>
          {t.rich("rate.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <Code>
          price_mist_per_token = rate (SUI/token) × 1,000,000,000
          <br />
          example: 0.5 SUI/token → price_mist_per_token = 500,000,000
          <br />
          on redeem: sui_gross = coin_in × price / 10^coin_decimals
        </Code>
        <P>{t("rate.p2")}</P>
        <TryIt href="/redeem/create" label={t("rate.cta")} />
      </Section>

      <Section id="reserve" label={t("reserve.label")}>
        <P>
          {t.rich("reserve.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("reserve.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>{t("reserve.p3")}</P>
      </Section>

      <Section id="permanence" label={t("permanence.label")}>
        <P>
          {t.rich("permanence.p1", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("permanence.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
      </Section>

      <Section id="fee" label={t("fee.label")}>
        <P>
          {t.rich("fee.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>
          {t.rich("fee.p2", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
      </Section>
    </>
  );
}

/* ─────────────────────────── Wizard tab ─────────────────────────── */

async function WizardPanel() {
  const t = await getTranslations("redeem.docs.wizard");
  return (
    <>
      <Section id="wizard-intro" label={t("intro.label")}>
        <P>{t("intro.p1")}</P>
        <TryIt href="/redeem/create" label={t("intro.cta")} />
      </Section>

      <Section id="wizard-coin" label={t("coin.label")}>
        <P>
          {t.rich("coin.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>{t("coin.p2")}</P>
      </Section>

      <Section id="wizard-rate" label={t("rate.label")}>
        <P>
          {t.rich("rate.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>
          {t.rich("rate.p2", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
      </Section>

      <Section id="wizard-recipient" label={t("recipient.label")}>
        <P>
          {t.rich("recipient.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>{t("recipient.p2")}</P>
      </Section>

      <Section id="wizard-reserve" label={t("reserve.label")}>
        <P>
          {t.rich("reserve.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>{t("reserve.p2")}</P>
      </Section>

      <Section id="wizard-deploy" label={t("deploy.label")}>
        <P>
          {t.rich("deploy.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>{t("deploy.p2")}</P>
      </Section>
    </>
  );
}

/* ─────────────────────────── Reference tab ─────────────────────────── */

async function ReferencePanel() {
  const t = await getTranslations("redeem.docs.reference");
  return (
    <>
      <Section id="glossary" label={t("glossary.label")}>
        <Glossary
          entries={[
            ["RedeemPool<T>", t("glossary.terms.pool")],
            [t("glossary.termLabels.recipient"), t("glossary.terms.recipient")],
            [t("glossary.termLabels.buyback"), t("glossary.terms.buyback")],
            [t("glossary.termLabels.burn"), t("glossary.terms.burn")],
            [t("glossary.termLabels.reserve"), t("glossary.terms.reserve")],
            ["price_mist_per_token", t("glossary.terms.priceMistPerToken")],
            [t("glossary.termLabels.coinIn"), t("glossary.terms.coinIn")],
            [t("glossary.termLabels.coinDecimals"), t("glossary.terms.coinDecimals")],
            [t("glossary.termLabels.platformFee"), t("glossary.terms.platformFee")],
            ["MIST", t("glossary.terms.mist")],
            ["CoinMetadata<T>", t("glossary.terms.coinMetadata")],
          ]}
        />
      </Section>

      <Section id="faq" label={t("faq.label")}>
        <FaqItem q={t("faq.items.changeRate.q")}>
          {t.rich("faq.items.changeRate.a", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </FaqItem>
        <FaqItem q={t("faq.items.withdrawReserve.q")}>
          {t("faq.items.withdrawReserve.a")}
        </FaqItem>
        <FaqItem q={t("faq.items.duplicatePools.q")}>
          {t("faq.items.duplicatePools.a")}
        </FaqItem>
        <FaqItem q={t("faq.items.metadataOwner.q")}>
          {t.rich("faq.items.metadataOwner.a", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </FaqItem>
        <FaqItem q={t("faq.items.whoCanDeposit.q")}>
          {t("faq.items.whoCanDeposit.a")}
        </FaqItem>
        <FaqItem q={t("faq.items.fee.q")}>{t("faq.items.fee.a")}</FaqItem>
        <FaqItem q={t("faq.items.paused.q")}>{t("faq.items.paused.a")}</FaqItem>
      </Section>
    </>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function Section({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  const parts = label.split(" / ");
  const hasNumber = parts.length > 1;
  return (
    <section id={id} className="scroll-mt-32">
      {hasNumber && <MonoLabel className="block">{parts[0]}</MonoLabel>}
      <h2 className={hasNumber ? "mt-2 text-2xl" : "text-2xl"}>
        {hasNumber ? parts[1] : label}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Term({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto border border-ink/15 bg-bone/40 p-3 font-mono text-xs leading-relaxed text-ink/80">
      {children}
    </pre>
  );
}

function TryIt({ href, label }: { href: string; label: string }) {
  return (
    <p className="pt-2">
      <Link
        href={href}
        className="font-mono-label text-saffron underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    </p>
  );
}

function Glossary({ entries }: { entries: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      {entries.map(([term, def], i) => (
        <Row key={typeof term === "string" ? term : i} term={term} def={def} />
      ))}
    </dl>
  );
}

function Row({ term, def }: { term: string; def: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono-label text-ink/70">{term}</dt>
      <dd className="text-sm text-ink/75">{def}</dd>
    </>
  );
}

function FaqItem({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-ink/15 py-3">
      <summary className="flex cursor-pointer items-baseline justify-between gap-3 list-none">
        <span className="text-base text-ink">{q}</span>
        <span className="font-mono text-xs text-ink/40 group-open:rotate-45 transition-transform">
          +
        </span>
      </summary>
      <p className="mt-2 text-sm text-ink/70">{children}</p>
    </details>
  );
}
