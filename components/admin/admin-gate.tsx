"use client";

import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { PROTOCOLS, type ProtocolId } from "@/lib/admin/protocols";
import { useProtocolAdmin, type ProtocolAdmin } from "./admin-context";

/**
 * Gates a protocol's controls behind ownership of its on-chain admin cap. Cap
 * detection lives in <AdminProvider>; this component just renders the right
 * state for one protocol: connect prompt, checking, not-authorized, or the
 * children when the cap is held.
 */
export function AdminGate({
  children,
  protocol = "pandabox",
}: {
  children: React.ReactNode;
  protocol?: ProtocolId;
}) {
  const { account, loading, holdsCap } = useProtocolAdmin(protocol);

  if (!account) return <NotConnected />;
  if (loading) return <Checking protocol={protocol} />;
  if (!holdsCap) return <NotAuthorized protocol={protocol} address={account} />;
  return <>{children}</>;
}

/**
 * Backward-compatible shim for panels written against the original
 * Pandabox-only gate. New panels should call `useProtocolAdmin(id)` directly.
 */
export function useAdmin(): Pick<ProtocolAdmin, "capId" | "refresh"> {
  const { capId, refresh } = useProtocolAdmin("pandabox");
  return { capId, refresh };
}

/* ─────────────────────────── States ─────────────────────────── */

function NotConnected() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-8 text-center shadow-offset-sm">
        <MonoLabel>Operator console</MonoLabel>
        <h1 className="mt-3 font-display text-3xl leading-[1.05]">
          Connect the platform-admin wallet.
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Only a wallet holding one of the on-chain admin caps can operate this
          console.
        </p>
        <div className="mt-5 flex justify-center">
          <ConnectWallet />
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
}: {
  protocol: ProtocolId;
  address: string;
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
          the operator wallet.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs">
          <span className="text-ink/50">connected as</span>
          <Address value={address} link />
        </div>
      </div>
    </Container>
  );
}
