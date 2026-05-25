"use client";

import { useTranslations } from "next-intl";
import type { DurationParts, TimeLabelDescriptor } from "./state";

/**
 * Localized renderer for the structured time descriptor produced by
 * `getTimeLabel`. Kept as a hook so message lookups happen inside React
 * and follow the active locale, while the descriptor itself stays pure.
 */
export function useTimeLabel() {
  const t = useTranslations("dashboard.time");
  return function formatTimeLabel(desc: TimeLabelDescriptor): string {
    switch (desc.kind) {
      case "noCap":
        return t("noCap");
      case "endedJustNow":
        return t("endedJustNow");
      case "endsIn":
        return t("endsIn", { duration: formatDuration(t, desc.duration) });
      case "endedAgoFinalize":
        return t("endedAgoFinalize", {
          duration: formatDuration(t, desc.duration),
        });
      case "closedAgo":
        return t("closedAgo", { duration: formatDuration(t, desc.duration) });
      case "closed":
        return t("closed");
      case "empty":
      default:
        return "—";
    }
  };
}

function formatDuration(
  t: ReturnType<typeof useTranslations<"dashboard.time">>,
  d: DurationParts,
): string {
  if (d.days > 0) return t("durationDH", { days: d.days, hours: d.hours });
  if (d.hours > 0) return t("durationHM", { hours: d.hours, mins: d.mins });
  return t("durationM", { mins: d.mins });
}
