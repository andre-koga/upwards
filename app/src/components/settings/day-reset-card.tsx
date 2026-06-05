import { useState } from "react";
import { Clock } from "lucide-react";
import { FormSelectField } from "@/components/forms";
import { SettingsSection } from "@/components/ui/settings-section";
import {
  DAY_RESET_OPTIONS,
  getDayResetMinutes,
  setDayResetMinutes,
} from "@/lib/session/day-reset";

export function DayResetCard() {
  const [selected, setSelected] = useState(() => getDayResetMinutes());

  const handleChange = (value: string) => {
    const minutes = parseInt(value, 10);
    if (Number.isNaN(minutes)) return;
    setSelected(minutes);
    setDayResetMinutes(minutes);
  };

  const selectedLabel = DAY_RESET_OPTIONS.find((o) => o.minutes === selected)?.label;

  return (
    <SettingsSection
      title="Day reset time"
      icon={Clock}
      description="Choose when your day resets. Useful if you stay up late and want habits to roll over after you sleep."
    >
      <FormSelectField
        id="day-reset-time"
        label="Reset at"
        value={String(selected)}
        onValueChange={handleChange}
        options={DAY_RESET_OPTIONS.map((opt) => ({
          value: String(opt.minutes),
          label: opt.label,
        }))}
        message={
          selected > 0 && selectedLabel
            ? `The day flips at ${selectedLabel}. Activities started before then count toward the previous day.`
            : undefined
        }
      />
    </SettingsSection>
  );
}
