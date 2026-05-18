"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@pandasui/ui/lib";

/**
 * 320ms ink overlay sweep on pathname change.
 * App Router doesn't expose a navigation lifecycle, so we watch pathname and
 * play "exit → reset" right after the new tree mounts. Effect: every internal
 * navigation lifts an ink curtain from top to bottom out of frame, leaving the
 * new page underneath.
 *
 * Respects `prefers-reduced-motion`: no-op.
 */
export function PageTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "enter" | "exit">("idle");
  const firstRender = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // New route mounted — play the lift-off.
    setPhase("enter");
    const t1 = setTimeout(() => setPhase("exit"), 16);
    const t2 = setTimeout(() => setPhase("idle"), 360);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden
      className={cn(
        "page-curtain",
        phase === "enter" && "enter",
        phase === "exit" && "exit",
      )}
    />
  );
}
