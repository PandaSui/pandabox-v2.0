"use client";

import { useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ArrowDiag, Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import {
  buildPermissionlessFinalizeTx,
  buildProcessUnsoldTx,
  buildRenounceProjectAdminTx,
  buildTransferProjectAdminTx,
  buildUpdateMetadataTx,
  buildWithdrawSuiTx,
  IS_DEPLOYED,
  PROJECT_COIN_DECIMALS,
} from "@/lib/contracts/pandabox";
import type { AdminCapHolding } from "@/lib/holdings";
import type { HydratedProject } from "@/lib/projects";

const CTA_BASE =
  "group relative inline-flex w-full items-center justify-center gap-2 h-11 px-5 font-sans font-medium uppercase tracking-[0.12em] text-[0.75rem] " +
  "border border-ink shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "active:translate-x-0 active:translate-y-0 active:shadow-offset-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone focus-visible:ring-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-offset-sm";

type Action =
  | "withdraw"
  | "metadata"
  | "finalize"
  | "unsold"
  | "transfer"
  | "renounce";

type TxState =
  | { kind: "idle" }
  | { kind: "submitting"; action: Action }
  | { kind: "success"; action: Action; digest: string }
  | { kind: "error"; action: Action; message: string };

/**
 * Project-creator admin panel — surfaced on `/p/[id]` when the connected
 * wallet owns the `ProjectAdminCap<T>` for that project. Exposes every
 * creator-side mutation the on-chain `project` module supports:
 *
 *   - withdraw_sui<T>          → pull raised SUI (platform fee skimmed)
 *   - update_metadata<T>       → edit name + the four blob refs
 *   - process_unsold<T>        → burn / return unsold supply post-finalize
 *   - transfer_project_admin<T> → hand the cap to another address (multisig, DAO)
 *   - renounce_project_admin<T> → permanently destroy the cap
 */
export function AdminPanel({
  project,
  cap,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [open, setOpen] = useState<Action | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  // `project.status` from the reader is a string label, not the u8 code.
  // Closed + compromised (rawStatus 1 or 2) both unlock `process_unsold`.
  const closedOrCompromised = project.status === "closed";

  // Finalize is permissionless on-chain, but it's useful to surface it inside
  // the AdminPanel too — covers the edge case where the creator is the only
  // wallet watching the sale (no supporters around to trigger close). We
  // gate the UI on "status is still live AND the end-time has elapsed" so
  // the button doesn't appear when the sale is still legitimately running.
  const endElapsed =
    project.endTimeMs > 0 && Date.now() > project.endTimeMs;
  const showFinalize = project.status === "live" && endElapsed;

  // Available SUI to withdraw equals project.sui_balance (the platform fee is
  // taken from the gross amount when the call executes).
  const availableSui = project.suiBalance;

  const execute = async (action: Action, build: () => ReturnType<typeof buildWithdrawSuiTx>) => {
    if (!account) return;
    setTx({ kind: "submitting", action });
    try {
      if (!IS_DEPLOYED) {
        await new Promise((r) => setTimeout(r, 500));
        setTx({
          kind: "success",
          action,
          digest: "SIMULATED" + Date.now().toString(36).toUpperCase(),
        });
        return;
      }
      const transaction = build();
      const result = await signAndExecute({ transaction });
      setTx({ kind: "success", action, digest: result.digest });
      // Nudge the page cache so figures refresh on next render.
      void client.waitForTransaction({ digest: result.digest });
    } catch (err) {
      setTx({
        kind: "error",
        action,
        message: err instanceof Error ? err.message : "Transaction failed.",
      });
    }
  };

  const busy = tx.kind === "submitting";

  return (
    <aside id="pay" className="lg:sticky lg:top-24">
      <div className="border border-ink bg-bone shadow-offset-sm">
        <header className="flex items-baseline justify-between border-b border-ink/15 px-5 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-sky"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            <MonoLabel className="text-[10px]">Admin</MonoLabel>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            you hold the cap
          </span>
        </header>

        <div className="space-y-3 px-5 pt-5 pb-3">
          <SummaryRow
            k="treasury"
            v={`${formatSui(availableSui)} SUI`}
            hint="withdrawable"
          />
          <SummaryRow
            k="sold"
            v={`${formatToken(project.sold, PROJECT_COIN_DECIMALS)} ${shortCoin(project.tokenType)}`}
          />
          <SummaryRow
            k="cap"
            v={shortMid(cap.capId)}
            mono
          />
        </div>

        <div className="grid grid-cols-1 gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("withdraw");
            }}
            disabled={busy || availableSui === 0n}
            className={cn(CTA_BASE, "bg-saffron text-ink")}
          >
            <span>Withdraw SUI</span>
            <ArrowDiag size={12} />
          </button>
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("metadata");
            }}
            disabled={busy}
            className={cn(CTA_BASE, "bg-bone text-ink")}
          >
            <span>Update metadata</span>
          </button>
          {showFinalize && (
            <button
              type="button"
              onClick={() => {
                setTx({ kind: "idle" });
                setOpen("finalize");
              }}
              disabled={busy}
              className={cn(CTA_BASE, "bg-bone border-poppy text-poppy")}
              title="Sale end-time has elapsed — close the sale on-chain to unlock claims + withdrawals"
            >
              <span>Finalize sale</span>
              <ArrowDiag size={12} />
            </button>
          )}
          {closedOrCompromised && (
            <button
              type="button"
              onClick={() => {
                setTx({ kind: "idle" });
                setOpen("unsold");
              }}
              disabled={busy || project.unsoldProcessed}
              className={cn(CTA_BASE, "bg-bone text-ink")}
              title={
                project.unsoldProcessed
                  ? "Unsold supply already processed"
                  : undefined
              }
            >
              <span>
                {project.unsoldProcessed
                  ? "Unsold processed ✓"
                  : "Process unsold"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("transfer");
            }}
            disabled={busy}
            className={cn(CTA_BASE, "bg-bone text-ink")}
          >
            <span>Transfer admin</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTx({ kind: "idle" });
              setOpen("renounce");
            }}
            disabled={busy}
            className={cn(CTA_BASE, "bg-bone text-poppy border-poppy")}
          >
            <span>Renounce</span>
          </button>
        </div>
      </div>

      {open === "withdraw" && (
        <WithdrawModal
          project={project}
          cap={cap}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(amountMist) =>
            execute("withdraw", () =>
              buildWithdrawSuiTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
                amountMist,
                recipient: account!.address,
              }),
            )
          }
        />
      )}
      {open === "metadata" && (
        <MetadataModal
          project={project}
          cap={cap}
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(patch) =>
            execute("metadata", () =>
              buildUpdateMetadataTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
                ...patch,
              }),
            )
          }
        />
      )}
      {open === "finalize" && (
        <ConfirmModal
          title="Finalize sale"
          body={
            <p>
              Closes the sale on-chain. Anyone can call this once the end-time
              elapses — calling from your admin wallet just means you're the
              one paying the gas. After finalize, supporters can{" "}
              <code>claim</code> their tokens and you can{" "}
              <code>withdraw_sui</code> the raised funds.
            </p>
          }
          confirm="Finalize sale"
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("finalize", () =>
              buildPermissionlessFinalizeTx({
                coinType: cap.coinType,
                projectId: project.id,
              }),
            )
          }
        />
      )}
      {open === "unsold" && (
        <ConfirmModal
          title="Process unsold supply"
          body={
            <p>
              Burns or returns unsold <code>{shortCoin(project.tokenType)}</code>{" "}
              to {project.unsoldAction === 1 ? "you" : "the void"} based on
              this project's <code>unsold_action</code> setting. Callable once.
            </p>
          }
          confirm="Process unsold"
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("unsold", () =>
              buildProcessUnsoldTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
              }),
            )
          }
        />
      )}
      {open === "transfer" && (
        <TransferModal
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={(recipient) =>
            execute("transfer", () =>
              buildTransferProjectAdminTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                recipient,
              }),
            )
          }
        />
      )}
      {open === "renounce" && (
        <ConfirmModal
          title="Renounce admin"
          body={
            <p className="text-poppy">
              Permanently destroys this AdminCap. You will lose the ability to
              update metadata, withdraw SUI, or process unsold supply on this
              project. This action cannot be undone.
            </p>
          }
          confirm="Renounce"
          danger
          state={tx}
          busy={busy}
          onClose={() => setOpen(null)}
          onSubmit={() =>
            execute("renounce", () =>
              buildRenounceProjectAdminTx({
                coinType: cap.coinType,
                adminCapId: cap.capId,
                projectId: project.id,
              }),
            )
          }
        />
      )}
    </aside>
  );
}

