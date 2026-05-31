"use client";

import { cn } from "@pandasui/ui/lib";
import { PROTOCOL_LIST, type ProtocolId } from "@/lib/admin/protocols";
import { ACCENT } from "@/lib/admin/accent";

/**
 * Segmented control mirroring the deck selection. Redundant with clicking a
 * deck card, but gives the panel area its own obvious switch and a clear
 * active-accent fill.
 */
export function ProtocolSwitcher({
  active,
  onSelect,
}: {
  active: ProtocolId;
  onSelect: (id: ProtocolId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Switch protocol panel"
      className="inline-flex border border-ink/20 bg-bone p-1 shadow-offset-sm"
    >
      {PROTOCOL_LIST.map((p) => {
        const a = ACCENT[p.accent];
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(p.id)}
            className={cn(
              "inline-flex h-9 items-center gap-2 px-4 font-mono-label text-[10px] transition-all duration-300 ease-atelier",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink",
              isActive
                ? cn(a.solid, a.onAccentText)
                : "text-ink/55 hover:text-ink",
            )}
          >
            {!isActive && (
              <span aria-hidden className={cn("block h-1 w-1 rounded-full", a.dot)} />
            )}
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
