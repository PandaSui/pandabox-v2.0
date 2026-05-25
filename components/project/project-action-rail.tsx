"use client";

import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useTranslations } from "next-intl";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { MonoLabel } from "@/components/primitives/mono-label";
import { ContributePanel } from "@/components/pay/contribute-panel";
import { AdminPanel } from "./admin-panel";
import { ClaimPanel } from "./claim-panel";
import { PACKAGE_ID } from "@/lib/contracts/pandabox";
import type { AdminCapHolding, ReceiptHolding } from "@/lib/holdings";
import type { HydratedProject } from "@/lib/projects";

/**
 * Right-rail dispatcher for the project page. Reads the connected wallet's
 * relationship to this project and renders one of:
 *
 *   - <ConnectPlaceholder>  · wallet not connected
 *   - <AdminPanel>          · user holds the ProjectAdminCap for this project
 *   - <ClaimPanel mode="claim">     · sale closed + user holds receipts
 *   - <ClaimPanel mode="finalize">  · sale ended (by time) but still "live"
 *   - <ContributePanel>     · sale is live
 *   - <PostSaleNote>        · sale ended, user has no role to play
 *
 * Holdings are queried from the user's owned objects (not the global indexer)
 * because the wallet-aware UI needs sub-second responsiveness — the global
 * indexer caches are 20-60s and don't react to the wallet's own tx submission.
 */
export function ProjectActionRail({
  project,
}: {
  project: HydratedProject;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [adminCap, setAdminCap] = useState<AdminCapHolding | null>(null);
  const [receipts, setReceipts] = useState<ReceiptHolding[]>([]);
  const [loading, setLoading] = useState(false);

  // Re-query whenever the wallet changes. Lightweight — only fetches objects
  // owned by the current address that originate from the pandabox package.
  useEffect(() => {
    if (!account) {
      setAdminCap(null);
      setReceipts([]);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const [adminPage, receiptPage] = await Promise.all([
          client.getOwnedObjects({
            owner: account.address,
            filter: { MoveModule: { package: PACKAGE_ID, module: "project" } },
            options: { showType: true, showContent: true },
            limit: 50,
          }),
          client.getOwnedObjects({
            owner: account.address,
            filter: { MoveModule: { package: PACKAGE_ID, module: "receipt" } },
            options: { showType: true, showContent: true },
            limit: 50,
          }),
        ]);
        if (ac.signal.aborted) return;

        // Find the admin cap (if any) whose `project_id` field matches.
        let cap: AdminCapHolding | null = null;
        for (const o of adminPage.data) {
          const t = o.data?.type ?? "";
          if (!t.startsWith(`${PACKAGE_ID}::project::ProjectAdminCap<`)) continue;
          const content = o.data?.content;
          if (!content || content.dataType !== "moveObject") continue;
          const fields = content.fields as Record<string, unknown>;
          if (String(fields.project_id ?? "") !== project.id) continue;
          cap = {
            capId: o.data!.objectId,
            projectId: project.id,
            coinType: extractTypeArg(t),
          };
          break;
        }

        // Collect all receipts the user holds for THIS project.
        const userReceipts: ReceiptHolding[] = [];
        for (const o of receiptPage.data) {
          const t = o.data?.type ?? "";
          if (!t.startsWith(`${PACKAGE_ID}::receipt::ContributionReceipt<`))
            continue;
          const content = o.data?.content;
          if (!content || content.dataType !== "moveObject") continue;
          const fields = content.fields as Record<string, unknown>;
          if (String(fields.project_id ?? "") !== project.id) continue;
          userReceipts.push({
            receiptId: o.data!.objectId,
            projectId: project.id,
            coinType: extractTypeArg(t),
            suiAmount: BigInt(String(fields.sui_amount ?? "0")),
            tokenShare: BigInt(String(fields.token_share ?? "0")),
            createdAtMs: Number(fields.created_at_ms ?? 0),
          });
        }

        setAdminCap(cap);
        setReceipts(userReceipts);
      } catch (err) {
        if (!ac.signal.aborted) {
          console.warn("[ProjectActionRail] holdings lookup failed:", err);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [account, client, project.id]);

  // Decide which panel to render.
  if (!account) return <ConnectPlaceholder />;
  if (loading && !adminCap && receipts.length === 0) {
    return <LoadingPlaceholder />;
  }

  // 1. Creator path — has admin cap → AdminPanel.
  if (adminCap) {
    return <AdminPanel project={project} cap={adminCap} />;
  }

  const now = Date.now();
  const endElapsed = project.endTimeMs > 0 && now > project.endTimeMs;
  const isLive = project.status === "live" && !endElapsed;
  const isClosed = project.status === "closed";

  // 2. Claim — sale closed and user has receipts.
  if (isClosed && receipts.length > 0) {
    return <ClaimPanel project={project} receipts={receipts} mode="claim" />;
  }

  // 3. Finalize — sale end-time has passed but on-chain status is still "live".
  //    Anyone can call. Surface as the primary action so the page is useful
  //    even before someone finalizes.
  if (project.status === "live" && endElapsed) {
    return <ClaimPanel project={project} receipts={[]} mode="finalize" />;
  }

  // 4. Live sale — show contribute.
  if (isLive) {
    return <ContributePanel project={project} />;
  }

  // 5. Sale closed, user has no receipts → informational footer.
  return <PostSaleNote tokenSymbol={lastSegment(project.tokenType)} />;
}

function ConnectPlaceholder() {
  const t = useTranslations("project.detail.rail");
  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink/15 bg-bone p-6 shadow-offset-sm">
        <MonoLabel>{t("connectTitle")}</MonoLabel>
        <p className="mt-2 text-sm text-ink/65">
          {t("connectBody")}
        </p>
        <div className="mt-4">
          <ConnectWallet />
        </div>
      </div>
    </aside>
  );
}

function LoadingPlaceholder() {
  const t = useTranslations("project.detail.rail");
  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink/15 bg-bone p-6 shadow-offset-sm">
        <MonoLabel>{t("loadingTitle")}</MonoLabel>
        <p className="mt-2 font-mono text-[11px] text-ink/55">
          {t("loadingBody")}
        </p>
      </div>
    </aside>
  );
}

function PostSaleNote({ tokenSymbol }: { tokenSymbol: string }) {
  const t = useTranslations("project.detail.rail");
  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink/15 bg-bone p-6 shadow-offset-sm">
        <MonoLabel>{t("saleClosedTitle")}</MonoLabel>
        <p className="mt-2 text-sm text-ink/65">
          {t("saleClosedBody", {
            token: tokenSymbol || t("thisProjectFallback"),
          })}
        </p>
      </div>
    </aside>
  );
}

function extractTypeArg(typeStr: string): string {
  const lt = typeStr.indexOf("<");
  const gt = typeStr.lastIndexOf(">");
  if (lt === -1 || gt === -1 || gt < lt) return "";
  return typeStr.slice(lt + 1, gt);
}

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}
