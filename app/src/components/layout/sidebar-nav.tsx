import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SECONDARY_DESTINATIONS,
  TABS,
  activeTabForPath,
} from "@/lib/navigation/destinations";
import {
  hasUnreadWhatsNewRelease,
  markWhatsNewSeen,
} from "@/lib/whats-new-read";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShortcutChip } from "@/components/layout/shortcut-chip";

const ITEM_CLASS =
  "group relative flex h-10 w-full items-center justify-center gap-3 rounded-lg px-0 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring lg:justify-start lg:px-3";

interface SidebarItemProps {
  label: string;
  icon: ReactNode;
  children?: ReactNode;
  isActive?: boolean;
}

/** Icon-only (with tooltip) from `md`, icon + label from `lg`. */
function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ItemBody({ label, icon, children }: SidebarItemProps) {
  return (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="sr-only lg:not-sr-only lg:flex-1 lg:truncate lg:text-left">
        {label}
      </span>
      {children}
    </>
  );
}

function stateClass(isActive: boolean | undefined) {
  return isActive
    ? "bg-sage text-green-deep"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";
}

interface SidebarNavProps {
  onOpenPalette: () => void;
  onOpenFeedback: () => void;
}

/** Persistent desktop navigation. Hidden below `md`; the tab bar takes over. */
export function SidebarNav({ onOpenPalette, onOpenFeedback }: SidebarNavProps) {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const activeTab = activeTabForPath(pathname);
  const [hasUnread, setHasUnread] = useState(hasUnreadWhatsNewRelease);

  useEffect(() => {
    // The What's new page marks itself seen; re-read when the route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasUnread(hasUnreadWhatsNewRelease());
  }, [pathname]);

  return (
    <aside className="hidden shrink-0 flex-col border-r border-border bg-card md:flex md:w-16 lg:w-60">
      <div className="flex h-14 items-center justify-center px-3 lg:justify-start lg:px-5">
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          <span aria-hidden className="lg:hidden">
            U
          </span>
          <span className="sr-only lg:not-sr-only">Upwards</span>
        </span>
      </div>

      <div className="px-2 pb-2">
        <RailTooltip label={t("palette.open")}>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-keyshortcuts="Control+K Meta+K"
            className={cn(
              ITEM_CLASS,
              "border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ItemBody
              label={t("palette.openShort")}
              icon={<Search className="h-4 w-4" aria-hidden />}
            >
              <ShortcutChip keys="K" className="hidden lg:inline" />
            </ItemBody>
          </button>
        </RailTooltip>
      </div>

      <nav
        aria-label={t("primaryNavigation")}
        className="flex flex-col gap-1 px-2"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <RailTooltip key={tab.id} label={t(tab.labelKey)}>
              <Link
                to={tab.to}
                aria-current={isActive ? "page" : undefined}
                aria-keyshortcuts={`Control+${tab.shortcut} Meta+${tab.shortcut}`}
                className={cn(ITEM_CLASS, stateClass(isActive))}
              >
                <ItemBody
                  label={t(tab.labelKey)}
                  icon={<Icon className="h-5 w-5" aria-hidden />}
                >
                  <ShortcutChip
                    keys={tab.shortcut}
                    className="hidden lg:inline"
                  />
                </ItemBody>
              </Link>
            </RailTooltip>
          );
        })}
      </nav>

      <Separator className="mx-auto my-3 w-8 lg:mx-4 lg:w-auto" />

      <nav
        aria-label={t("moreNavigation")}
        className="flex flex-col gap-1 px-2"
      >
        {SECONDARY_DESTINATIONS.map((item) => {
          const Icon = item.icon;
          const isWhatsNew = item.id === "whatsNew";
          const isActive = pathname === item.to;
          const label = t(item.labelKey);
          const accessibleLabel =
            isWhatsNew && hasUnread ? t("whatsNewUnread") : label;
          return (
            <RailTooltip key={item.id} label={accessibleLabel}>
              <Link
                to={item.to}
                aria-label={accessibleLabel}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (isWhatsNew) {
                    markWhatsNewSeen();
                    setHasUnread(false);
                  }
                }}
                className={cn(ITEM_CLASS, stateClass(isActive))}
              >
                <ItemBody
                  label={label}
                  icon={<Icon className="h-4 w-4" aria-hidden />}
                >
                  {isWhatsNew && hasUnread ? (
                    <span
                      aria-hidden
                      className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terracotta ring-2 ring-card lg:static lg:ring-0"
                    />
                  ) : null}
                </ItemBody>
              </Link>
            </RailTooltip>
          );
        })}
        <RailTooltip label={t("feedback")}>
          <button
            type="button"
            onClick={onOpenFeedback}
            className={cn(ITEM_CLASS, stateClass(false))}
          >
            <ItemBody
              label={t("feedback")}
              icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            />
          </button>
        </RailTooltip>
      </nav>
    </aside>
  );
}
