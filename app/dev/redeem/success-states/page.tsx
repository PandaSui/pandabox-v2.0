import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@pandasui/ui/lib";
import { ArrowDiag } from "@pandasui/ui";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { TxHash } from "@/components/identity/tx-hash";
import { SuiAmount } from "@/components/identity/sui-amount";
import { Spinner } from "@/components/primitives/spinner";
import { formatAmount } from "@/lib/amount";
import { explorerUrl } from "@/lib/sui";

export const metadata: Metadata = {
  title: "Redeem · success states preview",
  robots: { index: false, follow: false },
};

// Mock data realistic enough to mirror what the real states will look
// like in production. Pool id + tx digest are fabricated but type-check
// shape-correct so the `<Address>` and `<TxHash>` primitives render the
// same truncation they would for a real transaction.
const MOCK = {
  poolId: "0xc2134a412a6b6f47d3b49b177ea9c75cc1c799f1fe5e6bead03940e9ae4b0f96",
  digest: "BneXvMDyGVF2dGyvVpB5aCazxE8FqiD5ZSRemRXj7f61",
  symbol: "FOMO",
  coinDecimals: 9,
  redeemCoinIn: 100n * 10n ** 9n, // 100 whole FOMO
  redeemSuiOutMist: 95_000n, // tiny, given FOMO's 1-mist/token price
  depositMist: 500_000_000n, // 0.5 SUI
} as const;

/**
 * Side-by-side preview of the three Redeem success states (deploy a pool,
 * redeem, deposit reserve). Lets us review the visual hierarchy without
 * spending gas on real transactions. Each block is hand-rendered to match
 * the source-of-truth component — if you tweak the live state, mirror
 * the change here so this preview stays accurate.
 *
 * Routes:
 *   · DeploySuccess     → components/redeem/create/wizard.tsx :: DeploySuccess
 *   · RedeemSuccess     → components/redeem/redeem-panel.tsx :: SuccessView
 *   · DepositSuccess    → components/redeem/deposit-panel.tsx (inline block)
 */
export default function RedeemSuccessStatesPreview() {
  return (
    <main id="main" className="bg-bone">
      <Container className="py-12">
        <header className="mb-10 border-b border-ink/15 pb-6">
          <MonoLabel className="block">dev · preview</MonoLabel>
          <h1 className="mt-2 text-3xl">Redeem success states</h1>
          <p className="mt-2 max-w-prose text-sm text-ink/60">
            Mock-rendered copies of the three success surfaces. Visual
            tweaks made here must be mirrored in the source components
            (linked in the JSDoc above) for the live flow to match.
          </p>
        </header>

        {/* ───── 01 · Deploy ─────────────────────────────────────── */}
        <PreviewBlock
          n="01"
          title="Deploy a pool"
          source="components/redeem/create/wizard.tsx :: DeploySuccess"
          notes="Full-page replacement after the create wizard's signed tx settles. Auto-redirects to /redeem/[poolId] after 4 seconds."
        >
          <DeploySuccessMock />
        </PreviewBlock>

        {/* ───── 02 · Redeem ─────────────────────────────────────── */}
        <PreviewBlock
          n="02"
          title="Redeem"
          source="components/redeem/redeem-panel.tsx :: SuccessView"
          notes="Inline replacement inside the right-rail Redeem panel. User stays on the pool page; the panel header + status pill remain visible above."
        >
          <RedeemSuccessMock />
        </PreviewBlock>

        {/* ───── 03 · Deposit ────────────────────────────────────── */}
        <PreviewBlock
          n="03"
          title="Top up reserve"
          source="components/redeem/deposit-panel.tsx (inline JSX)"
          notes="Small jade-tinted banner inside the Top Up panel. Lower visual weight because it's a secondary action."
        >
          <DepositSuccessMock />
        </PreviewBlock>
      </Container>
    </main>
  );
}

/* ─────────────────────────── Block frame ─────────────────────────── */

function PreviewBlock({
  n,
  title,
  source,
  notes,
  children,
}: {
  n: string;
  title: string;
  source: string;
  notes: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <MonoLabel className="text-[10px]">{n}</MonoLabel>
          <h2 className="mt-1 text-xl">{title}</h2>
        </div>
        <code className="font-mono text-[11px] text-ink/55">{source}</code>
      </div>
      <p className="mb-5 max-w-prose text-[13px] text-ink/60">{notes}</p>
      <div className="border border-dashed border-ink/20 bg-bone/40 p-4">
        {children}
      </div>
    </section>
  );
}

/* ─────────────────────────── Deploy ─────────────────────────── */

const CTA_PRIMARY =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink bg-ink text-bone shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset";

const CTA_SECONDARY =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink bg-bone text-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset";

