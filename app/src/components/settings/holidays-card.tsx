import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import { updateAccountSettings } from "@/lib/account-settings";
import { CALENDAR_IDS, toggleCalendar, type CalendarId } from "@/lib/holidays";
import {
  useHemisphere,
  useHolidayCalendars,
} from "@/lib/holidays/use-holiday-calendars";
import { useAccountSettings } from "@/lib/use-account-settings";
import type { Hemisphere } from "@/lib/holidays/hemisphere";

/** Holiday calendars and which seasons the month banners follow. */
export function HolidaysCard() {
  const { t } = useTranslation("settings");
  const { hemisphere: chosenHemisphere } = useAccountSettings();
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

  const hemisphereLabel =
    chosenHemisphere === null
      ? t("holidays.hemisphere.auto", {
          season: t(`holidays.hemisphere.${hemisphere}`),
        })
      : t(`holidays.hemisphere.${chosenHemisphere}`);

  return (
    <SettingsSection
      title={t("holidays.title")}
      icon={CalendarDays}
      description={t("holidays.description")}
    >
      {CALENDAR_IDS.map((id) => (
        <div key={id} className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`holiday-calendar-${id}`} className="leading-snug">
              {t(`holidays.calendars.${id}.label`)}
            </Label>
            <p
              id={`holiday-calendar-${id}-hint`}
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {t(`holidays.calendars.${id}.hint`)}
            </p>
          </div>
          <Switch
            id={`holiday-calendar-${id}`}
            aria-describedby={`holiday-calendar-${id}-hint`}
            checked={calendars.includes(id)}
            onCheckedChange={(on) => setCalendar(id, on)}
          />
        </div>
      ))}

      <div className="space-y-1 border-t border-border pt-3">
        <Label className="leading-snug">{t("holidays.hemisphere.label")}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("holidays.hemisphere.hint")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between px-3"
              aria-label={t("holidays.hemisphere.label")}
            >
              <span className="text-sm">{hemisphereLabel}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel>
              {t("holidays.hemisphere.label")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={chosenHemisphere ?? "auto"}
              onValueChange={setHemisphere}
            >
              <DropdownMenuRadioItem value="auto">
                {t("holidays.hemisphere.auto", {
                  season: t(`holidays.hemisphere.${hemisphere}`),
                })}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="north">
                {t("holidays.hemisphere.north")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="south">
                {t("holidays.hemisphere.south")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SettingsSection>
  );
}
