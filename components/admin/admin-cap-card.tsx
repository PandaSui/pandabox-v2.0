"use client";

import { useState } from "react";
import { Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
import type { Transaction } from "@mysten/sui/transactions";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Frame } from "@/components/primitives/frame";
import { PROTOCOLS, type ProtocolId } from "@/lib/admin/protocols";
import {
  buildTransferPlatformAdminTx,
  IS_DEPLOYED as PANDABOX_DEPLOYED,
} from "@/lib/contracts/pandabox";
import {
  buildPlatformTransferAdminTx,
  buildPlatformRenounceAdminTx,
  REDEEM_IS_DEPLOYED,
} from "@/lib/contracts/redeem";
import {
  buildAirdropTransferAdminTx,
  buildAirdropRenounceAdminTx,
  AIRDROP_IS_DEPLOYED,
} from "@/lib/contracts/airdrop";
import { useProtocolAdmin } from "./admin-context";
import { useAdminTx } from "./use-admin-tx";
import { ADMIN_CTA, Success, ErrorBanner } from "./shared";

/**
 * The protocol's admin cap as a certificate-like object, with the two one-way
 * doors: transfer it to another address, or renounce it forever. Both consume
 * the cap by-value on chain, so the connected wallet loses access the moment
 * either lands. Gated behind typed confirmation. Pandabox has no on-chain
 * platform renounce, so only Redeem and Airdrop expose that action.
 */

type Action = "transfer" | "renounce";

const DEPLOYED: Record<ProtocolId, boolean> = {
  pandabox: PANDABOX_DEPLOYED,
  redeem: REDEEM_IS_DEPLOYED,
  airdrop: AIRDROP_IS_DEPLOYED,
};

function buildTransfer(
  protocol: ProtocolId,
  capId: string,
  recipient: string,
): Transaction {
  switch (protocol) {
    case "pandabox":
      return buildTransferPlatformAdminTx({ platformAdminCapId: capId, recipient });
    case "redeem":
      return buildPlatformTransferAdminTx({ platformAdminCapId: capId, recipient });
    case "airdrop":
      return buildAirdropTransferAdminTx({ airdropAdminCapId: capId, recipient });
  }
}

function buildRenounce(
  protocol: ProtocolId,
  capId: string,
  airdropInitialSharedVersion?: string,
): Transaction | null {
  switch (protocol) {
    case "redeem":
      return buildPlatformRenounceAdminTx({ platformAdminCapId: capId });
    case "airdrop":
      return airdropInitialSharedVersion
        ? buildAirdropRenounceAdminTx({
            airdropAdminCapId: capId,
            platformInitialSharedVersion: airdropInitialSharedVersion,
          })
        : null;
    default:
      return null;
  }
}

export function AdminCapCard({
  protocol,
  airdropInitialSharedVersion,
}: {
  protocol: ProtocolId;
  /** Required for Airdrop renounce (immutable shared ref). */
  airdropInitialSharedVersion?: string;
}) {
  const cfg = PROTOCOLS[protocol];
  const { capId, refresh } = useProtocolAdmin(protocol);
  const { state, busy, run, reset } = useAdminTx<Action>({
    deployed: DEPLOYED[protocol],
  });

  const [open, setOpen] = useState<Action | null>(null);
  const [recipient, setRecipient] = useState("");
  const [confirm, setConfirm] = useState("");

  const renounceable = buildRenounce(protocol, capId, airdropInitialSharedVersion) !== null;

  const trimmed = recipient.trim();
  const validAddr = /^0x[0-9a-fA-F]{1,64}$/.test(trimmed);
  const phrase = open === "renounce" ? "renounce admin" : "transfer admin";
  const phraseOk = confirm.trim().toLowerCase() === phrase;
  const canSubmit =
    open === "renounce" ? phraseOk : validAddr && phraseOk;

  const openModal = (action: Action) => {
    reset();
    setRecipient("");
    setConfirm("");
    setOpen(action);
  };

  const submit = () => {
    if (!canSubmit) return;
    // Cap leaves this wallet on success — re-run detection so the gate flips.
    run(
      open === "renounce" ? "renounce" : "transfer",
      () =>
        open === "renounce"
          ? buildRenounce(protocol, capId, airdropInitialSharedVersion)!
          : buildTransfer(protocol, capId, trimmed),
      { afterSuccess: refresh },
    );
  };

  return (
    <Frame className="border-poppy/50">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-poppy" />
          <MonoLabel accent="poppy" className="text-[10px]">
            Danger zone · {cfg.capName}
          </MonoLabel>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-poppy/70">
          irreversible
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm text-ink/75">
        <p>
          The{" "}
          <code className="font-mono text-[12px]">{cfg.capName}</code> is a real
          Sui object held by this wallet. Transfer it to hand {cfg.label}{" "}
          operator powers to another address (e.g. a multisig), or renounce it
          to make {cfg.label} permanently un-administrable. Both consume the cap
          by-value — there is no undo.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openModal("transfer")}
          className={cn(ADMIN_CTA, "border-poppy bg-poppy text-bone")}
        >
          Transfer cap
        </button>
        {renounceable && (
          <button
            type="button"
            onClick={() => openModal("renounce")}
            className={cn(ADMIN_CTA, "border-poppy bg-bone text-poppy")}
          >
            Renounce cap
          </button>
        )}
      </div>

      <Modal
        open={open !== null}
        onClose={busy ? () => {} : () => setOpen(null)}
        title={
          open === "renounce"
            ? `Renounce ${cfg.capName}`
            : `Transfer ${cfg.capName}`
        }
      >
        {state.kind === "success" ? (
          <div className="space-y-3 text-xs">
            <Success
              digest={state.digest}
              label={open === "renounce" ? "Admin renounced" : "Admin transferred"}
              body={
                open === "renounce"
                  ? `${cfg.label} can never be administered again. You will lose access as soon as the page refreshes.`
                  : `The ${cfg.capName} now belongs to the recipient. You will lose access as soon as the page refreshes.`
              }
            />
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-ink/55">
              Consumes the cap object{" "}
              <code className="font-mono text-[11px]">{capId.slice(0, 18)}…</code>
              {open === "renounce"
                ? ". The cap is destroyed; no address will ever control this protocol again."
                : ". Whoever controls the recipient address fully controls this protocol."}
            </p>

            {open === "transfer" && (
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
            )}

            <label className="block">
              <span className="font-mono-label text-[10px] text-poppy">
                Type &quot;{phrase}&quot; to confirm
              </span>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={phrase}
                className="mt-2 h-11 w-full border border-poppy/40 bg-bone px-3 font-mono text-[12px] focus:border-poppy focus:outline-none"
              />
            </label>

            {state.kind === "error" && <ErrorBanner message={state.message} />}

            <div className="flex justify-end gap-2 border-t border-ink/10 pt-3">
              <button
                type="button"
                onClick={() => setOpen(null)}
                disabled={busy}
                className={cn(ADMIN_CTA, "border-ink bg-bone text-ink")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !canSubmit}
                className={cn(ADMIN_CTA, "border-poppy bg-poppy text-bone")}
              >
                {busy
                  ? "Signing…"
                  : open === "renounce"
                    ? "Sign & renounce"
                    : "Sign & transfer"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Frame>
  );
}
