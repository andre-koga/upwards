import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SettingsSelect } from "@/components/settings/settings-select";
import { SettingsSection } from "@/components/ui/settings-section";
import { useLocale } from "@/lib/i18n/use-locale";
import { LOCALE_OPTIONS, isLocaleValue } from "@/lib/i18n/locale-storage";

export function LanguageCard() {
  const { t } = useTranslation("settings");
  const { locale, setLocale } = useLocale();

  const activeOption =
    LOCALE_OPTIONS.find((option) => option.value === locale) ??
    LOCALE_OPTIONS[0];

  const handleChange = (value: string) => {
    if (!isLocaleValue(value)) return;
    setLocale(value);
  };

  return (
    <SettingsSection title={t("language.title")} icon={Languages}>
      <div className="space-y-1">
        <SettingsSelect
          ariaLabel={t("language.title")}
          value={activeOption.value}
          onValueChange={handleChange}
          options={LOCALE_OPTIONS}
        />
        {LOCALE_OPTIONS.length < 2 && (
          <p className="text-xs text-muted-foreground">
            {t("language.comingSoon")}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
