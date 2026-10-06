import type { CalendarId } from "./calendars";

export type Hemisphere = "north" | "south";

/**
 * Which seasons the month banners follow. The user's explicit choice wins;
 * otherwise it is inferred from the region of the calendars they follow
 * (Brazil is south), and finally defaults to north.
 *
 * Calendars are checked in the user's order, so a person who follows `["BR",
 * "US"]` gets southern seasons and one who follows `["US", "BR"]` gets northern
 * ones. The global set says nothing about place and is skipped.
 */
const SOUTHERN: readonly CalendarId[] = ["BR"];

export function resolveHemisphere(
  chosen: Hemisphere | null,
  calendars: readonly CalendarId[]
): Hemisphere {
  if (chosen) return chosen;
  for (const calendar of calendars) {
    if (calendar === "GLOBAL") continue;
    return SOUTHERN.includes(calendar) ? "south" : "north";
  }
  return "north";
}

/**
 * Which of the twelve seasonal images to show for a calendar month (1-12). The
 * images are Northern-Hemisphere seasons (January is snow, July is a beach), so
 * the south uses the same set six months along: January shows the beach.
 * A dedicated southern set arrives with the generated banners (B3).
 */
export function bannerMonthFor(month: number, hemisphere: Hemisphere): number {
  if (hemisphere === "north") return month;
  return ((month + 5) % 12) + 1;
}
