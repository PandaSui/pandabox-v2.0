"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDiag, Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Marker } from "@/components/primitives/marker";
import { TxHash } from "@/components/identity/tx-hash";
import {
  buildClaimMultipleTx,
  buildClaimTx,
  buildPermissionlessFinalizeTx,
  IS_DEPLOYED,
  PROJECT_COIN_DECIMALS,
} from "@/lib/contracts/pandabox";
import { bustHoldingsCache } from "@/lib/server-actions/projects-cache";
import { resolveBlobRef } from "@/lib/ipfs";
import type { ReceiptHolding } from "@/lib/holdings";
import type { HydratedProject } from "@/lib/projects";
import { ClaimSuccess } from "./claim-success";

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-12 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.78rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

type Mode = "claim" | "finalize";

type TxState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; digest: string }
  | { kind: "error"; message: string };

/**
 * Post-sale panel.
 *
 *   - If the sale is closed AND the user holds one or more
 *     `ContributionReceipt<T>` for this project → claim flow. Burns the
 *     receipts and returns a `Coin<T>` to the sender.
 *
 *   - If the sale is over (end time elapsed) but still in `live` status →
 *     finalize flow. `project::permissionless_finalize<T>` can be called by
 *     anyone once the close condition is met.
 *
 * The parent (`ProjectActionRail`) decides which mode to render — this
 * component just executes whichever is asked.
 */
