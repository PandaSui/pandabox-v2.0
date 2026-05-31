"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  PROTOCOLS,
  PROTOCOL_IDS,
  type ProtocolId,
} from "@/lib/admin/protocols";

/**
 * Cross-protocol admin access. Ownership of each cap is the source of truth —
 * the env `*_ADMIN_CAP_ID` values are only hints; we trust what the connected
 * wallet actually owns on chain. One provider wraps the whole console so the
 * deck, switcher, and every panel share a single cap-detection pass.
 */

type CapState = {
  loading: boolean;
  /** Object id of the held cap, or null when this wallet doesn't hold it. */
  capId: string | null;
};

type CapMap = Record<ProtocolId, CapState>;

type AdminContextValue = {
  /** Connected wallet address, or null. */
  account: string | null;
  caps: CapMap;
  /** Re-run cap detection (e.g. after a transfer_admin). */
  refresh: () => void;
  /**
   * False until the provider has mounted on the client. Wallet state comes
   * from a client-only store (`useSyncExternalStore`), so the server and the
   * first client render can disagree — consumers read this to render a
   * stable, server-matching state until mount, avoiding hydration mismatches.
   */
  mounted: boolean;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function freshCaps(loading: boolean): CapMap {
  return {
    pandabox: { loading, capId: null },
    redeem: { loading, capId: null },
    airdrop: { loading, capId: null },
  };
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const address = account?.address ?? null;

  const [refreshKey, setRefreshKey] = useState(0);
  const [caps, setCaps] = useState<CapMap>(() => freshCaps(false));
  const [mounted, setMounted] = useState(false);

  // Flip after the first client commit so wallet-dependent UI only renders
  // once the server/client trees have safely reconciled.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!address) {
      setCaps(freshCaps(false));
      return;
    }
    const ac = new AbortController();
    setCaps(freshCaps(true));

    void Promise.all(
      PROTOCOL_IDS.map(async (id) => {
        const p = PROTOCOLS[id];
        if (!p.isDeployed) {
          if (!ac.signal.aborted) {
            setCaps((prev) => ({ ...prev, [id]: { loading: false, capId: null } }));
          }
          return;
        }
        try {
          // Caps are owned (not shared) singletons with non-generic types, so
          // a `StructType` filter pins the exact object in one cheap call.
          const res = await client.getOwnedObjects({
            owner: address,
            filter: { StructType: p.capType },
            options: { showType: true },
            limit: 10,
          });
          if (ac.signal.aborted) return;
          const cap = res.data.find((o) => (o.data?.type ?? "") === p.capType);
          setCaps((prev) => ({
            ...prev,
            [id]: { loading: false, capId: cap?.data?.objectId ?? null },
          }));
        } catch {
          if (!ac.signal.aborted) {
            setCaps((prev) => ({ ...prev, [id]: { loading: false, capId: null } }));
          }
        }
      }),
    );

    return () => ac.abort();
  }, [address, client, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo<AdminContextValue>(
    () => ({ account: address, caps, refresh, mounted }),
    [address, caps, refresh, mounted],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext() must be called inside <AdminProvider>.");
  }
  return ctx;
}

export type ProtocolAdmin = {
  /** Cap object id, or "" when not held. */
  capId: string;
  /** True when this wallet owns the protocol's cap. */
  holdsCap: boolean;
  /** Cap detection still in flight. */
  loading: boolean;
  /** Connected wallet address, or null. */
  account: string | null;
  /** Whether real signing is permitted: holds the cap. */
  canSign: boolean;
  refresh: () => void;
};

/** Per-protocol view of admin access, derived from the shared context. */
export function useProtocolAdmin(id: ProtocolId): ProtocolAdmin {
  const { caps, account, refresh, mounted } = useAdminContext();

  // Until mounted, mirror the server snapshot exactly (no wallet, nothing
  // held) so SSR and the first client render agree. Real wallet-derived state
  // takes over after the mount effect fires.
  if (!mounted) {
    return {
      capId: "",
      holdsCap: false,
      loading: false,
      account: null,
      canSign: false,
      refresh,
    };
  }

  const cap = caps[id];
  return {
    capId: cap.capId ?? "",
    holdsCap: cap.capId != null,
    loading: cap.loading,
    account,
    canSign: cap.capId != null,
    refresh,
  };
}
