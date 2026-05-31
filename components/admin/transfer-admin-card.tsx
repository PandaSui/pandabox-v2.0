"use client";

import { useState } from "react";
import { Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import {
  buildTransferPlatformAdminTx,
  IS_DEPLOYED,
} from "@/lib/contracts/pandabox";
import { useProtocolAdmin } from "./admin-context";
import { useAdminTx } from "./use-admin-tx";

const ACTION_CTA =
  "inline-flex h-10 items-center justify-center gap-2 border px-4 font-mono-label text-[10px] " +
  "shadow-offset-sm transition-all duration-300 ease-atelier " +
  "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0";

/**
 * Hand the PlatformAdminCap to another address. Cap is consumed by-value on
 * chain — once this transaction confirms, the current wallet loses operator
 * access and the recipient becomes the new operator. Gated behind typed
 * confirmation and a recipient prefix-mismatch warning.
 */
export function TransferAdminCard() {
  const { capId, refresh } = useProtocolAdmin("pandabox");
  const { state, busy, run, reset } = useAdminTx<"transfer">({
    deployed: IS_DEPLOYED,
  });

  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [confirm, setConfirm] = useState("");

  const trimmed = recipient.trim();
  const validAddr = /^0x[0-9a-fA-F]{1,64}$/.test(trimmed);
  const phrase = "transfer admin";
  const phraseOk = confirm.trim().toLowerCase() === phrase;

  const onSubmit = () => {
    if (!validAddr || !phraseOk) return;
    // The current wallet loses the cap on success — re-run cap detection so
    // the gate flips to its post-transfer (not-authorized) state.
    void run(
      "transfer",
      () =>
        buildTransferPlatformAdminTx({
          platformAdminCapId: capId,
          recipient: trimmed,
        }),
      { afterSuccess: refresh },
    );
  };

  return (
    <section className="border border-poppy/40 bg-poppy/[0.04] shadow-offset-sm">
      <header className="flex items-baseline justify-between border-b border-poppy/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-poppy" />
          <MonoLabel accent="poppy" className="text-[10px]">
            Danger zone
          </MonoLabel>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-poppy/70">
          irreversible
        </span>
      </header>

      <div className="space-y-3 px-5 py-5 text-sm text-ink/75">
        <p>
          Hands the <code className="font-mono text-[12px]">PlatformAdminCap</code>{" "}
          to another address. The cap is consumed by-value on chain — after
          this transaction lands, you lose access to the operator console and
          the recipient gains full platform admin powers (pause, fee, withdraw,
          project moderation, transfer-onward).
        </p>
        <p className="font-mono text-[11px] text-poppy">
          Common targets: a Sui multisig the team controls, a DAO contract, or
          a backup wallet stored offline. Never transfer to an address you
          don't fully control.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setRecipient("");
              setConfirm("");
              setOpen(true);
            }}
            className={cn(ACTION_CTA, "border-poppy bg-poppy text-bone")}
          >
            Transfer admin cap
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={busy ? () => {} : () => setOpen(false)}
        title="Transfer PlatformAdminCap"
      >
        {state.kind === "success" ? (
          <div className="space-y-3 text-xs">
            <div className="border border-jade/40 bg-jade/[0.06] px-3 py-3 text-jade">
              <span className="font-mono-label text-[11px]">Admin transferred</span>
              <p className="mt-1 text-ink/75">
                The PlatformAdminCap is now owned by the recipient. You will
                lose access to this console as soon as Next refreshes.
              </p>
            </div>
            <p className="break-all font-mono text-[11px] text-ink/55">
              digest · {state.digest}
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-ink/55">
              Consumes the cap object{" "}
              <code className="font-mono text-[11px]">{capId.slice(0, 18)}…</code>{" "}
              and transfers it to the recipient. Anyone who later holds the
              recipient address can fully control Pandabox.
            </p>
            <label className="block">
              <span className="font-mono-label text-[10px] text-ink/55">
                Recipient address
              </span>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                placeholder="0x…"
                className="mt-2 h-11 w-full border border-ink/25 bg-bone px-3 font-mono text-[12px] focus:border-ink focus:outline-none focus:shadow-offset-sm"
              />
              {recipient && !validAddr && (
                <span className="mt-1 block font-mono text-[10px] text-poppy">
                  Not a valid Sui address
                </span>
              )}
            </label>
            <label className="block">
              <span className="font-mono-label text-[10px] text-poppy">
                Type "{phrase}" to confirm
              </span>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={phrase}
                className="mt-2 h-11 w-full border border-poppy/40 bg-bone px-3 font-mono text-[12px] focus:border-poppy focus:outline-none"
              />
            </label>
            {state.kind === "error" && (
              <p
                role="alert"
                className="border border-poppy/40 bg-poppy/[0.06] p-2 font-mono text-[11px] text-poppy"
              >
                {state.message}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className={cn(ACTION_CTA, "border-ink bg-bone text-ink")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy || !validAddr || !phraseOk}
                className={cn(ACTION_CTA, "border-poppy bg-poppy text-bone")}
              >
                {busy ? "Signing…" : "Sign & transfer"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
