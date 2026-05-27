"use client";

import { cn } from "@pandasui/ui/lib";
import { MEMO_MAX } from "@/lib/store/airdrop-draft";

/**
 * Single-line memo, optional. Recorded on-chain in the `Airdropped` event
 * `memo: Option<String>` field, so a 256-char ceiling is the right
 * compromise between expressive freedom and event-payload bloat.
 *
 * Visual identity:
 *   - mono input, hairline border
 *   - inline char counter on the right, switching to poppy as the user
 *     approaches the limit
 *   - "OPTIONAL" mono-label above so users don't think they must fill it
 */
export function MemoInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const remaining = MEMO_MAX - value.length;
  const warn = remaining <= 32;
  const overflow = remaining < 0;

  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Memo — optional
        </span>
        <span
          className={cn(
            "font-mono text-[10.5px] tabular-nums",
            overflow
              ? "text-poppy"
              : warn
                ? "text-poppy/80"
                : "text-ink/45",
          )}
        >
          {value.length} / {MEMO_MAX}
        </span>
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. May 2026 contributor distribution"
          maxLength={MEMO_MAX}
          className={cn(
            "w-full border border-ink/15 bg-bone px-3 py-2.5",
            "font-mono text-[12.5px] tracking-[0.02em] text-ink placeholder:text-ink/35",
            "focus:border-ink/55 focus:outline-none focus:ring-0",
          )}
        />
        {/* A quiet poppy bar at the bottom of the input grows from 0 to
            full width as the user fills the field. Visual feedback that
            doesn't require reading the counter. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 block h-[2px] bg-poppy transition-all duration-200"
          style={{
            width: `${Math.min(100, (value.length / MEMO_MAX) * 100)}%`,
            opacity: warn ? 1 : 0.55,
          }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/35">
        Recorded on-chain in the event log.
      </p>
    </label>
  );
}
