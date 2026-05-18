"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@pandasui/ui/lib";

/**
 * IntersectionObserver-triggered entrance.
 * Adds `.in-view` once the element first crosses the threshold; permanent
 * after first reveal so re-scrolling doesn't re-animate.
 *
 * `delayMs` lets a parent stagger siblings (e.g. cards by index × 40).
 * Respects `prefers-reduced-motion`: renders without the entrance transform.
 */
export function RevealOnView({
  children,
  delayMs = 0,
  className,
  as: Tag = "div",
  threshold = 0.05,
  rootMargin = "0px 0px -8% 0px",
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  threshold?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    if (reduced) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            // small delay for stagger
            const t = setTimeout(() => setVisible(true), delayMs);
            io.disconnect();
            return () => clearTimeout(t);
          }
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delayMs, reduced, threshold, rootMargin]);

  // For reduced motion, skip the .reveal class entirely so children render
  // at their natural opacity / position with no transition.
  if (reduced) {
    const Static = Tag as React.ElementType;
    return <Static ref={ref as never} className={className}>{children}</Static>;
  }

  const Element = Tag as React.ElementType;
  return (
    <Element
      ref={ref as never}
      className={cn("reveal", visible && "in-view", className)}
    >
      {children}
    </Element>
  );
}
