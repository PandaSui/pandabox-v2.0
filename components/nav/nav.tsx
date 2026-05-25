"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PandaMark } from "@pandasui/ui";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { TreasuryPulse } from "@/components/pulse";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { AdminNavLink } from "./admin-nav-link";
import { cn } from "@pandasui/ui/lib";

// Each nav destination owns a semantic accent — so the bar that paints under
// the active item also previews the color register the page itself leans on.
// Discovery is saffron (default active), creation is poppy (inflow), the
// supporter dashboard is jade (community), docs is sky (methodical).
//
// Tools is a dropdown — the trigger doesn't navigate; the children handle
// routing. `activeMatch` lets us light the Tools accent bar when the user
// lands on any descendant route (/tools, /redeem, /airdrop).
type ToolChildStatus = "live" | "soon";

type NavChild = {
  href: string;
  labelKey: string; // resolved under nav.tools.<labelKey>
  status?: ToolChildStatus;
};

type NavLink = {
  href: string;
  labelKey: string;
  bar: string;
  children?: NavChild[];
  /** Extra paths (beyond `href`) that should mark this nav item as active. */
  activeMatch?: readonly string[];
};

const LINKS: readonly NavLink[] = [
  { href: "/explore", labelKey: "explore", bar: "bg-saffron" },
  { href: "/create", labelKey: "create", bar: "bg-poppy" },
  {
    href: "/tools",
    labelKey: "tools",
    bar: "bg-sun",
    activeMatch: ["/redeem", "/airdrop"],
    children: [
      { href: "/airdrop", labelKey: "airdrop", status: "soon" },
      { href: "/redeem", labelKey: "redeem", status: "live" },
    ],
  },
  { href: "/dashboard", labelKey: "dashboard", bar: "bg-jade" },
  { href: "/docs", labelKey: "docs", bar: "bg-sky" },
];

function useIsActive() {
  const pathname = usePathname() ?? "";
  return (link: NavLink) => {
    const matches = [link.href, ...(link.activeMatch ?? [])];
    return matches.some(
      (h) => pathname === h || pathname.startsWith(`${h}/`),
    );
  };
}

type NavProps = {
  showPulse?: boolean;
  className?: string;
  /**
   * When true, the header stays in document flow at the top of the page and
   * a fixed clone slides in once the hero has been scrolled past. Used on
   * the landing page so the masthead reads as part of the hero and only
   * becomes a floating utility once the user is past it.
   */
  floatAfterHero?: boolean;
};

