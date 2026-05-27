import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { DocsTabs, type DocsTab } from "@/components/docs";
import {
  AIRDROP_PACKAGE_ID,
  AIRDROP_PLATFORM_ID,
  AIRDROP_TARGET,
} from "@/lib/contracts/airdrop";

/**
 * Documentation for the Airdrop tool — separate from the launchpad docs
 * and from `/redeem/docs` for the same reason: the mental model differs
 * enough that mixing them confuses new users. Same DocsTabs + sticky-TOC
 * layout as `/redeem/docs`.
 *
 * Three tabs:
 *   · Mechanics — what the contract does, fees, cap, atomicity
 *   · CSV format — exactly what to paste, with worked examples
 *   · Reference — glossary, FAQ, common abort codes
 *
 * Content is inlined (not i18n-threaded) for now — the airdrop UI
 * already ships EN-as-placeholder for non-EN locales, and this page is
 * launching alongside it. A translation pass can lift the strings into
 * `messages/*.json` later without restructuring the page.
 */

export const metadata: Metadata = {
  title: "Airdrop docs · Pandabox",
  description:
    "How the Pandabox Airdrop tool works on Sui — fee mechanics, batch behaviour, CSV format, and common abort codes.",
};

export default function AirdropDocsPage() {
  const TABS: DocsTab[] = [
    {
      id: "mechanics",
      label: "Mechanics",
      sections: [
        { id: "what", label: "What it does" },
        { id: "atomicity", label: "Atomicity" },
        { id: "fee", label: "Fee" },
        { id: "cap", label: "Recipient cap" },
        { id: "batching", label: "Batching" },
        { id: "memo", label: "Memo" },
      ],
    },
    {
      id: "csv-format",
      label: "CSV format",
      sections: [
        { id: "supported-formats", label: "Supported formats" },
        { id: "addresses", label: "Addresses" },
        { id: "amounts", label: "Amounts" },
        { id: "duplicates", label: "Duplicates" },
        { id: "comments", label: "Comments" },
      ],
    },
    {
      id: "reference",
      label: "Reference",
      sections: [
        { id: "glossary", label: "Glossary" },
        { id: "faq", label: "FAQ" },
        { id: "aborts", label: "Abort codes" },
        { id: "contract", label: "Contract" },
      ],
    },
  ];

  return (
    <>
      <Nav />
      <main id="main">
        <Container className="border-b border-ink/15 py-8">
          <MonoLabel>Onchain · Airdrop · Docs</MonoLabel>
          <h1 className="mt-2 text-3xl md:text-4xl">How airdrops work</h1>
          <p className="mt-2 max-w-prose text-sm text-ink/60">
            Everything the contract enforces, everything the composer
            checks before you sign, and the CSV shape the parser expects.
          </p>
        </Container>

        <Suspense fallback={null}>
          <DocsTabs
            tabs={TABS}
            ariaLabel="Airdrop docs navigation"
            panels={{
              mechanics: <MechanicsPanel />,
              "csv-format": <CsvFormatPanel />,
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
      <Section id="what" label="01 / What it does">
        <P>
          The Airdrop tool fans a single Sui coin out to a list of recipient
          addresses in one signed transaction. You pick an asset, paste a list
          of <Term>address, amount</Term> rows, and the contract distributes
          the coin atomically — every recipient receives their share inside
          the same Programmable Transaction Block.
        </P>
        <P>
          The contract is one generic Move function:{" "}
          <code>airdrop::airdrop::airdrop&lt;T&gt;</code>. You hold the funds
          until you sign — the tool never custodies your coin. Each PTB is
          signed by your wallet directly; nothing is escrowed, nothing is
          delayed.
        </P>
        <TryIt href="/airdrop" label="Open the composer →" />
      </Section>

      <Section id="atomicity" label="02 / Atomicity">
        <P>
          A PTB is all-or-nothing. If any single transfer inside a batch fails
          — invalid address, integer overflow, gas exhaustion — the entire
          batch reverts. There are no partial drops, no recipients left
          half-paid, no stuck transactions to clean up.
        </P>
        <P>
          The composer mirrors this guarantee at the UI layer: every address
          is validated locally before you sign, every amount is checked
          against your spendable balance, every batch is sized to fit inside
          the on-chain cap.
        </P>
      </Section>

      <Section id="fee" label="03 / Fee">
        <P>
          The platform charges a flat fee in SUI per recipient. The fee is
          stored on-chain in <code>AirdropPlatform.fee_per_recipient_mist</code>{" "}
          (MIST units; 1 SUI = 10⁹ MIST) — the composer reads the live value
          on every page load and recomputes your pre-flight strip
          accordingly.
        </P>
        <P>
          Fee math:{" "}
          <code>fee_mist = recipients.length × fee_per_recipient_mist</code>.
          For the current live value (0.001 SUI per recipient), a 250-row
          airdrop costs 0.25 SUI in fees — paid alongside the gas budget when
          you sign.
        </P>
        <P>
          Fees route to a dedicated treasury address (also stored on-chain in{" "}
          <code>AirdropPlatform.treasury_address</code>). The transaction
          inspector shows you the destination before you sign.
        </P>
      </Section>

      <Section id="cap" label="04 / Recipient cap">
        <P>
          The contract enforces a per-PTB ceiling via{" "}
          <code>AirdropPlatform.max_recipients</code>. Today that limit is{" "}
          <Term>300</Term>. Passing more rows would abort the transaction
          before the first transfer fires.
        </P>
        <P>
          Lists larger than the cap aren&apos;t rejected by the composer —
          they&apos;re split into sequential batches automatically (see{" "}
          <Term>Batching</Term> below).
        </P>
      </Section>

      <Section id="batching" label="05 / Batching">
        <P>
          When your recipient count exceeds the cap, the composer slices the
          list into <code>⌈count / cap⌉</code> equal-sized batches and walks
          them sequentially. Each batch is its own signed PTB — your wallet
          will prompt once per batch.
        </P>
        <P>
          Between batches the composer refetches your wallet&apos;s coin
          objects, so the next batch picks its input coins from the
          post-tx state. If you start with one large <code>Coin&lt;T&gt;</code>{" "}
          object, the PTB merges it once, splits the exact amount, and
          returns a leftover that the wallet keeps.
        </P>
        <P>
          If a mid-flight batch fails, completed batches are retained. The
          inspector&apos;s retry CTA restarts the loop; today it replays from
          batch one, but the on-chain state from earlier batches is permanent
          and can&apos;t be reversed.
        </P>
      </Section>

      <Section id="memo" label="06 / Memo">
        <P>
          The optional memo is recorded on-chain in the{" "}
          <code>Airdropped</code> event log as a{" "}
          <code>memo: Option&lt;String&gt;</code> field, capped at 256 chars.
          Useful for tagging distributions (&quot;May contributor rewards&quot;,
          &quot;Q2 LP rebate&quot;) so the activity feed reads as a self-
          documenting ledger.
        </P>
        <P>
          The memo is public. It&apos;s indexed by the chain and visible to
          anyone querying the event stream — treat it like a commit message,
          not like a private note.
        </P>
      </Section>
    </>
  );
}

/* ─────────────────────────── CSV format tab ─────────────────────────── */

function CsvFormatPanel() {
  return (
    <>
      <Section id="supported-formats" label="01 / Supported formats">
        <P>
          The parser is deliberately lenient about delimiters. Each line is
          split on the most-likely separator in this priority order: tab
          &gt; comma &gt; semicolon &gt; whitespace. Whatever your
          spreadsheet exports, the parser handles it.
        </P>
        <Code>{`# CSV (comma)
0x1111…1111,1.5
0x2222…2222,12

# TSV (tab)
0x1111\\t1.5

# Semicolon
0x1111…1111; 1.5

# Whitespace
0x1111…1111  1.5`}</Code>
        <P>
          JSON is also supported — paste an array of objects or tuples and
          the parser detects the shape from the leading <code>[</code> or{" "}
          <code>{`{`}</code>:
        </P>
        <Code>{`[
  { "address": "0x1111…1111", "amount": 1.5 },
  { "address": "0x2222…2222", "amount": 12 }
]

# tuples work too:
[
  ["0x1111…1111", 1.5],
  ["0x2222…2222", 12]
]`}</Code>
        <P>
          Object keys are aliased: <code>address / recipient / to / wallet</code>{" "}
          and <code>amount / value / qty / tokens / balance</code> are all
          accepted, so most third-party export shapes work without massaging.
        </P>
      </Section>

      <Section id="addresses" label="02 / Addresses">
        <P>
          Addresses are normalised to lowercase, 32-byte / 64-hex-char Sui
          form via <code>normalizeSuiAddress</code>. Shorter inputs are padded
          on the left; longer inputs are rejected.
        </P>
        <P>
          Invalid addresses don&apos;t abort the parse — the row is kept and
          flagged with a <Term>bad address</Term> chip in the live preview, so
          you can see exactly which line needs editing.
        </P>
      </Section>

      <Section id="amounts" label="03 / Amounts">
        <P>
          Amounts are decimal strings in whole-token units. The parser shifts
          by the picked coin&apos;s <code>decimals</code> to produce a base-unit{" "}
          <code>u64</code> for the Move call. Underscores and commas are
          stripped so <code>1_000.5</code> and <code>1,000.5</code> both
          work.
        </P>
        <P>
          Rejected:
        </P>
        <Ul>
          <Li>
            negative amounts (<code>-1.5</code> → <Term>bad amount</Term>)
          </Li>
          <Li>
            zero (<code>0</code> → <Term>zero</Term>)
          </Li>
          <Li>
            amounts that overflow Move <code>u64</code> after the decimals
            shift
          </Li>
          <Li>
            amounts with more decimal places than the coin supports (e.g.{" "}
            <code>1.999999999</code> for a 6-decimal coin)
          </Li>
        </Ul>
      </Section>

      <Section id="duplicates" label="04 / Duplicates">
        <P>
          Two rows sharing the same address are handled per the active
          dedupe policy in the composer toolbar:
        </P>
        <Ul>
          <Li>
            <Term>Sum</Term> (default) — amounts are merged. The first row keeps
            the combined balance; later rows show <Term>merged</Term> in the
            status column.
          </Li>
          <Li>
            <Term>First</Term> — keep the first occurrence, drop subsequent
            rows silently.
          </Li>
          <Li>
            <Term>Reject</Term> — flag every duplicate as a blocking issue.
            The submit button stays disabled until you remove them.
          </Li>
        </Ul>
        <P>
          The signed PTB always sees one row per address — the on-chain Move
          function asserts <code>recipients.length == amounts.length</code>{" "}
          and would reject duplicate keys at the array level.
        </P>
      </Section>

      <Section id="comments" label="05 / Comments">
        <P>
          Lines starting with <code>#</code> or <code>//</code> are dropped
          before parsing — handy for inline notes when you&apos;re iterating
          on a list:
        </P>
        <Code>{`# Q2 contributor rewards — finalized 2026-05-26
0x1111…1111,1.5  // alice (eng)
0x2222…2222,1.5  // bob (design)
# 0x3333…3333,1.5  // carol — paused pending KYC`}</Code>
        <P>
          Skipped lines are reported in the parsed-strip count
          (&quot;3 skipped&quot;) so you can confirm the parser saw what
          you expected.
        </P>
      </Section>
    </>
  );
}

/* ─────────────────────────── Reference tab ─────────────────────────── */

function ReferencePanel() {
  return (
    <>
      <Section id="glossary" label="01 / Glossary">
        <Dl>
          <Dt>PTB</Dt>
          <Dd>
            Programmable Transaction Block. Sui&apos;s primitive for bundling
            multiple Move calls + object transfers into one signed,
            atomically-executed transaction.
          </Dd>
          <Dt>Coin&lt;T&gt;</Dt>
          <Dd>
            The generic Sui coin type, parameterised by a specific token type{" "}
            <code>T</code>. Your wallet may hold many independent{" "}
            <code>Coin&lt;T&gt;</code> objects of the same <code>T</code> — the
            composer merges them as needed.
          </Dd>
          <Dt>Base units</Dt>
          <Dd>
            The integer representation of a token amount, after the decimals
            shift. A 1.5-TURBOS amount on a 6-decimal coin is{" "}
            <code>1_500_000</code> in base units.
          </Dd>
          <Dt>MIST</Dt>
          <Dd>
            The base unit of SUI. 1 SUI = 10⁹ MIST. The platform fee is
            expressed in MIST.
          </Dd>
          <Dt>Cap</Dt>
          <Dd>
            The contract&apos;s per-PTB ceiling on recipient count, stored in{" "}
            <code>AirdropPlatform.max_recipients</code> (currently 300).
          </Dd>
        </Dl>
      </Section>

      <Section id="faq" label="02 / FAQ">
        <H3>Can I airdrop SUI itself?</H3>
        <P>
          Yes. The Move function is generic over <code>T</code> — picking SUI
          works the same way as any other coin. The fee is still paid in SUI
          (separate from the distributed amount) and split from the same
          wallet&apos;s gas.
        </P>

        <H3>What happens to the leftover coin after splitting?</H3>
        <P>
          The Move function returns{" "}
          <code>(Coin&lt;T&gt;, Coin&lt;SUI&gt;)</code> — the unused portion of
          your input coin and any extra SUI you sent for the fee. The PTB
          transfers both back to your wallet in the same transaction, so you
          end the tx with the same balance minus exactly what you intended to
          distribute.
        </P>

        <H3>Can recipients reject incoming coins?</H3>
        <P>
          No. Sui&apos;s coin model lets any signed transaction transfer
          objects to any valid address. Recipients always receive what you
          send — if the address is owned by no one (e.g. <code>0x…0</code>),
          the coins remain there permanently.
        </P>

        <H3>Why does my wallet prompt twice for a 500-recipient list?</H3>
        <P>
          The contract caps recipients per PTB at 300. A 500-row list is
          split into two batches; each batch is its own signed PTB. The
          inspector&apos;s batch ledger shows which one is in flight at any
          moment.
        </P>

        <H3>Is the memo private?</H3>
        <P>
          No. It&apos;s recorded on-chain in the event log and indexed by
          public nodes. Treat it like a commit message.
        </P>

        <H3>What if my wallet doesn&apos;t have enough SUI for the fee?</H3>
        <P>
          The composer&apos;s pre-flight strip surfaces a <Term>SUI budget</Term>{" "}
          (fee + gas headroom) and the submit button stays disabled if your
          spendable balance is below it. The fee and gas come from the same
          SUI wallet — you don&apos;t need a separate account.
        </P>
      </Section>

      <Section id="aborts" label="03 / Abort codes">
        <P>
          The contract may abort signing with a numeric{" "}
          <code>MoveAbort</code> code. The composer&apos;s error banner
          translates known codes to plain English; novel codes display the
          raw <code>module::function: code N</code> string so you can report
          them.
        </P>
        <P>
          Most likely sources of an abort:
        </P>
        <Ul>
          <Li>
            <Term>recipients.length != amounts.length</Term> — only reachable
            if the composer were to miscount, which it doesn&apos;t. If you
            see this, file an issue.
          </Li>
          <Li>
            <Term>recipients.length &gt; max_recipients</Term> — the composer
            shouldn&apos;t let this through; same caveat.
          </Li>
          <Li>
            <Term>coin.value &lt; sum(amounts)</Term> — the composer guards
            against this with its spendable-balance check, but a wallet
            balance change between preview and sign could trigger it.
          </Li>
          <Li>
            <Term>fee.value &lt; recipients × fee_per_recipient</Term> — same
            class of race; rare.
          </Li>
        </Ul>
      </Section>

      <Section id="contract" label="04 / Contract">
        <Dl>
          <Dt>Move target</Dt>
          <Dd className="font-mono">
            <code>{AIRDROP_TARGET}</code>
          </Dd>
          <Dt>Package ID</Dt>
          <Dd className="font-mono">
            <code>{AIRDROP_PACKAGE_ID}</code>
          </Dd>
          <Dt>Platform object</Dt>
          <Dd className="font-mono">
            <code>{AIRDROP_PLATFORM_ID}</code>
          </Dd>
        </Dl>
        <P>
          The Platform object is a Sui <Term>shared object</Term> — anyone can
          mutate it via the right Move call (the airdrop function), but the
          contract gates structural mutations (fee changes, pausing, max-
          recipient adjustments) behind an <code>AirdropAdminCap</code>.
        </P>
      </Section>
    </>
  );
}

/* ─────────────────────────── tiny content helpers ─────────────────────────── */

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
      <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-ink/75">
        {children}
      </div>
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
    <pre className="overflow-x-auto border border-ink/15 bg-bone/40 p-3 font-mono text-[12px] leading-relaxed text-ink/80">
      {children}
    </pre>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-[1.05rem] font-medium text-ink">{children}</h3>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-5 gap-y-3 border border-ink/10 bg-bone/40 p-4">
      {children}
    </dl>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return (
    <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/55">
      {children}
    </dt>
  );
}

function Dd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dd className={className ?? "text-ink/75"}>{children}</dd>
  );
}

function TryIt({ href, label }: { href: string; label: string }) {
  return (
    <p className="pt-2">
      <Link
        href={href}
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-poppy underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    </p>
  );
}
