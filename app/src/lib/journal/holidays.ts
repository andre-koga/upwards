import type { LocaleValue } from "@/lib/i18n/locale-storage";

/** Fixed MM-DD → English name for US-oriented holidays. */
const US_FIXED: Record<string, string> = {
  "01-01": "New Year's Day",
  "02-14": "Valentine's Day",
  "03-17": "St. Patrick's Day",
  "06-19": "Juneteenth",
  "07-04": "Independence Day",
  "10-31": "Halloween",
  "11-11": "Veterans Day",
  "12-24": "Christmas Eve",
  "12-25": "Christmas Day",
  "12-31": "New Year's Eve",
};

/** Fixed MM-DD → Portuguese name for Brazil-oriented holidays. */
const BR_FIXED: Record<string, string> = {
  "01-01": "Ano Novo",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-24": "Véspera de Natal",
  "12-25": "Natal",
  "12-31": "Véspera de Ano Novo",
};

/** Easter Sunday (Gregorian) for a given year — anonymous Gregorian algorithm. */
function easterSunday(year: number): { month: number; day: number } {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function addDays(
  year: number,
  month: number,
  day: number,
  delta: number
): string {
  const d = new Date(year, month - 1, day + delta);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): string {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  if (n < 0) {
    const last = new Date(year, month, 0).getDate();
    const lastDate = new Date(year, month - 1, last);
    const lastWeekday = lastDate.getDay();
    day = last - ((lastWeekday - weekday + 7) % 7) + (n + 1) * 7;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function buildUsMovable(year: number): Record<string, string> {
  const easter = easterSunday(year);
  const map: Record<string, string> = {};
  map[nthWeekdayOfMonth(year, 1, 1, 3)] = "Martin Luther King Jr. Day";
  map[nthWeekdayOfMonth(year, 2, 1, 3)] = "Presidents' Day";
  map[nthWeekdayOfMonth(year, 5, 1, -1)] = "Memorial Day";
  map[nthWeekdayOfMonth(year, 9, 1, 1)] = "Labor Day";
  map[nthWeekdayOfMonth(year, 10, 1, 2)] = "Columbus Day";
  map[nthWeekdayOfMonth(year, 11, 4, 4)] = "Thanksgiving";
  map[addDays(year, easter.month, easter.day, -2)] = "Good Friday";
  map[addDays(year, easter.month, easter.day, 0)] = "Easter Sunday";
  map[addDays(year, easter.month, easter.day, 1)] = "Easter Monday";
  return map;
}

function buildBrMovable(year: number): Record<string, string> {
  const easter = easterSunday(year);
  const map: Record<string, string> = {};
  map[addDays(year, easter.month, easter.day, -48)] = "Carnaval";
  map[addDays(year, easter.month, easter.day, -47)] = "Carnaval";
  map[addDays(year, easter.month, easter.day, -2)] = "Sexta-feira Santa";
  map[addDays(year, easter.month, easter.day, 0)] = "Páscoa";
  map[addDays(year, easter.month, easter.day, 60)] = "Corpus Christi";
  return map;
}

const movableCache = new Map<string, Record<string, string>>();

function movableFor(year: number, locale: LocaleValue): Record<string, string> {
  const key = `${locale}:${year}`;
  const cached = movableCache.get(key);
  if (cached) return cached;
  const built = locale === "pt" ? buildBrMovable(year) : buildUsMovable(year);
  movableCache.set(key, built);
  return built;
}

/**
 * Returns a localized holiday name for a calendar day, or null if none.
 * Uses US holidays for `en` and Brazilian holidays for `pt`.
 */
export function getHolidayName(
  dateString: string,
  locale: LocaleValue = "en"
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const year = Number(dateString.slice(0, 4));
  const md = dateString.slice(5);
  const fixed = locale === "pt" ? BR_FIXED : US_FIXED;
  if (fixed[md]) return fixed[md];
  const movable = movableFor(year, locale);
  return movable[dateString] ?? null;
}
