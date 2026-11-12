import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { SettingsSelect } from "@/components/settings/settings-select";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/settings/settings-list";
import { Switch } from "@/components/ui/switch";
import {
  setCompactScreenEdges,
  useCompactScreenEdges,
} from "@/lib/compact-screen-edges";
import { useLocale } from "@/lib/i18n/use-locale";
import { LOCALE_OPTIONS, isLocaleValue } from "@/lib/i18n/locale-storage";

const MODES = [
  { value: "system", icon: Laptop },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

/** Theme, language, and how close the page sits to the screen edge. */
export function GeneralSettingsGroup() {
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const compactScreenEdges = useCompactScreenEdges();
  const activeMode = MODES.find((mode) => mode.value === theme) ?? MODES[0];
  const activeLocale =
    LOCALE_OPTIONS.find((option) => option.value === locale) ??
    LOCALE_OPTIONS[0];

  return (
    <SettingsGroup title={t("groups.general")}>
      <SettingsRow
        label={t("appearance.theme")}
        control={
          <SettingsSelect
            ariaLabel={t("appearance.theme")}
            value={activeMode.value}
            onValueChange={setTheme}
            compact
            options={MODES.map(({ value, icon }) => ({
              value,
              icon,
              label: t(`appearance.modes.${value}`),
            }))}
          />
        }
      />
      <SettingsRow
        label={t("language.title")}
        control={
          <SettingsSelect
            ariaLabel={t("language.title")}
            value={activeLocale.value}
            onValueChange={(value) => {
              if (isLocaleValue(value)) setLocale(value);
            }}
            compact
            options={LOCALE_OPTIONS}
          />
        }
      />
      <SettingsRow
        htmlFor="compact-screen-edges"
        label={t("screenEdges.label")}
        hint={t("screenEdges.hint")}
        hintId="compact-screen-edges-hint"
        control={
          <Switch
            id="compact-screen-edges"
            aria-describedby="compact-screen-edges-hint"
            checked={compactScreenEdges}
            onCheckedChange={setCompactScreenEdges}
          />
        }
      />
    </SettingsGroup>
  );
}
