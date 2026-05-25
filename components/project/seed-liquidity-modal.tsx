"use client";

import { useEffect, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useTranslations } from "next-intl";
import { Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { buildUpdateMetadataTx, IS_DEPLOYED } from "@/lib/contracts/pandabox";
import { uploadJson } from "@/lib/ipfs";
import type { AdminCapHolding } from "@/lib/holdings";
import type { HydratedProject, ProjectDetails } from "@/lib/projects";

/**
 * Seed-liquidity admin flow (off-chain flag — see `ProjectDetails.liquidity`).
 *
 * Two stages:
 *   1. Creator enters the Cetus pool object ID. We hit
 *      `/api/cetus/verify-pool` which fetches the object via Sui RPC and
 *      confirms it's a Cetus `pool::Pool<A, B>` with one side `0x2::sui::SUI`
 *      and the other matching the project's coin type. The creator can't
 *      proceed without a pass.
 *   2. On pass, we pin an updated `project_details.json` that carries the
 *      verified `liquidity` sub-object, then call the existing
 *      `project::update_metadata` Move entry to point the project at the
 *      new IPFS CID. One signature, on-chain trail via MetadataUpdated.
 *
 * When the Move struct gains a real `liquidity_seeded` field, this whole
 * flow becomes obsolete — the contract should expose a
 * `seed_liquidity_cetus(cap, project, pool_id)` entry and this modal
 * collapses into a single Move call with no IPFS round-trip.
 */
export function SeedLiquidityModal({
  project,
  cap,
  onClose,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
  onClose: () => void;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const t = useTranslations("project.detail.seedLiquidity");

  const [poolId, setPoolId] = useState(project.poolId ?? "");
  const [verify, setVerify] = useState<VerifyState>({ kind: "idle" });
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  // Any time the pool input changes after a successful verify, reset to idle
  // so the user has to re-verify the new value before signing. Prevents the
  // "I clicked Verify, then edited the field, then signed the old result"
  // footgun.
  useEffect(() => {
    if (verify.kind === "ok" && verify.poolId !== poolId.trim()) {
      setVerify({ kind: "idle" });
    }
  }, [poolId, verify]);

  const poolValid = /^0x[0-9a-fA-F]{1,64}$/.test(poolId.trim());
  const verified = verify.kind === "ok" && verify.poolId === poolId.trim();
  const busy = verify.kind === "verifying" || tx.kind !== "idle" && tx.kind !== "error";

  const onVerify = async () => {
    if (!poolValid || !project.tokenType) return;
    setVerify({ kind: "verifying" });
    try {
      const url = `/api/cetus/verify-pool?poolId=${encodeURIComponent(poolId.trim())}&coinType=${encodeURIComponent(project.tokenType)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as VerifyApiResponse;
      if (json.ok) {
        setVerify({
          kind: "ok",
          poolId: poolId.trim(),
          poolType: json.poolType,
          coinA: json.coinA,
          coinB: json.coinB,
        });
      } else {
        setVerify({ kind: "fail", reason: json.reason });
      }
    } catch (err) {
      setVerify({
        kind: "fail",
        reason: err instanceof Error ? err.message : t("verificationFailed"),
      });
    }
  };

  const onSign = async () => {
    if (!account || !verified) return;
    setTx({ kind: "pinning" });

    // 1. Build the new project_details payload — preserve every existing
    //    field on the IPFS blob and only mutate the `liquidity` sub-object.
    const existing: ProjectDetails = project.details ?? {};
    const next: ProjectDetails = {
      ...existing,
      liquidity: {
        seeded: true,
        poolId: poolId.trim(),
        dex: "cetus",
        seededAtMs: Date.now(),
      },
    };

    let cid: string;
    try {
      const upload = await uploadJson(next, { filename: "project_details.json" });
      cid = upload.blobId;
    } catch (err) {
      setTx({
        kind: "error",
        message: t("pinningFailed", {
          reason: err instanceof Error ? err.message : t("unknownError"),
        }),
      });
      return;
    }

    // 2. Submit update_metadata with the new project_details CID. Other
    //    fields stay untouched (passed as Option::None inside the builder).
    setTx({ kind: "signing" });
    try {
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 500));
        setTx({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
          cid,
        });
        return;
      }
      const transaction = buildUpdateMetadataTx({
        coinType: cap.coinType,
        adminCapId: cap.capId,
        projectId: project.id,
        projectDetailsBlobId: cid,
      });
      const result = await signAndExecute({ transaction });
      setTx({ kind: "success", digest: result.digest, cid });
      void client.waitForTransaction({ digest: result.digest });
    } catch (err) {
      setTx({
        kind: "error",
        message: err instanceof Error ? err.message : t("txFailed"),
      });
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={t("title")}
    >
      {tx.kind === "success" ? (
        <SuccessView digest={tx.digest} cid={tx.cid} />
      ) : (
        <div className="space-y-5 text-xs">
          <p className="text-[13px] leading-relaxed text-ink/65">
            {t.rich("intro", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>

          <p className="font-mono text-[11px] leading-relaxed text-ink/55">
            {t.rich("verifyExplainer", {
              code: (chunks) => (
                <code className="text-ink/75">{chunks}</code>
              ),
              coin: shortCoin(project.tokenType),
            })}
          </p>

          {/* Pool input + Verify */}
          <label className="block">
            <MonoLabel className="text-[10px]">{t("poolAddressLabel")}</MonoLabel>
            <div className="mt-2 flex items-stretch gap-2">
              <input
                type="text"
                value={poolId}
                onChange={(e) => setPoolId(e.target.value.trim())}
                placeholder={t("poolPlaceholder")}
                disabled={busy}
                className={cn(
                  "h-11 flex-1 border border-ink/25 bg-bone px-3 font-mono text-[12px]",
                  "focus:border-ink focus:outline-none focus:shadow-offset-sm",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
              <button
                type="button"
                onClick={onVerify}
                disabled={!poolValid || busy || verified}
                className={cn(
                  "h-11 inline-flex items-center justify-center px-4 border border-ink shadow-offset-sm",
                  "font-medium uppercase tracking-[0.12em] text-[0.72rem] text-ink",
                  "transition-all duration-300 ease-atelier",
                  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0",
                  verified ? "bg-jade/30" : "bg-bone",
                )}
              >
                {verify.kind === "verifying"
                  ? t("verifying")
                  : verified
                    ? t("verifiedOk")
                    : t("verify")}
              </button>
            </div>
            {poolId && !poolValid && (
              <span className="mt-1 block font-mono text-[10px] text-poppy">
                {t("invalidObjectId")}
              </span>
            )}
          </label>

          {/* Verification readout */}
          {verify.kind === "fail" && (
            <div className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2.5 text-poppy">
              <MonoLabel className="text-[10px]" accent="poppy">
                {t("verificationFailedTitle")}
              </MonoLabel>
              <p className="mt-1 text-[12px] leading-snug">{verify.reason}</p>
            </div>
          )}
          {verify.kind === "ok" && (
            <div className="border border-jade/40 bg-jade/[0.06]">
              <div className="flex items-baseline justify-between border-b border-jade/20 px-3 py-2">
                <MonoLabel className="text-[10px]" accent="jade">
                  {t("poolVerified")}
                </MonoLabel>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-jade">
                  {t("cetus")}
                </span>
              </div>
              <dl className="divide-y divide-jade/15 text-[12px]">
                <Row k={t("rowPool")} v={shortMid(verify.poolId)} />
                <Row k={t("rowSideA")} v={shortCoin(verify.coinA)} />
                <Row k={t("rowSideB")} v={shortCoin(verify.coinB)} />
              </dl>
            </div>
          )}

          {tx.kind === "error" && (
            <div
              role="alert"
              className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
            >
              {tx.message}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={cn(
                "h-10 px-4 border border-ink shadow-offset-sm bg-bone text-ink",
                "font-medium uppercase tracking-[0.12em] text-[0.72rem]",
                "transition-all duration-300 ease-atelier",
                "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={onSign}
              disabled={!verified || busy}
              className={cn(
                "h-10 px-4 border border-ink shadow-offset-sm bg-saffron text-ink",
                "font-medium uppercase tracking-[0.12em] text-[0.72rem]",
                "transition-all duration-300 ease-atelier",
                "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0",
              )}
            >
              {tx.kind === "pinning"
                ? t("pinning")
                : tx.kind === "signing"
                  ? t("signing")
                  : t("signAndSave")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────── types ─────────────────────────── */

type VerifyApiResponse =
  | { ok: true; poolType: string; coinA: string; coinB: string }
  | { ok: false; reason: string };

type VerifyState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | {
      kind: "ok";
      poolId: string;
      poolType: string;
      coinA: string;
      coinB: string;
    }
  | { kind: "fail"; reason: string };

type TxState =
  | { kind: "idle" }
  | { kind: "pinning" }
  | { kind: "signing" }
  | { kind: "success"; digest: string; cid: string }
  | { kind: "error"; message: string };

/* ─────────────────────────── views ─────────────────────────── */

function SuccessView({ digest, cid }: { digest: string; cid: string }) {
  const t = useTranslations("project.detail.seedLiquidity");
  return (
    <div className="space-y-3 text-xs">
      <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
        <MonoLabel className="text-[11px]" accent="jade">
          {t("seededTitle")}
        </MonoLabel>
        <p className="mt-1 text-ink/75">
          {t("seededBody")}
        </p>
      </div>
      <p className="break-all font-mono text-[11px] text-ink/55">
        {t("detailsCid", { cid })}
      </p>
      <p className="break-all font-mono text-[11px] text-ink/55">
        {t("digest", { digest })}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <MonoLabel className="text-[10px]">{k}</MonoLabel>
      <span className="font-mono tabular-nums text-ink/85">{v}</span>
    </div>
  );
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function shortCoin(typeStr: string): string {
  if (!typeStr) return "TOK";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "TOK";
}