/* ─────────────────────── Sub-modals ─────────────────────── */

function WithdrawModal({
  project,
  cap,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (amountMist: bigint) => void;
}) {
  const max = project.suiBalance;
  const maxSui = Number(max) / 1e9;
  const [input, setInput] = useState<string>(maxSui.toFixed(4));

  const amount = useMemo(() => {
    const bn = new BigNumber(input || "0");
    if (!bn.isFinite() || bn.lte(0)) return 0n;
    const m = BigInt(bn.multipliedBy(1e9).integerValue(BigNumber.ROUND_DOWN).toFixed(0));
    return m > max ? max : m;
  }, [input, max]);

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Withdraw SUI">
      {state.kind === "success" && state.action === "withdraw" ? (
        <Success
          digest={state.digest}
          label="SUI withdrawn"
          body="The SUI coin has been transferred to your address (less platform fee)."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Withdraws SUI from the project treasury. A platform fee is skimmed
            at execution time, the rest is transferred as a `Coin&lt;SUI&gt;` to
            your address.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              Amount (SUI)
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) =>
                  setInput(e.target.value.replace(/[^0-9.]/g, ""))
                }
                className="h-11 flex-1 border border-ink/25 bg-bone px-3 font-mono tabular-nums text-base focus:border-ink focus:outline-none focus:shadow-offset-sm"
              />
              <button
                type="button"
                onClick={() => setInput(maxSui.toFixed(4))}
                className="h-11 border border-ink/25 px-3 font-mono-label text-[10px] hover:border-ink"
              >
                max
              </button>
            </div>
            <span className="mt-1 block font-mono text-[10px] text-ink/45">
              treasury · {formatSui(max)} SUI · cap {shortMid(cap.capId)}
            </span>
          </label>
          {state.kind === "error" && state.action === "withdraw" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : "Sign & withdraw"}
            onCancel={onClose}
            onConfirm={() => onSubmit(amount)}
            disabled={amount === 0n}
          />
        </div>
      )}
    </Modal>
  );
}

