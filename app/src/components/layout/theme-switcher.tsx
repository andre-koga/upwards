import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import {
  PALETTE_OPTIONS,
  THEME_MODE_OPTIONS,
  type PaletteOption,
  type PaletteValue,
  type ThemeModeOption,
  type ThemeModeValue,
} from "@/lib/themes";
import {
  getStoredPalette,
  isPaletteValue,
  setStoredPalette,
} from "@/lib/palette";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const ThemeSwitcher = () => {
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const [palette, setPalette] = useState<PaletteValue>(getStoredPalette());

  const ICON_SIZE = 16;
  const activeMode: ThemeModeValue =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const activeModeOption =
    THEME_MODE_OPTIONS.find((modeOption) => modeOption.value === activeMode) ??
    THEME_MODE_OPTIONS[0];
  const activePaletteOption =
    PALETTE_OPTIONS.find((paletteOption) => paletteOption.value === palette) ??
    PALETTE_OPTIONS[0];

  const ActiveModeIcon = activeModeOption.icon;
  const ActivePaletteIcon = activePaletteOption.icon;
  const activeModeLabel = t(`appearance.modes.${activeModeOption.value}`);
  const activePaletteLabel = t(`appearance.palettes.${activePaletteOption.value}`);

  const renderModeItem = (modeOption: ThemeModeOption) => {
    const OptionIcon = modeOption.icon;
    const label = t(`appearance.modes.${modeOption.value}`);

    return (
      <DropdownMenuRadioItem
        key={modeOption.value}
        className="flex gap-2"
        value={modeOption.value}
      >
        <OptionIcon size={ICON_SIZE} className="text-muted-foreground" />
        <span>{label}</span>
      </DropdownMenuRadioItem>
    );
  };

  const renderPaletteItem = (paletteOption: PaletteOption) => {
    const OptionIcon = paletteOption.icon;
    const label = t(`appearance.palettes.${paletteOption.value}`);

    return (
      <DropdownMenuRadioItem
        key={paletteOption.value}
        className="flex gap-2"
        value={paletteOption.value}
      >
        <OptionIcon size={ICON_SIZE} className="text-muted-foreground" />
        <span>{label}</span>
      </DropdownMenuRadioItem>
    );
  };

  const handlePaletteChange = (value: string) => {
    if (!isPaletteValue(value)) {
      return;
    }

    setPalette(value);
    setStoredPalette(value);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("appearance.theme")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between px-3"
            >
              <span className="flex items-center gap-2">
                <ActiveModeIcon
                  size={ICON_SIZE}
                  className="text-muted-foreground"
                />
                <span className="text-sm">{activeModeLabel}</span>
              </span>
              <ChevronDown size={ICON_SIZE} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel>{t("appearance.theme")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={activeMode} onValueChange={setTheme}>
              {THEME_MODE_OPTIONS.map((modeOption) =>
                renderModeItem(modeOption)
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("appearance.palette")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between px-3"
            >
              <span className="flex items-center gap-2">
                <ActivePaletteIcon
                  size={ICON_SIZE}
                  className="text-muted-foreground"
                />
                <span className="text-sm">{activePaletteLabel}</span>
              </span>
              <ChevronDown size={ICON_SIZE} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuLabel>{t("appearance.palette")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={palette}
              onValueChange={handlePaletteChange}
            >
              {PALETTE_OPTIONS.map((paletteOption) =>
                renderPaletteItem(paletteOption)
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export { ThemeSwitcher };
