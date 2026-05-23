import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { DocsTabs, type DocsTab } from "@/components/docs";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How Pandabox works on Sui: sale window, base rate & allocation, contribute & claim, unsold supply, finalize & withdraw, plus a wizard walkthrough.",
};

// Tabs split a long single-scroll page into focused panels. Section ids
// remain unique across the whole document so deep links via `?tab=` + `#id`
// keep working even if we later reshuffle tabs.
const TABS: DocsTab[] = [
  {
    id: "mechanics",
    label: "Mechanics",
    sections: [
      { id: "how", label: "01 / How it works" },
      { id: "window", label: "02 / Sale window" },
      { id: "rate", label: "03 / Base rate & allocation" },
      { id: "claim", label: "04 / Contribute & claim" },
      { id: "unsold", label: "05 / Unsold supply" },
      { id: "finalize", label: "06 / Finalize & withdraw" },
    ],
  },
  {
    id: "wizard",
    label: "Walk the wizard",
    sections: [
      { id: "wizard-intro", label: "The four steps" },
      { id: "wizard-identity", label: "01 · Identity" },
      { id: "wizard-coin", label: "02 · Coin" },
      { id: "wizard-sale", label: "03 · Sale terms" },
      { id: "wizard-deploy", label: "04 · Review & deploy" },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    sections: [
      { id: "glossary", label: "Glossary" },
      { id: "faq", label: "FAQ" },
    ],
  },
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
            Three tabs. Mechanics is the protocol; Walk the wizard is the create
            flow; Reference holds the glossary and FAQ.
          </p>
        </Container>

        <Suspense fallback={null}>
          <DocsTabs
            tabs={TABS}
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

function MechanicsPanel() {
  return (
    <>
      <Section id="how" label="01 / How it works">
        <P>
          Pandabox is a Move package on Sui. A creator deploys a{" "}
          <Term>Project</Term> — a Sui object that owns a SUI treasury and a
          locked <Term>TreasuryCap</Term> for the project's own coin. The
          project then runs a single sale at a fixed rate: supporters contribute
          SUI and earn the right to claim project tokens at the configured
          price.
        </P>
        <P>
          Supporters don't receive tokens directly. They receive a{" "}
          <Term>ContributionReceipt</Term> — a transferable Sui NFT holding
          their entitlement. They <Term>claim</Term> their tokens by burning the
          receipt after the sale closes. Any payment that would exceed the
          remaining allocation is refunded in the same transaction.
        </P>
        <P>
          The sale ends in one of three ways: the configured end time arrives,
          the full allocation sells out, or the platform admin closes it. After
          close, the creator withdraws the raised SUI (minus a platform fee) and
          processes any unsold tokens per the policy they chose at deploy.
        </P>
        <TryIt href="/create" label="Start a draft project →" />
      </Section>

      <Section id="window" label="02 / Sale window">
        <P>
          Every sale has a single locked window. You set an{" "}
          <Term>end time</Term> at deploy — or leave it open and close the sale
          manually as admin. Until the sale finalizes, anyone can contribute at
          the fixed rate.
        </P>
        <P>
          Three things finalize a sale: the end time elapses (<Term>Time</Term>
          ), the allocation sells out (<Term>Sellout</Term>), or the admin
          force-closes it (<Term>Admin</Term>). Finalization is the gate for
          token claims, SUI withdrawal, and unsold-supply processing — none of
          those work while the sale is still active.
        </P>
        <P>
          Finalization can be triggered by the admin (<code>try_finalize</code>)
          or by anyone once the conditions are met (
          <code>permissionless_finalize</code>) — so a stalled creator can't
          trap supporters' claims after an end time has passed.
        </P>
        <TryIt
          href="/docs?tab=wizard#wizard-sale"
          label="See it in step 03 →"
        />
      </Section>

      <Section id="rate" label="03 / Base rate & allocation">
        <P>
          Two numbers govern the sale: the <Term>base rate</Term> (project
          tokens issued per 1 SUI) and the <Term>funding allocation</Term>{" "}
          (total project tokens to sell). Both are set at deploy and frozen for
          the life of the project — they can't be changed by metadata updates or
          admin actions.
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
        <P>
          If a contribution would push past the remaining allocation, only the
          affordable portion is accepted and the rest is refunded in the same
          transaction. Supporters never overpay.
        </P>
        <TryIt
          href="/docs?tab=wizard#wizard-sale"
          label="See it in step 03 →"
        />
      </Section>

      <Section id="claim" label="04 / Contribute & claim">
        <P>
          <Term>Contribute.</Term> A supporter calls <code>contribute</code>{" "}
          with a SUI coin. The project records the contribution against their
          address and returns a <Term>ContributionReceipt</Term> NFT — plus a
          refund coin if the payment exceeded what could be allocated.
        </P>
        <P>
          <Term>Claim.</Term> After the sale finalizes, the supporter burns
          their receipt with <code>claim</code> and receives the project tokens.
          Multiple receipts (from several contributions) can be burned together
          in one call via <code>claim_multiple</code>, returning a single merged
          coin.
        </P>
        <P>
          Receipts are regular Sui objects: transferable, sellable on secondary
          markets, and they don't expire. Claims remain open as long as the
          project object lives.
        </P>
        <TryIt href="/dashboard" label="View your receipts on Dashboard →" />
      </Section>

      <Section id="unsold" label="05 / Unsold supply">
        <P>
          If the sale closes with tokens left in the allocation, the creator
          runs <code>process_unsold</code> to execute the policy they picked at
          deploy:
        </P>
        <P>
          <Term>Burn</Term> — the unsold supply is destroyed, raising the
          implied price of every claimed token. Signals scarcity: the float is
          exactly what the sale raised.
        </P>
        <P>
          <Term>Transfer to creator</Term> — the unsold supply moves to the
          creator as a normal coin balance. Useful if you intend to seed
          liquidity, run a secondary sale, or hold a treasury position. The
          project page surfaces this as <code>UNSOLD → CREATOR</code> in the
          spec line so supporters see the policy before paying.
        </P>
        <TryIt
          href="/docs?tab=wizard#wizard-sale"
          label="See it in step 03 →"
        />
      </Section>

      <Section id="finalize" label="06 / Finalize & withdraw">
        <P>
          Once finalized, the creator calls <code>withdraw_sui</code> to pull
          raised SUI from the project treasury. The platform fee (in basis
          points, set by Pandabox) is skimmed automatically — the creator
          receives the net amount, the fee accrues to the platform treasury.
          Withdrawals can be partial; the cap holder can withdraw the rest
          later.
        </P>
        <P>
          The <Term>ProjectAdminCap</Term> minted at deploy is a regular Sui
          object. It moves via <code>transfer_project_admin</code> (which emits
          the event the indexer relies on — prefer this over a raw object
          transfer) or destroys itself via <code>renounce_project_admin</code>,
          leaving the project permanently un-administered — useful for community
          projects that want to remove themselves from the creator's discretion.
        </P>
        <P>
          Project metadata — name, description, icon URL, source-code blob, and
          the off-chain details JSON (tagline, category, socials) — stays
          editable via <code>update_metadata</code> whether the sale is active
          or closed.
        </P>
      </Section>
    </>
  );
}

/* ───────────────────────── Walk the wizard tab ───────────────────────── */

function WizardPanel() {
  return (
    <>
      <Section id="wizard-intro" label="The four steps">
        <P>
          The create flow is four steps. Everything you fill in here lands
          either on-chain (sale params, name, blob CIDs) or in the
          project_details JSON pinned to IPFS (tagline, category, socials). A
          live preview on the right shows exactly what supporters will see.
        </P>
        <TryIt href="/create" label="Open the wizard " />
      </Section>

      <Shot
        id="wizard-identity"
        src="/screenshots-doc/identity-docs.png"
        alt="Step 01 of the create wizard — identity fields next to a live project-page preview."
        step="01"
        title="Identity"
        caption="Project name, ticker, category, tagline, cover image, description. The ticker shown here is informational — the real coin symbol comes from the CoinMetadata you connect in the next step."
      />

      <Shot
        id="wizard-coin"
        src="/screenshots-doc/coin-docs.png"
        alt="Step 02 of the create wizard — connect or publish a Sui coin."
        step="02"
        title="Coin"
        caption="Pandabox needs its own Sui coin. Publish one from a pre-compiled coin_template.move (rewritten to your identifiers in-browser, pinned to IPFS for auditability) — or paste an existing TreasuryCap + CoinMetadata if you already have one. Decimals must be 9."
      />

      <Shot
        id="wizard-sale"
        src="/screenshots-doc/sales-terms.png"
        alt="Step 03 of the create wizard — sale terms: tokens-per-SUI rate, total allocation, end time, unsold policy."
        step="03"
        title="Sale terms"
        caption="The four numbers that get locked at deploy: base rate (tokens per 1 SUI), total allocation, optional end time, and unsold action (burn or transfer to creator). The implied max raise is derived live as you type."
      />

      <Shot
        id="wizard-deploy"
        src="/screenshots-doc/review-deploy-docs.png"
        alt="Step 04 of the create wizard — review and deploy."
        step="04"
        title="Review & deploy"
        caption="One Sui transaction creates the Project object, consumes your TreasuryCap + CoinMetadata into it, and returns a ProjectAdminCap to your wallet. The poppy notice spells out what becomes immutable on submit and what stays editable via update_metadata."
      />
    </>
  );
}

/* ─────────────────────────── Reference tab ─────────────────────────── */

function ReferencePanel() {
  return (
    <>
      <Section id="glossary" label="Glossary">
        <Glossary
          entries={[
            [
              "Project",
              "A shared Sui object holding the SUI treasury, the locked TreasuryCap<T>, and the sale parameters.",
            ],
            [
              "ProjectAdminCap",
              "Owned Sui object granting admin rights: withdraw SUI, process unsold, update metadata, finalize, transfer, renounce.",
            ],
            [
              "ContributionReceipt",
              "NFT minted on contribute. Burnable for the entitled tokens after finalize. Transferable like any Sui object.",
            ],
            [
              "Base rate",
              "Project tokens issued per 1 SUI of contribution. Frozen at deploy.",
            ],
            [
              "Funding allocation",
              "Total project tokens to sell. Once reached, sellout triggers. Frozen at deploy.",
            ],
            [
              "Unsold action",
              "Policy for tokens left at sale close: Burn, or Transfer to creator. Frozen at deploy.",
            ],
            [
              "End time",
              "Optional sale end timestamp. If null, only admin close or sellout can finalize.",
            ],
            [
              "Finalize",
              "Lock the sale. Required before claims, SUI withdrawal, or unsold processing. Permissionless once conditions are met.",
            ],
            [
              "Close trigger",
              "Why the sale ended: Time, Sellout, or Admin. Recorded on-chain.",
            ],
            [
              "Project status",
              "Active (selling), Closed (finalized), or Compromised (platform-flagged).",
            ],
            [
              "Platform fee",
              "Basis-point cut of withdrawn SUI taken by Pandabox. Set by the platform admin, applied at withdraw_sui.",
            ],
            ["MIST", "Smallest SUI unit. 1 SUI = 1,000,000,000 MIST."],
          ]}
        />
      </Section>

      <Section id="faq" label="FAQ">
        <FaqItem q="Is this audited?">
          Not yet. Pandabox is in testnet. A formal audit will land before the
          mainnet ramp.
        </FaqItem>
        <FaqItem q="Can I edit my project after deploy?">
          Yes for off-chain identity: name, description, cover image (icon URL),
          source-code blob, tagline, category, and social links all update via{" "}
          <code>update_metadata</code> at any time. No for sale economics: base
          rate, funding allocation, end time, and the unsold-supply policy are
          frozen at deploy. The coin's symbol and decimals are set by the coin
          module you deployed before Pandabox — those can't be changed here
          either.
        </FaqItem>
        <FaqItem q="How does gas work?">
          Every transaction is paid by the wallet that signs it. Create,
          contribute, claim, withdraw — all signer-paid. Sui gas is typically
          sub-cent at mainnet rates, so the practical cost to back a project is
          the SUI you contribute, not the gas.
        </FaqItem>
        <FaqItem q="What if a supporter never claims?">
          Receipts don't expire. The tokens stay locked in the project's
          TreasuryCap until the holder burns the receipt with <code>claim</code>
          . A receipt is a real Sui object, so it can also be transferred or
          sold to someone else who'll claim it.
        </FaqItem>
        <FaqItem q="Can I transfer the ProjectAdminCap?">
          Yes — use <code>transfer_project_admin</code> so the event lands in
          the indexer. The cap doesn't carry any project tokens or raised SUI;
          it's purely the admin key. You can also call{" "}
          <code>renounce_project_admin</code> to destroy it permanently — the
          project then runs without any admin at all.
        </FaqItem>
        <FaqItem q="What does the 'Compromised' status mean?">
          The platform admin can flag a project as Compromised when there's
          clear evidence of misuse (rug, impersonation, malware in claimed
          perks). It's a one-way moderation signal — the project page stays
          accessible so supporters can see the flag and act, but it warns
          clearly. It does not seize funds.
        </FaqItem>
        <FaqItem q="How do I get listed on the landing's featured row?">
          Featured is just sort by SUI raised, top three. Raise enough and you
          appear automatically.
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
}: {
  id: string;
  src: string;
  alt: string;
  step: string;
  title: string;
  caption: string;
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
          Step {step} · {title}
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

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
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
