export const SUPPORTED_LOCALES = [
  "en",
  "zh-CN",
  "zh-TW",
  "ko",
  "pl",
  "ja",
  "es",
  "de",
  "it",
  "id",
  "ru",
  "vi",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Native display names for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ko: "한국어",
  pl: "Polski",
  ja: "日本語",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  id: "Bahasa Indonesia",
  ru: "Русский",
  vi: "Tiếng Việt",
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
