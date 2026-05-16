"use client";

import { cn } from "@pandasui/ui/lib";
import { Diecut } from "@/components/primitives/diecut";
import { Marker } from "@/components/primitives/marker";
import { MonoLabel } from "@/components/primitives/mono-label";
import { SuiAmount } from "@/components/identity/sui-amount";
import type { NftTierDTO } from "@/lib/api/project-dto";

export function TierSelector({
  tiers,
  selectedId,
  onSelect,
  className,
}: {
  tiers: NftTierDTO[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  if (tiers.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      <MonoLabel>Tier (optional)</MonoLabel>
      <div className="scrollbar-slim -mx-2 flex gap-2 overflow-x-auto px-2 pb-2">
        <TierCard
          name="No tier"
          priceMist={null}
          selected={selectedId == null}
          onClick={() => onSelect(null)}
          sub="tokens only"
        />
        {tiers.map((t) => (
          <TierCard
            key={t.id}
            name={t.name}
            priceMist={t.priceMist}
            selected={selectedId === t.id}
            onClick={() => onSelect(t.id)}
            sub={
              t.maxSupply > 0
                ? `${t.minted}/${t.maxSupply} minted`
                : "unlimited"
            }
          />
        ))}
      </div>
    </div>
  );
}

function TierCard({
  name,
  priceMist,
  selected,
  onClick,
  sub,
}: {
  name: string;
  priceMist: string | null;
  selected: boolean;
  onClick: () => void;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-w-[140px] shrink-0 text-left transition-all",
        selected ? "border-ink" : "border-ink/25 hover:border-ink/50",
      )}
    >
      <Diecut
        className={cn(
          "border bg-bone px-3 py-2",
          selected ? "border-ink bg-ink text-bone" : "border-ink/25",
        )}
      >
        <div>
          {selected ? (
            <Marker color="saffron">
              <span className="font-mono-label text-ink">{name}</span>
            </Marker>
          ) : (
            <span className="font-mono-label">{name}</span>
          )}
        </div>
        <div className="mt-2">
          {priceMist == null ? (
            <span className="font-mono text-xs text-ink/55">—</span>
          ) : (
            <SuiAmount
              mist={BigInt(priceMist)}
              maxFractionDigits={2}
              className={cn("text-sm", selected && "text-bone")}
            />
          )}
        </div>
        <div
          className={cn(
            "mt-1 font-mono text-[10px]",
            selected ? "text-bone/70" : "text-ink/45",
          )}
        >
          {sub}
        </div>
      </Diecut>
    </button>
  );
}
