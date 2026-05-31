"use client";

import { cn } from "@pandasui/ui/lib";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Address } from "@/components/identity/address";
import { PROTOCOLS, type ProtocolId } from "@/lib/admin/protocols";
import { ACCENT } from "@/lib/admin/accent";
import type { DeckCard } from "@/lib/admin/overview";
import { useProtocolAdmin } from "./admin-context";

/**
 * The cross-protocol control deck — three live status cards pinned at the top
 * of the console. Each card is also the protocol selector: clicking it switches
 * the active panel below. The "your cap" badge is the at-a-glance answer to
 * "which of these can this wallet actually operate?".
 */
export function ControlDeck({
  cards,
  active,
  onSelect,
}: {
  cards: DeckCard[];
  active: ProtocolId;
  onSelect: (id: ProtocolId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Protocols"
      className="grid grid-cols-1 gap-px border border-ink/15 bg-ink/15 sm:grid-cols-3"
    >
      {cards.map((card) => (
        <DeckCardView
          key={card.id}
          card={card}
          active={active === card.id}
          onSelect={() => onSelect(card.id)}
        />
      ))}
    </div>
  );
}

function DeckCardView({
  card,
  active,
  onSelect,
}: {
  card: DeckCard;
  active: boolean;
  onSelect: () => void;
}) {
  const accent = PROTOCOLS[card.id].accent;
  const a = ACCENT[accent];
  const { holdsCap, loading } = useProtocolAdmin(card.id);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-4 bg-bone p-5 text-left transition-all duration-300 ease-atelier",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink",
        active ? "bg-bone" : "hover:bg-ink/[0.02]",
      )}
    >
      {/* active marker — a top accent rule */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] transition-opacity duration-300",
          a.solid,
          active ? "opacity-100" : "opacity-0 group-hover:opacity-30",
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "block h-1.5 w-1.5 rounded-full",
                !card.available ? "bg-ink/25" : card.paused ? "bg-poppy" : a.dot,
              )}
              style={
                card.available && !card.paused
                  ? { animation: "stat-live-dot 1.4s ease-in-out infinite" }
                  : undefined
              }
            />
            <span className="text-[15px] font-medium text-ink">{card.label}</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            {card.tagline}
          </p>
        </div>
        <CapBadge holdsCap={holdsCap} loading={loading} accent={a} />
      </div>

      {card.available ? (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Cell label="Fee" value={card.feeLabel} hint={card.feeHint} />
            <Cell
              label="Accrued"
              value={`${card.accruedSui} SUI`}
              hint={card.accruedZero ? "nothing to withdraw" : "withdrawable"}
            />
          </dl>
          <div className="flex items-center justify-between border-t border-ink/10 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            <span>
              {card.count.toLocaleString()} {card.countLabel}
            </span>
            <span className={card.paused ? "text-poppy" : a.text}>
              {card.paused ? "paused" : "live"}
            </span>
          </div>
          {card.treasury && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono-label text-[9px] text-ink/40">treasury</span>
              <Address value={card.treasury} copyable={false} className="text-[11px]" />
            </div>
          )}
        </>
      ) : (
        <p className="font-mono text-[11px] text-ink/45">
          Platform state unavailable — env unset or fullnode unreachable.
        </p>
      )}
    </button>
  );
}

function CapBadge({
  holdsCap,
  loading,
  accent,
}: {
  holdsCap: boolean;
  loading: boolean;
  accent: { text: string; dot: string };
}) {
  if (loading) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/35">
        checking…
      </span>
    );
  }
  if (holdsCap) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-jade">
        <span aria-hidden className="block h-1 w-1 rounded-full bg-jade" />
        your cap
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/35">
      not your cap
    </span>
  );
}

function Cell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <MonoLabel className="block text-[9px]">{label}</MonoLabel>
      <div className="mt-0.5 font-mono tabular-nums text-[15px] text-ink">
        {value}
      </div>
      {hint && (
        <div className="font-mono text-[9px] text-ink/40">{hint}</div>
      )}
    </div>
  );
}
