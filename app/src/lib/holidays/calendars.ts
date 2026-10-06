import type { HolidayId } from "./catalog";

/**
 * A calendar is the list of holidays a person follows. They are chosen in
 * Settings (A9's `holiday_calendars`), separately from the UI language: a
 * Portuguese speaker in Portugal or an English speaker in Brazil can follow the
 * calendar that is actually theirs. More countries are added later as data.
 */
export const CALENDAR_IDS = ["US", "BR", "GLOBAL"] as const;
export type CalendarId = (typeof CALENDAR_IDS)[number];

export const CALENDARS: Record<CalendarId, readonly HolidayId[]> = {
  US: [
    "new_year",
    "mlk_day",
    "valentines_day",
    "presidents_day",
    "st_patricks_day",
    "good_friday",
    "easter",
    "easter_monday",
    "memorial_day",
    "juneteenth",
    "us_independence_day",
    "us_labor_day",
    "columbus_day",
    "halloween",
    "veterans_day",
    "thanksgiving",
    "christmas_eve",
    "christmas",
    "new_years_eve",
  ],
  BR: [
    "new_year",
    "carnival_monday",
    "carnival",
    "good_friday",
    "easter",
    "tiradentes",
    "br_labor_day",
    "corpus_christi",
    "br_independence_day",
    "aparecida",
    "all_souls",
    "republic_day",
    "black_awareness_day",
    "christmas_eve",
    "christmas",
    "new_years_eve",
  ],
  // Major celebrations of the world's largest traditions. National holidays
  // stay in their own calendars; "Christmas" and "New Year" are already there.
  GLOBAL: [
    "new_year",
    "lunar_new_year",
    "holi",
    "easter",
    "ramadan_start",
    "eid_al_fitr",
    "eid_al_adha",
    "diwali",
    "hanukkah",
    "day_of_the_dead",
    "christmas",
  ],
};

export function isCalendarId(value: string): value is CalendarId {
  return (CALENDAR_IDS as readonly string[]).includes(value);
}

/**
 * Calendars to follow when the user has not chosen. Inferred once from the
 * region in the locale (en-US -> US, pt-BR -> BR) plus the global set, so a
 * fresh install shows holidays that make sense without asking anything.
 */
export function defaultCalendars(languageTag: string): CalendarId[] {
  const region = languageTag.split("-")[1]?.toUpperCase();
  const base = languageTag.split("-")[0]?.toLowerCase();
  const national: CalendarId | null =
    region === "BR" || (!region && base === "pt")
      ? "BR"
      : region === "US" || (!region && base === "en")
        ? "US"
        : null;
  return national ? [national, "GLOBAL"] : ["GLOBAL"];
}