function MetadataModal({
  project,
  cap,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  project: HydratedProject;
  cap: AdminCapHolding;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (patch: {
    name?: string;
    descriptionBlobId?: string;
    iconUrl?: string;
    sourceCodeBlobId?: string;
    projectDetailsBlobId?: string;
  }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [descCid, setDescCid] = useState(project.descriptionBlobId);
  const [iconUrl, setIconUrl] = useState(project.iconUrl);
  const [sourceCid, setSourceCid] = useState(project.sourceCodeBlobId);
  const [detailsCid, setDetailsCid] = useState(project.projectDetailsBlobId);

  const dirty = {
    name: name !== project.name ? name : undefined,
    descriptionBlobId:
      descCid !== project.descriptionBlobId ? descCid : undefined,
    iconUrl: iconUrl !== project.iconUrl ? iconUrl : undefined,
    sourceCodeBlobId:
      sourceCid !== project.sourceCodeBlobId ? sourceCid : undefined,
    projectDetailsBlobId:
      detailsCid !== project.projectDetailsBlobId ? detailsCid : undefined,
  };
  const anyDirty = Object.values(dirty).some((v) => v !== undefined);

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Update metadata">
      {state.kind === "success" && state.action === "metadata" ? (
        <Success
          digest={state.digest}
          label="Metadata updated"
          body="MetadataUpdated event emitted. The project page will reflect the new fields within ~30s of cache revalidation."
        />
      ) : (
        <div className="space-y-3 text-xs">
          <p className="text-ink/55">
            Only edited fields are sent on-chain — unchanged inputs are passed
            as <code>Option::None</code> and won't trigger a write.
          </p>
          <MetaField label="Name" value={name} onChange={setName} />
          <MetaField
            label="Icon URL"
            value={iconUrl}
            onChange={setIconUrl}
            mono
          />
          <MetaField
            label="Description blob (IPFS CID)"
            value={descCid}
            onChange={setDescCid}
            mono
          />
          <MetaField
            label="Project details blob (IPFS CID)"
            value={detailsCid}
            onChange={setDetailsCid}
            mono
          />
          <MetaField
            label="Source code blob (IPFS CID)"
            value={sourceCid}
            onChange={setSourceCid}
            mono
          />
          <p className="font-mono text-[10px] text-ink/45">
            cap {shortMid(cap.capId)}
          </p>
          {state.kind === "error" && state.action === "metadata" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : "Sign & update"}
            onCancel={onClose}
            onConfirm={() => onSubmit(dirty)}
            disabled={!anyDirty}
          />
        </div>
      )}
    </Modal>
  );
}

function MetaField({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono-label text-[10px] text-ink/55">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 h-10 w-full border border-ink/25 bg-bone px-3 text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm",
          mono && "font-mono tabular-nums",
        )}
      />
    </label>
  );
}

