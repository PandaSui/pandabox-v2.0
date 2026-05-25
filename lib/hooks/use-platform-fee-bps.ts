"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { PLATFORM_OBJECT_ID } from "@/lib/contracts/pandabox";

/**
 * Reads `Platform.fee_bps` from the on-chain shared object via the wallet's
 * Sui client. The value rarely changes (only the platform admin can call
 * `update_fee_bps`), so we cache aggressively — 5 min staleTime, no
 * window-focus refetch. Returns `null` while loading or when the platform
 * object id isn't configured.
 *
 * Used by the admin withdraw flow so the modal can show the *real* net the
 * creator will receive after the protocol skim, not a placeholder.
 */
export function usePlatformFeeBps(): {
  feeBps: number | null;
  isLoading: boolean;
} {
  const client = useSuiClient();
  const q = useQuery({
    queryKey: ["platform-fee-bps", PLATFORM_OBJECT_ID],
    queryFn: async () => {
      if (!PLATFORM_OBJECT_ID) return null;
      const res = await client.getObject({
        id: PLATFORM_OBJECT_ID,
        options: { showContent: true },
      });
      const content = res.data?.content;
      if (!content || content.dataType !== "moveObject") return null;
      const fields = content.fields as Record<string, unknown>;
      return Number(fields.fee_bps ?? 0);
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: !!PLATFORM_OBJECT_ID,
  });

  return {
    feeBps: typeof q.data === "number" ? q.data : null,
    isLoading: q.isLoading,
  };
}
