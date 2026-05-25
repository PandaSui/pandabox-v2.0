"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import BigNumber from "bignumber.js";
import { ArrowDiag } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { AccentRule } from "@/components/primitives/accent-rule";
import { Spinner } from "@/components/primitives/spinner";
import { Field, TextField } from "@/components/create/field";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Address } from "@/components/identity/address";
import { TxHash } from "@/components/identity/tx-hash";
import { Identicon } from "@/components/identity/identicon";
import {
  useRedeemWizard,
  SUI_BURN_ADDRESS,
  type RecipientMode,
} from "@/lib/store/redeem-wizard";
import {
  buildCreatePoolTx,
  REDEEM_EVENT_TYPE,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import { findPoolByCoinType } from "@/lib/redeem/find-pool";
import { parseRedeemAbort } from "@/lib/redeem/abort-codes";
import { MIST_PER_SUI, explorerUrl } from "@/lib/sui";
import { formatAmount } from "@/lib/amount";

/* ───────────────────────── Constants ───────────────────────── */

const STEPS = [
  { key: "coin", label: "Coin" },
  { key: "rate", label: "Rate" },
  { key: "recipient", label: "Recipient" },
  { key: "reserve", label: "Reserve" },
  { key: "review", label: "Deploy" },
] as const;

const CTA_PRIMARY =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink bg-ink text-bone shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

const CTA_SECONDARY =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 " +
  "font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink bg-bone text-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset";

/* ───────────────────────── Deploy state ───────────────────────── */

type DeployState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirming"; digest: string }
  | { kind: "success"; digest: string; poolId: string }
  | { kind: "error"; message: string };

/* ───────────────────────── Shell ───────────────────────── */

/**
 * Top-level wizard shell. Holds the deploy state machine and routes to
 * the per-step content. Persisted draft is rehydrated from localStorage
 * on mount; while rehydration is pending we render a focal spinner so
 * the user never sees stale empty inputs flash before their saved values
 * appear.
 */
export function RedeemCreateWizard() {
  const draft = useRedeemWizard((s) => s.draft);
  const hydrated = useRedeemWizard((s) => s.hydrated);
  const setStep = useRedeemWizard((s) => s.setStep);
  const reset = useRedeemWizard((s) => s.reset);

  const [deploy, setDeploy] = useState<DeployState>({ kind: "idle" });
  const stepperLocked = deploy.kind === "submitting" || deploy.kind === "confirming";

  if (!hydrated) {
    return (
      <section>
        <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-3 py-20">
          <Spinner size={22} className="text-ink/55" label="Loading draft" />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            Restoring draft
          </p>
        </Container>
      </section>
    );
  }

  if (deploy.kind === "success") {
    return (
      <DeploySuccess
        poolId={deploy.poolId}
        digest={deploy.digest}
        onAnother={() => {
          reset();
          setDeploy({ kind: "idle" });
        }}
      />
    );
  }

  const step = draft.step;
  return (
    <section className="relative">
      <Container className="py-10 lg:py-14">
        <StepNav current={step} onChange={(n) => !stepperLocked && setStep(n)} />

        <div className="mt-10">
          {step === 1 && <StepCoin />}
          {step === 2 && <StepRate />}
          {step === 3 && <StepRecipient />}
          {step === 4 && <StepReserve />}
          {step === 5 && <StepReview deploy={deploy} onDeploy={setDeploy} />}
        </div>
      </Container>
    </section>
  );
}

/* ───────────────────────── Step navigation ───────────────────────── */

function StepNav({
  current,
  onChange,
}: {
  current: number;
  onChange: (n: number) => void;
}) {
  return (
    <nav
      aria-label="Wizard steps"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink/10 pb-5"
    >
      {STEPS.map((s, i) => {
        const n = i + 1;
        const active = n === current;
        const completed = n < current;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(n)}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 px-1.5 py-1 transition-colors",
              active
                ? "text-ink"
                : completed
                  ? "text-ink/60 hover:text-ink"
                  : "text-ink/35 hover:text-ink/55",
            )}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums">
              {String(n).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.16em]",
                active && "border-b-[1.5px] border-sun pb-0.5",
              )}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ───────────────────────── Step header + footer ───────────────────────── */

function StepHeader({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body?: string;
}) {
  return (
    <header className="mb-8 border-b border-ink/15 pb-6">
      <AccentRule color="sun">
        <MonoLabel className="text-[10px]">
          Step {String(n).padStart(2, "0")} of 05
        </MonoLabel>
      </AccentRule>
      <h2 className="mt-3 font-display text-[clamp(1.875rem,3vw,2.75rem)] leading-[1.05] tracking-tight">
        {title}
      </h2>
      {body && (
        <p className="mt-3 max-w-prose text-[15px] text-ink/65">{body}</p>
      )}
    </header>
  );
}

function StepFooter({
  canNext,
  nextLabel = "Continue",
  onBack,
  onNext,
  hideBack,
}: {
  canNext: boolean;
  nextLabel?: string;
  onBack?: () => void;
  onNext?: () => void;
  hideBack?: boolean;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-6">
      {hideBack ? (
        <span />
      ) : (
        <button type="button" onClick={onBack} className={CTA_SECONDARY}>
          <span aria-hidden>←</span>
          <span>Back</span>
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className={CTA_PRIMARY}
      >
        <span>{nextLabel}</span>
        <ArrowDiag size={11} />
      </button>
    </div>
  );
}

/* ───────────────────────── Step 1 — Coin ───────────────────────── */

/**
 * Coin selection step. The user either pastes a fully-qualified coin
 * type (`0xabc::module::TYPE`) or picks from the types they currently
 * hold (resolved via `getAllBalances`). Either way we re-run
 * `getCoinMetadata(coinType)` to confirm the metadata object exists
 * and to pull name / symbol / decimals / icon for downstream steps.
 */
function StepCoin() {
  const draft = useRedeemWizard((s) => s.draft);
  const patchCoin = useRedeemWizard((s) => s.patchCoin);
  const goNext = useRedeemWizard((s) => s.goNext);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [typed, setTyped] = useState(draft.coin.type);

  // Live metadata lookup. Re-runs whenever the typed coin type changes.
  const normalized = normalizeMaybeCoinType(typed);
  const {
    data: metadata,
    isFetching,
    error,
  } = useSuiClientQuery(
    "getCoinMetadata",
    { coinType: normalized ?? "" },
    { enabled: !!normalized },
  );

  // Check whether a redeem pool already exists for this coin type. The
  // contract enforces one pool per `T` (abort 101 on duplicate) so we
  // catch it here and route the user to the existing pool instead of
  // letting them fill in the rest of the form for nothing.
  const [existingPool, setExistingPool] = useState<{
    poolId: string;
    creator: string;
    timestampMs: number;
  } | null>(null);
  const [existingChecking, setExistingChecking] = useState(false);
  useEffect(() => {
    if (!normalized || !metadata?.id) {
      setExistingPool(null);
      return;
    }
    let cancelled = false;
    setExistingChecking(true);
    findPoolByCoinType({ client, coinType: normalized })
      .then((result) => {
        if (!cancelled) setExistingPool(result);
      })
      .catch(() => {
        if (!cancelled) setExistingPool(null);
      })
      .finally(() => {
        if (!cancelled) setExistingChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, metadata?.id, client]);

  // Sync resolved metadata into the wizard draft.
  useEffect(() => {
    if (!normalized || !metadata) return;
    patchCoin({
      type: normalized,
      metadataId: metadata.id ?? "",
      name: metadata.name ?? "",
      symbol: metadata.symbol ?? "",
      decimals: typeof metadata.decimals === "number" ? metadata.decimals : 9,
      iconUrl: resolveIconUrl(metadata.iconUrl),
    });
  }, [normalized, metadata, patchCoin]);

  // List of types the connected wallet currently holds — used for the
  // "pick from your wallet" shortcut. Excludes raw SUI.
  const { data: balances } = useSuiClientQuery(
    "getAllBalances",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address },
  );
  const heldTypes = useMemo(() => {
    if (!balances) return [];
    return balances
      .filter((b) => b.coinType !== "0x2::sui::SUI" && BigInt(b.totalBalance) > 0n)
      .slice(0, 8);
  }, [balances]);

  const resolved =
    !!normalized && !!metadata && metadata.id ? metadata : null;
  const canNext =
    !!resolved && !!draft.coin.metadataId && !existingPool && !existingChecking;

  return (
    <>
      <StepHeader
        n={1}
        title="Pick the coin you want to redeem against."
        body="Paste its fully-qualified type, or pick from the coins you hold. We'll resolve its on-chain metadata and pin the decimals so the wizard math stays exact."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: input */}
        <div className="space-y-5">
          <Field
            label="Coin type"
            hint="Format: 0x<package>::<module>::<TYPE>"
          >
            {(id) => (
              <TextField
                id={id}
                value={typed}
                onChange={setTyped}
                placeholder="0xabc…::fomo::FOMO"
                className="font-mono text-[13px]"
              />
            )}
          </Field>

          {/* Owned-coins picker — collapsed mono list */}
          {account && heldTypes.length > 0 && (
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                From your wallet
              </span>
              <ul className="mt-2 flex flex-wrap gap-2">
                {heldTypes.map((b) => (
                  <li key={b.coinType}>
                    <button
                      type="button"
                      onClick={() => setTyped(b.coinType)}
                      className={cn(
                        "inline-flex items-center gap-1.5 border border-ink/25 bg-bone px-2.5 py-1 font-mono text-[10.5px] text-ink/75 transition-all",
                        "hover:-translate-y-[1px] hover:border-ink hover:text-ink",
                      )}
                      title={b.coinType}
                    >
                      <span className="uppercase tracking-[0.06em]">
                        {b.coinType.split("::").pop()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: resolution preview */}
        <ResolutionPanel
          isFetching={!!normalized && isFetching}
          error={
            error
              ? "Could not resolve coin metadata."
              : normalized && metadata === null
                ? "No CoinMetadata published for this type."
                : null
          }
          metadata={resolved}
          iconUrl={draft.coin.iconUrl}
        />
      </div>

      {/* Existing-pool banner — the contract enforces one pool per coin
          type, so we surface this *before* the user fills out the rest of
          the form. Bone surface, sun spine, two crisp affordances: open
          the existing pool, or pick a different coin. */}
      {existingPool && (
        <div className="mt-8 relative overflow-hidden border border-ink bg-bone shadow-offset-sm">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-sun" />
          <div className="px-5 py-5 md:px-6 md:py-6">
            <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-sun">
              <span
                aria-hidden
                className="block h-1.5 w-1.5 rounded-full bg-sun"
                style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
              />
              Pool already exists
            </div>
            <h3 className="mt-2 font-display text-[1.5rem] leading-[1.1] md:text-[1.75rem]">
              This coin has a redeem pool live on-chain.
            </h3>
            <p className="mt-2 max-w-prose text-[14px] text-ink/65">
              The Redeem contract enforces a single pool per coin type
              <span aria-hidden> — </span>
              you can't deploy another one for this coin. Open the
              existing pool to redeem against it, or pick a different
              coin to deploy.
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-y-1.5 font-mono text-[11px] text-ink/55 sm:grid-cols-2 sm:gap-x-4">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-ink/40">pool</span>
                <Address value={existingPool.poolId} />
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-ink/40">by</span>
                <Address value={existingPool.creator} />
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/redeem/${existingPool.poolId}`}
                className={CTA_PRIMARY}
              >
                <span>Open the existing pool</span>
                <ArrowDiag size={11} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setTyped("");
                  patchCoin({
                    type: "",
                    metadataId: "",
                    name: "",
                    symbol: "",
                    decimals: 9,
                    iconUrl: null,
                  });
                  setExistingPool(null);
                }}
                className={CTA_SECONDARY}
              >
                <span>Pick a different coin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {existingChecking && !existingPool && resolved && (
        <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          <Spinner size={11} className="text-ink/55" />
          Checking for existing pool…
        </div>
      )}

      <StepFooter
        canNext={canNext}
        onNext={() => goNext()}
        hideBack
      />
    </>
  );
}

function ResolutionPanel({
  isFetching,
  error,
  metadata,
  iconUrl,
}: {
  isFetching: boolean;
  error: string | null;
  metadata:
    | {
        id?: string | null;
        name?: string | null;
        symbol?: string | null;
        decimals?: number | null;
      }
    | null;
  iconUrl: string | null;
}) {
  return (
    <aside className="border border-ink/15 bg-bone">
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">Resolution</MonoLabel>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          0x2::coin::CoinMetadata
        </span>
      </header>
      <div className="px-5 py-5">
        {isFetching ? (
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
            <Spinner size={12} className="text-ink/55" />
            Resolving on-chain…
          </div>
        ) : error ? (
          <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-poppy">
            {error}
          </p>
        ) : metadata && metadata.id ? (
          <div className="flex items-start gap-3">
            <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-bone">
              {iconUrl ? (
                <Image
                  src={iconUrl}
                  alt={(metadata.symbol ?? "icon") + " icon"}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <Identicon value={metadata.id} size={32} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">
                {metadata.name || "—"}
              </div>
              <div className="mt-0.5 font-mono text-[11.5px] text-ink/55">
                <span className="font-medium uppercase tracking-[0.08em] text-ink/75">
                  {metadata.symbol || "?"}
                </span>
                <span aria-hidden className="mx-1.5 text-ink/25">·</span>
                <span>{metadata.decimals ?? "?"} decimals</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-jade">
                <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
                Resolved
              </div>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/40">
            Awaiting coin type
          </p>
        )}
      </div>
    </aside>
  );
}

/* ───────────────────────── Step 2 — Rate ───────────────────────── */

/**
 * Exchange rate step. The user enters a whole-SUI-per-whole-token rate;
 * we convert to the contract's `price_mist_per_token` (u64) by:
 *
 *   priceMistPerToken = rateSuiPerToken * 1e9 / 10^decimals
 *
 * For a 9-decimal coin priced at 1 SUI per token, that's 1 mist per
 * base unit — the simplest case. For sub-cent prices on a 9-decimal
 * coin we end up with `priceMistPerToken = 0`, which the contract
 * (correctly) rejects — surfaced as a validation error before deploy.
 */
function StepRate() {
  const draft = useRedeemWizard((s) => s.draft);
  const setRate = useRedeemWizard((s) => s.setRate);
  const goNext = useRedeemWizard((s) => s.goNext);
  const goPrev = useRedeemWizard((s) => s.goPrev);

  const symbol = draft.coin.symbol || "TOKEN";
  const decimals = draft.coin.decimals || 9;

  const rateBn = useMemo(() => {
    const v = draft.rateSuiPerToken.trim();
    if (!v) return new BigNumber(0);
    const bn = new BigNumber(v);
    return bn.isFinite() && bn.gt(0) ? bn : new BigNumber(0);
  }, [draft.rateSuiPerToken]);

  const priceMistPerToken = useMemo(() => {
    if (rateBn.lte(0)) return 0n;
    const raw = rateBn
      .multipliedBy(MIST_PER_SUI.toString())
      .dividedBy(new BigNumber(10).pow(decimals));
    if (!raw.isFinite() || raw.lte(0)) return 0n;
    return BigInt(raw.integerValue(BigNumber.ROUND_DOWN).toFixed(0));
  }, [rateBn, decimals]);

  const tokensPerSui = useMemo(() => {
    if (rateBn.lte(0)) return new BigNumber(0);
    return new BigNumber(1).dividedBy(rateBn);
  }, [rateBn]);

  // Sample calc — "redeeming N tokens gives X SUI".
  const sampleTokens = 1_000_000n;
  const sampleSuiMist = useMemo(() => {
    const base = sampleTokens * BigInt(10) ** BigInt(decimals);
    return base * priceMistPerToken;
  }, [decimals, priceMistPerToken]);

  // Validation — rate must round to ≥ 1 mist/base-unit, otherwise the
  // contract would treat the pool as a freebie. Also flag the special
  // case where the user picked an unreasonably small fractional rate.
  const validation =
    rateBn.lte(0)
      ? null
      : priceMistPerToken === 0n
        ? `Rate too small. With ${decimals} decimals, the contract needs at least 1 mist per base unit (≈ ${new BigNumber(10).pow(decimals - 9).toFixed(decimals - 9)} SUI per token).`
        : null;

  const canNext = priceMistPerToken > 0n && !validation;

  return (
    <>
      <StepHeader
        n={2}
        title="Set the exchange rate."
        body={`How much SUI does one whole ${symbol} redeem for? Once you deploy, the contract has no setter for this value — neither you nor a platform admin can change it.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: input + permanent warning */}
        <div className="space-y-5">
          <Field
            label={`Rate · SUI per 1 ${symbol}`}
            hint="Whole SUI per whole token. Example: 0.001 means 1,000 tokens redeem for 1 SUI."
          >
            {(id) => (
              <div
                className={cn(
                  "flex items-center border border-ink/25 bg-bone",
                  "focus-within:border-ink focus-within:shadow-offset-sm",
                )}
              >
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  value={draft.rateSuiPerToken}
                  onChange={(e) => setRate(sanitizeDecimal(e.target.value))}
                  placeholder="0.001"
                  className="h-14 flex-1 bg-transparent px-3 font-mono text-2xl tabular-nums text-ink outline-none placeholder:text-ink/30"
                  aria-label={`SUI per ${symbol}`}
                />
                <span className="pr-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                  SUI / {symbol}
                </span>
              </div>
            )}
          </Field>

          {validation && (
            <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy">
              {validation}
            </p>
          )}

          <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-poppy">
            <span className="font-semibold">Permanent</span>
            <span className="normal-case tracking-normal">
              {" "}— the contract has no setter for{" "}
              <code className="font-mono">price_mist_per_token</code>.
            </span>
          </p>
        </div>

        {/* Right: calculator */}
        <aside className="border border-ink/15 bg-bone">
          <header className="border-b border-ink/15 px-5 py-3.5">
            <MonoLabel className="text-[10px]">Calculator</MonoLabel>
          </header>
          <dl className="divide-y divide-ink/10 px-5 py-2">
            <Row label={`1 ${symbol} →`}>
              <span className="font-mono tabular-nums">
                {rateBn.gt(0) ? rateBn.toFixed(Math.min(8, 6)) : "0.000"} SUI
              </span>
            </Row>
            <Row label="1 SUI →">
              <span className="font-mono tabular-nums">
                {tokensPerSui.gt(0)
                  ? new BigNumber(tokensPerSui).toFormat(2, BigNumber.ROUND_DOWN)
                  : "0"}{" "}
                {symbol}
              </span>
            </Row>
            <Row label="Redeeming 1,000,000">
              <span className="font-mono tabular-nums">
                ≈ {formatAmount(sampleSuiMist, { decimals: 9, compact: false, maxFractionDigits: 4 })}{" "}
                SUI
              </span>
            </Row>
            <Row label="price_mist_per_token">
              <span className="font-mono text-[12px]">
                {priceMistPerToken.toString()}
              </span>
            </Row>
          </dl>
        </aside>
      </div>

      <StepFooter
        canNext={canNext}
        onBack={() => goPrev()}
        onNext={() => goNext()}
      />
    </>
  );
}

/* ───────────────────────── Step 3 — Recipient ───────────────────────── */

/**
 * Recipient step. Two modes:
 *
 *   - Burn   : route redeemed coins to the canonical Sui zero address —
 *              they're effectively destroyed (no private key holds the
 *              account). Supply-shrinking, no buyback.
 *   - Buyback: route redeemed coins to a treasury address the dev
 *              controls. Coins flow back to the project rather than
 *              being destroyed.
 *
 * Both are permanent — the contract has no setter for `recipient`.
 */
function StepRecipient() {
  const draft = useRedeemWizard((s) => s.draft);
  const patchRecipient = useRedeemWizard((s) => s.patchRecipient);
  const goNext = useRedeemWizard((s) => s.goNext);
  const goPrev = useRedeemWizard((s) => s.goPrev);

  const mode = draft.recipient.mode;
  const setMode = (m: RecipientMode) => {
    if (m === "burn") {
      patchRecipient({ mode: "burn", address: SUI_BURN_ADDRESS });
    } else {
      patchRecipient({
        mode: "buyback",
        // Preserve a previously-typed buyback address; otherwise clear.
        address:
          draft.recipient.address &&
          draft.recipient.address !== SUI_BURN_ADDRESS
            ? draft.recipient.address
            : "",
      });
    }
  };

  const addressValid = isValidSuiAddress(draft.recipient.address);
  const canNext =
    (mode === "burn" && draft.recipient.address === SUI_BURN_ADDRESS) ||
    (mode === "buyback" && addressValid);

  return (
    <>
      <StepHeader
        n={3}
        title="Where do redeemed coins go?"
        body="Pick where the contract routes the project coins users redeem. This is permanent — pick carefully."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ModeCard
          active={mode === "burn"}
          accent="poppy"
          title="Burn"
          tag="supply-shrinking"
          body="Redeemed coins go to the Sui zero address. No private key holds that account, so the coins are effectively destroyed. Circulating supply decreases by exactly the redeemed amount."
          footer={
            <span className="font-mono text-[10.5px] text-ink/55">
              recipient →{" "}
              <code className="text-ink">0x00…0000</code>
            </span>
          }
          onClick={() => setMode("burn")}
        />
        <ModeCard
          active={mode === "buyback"}
          accent="jade"
          title="Buyback"
          tag="back-to-treasury"
          body="Redeemed coins flow to an address you control — typically your project's treasury or a multisig. The coins can be reused, re-distributed, or burned at your discretion later."
          footer={
            <span className="font-mono text-[10.5px] text-ink/55">
              recipient →{" "}
              <code className="text-ink">
                {mode === "buyback" && addressValid
                  ? shortAddr(draft.recipient.address)
                  : "your treasury"}
              </code>
            </span>
          }
          onClick={() => setMode("buyback")}
        />
      </div>

      {mode === "buyback" && (
        <div className="mt-8">
          <Field
            label="Buyback recipient address"
            hint="32-byte Sui address (64 hex chars after `0x`). Typically a multisig or treasury you control."
            error={
              draft.recipient.address && !addressValid
                ? "Not a valid Sui address."
                : undefined
            }
          >
            {(id) => (
              <TextField
                id={id}
                value={draft.recipient.address}
                onChange={(v) => patchRecipient({ address: v.trim() })}
                placeholder="0x0123abcd…"
                className="font-mono text-[13px]"
              />
            )}
          </Field>
        </div>
      )}

      {mode === "burn" && (
        <p className="mt-6 border border-poppy/40 bg-poppy/[0.06] px-3 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-poppy">
          <span className="font-semibold">Permanent</span>
          <span className="normal-case tracking-normal">
            {" "}— the contract has no setter for{" "}
            <code className="font-mono">recipient</code>. Coins routed here
            cannot be recovered.
          </span>
        </p>
      )}

      <StepFooter
        canNext={canNext}
        onBack={() => goPrev()}
        onNext={() => goNext()}
      />
    </>
  );
}

function ModeCard({
  active,
  accent,
  title,
  tag,
  body,
  footer,
  onClick,
}: {
  active: boolean;
  accent: "poppy" | "jade";
  title: string;
  tag: string;
  body: string;
  footer: React.ReactNode;
  onClick: () => void;
}) {
  const spine = accent === "poppy" ? "bg-poppy" : "bg-jade";
  const tagText = accent === "poppy" ? "text-poppy" : "text-jade";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border bg-bone p-5 text-left transition-all duration-300 ease-atelier",
        active
          ? "border-ink shadow-offset"
          : "border-ink/20 shadow-offset-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:border-ink/45 hover:shadow-offset",
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", spine)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[1.5rem] leading-[1.05]">{title}</h3>
          <span className={cn("mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.16em]", tagText)}>
            {tag}
          </span>
        </div>
        <span
          aria-hidden
          className={cn(
            "mt-1 inline-flex h-4 w-4 items-center justify-center border transition-colors",
            active ? "border-ink bg-ink" : "border-ink/40 bg-bone",
          )}
        >
          {active && <span className="block h-1.5 w-1.5 bg-bone" />}
        </span>
      </div>
      <p className="mt-3 text-pretty text-[13.5px] leading-relaxed text-ink/65">
        {body}
      </p>
      <div className="mt-auto pt-5">{footer}</div>
    </button>
  );
}

/* ───────────────────────── Step 4 — Reserve ───────────────────────── */

/**
 * Initial reserve seed. Splits SUI from gas at deploy time into the
 * pool's `sui_reserve`. Anyone can top up later via the deposit panel,
 * so this isn't a one-shot opportunity — but a pool with zero reserve
 * can't honour any redeem, so the dev typically seeds enough for
 * expected near-term volume.
 */
function StepReserve() {
  const draft = useRedeemWizard((s) => s.draft);
  const setInitialReserve = useRedeemWizard((s) => s.setInitialReserve);
  const goNext = useRedeemWizard((s) => s.goNext);
  const goPrev = useRedeemWizard((s) => s.goPrev);
  const account = useCurrentAccount();

  const { data: balance } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address },
  );
  const spendableMist = useMemo(
    () => (balance?.totalBalance ? BigInt(balance.totalBalance) : 0n),
    [balance],
  );

  const reserveMist = useMemo(() => {
    const v = draft.initialReserveSui.trim();
    if (!v) return 0n;
    const bn = new BigNumber(v);
    if (!bn.isFinite() || bn.lte(0)) return 0n;
    const raw = bn.multipliedBy(MIST_PER_SUI.toString());
    if (!raw.isFinite() || raw.lte(0)) return 0n;
    return BigInt(raw.integerValue(BigNumber.ROUND_DOWN).toFixed(0));
  }, [draft.initialReserveSui]);

  // How many WHOLE tokens this reserve can absorb at the current rate.
  const rateBn = new BigNumber(draft.rateSuiPerToken || "0");
  const tokensSupported = useMemo(() => {
    if (rateBn.lte(0) || reserveMist === 0n) return new BigNumber(0);
    return new BigNumber(reserveMist.toString())
      .dividedBy(MIST_PER_SUI.toString())
      .dividedBy(rateBn);
  }, [rateBn, reserveMist]);

  // Leave at least 0.1 SUI for gas + future ops. Soft warning, not blocking.
  const reservesGas = spendableMist > 100_000_000n
    ? spendableMist - 100_000_000n
    : 0n;
  const overdraft = reserveMist > spendableMist;
  const tightOnGas = !overdraft && reserveMist > reservesGas;

  const validation = overdraft
    ? "Amount exceeds your SUI balance"
    : null;
  const canNext = reserveMist > 0n && !validation;

  return (
    <>
      <StepHeader
        n={4}
        title="Seed the initial reserve."
        body="The pool needs SUI on hand to pay out redeems. Anyone can deposit more later — this is just the launch depth."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Field label="Initial SUI" hint="Will be split from gas at deploy time.">
            {(id) => (
              <div
                className={cn(
                  "flex items-center border border-ink/25 bg-bone",
                  "focus-within:border-ink focus-within:shadow-offset-sm",
                )}
              >
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  value={draft.initialReserveSui}
                  onChange={(e) => setInitialReserve(sanitizeDecimal(e.target.value))}
                  placeholder="0.50"
                  className="h-14 flex-1 bg-transparent px-3 font-mono text-2xl tabular-nums text-ink outline-none placeholder:text-ink/30"
                  aria-label="Initial reserve in SUI"
                />
                <span className="pr-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                  SUI
                </span>
              </div>
            )}
          </Field>

          <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">
            <span>Your wallet</span>
            <span className="text-ink">
              {account
                ? `${formatAmount(spendableMist, { decimals: 9, compact: true, maxFractionDigits: 4 })} SUI`
                : "—"}
            </span>
          </div>

          {validation && (
            <p className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy">
              {validation}
            </p>
          )}
          {tightOnGas && (
            <p className="border border-sun/40 bg-sun/[0.10] px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/80">
              <span className="font-semibold">Heads up</span>
              <span className="normal-case tracking-normal">
                {" "}— that leaves less than 0.1 SUI for gas. Deploy may still
                succeed; budget accordingly.
              </span>
            </p>
          )}
        </div>

        <aside className="border border-ink/15 bg-bone">
          <header className="border-b border-ink/15 px-5 py-3.5">
            <MonoLabel className="text-[10px]">Capacity preview</MonoLabel>
          </header>
          <dl className="divide-y divide-ink/10 px-5 py-2">
            <Row label="Reserve depth">
              <span className="font-mono tabular-nums">
                {reserveMist > 0n
                  ? formatAmount(reserveMist, { decimals: 9, maxFractionDigits: 4 }) +
                    " SUI"
                  : "—"}
              </span>
            </Row>
            <Row label={`Supports up to`}>
              <span className="font-mono tabular-nums">
                {tokensSupported.gt(0)
                  ? new BigNumber(tokensSupported).toFormat(2, BigNumber.ROUND_DOWN) +
                    " " +
                    (draft.coin.symbol || "TOKEN")
                  : "—"}
              </span>
            </Row>
          </dl>
          <p className="border-t border-ink/10 px-5 py-3 text-[12px] leading-snug text-ink/55">
            Capacity is an upper bound at the current rate. Each redeem
            settles at exactly the fixed rate; the reserve drops by the
            corresponding SUI plus the platform fee.
          </p>
        </aside>
      </div>

      <StepFooter
        canNext={canNext}
        onBack={() => goPrev()}
        onNext={() => goNext()}
      />
    </>
  );
}

/* ───────────────────────── Step 5 — Review + Deploy ───────────────────────── */

/**
 * Read-only summary plus the actual deploy. Builds `pool::create_pool<T>`
 * via the existing PTB wrapper, signs through dapp-kit, waits for the
 * chain to surface the `PoolCreated` event, then reads the new pool id
 * out of that event and routes the success view to `/redeem/[poolId]`.
 */
function StepReview({
  deploy,
  onDeploy,
}: {
  deploy: DeployState;
  onDeploy: (s: DeployState) => void;
}) {
  const draft = useRedeemWizard((s) => s.draft);
  const goPrev = useRedeemWizard((s) => s.goPrev);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const symbol = draft.coin.symbol || "TOKEN";
  const decimals = draft.coin.decimals || 9;
  const rateBn = new BigNumber(draft.rateSuiPerToken || "0");
  const priceMistPerToken = useMemo(() => {
    if (rateBn.lte(0)) return 0n;
    const raw = rateBn
      .multipliedBy(MIST_PER_SUI.toString())
      .dividedBy(new BigNumber(10).pow(decimals));
    if (!raw.isFinite() || raw.lte(0)) return 0n;
    return BigInt(raw.integerValue(BigNumber.ROUND_DOWN).toFixed(0));
  }, [rateBn, decimals]);

  const reserveMist = useMemo(() => {
    const bn = new BigNumber(draft.initialReserveSui || "0");
    if (!bn.isFinite() || bn.lte(0)) return 0n;
    return BigInt(
      bn.multipliedBy(MIST_PER_SUI.toString()).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
    );
  }, [draft.initialReserveSui]);

  const ready =
    !!draft.coin.type &&
    !!draft.coin.metadataId &&
    priceMistPerToken > 0n &&
    isValidSuiAddress(draft.recipient.address) &&
    reserveMist > 0n;

  const isBusy = deploy.kind === "submitting" || deploy.kind === "confirming";

  const onSubmit = async () => {
    if (!account || !ready) return;
    onDeploy({ kind: "submitting" });
    try {
      if (!REDEEM_IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 700));
        onDeploy({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
          poolId: "0xSIMULATED",
        });
        return;
      }
      const tx = buildCreatePoolTx({
        coinType: draft.coin.type,
        coinMetadataId: draft.coin.metadataId,
        initialDepositMist: reserveMist,
        priceMistPerToken,
        recipient: draft.recipient.address,
      });

      // Pre-flight devInspect — catches Move aborts (e.g. abort 101 for
      // duplicate pool) and any argument-type errors before the wallet
      // popups. The wallet's "transaction cannot be processed" message
      // is too opaque to act on, so we surface specific reasons here.
      const preflight = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: account.address,
      });
      if (preflight.effects.status.status === "failure") {
        const raw = preflight.effects.status.error ?? "Unknown contract error";
        const parsed = parseRedeemAbort(raw);
        const friendly = parsed
          ? parsed.message
          : `Pre-flight failed: ${raw}`;
        onDeploy({ kind: "error", message: friendly });
        return;
      }

      const result = await signAndExecute({ transaction: tx });
      onDeploy({ kind: "confirming", digest: result.digest });

      // Read the PoolCreated event off the settled tx so we can route to
      // the new pool's detail page. waitForTransaction with
      // `showEvents: true` gives us the parsed event payload.
      const settled = await client.waitForTransaction({
        digest: result.digest,
        options: { showEvents: true },
      });
      const createdEvent = settled.events?.find(
        (e) => e.type === REDEEM_EVENT_TYPE.PoolCreated,
      );
      const poolId = String(
        (createdEvent?.parsedJson as { pool_id?: unknown } | undefined)?.pool_id ?? "",
      );
      onDeploy({ kind: "success", digest: result.digest, poolId });
    } catch (err) {
      // Some wallets bubble up the abort code in the rejection message.
      // Try to parse it so the user sees the same friendly copy as
      // devInspect would have surfaced.
      const raw = err instanceof Error ? err.message : "Deploy failed.";
      const parsed = parseRedeemAbort(raw);
      onDeploy({
        kind: "error",
        message: parsed?.message ?? raw,
      });
    }
  };

  return (
    <>
      <StepHeader
        n={5}
        title="Review and deploy."
        body="One signed transaction calls pool::create_pool, splits the SUI from gas, and shares the new pool object. After this, the terms are locked on-chain."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: summary */}
        <section className="border border-ink/15 bg-bone">
          <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3.5">
            <MonoLabel className="text-[10px]">Summary</MonoLabel>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
              pool::create_pool
            </span>
          </header>
          <dl className="divide-y divide-ink/10 px-5 py-2">
            <Row label="Coin">
              <span className="font-mono text-[12.5px] text-ink">
                {draft.coin.name || "—"} ·{" "}
                <span className="text-ink/65">{symbol}</span>
              </span>
            </Row>
            <Row label="Coin type">
              <code className="font-mono text-[11.5px] break-all">{draft.coin.type}</code>
            </Row>
            <Row label="Decimals">
              <span className="font-mono tabular-nums text-[12.5px]">{decimals}</span>
            </Row>
            <Row label="Rate">
              <span className="font-mono tabular-nums text-[12.5px]">
                1 {symbol} ≈ {rateBn.toFixed(Math.min(6, 6))} SUI
              </span>
            </Row>
            <Row label="price_mist_per_token">
              <code className="font-mono text-[11.5px]">
                {priceMistPerToken.toString()}
              </code>
            </Row>
            <Row label="Recipient mode">
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.16em]",
                  draft.recipient.mode === "burn" ? "text-poppy" : "text-jade",
                )}
              >
                {draft.recipient.mode === "burn" ? "Burn" : "Buyback"}
              </span>
            </Row>
            <Row label="Recipient">
              <Address value={draft.recipient.address} />
            </Row>
            <Row label="Initial reserve">
              <span className="font-mono tabular-nums text-[12.5px]">
                {formatAmount(reserveMist, { decimals: 9, maxFractionDigits: 4 })} SUI
              </span>
            </Row>
          </dl>
        </section>

        {/* Right: permanence callout */}
        <aside className="border border-poppy bg-poppy/[0.08] p-5">
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-poppy">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-poppy" />
            Permanent
          </div>
          <h3 className="mt-2 font-display text-[1.5rem] leading-[1.05] text-ink">
            Once this signs, the terms are locked.
          </h3>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink/75">
            <li>
              <span className="font-mono text-[12px] text-ink">
                price_mist_per_token
              </span>{" "}
              cannot be changed.
            </li>
            <li>
              <span className="font-mono text-[12px] text-ink">recipient</span>{" "}
              cannot be changed.
            </li>
            <li>No admin override. No platform reversal.</li>
            <li>
              Only the SUI reserve depth changes as people redeem and deposit.
            </li>
          </ul>
        </aside>
      </div>

      {/* Deploy button + state */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-6">
        <button type="button" onClick={() => goPrev()} className={CTA_SECONDARY} disabled={isBusy}>
          <span aria-hidden>←</span>
          <span>Back</span>
        </button>

        {account ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!ready || isBusy}
            className={cn(CTA_PRIMARY, "h-14 px-8 text-[0.8125rem]")}
          >
            {isBusy ? (
              <>
                <Spinner size={14} className="text-bone" />
                <span>
                  {deploy.kind === "submitting"
                    ? "Sign in wallet…"
                    : "Confirming on chain…"}
                </span>
              </>
            ) : (
              <>
                <span>Deploy pool</span>
                <ArrowDiag size={12} />
              </>
            )}
          </button>
        ) : (
          <ConnectWallet />
        )}
      </div>

      {deploy.kind === "error" && (
        <p className="mt-5 border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy">
          {deploy.message}
        </p>
      )}
    </>
  );
}

