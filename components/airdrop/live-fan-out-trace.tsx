"use client";

import { useMemo } from "react";
import { parseRecipients, liveRows, traceStateFor } from "@/lib/airdrop";
import { useAirdropDraft } from "@/lib/store/airdrop-draft";
import { useAirdropSubmitStore } from "@/lib/store/airdrop-submit";
import { useOwnedCoinGroups } from "@/lib/airdrop/use-owned-coins";
import { FanOutTrace } from "./fan-out-trace";

/**
 * Thin client wrapper that lifts the hero's recipient count out of the
 * shared draft store. The server-rendered page passes in the static
 * platform numbers (`totalAirdrops`, `maxRecipients`) and this component
 * supplies the live count + state so the trace updates as the user
 * composes the recipient list below.
 *
 * Keeping the dumb `FanOutTrace` decoupled from the store means the
 * server page can still render the hero with `state="idle"` for SSR
 * (via `FanOutTrace` directly), while the page actually mounts this
 * wrapper for the interactive experience.
 */
export function LiveFanOutTrace({
  totalAirdrops,
  maxRecipients,
  className,
}: {
  totalAirdrops: number;
  maxRecipients: number;
  className?: string;
}) {
  const { draft } = useAirdropDraft();
  const { groups } = useOwnedCoinGroups();
  const submitState = useAirdropSubmitStore((s) => s.state);

  const decimals = useMemo(() => {
    const g = groups.find((x) => x.coinType === draft.coinType);
    return g?.decimals ?? 0;
  }, [groups, draft.coinType]);

  const recipientCount = useMemo(() => {
    if (!draft.rawInput.trim()) return 0;
    const parsed = parseRecipients(draft.rawInput, {
      decimals,
      duplicatePolicy: draft.duplicatePolicy,
    });
    return liveRows(parsed.rows).length;
  }, [draft.rawInput, decimals, draft.duplicatePolicy]);

  // The submit lifecycle takes precedence over the live preview — when
  // we're signing/confirming, the trace projects `running` and fires
  // particles; when settled, it projects `settled` and holds the filled
  // recipients until the user dismisses the success modal.
  const overlay = traceStateFor(submitState);
  const state = overlay ?? (recipientCount > 0 ? "preview" : "idle");

  return (
    <FanOutTrace
      state={state}
      recipientCount={recipientCount}
      totalAirdrops={totalAirdrops}
      maxRecipients={maxRecipients}
      className={className}
    />
  );
}
