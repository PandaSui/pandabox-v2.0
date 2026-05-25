"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { STORAGE_KEY, useWizard } from "@/lib/store/wizard";
import {
  StepCoin,
  StepIdentity,
  StepSale,
} from "@/lib/store/wizard-schema";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Frame } from "@/components/primitives/frame";
import { DeploySuccess } from "../deploy-success";
import {
  buildCreateProjectTx,
  IS_DEPLOYED,
  PACKAGE_ID,
  PROJECT_COIN_DECIMALS,
  UnsoldAction,
} from "@/lib/contracts/pandabox";
import { resolveBlobRef, uploadBlob, uploadJson } from "@/lib/ipfs";
import { bustProjectsCache } from "@/lib/server-actions/projects-cache";
import { formatAmount } from "@/lib/amount";
import { StepCard, StepHeader } from "../step-header";

const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

type SuccessSnapshot = {
  projectName: string;
  ticker?: string;
  coinSymbol?: string;
  coverImage?: string;
  tokensPerSui?: string;
  allocationTokens?: string;
  endTimeMs?: number | null;
  /** Fully-qualified Move coin type — the on-chain contract address users copy. */
  coinType?: string;
  /** The newly-created shared Project<T> object ID, if we managed to extract it. */
  projectId?: string;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "pinning"; step: "description" | "details" }
  | { kind: "signing" }
  | { kind: "success"; digest: string; snapshot: SuccessSnapshot }
  | { kind: "error"; message: string };

