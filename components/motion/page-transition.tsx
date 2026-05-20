"use client";

import { usePathname } from "next/navigation";

/**
 * Soft content fade-in on every internal navigation. Each new pathname
 * gets a fresh `<div key>` so the CSS animation re-fires on mount; the
 * old route's tree unmounts in place. The fade is 180ms with a 2px lift
 * — enough to mask the route swap without registering as motion. Reduced
 * motion users get an instant swap via the @media rule in globals.css.
 *
 * Wraps the page tree rather than sitting beside it because App Router
 * doesn't expose a "navigation will start" hook — the only way to time a
 * transition correctly is to animate the *new* content's entrance, which
 * means we need to own the wrapper.
 */
export function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-fade-in">
      {children}
    </div>
  );
}
