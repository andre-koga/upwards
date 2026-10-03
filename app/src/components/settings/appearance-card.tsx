import { ChevronDown, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

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

const MODES = [
  { value: "system", icon: Laptop },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

export function AppearanceCard() {
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const active = MODES.find((mode) => mode.value === theme) ?? MODES[0];
  const ActiveIcon = active.icon;

  return (
    <SettingsSection title={t("appearance.title")} icon={Sun}>
      <div className="space-y-1">
        <SectionLabel className="font-medium">
          {t("appearance.theme")}
        </SectionLabel>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between px-3"
            >
              <span className="flex items-center gap-2">
                <ActiveIcon size={16} className="text-muted-foreground" />
                <span className="text-sm">
                  {t(`appearance.modes.${active.value}`)}
                </span>
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel>{t("appearance.theme")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={active.value}
              onValueChange={setTheme}
            >
              {MODES.map(({ value, icon: Icon }) => (
                <DropdownMenuRadioItem
                  key={value}
                  className="flex gap-2"
                  value={value}
                >
                  <Icon size={16} className="text-muted-foreground" />
                  <span>{t(`appearance.modes.${value}`)}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SettingsSection>
  );
}
