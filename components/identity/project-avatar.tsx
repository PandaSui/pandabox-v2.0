"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@pandasui/ui/lib";

/**
 * Circle avatar for a project's icon — handles the three states the
 * dashboard cards used to silently ignore:
 *
 *   1. `src` missing      → render a font-display initial (project's first
 *                            letter) in a bordered bone circle.
 *   2. `src` loading      → ink/10 pulse skeleton fills the circle. The
 *                            <Image> is mounted opacity-0 so once it
 *                            decodes it fades in over the skeleton without
 *                            popping the layout.
 *   3. `src` errored      → fall back to the initial. Avoids the broken-
 *                            image glyph and matches the no-src branch.
 *
 * IPFS gateway loads frequently take 1–4s on cold reads, so the skeleton
 * is the practical default state on dashboard hits. The 320ms fade
 * disguises the moment of swap so the row doesn't visibly twitch.
 */
export function ProjectAvatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const useFallback = !src || errored;
  const initial = (name?.[0] ?? "P").toUpperCase();

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border border-ink/40 bg-bone",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {useFallback ? (
        <div
          className="grid h-full w-full place-items-center font-display leading-none text-ink"
          style={{ fontSize: Math.max(12, Math.round(size * 0.42)) }}
          aria-hidden
        >
          {initial}
        </div>
      ) : (
        <>
          {/* Pulse skeleton — sits behind the <Image> until it decodes.
              `aria-hidden` so screen readers don't announce a loader. */}
          {!loaded && (
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse bg-ink/10"
            />
          )}
          <Image
            src={src}
            alt=""
            fill
            sizes={`${size}px`}
            className={cn(
              "object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            )}
            unoptimized
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </>
      )}
    </div>
  );
}
