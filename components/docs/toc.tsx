"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";
import { Marker } from "@/components/primitives/marker";

export type DocSection = {
  id: string;
  label: string;
};

export function Toc({ sections }: { sections: DocSection[] }) {
  const t = useTranslations("docs.toc");
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: 0,
      },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav aria-label={t("ariaLabel")} className="space-y-1">
      <span className="font-mono-label text-ink/45 block pb-2">{t("onThisPage")}</span>
      {sections.map((s) => {
        const selected = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              "block py-0.5 text-sm transition-colors",
              selected ? "text-ink" : "text-ink/55 hover:text-ink",
            )}
          >
            {selected ? (
              <Marker color="saffron">
                <span className="font-mono-label">{s.label}</span>
              </Marker>
            ) : (
              <span className="font-mono-label">{s.label}</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
