"use client";

import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { Marker } from "@/components/primitives/marker";

const STEP_KEYS = ["identity", "coin", "sale", "deploy"] as const;

export function StepNav({
  current,
  onChange,
}: {
  current: number;
  onChange: (n: number) => void;
}) {
  const t = useTranslations("create.wizard");
  return (
    <nav
      aria-label={t("stepsAria")}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      {STEP_KEYS.map((key, i) => {
        const n = i + 1;
        const active = n === current;
        const completed = n < current;
        const label = t(`stepLabels.${key}`);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex items-center gap-1.5 px-1.5 py-0.5 transition-colors",
              active
                ? "text-ink"
                : completed
                  ? "text-ink/65 hover:text-ink"
                  : "text-ink/35 hover:text-ink/55",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span className="font-mono-label text-[10px] tabular-nums">
              {String(n).padStart(2, "0")}
            </span>
            {active ? (
              <Marker color="saffron">
                <span className="font-mono-label">{label}</span>
              </Marker>
            ) : (
              <span className="font-mono-label">{label}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
