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
 *
 * `preview` is an explicit read-only mode: it lets anyone view the full
 * console UI (with live on-chain reads) without holding any cap. Signing is
 * always blocked while previewing — see `useAdminTx`.
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
  /** Read-only preview override. */
  preview: boolean;
  setPreview: (on: boolean) => void;
  caps: CapMap;
  /** Re-run cap detection (e.g. after a transfer_admin). */
  refresh: () => void;
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

  const [preview, setPreview] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [caps, setCaps] = useState<CapMap>(() => freshCaps(false));

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
    () => ({ account: address, preview, setPreview, caps, refresh }),
    [address, preview, caps, refresh],
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
  /** Cap object id, or "" when not held (never used while previewing). */
  capId: string;
  /** True when this wallet owns the protocol's cap. */
  holdsCap: boolean;
  /** Cap detection still in flight. */
  loading: boolean;
  /** Global read-only preview is active. */
  preview: boolean;
  /** Connected wallet address, or null. */
  account: string | null;
  /** Whether real signing is permitted: holds the cap and not previewing. */
  canSign: boolean;
  refresh: () => void;
};

/** Per-protocol view of admin access, derived from the shared context. */
export function useProtocolAdmin(id: ProtocolId): ProtocolAdmin {
  const { caps, preview, account, refresh } = useAdminContext();
  const cap = caps[id];
  return {
    capId: cap.capId ?? "",
    holdsCap: cap.capId != null,
    loading: cap.loading,
    preview,
    account,
    canSign: !preview && cap.capId != null,
    refresh,
  };
}
