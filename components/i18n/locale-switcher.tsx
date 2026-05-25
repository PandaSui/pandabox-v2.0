"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@pandasui/ui/lib";
import { setUserLocale } from "@/i18n/locale-actions";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from "@/i18n/locale";

type Variant = "desktop" | "mobile";

export function LocaleSwitcher({
  variant = "desktop",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (!isSupportedLocale(next) || next === locale) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  return (
    <label
      className={cn(
        "relative inline-flex items-center border border-ink/25 bg-transparent transition-colors hover:border-ink",
        variant === "desktop" ? "h-9 px-2" : "h-11 w-full px-3",
        isPending && "opacity-60",
        className,
      )}
    >
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={onChange}
        disabled={isPending}
        className={cn(
          "cursor-pointer bg-transparent pr-1 font-mono text-xs focus:outline-none disabled:cursor-not-allowed",
          variant === "mobile" && "w-full text-sm",
        )}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