function DeploySuccessMock() {
  return (
    <div className="mx-auto max-w-2xl border border-ink bg-bone shadow-offset">
      <span aria-hidden className="block h-[3px] bg-jade" />
      <div className="px-8 py-10 md:px-10 md:py-12">
        <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-jade">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 rounded-full bg-jade"
            style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
          />
          Pool deployed
        </div>
        <h2 className="mt-4 font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.02]">
          Your redeem pool is live.
        </h2>
        <p className="mt-3 max-w-prose text-pretty text-[15px] text-ink/65">
          The contract has shared a fresh{" "}
          <code className="font-mono text-[13px]">RedeemPool&lt;FOMO&gt;</code>{" "}
          object. Anyone can redeem against it from this moment forward.
        </p>

        <dl className="mt-7 divide-y divide-ink/10 border-y border-ink/15">
          <Row label="Pool id">
            <Address value={MOCK.poolId} />
          </Row>
          <Row label="Transaction">
            <TxHash value={MOCK.digest} copyable />
          </Row>
        </dl>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href={`/redeem/${MOCK.poolId}`} className={CTA_PRIMARY}>
            <span>Open pool</span>
            <ArrowDiag size={12} />
          </Link>
          <a
            href={explorerUrl("tx", MOCK.digest)}
            target="_blank"
            rel="noreferrer"
            className={CTA_SECONDARY}
          >
            <span>View on Suiscan</span>
            <span aria-hidden>↗</span>
          </a>
          <button type="button" className={cn(CTA_SECONDARY, "ml-auto")}>
            <span>Deploy another</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Redeem ─────────────────────────── */

const REDEEM_CTA =
  "group relative inline-flex w-full items-center justify-center gap-2 h-12 px-6 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset";

function RedeemSuccessMock() {
  return (
    <aside className="mx-auto max-w-md">
      <div className="border border-ink/25 bg-bone shadow-offset-sm">
        <span aria-hidden className="block h-[3px] bg-sun" />
        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3.5">
          <MonoLabel className="text-[10px]">Redeem this pool</MonoLabel>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-jade">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-jade"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            Open
          </span>
        </header>

        {/* The actual success body */}
        <div className="px-5 py-6">
          <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jade">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
            Redeem signed
          </div>
          <h3 className="mt-3 font-display text-[1.5rem] leading-[1.1]">
            You received{" "}
            <SuiAmount
              mist={MOCK.redeemSuiOutMist}
              maxFractionDigits={6}
              glyphSize={14}
              className="text-[1.5rem]"
            />
          </h3>
          <p className="mt-2 text-[13.5px] text-ink/65">
            Routed{" "}
            <span className="font-mono tabular-nums text-ink">
              {formatAmount(MOCK.redeemCoinIn, {
                decimals: MOCK.coinDecimals,
                compact: true,
                maxFractionDigits: 4,
              })}{" "}
              {MOCK.symbol}
            </span>{" "}
            to the pool's recipient address.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
            <span>Tx</span>
            <TxHash value={MOCK.digest} copyable />
            <a
              href={explorerUrl("tx", MOCK.digest)}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 text-ink/55 transition-colors hover:text-ink"
            >
              <span>View on Suiscan</span>
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-[1px]"
              >
                ↗
              </span>
            </a>
          </div>
          <button
            type="button"
            className={cn(REDEEM_CTA, "mt-6 bg-bone text-ink")}
          >
            <span>Redeem again</span>
            <ArrowDiag size={12} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────── Deposit ─────────────────────────── */

function DepositSuccessMock() {
  return (
    <section className="mx-auto max-w-md border border-ink/15 bg-bone">
      <header className="border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">Top up reserve</MonoLabel>
        <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          <span aria-hidden className="block h-1 w-1 rounded-full bg-jade/70" />
          anyone can deposit
        </span>
      </header>
      <div className="space-y-4 px-5 py-5">
        <p className="text-[13px] leading-[1.55] text-ink/65">
          Add more SUI to the pool's reserve so it can honour additional
          redeems.
        </p>
        <div className="border border-jade/40 bg-jade/[0.06] px-4 py-3">
          <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jade">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
            Deposit signed
          </div>
          <p className="mt-2 text-[13px]">
            <SuiAmount
              mist={MOCK.depositMist}
              maxFractionDigits={4}
              glyphSize={11}
              className="text-ink"
            />{" "}
            added to the reserve.
          </p>
          <button
            type="button"
            className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55 transition-colors hover:text-ink"
          >
            Deposit again →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Shared row ─────────────────────────── */

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[12.5px]">{children}</dd>
    </div>
  );
}

function Spinner_unused() {
  // Spinner is imported elsewhere in the real DeploySuccess; preserved in
  // case the preview later wants to show the "indexing pool id" state.
  return <Spinner size={12} />;
}
void Spinner_unused;
