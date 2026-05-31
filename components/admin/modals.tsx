"use client";

import { useState } from "react";
import { Modal } from "@pandasui/ui";
import BigNumber from "bignumber.js";
import {
  formatBps,
  formatSui,
  shortMid,
  clampBig,
  MAX_FEE_BPS,
} from "@/lib/admin/format";
import type { ProtocolAccent } from "@/lib/admin/protocols";
import { Success, ErrorBanner, ModalFooter } from "./shared";

/**
 * Protocol-agnostic action modals shared by every operator panel. Each takes
 * the panel's `accent` (so the confirm button matches), a loose `state` (the
 * `useAdminTx` machine), and an `onSubmit`. Rendering is gated by the parent's
 * `open` flag, so each modal only needs to branch success / form on `kind`.
 */

type TxLike = { kind: string; digest?: string; message?: string };

const ADDR_RE = /^0x[0-9a-fA-F]{1,64}$/;

/* ─────────────────────── Fee (basis points) ─────────────────────── */

export function FeeModal({
  accent,
  currentBps,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  accent: ProtocolAccent;
  currentBps: number;
  state: TxLike;
  busy: boolean;
  onClose: () => void;
  onSubmit: (bps: number) => void;
}) {
  const [input, setInput] = useState(String(currentBps));
  const parsed = Number(input);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_FEE_BPS;
  const pct = valid ? formatBps(parsed) : "—";

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Update fee">
      {state.kind === "success" ? (
        <Success
          digest={state.digest ?? ""}
          label="Fee updated"
          body="The new fee_bps applies to subsequent operations immediately."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Fee is expressed in basis points (1/100 of a percent). 100 bps = 1%.
            Max enforceable by the contract is{" "}
            <code className="font-mono">{MAX_FEE_BPS}</code> (= 100%).
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              New fee_bps
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="h-11 flex-1 border border-ink/25 bg-bone px-3 font-mono tabular-nums text-base focus:border-ink focus:outline-none focus:shadow-offset-sm"
                placeholder="e.g. 250 = 2.5%"
              />
              <span className="font-mono-label text-[10px] text-ink/55">
                = {pct}%
              </span>
            </div>
            <span className="mt-1 block font-mono text-[10px] text-ink/45">
              current · {currentBps} bps ({formatBps(currentBps)}%)
            </span>
          </label>
          {state.kind === "error" && <ErrorBanner message={state.message ?? ""} />}
          <ModalFooter
            busy={busy}
            accent={accent}
            primary={busy ? "Signing…" : "Sign & update"}
            disabled={!valid || parsed === currentBps}
            onCancel={onClose}
            onConfirm={() => onSubmit(parsed)}
          />
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────── Fee (flat SUI per unit) ─────────────────────── */

export function FlatFeeModal({
  accent,
  currentMist,
  unitLabel,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  accent: ProtocolAccent;
  currentMist: bigint;
  /** e.g. "per recipient". */
  unitLabel: string;
  state: TxLike;
  busy: boolean;
  onClose: () => void;
  onSubmit: (mist: bigint) => void;
}) {
  const currentSui = Number(currentMist) / 1e9;
  const [input, setInput] = useState(currentSui.toString());
  const bn = new BigNumber(input || "0");
  const mist =
    bn.isFinite() && bn.gte(0)
      ? BigInt(bn.multipliedBy(1e9).integerValue(BigNumber.ROUND_DOWN).toFixed(0))
      : -1n;
  const valid = mist >= 0n && mist !== currentMist;

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Update fee">
      {state.kind === "success" ? (
        <Success
          digest={state.digest ?? ""}
          label="Fee updated"
          body={`The new ${unitLabel} fee applies to subsequent airdrops immediately.`}
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Flat fee charged <strong>{unitLabel}</strong>, in SUI. Set to 0 to
            make the protocol free to use.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              New fee {unitLabel} (SUI)
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono tabular-nums text-base focus:border-ink focus:outline-none focus:shadow-offset-sm"
              placeholder="e.g. 0.001"
            />
            <span className="mt-1 block font-mono text-[10px] text-ink/45">
              current · {formatSui(currentMist)} SUI {unitLabel}
            </span>
          </label>
          {state.kind === "error" && <ErrorBanner message={state.message ?? ""} />}
          <ModalFooter
            busy={busy}
            accent={accent}
            primary={busy ? "Signing…" : "Sign & update"}
            disabled={!valid}
            onCancel={onClose}
            onConfirm={() => onSubmit(mist)}
          />
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────── Max recipients (u64 count) ─────────────────────── */

export function MaxRecipientsModal({
  accent,
  currentMax,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  accent: ProtocolAccent;
  currentMax: number;
  state: TxLike;
  busy: boolean;
  onClose: () => void;
  onSubmit: (max: number) => void;
}) {
  const [input, setInput] = useState(String(currentMax));
  const parsed = Number(input);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed !== currentMax;

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Update max recipients">
      {state.kind === "success" ? (
        <Success
          digest={state.digest ?? ""}
          label="Max recipients updated"
          body="The new ceiling is enforced on the next airdrop call."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Hard ceiling on how many recipients a single airdrop PTB may target.
            Raising it increases the largest possible per-transaction gas cost.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              New max recipients
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono tabular-nums text-base focus:border-ink focus:outline-none focus:shadow-offset-sm"
              placeholder="e.g. 300"
            />
            <span className="mt-1 block font-mono text-[10px] text-ink/45">
              current · {currentMax.toLocaleString()}
            </span>
          </label>
          {state.kind === "error" && <ErrorBanner message={state.message ?? ""} />}
          <ModalFooter
            busy={busy}
            accent={accent}
            primary={busy ? "Signing…" : "Sign & update"}
            disabled={!valid}
            onCancel={onClose}
            onConfirm={() => onSubmit(parsed)}
          />
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────── Treasury address ─────────────────────── */

export function TreasuryModal({
  accent,
  currentAddress,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  accent: ProtocolAccent;
  currentAddress: string;
  state: TxLike;
  busy: boolean;
  onClose: () => void;
  onSubmit: (addr: string) => void;
}) {
  const [addr, setAddr] = useState("");
  const trimmed = addr.trim();
  const valid = ADDR_RE.test(trimmed) && trimmed !== currentAddress;

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Set treasury address">
      {state.kind === "success" ? (
        <Success
          digest={state.digest ?? ""}
          label="Treasury address updated"
          body="Future fee withdrawals route SUI to this address."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            All future fee withdrawals send SUI to this address. Fees already in
            the balance aren't redirected retroactively — they go wherever you
            withdraw them <em>to</em> next.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              New treasury address
            </span>
            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value.trim())}
              placeholder="0x…"
              className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
            />
            <span className="mt-1 block break-all font-mono text-[10px] text-ink/45">
              current · {currentAddress}
            </span>
          </label>
          {state.kind === "error" && <ErrorBanner message={state.message ?? ""} />}
          <ModalFooter
            busy={busy}
            accent={accent}
            primary={busy ? "Signing…" : "Sign & set"}
            disabled={!valid}
            onCancel={onClose}
            onConfirm={() => onSubmit(trimmed)}
          />
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────── Withdraw fees ─────────────────────── */

export function WithdrawModal({
  accent,
  treasuryAddress,
  maxMist,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  accent: ProtocolAccent;
  treasuryAddress: string;
  maxMist: bigint;
  state: TxLike;
  busy: boolean;
  onClose: () => void;
  onSubmit: (amountMist: bigint) => void;
}) {
  const maxSui = Number(maxMist) / 1e9;
  const [input, setInput] = useState(maxSui.toFixed(4));
  const bn = new BigNumber(input || "0");
  const amountMist =
    bn.isFinite() && bn.gt(0)
      ? clampBig(
          BigInt(
            bn.multipliedBy(1e9).integerValue(BigNumber.ROUND_DOWN).toFixed(0),
          ),
          maxMist,
        )
      : 0n;
  const valid = amountMist > 0n;

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Withdraw fees">
      {state.kind === "success" ? (
        <Success
          digest={state.digest ?? ""}
          label="Fees withdrawn"
          body="The amount has been transferred to the treasury address."
        />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-ink/55">
            Transfers SUI from the accrued fee balance to{" "}
            <strong>the treasury address</strong> (not an arbitrary recipient —
            to redirect, run "Set treasury address" first). Caller pays gas.
          </p>
          <label className="block">
            <span className="font-mono-label text-[10px] text-ink/55">
              Amount (SUI)
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
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
              available · {formatSui(maxMist)} SUI · recipient{" "}
              {shortMid(treasuryAddress)}
            </span>
          </label>
          {state.kind === "error" && <ErrorBanner message={state.message ?? ""} />}
          <ModalFooter
            busy={busy}
            accent={accent}
            primary={busy ? "Signing…" : "Sign & withdraw"}
            disabled={!valid}
            onCancel={onClose}
            onConfirm={() => onSubmit(amountMist)}
          />
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────── Generic confirm ─────────────────────── */

export function ConfirmModal({
  title,
  body,
  confirm,
  danger,
  accent,
  state,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  body: React.ReactNode;
  confirm: string;
  danger?: boolean;
  accent?: ProtocolAccent;
  state: TxLike;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={title}>
      {state.kind === "success" ? (
        <Success
          digest={state.digest ?? ""}
          label={title}
          body="Transaction confirmed."
        />
      ) : (
        <div className="space-y-4 text-xs text-ink/65">
          {body}
          {state.kind === "error" && <ErrorBanner message={state.message ?? ""} />}
          <ModalFooter
            busy={busy}
            accent={accent}
            primary={busy ? "Signing…" : confirm}
            danger={danger}
            onCancel={onClose}
            onConfirm={onSubmit}
          />
        </div>
      )}
    </Modal>
  );
}
