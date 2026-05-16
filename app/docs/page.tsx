import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Toc, type DocSection } from "@/components/docs";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How Pandabox works: cycles, reserved rate, cash-out tax, NFT tiers, ballot delay.",
};

const SECTIONS: DocSection[] = [
  { id: "how", label: "How Pandabox works" },
  { id: "cycles", label: "Funding cycles" },
  { id: "reserved", label: "Reserved rate" },
  { id: "cashout", label: "Cash-out tax" },
  { id: "tiers", label: "NFT tiers" },
  { id: "ballot", label: "Ballot delay" },
  { id: "glossary", label: "Glossary" },
  { id: "faq", label: "FAQ" },
];

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main id="main">
        <Container className="border-b border-ink/15 py-8">
          <MonoLabel>Docs</MonoLabel>
          <h1 className="mt-2 text-3xl md:text-4xl">
            How Pandabox actually works.
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink/60">
            Eight short sections. No marketing copy — just the mechanics. Try-it
            links jump into the relevant wizard step or explorer filter.
          </p>
        </Container>

        <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1fr_3fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Toc sections={SECTIONS} />
          </aside>

          <article className="max-w-prose space-y-16 text-[15px] leading-relaxed text-ink/85">
            <Section id="how" label="01 / How it works">
              <P>
                Pandabox is a Move package on Sui. A creator deploys a{" "}
                <Term>Project</Term> — a Sui object that owns a treasury. Over
                time the project runs <Term>funding cycles</Term>: locked
                windows during which supporters pay SUI and receive project
                tokens at a fixed rate.
              </P>
              <P>
                Newly minted tokens split between supporters and a{" "}
                <Term>reserved rate</Term> that the creator pre-allocates to
                team or partners. SUI in the treasury is bounded by a{" "}
                <Term>payout limit</Term> per cycle — anything above is{" "}
                <Term>surplus</Term>, which token holders can{" "}
                <Term>cash out</Term> against by burning their tokens.
              </P>
              <TryIt href="/create" label="Start a draft project →" />
            </Section>

            <Section id="cycles" label="02 / Funding cycles">
              <P>
                Each cycle is a fixed window — 3, 7, 14, or 30 days are typical
                — during which all parameters are frozen. New payments can only
                use the parameters set when the cycle opened. Reconfigurations
                queue and take effect at the next cycle boundary, after the{" "}
                <Term>ballot delay</Term>.
              </P>
              <P>
                The <Term>weight</Term> sets how many tokens you mint per SUI
                paid. The <Term>issuance reduction</Term> (0–20%) decreases the
                weight automatically each cycle — rewarding early supporters.
              </P>
              <Code>
                Cycle Nº1 · weight 1,000,000 · 14d window<br />
                Cycle Nº2 · weight 950,000 (5% reduction) · 14d window<br />
                Cycle Nº3 · weight 902,500 · 14d window
              </Code>
              <TryIt href="/create" label="Configure cycles in step 02 →" />
            </Section>

            <Section id="reserved" label="03 / Reserved rate">
              <P>
                Of every batch of tokens minted, the <Term>reserved rate</Term>{" "}
                (0–50%) is held back from supporters and split among
                pre-programmed addresses — typically team, treasury, or
                contractors. Reserved tokens behave like any other project
                tokens: tradable, cash-outable, voteable.
              </P>
              <P>
                Splits are stored as on-chain shares that sum to 100%. Edit
                them via a reconfiguration after the ballot delay; the new
                split applies to cycles opened after the change settles.
              </P>
              <TryIt href="/create" label="Set reserved rate in step 03 →" />
            </Section>

            <Section id="cashout" label="04 / Cash-out tax">
              <P>
                The <Term>cash-out tax</Term> (0–100%) is the penalty applied
                when a holder burns tokens to claim a slice of surplus. A high
                tax discourages early cash-outs — useful for projects that want
                supporters committed across multiple cycles. A low tax means
                supporters can rotate in and out freely.
              </P>
              <P>
                The math: <code>cash_out_value = (holder_share × surplus) ×
                (1 − tax)</code>. A 0% tax returns the full proportional share;
                a 100% tax means surplus is locked until a reconfiguration
                changes the rate.
              </P>
              <TryIt href="/explore" label="See live cash-out values on Explore →" />
            </Section>

            <Section id="tiers" label="05 / NFT tiers">
              <P>
                Optional. A project can define up to 10 <Term>tiers</Term> —
                priced in SUI, optionally capped in supply, with on-chain perk
                copy. Paying ≥ the tier price mints both the tier NFT and the
                project tokens for that amount. Tiers above the floor stack:
                the supporter receives the highest tier their payment qualifies
                for.
              </P>
              <P>
                Tier images and perks copy are editable post-deploy; tier name,
                price, and max supply are not. Reserve a tier or two for later
                cycles if you want flexibility.
              </P>
              <TryIt href="/create" label="Add tiers in step 05 →" />
            </Section>

            <Section id="ballot" label="06 / Ballot delay">
              <P>
                The <Term>ballot delay</Term> is the minimum time between
                queueing a reconfiguration and it taking effect. It's the trust
                guarantee: supporters in the current cycle know the rules can't
                change under them. Typical values: 1 day, 3 days, 7 days. Set
                to zero only if you genuinely don't need supporter trust.
              </P>
              <P>
                Queued reconfigurations are public — every project page shows a
                sky-bordered banner with the summary and effective time when a
                reconfig is in flight.
              </P>
              <TryIt
                href="/explore"
                label="Find projects with queued reconfigs →"
              />
            </Section>

            <Section id="glossary" label="07 / Glossary">
              <Glossary
                entries={[
                  ["Project", "A Sui object owning a treasury, governed by cycles."],
                  ["AdminCap", "Sui object granting admin rights — queue reconfigs, distribute payouts, transfer to multisig."],
                  ["Cycle", "A locked funding window. Parameters frozen mid-cycle; changes queue for next."],
                  ["Weight", "Tokens minted per 1 SUI of inflow this cycle."],
                  ["Reserved rate", "0–50% of newly minted tokens held back for team/partners."],
                  ["Issuance reduction", "0–20% decrease of weight each cycle. Rewards early supporters."],
                  ["Payout limit", "Max SUI distributable per cycle. Anything above becomes surplus."],
                  ["Surplus", "SUI above the payout limit. Reclaimable by holders via cash-out."],
                  ["Cash-out tax", "Penalty (0–100%) on burning tokens to claim surplus share."],
                  ["Ballot delay", "Time a reconfiguration must wait before activating."],
                  ["Tier", "Optional NFT supporter pass at a fixed price + optional supply cap."],
                  ["MIST", "Smallest SUI unit. 1 SUI = 1,000,000,000 MIST."],
                ]}
              />
            </Section>

            <Section id="faq" label="08 / FAQ">
              <FaqItem q="Is this audited?">
                Not yet. Pandabox is in testnet. A formal audit will land before
                the mainnet ramp.
              </FaqItem>
              <FaqItem q="Can I edit my project after deploy?">
                Cover image, tagline, description, social links, and tier
                images/perks copy — yes, anytime. Name, ticker, weight, first
                cycle start, reserved rate, and cash-out tax — only via queued
                reconfiguration, settling after the ballot delay.
              </FaqItem>
              <FaqItem q="How does gas work?">
                Pandabox sponsors gas on the create flow so a fresh wallet can
                deploy without holding SUI first. Pay transactions are paid by
                the supporter; expected gas is sub-cent on mainnet.
              </FaqItem>
              <FaqItem q="What happens to surplus if no one cashes out?">
                It stays in the treasury until claimed. The reconfiguration
                flow includes a setting that routes un-claimed surplus to the
                project owner after a configurable horizon — or burns it.
              </FaqItem>
              <FaqItem q="Can I transfer the AdminCap?">
                Yes — it's a regular Sui object. Transfer to a multisig for
                decentralized governance, or to a successor team. The cap
                doesn't carry project tokens; those move separately.
              </FaqItem>
              <FaqItem q="How do I get listed on the landing's featured row?">
                "Featured" is just sort = most funded, top 3. Raise enough and
                you appear automatically.
              </FaqItem>
            </Section>
          </article>
        </Container>

        <Footer />
      </main>
    </>
  );
}

function Section({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <MonoLabel className="block">{label}</MonoLabel>
      <h2 className="mt-2 text-2xl">{label.split(" / ")[1]}</h2>
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

function Glossary({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      {entries.map(([term, def]) => (
        <Row key={term} term={term} def={def} />
      ))}
    </dl>
  );
}

function Row({ term, def }: { term: string; def: string }) {
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
