import {
  DIWALI_MM_DD,
  HINDU_FIRST_YEAR,
  HINDU_LAST_YEAR,
  HOLI_MM_DD,
} from "./hindu-table";

/**
 * How to find a holiday's date in a given Gregorian year. Pure data, so the
 * calendar files read as lists and a new holiday never needs new code.
 */
export type HolidayRule =
  | { type: "fixed"; month: number; day: number }
  /** `n` counts from 1; -1 is the last such weekday. `weekday` 0 = Sunday. */
  | { type: "nthWeekday"; month: number; weekday: number; n: number }
  /** Days after Easter Sunday (negative = before). */
  | { type: "easter"; offset: number }
  | { type: "chinese"; month: number; day: number }
  | { type: "islamic"; month: number; day: number }
  | { type: "hebrew"; month: string; day: number }
  | { type: "hindu"; festival: "holi" | "diwali" };

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD for a local calendar date; `new Date` rolls overflowing days. */
export function isoDate(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Easter Sunday (Gregorian), anonymous Gregorian algorithm. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return {
    month: Math.floor((h + l - 7 * m + 114) / 31),
    day: ((h + l - 7 * m + 114) % 31) + 1,
  };
}

function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number
): string {
  if (n > 0) {
    const first = new Date(year, month - 1, 1).getDay();
    return isoDate(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(year, month, 0).getDate();
  const lastWeekday = new Date(year, month - 1, lastDay).getDay();
  return isoDate(
    year,
    month,
    lastDay - ((lastWeekday - weekday + 7) % 7) + (n + 1) * 7
  );
}

type IntlCalendar = "chinese" | "islamic-umalqura" | "hebrew";
interface LunarDay {
  month: string;
  day: number;
  iso: string;
}

const formatters = new Map<IntlCalendar, Intl.DateTimeFormat>();
const lunarYears = new Map<string, LunarDay[]>();

function formatterFor(calendar: IntlCalendar): Intl.DateTimeFormat {
  let formatter = formatters.get(calendar);
  if (!formatter) {
    // Latin digits and UTC noon: no locale or time zone can shift the day.
    formatter = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, {
      timeZone: "UTC",
      month: calendar === "hebrew" ? "long" : "numeric",
      day: "numeric",
    });
    formatters.set(calendar, formatter);
  }
  return formatter;
}

/** Every day of a Gregorian year, labelled in a non-Gregorian calendar. */
function lunarYear(calendar: IntlCalendar, year: number): LunarDay[] {
  const key = `${calendar}:${year}`;
  const cached = lunarYears.get(key);
  if (cached) return cached;
  const formatter = formatterFor(calendar);
  const days: LunarDay[] = [];
  const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  for (let i = 0; i < daysInYear; i += 1) {
    const utc = new Date(Date.UTC(year, 0, 1 + i, 12));
    const parts = formatter.formatToParts(utc);
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = Number(parts.find((p) => p.type === "day")?.value);
    days.push({ month, day, iso: utc.toISOString().slice(0, 10) });
  }
  lunarYears.set(key, days);
  return days;
}

/** Some lunar dates fall twice in a Gregorian year, so this returns them all. */
function lunarDates(
  calendar: IntlCalendar,
  year: number,
  month: string,
  day: number
): string[] {
  return lunarYear(calendar, year)
    .filter((d) => d.month === month && d.day === day)
    .map((d) => d.iso);
}

/**
 * Years where `Intl`'s Chinese calendar lands a day away from the official
 * Lunar New Year. Both are new moons within minutes of midnight in China
 * (2027-02-06 23:56 and 2030-02-02 23:5x), where ICU rounds the other way. Found
 * by comparing every year 2000-2050 against the astronomical new moon.
 */
const LUNAR_NEW_YEAR_OVERRIDES: Readonly<Record<number, string>> = {
  2027: "2027-02-06",
  2030: "2030-02-03",
};

/** The dates a rule produces in a Gregorian year (usually one). */
export function datesForRule(rule: HolidayRule, year: number): string[] {
  switch (rule.type) {
    case "fixed":
      return [isoDate(year, rule.month, rule.day)];
    case "nthWeekday":
      return [nthWeekday(year, rule.month, rule.weekday, rule.n)];
    case "easter": {
      const easter = easterSunday(year);
      return [isoDate(year, easter.month, easter.day + rule.offset)];
    }
    case "chinese": {
      const override = LUNAR_NEW_YEAR_OVERRIDES[year];
      if (override && rule.month === 1 && rule.day === 1) return [override];
      return lunarDates("chinese", year, String(rule.month), rule.day);
    }
    case "islamic":
      return lunarDates("islamic-umalqura", year, String(rule.month), rule.day);
    case "hebrew":
      return lunarDates("hebrew", year, rule.month, rule.day);
    case "hindu": {
      if (year < HINDU_FIRST_YEAR || year > HINDU_LAST_YEAR) return [];
      const table = rule.festival === "holi" ? HOLI_MM_DD : DIWALI_MM_DD;
      return [`${year}-${table[year - HINDU_FIRST_YEAR]}`];
    }
  }
}
