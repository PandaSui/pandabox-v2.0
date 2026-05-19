"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { uploadBlob, uploadJson } from "@/lib/ipfs";
import { formatAmount } from "@/lib/amount";
import { StepCard, StepHeader } from "../step-header";

const CATEGORY_LABEL: Record<string, string> = {
  art: "Art",
  infra: "Infra",
  dao: "DAO",
  research: "Research",
  gaming: "Gaming",
  music: "Music",
  social: "Social",
  rwa: "RWA",
};

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

  const checks = useMemo(() => validate(draft), [draft]);
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
        const snapshot = snapshotDraft(draft);
        clearPersistedDraft();
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
      const snapshot = snapshotDraft(draft);
      clearPersistedDraft();
      // Show the success modal immediately with what we already know. The
      // project ID needs an extra RPC round-trip — we hydrate it in the
      // background so the user isn't waiting.
      setState({ kind: "success", digest: result.digest, snapshot });
      void resolveProjectId(client, result.digest).then((projectId) => {
        if (!projectId) return;
        setState((s) =>
          s.kind === "success" && s.digest === result.digest
            ? { ...s, snapshot: { ...s.snapshot, projectId } }
            : s,
        );
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Deploy failed.",
      });
    }
  };

  const onFinishSuccess = () => {
    const next =
      state.kind === "success" && state.snapshot.projectId
        ? `/p/${state.snapshot.projectId}`
        : "/explore";
    reset();
    setInspectorOpen(false);
    setState({ kind: "idle" });
    router.push(next);
  };

  const busy =
    state.kind === "pinning" || state.kind === "signing";

  return (
    <div className="space-y-8">
      <StepHeader
        n={4}
        accent="saffron"
        title="Review & deploy"
        body="Pandabox pins your description and project_details to IPFS, then submits a single Sui transaction that creates the project, consumes your TreasuryCap, and transfers a ProjectAdminCap to your wallet."
        meta={`${okCount}/${checks.length} checks · ${ready ? "ready" : "blocked"}`}
      />

      <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
        <div className="flex items-start gap-3">
          <span className="font-mono-label text-poppy">Heads up</span>
          <p className="text-sm text-ink/80">
            <strong>Consumed on deploy:</strong> your{" "}
            <code className="font-mono">TreasuryCap&lt;T&gt;</code> and{" "}
            <code className="font-mono">CoinMetadata&lt;T&gt;</code> become
            owned by the Project object and can't be retrieved.{" "}
            <strong>Immutable on deploy:</strong> name, coin, base rate,
            allocation, end time, unsold-action.{" "}
            <strong>Editable later:</strong> description, icon, source-code
            blob, project_details (via{" "}
            <code className="font-mono">update_metadata</code>).
          </p>
        </div>
      </Frame>

      <StepCard
        title="Optional · source code"
        meta={draft.deploy.sourceCodeBlobId ? "set" : "skipped"}
      >
        <label className="block">
          <span className="font-mono-label text-[10px] text-ink/55 block">
            Source code blob (IPFS CID)
          </span>
          <input
            type="text"
            value={draft.deploy.sourceCodeBlobId ?? ""}
            onChange={(e) =>
              patchDeploy({ sourceCodeBlobId: e.target.value.trim() })
            }
            placeholder="Qm… / bafy… (optional)"
            className="mt-2 h-12 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] placeholder:text-ink/30 focus:border-ink focus:outline-none focus:shadow-offset-sm"
          />
          <span className="mt-2 block font-mono text-[10px] text-ink/45">
            Pin your repo archive separately and paste the CID. Or leave blank
            and update later.
          </span>
        </label>
      </StepCard>

      <StepCard
        title="Pre-flight checks"
        meta={ready ? "all green" : `${checks.length - okCount} blocking`}
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
                  fix in step {String(c.step).padStart(2, "0")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </StepCard>

      <StepCard
        title="Deploy"
        meta={IS_DEPLOYED ? "live · sui mainnet" : "simulated"}
      >
        <div className="flex flex-wrap items-center gap-3">
          {account ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              disabled={!ready}
              className={cn(CTA_BASE, "bg-saffron text-ink")}
            >
              <span>Deploy to Sui</span>
              <ArrowDiag size={14} />
            </button>
          ) : (
            <ConnectWallet />
          )}
          <span className="font-mono-label text-[10px] text-ink/45">
            consumes treasury cap + metadata · admin cap returned to you
          </span>
        </div>
        <p className="font-mono text-[10px] text-ink/40">
          Draft auto-saves to your browser as <code>pandabox:draft:v3</code>.
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
        title="Transaction inspector"
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
              state.snapshot.projectId ? "Open project page" : "See it on Explore"
            }
          />
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-sm text-ink/70">
              {IS_DEPLOYED
                ? "Review what you're about to publish. Pandabox will pin your description and details to IPFS, then your wallet will sign one transaction that creates the project on Sui."
                : "Move package not configured — this submission will be simulated locally."}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
            <section className="border border-ink/15">
              <div className="flex items-baseline justify-between border-b border-ink/15 px-3 py-2">
                <span className="font-mono-label text-[10px] text-ink/55">
                  Project
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(false);
                    setStep(1);
                  }}
                  className="font-mono-label text-[9px] text-ink/45 hover:text-ink"
                >
                  edit
                </button>
              </div>
              <dl className="divide-y divide-ink/10">
                <SummaryRow label="Name" value={draft.identity.name || "—"} />
                <SummaryRow
                  label="Ticker"
                  value={draft.identity.ticker || "—"}
                  mono
                />
                <SummaryRow
                  label="Category"
                  value={
                    draft.identity.category
                      ? (CATEGORY_LABEL[draft.identity.category] ??
                        draft.identity.category)
                      : "—"
                  }
                />
                <SummaryRow
                  label="Tagline"
                  value={draft.identity.tagline || "—"}
                />
              </dl>
            </section>

            <section className="border border-ink/15">
              <div className="flex items-baseline justify-between border-b border-ink/15 px-3 py-2">
                <span className="font-mono-label text-[10px] text-ink/55">
                  Your coin
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(false);
                    setStep(2);
                  }}
                  className="font-mono-label text-[9px] text-ink/45 hover:text-ink"
                >
                  edit
                </button>
              </div>
              <dl className="divide-y divide-ink/10">
                <SummaryRow
                  label="Symbol"
                  value={draft.coin.coinSymbol || "—"}
                  mono
                />
                <SummaryRow label="Name" value={draft.coin.coinName || "—"} />
                <SummaryRow
                  label="Decimals"
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
                  Sale terms
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorOpen(false);
                    setStep(3);
                  }}
                  className="font-mono-label text-[9px] text-ink/45 hover:text-ink"
                >
                  edit
                </button>
              </div>
              <dl className="divide-y divide-ink/10">
                <SummaryRow
                  label="Rate"
                  value={`1 SUI → ${formatAmount(draft.sale.tokensPerSui ?? "0")} ${draft.coin.coinSymbol || "tokens"}`}
                />
                <SummaryRow
                  label="Total for sale"
                  value={`${formatAmount(draft.sale.allocationTokens ?? "0")} ${draft.coin.coinSymbol || "tokens"}`}
                />
                <SummaryRow
                  label="Max supply"
                  value={`${formatAmount(draft.sale.allocationTokens ?? "0")} ${draft.coin.coinSymbol || "tokens"}`}
                />
                <SummaryRow
                  label="Minted at launch"
                  value="0 — lazily minted on claim"
                />
                <SummaryRow
                  label="Max raise"
                  value={`${formatAmount(maxRaiseSui(draft.sale.tokensPerSui, draft.sale.allocationTokens), { maxFractionDigits: 4 })} SUI`}
                />
                <SummaryRow
                  label="Sale ends"
                  value={
                    draft.sale.endTimeMs == null
                      ? "Open-ended"
                      : formatEndsAt(draft.sale.endTimeMs)
                  }
                />
                <SummaryRow
                  label="Unsold tokens"
                  value={
                    draft.sale.unsoldAction === "transfer_to_creator"
                      ? "Returned to your wallet"
                      : "Burned (reduces final supply)"
                  }
                />
              </dl>
            </section>

            <Frame className="border-poppy bg-poppy/8 [&::after]:bg-poppy/15 [&::before]:bg-poppy/15">
              <div className="space-y-2 text-xs text-ink/80">
                <p>
                  <span className="font-mono-label text-poppy">
                    You'll keep ·
                  </span>{" "}
                  a <strong>ProjectAdminCap</strong> in your wallet — your admin
                  rights for this project. You can transfer it to a multisig
                  later.
                </p>
                <p>
                  <span className="font-mono-label text-poppy">
                    You'll give up ·
                  </span>{" "}
                  your <strong>TreasuryCap</strong> and{" "}
                  <strong>CoinMetadata</strong>. The project takes ownership and
                  they can't be recovered.
                </p>
                <p>
                  <span className="font-mono-label text-poppy">
                    Locked on deploy ·
                  </span>{" "}
                  name, coin, rate, allocation, end time, unsold-action.
                  Description, icon and links stay editable.
                </p>
              </div>
            </Frame>
            </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer font-mono-label text-[10px] text-ink/45 hover:text-ink">
                advanced · raw move call
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
                    ? "pinning…"
                    : "set at submit"}
                </Row>
                <Row k="arg.project_details_blob_id">
                  {state.kind === "pinning" && state.step === "details"
                    ? "pinning…"
                    : "set at submit"}
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
                <span>Cancel</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className={cn(CTA_BASE, "bg-saffron text-ink h-10 px-4")}
              >
                <span>
                  {state.kind === "pinning" && state.step === "description"
                    ? "Pinning description…"
                    : state.kind === "pinning" && state.step === "details"
                      ? "Pinning details…"
                      : state.kind === "signing"
                        ? "Signing…"
                        : "Pin & deploy"}
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
): SuccessSnapshot {
  return {
    projectName: draft.identity.name || "Untitled project",
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

function validate(draft: ReturnType<typeof useWizard.getState>["draft"]): Check[] {
  const out: Check[] = [];

  const identity = StepIdentity.safeParse(draft.identity);
  out.push({
    label: identity.success
      ? "Identity complete"
      : `Identity: ${identity.error.issues[0]?.message ?? "incomplete"}`,
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
        ? `Coin verified · ${draft.coin.coinSymbol ?? "?"} · ${draft.coin.coinDecimals ?? 9} decimals`
        : `Coin uses ${draft.coin.coinDecimals} decimals — protocol requires ${PROJECT_COIN_DECIMALS}`
      : `Coin: ${coin.error.issues[0]?.message ?? "incomplete"}`,
    ok: coin.success && decimalsOk,
    step: 2,
  });

  const sale = StepSale.safeParse(draft.sale);
  out.push({
    label: sale.success
      ? "Sale terms valid"
      : `Sale: ${sale.error.issues[0]?.message ?? "incomplete"}`,
    ok: sale.success,
    step: 3,
  });

  return out;
}
