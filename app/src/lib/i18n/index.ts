import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import enCommon from "@/locales/en/common.json";
import enNav from "@/locales/en/nav.json";
import enSettings from "@/locales/en/settings.json";
import enTasks from "@/locales/en/tasks.json";
import enToday from "@/locales/en/today.json";
import enJournal from "@/locales/en/journal.json";
import enProjects from "@/locales/en/projects.json";
import ptCommon from "@/locales/pt/common.json";
import ptNav from "@/locales/pt/nav.json";
import ptSettings from "@/locales/pt/settings.json";
import ptTasks from "@/locales/pt/tasks.json";
import ptToday from "@/locales/pt/today.json";
import ptJournal from "@/locales/pt/journal.json";
import ptProjects from "@/locales/pt/projects.json";
import {
  LOCALE_HTML_TAGS,
  resolveInitialLocale,
  type LocaleValue,
} from "./locale-storage";

const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    settings: enSettings,
    tasks: enTasks,
    today: enToday,
    journal: enJournal,
    projects: enProjects,
  },
  pt: {
    common: ptCommon,
    nav: ptNav,
    settings: ptSettings,
    tasks: ptTasks,
    today: ptToday,
    journal: ptJournal,
    projects: ptProjects,
  },
} as const;

/** Maps our supported app locales to Intl/BCP-47 tags used for date formatting. */
const INTL_LOCALE_TAGS: Record<LocaleValue, string> = {
  en: "en-US",
  pt: "pt-BR",
};

/** Maps our supported app locales to date-fns Locale objects. */
const DATE_FNS_LOCALES: Record<LocaleValue, Locale> = {
  en: enUS,
  pt: ptBR,
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
  const initial = resolveInitialLocale();
  document.documentElement.lang = LOCALE_HTML_TAGS[initial] ?? initial;
  i18n.on("languageChanged", (lng) => {
    const locale = (lng as LocaleValue) || "en";
    document.documentElement.lang = LOCALE_HTML_TAGS[locale] ?? locale;
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
