import { useMemo } from "react";
import { useAccountSettings } from "@/lib/use-account-settings";
import { getActiveLocaleTag } from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import {
  resolveCalendars,
  type BirthdayContext,
  type CalendarId,
} from "./index";
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

/**
 * Your birth date and the words that announce it, for the journal feed and
 * search. The wording is rebuilt only when the language changes, so the object
 * is stable enough for dependency lists.
 */
export function useBirthday(): BirthdayContext {
  const { birthday } = useAccountSettings();
  const { t } = useTranslation("journal");
  const language = getActiveLocaleTag();
  return useMemo<BirthdayContext>(
    () => ({
      birthday,
      wording: {
        plain: t("birthday.banner.plain"),
        withAge: (ordinal) => t("birthday.banner.withAge", { ordinal }),
      },
    }),
    // `t` changes identity with the language; `language` makes that explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [birthday, language]
  );
}
