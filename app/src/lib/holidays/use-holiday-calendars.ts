import { useMemo } from "react";
import { useAccountSettings } from "@/lib/use-account-settings";
import { getActiveLocaleTag } from "@/lib/i18n";
import { resolveCalendars, type CalendarId } from "./index";
import { resolveHemisphere, type Hemisphere } from "./hemisphere";

/**
 * The calendars to show holidays for: what the user chose in Settings, else a
 * default from their locale. The array is stable between renders, so it can
 * sit in dependency lists.
 */
export function useHolidayCalendars(): CalendarId[] {
  const { holidayCalendars } = useAccountSettings();
  const tag = getActiveLocaleTag();
  const key = holidayCalendars === null ? null : holidayCalendars.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for the array
  return useMemo(() => resolveCalendars(holidayCalendars, tag), [key, tag]);
}

/** The hemisphere the month banners follow: Settings, else the calendars' region. */
export function useHemisphere(): Hemisphere {
  const { hemisphere } = useAccountSettings();
  const calendars = useHolidayCalendars();
  return useMemo(
    () => resolveHemisphere(hemisphere, calendars),
    [hemisphere, calendars]
  );
}
