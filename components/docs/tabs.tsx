"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@pandasui/ui/lib";
import { Toc, type DocSection } from "./toc";

export type DocsTab = {
  id: string;
  label: string;
  /** Sections rendered into the sticky TOC when this tab is active. */
  sections: DocSection[];
};

type DocsTabsProps = {
  tabs: DocsTab[];
  /** Panel content keyed by tab id. Each panel is server-rendered upstream. */
  panels: Record<string, React.ReactNode>;
};

/**
 * Top-level tabs for the docs page. Splits long-scroll content into focused
 * panels (mechanics / wizard / reference) while keeping the layout shell —
 * sticky TOC on the left, article on the right — unchanged. Tab state is
 * mirrored to `?tab=…` so deep links work; switching tabs scrolls the
 * article back to the top so the user starts at the new section 01.
 */
export function DocsTabs({ tabs, panels }: DocsTabsProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams?.get("tab") ?? tabs[0]?.id ?? "";
  const [active, setActive] = useState<string>(
    tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id ?? "",
  );

  // Browser back/forward updates the search param — keep state in sync.
  useEffect(() => {
    const fromUrl = searchParams?.get("tab");
    if (fromUrl && tabs.some((t) => t.id === fromUrl) && fromUrl !== active) {
      setActive(fromUrl);
    }
  }, [searchParams, tabs, active]);

  const onSelect = (id: string) => {
    if (id === active) return;
    setActive(id);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (id === tabs[0]?.id) params.delete("tab");
    else params.set("tab", id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Bring the reader to the top of the new tab's content.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <>
      {/* Tab strip — sticky under the page header. Hairline-bordered, mono
          labels, saffron underline on the active tab (matches global nav). */}
      <div className="sticky top-16 z-20 border-b border-ink/15 bg-bone/85 backdrop-blur">
        <div
          role="tablist"
          aria-label="Docs sections"
          className="container flex gap-1 overflow-x-auto whitespace-nowrap"
        >
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`docs-panel-${t.id}`}
                id={`docs-tab-${t.id}`}
                onClick={() => onSelect(t.id)}
                className={cn(
                  "relative font-mono-label px-3 py-3 transition-colors",
                  isActive ? "text-ink" : "text-ink/55 hover:text-ink",
                )}
              >
                {t.label}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-3 bottom-0 h-[2px] origin-center bg-saffron transition-transform duration-300 ease-out",
                    isActive ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="container grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1fr_3fr]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <Toc key={activeTab.id} sections={activeTab.sections} />
        </aside>

        {tabs.map((t) => (
          <article
            key={t.id}
            id={`docs-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`docs-tab-${t.id}`}
            hidden={t.id !== active}
            className="max-w-prose space-y-16 text-[15px] leading-relaxed text-ink/85"
          >
            {panels[t.id]}
          </article>
        ))}
      </div>
    </>
  );
}
