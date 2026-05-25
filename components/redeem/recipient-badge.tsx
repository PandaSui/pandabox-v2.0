import { cn } from "@pandasui/ui/lib";
import type { PoolRecipientMode } from "@/lib/redeem/types";

/**
 * Small mono pill on every pool card / pool hero that signals at a glance
 * whether redeemed coins are routed to a burn address or to a project's
 * treasury (buyback). Hairline border, no rounded corners, accent dot only
 * — no diecut clip-path — same vocabulary as the status pills in
 * `ToolCard`.
 *
 * Color register: poppy = burn (loss / destruction connotation), jade =
 * buyback (community / circulation). Both still carry an `Address` link
 * one tap away so power users can verify the destination.
 */
export function RecipientBadge({
  mode,
  address,
  size = "md",
}: {
  mode: PoolRecipientMode;
  /** Full recipient address — currently only used for the title tooltip. */
  address?: string;
  size?: "sm" | "md";
}) {
  const config =
    mode === "burn"
      ? {
          label: "Burn",
          dot: "bg-poppy",
          text: "text-poppy",
          border: "border-poppy/40",
        }
      : mode === "buyback"
        ? {
            label: "Buyback",
            dot: "bg-jade",
            text: "text-jade",
            border: "border-jade/40",
          }
        : {
            label: "Custom",
            dot: "bg-ink/40",
            text: "text-ink/65",
            border: "border-ink/25",
          };

  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[9px] tracking-[0.16em]"
      : "px-2.5 py-1 text-[10px] tracking-[0.18em]";

  return (
    <span
      title={address ? `Recipient · ${address}` : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border bg-bone font-mono uppercase",
        sizing,
        config.border,
        config.text,
      )}
    >
      <span aria-hidden className={cn("block h-1.5 w-1.5", config.dot)} />
      {config.label}
    </span>
  );
}
