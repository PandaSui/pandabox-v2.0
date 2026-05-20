"use client";

import { useRef, type RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@pandasui/ui/lib";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";
type Size = "sm" | "md" | "lg";

const ACCENT_FILL: Record<Accent, string> = {
  saffron: "bg-saffron",
  poppy: "bg-poppy",
  jade: "bg-jade",
  sky: "bg-sky",
  sun: "bg-sun",
  plum: "bg-plum",
};

const ACCENT_HEX: Record<Accent, string> = {
  saffron: "#B8C45E",
  poppy: "#C47557",
  jade: "#6E8E5D",
  sky: "#6D8796",
  sun: "#D9C57A",
  plum: "#7E685E",
};

const HEIGHT: Record<Size, string> = {
  sm: "h-[4px]",
  md: "h-[7px]",
  lg: "h-[10px]",
};

const BUBBLE_COUNT = 3;

/**
 * Animated funding-progress bar with a liquid-fill feel. On first viewport
 * entry a GSAP timeline:
 *   1. fades in the milestone ticks (staggered scaleY)
 *   2. tweens the fill 0 → pct on a slower expo curve so the eye can follow
 *      the actual filling, not just the destination
 *   3. count-ups the supplied pctRef in lock-step with the fill
 *   4. settles the leading-edge cap as the fill lands
 *   5. fires a one-shot ping at the head
 *
 * Once filled, a diagonal stripe pattern inside the fill scrolls leftward
 * continuously — the "current" cue that makes the bar feel like a flowing
 * vessel rather than a painted block. When `live`, accent-colored bubbles
 * rise through the fill on an offset loop and a highlight sweeps the
 * surface every few seconds. Everything collapses to a static fill under
 * prefers-reduced-motion.
 */
export function FundingBar({
  pct,
  live = false,
  accent = "saffron",
  size = "md",
  showTicks = true,
  pctRef,
  className,
}: {
  pct: number;
  live?: boolean;
  accent?: Accent;
  size?: Size;
  showTicks?: boolean;
  pctRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLSpanElement>(null);
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const pingRef = useRef<HTMLSpanElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(
    () => {
      const track = scope.current;
      const fill = fillRef.current;
      if (!track || !fill) return;

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const cap = capRef.current;
      const ping = pingRef.current;
      const stream = streamRef.current;
      const shimmer = shimmerRef.current;
      const bubbles = bubblesRef.current.filter(
        (b): b is HTMLSpanElement => b !== null,
      );
      const tickEls = ticksRef.current?.querySelectorAll<HTMLElement>(
        "[data-tick]",
      );

      if (reduce) {
        gsap.set(fill, { width: `${pct}%` });
        if (cap) gsap.set(cap, { opacity: 1 });
        if (tickEls) gsap.set(tickEls, { opacity: 1, scaleY: 1 });
        const pctEl = pctRef?.current;
        if (pctEl?.firstChild) {
          pctEl.firstChild.textContent = pct.toFixed(pct >= 10 ? 0 : 1);
        }
        return;
      }

      gsap.set(fill, { width: "0%" });
      if (cap) gsap.set(cap, { opacity: 0 });
      if (ping) gsap.set(ping, { opacity: 0, scale: 0.4 });
      if (tickEls) gsap.set(tickEls, { opacity: 0, scaleY: 0.2 });
      if (stream) gsap.set(stream, { backgroundPositionX: "0px", opacity: 0 });
      if (bubbles.length) {
        gsap.set(bubbles, { opacity: 0, yPercent: 40, scale: 0.4 });
      }

      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            const tl = gsap.timeline();

            // 1) Tick architecture rises into the empty track first.
            if (tickEls?.length) {
              tl.to(
                tickEls,
                {
                  opacity: 1,
                  scaleY: 1,
                  duration: 0.45,
                  ease: "power2.out",
                  stagger: 0.08,
                  transformOrigin: "center",
                },
                0,
              );
            }

            // 2) The fill pours in — slower than the previous tween so the
            //    actual filling reads, with a soft elastic settle at the end
            //    that makes the front of the bar look like liquid arriving.
            tl.to(
              fill,
              {
                width: `${pct}%`,
                duration: 1.8,
                ease: "expo.out",
              },
              0.15,
            );

            // 3) Pct count-up locked to the fill curve.
            const pctEl = pctRef?.current;
            if (pctEl?.firstChild) {
              const obj = { v: 0 };
              tl.to(
                obj,
                {
                  v: pct,
                  duration: 1.8,
                  ease: "expo.out",
                  onUpdate: () => {
                    pctEl.firstChild!.textContent = obj.v.toFixed(
                      obj.v >= 10 ? 0 : 1,
                    );
                  },
                },
                0.15,
              );
            }

            // 4) Stream pattern fades in mid-fill so the current is visible
            //    while liquid is still arriving — not just after.
            if (stream && pct > 1) {
              tl.to(
                stream,
                { opacity: 1, duration: 0.5, ease: "power2.out" },
                0.5,
              );
            }

            // 5) Leading-edge cap fades in just before the fill lands.
            if (cap) {
              tl.to(
                cap,
                { opacity: 1, duration: 0.4, ease: "power2.out" },
                1.5,
              );
            }

            // 6) One-shot ping at the head as the fill arrives.
            if (ping && pct > 1) {
              tl.fromTo(
                ping,
                { opacity: 0.9, scale: 0.4 },
                {
                  opacity: 0,
                  scale: 2.4,
                  duration: 0.9,
                  ease: "power3.out",
                },
                1.7,
              );
            }

            // 7) Continuous current — diagonal stripes inside the fill drift
            //    leftward forever so the bar never looks fully static. Pace
            //    speeds up slightly when the project is live.
            if (stream && pct > 1) {
              gsap.to(stream, {
                backgroundPositionX: "-32px",
                duration: live ? 1.6 : 2.6,
                ease: "none",
                repeat: -1,
                delay: 0.55,
              });
            }

            // 8) Live-only effects: bubbles rising through the fill on an
            //    offset loop + an occasional surface sweep + cap breathing.
            if (live && bubbles.length && pct > 5) {
              bubbles.forEach((bubble, i) => {
                gsap.fromTo(
                  bubble,
                  { opacity: 0, yPercent: 40, scale: 0.4 },
                  {
                    keyframes: [
                      { opacity: 0.85, scale: 1, duration: 0.4 },
                      { yPercent: -60, opacity: 0, scale: 0.6, duration: 1.4 },
                    ],
                    ease: "sine.out",
                    delay: 2.0 + i * 0.7,
                    repeat: -1,
                    repeatDelay: 1.8 + i * 0.3,
                  },
                );
              });
            }
            if (live && shimmer && pct > 1) {
              gsap.fromTo(
                shimmer,
                { xPercent: -130 },
                {
                  xPercent: 220,
                  duration: 2.4,
                  ease: "power2.inOut",
                  repeat: -1,
                  repeatDelay: 1.4,
                  delay: 2.1,
                },
              );
            }
            if (live && cap) {
              gsap.to(cap, {
                opacity: 0.45,
                duration: 1.2,
                ease: "sine.inOut",
                repeat: -1,
                yoyo: true,
                delay: 2.2,
              });
            }

            io.disconnect();
            return;
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
      );

      io.observe(track);
      return () => io.disconnect();
    },
    { scope, dependencies: [pct, live] },
  );

  const accentHex = ACCENT_HEX[accent];

  return (
    <div
      ref={scope}
      className={cn(
        "relative w-full overflow-hidden bg-ink/10",
        HEIGHT[size],
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        ref={fillRef}
        className={cn("relative h-full origin-left overflow-hidden", ACCENT_FILL[accent])}
        style={{ width: `${pct}%` }}
      >
        {/* Diagonal current — a repeating stripe pattern that scrolls
            leftward continuously. The angle and translucent white give the
            sense of liquid moving inside the bar without competing with
            the accent fill itself. */}
        <span
          ref={streamRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 will-change-[background-position]"
          style={{
            background:
              "repeating-linear-gradient(115deg, rgba(255,255,255,0.22) 0 6px, transparent 6px 16px)",
            opacity: 0,
          }}
        />

        {/* Bubbles — only rendered when live; rise through the fill on
            staggered loops. Positioned at relative percentages of the fill
            width so they distribute even on a long bar. */}
        {live &&
          Array.from({ length: BUBBLE_COUNT }).map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                bubblesRef.current[i] = el;
              }}
              aria-hidden
              className="pointer-events-none absolute bottom-[10%] block h-1 w-1 rounded-full will-change-transform"
              style={{
                left: `${18 + i * 28}%`,
                background: "rgba(255,255,255,0.85)",
                boxShadow: `0 0 4px rgba(255,255,255,0.4)`,
                opacity: 0,
              }}
            />
          ))}

        {/* Surface sweep — only animated when live. */}
        {live && (
          <span
            ref={shimmerRef}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 block w-1/3 will-change-transform"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
              transform: "translateX(-130%)",
            }}
          />
        )}

        {/* Leading-edge cap — sits at the head of the fill, breathes when live. */}
        <span
          ref={capRef}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 block w-[2px]"
          style={{
            background: `linear-gradient(to bottom, transparent, ${accentHex}, transparent)`,
            boxShadow: `0 0 6px ${accentHex}`,
            opacity: 0,
          }}
        />

        {/* Landing ping — ring at the head, fires once as the fill arrives. */}
        <span
          ref={pingRef}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-0 block h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full"
          style={{
            border: `1px solid ${accentHex}`,
            opacity: 0,
          }}
        />
      </div>

      {/* Milestone hairlines — wrapped so the timeline can stagger them. */}
      {showTicks && (
        <div ref={ticksRef} aria-hidden className="pointer-events-none">
          <span
            data-tick
            className="absolute left-1/4 top-0 h-full w-px origin-center bg-ink/15"
          />
          <span
            data-tick
            className="absolute left-2/4 top-0 h-full w-px origin-center bg-ink/20"
          />
          <span
            data-tick
            className="absolute left-3/4 top-0 h-full w-px origin-center bg-ink/15"
          />
        </div>
      )}
      <span
        aria-hidden
        className="absolute right-0 top-0 h-full w-px bg-ink/30"
      />
    </div>
  );
}