export function ClaimPanel({
  project,
  receipts,
  mode,
}: {
  project: HydratedProject;
  /** Receipts the user holds for THIS project. Empty in finalize mode. */
  receipts: ReceiptHolding[];
  mode: Mode;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const router = useRouter();
  const t = useTranslations("project.detail.claim");

  const [state, setState] = useState<TxState>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  const ticker = lastSegment(project.tokenType).toUpperCase() || "TOK";

  // Aggregate totals across all of the user's receipts for this project.
  const totalSui = receipts.reduce((acc, r) => acc + r.suiAmount, 0n);
  const totalTokens = receipts.reduce((acc, r) => acc + r.tokenShare, 0n);

  const onSubmit = async () => {
    if (!account) return;
    setState({ kind: "submitting" });
    try {
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 500));
        setState({
          kind: "success",
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
        return;
      }
      let tx;
      if (mode === "claim") {
        if (receipts.length === 1) {
          tx = buildClaimTx({
            coinType: project.tokenType,
            projectId: project.id,
            receiptId: receipts[0].receiptId,
            sender: account.address,
          });
        } else {
          tx = buildClaimMultipleTx({
            coinType: project.tokenType,
            projectId: project.id,
            receiptIds: receipts.map((r) => r.receiptId),
            sender: account.address,
          });
        }
      } else {
        tx = buildPermissionlessFinalizeTx({
          coinType: project.tokenType,
          projectId: project.id,
        });
      }
      const result = await signAndExecute({ transaction: tx });
      setState({ kind: "success", digest: result.digest });
      // Claim burns the ContributionReceipt, finalize touches the project
      // status — either way the dashboard's holdings cache is now stale.
      // Bust it so /dashboard reflects the change on next visit instead of
      // waiting out the 20s `holdings` revalidate window.
      void bustHoldingsCache().catch(() => {});
      // Wait for RPC to see the tx, then re-fetch the RSC tree so the
      // receipt list + sale-status hero hydrate to the post-claim state.
      void client
        .waitForTransaction({ digest: result.digest })
        .then(() => router.refresh())
        .catch(() => {
          /* swallow — success modal still renders */
        });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : t("txFailed"),
      });
    }
  };

  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
          <MonoLabel className="text-[10px]">
            {mode === "claim" ? t("claimYourTokens") : t("finalizeSale")}
          </MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            {mode === "claim"
              ? t("receiptCount", { count: receipts.length })
              : t("anyone")}
          </span>
        </header>

        <div className="space-y-4 px-5 pt-5 pb-4">
          {mode === "claim" ? (
            <>
              <p className="text-sm text-ink/70">
                {receipts.length > 1
                  ? t.rich("claimIntroMany", {
                      code: (chunks) => (
                        <code className="font-mono text-[12px]">{chunks}</code>
                      ),
                      ticker,
                    })
                  : t.rich("claimIntroOne", {
                      code: (chunks) => (
                        <code className="font-mono text-[12px]">{chunks}</code>
                      ),
                      ticker,
                    })}
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-ink/15 pt-4">
                <Stat label={t("youllReceive")}>
                  <Marker color="saffron">
                    <span className="font-mono tabular-nums text-base">
                      {formatToken(totalTokens, PROJECT_COIN_DECIMALS)} {ticker}
                    </span>
                  </Marker>
                </Stat>
                <Stat label={t("from")}>
                  <span className="font-mono tabular-nums text-base">
                    {formatSui(totalSui)} SUI
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-ink/55">
                    {t("contributed")}
                  </span>
                </Stat>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink/70">
                {t("finalizeIntro")}
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-ink/15 pt-4">
                <Stat label={t("sold")}>
                  <span className="font-mono tabular-nums text-base">
                    {formatToken(project.sold, PROJECT_COIN_DECIMALS)} {ticker}
                  </span>
                </Stat>
                <Stat label={t("treasury")}>
                  <span className="font-mono tabular-nums text-base">
                    {formatSui(project.suiBalance)} SUI
                  </span>
                </Stat>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setState({ kind: "idle" });
              setOpen(true);
            }}
            disabled={mode === "claim" && receipts.length === 0}
            className={cn(CTA_BASE, "bg-saffron text-ink")}
          >
            <span>
              {mode === "claim"
                ? receipts.length > 1
                  ? t("claimAllCta", {
                      amount: `${formatToken(totalTokens, PROJECT_COIN_DECIMALS)} ${ticker}`,
                    })
                  : t("claimCta", {
                      amount: `${formatToken(totalTokens, PROJECT_COIN_DECIMALS)} ${ticker}`,
                    })
                : t("finalizeSale")}
            </span>
            <ArrowDiag size={14} />
          </button>
        </div>

        {mode === "claim" && receipts.length > 0 && (
          <details className="border-t border-ink/15 px-5 py-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45 hover:text-ink">
              {t("receiptsSummary", { count: receipts.length })}
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink/65">
              {receipts.map((r) => (
                <li
                  key={r.receiptId}
                  className="flex items-baseline justify-between"
                >
                  <span>{shortMid(r.receiptId)}</span>
                  <span className="tabular-nums">
                    {formatToken(r.tokenShare, PROJECT_COIN_DECIMALS)} {ticker}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => {
          if (state.kind === "submitting") return;
          setOpen(false);
          if (state.kind === "success") setState({ kind: "idle" });
        }}
        title={mode === "claim" ? t("modalClaimTitle") : t("modalFinalizeTitle")}
      >
        {state.kind === "success" ? (
          mode === "claim" ? (
            <ClaimSuccess
              projectName={project.name}
              ticker={ticker}
              iconUrl={project.iconUrl}
              tokensFormatted={`${formatToken(totalTokens, PROJECT_COIN_DECIMALS)} ${ticker}`}
              receiptCount={receipts.length}
              txDigest={state.digest}
              onContinue={() => {
                setOpen(false);
                setState({ kind: "idle" });
              }}
              continueLabel={t("backToProject")}
            />
          ) : (
            <FinalizeSuccess
              digest={state.digest}
              onContinue={() => {
                setOpen(false);
                setState({ kind: "idle" });
              }}
            />
          )
        ) : mode === "claim" ? (
          <ClaimPreview
            ticker={ticker}
            iconUrl={project.iconUrl}
            receiptCount={receipts.length}
            totalTokensFormatted={`${formatToken(totalTokens, PROJECT_COIN_DECIMALS)} ${ticker}`}
            totalSuiFormatted={`${formatSui(totalSui)} SUI`}
            state={state}
            onCancel={() => setOpen(false)}
            onSubmit={onSubmit}
          />
        ) : (
          <FinalizePreview
            ticker={ticker}
            soldFormatted={`${formatToken(project.sold, PROJECT_COIN_DECIMALS)} ${ticker}`}
            treasuryFormatted={`${formatSui(project.suiBalance)} SUI`}
            state={state}
            onCancel={() => setOpen(false)}
            onSubmit={onSubmit}
          />
        )}
      </Modal>
    </aside>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <MonoLabel className="block text-[10px]">{label}</MonoLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Two-tile flow: N receipts being burned → tokens delivered. Matches the
 * ContributePreview design language so the user reads claim as the inverse
 * of contribute.
 */
function ClaimPreview({
  ticker,
  iconUrl,
  receiptCount,
  totalTokensFormatted,
  totalSuiFormatted,
  state,
  onCancel,
  onSubmit,
}: {
  ticker: string;
  iconUrl?: string;
  receiptCount: number;
  totalTokensFormatted: string;
  totalSuiFormatted: string;
  state: TxState;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("project.detail.claim");
  const resolved = resolveBlobRef(iconUrl)?.url ?? iconUrl ?? "";
  const submitting = state.kind === "submitting";

  return (
    <div className="space-y-4">
      {/* You burn */}
      <div className="border border-ink/15 bg-bone p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-mono-label text-[10px] text-ink/55">
              {t("youBurn")}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl tabular-nums text-ink">
                {receiptCount}
              </span>
              <span className="font-mono-label text-[11px] text-ink/70">
                {receiptCount === 1 ? t("receiptOne") : t("receiptOther")}
              </span>
            </div>
            <p className="font-mono text-[11px] tabular-nums text-ink/45">
              {t("originallyContributed", { amount: totalSuiFormatted })}
            </p>
          </div>
          <ReceiptStack count={receiptCount} />
        </div>
      </div>

      <div className="flex items-center justify-center" aria-hidden>
        <FlowConnector />
      </div>

      {/* You receive */}
      <div className="border border-ink bg-bone p-4 shadow-offset-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-mono-label text-[10px] text-jade">
              {t("youReceive")}
            </span>
            <div className="flex items-baseline gap-2">
              <Marker color="saffron">
                <span className="font-mono text-3xl tabular-nums text-ink">
                  {totalTokensFormatted.split(" ")[0]}
                </span>
              </Marker>
              <span className="font-mono-label text-[11px] text-ink/70">
                {ticker}
              </span>
            </div>
            <p className="font-mono text-[11px] tabular-nums text-ink/45">
              {t("coinSentToWallet", { ticker })}
            </p>
          </div>
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-ink/20 bg-ink/[0.04]">
            {resolved ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolved}
                alt={ticker}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-mono-label text-[9px] text-ink/40">
                  {ticker}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={onCancel}
          className={cn(CTA_BASE, "h-10 w-auto bg-bone px-4 text-ink")}
        >
          <span>{t("cancel")}</span>
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className={cn(CTA_BASE, "h-10 w-auto bg-saffron px-4 text-ink")}
        >
          <span>{submitting ? t("signing") : t("confirmClaim")}</span>
          <ArrowDiag size={12} />
        </button>
      </div>
    </div>
  );
}

function FinalizePreview({
  ticker,
  soldFormatted,
  treasuryFormatted,
  state,
  onCancel,
  onSubmit,
}: {
  ticker: string;
  soldFormatted: string;
  treasuryFormatted: string;
  state: TxState;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("project.detail.claim");
  const submitting = state.kind === "submitting";

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">
        {t("finalizePreviewIntro")}
      </p>

      <div className="grid grid-cols-2 border border-ink/15">
        <div className="border-r border-ink/15 px-4 py-3">
          <span className="font-mono-label text-[10px] text-ink/55">{t("sold")}</span>
          <div className="mt-1 font-mono text-base tabular-nums text-ink">
            {soldFormatted}
          </div>
        </div>
        <div className="px-4 py-3">
          <span className="font-mono-label text-[10px] text-ink/55">
            {t("treasury")}
          </span>
          <div className="mt-1 font-mono text-base tabular-nums text-ink">
            {treasuryFormatted}
          </div>
        </div>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
        {t("finalizeFootnote", { ticker })}
      </p>

      {state.kind === "error" && (
        <p
          role="alert"
          className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={onCancel}
          className={cn(CTA_BASE, "h-10 w-auto bg-bone px-4 text-ink")}
        >
          <span>{t("cancel")}</span>
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className={cn(CTA_BASE, "h-10 w-auto bg-saffron px-4 text-ink")}
        >
          <span>{submitting ? t("signing") : t("confirmFinalize")}</span>
          <ArrowDiag size={12} />
        </button>
      </div>
    </div>
  );
}

function FinalizeSuccess({
  digest,
  onContinue,
}: {
  digest: string;
  onContinue: () => void;
}) {
  const t = useTranslations("project.detail.claim");
  return (
    <div className="space-y-4">
      <div className="border border-jade/40 bg-jade/[0.06] p-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 rounded-full bg-jade"
            style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
          />
          <span className="font-mono-label text-[10px] text-jade">
            {t("saleFinalized")}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink/75">
          {t("finalizeSuccessBody")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono-label text-[10px] text-ink/55">{t("txLabel")}</span>
        <TxHash value={digest} head={6} tail={4} />
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onContinue}
          className={cn(CTA_BASE, "h-10 w-auto bg-ink px-5 text-bone")}
        >
          <span>{t("backToProject")}</span>
          <ArrowDiag size={12} />
        </button>
      </div>
    </div>
  );
}

function ReceiptStack({ count }: { count: number }) {
  // One to three stacked paper-receipt SVGs with slight rotation — gives
  // a visible cue that ContributionReceipts are being burned in batch.
  // Each "card" is a SlipSVG: tiny receipt with header bar, line items,
  // total row, and a perforated zigzag tear-edge at the bottom. Reads
  // as a receipt at a glance instead of an empty bordered box.
  const cards = [0, 1, 2].slice(0, Math.min(3, count));
  return (
    <div className="relative h-14 w-14 shrink-0" aria-hidden>
      {cards.map((i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            transform: `rotate(${(i - 1) * 6}deg) translate(${i * 2}px, ${i * -2}px)`,
            zIndex: cards.length - i,
          }}
        >
          <ReceiptSlipSVG />
        </div>
      ))}
      {count > 3 && (
        <div className="absolute -bottom-1 -right-1 z-10 border border-ink bg-bone px-1 font-mono text-[9px] tabular-nums text-ink">
          ×{count}
        </div>
      )}
    </div>
  );
}

/**
 * Compact paper-receipt glyph — 56×56 SVG sized to match the round token
 * icon in the "YOU RECEIVE" tile. Hand-tuned coords; tweaking the
 * viewBox will throw off the perforation rhythm at the bottom edge.
 */
function ReceiptSlipSVG() {
  return (
    <svg
      viewBox="0 0 56 56"
      width="56"
      height="56"
      role="presentation"
      className="text-ink"
    >
      {/* Paper body — flat top, perforated bottom via the zigzag path. */}
      <path
        d="M4 4 H52 V46 L49.5 49 L47 46 L44.5 49 L42 46 L39.5 49 L37 46 L34.5 49 L32 46 L29.5 49 L27 46 L24.5 49 L22 46 L19.5 49 L17 46 L14.5 49 L12 46 L9.5 49 L7 46 L4 49 Z"
        fill="currentColor"
        fillOpacity="0.03"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Header bar — filled to read as the receipt's title strip. */}
      <rect
        x="7"
        y="8"
        width="42"
        height="4"
        fill="currentColor"
        fillOpacity="0.65"
      />
      {/* Line items — three short hairlines, varied widths so they read
          as wrapped lines of text rather than a barcode. */}
      <line
        x1="7"
        y1="18"
        x2="38"
        y2="18"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <line
        x1="7"
        y1="22"
        x2="44"
        y2="22"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <line
        x1="7"
        y1="26"
        x2="32"
        y2="26"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      {/* Total row — divider above, a wider value bar below to evoke
          "TOTAL  $X.XX". */}
      <line
        x1="7"
        y1="32"
        x2="49"
        y2="32"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.75"
      />
      <rect
        x="7"
        y="36"
        width="14"
        height="3"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <rect
        x="32"
        y="36"
        width="17"
        height="3"
        fill="currentColor"
        fillOpacity="0.7"
      />
    </svg>
  );
}

function FlowConnector() {
  return (
    <svg
      width="4"
      height="44"
      viewBox="0 0 4 44"
      className="text-ink/25"
      role="presentation"
    >
      <line
        x1="2"
        y1="0"
        x2="2"
        y2="44"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <circle r="2.5" cx="2" cy="0" fill="#B8C45E">
        <animate
          attributeName="cy"
          values="0;44"
          dur="1.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.15;0.85;1"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function formatSui(mist: bigint): string {
  return formatToken(mist, 9);
}

function formatToken(raw: bigint, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return n.toFixed(2);
  if (n === 0) return "0";
  return n.toFixed(4);
}
