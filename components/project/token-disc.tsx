"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@pandasui/ui/lib";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

const ACCENT_TEXT: Record<Accent, string> = {
  saffron: "text-saffron",
  poppy: "text-poppy",
  jade: "text-jade",
  sky: "text-sky",
  sun: "text-sun",
  plum: "text-plum",
};

/**
 * Circular cover image used on project cards. Renders a pulsing skeleton
 * while the IPFS gateway round-trips and falls back to the project initial
 * if the image errors. Uses `unoptimized` because IPFS URLs are content-
 * addressed (CID = cache key) so Next's `_next/image` pipeline buys nothing
 * and would 400 on any host not in `next.config.images.remotePatterns`.
 */
export function TokenDisc({
  src,
  name,
  accent,
  priority = false,
  sizes,
}: {
  src: string | null | undefined;
  name: string;
  accent: Accent;
  priority?: boolean;
  sizes?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;
  const initial = (name?.[0] ?? "P").toUpperCase();

  return (
    <div className="relative h-full w-full overflow-hidden rounded-full">
      {/* Skeleton — shown until the image fires onLoad */}
      {showImage && !loaded && (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-ink/10"
        />
      )}

      {showImage ? (
        <Image
          src={src as string}
          alt={`${name} icon`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-bone",
            ACCENT_TEXT[accent],
          )}
        >
          <span className="font-display text-5xl leading-none">{initial}</span>
        </div>
      )}
    </div>
  );
}
