import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { DocsTabs, type DocsTab } from "@/components/docs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function DocsPage() {
  const t = await getTranslations("docs");

  // Tabs split a long single-scroll page into focused panels. Section ids
  // remain unique across the whole document so deep links via `?tab=` + `#id`
  // keep working even if we later reshuffle tabs.
  const TABS: DocsTab[] = [
    {
      id: "mechanics",
      label: t("tabs.mechanics.label"),
      sections: [
        { id: "how", label: t("tabs.mechanics.sections.how") },
        { id: "window", label: t("tabs.mechanics.sections.window") },
        { id: "rate", label: t("tabs.mechanics.sections.rate") },
        { id: "claim", label: t("tabs.mechanics.sections.claim") },
        { id: "unsold", label: t("tabs.mechanics.sections.unsold") },
        { id: "finalize", label: t("tabs.mechanics.sections.finalize") },
      ],
    },
    {
      id: "wizard",
      label: t("tabs.wizard.label"),
      sections: [
        { id: "wizard-intro", label: t("tabs.wizard.sections.intro") },
        { id: "wizard-identity", label: t("tabs.wizard.sections.identity") },
        { id: "wizard-coin", label: t("tabs.wizard.sections.coin") },
        { id: "wizard-sale", label: t("tabs.wizard.sections.sale") },
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
          <p className="mt-2 max-w-prose text-sm text-ink/60">{t("subhead")}</p>
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
  const t = await getTranslations("docs.mechanics");
  return (
    <>
      <Section id="how" label={t("how.label")}>
        <P>
          {t.rich("how.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>
          {t.rich("how.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>{t("how.p3")}</P>
        <TryIt href="/create" label={t("how.cta")} />
      </Section>

      <Section id="window" label={t("window.label")}>
        <P>
          {t.rich("window.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>
          {t.rich("window.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>
          {t.rich("window.p3", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <TryIt
          href="/docs?tab=wizard#wizard-sale"
          label={t("window.cta")}
        />
      </Section>

      <Section id="rate" label={t("rate.label")}>
        <P>
          {t.rich("rate.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <Code>
          base rate = 1,000 tokens / SUI
          <br />
          funding alloc. = 1,000,000 tokens
          <br />
          implied max raise = 1,000 SUI
          <br />
          if a supporter pays 12 SUI → entitled to 12,000 tokens
        </Code>
        <P>{t("rate.p2")}</P>
        <TryIt
          href="/docs?tab=wizard#wizard-sale"
          label={t("rate.cta")}
        />
      </Section>

      <Section id="claim" label={t("claim.label")}>
        <P>
          {t.rich("claim.p1", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("claim.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>{t("claim.p3")}</P>
        <TryIt href="/dashboard" label={t("claim.cta")} />
      </Section>

      <Section id="unsold" label={t("unsold.label")}>
        <P>
          {t.rich("unsold.p1", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("unsold.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
          })}
        </P>
        <P>
          {t.rich("unsold.p3", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <TryIt
          href="/docs?tab=wizard#wizard-sale"
          label={t("unsold.cta")}
        />
      </Section>

      <Section id="finalize" label={t("finalize.label")}>
        <P>
          {t.rich("finalize.p1", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("finalize.p2", {
            term: (chunks) => <Term>{chunks}</Term>,
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
        <P>
          {t.rich("finalize.p3", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </P>
      </Section>
    </>
  );
}

/* ───────────────────────── Walk the wizard tab ───────────────────────── */

async function WizardPanel() {
  const t = await getTranslations("docs.wizard");
  return (
    <>
      <Section id="wizard-intro" label={t("intro.label")}>
        <P>{t("intro.p1")}</P>
        <TryIt href="/create" label={t("intro.cta")} />
      </Section>

      <Shot
        id="wizard-identity"
        src="/screenshots-doc/identity-docs.png"
        alt={t("steps.identity.alt")}
        step="01"
        title={t("steps.identity.title")}
        caption={t("steps.identity.caption")}
        stepWord={t("stepWord")}
      />

      <Shot
        id="wizard-coin"
        src="/screenshots-doc/coin-docs.png"
        alt={t("steps.coin.alt")}
        step="02"
        title={t("steps.coin.title")}
        caption={t("steps.coin.caption")}
        stepWord={t("stepWord")}
      />

      <Shot
        id="wizard-sale"
        src="/screenshots-doc/sales-terms.png"
        alt={t("steps.sale.alt")}
        step="03"
        title={t("steps.sale.title")}
        caption={t("steps.sale.caption")}
        stepWord={t("stepWord")}
      />

      <Shot
        id="wizard-deploy"
        src="/screenshots-doc/review-deploy-docs.png"
        alt={t("steps.deploy.alt")}
        step="04"
        title={t("steps.deploy.title")}
        caption={t("steps.deploy.caption")}
        stepWord={t("stepWord")}
      />
    </>
  );
}

/* ─────────────────────────── Reference tab ─────────────────────────── */

async function ReferencePanel() {
  const t = await getTranslations("docs.reference");
  return (
    <>
      <Section id="glossary" label={t("glossary.label")}>
        <Glossary
          entries={[
            ["Project", t("glossary.terms.project")],
            ["ProjectAdminCap", t("glossary.terms.projectAdminCap")],
            ["ContributionReceipt", t("glossary.terms.contributionReceipt")],
            [t("glossary.termLabels.baseRate"), t("glossary.terms.baseRate")],
            [
              t("glossary.termLabels.fundingAllocation"),
              t("glossary.terms.fundingAllocation"),
            ],
            [
              t("glossary.termLabels.unsoldAction"),
              t("glossary.terms.unsoldAction"),
            ],
            [t("glossary.termLabels.endTime"), t("glossary.terms.endTime")],
            [
              t("glossary.termLabels.finalize"),
              t("glossary.terms.finalize"),
            ],
            [
              t("glossary.termLabels.closeTrigger"),
              t("glossary.terms.closeTrigger"),
            ],
            [
              t("glossary.termLabels.projectStatus"),
              t("glossary.terms.projectStatus"),
            ],
            [
              t("glossary.termLabels.platformFee"),
              t("glossary.terms.platformFee"),
            ],
            ["MIST", t("glossary.terms.mist")],
          ]}
        />
      </Section>

      <Section id="faq" label={t("faq.label")}>
        <FaqItem q={t("faq.items.audited.q")}>{t("faq.items.audited.a")}</FaqItem>
        <FaqItem q={t("faq.items.editAfterDeploy.q")}>
          {t.rich("faq.items.editAfterDeploy.a", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </FaqItem>
        <FaqItem q={t("faq.items.gas.q")}>{t("faq.items.gas.a")}</FaqItem>
        <FaqItem q={t("faq.items.neverClaims.q")}>
          {t.rich("faq.items.neverClaims.a", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </FaqItem>
        <FaqItem q={t("faq.items.transferCap.q")}>
          {t.rich("faq.items.transferCap.a", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </FaqItem>
        <FaqItem q={t("faq.items.compromised.q")}>
          {t("faq.items.compromised.a")}
        </FaqItem>
        <FaqItem q={t("faq.items.featured.q")}>
          {t("faq.items.featured.a")}
        </FaqItem>
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
  // Labels formatted as "NN / Title" render eyebrow + heading; bare labels
  // (single section per tab, or unnumbered Reference items) skip the
  // eyebrow so the heading isn't visually duplicated.
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

function Shot({
  id,
  src,
  alt,
  step,
  title,
  caption,
  stepWord,
}: {
  id: string;
  src: string;
  alt: string;
  step: string;
  title: string;
  caption: string;
  stepWord: string;
}) {
  return (
    <figure id={id} className="scroll-mt-32 border border-ink/15 bg-bone">
      <Image
        src={src}
        alt={alt}
        width={2996}
        height={1590}
        className="block h-auto w-full border-b border-ink/15"
        sizes="(min-width: 1024px) 700px, 100vw"
      />
      <figcaption className="px-4 py-3">
        <MonoLabel className="block text-[10px]">
          {stepWord} {step} · {title}
        </MonoLabel>
        <p className="mt-1.5 text-sm text-ink/70">{caption}</p>
      </figcaption>
    </figure>
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
