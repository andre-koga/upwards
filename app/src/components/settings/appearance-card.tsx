import { Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { SettingsSection } from "@/components/ui/settings-section";

export function AppearanceCard() {
  const { t } = useTranslation("settings");
  return (
    <SettingsSection title={t("appearance.title")} icon={Sun}>
      <ThemeSwitcher />
    </SettingsSection>
  );
}
