"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  badge?: string;
  content: ReactNode;
};

export function Tabs({
  items,
  defaultId,
  className,
}: {
  items: TabItem[];
  defaultId?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id);
  const current = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        className="inline-flex border border-ink p-1 bg-bone"
      >
        {items.map((item) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(item.id)}
              className={cn(
                "h-9 px-4 text-[0.6875rem] font-mono uppercase tracking-[0.14em] transition-colors inline-flex items-center gap-2",
                selected ? "bg-ink text-bone" : "text-ink/60 hover:text-ink"
              )}
            >
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[0.625rem]",
                    selected ? "bg-bone text-ink" : "bg-ink/10 text-ink/80"
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-6" role="tabpanel">{current?.content}</div>
    </div>
  );
}
