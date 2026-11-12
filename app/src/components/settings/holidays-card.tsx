import { useTranslation } from "react-i18next";

import { FormCalendarDateField } from "@/components/forms/form-calendar-date-field";
import { SettingsSelect } from "@/components/settings/settings-select";
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings/settings-list";
import { Switch } from "@/components/ui/switch";
import { updateAccountSettings } from "@/lib/account-settings";
import { CALENDAR_IDS, toggleCalendar, type CalendarId } from "@/lib/holidays";
import {
  useHemisphere,
  useHolidayCalendars,
} from "@/lib/holidays/use-holiday-calendars";
import { parseBirthday } from "@/lib/holidays/birthday";
import { todayDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import { useAccountSettings } from "@/lib/use-account-settings";
import type { Hemisphere } from "@/lib/holidays/hemisphere";

/** A birth date reads with its year: "17 May 1990" / "17 de maio de 1990". */
const formatBirthDate = (date: Date) =>
  date.toLocaleDateString(getActiveLocaleTag(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Holiday calendars and which seasons the month banners follow. */
export function HolidaysCard() {
  const { t } = useTranslation("settings");
  const { hemisphere: chosenHemisphere, birthday } = useAccountSettings();
  const calendars = useHolidayCalendars();
  const hemisphere = useHemisphere();

  const setCalendar = (calendar: CalendarId, on: boolean) =>
    updateAccountSettings({
      holidayCalendars: toggleCalendar(calendars, calendar, on),
    });

  const setHemisphere = (value: string) => {
    if (value === "auto") updateAccountSettings({ hemisphere: null });
    else if (value === "north" || value === "south")
      updateAccountSettings({ hemisphere: value as Hemisphere });
  };

  const setBirthday = (value: string) => {
    // "" is the field's way of saying cleared. Anything else must be a real
    // past date; the picker already prevents the rest, this is the backstop.
    if (value === "") updateAccountSettings({ birthday: null });
    else if (parseBirthday(value) && value <= todayDateString())
      updateAccountSettings({ birthday: value });
  };

  return (
    <SettingsGroup
      title={t("holidays.title")}
      footer={t("holidays.description")}
    >
      {CALENDAR_IDS.map((id) => (
        <SettingsRow
          key={id}
          htmlFor={`holiday-calendar-${id}`}
          label={t(`holidays.calendars.${id}.label`)}
          hint={t(`holidays.calendars.${id}.hint`)}
          hintId={`holiday-calendar-${id}-hint`}
          control={
            <Switch
              id={`holiday-calendar-${id}`}
              aria-describedby={`holiday-calendar-${id}-hint`}
              checked={calendars.includes(id)}
              onCheckedChange={(on) => setCalendar(id, on)}
            />
          }
        />
      ))}

      <SettingsBlock>
        <FormCalendarDateField
          id="holiday-birthday"
          label={t("holidays.birthday.label")}
          value={birthday ?? ""}
          onValueChange={setBirthday}
          min="1900-01-01"
          max={todayDateString()}
          placeholder={t("holidays.birthday.placeholder")}
          clearable
          clearLabel={t("holidays.birthday.clear")}
          formatValue={formatBirthDate}
          message={t("holidays.birthday.hint")}
          labelClassName="text-[0.9375rem] font-normal text-foreground"
          buttonClassName="bg-background/70 hover:bg-background"
          messageClassName="text-xs leading-relaxed"
        />
      </SettingsBlock>

      <SettingsRow
        label={t("holidays.hemisphere.label")}
        hint={t("holidays.hemisphere.hint")}
      >
        <div className="pt-2.5">
          <SettingsSelect
            ariaLabel={t("holidays.hemisphere.label")}
            value={chosenHemisphere ?? "auto"}
            onValueChange={setHemisphere}
            className="bg-background/70 hover:bg-background"
            options={[
              {
                value: "auto",
                label: t("holidays.hemisphere.auto", {
                  season: t(`holidays.hemisphere.${hemisphere}`),
                }),
              },
              { value: "north", label: t("holidays.hemisphere.north") },
              { value: "south", label: t("holidays.hemisphere.south") },
            ]}
          />
        </div>
      </SettingsRow>
    </SettingsGroup>
  );
}