function TransferModal({
  state,
  busy,
  onClose,
  onSubmit,
}: {
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (recipient: string) => void;
}) {
  const [addr, setAddr] = useState("");
  const valid = /^0x[0-9a-fA-F]{1,64}$/.test(addr.trim());

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Transfer project admin"
    >
      {state.kind === "success" && state.action === "transfer" ? (
        <Success
          digest={state.digest}
          label="Admin transferred"
          body="The recipient now holds the ProjectAdminCap. You can no longer perform admin actions on this project from this wallet."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Hands the AdminCap to another address. Common targets: a multisig,
            a DAO contract, a co-founder, or a backup wallet.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              Recipient address
            </span>
            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value.trim())}
              placeholder="0x…"
              className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
            />
            {addr && !valid && (
              <span className="mt-1 block font-mono text-[10px] text-poppy">
                Not a valid Sui address
              </span>
            )}
          </label>
          {state.kind === "error" && state.action === "transfer" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : "Sign & transfer"}
            onCancel={onClose}
            onConfirm={() => onSubmit(addr.trim())}
            disabled={!valid}
          />
        </div>
      )}
    </Modal>
  );
}

function ConfirmModal({
  title,
  body,
  confirm,
  danger = false,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  body: React.ReactNode;
  confirm: string;
  danger?: boolean;
  state: TxState;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={title}>
      {state.kind === "success" ? (
        <Success
          digest={state.digest}
          label={title}
          body="Transaction confirmed."
        />
      ) : (
        <div className="space-y-4 text-xs text-ink/65">
          {body}
          {state.kind === "error" && (
            <ErrorBanner message={state.message} />
          )}
          <ModalFooter
            busy={busy}
            primaryLabel={busy ? "Signing…" : confirm}
            danger={danger}
            onCancel={onClose}
            onConfirm={onSubmit}
          />
        </div>
      )}
    </Modal>
  );
}

function Success({
  digest,
  label,
  body,
}: {
  digest: string;
  label: string;
  body: string;
}) {
  return (
    <div className="space-y-3 text-xs">
      <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
        <span className="font-mono-label text-[11px]">{label}</span>
        <p className="mt-1 text-ink/75">{body}</p>
      </div>
      <p className="break-all font-mono text-[11px] text-ink/55">
        digest · {digest}
      </p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border border-poppy/40 bg-poppy/[0.06] px-3 py-2 font-mono text-[11px] text-poppy"
    >
      {message}
    </p>
  );
}

function ModalFooter({
  busy,
  primaryLabel,
  onCancel,
  onConfirm,
  disabled = false,
  danger = false,
}: {
  busy: boolean;
  primaryLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const FOOTER_CTA =
    "h-10 px-4 inline-flex items-center justify-center gap-2 border border-ink shadow-offset-sm font-medium uppercase tracking-[0.12em] text-[0.72rem] transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0";
  return (
    <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className={cn(FOOTER_CTA, "bg-bone text-ink")}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={cn(
          FOOTER_CTA,
          danger ? "bg-poppy text-bone border-poppy" : "bg-saffron text-ink",
        )}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

function SummaryRow({
  k,
  v,
  hint,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink/10 pb-2 last:border-b-0">
      <span className="font-mono-label text-[10px] text-ink/55">
        {k}
        {hint && <span className="ml-1 text-ink/35">· {hint}</span>}
      </span>
      <span
        className={cn(
          "text-sm",
          mono ? "font-mono tabular-nums text-ink/80" : "text-ink",
        )}
      >
        {v}
      </span>
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

