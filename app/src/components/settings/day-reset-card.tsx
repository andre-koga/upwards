import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionLabel } from "@/components/ui/section-label";
import { SettingsSection } from "@/components/ui/settings-section";
import {
  DAY_RESET_OPTIONS,
  getDayResetMinutes,
  setDayResetMinutes,
} from "@/lib/session/day-reset";

export function DayResetCard() {
  const { t } = useTranslation("settings");
  const [selected, setSelected] = useState(() => getDayResetMinutes());

  const handleChange = (value: string) => {
    const minutes = parseInt(value, 10);
    if (Number.isNaN(minutes)) return;
    setSelected(minutes);
    setDayResetMinutes(minutes);
  };

  const selectedLabel = DAY_RESET_OPTIONS.find(
    (o) => o.minutes === selected
  )?.label;

  return (
    <SettingsSection
      title={t("dayReset.title")}
      icon={Clock}
      description={t("dayReset.description")}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <SectionLabel className="font-medium">
            {t("dayReset.resetAt")}
          </SectionLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between px-3"
              >
                <span className="text-sm">{selectedLabel}</span>
                <ChevronDown size={16} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
              align="start"
              sideOffset={6}
            >
              <DropdownMenuLabel>{t("dayReset.resetAt")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={String(selected)}
                onValueChange={handleChange}
              >
                {DAY_RESET_OPTIONS.map((opt) => (
                  <DropdownMenuRadioItem
                    key={opt.minutes}
                    value={String(opt.minutes)}
                  >
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {selected > 0 && selectedLabel && (
          <p className="text-xs text-muted-foreground">
            {t("dayReset.helper", { time: selectedLabel })}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
