"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Globally watches the connected wallet's account and propagates the
 * change across every cache layer the UI reads from. Fires on:
 *
 *   · first connection      (null   → 0x…)
 *   · switching accounts    (0x…A   → 0x…B) within a wallet
 *   · switching wallets     (Slush  → Suiet) entirely
 *   · disconnect            (0x…    → null)
 *
 * Three layers need to be invalidated for the new address's data to
 * surface immediately:
 *
 *   1. **Router cache (RSC payload)** — server-rendered data keyed by
 *      address: the Dashboard's holdings, the wizard's "tokens you
 *      launched on Pandabox" picker, anything that reads from an
 *      address-aware server fetch. `router.refresh()` re-runs the
 *      route's server components.
 *
 *   2. **TanStack Query cache** — every `useSuiClientQuery` for the
 *      previous address (balances, owned coins, metadata lookups) is
 *      still sitting in the query cache. The new address will trigger
 *      fresh queries because the query key changes, but the OLD
 *      results stay resident and can flicker through in components
 *      that read from any non-fully-keyed query. Invalidating wipes
 *      that staleness deterministically.
 *
 *   3. **Wallet-aware client effects** — anything keyed on
 *      `account?.address` in a `useEffect` re-runs automatically when
 *      the address changes (covered by dapp-kit's existing reactivity).
 *      No work required here.
 *
 * Renders nothing — pure side effect. Mount once near the root
 * (inside the WalletProvider, since it depends on dapp-kit context).
 */
export function WalletAccountWatcher() {
  const account = useCurrentAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Track the previous address so we don't fire on every render — only
  // when the identity actually changes. Storing the raw string (or
  // `null`) keeps the comparison cheap and stable.
  const lastAddress = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const next = account?.address ?? null;
    // First render after mount: seed the ref but don't refresh. The
    // initial RSC payload was already rendered for whatever address
    // state the server saw — refreshing immediately would be a wasted
    // round-trip. Subsequent changes are real account switches.
    if (lastAddress.current === undefined) {
      lastAddress.current = next;
      return;
    }
    if (lastAddress.current === next) return;
    lastAddress.current = next;

    // Order matters slightly: invalidate the query cache *first* so
    // any client component reading from React Query (the Nav's balance
    // chip, the wizard's wallet picker, etc.) immediately enters a
    // refetch state instead of briefly rendering the previous wallet's
    // data. Then refresh the RSC tree so server-side data catches up
    // for the new address.
    queryClient.invalidateQueries();
    router.refresh();
  }, [account?.address, router, queryClient]);

  return null;
}
