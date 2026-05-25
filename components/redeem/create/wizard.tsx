"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

/** Stable keys — translation labels resolved at render time via `nav.<key>`. */
const STEPS = [
  { key: "coin" },
  { key: "rate" },
  { key: "recipient" },
  { key: "reserve" },
  { key: "deploy" },
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

  const t = useTranslations("redeem.create.hydration");

  const [deploy, setDeploy] = useState<DeployState>({ kind: "idle" });
  const [resetOpen, setResetOpen] = useState(false);
  const stepperLocked = deploy.kind === "submitting" || deploy.kind === "confirming";

  if (!hydrated) {
    return (
      <section>
        <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-3 py-20">
          <Spinner size={22} className="text-ink/55" label={t("restoring")} />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {t("restoring")}
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
        <StepNav
          current={step}
          onChange={(n) => !stepperLocked && setStep(n)}
          onReset={stepperLocked ? undefined : () => setResetOpen(true)}
        />

        <div className="mt-10">
          {step === 1 && <StepCoin />}
          {step === 2 && <StepRate />}
          {step === 3 && <StepRecipient />}
          {step === 4 && <StepReserve />}
          {step === 5 && <StepReview deploy={deploy} onDeploy={setDeploy} />}
        </div>
      </Container>

      <ResetConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          reset();
          setDeploy({ kind: "idle" });
          setResetOpen(false);
        }}
      />
    </section>
  );
}

/* ───────────────────────── Step navigation ───────────────────────── */

function StepNav({
  current,
  onChange,
  onReset,
}: {
  current: number;
  onChange: (n: number) => void;
  onReset?: () => void;
}) {
  const t = useTranslations("redeem.create.nav");
  return (
    <nav
      aria-label={t("aria")}
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
              {t(s.key)}
            </span>
          </button>
        );
      })}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className={cn(
            "ml-auto group relative inline-flex items-center justify-center gap-1.5",
            "h-8 px-3 border border-ink/25 bg-bone",
            "font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/70",
            "shadow-offset-sm transition-all duration-300 ease-atelier",
            "hover:-translate-x-[1px] hover:-translate-y-[1px] hover:border-poppy hover:text-poppy hover:shadow-offset",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-poppy",
          )}
        >
          <span aria-hidden>↺</span>
          <span>{t("reset")}</span>
        </button>
      )}
    </nav>
  );
}

/* ───────────────────────── Reset confirm modal ───────────────────────── */

/**
 * Wizard-reset confirmation. Surfaced from the stepper's right-aligned
 * reset button. Wipes the persisted draft + clears any in-flight deploy
 * state, returning the wizard to step 1 with empty inputs. Destructive
 * (poppy accent) because the draft can't be recovered after confirm.
 *
 * Self-contained: there's no shared modal primitive in the repo yet,
 * so this owns its own backdrop, escape-key handling, and body-scroll
 * lock. Promote to `components/primitives/modal.tsx` if a second caller
 * appears.
 */
function ResetConfirmModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("redeem.create.nav");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label={t("resetCancel")}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md border border-ink bg-bone shadow-offset">
        <span aria-hidden className="block h-[3px] bg-poppy" />
        <div className="px-6 py-6">
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-poppy">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-poppy" />
            {t("resetEyebrow")}
          </div>
          <h2
            id="reset-confirm-title"
            className="mt-2 font-display text-[1.5rem] leading-[1.05]"
          >
            {t("resetTitle")}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink/70">
            {t("resetBody")}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-ink/10 pt-5">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "inline-flex h-10 items-center justify-center px-4",
                "font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/70",
                "transition-colors hover:text-ink",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink",
              )}
            >
              {t("resetCancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              autoFocus
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 px-5",
                "border border-poppy bg-poppy text-bone",
                "font-mono text-[10.5px] uppercase tracking-[0.16em]",
                "shadow-offset-sm transition-all duration-300 ease-atelier",
                "hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-offset",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-poppy",
              )}
            >
              <span aria-hidden>↺</span>
              <span>{t("resetConfirmAction")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
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
  body?: React.ReactNode;
}) {
  const t = useTranslations("redeem.create.nav");
  return (
    <header className="mb-8 border-b border-ink/15 pb-6">
      <AccentRule color="sun">
        <MonoLabel className="text-[10px]">
          {t("stepOf", { n: String(n).padStart(2, "0") })}
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
  nextLabel,
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
  const t = useTranslations("redeem.create.actions");
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-6">
      {hideBack ? (
        <span />
      ) : (
        <button type="button" onClick={onBack} className={CTA_SECONDARY}>
          <span aria-hidden>←</span>
          <span>{t("back")}</span>
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className={CTA_PRIMARY}
      >
        <span>{nextLabel ?? t("continue")}</span>
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
  const t = useTranslations("redeem.create.coin");
  const tExisting = useTranslations("redeem.create.existingPool");
  const tOwner = useTranslations("redeem.create.metadataOwner");
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

  // Resolve who owns the `CoinMetadata<T>` object. The redeem contract
  // takes it by `&CoinMetadata<T>` — Sui's object-ownership rules mean
  // an *owned* metadata object can only appear as a tx input when the
  // signer is its owner. Most coins call `transfer::public_freeze_object`
  // on the metadata after mint so anyone can reference it; some don't
  // (e.g. coins deployed via certain launch tools). If the metadata is
  // owned by another address, the wallet's dry-run fails with the opaque
  // "transaction could not be processed" error — so we detect it here
  // and surface a clear, actionable banner instead of letting the user
  // walk through four more steps to hit a cryptic wallet failure.
  type OwnershipState =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "ok"; mode: "frozen" | "shared" | "self" }
    | { kind: "blocked"; owner: string }
    | { kind: "blocked-no-wallet" };
  const [ownership, setOwnership] = useState<OwnershipState>({ kind: "idle" });
  useEffect(() => {
    if (!normalized || !metadata?.id) {
      setOwnership({ kind: "idle" });
      return;
    }
    if (!account?.address) {
      // We can resolve the owner without a wallet, but until one is
      // connected we don't know whether "owned by X" means "owned by you"
      // or "owned by someone else" — surface a soft block that prompts
      // a connect.
      setOwnership({ kind: "blocked-no-wallet" });
      return;
    }
    let cancelled = false;
    setOwnership({ kind: "checking" });
    client
      .getObject({ id: metadata.id, options: { showOwner: true } })
      .then((res) => {
        if (cancelled) return;
        const owner = res.data?.owner;
        if (!owner) {
          // No owner field — treat as a transient resolution failure
          // rather than a hard block; the wallet dry-run will be the
          // ultimate authority if the user proceeds.
          setOwnership({ kind: "ok", mode: "frozen" });
          return;
        }
        if (owner === "Immutable") {
          setOwnership({ kind: "ok", mode: "frozen" });
          return;
        }
        if (typeof owner === "object") {
          if ("Shared" in owner) {
            setOwnership({ kind: "ok", mode: "shared" });
            return;
          }
          if ("AddressOwner" in owner) {
            const ownerAddr = owner.AddressOwner;
            if (ownerAddr === account.address) {
              setOwnership({ kind: "ok", mode: "self" });
            } else {
              setOwnership({ kind: "blocked", owner: ownerAddr });
            }
            return;
          }
          if ("ObjectOwner" in owner) {
            setOwnership({ kind: "blocked", owner: owner.ObjectOwner });
            return;
          }
        }
        setOwnership({ kind: "ok", mode: "frozen" });
      })
      .catch(() => {
        if (!cancelled) setOwnership({ kind: "ok", mode: "frozen" });
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, metadata?.id, account?.address, client]);
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
  // Existing pools for the same coin are allowed by the contract — we no
  // longer block here, just inform. So the requirements for Step 1 are:
  // a resolved coin type, a known metadata object, AND a metadata object
  // the connected wallet is actually allowed to reference. The wallet's
  // dry-run rejects any tx that includes an owned-by-someone-else object
  // as input, so without this gate the user would silently hit a generic
  // wallet error at deploy time.
  const ownershipOk = ownership.kind === "ok";
  const canNext = !!resolved && !!draft.coin.metadataId && ownershipOk;

  return (
    <>
      <StepHeader n={1} title={t("title")} body={t("body")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: input */}
        <div className="space-y-5">
          <Field label={t("fieldLabel")} hint={t("fieldHint")}>
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
                {t("fromWallet")}
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
              ? t("errorMeta")
              : normalized && metadata === null
                ? t("errorNoMetadata")
                : null
          }
          metadata={resolved}
          iconUrl={draft.coin.iconUrl}
        />
      </div>

      {/* Existing-pool banner — informational, not blocking. The contract
          permits multiple pools per coin type, so a dev who wants to ship
          their own (different rate / recipient) can. The banner gives
          them a one-tap path to the existing pool if redeeming was what
          they actually wanted, and a dismiss for the rest. */}
      {existingPool && (
        <div className="mt-8 relative overflow-hidden border border-sun/40 bg-sun/[0.08]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-sun" />
          <div className="px-5 py-5 md:px-6">
            <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/85">
              <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-sun" />
              {tExisting("eyebrow")}
            </div>
            <h3 className="mt-2 font-display text-[1.35rem] leading-[1.1]">
              {tExisting("title")}
            </h3>
            <p className="mt-2 max-w-prose text-[13.5px] text-ink/70">
              {tExisting("body")}
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-y-1.5 font-mono text-[11px] text-ink/55 sm:grid-cols-2 sm:gap-x-4">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-ink/40">
                  {tExisting("pool")}
                </span>
                <Address value={existingPool.poolId} />
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-ink/40">
                  {tExisting("by")}
                </span>
                <Address value={existingPool.creator} />
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={`/redeem/${existingPool.poolId}`}
                className={CTA_SECONDARY}
              >
                <span>{tExisting("openExisting")}</span>
                <ArrowDiag size={11} />
              </Link>
              <button
                type="button"
                onClick={() => setExistingPool(null)}
                className="inline-flex h-12 items-center gap-2 px-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-ink"
              >
                <span>{tExisting("continueAnyway")}</span>
                <span aria-hidden>↓</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {existingChecking && !existingPool && resolved && (
        <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          <Spinner size={11} className="text-ink/55" />
          {tExisting("checking")}
        </div>
      )}

      {resolved && ownership.kind === "checking" && (
        <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/55">
          <Spinner size={11} className="text-ink/55" />
          {tOwner("checking")}
        </div>
      )}

      {resolved && ownership.kind === "blocked" && (
        <div className="mt-8 relative overflow-hidden border border-poppy/40 bg-poppy/[0.06]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-poppy" />
          <div className="px-5 py-5 md:px-6">
            <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-poppy">
              <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-poppy" />
              {tOwner("eyebrow")}
            </div>
            <h3 className="mt-2 font-display text-[1.35rem] leading-[1.1]">
              {tOwner("title")}
            </h3>
            <p className="mt-2 max-w-prose text-[13.5px] text-ink/70">
              {tOwner("body")}
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-y-1.5 font-mono text-[11px] text-ink/55 sm:grid-cols-2 sm:gap-x-4">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-ink/40">
                  {tOwner("ownerLabel")}
                </span>
                <Address value={ownership.owner} />
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.14em] text-ink/40">
                  {tOwner("youLabel")}
                </span>
                {account ? (
                  <Address value={account.address} />
                ) : (
                  <span className="font-mono text-ink/45">—</span>
                )}
              </div>
            </dl>
            <p className="mt-4 max-w-prose font-mono text-[11px] leading-relaxed text-ink/55">
              {tOwner("hint")}
            </p>
          </div>
        </div>
      )}

      {resolved && ownership.kind === "blocked-no-wallet" && (
        <div className="mt-8 border border-sun/40 bg-sun/[0.08] px-5 py-4">
          <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/85">
            <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-sun" />
            {tOwner("connectEyebrow")}
          </div>
          <p className="mt-2 max-w-prose text-[13.5px] text-ink/70">
            {tOwner("connectBody")}
          </p>
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
  const t = useTranslations("redeem.create.coin");
  return (
    <aside className="border border-ink/15 bg-bone">
      <header className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
        <MonoLabel className="text-[10px]">{t("resolution")}</MonoLabel>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
          0x2::coin::CoinMetadata
        </span>
      </header>
      <div className="px-5 py-5">
        {isFetching ? (
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
            <Spinner size={12} className="text-ink/55" />
            {t("resolving")}
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
                <span>{t("decimals", { n: metadata.decimals ?? "?" })}</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-jade">
                <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-jade" />
                {t("resolved")}
              </div>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/40">
            {t("awaiting")}
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
  const t = useTranslations("redeem.create.rate");

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
  // contract would treat the pool as a freebie.
  const validation =
    rateBn.lte(0)
      ? null
      : priceMistPerToken === 0n
        ? t("validationTooSmall", {
            decimals,
            minimum: new BigNumber(10).pow(decimals - 9).toFixed(decimals - 9),
          })
        : null;

  const canNext = priceMistPerToken > 0n && !validation;

  return (
    <>
      <StepHeader n={2} title={t("title")} body={t("body", { symbol })} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: input + permanent warning */}
        <div className="space-y-5">
          <Field
            label={t("fieldLabel", { symbol })}
            hint={t("fieldHint")}
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
                  aria-label={t("fieldLabel", { symbol })}
                />
                <span className="pr-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                  {t("rateUnit", { symbol })}
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
            {t.rich("permanentNote", {
              code: (chunks) => <code className="font-mono">{chunks}</code>,
            })}
          </p>
        </div>

        {/* Right: calculator */}
        <aside className="border border-ink/15 bg-bone">
          <header className="border-b border-ink/15 px-5 py-3.5">
            <MonoLabel className="text-[10px]">{t("calculator")}</MonoLabel>
          </header>
          <dl className="divide-y divide-ink/10 px-5 py-2">
            <Row label={t("calcOneToken", { symbol })}>
              <span className="font-mono tabular-nums">
                {rateBn.gt(0) ? rateBn.toFixed(Math.min(8, 6)) : "0.000"} SUI
              </span>
            </Row>
            <Row label={t("calcOneSui")}>
              <span className="font-mono tabular-nums">
                {tokensPerSui.gt(0)
                  ? new BigNumber(tokensPerSui).toFormat(2, BigNumber.ROUND_DOWN)
                  : "0"}{" "}
                {symbol}
              </span>
            </Row>
            <Row label={t("calcRedeeming")}>
              <span className="font-mono tabular-nums">
                {t("calcResult", {
                  amount: formatAmount(sampleSuiMist, {
                    decimals: 9,
                    compact: false,
                    maxFractionDigits: 4,
                  }),
                })}
              </span>
            </Row>
            <Row label={t("calcRaw")}>
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
  const t = useTranslations("redeem.create.recipient");

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
      <StepHeader n={3} title={t("title")} body={t("body")} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ModeCard
          active={mode === "burn"}
          accent="poppy"
          title={t("burn.title")}
          tag={t("burn.tag")}
          body={t.rich("burn.body", {
            code: (chunks) => (
              <code className="font-mono text-[12.5px] text-ink">{chunks}</code>
            ),
          })}
          footer={
            <span className="font-mono text-[10.5px] text-ink/55">
              {t.rich("burn.footer", {
                code: (chunks) => <code className="text-ink">{chunks}</code>,
              })}
            </span>
          }
          onClick={() => setMode("burn")}
        />
        <ModeCard
          active={mode === "buyback"}
          accent="jade"
          title={t("buyback.title")}
          tag={t("buyback.tag")}
          body={t("buyback.body")}
          footer={
            <span className="font-mono text-[10.5px] text-ink/55">
              {t("buyback.footerLabel")}{" "}
              <code className="text-ink">
                {mode === "buyback" && addressValid
                  ? shortAddr(draft.recipient.address)
                  : t("buyback.footerPlaceholder")}
              </code>
            </span>
          }
          onClick={() => setMode("buyback")}
        />
      </div>

      {mode === "buyback" && (
        <div className="mt-8">
          <Field
            label={t("addressLabel")}
            hint={t("addressHint")}
            error={
              draft.recipient.address && !addressValid
                ? t("addressInvalid")
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
          {t.rich("permanentNote", {
            code: (chunks) => <code className="font-mono">{chunks}</code>,
          })}
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
  body: React.ReactNode;
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
  const t = useTranslations("redeem.create.reserve");

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

  const validation = overdraft ? t("validationOverdraft") : null;
  const canNext = reserveMist > 0n && !validation;

  return (
    <>
      <StepHeader n={4} title={t("title")} body={t("body")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Field label={t("fieldLabel")} hint={t("fieldHint")}>
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
                  aria-label={t("amountAria")}
                />
                <span className="pr-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                  SUI
                </span>
              </div>
            )}
          </Field>

          <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">
            <span>{t("yourWallet")}</span>
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
              {t("gasWarning")}
            </p>
          )}
        </div>

        <aside className="border border-ink/15 bg-bone">
          <header className="border-b border-ink/15 px-5 py-3.5">
            <MonoLabel className="text-[10px]">{t("capacityTitle")}</MonoLabel>
          </header>
          <dl className="divide-y divide-ink/10 px-5 py-2">
            <Row label={t("depthLabel")}>
              <span className="font-mono tabular-nums">
                {reserveMist > 0n
                  ? formatAmount(reserveMist, { decimals: 9, maxFractionDigits: 4 }) +
                    " SUI"
                  : "—"}
              </span>
            </Row>
            <Row label={t("supportsLabel")}>
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
            {t("capacityNote")}
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
  const t = useTranslations("redeem.create.review");
  const tActions = useTranslations("redeem.create.actions");

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
      const txArgs = {
        coinType: draft.coin.type,
        coinMetadataId: draft.coin.metadataId,
        initialDepositMist: reserveMist,
        priceMistPerToken,
        recipient: draft.recipient.address,
      };

      // Pre-flight devInspect — catches Move aborts (e.g. abort 100 for
      // zero price, 101 for zero-address recipient) and surfaces them as
      // friendly copy. Build a dedicated Transaction for this: passing
      // it to devInspect serializes it in kind-only mode and caches the
      // bytes, after which the wallet's gas-bearing build fails with the
      // opaque "transaction could not be processed" error.
      const preflightTx = buildCreatePoolTx(txArgs);
      const preflight = await client.devInspectTransactionBlock({
        transactionBlock: preflightTx,
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

      const tx = buildCreatePoolTx(txArgs);
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

  const tRecipient = (m: "burn" | "buyback") =>
    m === "burn" ? "Burn" : "Buyback";

  const renderRecipientMode = (m: "burn" | "buyback") => tRecipient(m);

  return (
    <>
      <StepHeader n={5} title={t("title")} body={t("body")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: summary */}
        <section className="border border-ink/15 bg-bone">
          <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3.5">
            <MonoLabel className="text-[10px]">{t("summary")}</MonoLabel>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink/40">
              {t("summaryMeta")}
            </span>
          </header>
          <dl className="divide-y divide-ink/10 px-5 py-2">
            <Row label={t("fieldCoin")}>
              <span className="font-mono text-[12.5px] text-ink">
                {draft.coin.name || "—"} ·{" "}
                <span className="text-ink/65">{symbol}</span>
              </span>
            </Row>
            <Row label={t("fieldCoinType")}>
              <code className="font-mono text-[11.5px] break-all">{draft.coin.type}</code>
            </Row>
            <Row label={t("fieldDecimals")}>
              <span className="font-mono tabular-nums text-[12.5px]">{decimals}</span>
            </Row>
            <Row label={t("fieldRate")}>
              <span className="font-mono tabular-nums text-[12.5px]">
                1 {symbol} ≈ {rateBn.toFixed(Math.min(6, 6))} SUI
              </span>
            </Row>
            <Row label={t("fieldPriceRaw")}>
              <code className="font-mono text-[11.5px]">
                {priceMistPerToken.toString()}
              </code>
            </Row>
            <Row label={t("fieldRecipientMode")}>
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.16em]",
                  draft.recipient.mode === "burn" ? "text-poppy" : "text-jade",
                )}
              >
                {renderRecipientMode(draft.recipient.mode)}
              </span>
            </Row>
            <Row label={t("fieldRecipient")}>
              <Address value={draft.recipient.address} />
            </Row>
            <Row label={t("fieldInitialReserve")}>
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
            {t("permanentEyebrow")}
          </div>
          <h3 className="mt-2 font-display text-[1.5rem] leading-[1.05] text-ink">
            {t("permanentHeadline")}
          </h3>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink/75">
            <li>
              {t.rich("permanentItem1", {
                code: (chunks) => (
                  <span className="font-mono text-[12px] text-ink">{chunks}</span>
                ),
              })}
            </li>
            <li>
              {t.rich("permanentItem2", {
                code: (chunks) => (
                  <span className="font-mono text-[12px] text-ink">{chunks}</span>
                ),
              })}
            </li>
            <li>{t("permanentItem3")}</li>
            <li>{t("permanentItem4")}</li>
          </ul>
        </aside>
      </div>

      {/* Deploy button + state */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-6">
        <button type="button" onClick={() => goPrev()} className={CTA_SECONDARY} disabled={isBusy}>
          <span aria-hidden>←</span>
          <span>{tActions("back")}</span>
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
                    ? tActions("signInWallet")
                    : tActions("confirming")}
                </span>
              </>
            ) : (
              <>
                <span>{tActions("deployPool")}</span>
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
  const t = useTranslations("redeem.create.success");

  // Auto-route after a beat so the user doesn't have to click — gives them
  // time to read the success state and copy the tx hash if they want to.
  useEffect(() => {
    if (!poolId || poolId === "0xSIMULATED") return;
    const timeout = setTimeout(() => {
      router.push(`/redeem/${poolId}`);
    }, 4000);
    return () => clearTimeout(timeout);
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
              {t("eyebrow")}
            </div>
            <h2 className="mt-4 font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.02]">
              {t("headline")}
            </h2>
            <p className="mt-3 max-w-prose text-pretty text-[15px] text-ink/65">
              {t.rich("body", {
                code: (chunks) => (
                  <code className="font-mono text-[13px]">{chunks}</code>
                ),
              })}
            </p>

            <dl className="mt-7 divide-y divide-ink/10 border-y border-ink/15">
              <Row label={t("poolIdLabel")}>
                {poolId ? (
                  <Address value={poolId} />
                ) : (
                  <span className="font-mono text-[11px] text-ink/45">
                    {t("indexing")}
                  </span>
                )}
              </Row>
              <Row label={t("transactionLabel")}>
                <TxHash value={digest} copyable />
              </Row>
            </dl>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {poolId && poolId !== "0xSIMULATED" ? (
                <Link href={`/redeem/${poolId}`} className={CTA_PRIMARY}>
                  <span>{t("openPool")}</span>
                  <ArrowDiag size={12} />
                </Link>
              ) : (
                <span className="inline-flex h-12 items-center gap-2 border border-ink/25 px-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
                  <Spinner size={12} className="text-ink/45" />
                  {t("indexingPoolId")}
                </span>
              )}
              <a
                href={explorerUrl("tx", digest)}
                target="_blank"
                rel="noreferrer"
                className={CTA_SECONDARY}
              >
                <span>{t("viewSuiscan")}</span>
                <span aria-hidden>↗</span>
              </a>
              <button type="button" onClick={onAnother} className={cn(CTA_SECONDARY, "ml-auto")}>
                <span>{t("deployAnother")}</span>
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
