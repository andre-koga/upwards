import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "date-fns";
import { enUS } from "date-fns/locale";
import common from "@/locales/en/common.json";
import nav from "@/locales/en/nav.json";
import settings from "@/locales/en/settings.json";
import tasks from "@/locales/en/tasks.json";
import today from "@/locales/en/today.json";
import journal from "@/locales/en/journal.json";
import stats from "@/locales/en/stats.json";
import friends from "@/locales/en/friends.json";
import notifications from "@/locales/en/notifications.json";
import projects from "@/locales/en/projects.json";
import { resolveInitialLocale, type LocaleValue } from "./locale-storage";

const resources = {
  en: {
    common,
    nav,
    settings,
    tasks,
    today,
    journal,
    stats,
    friends,
    notifications,
    projects,
  },
} as const;

/** Maps our supported app locales to Intl/BCP-47 tags used for date formatting. */
const INTL_LOCALE_TAGS: Record<LocaleValue, string> = {
  en: "en-US",
};

/** Maps our supported app locales to date-fns Locale objects. */
const DATE_FNS_LOCALES: Record<LocaleValue, Locale> = {
  en: enUS,
};

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLocale(),
  fallbackLng: "en",
  ns: Object.keys(resources.en),
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnNull: false,
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng;
  });
}

/** Active app locale as an Intl/BCP-47 tag, for Intl.DateTimeFormat / toLocaleDateString. */
export function getActiveLocaleTag(): string {
  const lng = (i18n.language as LocaleValue) || "en";
  return INTL_LOCALE_TAGS[lng] ?? INTL_LOCALE_TAGS.en;
}

/** Active app locale as a date-fns Locale object, for date-fns formatters. */
export function getActiveDateFnsLocale(): Locale {
  const lng = (i18n.language as LocaleValue) || "en";
  return DATE_FNS_LOCALES[lng] ?? DATE_FNS_LOCALES.en;
}

export default i18n;
