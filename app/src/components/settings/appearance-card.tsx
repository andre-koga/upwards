import { Sun } from "lucide-react";

import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { SettingsSection } from "@/components/ui/settings-section";

export function AppearanceCard() {
  return (
    <SettingsSection title="Appearance" icon={Sun}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Theme</span>
        <ThemeSwitcher />
      </div>
    </SettingsSection>
  );
}
