import type { LocaleValue } from "@/lib/i18n/locale-storage";

/**
 * Your own birthday as a holiday-style banner (product-scope.md §2.8). Pure
 * date logic: the setting is a `YYYY-MM-DD` date, and these functions answer
 * whether a given day is the birthday and which one it is.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface Birthday {
  year: number;
  month: number;
  day: number;
}

/** Parse a stored birthday, or null for anything that is not a real date. */
export function parseBirthday(
  value: string | null | undefined
): Birthday | null {
  const match = value ? DATE.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const check = new Date(year, month - 1, day);
  const real =
    check.getFullYear() === year &&
    check.getMonth() === month - 1 &&
    check.getDate() === day;
  return real ? { year, month, day } : null;
}

const isLeapYear = (year: number) => new Date(year, 1, 29).getMonth() === 1;

/**
 * Which birthday falls on `dateString`, as the age being turned (30 for the
 * 30th birthday), or null when it is not the birthday.
 *
 * - A 29 February birthday is celebrated on 28 February in years without a
 *   leap day, so it still appears every year.
 * - The day of birth itself and any earlier year are not birthdays.
 */
export function birthdayOn(
  dateString: string,
  birthdayValue: string | null | undefined
): number | null {
  const birthday = parseBirthday(birthdayValue);
  const date = parseBirthday(dateString);
  if (!birthday || !date || date.year <= birthday.year) return null;

  const leapDay = birthday.month === 2 && birthday.day === 29;
  const day = leapDay && !isLeapYear(date.year) ? 28 : birthday.day;
  if (date.month !== birthday.month || date.day !== day) return null;
  return date.year - birthday.year;
}

/** "1st", "2nd", "3rd", "30th": English ordinals, which Intl can pluralise. */
function englishOrdinal(n: number): string {
  const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(n);
  const suffix =
    ({ one: "st", two: "nd", few: "rd" } as Record<string, string>)[rule] ??
    "th";
  return `${n}${suffix}`;
}

export interface BirthdayWording {
  /** "Your 30th birthday": given the ordinal, returns the whole sentence. */
  withAge: (ordinal: string) => string;
  plain: string;
}

/**
 * The banner text. The age is part of the sentence ("Your 30th birthday",
 * "Seu 30º aniversário") because the year is known. The sentence comes from
 * i18n through `wording`, so the words stay in the locale files; only the
 * ordinal (which differs by language) is built here.
 */
export function birthdayLabel(
  age: number,
  locale: LocaleValue,
  wording: BirthdayWording
): string {
  if (age <= 0) return wording.plain;
  return wording.withAge(locale === "pt" ? `${age}º` : englishOrdinal(age));
}
