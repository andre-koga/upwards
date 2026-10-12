import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { MessageSquare, Monitor, Moon, RefreshCcw, Sun } from "lucide-react";
import { SECONDARY_DESTINATIONS, TABS } from "@/lib/navigation/destinations";
import type { PaletteCommand } from "@/components/layout/command-palette";

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * The palette's commands: every destination, send feedback, and appearance.
 * Searching the record itself (entries, memos, activities, places) arrives
 * with the Journal archive search (B3); this is the navigation layer.
 */
export function usePaletteCommands(onOpenFeedback: () => void) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  return useMemo<PaletteCommand[]>(() => {
    const k = (key: string) => words(t(`palette.keywords.${key}`));
    const tabKeywords: Record<string, string[]> = {
      home: k("home"),
      today: k("today"),
      journal: k("journal"),
      you: k("you"),
    };

    const go: PaletteCommand[] = TABS.map((tab) => ({
      id: `go-${tab.id}`,
      group: "go",
      label: t(tab.labelKey),
      keywords: tabKeywords[tab.id],
      icon: tab.icon,
      shortcut: tab.shortcut,
      run: () => navigate(tab.to),
    }));

    const secondaryKeywords: Record<string, string[]> = {
      memories: k("memories"),
      whatsNew: k("whatsNew"),
      logs: k("errorLogs"),
    };
    for (const item of SECONDARY_DESTINATIONS) {
      go.push({
        id: `go-${item.id}`,
        group: "go",
        label: t(item.labelKey),
        keywords: secondaryKeywords[item.id],
        icon: item.icon,
        run: () => navigate(item.to),
      });
    }
    go.push({
      id: "go-sync-issues",
      group: "go",
      label: t("palette.commands.syncIssues"),
      keywords: k("syncIssues"),
      icon: RefreshCcw,
      run: () => navigate("/settings/sync-issues"),
    });

    const themeKeywords = k("theme");
    return [
      ...go,
      {
        id: "action-feedback",
        group: "actions",
        label: t("palette.commands.feedback"),
        keywords: k("feedback"),
        icon: MessageSquare,
        run: onOpenFeedback,
      },
      {
        id: "theme-light",
        group: "appearance",
        label: t("palette.commands.themeLight"),
        keywords: themeKeywords,
        icon: Sun,
        run: () => setTheme("light"),
      },
      {
        id: "theme-dark",
        group: "appearance",
        label: t("palette.commands.themeDark"),
        keywords: themeKeywords,
        icon: Moon,
        run: () => setTheme("dark"),
      },
      {
        id: "theme-system",
        group: "appearance",
        label: t("palette.commands.themeSystem"),
        keywords: themeKeywords,
        icon: Monitor,
        run: () => setTheme("system"),
      },
    ];
  }, [t, navigate, setTheme, onOpenFeedback]);
}
