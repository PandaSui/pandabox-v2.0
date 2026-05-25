"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@pandasui/ui/lib";

type Accent = "saffron" | "poppy" | "jade" | "sky" | "sun" | "plum";

const ACCENT_BG_SOFT: Record<Accent, string> = {
  saffron: "bg-saffron/15",
  poppy: "bg-poppy/15",
  jade: "bg-jade/15",
  sky: "bg-sky/15",
  sun: "bg-sun/20",
  plum: "bg-plum/15",
};

/**
 * Wide 16:9 cover for the project detail hero. Pulses a skeleton while
 * the IPFS gateway round-trips, fades the image in on `onLoad`, and falls
 * back to the project initial on `onError`. Uses `unoptimized` because
 * IPFS URLs are content-addressed — Next's `_next/image` pipeline buys
 * nothing here and would 400 on hosts not in `remotePatterns`.
 */
export function CoverStrip({
  src,
  name,
  accent = "plum",
  priority = false,
  className,
}: {
  src: string | null | undefined;
  name: string;
  accent?: Accent;
  priority?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const t = useTranslations("project.detail.cover");
  const showImage = !!src && !errored;
  const initial = (name?.[0] ?? "P").toUpperCase();

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-ink/15",
        showImage && !loaded && "bg-ink/5",
        className,
      )}
    >
      <div aria-hidden className={cn("absolute inset-0", ACCENT_BG_SOFT[accent])} />

      {showImage && !loaded && (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-ink/[0.08]"
        />
      )}

      {showImage ? (
        <Image
          src={src as string}
          alt={t("imgAlt", { name })}
          fill
          sizes="(min-width:1024px) 60vw, 100vw"
          priority={priority}
          unoptimized
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-8xl leading-none text-ink/15">
            {initial}
          </span>
        </div>
      )}
    </div>
  );
}
