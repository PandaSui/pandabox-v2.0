"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import {
  buildAdminCloseProjectTx,
  buildAdminCompromiseProjectTx,
  buildAdminUnverifyProjectTx,
  buildAdminVerifyProjectTx,
  IS_DEPLOYED,
  PROJECT_COIN_DECIMALS,
} from "@/lib/contracts/pandabox";
import type { OnChainProject } from "@/lib/projects";
import { useAdmin } from "./admin-gate";

const ACTION_CTA =
  "inline-flex h-7 items-center justify-center gap-1 border px-2 font-mono-label text-[10px] " +
  "transition-all duration-200 ease-atelier " +
  "hover:-translate-y-[1px] hover:shadow-offset-sm " +
  "active:translate-y-0 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40";

type Filter = "all" | "live" | "closed" | "verified" | "unverified";

type ModAction = "verify" | "unverify" | "close" | "compromise";

type Pending = {
  projectId: string;
  action: ModAction;
};

type TxState =
  | { kind: "idle" }
  | { kind: "submitting"; pending: Pending }
  | { kind: "success"; pending: Pending; digest: string }
  | { kind: "error"; pending: Pending; message: string };

/**
 * Per-project moderation table — verify badge toggle, admin_close (force a
 * sale to close mid-run), admin_compromise (treat a malicious project as
 * compromised + drain).
 *
 * Compromise is the most destructive lever the operator has — it emits a
 * `Compromised` event with the drained amounts so downstream tooling
 * (refunds, accounting) has an audit trail. Hidden behind a strict
 * "type the project name to confirm" gate to prevent muscle-memory clicks.
 */
export function ProjectModerationTable({
  projects,
}: {
  projects: OnChainProject[];
}) {
  const router = useRouter();
  const client = useSuiClient();
  const { capId } = useAdmin();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Pending | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === "live" && p.status !== "live") return false;
      if (filter === "closed" && p.status === "live") return false;
      if (filter === "verified" && !p.verified) return false;
      if (filter === "unverified" && p.verified) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [projects, filter, query]);

  const execute = async (pending: Pending) => {
    const p = projects.find((x) => x.id === pending.projectId);
    if (!p) return;
    setTx({ kind: "submitting", pending });
    try {
      const build = () => {
        const common = {
          platformAdminCapId: capId,
          coinType: p.tokenType,
          projectId: p.id,
        };
        switch (pending.action) {
          case "verify":
            return buildAdminVerifyProjectTx(common);
          case "unverify":
            return buildAdminUnverifyProjectTx(common);
          case "close":
            return buildAdminCloseProjectTx(common);
          case "compromise":
            return buildAdminCompromiseProjectTx(common);
        }
      };
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 500));
        setTx({
          kind: "success",
          pending,
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
      } else {
        const result = await signAndExecute({ transaction: build() });
        setTx({ kind: "success", pending, digest: result.digest });
        await client.waitForTransaction({ digest: result.digest });
        router.refresh();
      }
    } catch (err) {
      setTx({
        kind: "error",
        pending,
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
    }
  };

  const closeModal = () => {
    if (tx.kind === "submitting") return;
    setOpen(null);
    if (tx.kind === "success" || tx.kind === "error") {
      setTx({ kind: "idle" });
    }
  };

  return (
    <section className="border border-ink bg-bone shadow-offset-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 px-5 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-sky" />
          <MonoLabel className="text-[10px]">Project moderation</MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            · {projects.length} on chain
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "live", label: "Live" },
              { key: "closed", label: "Closed" },
              { key: "verified", label: "Verified" },
              { key: "unverified", label: "Unverified" },
            ] as const
          ).map((f) => {
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={cn(
                  "h-7 border px-2 font-mono-label text-[10px] transition-all duration-200 ease-atelier",
                  active
                    ? "border-ink bg-ink text-bone shadow-offset-sm"
                    : "border-ink/25 hover:border-ink",
                )}
              >
                {f.label}
              </button>
            );
          })}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name or id"
            className="h-7 w-48 border border-ink/25 bg-bone px-2 font-mono text-[11px] placeholder:text-ink/30 focus:border-ink focus:outline-none focus:shadow-offset-sm"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink/55">
          No projects match.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="border-b border-ink/10 text-left font-mono-label text-[10px] text-ink/55">
                <th className="px-5 py-2 font-normal">Project</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 text-right font-normal">Sold</th>
                <th className="px-3 py-2 text-right font-normal">Treasury</th>
                <th className="px-3 py-2 font-normal">Creator</th>
                <th className="px-5 py-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  pendingAction={
                    tx.kind === "submitting" && tx.pending.projectId === p.id
                      ? tx.pending.action
                      : null
                  }
                  onAction={(action) => {
                    setTx({ kind: "idle" });
                    if (action === "verify" || action === "unverify") {
                      // Toggle without a modal — small action, instant feedback.
                      void execute({ projectId: p.id, action });
                    } else {
                      setOpen({ projectId: p.id, action });
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <ConfirmModal
          project={projects.find((x) => x.id === open.projectId)!}
          action={open.action}
          state={tx}
          onClose={closeModal}
          onConfirm={() => execute(open)}
        />
      )}
    </section>
  );
}