export function Nav({
  showPulse = false,
  className,
  floatAfterHero = false,
}: NavProps) {
  const [floating, setFloating] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!floatAfterHero) return;
    let raf = 0;
    const update = () => {
      // Trigger the float the moment the in-flow header has scrolled out of
      // view — its own height (~64px) is the natural cutoff. Clamp to a
      // small vh fraction so very short viewports still get a sensible
      // hand-off rather than firing before the bar fully clears.
      const threshold = Math.max(window.innerHeight * 0.05, 56);
      setFloating(window.scrollY > threshold);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [floatAfterHero]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setToolsOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close the Tools dropdown on any click outside the dropdown's trigger/panel.
  // The two NavInner clones (in-flow + floating) both tag their elements with
  // `[data-tools-dropdown]`, so a single document-level listener covers both.
  useEffect(() => {
    if (!toolsOpen) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && !target.closest("[data-tools-dropdown]")) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [toolsOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          floatAfterHero
            ? "relative z-30 border-b border-ink/15 bg-bone"
            : "sticky top-0 z-40 border-b border-ink/15 bg-bone/85 backdrop-blur-md",
          className,
        )}
      >
        <NavInner
          showPulse={showPulse}
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen((v) => !v)}
          toolsOpen={toolsOpen}
          onToggleTools={() => setToolsOpen((v) => !v)}
          onCloseTools={() => setToolsOpen(false)}
        />
      </header>

      {floatAfterHero && (
        <header
          aria-hidden={!floating}
          className={cn(
            "fixed inset-x-0 top-0 z-40 border-b border-ink/15 bg-bone/85 backdrop-blur-md",
            "transition-[transform,opacity] duration-300 ease-out",
            floating
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-full opacity-0",
          )}
        >
          <NavInner
            showPulse={showPulse}
            mobileOpen={mobileOpen}
            onToggleMobile={() => setMobileOpen((v) => !v)}
            toolsOpen={toolsOpen}
            onToggleTools={() => setToolsOpen((v) => !v)}
            onCloseTools={() => setToolsOpen(false)}
          />
        </header>
      )}

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function NavInner({
  showPulse,
  mobileOpen,
  onToggleMobile,
  toolsOpen,
  onToggleTools,
  onCloseTools,
}: {
  showPulse: boolean;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  toolsOpen: boolean;
  onToggleTools: () => void;
  onCloseTools: () => void;
}) {
  const isActive = useIsActive();
  const t = useTranslations("nav");
  return (
    <div className="container flex h-16 items-center justify-between gap-3 md:gap-6">
      <Link
        href="/"
        aria-label={t("homeAria")}
        className="inline-flex shrink-0 items-center gap-2"
      >
        <PandaMark className="h-7 w-7" />
        <span className="font-mono-label">Pandabox</span>
      </Link>

      <nav aria-label={t("primaryAria")} className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => {
          const active = isActive(l);
          if (l.children) {
            return (
              <ToolsDropdown
                key={l.href}
                link={l}
                active={active}
                open={toolsOpen}
                onToggle={onToggleTools}
                onSelect={onCloseTools}
                t={t}
              />
            );
          }
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative font-mono-label px-3 py-1.5 transition-colors",
                active ? "text-ink" : "text-ink/70 hover:text-ink",
              )}
            >
              {t(`links.${l.labelKey}`)}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-3 bottom-1 h-[2px] origin-center transition-transform duration-300 ease-out",
                  l.bar,
                  active ? "scale-x-100" : "scale-x-0",
                )}
              />
            </Link>
          );
        })}
        <AdminNavLink />
      </nav>

      <div className="flex items-center gap-2 md:gap-4">
        {showPulse && (
          <div className="hidden w-[180px] lg:block">
            <TreasuryPulse variant="compact" />
          </div>
        )}
        <LocaleSwitcher variant="desktop" className="hidden md:inline-flex" />
        <div className="hidden md:block">
          <ConnectWallet />
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
          aria-expanded={mobileOpen}
          onClick={onToggleMobile}
          className="inline-flex h-10 w-10 items-center justify-center border border-ink/25 text-ink transition-colors hover:bg-ink/5 md:hidden"
        >
          {mobileOpen ? <CloseGlyph /> : <MenuGlyph />}
        </button>
      </div>
    </div>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isActive = useIsActive();
  const t = useTranslations("nav");
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0 top-0 border-b border-ink/15 bg-bone shadow-offset",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            aria-label={t("homeAria")}
            onClick={onClose}
            className="inline-flex items-center gap-2"
          >
            <PandaMark className="h-7 w-7" />
            <span className="font-mono-label">Pandabox</span>
          </Link>
          <button
            type="button"
            aria-label={t("closeMenu")}
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center border border-ink/25 text-ink hover:bg-ink/5"
          >
            <CloseGlyph />
          </button>
        </div>
        <nav aria-label={t("mobileAria")} className="container flex flex-col pb-6 pt-2">
          {LINKS.map((l) => {
            const active = isActive(l);
            if (l.children) {
              return (
                <MobileToolsGroup
                  key={l.href}
                  link={l}
                  active={active}
                  t={t}
                  onClose={onClose}
                />
              );
            }
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative font-mono-label border-b border-ink/10 py-4 pl-3 transition-colors",
                  active ? "text-ink" : "text-ink/80 hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 origin-center transition-transform duration-300 ease-out",
                    l.bar,
                    active ? "scale-y-100" : "scale-y-0",
                  )}
                />
                {t(`links.${l.labelKey}`)}
              </Link>
            );
          })}
          <div onClick={onClose} className="py-2">
            <AdminNavLink />
          </div>
          <div className="mt-4">
            <LocaleSwitcher variant="mobile" />
          </div>
          <div className="mt-3">
            <ConnectWallet />
          </div>
        </nav>
      </div>
    </div>
  );
}

/* ─────────────────────────── Tools dropdown (desktop) ─────────────────────────── */

/**
 * Tools is a dropdown trigger rather than a direct link — clicking it opens
 * a hairline-bordered panel of tool destinations (Airdrop, Redeem, plus a
 * "view all" link to `/tools`). Keeps the masthead compact while letting
 * crypto-natives reach a specific tool in one step.
 */
