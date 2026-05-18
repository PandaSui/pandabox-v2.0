"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { PACKAGE_ID } from "@/lib/contracts/pandabox";

/**
 * Gates the operator console behind ownership of the on-chain
 * `PlatformAdminCap`. The cap is a unique object minted at package publish —
 * exactly one address holds it at any time. Any wallet without it sees the
 * "not authorized" state and can't even render the admin sub-panels.
 *
 * The cap object id is exposed to children via context so each action panel
 * can sign without re-running the ownership query.
 */

export type AdminContextValue = {
  capId: string;
  /** Bump this to invalidate the gate's cache (e.g. after transfer_admin). */
  refresh: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin() must be called inside <AdminGate>.");
  }
  return ctx;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; capId: string }
  | { kind: "missing" }
  | { kind: "error"; message: string };

export function AdminGate({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!account) {
      setState({ kind: "idle" });
      return;
    }
    const ac = new AbortController();
    setState({ kind: "loading" });
    (async () => {
      try {
        // The cap is owned (not shared), so it surfaces in getOwnedObjects.
        // Filter to platform-module objects and pick the one whose type
        // exactly matches PlatformAdminCap (no generics here).
        const res = await client.getOwnedObjects({
          owner: account.address,
          filter: {
            MoveModule: { package: PACKAGE_ID, module: "platform" },
          },
          options: { showType: true },
          limit: 50,
        });
        if (ac.signal.aborted) return;

        const cap = res.data.find(
          (o) =>
            (o.data?.type ?? "") ===
            `${PACKAGE_ID}::platform::PlatformAdminCap`,
        );
        if (cap?.data?.objectId) {
          setState({ kind: "ok", capId: cap.data.objectId });
        } else {
          setState({ kind: "missing" });
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setState({
            kind: "error",
            message:
              err instanceof Error ? err.message : "Cap lookup failed.",
          });
        }
      }
    })();
    return () => ac.abort();
  }, [account, client, refreshKey]);

  if (!account) return <NotConnected />;
  if (state.kind === "loading") return <Checking />;
  if (state.kind === "error") {
    return <ErrorState message={state.message} onRetry={() => setRefreshKey((k) => k + 1)} />;
  }
  if (state.kind === "missing") {
    return <NotAuthorized address={account.address} />;
  }
  if (state.kind === "ok") {
    return (
      <AdminContext.Provider
        value={{
          capId: state.capId,
          refresh: () => setRefreshKey((k) => k + 1),
        }}
      >
        {children}
      </AdminContext.Provider>
    );
  }
  return null;
}

function NotConnected() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-8 text-center shadow-offset-sm">
        <MonoLabel>Operator console</MonoLabel>
        <h1 className="mt-3 font-display text-3xl leading-[1.05]">
          Connect the platform-admin wallet.
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Only the wallet holding the on-chain{" "}
          <code className="font-mono text-[12px]">PlatformAdminCap</code> can
          access this console.
        </p>
        <div className="mt-5 flex justify-center">
          <ConnectWallet />
        </div>
      </div>
    </Container>
  );
}

function Checking() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-ink/15 bg-bone p-8 text-center shadow-offset-sm">
        <MonoLabel>Verifying access</MonoLabel>
        <p className="mt-3 font-mono text-[11px] text-ink/55">
          Looking up PlatformAdminCap ownership…
        </p>
      </div>
    </Container>
  );
}

function NotAuthorized({ address }: { address: string }) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-poppy/40 bg-poppy/[0.06] p-8 text-center shadow-offset-sm">
        <MonoLabel accent="poppy">Not authorized</MonoLabel>
        <h1 className="mt-3 font-display text-3xl leading-[1.05] text-ink">
          This wallet doesn't hold the cap.
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          <code className="font-mono text-[12px]">
            {`${PACKAGE_ID.slice(0, 12)}…::platform::PlatformAdminCap`}
          </code>{" "}
          must be owned by the connected wallet to load this console. Connect
          the operator wallet, or hand the cap over via the previous
          operator's <em>Transfer admin</em> action.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs">
          <span className="text-ink/50">connected as</span>
          <Address value={address} link />
        </div>
      </div>
    </Container>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl border border-poppy/40 bg-poppy/[0.06] p-8 text-center shadow-offset-sm">
        <MonoLabel accent="poppy">Cap lookup failed</MonoLabel>
        <p
          role="alert"
          className="mt-3 font-mono text-[11px] text-poppy"
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex border border-ink bg-bone px-4 py-2 font-mono-label text-[10px] shadow-offset-sm transition-all duration-300 ease-atelier hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-offset"
        >
          Retry
        </button>
      </div>
    </Container>
  );
}
