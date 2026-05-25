"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
const LINKS = [
  { href: "/explore", label: "Explore", bar: "bg-saffron" },
  { href: "/create", label: "Create", bar: "bg-poppy" },
  { href: "/dashboard", label: "Dashboard", bar: "bg-jade" },
  { href: "/docs", label: "Docs", bar: "bg-sky" },
];

function useIsActive() {
  const pathname = usePathname() ?? "";
  return (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
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
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
}: {
  showPulse: boolean;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}) {
  const isActive = useIsActive();
  return (
    <div className="container flex h-16 items-center justify-between gap-3 md:gap-6">
      <Link
        href="/"
        aria-label="Pandabox home"
        className="inline-flex shrink-0 items-center gap-2"
      >
        <PandaMark className="h-7 w-7" />
        <span className="font-mono-label">Pandabox</span>
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => {
          const active = isActive(l.href);
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
              {l.label}
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
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
            aria-label="Pandabox home"
            onClick={onClose}
            className="inline-flex items-center gap-2"
          >
            <PandaMark className="h-7 w-7" />
            <span className="font-mono-label">Pandabox</span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center border border-ink/25 text-ink hover:bg-ink/5"
          >
            <CloseGlyph />
          </button>
        </div>
        <nav aria-label="Mobile" className="container flex flex-col pb-6 pt-2">
          {LINKS.map((l) => {
            const active = isActive(l.href);
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
                {l.label}
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
