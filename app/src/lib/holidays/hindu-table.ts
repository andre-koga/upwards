/**
 * Hindu lunisolar festival dates, 2000-2050, as MM-DD. `Intl` has no Hindu
 * calendar, so these come from a table; more years or festivals are added here
 * as data, not code. The array index is `year - HINDU_FIRST_YEAR`.
 *
 * How the table was made (see docs/architecture/product-scope.md §2.8):
 * - Diwali: the new moon with the Sun in sidereal Libra, on the day it holds at
 *   dusk in India. Matches all 31 published dates for 2000-2030.
 * - Holi: the day after Holika Dahan (the Purnima evening). The astronomy rule
 *   alone differed from published dates in 2016, 2023 and 2026, so those three
 *   years are set to the published date.
 * - 2036, 2043, 2046, 2049 and 2050: the Purnima falls close enough to evening
 *   that reasonable rules disagree, so Holi may be one day later than shown.
 *   That is acceptable for a banner and nothing depends on it more precisely.
 *
 * Regional calendars differ by a day in some years; this is the common
 * national observance.
 */
export const HINDU_FIRST_YEAR = 2000;
export const HINDU_LAST_YEAR = 2050;

export const HOLI_MM_DD: readonly string[] = [
  "03-20",
  "03-10",
  "03-29",
  "03-18",
  "03-07",
  "03-26",
  "03-15",
  "03-04",
  "03-22",
  "03-11",
  "03-01",
  "03-20",
  "03-08",
  "03-27",
  "03-17",
  "03-06",
  "03-24",
  "03-13",
  "03-02",
  "03-21",
  "03-10",
  "03-29",
  "03-18",
  "03-08",
  "03-25",
  "03-14",
  "03-04",
  "03-22",
  "03-11",
  "03-01",
  "03-20",
  "03-09",
  "03-27",
  "03-16",
  "03-05",
  "03-24",
  "03-12",
  "03-02",
  "03-21",
  "03-11",
  "02-28",
  "03-18",
  "03-07",
  "03-25",
  "03-14",
  "03-03",
  "03-22",
  "03-12",
  "03-01",
  "03-19",
  "03-08",
];

export const DIWALI_MM_DD: readonly string[] = [
  "10-26",
  "11-14",
  "11-04",
  "10-25",
  "11-12",
  "11-01",
  "10-21",
  "11-09",
  "10-28",
  "10-17",
  "11-05",
  "10-26",
  "11-13",
  "11-03",
  "10-23",
  "11-11",
  "10-30",
  "10-19",
  "11-07",
  "10-27",
  "11-14",
  "11-04",
  "10-24",
  "11-12",
  "10-31",
  "10-20",
  "11-08",
  "10-29",
  "10-17",
  "11-05",
  "10-26",
  "11-14",
  "11-02",
  "10-22",
  "11-10",
  "10-30",
  "10-19",
  "11-07",
  "10-27",
  "11-15",
  "11-04",
  "10-24",
  "11-12",
  "11-01",
  "10-20",
  "11-08",
  "10-29",
  "10-18",
  "11-05",
  "10-26",
  "11-14",
];
