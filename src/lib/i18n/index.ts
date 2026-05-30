export type Locale = "ms" | "en";

export const DEFAULT_LOCALE: Locale = "ms";
export const LOCALES: readonly Locale[] = ["ms", "en"];
export const LOCALE_COOKIE = "locale";

export type Translation = Record<Locale, string>;
export type Dictionary = Record<string, Translation>;

export function translate(dictionary: Dictionary, key: string, locale: Locale): string {
  return dictionary[key]?.[locale] ?? key;
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "ms" || value === "en";
}