function ToolsDropdown({
  link,
  active,
  open,
  onToggle,
  onSelect,
  t,
}: {
  link: NavLink;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const isActive = useIsActive();
  return (
    <div className="relative" data-tools-dropdown>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="nav-tools-menu"
        onClick={onToggle}
        className={cn(
          "relative inline-flex items-center gap-1.5 font-mono-label px-3 py-1.5 transition-colors",
          active || open ? "text-ink" : "text-ink/70 hover:text-ink",
        )}
      >
        {t(`links.${link.labelKey}`)}
        <ChevronGlyph open={open} />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-3 bottom-1 h-[2px] origin-center transition-transform duration-300 ease-out",
            link.bar,
            active ? "scale-x-100" : "scale-x-0",
          )}
        />
      </button>

      {/* Panel — absolute, hairline-bordered, bone surface. Renders in the
          DOM at all times so the open/close transition can animate; visibility
          is gated by `open`. */}
      <div
        id="nav-tools-menu"
        role="menu"
        aria-label={t("tools.menuAria")}
        className={cn(
          "absolute left-0 top-full z-40 mt-2 w-[280px] border border-ink bg-bone shadow-offset",
          "origin-top transition-[opacity,transform] duration-200 ease-out",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        {/* Top accent spine — same idiom as ToolCard, signals the page's accent register. */}
        <span aria-hidden className={cn("block h-[2px]", link.bar)} />

        <ul className="flex flex-col py-1">
          {link.children!.map((child) => (
            <ToolsDropdownItem
              key={child.href}
              child={child}
              active={isActive({ href: child.href, labelKey: "", bar: "" })}
              t={t}
              onSelect={onSelect}
            />
          ))}
        </ul>

        {/* Hairline divider then the "view all" footer link */}
        <div className="border-t border-ink/12">
          <Link
            href={link.href}
            role="menuitem"
            onClick={onSelect}
            className="group flex items-center justify-between gap-2 px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <span>{t("tools.viewAll")}</span>
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-[2px]">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ToolsDropdownItem({
  child,
  active,
  t,
  onSelect,
}: {
  child: NavChild;
  active: boolean;
  t: ReturnType<typeof useTranslations>;
  onSelect: () => void;
}) {
  return (
    <li>
      <Link
        href={child.href}
        role="menuitem"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center justify-between gap-3 px-4 py-2.5 transition-colors",
          active ? "bg-ink/5 text-ink" : "text-ink/80 hover:bg-ink/[0.04] hover:text-ink",
        )}
      >
        <span className="font-sans text-[13.5px] leading-snug">
          {t(`tools.${child.labelKey}`)}
        </span>
        {child.status === "soon" ? (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink/55">
            <span aria-hidden className="block h-1 w-1 bg-sun" />
            {t("tools.statusSoon")}
          </span>
        ) : child.status === "live" ? (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-jade">
            <span
              aria-hidden
              className="block h-1 w-1 rounded-full bg-jade"
              style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
            />
            {t("tools.statusLive")}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "transition-transform duration-200 ease-out",
        open ? "rotate-180" : "rotate-0",
      )}
    >
      <path d="M2.5 3.75 L5 6.25 L7.5 3.75" />
    </svg>
  );
}

/* ─────────────────────────── Tools group (mobile) ─────────────────────────── */

/**
 * Mobile-menu equivalent of the desktop dropdown. The Tools parent reads as
 * a section header (clicking it doesn't navigate), with its children rendered
 * inline directly below as indented sub-items.
 */
function MobileToolsGroup({
  link,
  active,
  t,
  onClose,
}: {
  link: NavLink;
  active: boolean;
  t: ReturnType<typeof useTranslations>;
  onClose: () => void;
}) {
  const isActive = useIsActive();
  return (
    <div className="relative border-b border-ink/10 py-4 pl-3">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-[1.35rem] w-[2px] h-5 origin-center transition-transform duration-300 ease-out",
          link.bar,
          active ? "scale-y-100" : "scale-y-0",
        )}
      />
      <span className="font-mono-label text-ink/85">
        {t(`links.${link.labelKey}`)}
      </span>
      <ul className="mt-3 flex flex-col gap-1">
        {link.children!.map((child) => {
          const childActive = isActive({ href: child.href, labelKey: "", bar: "" });
          return (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={onClose}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 border-l border-ink/15 pl-3 py-2 transition-colors",
                  childActive ? "border-l-ink text-ink" : "text-ink/75 hover:text-ink",
                )}
              >
                <span className="text-[14px]">{t(`tools.${child.labelKey}`)}</span>
                {child.status === "soon" && (
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink/55">
                    <span aria-hidden className="block h-1 w-1 bg-sun" />
                    {t("tools.statusSoon")}
                  </span>
                )}
                {child.status === "live" && (
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-jade">
                    <span
                      aria-hidden
                      className="block h-1 w-1 rounded-full bg-jade"
                      style={{ animation: "stat-live-dot 1.4s ease-in-out infinite" }}
                    />
                    {t("tools.statusLive")}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={link.href}
            onClick={onClose}
            className="flex items-center justify-between gap-2 border-l border-ink/15 pl-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/70 transition-colors hover:text-ink"
          >
            <span>{t("tools.viewAll")}</span>
            <span aria-hidden>→</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

function MenuGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden
    >
      <line x1="2" y1="4.5" x2="14" y2="4.5" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="11.5" x2="14" y2="11.5" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden
    >
      <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
      <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
    </svg>
  );
}
