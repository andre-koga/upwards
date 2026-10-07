import type { LocaleValue } from "@/lib/i18n/locale-storage";
import { HOLIDAYS, type HolidayId } from "./catalog";
import {
  CALENDARS,
  defaultCalendars,
  isCalendarId,
  type CalendarId,
} from "./calendars";
import { datesForRule } from "./rules";
import { birthdayLabel, birthdayOn, type BirthdayWording } from "./birthday";

export type { CalendarId } from "./calendars";
export { CALENDAR_IDS, defaultCalendars, isCalendarId } from "./calendars";

/**
 * The calendars to use: the user's choice when they have made one, else a
 * default inferred from the language tag. An explicit empty list is respected
 * ("no holidays"); only `null` (never chosen) falls back to the default.
 */
export function resolveCalendars(
  chosen: readonly string[] | null,
  languageTag: string
): CalendarId[] {
  if (chosen === null) return defaultCalendars(languageTag);
  return chosen.filter(isCalendarId);
}

const yearCache = new Map<string, Map<string, HolidayId[]>>();

/** Every holiday date in a year for these calendars, in calendar order. */
function holidaysByDate(
  calendars: readonly CalendarId[],
  year: number
): Map<string, HolidayId[]> {
  const key = `${calendars.join(",")}:${year}`;
  const cached = yearCache.get(key);
  if (cached) return cached;

  const byDate = new Map<string, HolidayId[]>();
  const seen = new Set<HolidayId>();
  for (const calendar of calendars) {
    for (const id of CALENDARS[calendar]) {
      // A holiday listed by two calendars is the same holiday: show it once.
      if (seen.has(id)) continue;
      seen.add(id);
      for (const date of datesForRule(HOLIDAYS[id].rule, year)) {
        const list = byDate.get(date) ?? [];
        list.push(id);
        byDate.set(date, list);
      }
    }
  }
  yearCache.set(key, byDate);
  return byDate;
}

/** Every holiday on a date, first calendar first. */
export function getHolidays(
  dateString: string,
  calendars: readonly CalendarId[]
): HolidayId[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || calendars.length === 0) {
    return [];
  }
  const year = Number(dateString.slice(0, 4));
  return holidaysByDate(calendars, year).get(dateString) ?? [];
}

/**
 * The holiday name to show for a day, in the reader's language, or null. When
 * several fall on one day the first calendar wins, so a person's own national
 * holiday is not replaced by a global one.
 */
export function getHolidayName(
  dateString: string,
  locale: LocaleValue,
  calendars: readonly CalendarId[]
): string | null {
  const first = getHolidays(dateString, calendars)[0];
  return first ? HOLIDAYS[first].names[locale] : null;
}

/**
 * The list to store after switching one calendar on or off. Always returns a
 * list, never `null`: once the user touches a switch they have chosen, and the
 * locale default no longer applies (so turning everything off means no
 * holidays, not "back to the default").
 */
export function toggleCalendar(
  current: readonly CalendarId[],
  calendar: CalendarId,
  on: boolean
): CalendarId[] {
  const without = current.filter((id) => id !== calendar);
  // Keep the order the user switched them on in: the first one wins when two
  // holidays share a day, and it also picks the default hemisphere.
  return on ? [...without, calendar] : without;
}

/** Your own birth date plus the words to announce it in. */
export interface BirthdayContext {
  birthday: string | null;
  wording: BirthdayWording;
}

/**
 * What to announce on a day: your birthday (if it is), then the holiday (if
 * there is one), joined when both fall together. Your birthday comes first
 * because it is the more personal of the two.
 */
export function getSpecialDayName(
  dateString: string,
  locale: LocaleValue,
  calendars: readonly CalendarId[],
  birthday?: BirthdayContext
): string | null {
  const parts: string[] = [];
  const age = birthday ? birthdayOn(dateString, birthday.birthday) : null;
  if (birthday && age !== null) {
    parts.push(birthdayLabel(age, locale, birthday.wording));
  }
  const holiday = getHolidayName(dateString, locale, calendars);
  if (holiday) parts.push(holiday);
  return parts.length > 0 ? parts.join(" · ") : null;
}
