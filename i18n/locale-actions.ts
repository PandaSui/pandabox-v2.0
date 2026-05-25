"use server";

import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  type Locale,
} from "./locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
}