function ProjectRow({
  project,
  pendingAction,
  onAction,
}: {
  project: OnChainProject;
  pendingAction: ModAction | null;
  onAction: (action: ModAction) => void;
}) {
  const ticker = lastSegment(project.tokenType).toUpperCase() || "TOK";
  const now = Date.now();
  const ended = project.endTimeMs > 0 && now > project.endTimeMs;
  const live = project.status === "live";

  return (
    <tr className="border-b border-ink/[0.07] last:border-b-0 hover:bg-ink/[0.02]">
      <td className="px-5 py-2">
        <div className="flex items-center gap-2">
          {project.verified && (
            <span
              title="Verified"
              className="inline-flex h-4 w-4 items-center justify-center border border-jade/40 bg-jade/10 text-jade"
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2 6.5l3 3 5-6" />
              </svg>
            </span>
          )}
          <Link
            href={`/projects/${project.id}`}
            className="font-display text-[13px] text-ink hover:underline"
          >
            {project.name || "Unnamed"}
          </Link>
          <span className="text-ink/30">·</span>
          <span className="text-ink/55">{ticker}</span>
        </div>
        <span className="mt-0.5 block text-[10px] text-ink/45">
          Nº {String(project.number).padStart(2, "0")} · {shortMid(project.id)}
        </span>
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            live && !ended
              ? "text-jade"
              : ended && live
                ? "text-poppy"
                : "text-ink/55",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              live && !ended
                ? "bg-jade"
                : ended && live
                  ? "bg-poppy"
                  : "bg-ink/35",
            )}
          />
          <span className="font-mono-label text-[10px] uppercase tracking-[0.14em]">
            {live && !ended ? "live" : ended && live ? "ended" : "closed"}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink/80">
        {formatToken(project.sold, PROJECT_COIN_DECIMALS)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink/80">
        {formatSui(project.suiBalance)}
      </td>
      <td className="px-3 py-2">
        <Address value={project.creator} link className="text-[11px]" />
      </td>
      <td className="px-5 py-2">
        <div className="flex flex-wrap justify-end gap-1">
          {project.verified ? (
            <button
              type="button"
              onClick={() => onAction("unverify")}
              disabled={pendingAction !== null}
              className={cn(ACTION_CTA, "border-ink/25 hover:border-ink")}
            >
              {pendingAction === "unverify" ? "…" : "Unverify"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAction("verify")}
              disabled={pendingAction !== null}
              className={cn(ACTION_CTA, "border-jade text-jade hover:bg-jade hover:text-bone")}
            >
              {pendingAction === "verify" ? "…" : "Verify"}
            </button>
          )}
          {live && (
            <button
              type="button"
              onClick={() => onAction("close")}
              disabled={pendingAction !== null}
              className={cn(
                ACTION_CTA,
                "border-poppy text-poppy hover:bg-poppy hover:text-bone",
              )}
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction("compromise")}
            disabled={pendingAction !== null}
            className={cn(
              ACTION_CTA,
              "border-poppy bg-poppy/[0.05] text-poppy hover:bg-poppy hover:text-bone",
            )}
            title="Mark as malicious / compromised — drains the project"
          >
            Compromise
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────────────── Confirm modal ─────────────────────── */

function ConfirmModal({
  project,
  action,
  state,
  onClose,
  onConfirm,
}: {
  project: OnChainProject;
  action: ModAction;
  state: TxState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const requireName = action === "compromise";
  const [confirmInput, setConfirmInput] = useState("");
  const nameOk = !requireName || confirmInput.trim() === project.name;
  const busy = state.kind === "submitting";

  const meta = META[action];
  const isOurSuccess =
    state.kind === "success" && state.pending.projectId === project.id &&
    state.pending.action === action;
  const isOurError =
    state.kind === "error" && state.pending.projectId === project.id &&
    state.pending.action === action;

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={meta.title}>
      {isOurSuccess ? (
        <div className="space-y-3 text-xs">
          <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
            <span className="font-mono-label text-[11px]">
              {meta.successLabel}
            </span>
            <p className="mt-1 text-ink/75">{meta.successBody}</p>
          </div>
          <p className="break-all font-mono text-[11px] text-ink/55">
            digest · {(state as { digest: string }).digest}
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-xs text-ink/70">
          <p>
            Project <strong>{project.name || "Unnamed"}</strong>{" "}
            <code className="font-mono text-[11px] text-ink/55">
              ({shortMid(project.id)})
            </code>
          </p>
          <p>{meta.body}</p>
          {requireName && (
            <label className="block border border-poppy/30 bg-poppy/[0.04] p-3">
              <span className="font-mono-label text-[10px] text-poppy">
                Type the project name to confirm
              </span>
              <input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={project.name}
                className="mt-2 h-9 w-full border border-poppy/40 bg-bone px-2 font-mono text-[12px] focus:border-poppy focus:outline-none"
              />
            </label>
          )}
          {isOurError && (
            <p
              role="alert"
              className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
            >
              {(state as { message: string }).message}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={cn(
                "h-10 inline-flex items-center justify-center gap-1 border border-ink bg-bone px-4 font-mono-label text-[10px] shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                busy && "opacity-40",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || !nameOk}
              className={cn(
                "h-10 inline-flex items-center justify-center gap-1 border px-4 font-mono-label text-[10px] shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset",
                meta.danger
                  ? "border-poppy bg-poppy text-bone"
                  : "border-ink bg-saffron text-ink",
                (busy || !nameOk) && "opacity-40 cursor-not-allowed",
              )}
            >
              {busy ? "Signing…" : meta.confirm}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const META: Record<ModAction, {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  successLabel: string;
  successBody: string;
}> = {
  verify: {
    title: "Verify project",
    body:
      "Adds the platform-verified badge to this project page and explore card.",
    confirm: "Verify",
    successLabel: "Verified",
    successBody: "Badge will surface within the next 60s revalidation window.",
  },
  unverify: {
    title: "Unverify project",
    body: "Removes the platform-verified badge.",
    confirm: "Unverify",
    successLabel: "Unverified",
    successBody: "Badge removed.",
  },
  close: {
    title: "Admin close",
    body:
      "Force-closes the sale on-chain even if its end-time hasn't elapsed and it hasn't sold out. Use when the project must stop accepting contributions immediately. The creator can still claim_reserved / process_unsold / withdraw_sui afterwards.",
    confirm: "Admin close",
    danger: true,
    successLabel: "Sale closed",
    successBody:
      "Status set to closed (trigger=admin). Claim + withdraw are now unlocked.",
  },
  compromise: {
    title: "Mark project as compromised",
    body:
      "DRAINS the project. Marks status as compromised, transfers the SUI principal + the project's mintable tokens to the platform treasury for refund handling. Use only when the project itself is malicious — supporters' contributions are still on chain in receipts and can be reimbursed off-chain from the platform treasury.",
    confirm: "Compromise & drain",
    danger: true,
    successLabel: "Project compromised",
    successBody:
      "Compromised event emitted with the drained amounts. Reconcile refunds off-chain.",
  },
};

function lastSegment(typeStr: string): string {
  if (!typeStr) return "";
  const parts = typeStr.split("::");
  return parts[parts.length - 1] ?? "";
}

function shortMid(s: string): string {
  if (!s) return "—";
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
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
