"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@pandasui/ui/lib";
import { Marker } from "@/components/primitives/marker";

export type ProjectTab = {
  id: string;
  label: string;
  content: ReactNode;
  badge?: string;
};

export function ProjectTabs({
  tabs,
  defaultId,
}: {
  tabs: ProjectTab[];
  defaultId?: string;
}) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-1 border-b border-ink/15 pb-3"
      >
        {tabs.map((t) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.id)}
              className={cn(
                "px-2 py-1 transition-colors",
                selected ? "text-ink" : "text-ink/55 hover:text-ink",
              )}
            >
              {selected ? (
                <Marker color="saffron">
                  <span className="font-mono-label">{t.label}</span>
                </Marker>
              ) : (
                <span className="font-mono-label">{t.label}</span>
              )}
              {t.badge != null && (
                <span
                  className={cn(
                    "ml-1 font-mono text-[10px] tabular-nums",
                    selected ? "text-ink/70" : "text-ink/40",
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-6">
        {current?.content}
      </div>
    </div>
  );
}
