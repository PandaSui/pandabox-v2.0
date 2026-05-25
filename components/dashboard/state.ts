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
  /** Stable, locale-independent key for the status pill — translated at render. */
  pillKey: ProjectState;
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
        pillKey: "live",
      };
    case "ending-soon":
      return {
        accentBar: "bg-poppy",
        bgTint: "rgba(196, 117, 87, 0.05)",
        borderClass: "border-poppy/30",
        dotClass: "bg-poppy",
        pillTextClass: "text-poppy",
        pillBorderClass: "border-poppy/40",
        pillKey: "ending-soon",
      };
    case "ended-awaiting":
      return {
        accentBar: "bg-sky",
        bgTint: "rgba(109, 135, 150, 0.06)",
        borderClass: "border-sky/30",
        dotClass: "bg-sky",
        pillTextClass: "text-sky",
        pillBorderClass: "border-sky/40",
        pillKey: "ended-awaiting",
      };
    case "closed":
      return {
        accentBar: "bg-plum",
        bgTint: undefined,
        borderClass: "border-ink/15",
        dotClass: "bg-plum",
        pillTextClass: "text-plum",
        pillBorderClass: "border-plum/40",
        pillKey: "closed",
      };
    default:
      return {
        accentBar: "bg-ink/30",
        bgTint: undefined,
        borderClass: "border-ink/15",
        dotClass: "bg-ink/35",
        pillTextClass: "text-ink/55",
        pillBorderClass: "border-ink/30",
        pillKey: "unknown",
      };
  }
}

/**
 * Time-aware label descriptor for the card footer row. Live sales surface
 * "ends in 2d 14h"; ended-awaiting nudges toward finalize; closed shows
 * how long since wrap. Quiet, mono, ink/60 — never the headline.
 *
 * Returns a structured shape so call-sites can format with `next-intl`
 * messages — keeping all human text out of this module.
 */
export type TimeLabelDescriptor =
  | { kind: "noCap" }
  | { kind: "endedJustNow" }
  | { kind: "endsIn"; duration: DurationParts }
  | { kind: "endedAgoFinalize"; duration: DurationParts }
  | { kind: "closedAgo"; duration: DurationParts }
  | { kind: "closed" }
  | { kind: "empty" };

export type DurationParts = {
  days: number;
  hours: number;
  mins: number;
};

export function getTimeLabel(
  p: OnChainProjectJSON,
  state: ProjectState,
): TimeLabelDescriptor {
  const now = Date.now();
  if (state === "live" || state === "ending-soon") {
    if (p.endTimeMs <= 0) return { kind: "noCap" };
    const ms = p.endTimeMs - now;
    if (ms <= 0) return { kind: "endedJustNow" };
    return { kind: "endsIn", duration: durationParts(ms) };
  }
  if (state === "ended-awaiting") {
    const ms = now - p.endTimeMs;
    if (ms < 0) return { kind: "endedJustNow" };
    return { kind: "endedAgoFinalize", duration: durationParts(ms) };
  }
  if (state === "closed") {
    // We don't have an explicit close timestamp on the JSON; fall back to
    // end-time if it's set, otherwise stay silent.
    if (p.endTimeMs > 0) {
      const ms = now - p.endTimeMs;
      if (ms > 0) return { kind: "closedAgo", duration: durationParts(ms) };
    }
    return { kind: "closed" };
  }
  return { kind: "empty" };
}

function durationParts(ms: number): DurationParts {
  const absMs = Math.max(0, Math.abs(ms));
  const days = Math.floor(absMs / 86_400_000);
  const hours = Math.floor((absMs % 86_400_000) / 3_600_000);
  const mins = Math.floor((absMs % 3_600_000) / 60_000);
  return { days, hours, mins };
}
