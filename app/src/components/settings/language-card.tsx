import { Languages, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between px-3"
            >
              <span className="text-sm">{activeOption.label}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel>{t("language.current")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={locale} onValueChange={handleChange}>
              {LOCALE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {LOCALE_OPTIONS.length < 2 && (
          <p className="text-xs text-muted-foreground">
            {t("language.comingSoon")}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
