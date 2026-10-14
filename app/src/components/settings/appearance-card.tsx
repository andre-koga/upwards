import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { SettingsSelect } from "@/components/settings/settings-select";
import { SectionLabel } from "@/components/ui/section-label";
import { SettingsSection } from "@/components/ui/settings-section";

const MODES = [
  { value: "system", icon: Laptop },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

export function AppearanceCard() {
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const active = MODES.find((mode) => mode.value === theme) ?? MODES[0];

  return (
    <SettingsSection title={t("appearance.title")} icon={Sun}>
      <div className="space-y-1">
        <SectionLabel className="font-medium">
          {t("appearance.theme")}
        </SectionLabel>
        <SettingsSelect
          ariaLabel={t("appearance.theme")}
          value={active.value}
          onValueChange={setTheme}
          options={MODES.map(({ value, icon }) => ({
            value,
            icon,
            label: t(`appearance.modes.${value}`),
          }))}
        />
      </div>
    </SettingsSection>
  );
}
