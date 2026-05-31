"use client";

import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { PROTOCOLS, type ProtocolId } from "@/lib/admin/protocols";
import {
  useAdminContext,
  useProtocolAdmin,
  type ProtocolAdmin,
} from "./admin-context";

/**
 * Gates a protocol's controls behind ownership of its on-chain admin cap. Cap
 * detection lives in <AdminProvider>; this component just renders the right
 * state for one protocol: connect prompt, checking, not-authorized, or the
 * children when the cap is held.
 *
 * A read-only **preview** escape hatch is offered on every blocked state — it
 * reveals the full console UI (live on-chain reads) without a cap. Signing
 * stays disabled while previewing (enforced in `useAdminTx`).
 */
export function AdminGate({
  children,
  protocol = "pandabox",
}: {
  children: React.ReactNode;
  protocol?: ProtocolId;
}) {
  const { account, loading, holdsCap } = useProtocolAdmin(protocol);
  const { preview, setPreview } = useAdminContext();
  const enterPreview = () => setPreview(true);

  if (preview) {
    return (
      <>
        <PreviewBanner onExit={() => setPreview(false)} />
        {children}
      </>
    );
  }
  if (!account) return <NotConnected onPreview={enterPreview} />;
  if (loading) return <Checking protocol={protocol} />;
  if (!holdsCap)
    return (
      <NotAuthorized
        protocol={protocol}
        address={account}
        onPreview={enterPreview}
      />
    );
  return <>{children}</>;
}

/**
 * Backward-compatible shim for panels written against the original
 * Pandabox-only gate. New panels should call `useProtocolAdmin(id)` directly.
 */
export function useAdmin(): Pick<
  ProtocolAdmin,
  "capId" | "refresh" | "preview"
> {
  const { capId, refresh, preview } = useProtocolAdmin("pandabox");
  return { capId, refresh, preview };
}

/* ─────────────────────────── States ─────────────────────────── */

function PreviewButton({ onPreview }: { onPreview: () => void }) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className="inline-flex items-center gap-1.5 border border-ink/25 bg-bone px-4 py-2 font-mono-label text-[10px] shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
    >
      Preview console
      <span className="text-ink/40">read-only</span>
    </button>
  );
}

function PreviewBanner({ onExit }: { onExit: () => void }) {
  return (
    <Container className="pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-sky/40 bg-sky/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-sky" />
          <MonoLabel accent="sky" className="text-[10px]">
            Read-only preview
          </MonoLabel>
          <span className="text-[13px] text-ink/65">
            On-chain reads are live. Signing is disabled — connect the wallet
            holding the admin cap to operate.
          </span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55 hover:text-ink"
        >
          exit preview
        </button>
      </div>
    </Container>
  );
}

function NotConnected({ onPreview }: { onPreview: () => void }) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-8 text-center shadow-offset-sm">
        <MonoLabel>Operator console</MonoLabel>
        <h1 className="mt-3 font-display text-3xl leading-[1.05]">
          Connect the platform-admin wallet.
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Only a wallet holding one of the on-chain admin caps can operate this
          console. You can still preview the interface read-only.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <ConnectWallet />
          <PreviewButton onPreview={onPreview} />
        </div>
      </div>
    </Container>
  );
}

function Checking({ protocol }: { protocol: ProtocolId }) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-8 text-center shadow-offset-sm">
        <MonoLabel>Verifying access</MonoLabel>
        <p className="mt-3 font-mono text-[11px] text-ink/55">
          Looking up {PROTOCOLS[protocol].capName} ownership…
        </p>
      </div>
    </Container>
  );
}

function NotAuthorized({
  protocol,
  address,
  onPreview,
}: {
  protocol: ProtocolId;
  address: string;
  onPreview: () => void;
}) {
  const cfg = PROTOCOLS[protocol];
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-poppy/40 bg-poppy/[0.06] p-8 text-center shadow-offset-sm">
        <MonoLabel accent="poppy">Not authorized</MonoLabel>
        <h1 className="mt-3 font-display text-3xl leading-[1.05] text-ink">
          This wallet doesn't hold the {cfg.label} cap.
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          <code className="font-mono text-[12px]">
            {`${cfg.packageId.slice(0, 12)}…::platform::${cfg.capName}`}
          </code>{" "}
          must be owned by the connected wallet to operate {cfg.label}. Connect
          the operator wallet, or preview the console read-only.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs">
          <span className="text-ink/50">connected as</span>
          <Address value={address} link />
        </div>
        <div className="mt-5 flex justify-center">
          <PreviewButton onPreview={onPreview} />
        </div>
      </div>
    </Container>
  );
}
