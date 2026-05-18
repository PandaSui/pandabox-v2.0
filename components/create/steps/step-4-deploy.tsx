"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { useWizard } from "@/lib/store/wizard";
import {
  StepCoin,
  StepIdentity,
  StepSale,
} from "@/lib/store/wizard-schema";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Frame } from "@/components/primitives/frame";
import { TransactionSuccess } from "@/components/pay";
import {
  buildCreateProjectTx,
  IS_DEPLOYED,
  PACKAGE_ID,
  PROJECT_COIN_DECIMALS,
  UnsoldAction,
} from "@/lib/contracts/pandabox";
import { uploadBlob, uploadJson } from "@/lib/ipfs";
import { StepCard, StepHeader } from "../step-header";

const CTA_BASE =
  "group relative inline-flex items-center justify-center gap-2 h-12 px-6 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

type SubmitState =
  | { kind: "idle" }
  | { kind: "pinning"; step: "description" | "details" }
  | { kind: "signing" }
  | { kind: "success"; digest: string }
  | { kind: "error"; message: string };

export function StepDeployForm() {
  const draft = useWizard((s) => s.draft);
  const reset = useWizard((s) => s.reset);
  const setStep = useWizard((s) => s.setStep);
  const patchDeploy = useWizard((s) => s.patchDeploy);
  const account = useCurrentAccount();
  const router = useRouter();
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

      // 3. Convert UI values → on-chain u64s scaled to 9 decimals.
      const tokensPerSui = new BigNumber(draft.sale.tokensPerSui ?? "0");
      const allocation = new BigNumber(draft.sale.allocationTokens ?? "0");
      const scale = new BigNumber(10).pow(PROJECT_COIN_DECIMALS);
      const baseRate = BigInt(
        tokensPerSui.multipliedBy(scale).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
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
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
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
      setState({ kind: "success", digest: result.digest });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Deploy failed.",
      });
    }
  };

  const onFinishSuccess = () => {
    reset();
    setInspectorOpen(false);
    setState({ kind: "idle" });
    router.push("/explore");
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
          Draft auto-saves to your browser as <code>pandabox:draft:v2</code>.
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
      >
        {state.kind === "success" ? (
          <TransactionSuccess
            title="Project deployed"
            projectName={draft.identity.name || "Untitled project"}
            txDigest={state.digest}
            primaryHref="/explore"
            primaryLabel="See it on Explore"
          />
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-ink/55">
              {IS_DEPLOYED
                ? "Pandabox will pin your description + project_details to IPFS, then your wallet signs the create_project Move call."
                : "Move package address not configured. Submission will be simulated locally."}
            </p>
            <div className="border border-ink/15 bg-bone/40 p-3 font-mono text-[11px]">
              <Row k="package">{PACKAGE_ID.slice(0, 18)}…</Row>
              <Row k="module">project</Row>
              <Row k="function">create_project&lt;T&gt;</Row>
              <Row k="type.T">
                {draft.coin.coinType
                  ? short(draft.coin.coinType)
                  : "—"}
              </Row>
              <Row k="arg.platform">::env::PLATFORM_OBJECT_ID</Row>
              <Row k="arg.treasury_cap">
                {short(draft.coin.treasuryCapId ?? "")}
              </Row>
              <Row k="arg.metadata">
                {short(draft.coin.coinMetadataId ?? "")}
              </Row>
              <Row k="arg.name">{JSON.stringify(draft.identity.name ?? "")}</Row>
              <Row k="arg.description_blob_id">
                {state.kind === "pinning" && state.step === "description"
                  ? "pinning…"
                  : "set at submit"}
              </Row>
              <Row k="arg.icon_url">
                {(draft.identity.coverImage ?? "").slice(0, 32) || "—"}…
              </Row>
              <Row k="arg.source_code_blob_id">
                {draft.deploy.sourceCodeBlobId
                  ? short(draft.deploy.sourceCodeBlobId)
                  : '""'}
              </Row>
              <Row k="arg.project_details_blob_id">
                {state.kind === "pinning" && state.step === "details"
                  ? "pinning…"
                  : "set at submit"}
              </Row>
              <Row k="arg.base_rate">
                {bnScaled(draft.sale.tokensPerSui).toFixed(0)}
              </Row>
              <Row k="arg.funding_allocation">
                {bnScaled(draft.sale.allocationTokens).toFixed(0)}
              </Row>
              <Row k="arg.end_time_ms">
                {draft.sale.endTimeMs == null
                  ? "none"
                  : new Date(draft.sale.endTimeMs).toISOString()}
              </Row>
              <Row k="arg.unsold_action">
                {draft.sale.unsoldAction ?? "burn"} ·{" "}
                {draft.sale.unsoldAction === "transfer_to_creator" ? "1" : "0"}
              </Row>
              <Row k="returns">ProjectAdminCap → sender</Row>
            </div>
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

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink/45">{k}</span>
      <span className="break-all text-ink">{children}</span>
    </div>
  );
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
