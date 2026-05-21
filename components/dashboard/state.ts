import type { OnChainProjectJSON } from "@/app/api/dashboard/[address]/route";

/**
 * Visual + behavioral state of a project as it relates to admin work.
 * Distinct from the raw on-chain `status` (live / closed / unknown) because
 * the dashboard cares about a richer set of facts:
 *
 *   - `live`             — sale active, end-time hasn't elapsed yet.
 *   - `ending-soon`      — sale active, < 48h to end-time. Cue the creator
 *                          to be ready to finalize.
 *   - `ended-awaiting`   — sale's end-time passed but status is still 0
 *                          (nobody called permissionless_finalize yet).
 *                          Withdraws are locked until finalize lands.
 *   - `closed`           — status flipped to 1 or 2. Finalize done.
 *   - `unknown`          — sale created, status field unreadable.
 *
 * Each state drives a different accent color, time-aware label, and the
 * tinted card background. Centralizing the derivation here keeps the cards
 * consistent across the dashboard and the manage workspace.
 */
export type ProjectState =
  | "live"
  | "ending-soon"
  | "ended-awaiting"
  | "closed"
  | "unknown";

export function getProjectState(p: OnChainProjectJSON): ProjectState {
  const now = Date.now();
  const ended = p.endTimeMs > 0 && now > p.endTimeMs;

  if (p.status === "live") {
    if (ended) return "ended-awaiting";
    const msLeft = p.endTimeMs > 0 ? p.endTimeMs - now : Infinity;
    if (msLeft < 48 * 60 * 60 * 1000) return "ending-soon";
    return "live";
  }
  if (p.status === "closed") return "closed";
  return "unknown";
}

export type StateVisuals = {
  /** Tailwind class for the 3px accent bar at the top of each card. */
  accentBar: string;
  /** Inline style for the card's tinted background. */
  bgTint: string | undefined;
  /** Border emphasis class — live cards get a stronger frame. */
  borderClass: string;
  /** Dot class for the status pill. */
  dotClass: string;
  /** Status pill text class. */
  pillTextClass: string;
  /** Status pill border class. */
  pillBorderClass: string;
  /** Short, human label for the status pill. */
  pillLabel: string;
};

/**
 * Per-state visual mapping. Live + ending-soon both lean saffron, but
 * ending-soon adds a poppy outline as an "act soon" cue without making
 * the card scream. Ended-awaiting is sky because it's a governance/
 * action moment (finalize), not a closure. Closed is plum — historical.
 */
export function getStateVisuals(state: ProjectState): StateVisuals {
  switch (state) {
    case "live":
      return {
        accentBar: "bg-saffron",
        bgTint: "rgba(184, 196, 94, 0.04)",
        borderClass: "border-ink/20",
        dotClass: "bg-jade",
        pillTextClass: "text-jade",
        pillBorderClass: "border-jade/40",
        pillLabel: "live",
      };
    case "ending-soon":
      return {
        accentBar: "bg-poppy",
        bgTint: "rgba(196, 117, 87, 0.05)",
        borderClass: "border-poppy/30",
        dotClass: "bg-poppy",
        pillTextClass: "text-poppy",
        pillBorderClass: "border-poppy/40",
        pillLabel: "ending soon",
      };
    case "ended-awaiting":
      return {
        accentBar: "bg-sky",
        bgTint: "rgba(109, 135, 150, 0.06)",
        borderClass: "border-sky/30",
        dotClass: "bg-sky",
        pillTextClass: "text-sky",
        pillBorderClass: "border-sky/40",
        pillLabel: "needs finalize",
      };
    case "closed":
      return {
        accentBar: "bg-plum",
        bgTint: undefined,
        borderClass: "border-ink/15",
        dotClass: "bg-plum",
        pillTextClass: "text-plum",
        pillBorderClass: "border-plum/40",
        pillLabel: "closed",
      };
    default:
      return {
        accentBar: "bg-ink/30",
        bgTint: undefined,
        borderClass: "border-ink/15",
        dotClass: "bg-ink/35",
        pillTextClass: "text-ink/55",
        pillBorderClass: "border-ink/30",
        pillLabel: "unknown",
      };
  }
}

/**
 * Time-aware label for the card footer row. Live sales surface
 * "ends in 2d 14h"; ended-awaiting nudges toward finalize; closed shows
 * how long since wrap. Quiet, mono, ink/60 — never the headline.
 */
export function getTimeLabel(
  p: OnChainProjectJSON,
  state: ProjectState,
): string {
  const now = Date.now();
  if (state === "live" || state === "ending-soon") {
    if (p.endTimeMs <= 0) return "no time cap";
    const ms = p.endTimeMs - now;
    if (ms <= 0) return "ended just now";
    return `ends in ${formatDuration(ms)}`;
  }
  if (state === "ended-awaiting") {
    const ms = now - p.endTimeMs;
    if (ms < 0) return "ended just now";
    return `ended ${formatDuration(ms)} ago · finalize to unlock`;
  }
  if (state === "closed") {
    // We don't have an explicit close timestamp on the JSON; fall back to
    // end-time if it's set, otherwise stay silent.
    if (p.endTimeMs > 0) {
      const ms = now - p.endTimeMs;
      if (ms > 0) return `closed · ${formatDuration(ms)} ago`;
    }
    return "closed";
  }
  return "—";
}

function formatDuration(ms: number): string {
  const absMs = Math.max(0, Math.abs(ms));
  const days = Math.floor(absMs / 86_400_000);
  const hours = Math.floor((absMs % 86_400_000) / 3_600_000);
  const mins = Math.floor((absMs % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
