"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, registerGsap } from "@/lib/gsap";
import { cn } from "@/lib/cn";

export function Marquee({
  children,
  speed = 60,
  reverse = false,
  className,
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerGsap();
    const el = trackRef.current;
    if (!el) return;

    let tween: gsap.core.Tween | null = null;
    let lastWidth = 0;

    const init = () => {
      const width = el.scrollWidth / 2;
      if (width === 0 || width === lastWidth) return;
      lastWidth = width;
      if (tween) {
        tween.kill();
        gsap.set(el, { x: 0 });
      }
      const duration = width / speed;
      tween = gsap.to(el, {
        x: reverse ? width : -width,
        duration,
        ease: "none",
        repeat: -1,
      });
    };

    init();

    const ro = new ResizeObserver(() => init());
    ro.observe(el);

    return () => {
      tween?.kill();
      ro.disconnect();
    };
  }, [speed, reverse]);

  return (
    <div className={cn("overflow-hidden relative mask-fade-x", className)}>
      <div ref={trackRef} className="ticker-track gap-12">
        <div className="inline-flex items-center gap-12 whitespace-nowrap">{children}</div>
        <div className="inline-flex items-center gap-12 whitespace-nowrap" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
