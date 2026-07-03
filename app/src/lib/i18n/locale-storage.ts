export type LocaleValue = "en";

export interface LocaleOption {
  value: LocaleValue;
  label: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { value: "en", label: "English" },
];

export const DEFAULT_LOCALE: LocaleValue = "en";

const LOCALE_STORAGE_KEY = "upwards-locale";

export function isLocaleValue(value: string): value is LocaleValue {
  return LOCALE_OPTIONS.some((option) => option.value === value);
}

/** Best-effort match of a BCP-47 tag (e.g. "en-US") to a supported locale. */
export function matchSupportedLocale(tag: string): LocaleValue | null {
  const lower = tag.toLowerCase();
  if (isLocaleValue(lower)) return lower;
  const base = lower.split("-")[0];
  if (isLocaleValue(base)) return base;
  return null;
}

/** Reads the explicitly-stored locale, ignoring browser language. Null if never set. */
export function getStoredLocale(): LocaleValue | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored && isLocaleValue(stored) ? stored : null;
}

/** Resolves the active locale: stored value, else browser language, else default. */
export function resolveInitialLocale(): LocaleValue {
  const stored = getStoredLocale();
  if (stored) return stored;
  if (typeof navigator !== "undefined") {
    for (const lang of navigator.languages ?? [navigator.language]) {
      const matched = lang && matchSupportedLocale(lang);
      if (matched) return matched;
    }
  }
  return DEFAULT_LOCALE;
}

export function setStoredLocale(locale: LocaleValue): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}
