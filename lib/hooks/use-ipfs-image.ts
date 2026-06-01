"use client";

import { useCallback, useState } from "react";
import { ipfsGatewayCandidates } from "@/lib/ipfs";

/**
 * Resilient IPFS image source for `next/image`.
 *
 * Returns the current gateway URL to render plus an `onError` that advances to
 * the next gateway (same CID) when one fails — e.g. the primary gateway
 * rate-limits (HTTP 429). `exhausted` is true once every candidate has errored,
 * so the caller can drop to its placeholder. Because IPFS is content-addressed,
 * every gateway serves byte-identical content, so retrying elsewhere is safe.
 *
 * Usage:
 *   const { src, onError, exhausted } = useIpfsImage(project.iconUrl);
 *   const showImage = !!src && !exhausted;
 *   {showImage ? <Image src={src} onError={onError} … /> : <Placeholder />}
 */
export function useIpfsImage(rawSrc: string | null | undefined): {
  src: string | null;
  onError: () => void;
  exhausted: boolean;
} {
  // Reset the attempt index when the source changes. Adjusting state during
  // render (rather than in an effect) is a supported React pattern and avoids
  // a flash of the stale gateway when the card is reused for a new project.
  const key = rawSrc ?? "";
  const [state, setState] = useState<{ key: string; idx: number }>({
    key,
    idx: 0,
  });
  if (state.key !== key) {
    setState({ key, idx: 0 });
  }
  const idx = state.key === key ? state.idx : 0;

  const candidates = ipfsGatewayCandidates(rawSrc);
  const src = candidates[idx] ?? null;
  const exhausted = idx >= candidates.length;

  const onError = useCallback(() => {
    setState((s) => ({ ...s, idx: s.idx + 1 }));
  }, []);

  return { src, onError, exhausted };
}
