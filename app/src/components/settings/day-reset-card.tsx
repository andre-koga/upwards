import { useState } from "react";
import { Clock } from "lucide-react";
import { SettingsSection } from "@/components/ui/settings-section";
import {
  DAY_RESET_OPTIONS,
  getDayResetMinutes,
  setDayResetMinutes,
} from "@/lib/session/day-reset";

export function DayResetCard() {
  const [selected, setSelected] = useState(() => getDayResetMinutes());

  const handleChange = (minutes: number) => {
    setSelected(minutes);
    setDayResetMinutes(minutes);
  };

  return (
    <SettingsSection
      title="Day reset time"
      icon={Clock}
      description="Choose when your day resets. Useful if you stay up late and want habits to roll over after you sleep."
    >
      <div className="grid grid-cols-3 gap-2">
        {DAY_RESET_OPTIONS.map((opt) => (
          <button
            key={opt.minutes}
            type="button"
            onClick={() => handleChange(opt.minutes)}
            className={
              selected === opt.minutes
                ? "rounded-lg border-2 border-primary bg-primary/10 px-2 py-2 text-center text-sm font-medium text-primary transition-colors"
                : "rounded-lg border border-border px-2 py-2 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected > 0 && (
        <p className="text-xs text-muted-foreground">
          The day will flip to the next date at {DAY_RESET_OPTIONS.find((o) => o.minutes === selected)?.label}.
          Activities started before that time count toward the previous day.
        </p>
      )}
    </SettingsSection>
  );
}
