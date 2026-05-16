"use client";

import { cn } from "@pandasui/ui/lib";
import type { SplitV } from "@/lib/store/wizard-schema";

export function SplitsEditor({
  splits,
  onChange,
}: {
  splits: SplitV[];
  onChange: (next: SplitV[]) => void;
}) {
  const total = splits.reduce((a, s) => a + (Number(s.share) || 0), 0);
  const valid = Math.abs(total - 100) < 0.01;

  const update = (i: number, patch: Partial<SplitV>) => {
    onChange(splits.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const remove = (i: number) => onChange(splits.filter((_, idx) => idx !== i));
  const add = () => onChange([...splits, { address: "", share: 0 }]);
  const distribute = () => {
    if (splits.length === 0) return;
    const each = Math.floor((100 / splits.length) * 100) / 100;
    onChange(splits.map((s) => ({ ...s, share: each })));
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {splits.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_5rem_2rem] items-center gap-2"
          >
            <input
              value={s.address}
              onChange={(e) => update(i, { address: e.target.value })}
              placeholder="0x…"
              className="h-10 border border-ink/25 bg-bone px-3 font-mono text-xs placeholder:text-ink/30 focus:border-ink focus:outline-none"
            />
            <div className="flex h-10 items-center border border-ink/25 bg-bone">
              <input
                type="number"
                value={Number.isFinite(s.share) ? s.share : ""}
                onChange={(e) =>
                  update(i, { share: Number(e.target.value) || 0 })
                }
                min={0}
                max={100}
                step={0.1}
                className="h-full flex-1 bg-transparent pl-2 font-mono tabular-nums text-xs outline-none"
              />
              <span className="pr-2 font-mono-label text-[10px] text-ink/45">
                %
              </span>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove split"
              className="h-10 w-10 border border-ink/25 hover:border-ink hover:text-poppy"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="font-mono-label border border-ink/25 px-3 py-1.5 hover:border-ink"
        >
          + add split
        </button>
        {splits.length > 1 && (
          <button
            type="button"
            onClick={distribute}
            className="font-mono-label border border-ink/25 px-3 py-1.5 hover:border-ink"
          >
            distribute evenly
          </button>
        )}
        <span
          className={cn(
            "ml-auto font-mono text-xs tabular-nums",
            valid ? "text-jade" : "text-poppy",
          )}
        >
          Σ {total.toFixed(2)}% {valid ? "✓" : "(must = 100%)"}
        </span>
      </div>
    </div>
  );
}