export function StepDeployForm() {
  const t = useTranslations("create.step4");
  const tCat = useTranslations("explore.categories");
  const draft = useWizard((s) => s.draft);
  const reset = useWizard((s) => s.reset);
  const setStep = useWizard((s) => s.setStep);
  const patchDeploy = useWizard((s) => s.patchDeploy);
  const account = useCurrentAccount();
  const router = useRouter();
  const client = useSuiClient();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  // Tracks whether the component is still mounted so the projectId resolver
  // can bail out instead of trying to setState after navigation away.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const checks = useMemo(() => validate(draft, t), [draft, t]);
  const ready = checks.every((c) => c.ok);
  const okCount = checks.filter((c) => c.ok).length;

  const onSubmit = async () => {
    if (!ready || !account) return;
    try {
      // 1. Pin description markdown.
      setState({ kind: "pinning", step: "description" });
      const descUpload = await uploadBlob(draft.identity.description ?? "", {
        filename: "description.md",
      });

      // 2. Pin project_details JSON (tagline, category, socials, etc.).
      setState({ kind: "pinning", step: "details" });
      const detailsUpload = await uploadJson(
        {
          version: 1,
          tagline: draft.identity.tagline ?? "",
          category: draft.identity.category ?? "art",
          ticker: draft.identity.ticker ?? "",
          socials: {
            twitter: draft.identity.twitter || undefined,
            website: draft.identity.website || undefined,
            discord: draft.identity.discord || undefined,
          },
        },
        { filename: "project_details.json" },
      );

      // 3. Convert UI values → on-chain u64s.
      //
      // The Move contract uses `tokens_raw = mist * base_rate` (no decimal
      // divisor), so `base_rate` is "raw token units per mist of SUI" — which
      // numerically equals "display tokens per SUI" when both sides have the
      // same decimals. Send the user's tokens-per-SUI number directly.
      //
      // `funding_allocation` is a raw token count, so it IS scaled by the
      // coin decimals.
      const tokensPerSui = new BigNumber(draft.sale.tokensPerSui ?? "0");
      const allocation = new BigNumber(draft.sale.allocationTokens ?? "0");
      const scale = new BigNumber(10).pow(PROJECT_COIN_DECIMALS);
      const baseRate = BigInt(
        tokensPerSui.integerValue(BigNumber.ROUND_DOWN).toFixed(0),
      );
      const fundingAllocation = BigInt(
        allocation.multipliedBy(scale).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
      );
      const unsoldAction =
        draft.sale.unsoldAction === "transfer_to_creator"
          ? UnsoldAction.TransferToCreator
          : UnsoldAction.Burn;

      // 4. Build + submit.
      setState({ kind: "signing" });

      if (!IS_DEPLOYED) {
        // No package — local-only simulated success.
        await new Promise((r) => setTimeout(r, 600));
        const snapshot = snapshotDraft(draft, t);
        clearPersistedDraft();
        // Simulated path — still bust the cache so any mocked listing reads
        // refresh, matching the real-deploy behaviour.
        // Best-effort cache bust; swallow failures so a cache-server hiccup
        // can't ever bubble up and look like the deploy itself failed.
        void bustProjectsCache().catch(() => {});
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
          snapshot,
        });
        return;
      }

      const tx = buildCreateProjectTx({
        coinType: draft.coin.coinType ?? "",
        treasuryCapId: draft.coin.treasuryCapId ?? "",
        coinMetadataId: draft.coin.coinMetadataId ?? "",
        name: draft.identity.name ?? "",
        descriptionBlobId: descUpload.blobId,
        iconUrl: draft.identity.coverImage ?? "",
        sourceCodeBlobId: draft.deploy.sourceCodeBlobId ?? "",
        projectDetailsBlobId: detailsUpload.blobId,
        baseRate,
        fundingAllocation,
        endTimeMs: draft.sale.endTimeMs ?? null,
        unsoldAction,
        sender: account.address,
      });

      // Cache CIDs in the draft so the inspector / preview can show them.
      patchDeploy({ sourceCodeBlobId: draft.deploy.sourceCodeBlobId ?? "" });

      const result = await signAndExecute({ transaction: tx });
      const snapshot = snapshotDraft(draft, t);
      clearPersistedDraft();
      // Bust the cached project lists used by /, /explore, and /dashboard so
      // the freshly-deployed project surfaces the moment the user navigates,
      // instead of waiting out the 60s ISR/data-cache window.
      void bustProjectsCache();
      // Show the success modal immediately with what we already know. The
      // project ID needs an extra RPC round-trip — we hydrate it in the
      // background so the user isn't waiting.
      setState({ kind: "success", digest: result.digest, snapshot });
      void resolveProjectId(client, result.digest).then((projectId) => {
        if (!projectId) return;
        if (!aliveRef.current) return;
        setState((s) =>
          s.kind === "success" && s.digest === result.digest
            ? { ...s, snapshot: { ...s.snapshot, projectId } }
            : s,
        );
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : t("errorDeployFailed"),
      });
    }
  };

  const onFinishSuccess = () => {
    const next =
      state.kind === "success" && state.snapshot.projectId
        ? `/projects/${state.snapshot.projectId}`
        : "/explore";
    // Kick off the route transition *before* resetting the wizard. If we
    // reset() first, the wizard's `step` flips to 1 and `WizardShell` would
    // unmount StepDeployForm to render StepIdentityForm — the user would
    // briefly see step 1 between the click and the new route landing.
    // localStorage was already wiped at submit time, so deferring the
    // in-memory reset is safe; it just keeps the deploy view visible
    // until navigation completes.
    setInspectorOpen(false);
    setState({ kind: "idle" });
    router.push(next);
    setTimeout(reset, 0);
  };

  const busy =
    state.kind === "pinning" || state.kind === "signing";

  return (
    <div className="space-y-8">
      <StepHeader
        n={4}
        accent="saffron"
        title={t("title")}
        body={t("body")}
        meta={t("metaChecks", {
          ok: okCount,
          total: checks.length,
          status: ready ? t("statusReady") : t("statusBlocked"),
        })}
      />

      <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
        <div className="flex items-start gap-3">
          <span className="font-mono-label text-poppy">{t("headsUp")}</span>
          <p className="text-sm text-ink/80">
            {t.rich("headsUpBody", {
              code: (chunks) => <code className="font-mono">{chunks}</code>,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      </Frame>

      <StepCard
        title={t("sourceCodeTitle")}
        meta={draft.deploy.sourceCodeBlobId ? t("sourceCodeMetaSet") : t("sourceCodeMetaSkipped")}
      >
        <label className="block">
          <span className="font-mono-label text-[10px] text-ink/55 block">
            {t("sourceCodeLabel")}
          </span>
          <input
            type="text"
            value={draft.deploy.sourceCodeBlobId ?? ""}
            onChange={(e) =>
              patchDeploy({ sourceCodeBlobId: e.target.value.trim() })
            }
            placeholder={t("sourceCodePlaceholder")}
            className="mt-2 h-12 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] placeholder:text-ink/30 focus:border-ink focus:outline-none focus:shadow-offset-sm"
          />
          <span className="mt-2 block font-mono text-[10px] text-ink/45">
            {t("sourceCodeHint")}
          </span>
        </label>
      </StepCard>

      <StepCard
        title={t("preflightTitle")}
        meta={ready ? t("preflightAllGreen") : t("preflightBlocking", { count: checks.length - okCount })}
      >
        <ul className="-mt-1 divide-y divide-ink/10">
          {checks.map((c) => (
            <li
              key={c.label}
              className={cn(
                "flex items-baseline justify-between gap-3 py-2.5",
                !c.ok && "text-poppy",
              )}
            >
              <span className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 translate-y-[2px] items-center justify-center font-mono text-[10px]",
                    c.ok
                      ? "border border-jade/40 bg-jade/10 text-jade"
                      : "border border-poppy/40 bg-poppy/10 text-poppy",
                  )}
                >
                  {c.ok ? "✓" : "!"}
                </span>
                <span className="text-sm">{c.label}</span>
              </span>
              {!c.ok && c.step && (
                <button
                  type="button"
                  onClick={() => setStep(c.step!)}
                  className="font-mono-label text-[10px] text-poppy underline-offset-4 hover:underline"
                >
                  {t("fixInStep", { num: String(c.step).padStart(2, "0") })}
                </button>
              )}
            </li>
          ))}
        </ul>
      </StepCard>

      <StepCard
        title={t("deployTitle")}
        meta={IS_DEPLOYED ? t("deployMetaLive") : t("deployMetaSimulated")}
      >
        <div className="flex flex-wrap items-center gap-3">
          {account ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              disabled={!ready}
              className={cn(CTA_BASE, "bg-saffron text-ink")}
            >
              <span>{t("deployToSui")}</span>
              <ArrowDiag size={14} />
            </button>
          ) : (
            <ConnectWallet />
          )}
          <span className="font-mono-label text-[10px] text-ink/45">
            {t("deployCaption")}
          </span>
        </div>
        <p className="font-mono text-[10px] text-ink/40">
          {t.rich("draftAutoSaves", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </p>
      </StepCard>

      <Modal
        open={inspectorOpen}
        onClose={() => {
          if (busy) return;
          if (state.kind === "success") {
            onFinishSuccess();
            return;
          }
          setInspectorOpen(false);
        }}
        title={
          state.kind === "success" ? t("modalSuccessTitle") : t("modalInspectorTitle")
        }
        className={state.kind === "success" ? undefined : "max-w-3xl"}
      >
        {state.kind === "success" ? (
          <DeploySuccess
            projectName={state.snapshot.projectName}
            ticker={state.snapshot.ticker}
            coinSymbol={state.snapshot.coinSymbol}
            coverImage={state.snapshot.coverImage}
            tokensPerSui={state.snapshot.tokensPerSui}
            allocationTokens={state.snapshot.allocationTokens}
            endTimeMs={state.snapshot.endTimeMs}
            coinType={state.snapshot.coinType}
            projectId={state.snapshot.projectId}
            txDigest={state.digest}
            onContinue={onFinishSuccess}
            continueLabel={
              state.snapshot.projectId ? t("openProjectPage") : t("seeItOnExplore")
            }
          />
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-sm text-ink/70">
              {IS_DEPLOYED
                ? t("inspectorIntroLive")
                : t("inspectorIntroSimulated")}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
            <section className="border border-ink/15">
              <div className="flex items-baseline justify-between border-b border-ink/15 px-3 py-2">
                <span className="font-mono-label text-[10px] text-ink/55">
                  {t("sectionProject")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(false);
                    setStep(1);
                  }}
                  className="font-mono-label text-[9px] text-ink/45 hover:text-ink"
                >
                  {t("editLink")}
                </button>
              </div>
              <CoverPreview
                src={draft.identity.coverImage}
                label={draft.identity.ticker || draft.coin.coinSymbol}
                t={t}
              />
              <dl className="divide-y divide-ink/10">
                <SummaryRow label={t("summaryName")} value={draft.identity.name || "—"} />
                <SummaryRow
                  label={t("summaryTicker")}
                  value={draft.identity.ticker || "—"}
                  mono
                />
                <SummaryRow
                  label={t("summaryCategory")}
                  value={
                    draft.identity.category
                      ? tCat(draft.identity.category)
                      : "—"
                  }
                />
                <SummaryRow
                  label={t("summaryTagline")}
                  value={draft.identity.tagline || "—"}
                />
              </dl>
            </section>

            <section className="border border-ink/15">
              <div className="flex items-baseline justify-between border-b border-ink/15 px-3 py-2">
                <span className="font-mono-label text-[10px] text-ink/55">
                  {t("sectionYourCoin")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(false);
                    setStep(2);
                  }}
                  className="font-mono-label text-[9px] text-ink/45 hover:text-ink"
                >
                  {t("editLink")}
                </button>
              </div>
              <dl className="divide-y divide-ink/10">
                <SummaryRow
                  label={t("summarySymbol")}
                  value={draft.coin.coinSymbol || "—"}
                  mono
                />
                <SummaryRow label={t("summaryName")} value={draft.coin.coinName || "—"} />
                <SummaryRow
                  label={t("summaryDecimals")}
                  value={String(draft.coin.coinDecimals ?? 9)}
                  mono
                />
              </dl>
            </section>
            </div>

            <div className="space-y-4">
            <section className="border border-ink/15">
              <div className="flex items-baseline justify-between border-b border-ink/15 px-3 py-2">
                <span className="font-mono-label text-[10px] text-ink/55">
                  {t("sectionSaleTerms")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(false);
                    setStep(3);
                  }}
                  className="font-mono-label text-[9px] text-ink/45 hover:text-ink"
                >
                  {t("editLink")}
                </button>
              </div>
              <dl className="divide-y divide-ink/10">
                <SummaryRow
                  label={t("summaryRate")}
                  value={`1 SUI → ${formatAmount(draft.sale.tokensPerSui ?? "0")} ${draft.coin.coinSymbol || t("tokensWord")}`}
                />
                <SummaryRow
                  label={t("summaryTotalForSale")}
                  value={`${formatAmount(draft.sale.allocationTokens ?? "0")} ${draft.coin.coinSymbol || t("tokensWord")}`}
                />
                <SummaryRow
                  label={t("summaryMaxSupply")}
                  value={`${formatAmount(draft.sale.allocationTokens ?? "0")} ${draft.coin.coinSymbol || t("tokensWord")}`}
                />
                <SummaryRow
                  label={t("summaryMintedAtLaunch")}
                  value={t("summaryMintedAtLaunchValue")}
                />
                <SummaryRow
                  label={t("summaryMaxRaise")}
                  value={`${formatAmount(maxRaiseSui(draft.sale.tokensPerSui, draft.sale.allocationTokens), { maxFractionDigits: 4 })} SUI`}
                />
                <SummaryRow
                  label={t("summarySaleEnds")}
                  value={
                    draft.sale.endTimeMs == null
                      ? t("summaryOpenEnded")
                      : formatEndsAt(draft.sale.endTimeMs)
                  }
                />
                <SummaryRow
                  label={t("summaryUnsoldTokens")}
                  value={
                    draft.sale.unsoldAction === "transfer_to_creator"
                      ? t("summaryUnsoldReturn")
                      : t("summaryUnsoldBurn")
                  }
                />
              </dl>
            </section>

            <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
              <div className="space-y-2 text-xs text-ink/80">
                <p>
                  <span className="font-mono-label text-poppy">
                    {t("youllKeepLabel")}
                  </span>{" "}
                  {t.rich("youllKeepBody", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                <p>
                  <span className="font-mono-label text-poppy">
                    {t("youllGiveUpLabel")}
                  </span>{" "}
                  {t.rich("youllGiveUpBody", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                <p>
                  <span className="font-mono-label text-poppy">
                    {t("lockedOnDeployLabel")}
                  </span>{" "}
                  {t("lockedOnDeployBody")}
                </p>
              </div>
            </Frame>
            </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer font-mono-label text-[10px] text-ink/45 hover:text-ink">
                {t("advancedToggle")}
              </summary>
              <div className="mt-2 border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
                <Row k="package">{PACKAGE_ID.slice(0, 18)}…</Row>
                <Row k="module">project</Row>
                <Row k="function">create_project&lt;T&gt;</Row>
                <Row k="type.T">
                  {draft.coin.coinType ? short(draft.coin.coinType) : "—"}
                </Row>
                <Row k="arg.treasury_cap">
                  {short(draft.coin.treasuryCapId ?? "")}
                </Row>
                <Row k="arg.metadata">
                  {short(draft.coin.coinMetadataId ?? "")}
                </Row>
                <Row k="arg.description_blob_id">
                  {state.kind === "pinning" && state.step === "description"
                    ? t("rawPinning")
                    : t("rawSetAtSubmit")}
                </Row>
                <Row k="arg.project_details_blob_id">
                  {state.kind === "pinning" && state.step === "details"
                    ? t("rawPinning")
                    : t("rawSetAtSubmit")}
                </Row>
                <Row k="arg.base_rate">
                  {new BigNumber(draft.sale.tokensPerSui ?? "0")
                    .integerValue(BigNumber.ROUND_DOWN)
                    .toFixed(0)}
                </Row>
                <Row k="arg.funding_allocation">
                  {bnScaled(draft.sale.allocationTokens).toFixed(0)}
                </Row>
                <Row k="arg.unsold_action">
                  {draft.sale.unsoldAction ?? "burn"} ·{" "}
                  {draft.sale.unsoldAction === "transfer_to_creator"
                    ? "1"
                    : "0"}
                </Row>
                <Row k="returns">ProjectAdminCap → sender</Row>
              </div>
            </details>

            {state.kind === "error" && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
              >
                {state.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setInspectorOpen(false)}
                className={cn(CTA_BASE, "bg-bone text-ink h-10 px-4")}
              >
                <span>{t("cancel")}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className={cn(CTA_BASE, "bg-saffron text-ink h-10 px-4")}
              >
                <span>
                  {state.kind === "pinning" && state.step === "description"
                    ? t("submitPinningDescription")
                    : state.kind === "pinning" && state.step === "details"
                      ? t("submitPinningDetails")
                      : state.kind === "signing"
                        ? t("submitSigning")
                        : t("submitPinAndDeploy")}
                </span>
                <ArrowDiag size={12} />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * Wipe the persisted draft from localStorage without touching React state.
 * Keeping the in-memory draft alive lets the success modal continue to
 * render (it lives inside StepDeployForm, which would unmount if reset()
 * sent the wizard back to step 1). A page refresh during the success modal
 * will read the now-empty key and start a fresh wizard.
 */
function clearPersistedDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be disabled (private mode, quota) — non-fatal.
  }
}

function snapshotDraft(
  draft: ReturnType<typeof useWizard.getState>["draft"],
  t: (key: string) => string,
): SuccessSnapshot {
  return {
    projectName: draft.identity.name || t("untitledProject"),
    ticker: draft.identity.ticker,
    coinSymbol: draft.coin.coinSymbol,
    coverImage: draft.identity.coverImage,
    tokensPerSui: draft.sale.tokensPerSui,
    allocationTokens: draft.sale.allocationTokens,
    endTimeMs: draft.sale.endTimeMs ?? null,
    coinType: draft.coin.coinType,
  };
}

/**
 * Look up the new `project::Project<T>` shared object ID from a create_project
 * transaction. The Move call returns the AdminCap to the sender; the Project
 * itself is shared. We poll `getTransactionBlock` with light backoff to handle
 * fullnodes that lag a beat on indexing object changes.
 *
 * Returns `undefined` on failure — the success modal still works without it,
 * just without the "open project page" link.
 */
async function resolveProjectId(
  client: ReturnType<typeof useSuiClient>,
  digest: string,
): Promise<string | undefined> {
  const delays = [600, 900, 1400, 2200];
  for (const ms of delays) {
    try {
      const res = await client.getTransactionBlock({
        digest,
        options: { showObjectChanges: true },
      });
      const changes = res.objectChanges ?? [];
      for (const c of changes) {
        if (c.type !== "created") continue;
        const t = c.objectType ?? "";
        if (
          t.startsWith(`${PACKAGE_ID}::project::Project<`) ||
          /::project::Project</.test(t)
        ) {
          return c.objectId;
        }
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, ms));
  }
  return undefined;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink/45">{k}</span>
      <span className="break-all text-ink">{children}</span>
    </div>
  );
}

/**
 * Cover-image confirmation banner inside the inspector's Project section.
 * Lets the deployer eyeball the artwork they're about to publish on-chain
 * before signing. Resolves the same way as the success modal — accepts
 * https URLs, ipfs://… refs, and bare CIDs. Falls back to a labeled
 * placeholder if no image was uploaded.
 */
function CoverPreview({
  src,
  label,
  t,
}: {
  src?: string;
  label?: string;
  t: (key: string) => string;
}) {
  const url = resolveBlobRef(src ?? "")?.url ?? null;
  const tag = (label || t("coverWord")).toUpperCase();
  return (
    <div className="relative aspect-[5/2] w-full overflow-hidden border-b border-ink/10 bg-ink/[0.04]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={t("projectCoverPreviewAlt")}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-mono-label text-[10px] text-ink/40">
            {t("noCover")} · {tag}
          </span>
        </div>
      )}
      <span
        aria-hidden
        className="absolute left-2 top-2 inline-flex items-center gap-1.5 border border-ink/20 bg-bone/90 px-1.5 py-0.5 font-mono-label text-[9px] text-ink/70 backdrop-blur-[2px]"
      >
        <span className="block h-1 w-1 rounded-full bg-saffron" />
        {t("coverWord")} · {tag}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <span className="font-mono-label text-[10px] text-ink/55">{label}</span>
      <span
        className={cn(
          "max-w-[60%] break-words text-right text-ink",
          mono ? "font-mono text-[12px] tabular-nums" : "text-sm",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function maxRaiseSui(
  tokensPerSui: string | undefined,
  allocationTokens: string | undefined,
): string {
  const rate = new BigNumber(tokensPerSui ?? "0");
  const alloc = new BigNumber(allocationTokens ?? "0");
  if (!rate.isFinite() || rate.isZero() || !alloc.isFinite()) return "0";
  return alloc.dividedBy(rate).toFixed();
}

function formatEndsAt(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function short(s: string): string {
  if (!s) return "—";
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
}

function bnScaled(s: string | undefined): BigNumber {
  const v = new BigNumber(s ?? "0");
  if (!v.isFinite()) return new BigNumber(0);
  return v.multipliedBy(new BigNumber(10).pow(PROJECT_COIN_DECIMALS));
}

type Check = { label: string; ok: boolean; step?: number };

function validate(
  draft: ReturnType<typeof useWizard.getState>["draft"],
  t: (key: string, params?: Record<string, string | number>) => string,
): Check[] {
  const out: Check[] = [];

  const identity = StepIdentity.safeParse(draft.identity);
  out.push({
    label: identity.success
      ? t("checkIdentityOk")
      : t("checkIdentityErr", { msg: identity.error.issues[0]?.message ?? t("checkIncomplete") }),
    ok: identity.success,
    step: 1,
  });

  const coin = StepCoin.safeParse(draft.coin);
  const decimalsOk =
    !draft.coin.coinDecimals ||
    draft.coin.coinDecimals === PROJECT_COIN_DECIMALS;
  out.push({
    label: coin.success
      ? decimalsOk
        ? t("checkCoinOk", {
            symbol: draft.coin.coinSymbol ?? "?",
            decimals: draft.coin.coinDecimals ?? 9,
          })
        : t("checkCoinWrongDecimals", {
            decimals: draft.coin.coinDecimals ?? 0,
            required: PROJECT_COIN_DECIMALS,
          })
      : t("checkCoinErr", { msg: coin.error.issues[0]?.message ?? t("checkIncomplete") }),
    ok: coin.success && decimalsOk,
    step: 2,
  });

  const sale = StepSale.safeParse(draft.sale);
  out.push({
    label: sale.success
      ? t("checkSaleOk")
      : t("checkSaleErr", { msg: sale.error.issues[0]?.message ?? t("checkIncomplete") }),
    ok: sale.success,
    step: 3,
  });

  return out;
}
