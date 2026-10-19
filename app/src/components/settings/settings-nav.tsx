import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  HardDriveDownload,
  Info,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { settingsPanelPath, type SettingsPanel } from "@/lib/settings/panels";
import { cn } from "@/lib/utils";

const PANEL_ICONS: Record<SettingsPanel, LucideIcon> = {
  general: SlidersHorizontal,
  journal: BookOpen,
  account: UserRound,
  ai: Sparkles,
  data: HardDriveDownload,
  about: Info,
};

interface SettingsNavProps {
  panels: readonly SettingsPanel[];
  current: SettingsPanel;
}

/**
 * Which part of Settings is open. A rail beside the panel at `lg`; a strip that
 * scrolls sideways on a phone. Real links to `?panel=`, so Back, a reload and a
 * link from Home or Today reach the same panel, and keyboard and screen-reader
 * use need nothing beyond `aria-current`.
 */
export function SettingsNav({ panels, current }: SettingsNavProps) {
  const { t } = useTranslation("settings");
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // On a phone the strip can hide the open panel off to the side: bring it into
  // view. `block: nearest` keeps the page itself where it is.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);

  return (
    <nav
      aria-label={t("panels.label")}
      className="overflow-x-auto pb-1 lg:sticky lg:top-4 lg:self-start lg:overflow-visible lg:pb-0"
    >
      <ul className="flex gap-1 lg:flex-col">
        {panels.map((panel) => {
          const Icon = PANEL_ICONS[panel];
          const active = panel === current;
          return (
            <li key={panel} className="shrink-0">
              <Link
                ref={active ? activeRef : undefined}
                to={settingsPanelPath(panel)}
                replace
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-sage text-green-deep"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(`panels.${panel}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