/* ───────────────────────── Deploy success ───────────────────────── */

function DeploySuccess({
  poolId,
  digest,
  onAnother,
}: {
  poolId: string;
  digest: string;
  onAnother: () => void;
}) {
  const router = useRouter();

  // Auto-route after a beat so the user doesn't have to click — gives
  // them a moment to read the success state and copy the tx hash if
  // they want to.
  useEffect(() => {
    if (!poolId || poolId === "0xSIMULATED") return;
    const t = setTimeout(() => {
      router.push(`/redeem/${poolId}`);
    }, 4000);
    return () => clearTimeout(t);
  }, [poolId, router]);

  return (
    <section>
      <Container className="py-16 lg:py-24">
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
              Your redeem pool is live on-chain.
            </h2>
            <p className="mt-3 max-w-prose text-pretty text-[15px] text-ink/65">
              The contract has shared a new <code className="font-mono text-[13px]">RedeemPool&lt;T&gt;</code>{" "}
              object. Its rate and recipient are now locked. Anyone can
              redeem against it; anyone can deposit more SUI into the reserve.
            </p>

            <dl className="mt-7 divide-y divide-ink/10 border-y border-ink/15">
              <Row label="Pool ID">
                {poolId ? (
                  <Address value={poolId} />
                ) : (
                  <span className="font-mono text-[11px] text-ink/45">
                    Indexing…
                  </span>
                )}
              </Row>
              <Row label="Transaction">
                <TxHash value={digest} copyable />
              </Row>
            </dl>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {poolId && poolId !== "0xSIMULATED" ? (
                <Link href={`/redeem/${poolId}`} className={CTA_PRIMARY}>
                  <span>Open pool</span>
                  <ArrowDiag size={12} />
                </Link>
              ) : (
                <span className="inline-flex h-12 items-center gap-2 border border-ink/25 px-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
                  <Spinner size={12} className="text-ink/45" />
                  Indexing pool id…
                </span>
              )}
              <a
                href={explorerUrl("tx", digest)}
                target="_blank"
                rel="noreferrer"
                className={CTA_SECONDARY}
              >
                <span>View on Suiscan</span>
                <span aria-hidden>↗</span>
              </a>
              <button type="button" onClick={onAnother} className={cn(CTA_SECONDARY, "ml-auto")}>
                <span>Deploy another</span>
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

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

function sanitizeDecimal(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot >= 0) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

/**
 * Accept a coin type string and return it canonicalized, or `null` if it
 * doesn't look anywhere near valid. Adds the `0x` prefix on the package
 * address if missing — matches the normalization the discovery layer
 * applies to coin types from event payloads.
 */
function normalizeMaybeCoinType(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  // Need at least `<addr>::<module>::<TYPE>`.
  const segments = v.split("::");
  if (segments.length !== 3) return null;
  if (segments.some((s) => s.length === 0)) return null;
  const [addr, mod, type] = segments;
  // Module + type must be ASCII identifiers (Move grammar).
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(mod)) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(type)) return null;
  const lower = addr.startsWith("0x") ? addr.slice(2) : addr;
  if (!/^[0-9a-fA-F]+$/.test(lower)) return null;
  return `0x${lower}::${mod}::${type}`;
}

function isValidSuiAddress(addr: string): boolean {
  if (!addr) return false;
  if (!addr.startsWith("0x")) return false;
  const hex = addr.slice(2);
  // Sui canonical addresses are 32 bytes (64 hex). We accept anything in
  // [1..64] hex chars — Sui's SDK pads short addresses to 64. The contract
  // accepts pure-zero and other short hex values, so we don't over-validate.
  return /^[0-9a-fA-F]{1,64}$/.test(hex);
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function resolveIconUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("ipfs://")) {
    const cid = v.slice("ipfs://".length).replace(/^\/+/, "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (/^[a-z0-9]{20,}$/i.test(v)) return `https://ipfs.io/ipfs/${v}`;
  return v;
}
